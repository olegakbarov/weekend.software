#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const REQUEST_TIMEOUT_MS = 35000;

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function ancestors(start) {
  const items = [];
  let current = path.resolve(start);
  while (true) {
    items.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return items;
}

function findProjectRoot(start) {
  for (const candidate of ancestors(start)) {
    if (existsSync(path.join(candidate, ".mcp.json"))) {
      return candidate;
    }
  }
  return path.resolve(start);
}

function readWeekendServerConfig(projectRoot) {
  const mcpPath = path.join(projectRoot, ".mcp.json");
  if (!existsSync(mcpPath)) {
    throw new Error(`missing ${mcpPath}`);
  }

  const parsed = JSON.parse(readFileSync(mcpPath, "utf8"));
  const server = parsed?.mcpServers?.["weekend-browser"];
  if (!server || typeof server !== "object") {
    throw new Error(`missing mcpServers.weekend-browser in ${mcpPath}`);
  }

  if (typeof server.command !== "string" || server.command.trim() === "") {
    throw new Error(`invalid weekend-browser command in ${mcpPath}`);
  }

  return {
    command: path.isAbsolute(server.command)
      ? server.command
      : path.resolve(projectRoot, server.command),
    args: Array.isArray(server.args) ? server.args.map(String) : [],
    env:
      server.env && typeof server.env === "object"
        ? Object.fromEntries(
            Object.entries(server.env).map(([key, value]) => [key, String(value)])
          )
        : {},
  };
}

function toolText(result) {
  const content = result?.result?.content;
  if (!Array.isArray(content)) {
    throw new Error(`invalid tool response: ${JSON.stringify(result)}`);
  }
  const textEntry = content.find((entry) => entry?.type === "text");
  if (!textEntry || typeof textEntry.text !== "string") {
    throw new Error(`missing text tool response: ${JSON.stringify(result)}`);
  }
  return textEntry.text;
}

function parseJsonText(text, fallbackLabel) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`failed to parse ${fallbackLabel}: ${error.message}\n${text}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = findProjectRoot(args["project-root"] || process.cwd());
  const server = readWeekendServerConfig(projectRoot);
  const env = { ...process.env, ...server.env };

  if (!env.WEEKEND_PROJECT) {
    env.WEEKEND_PROJECT = path.basename(projectRoot);
  }

  const child = spawn(server.command, server.args, {
    cwd: projectRoot,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stderr = [];
  child.stderr.on("data", (chunk) => {
    stderr.push(String(chunk));
  });

  const rl = readline.createInterface({ input: child.stdout });
  let nextId = 1;
  const pending = new Map();

  rl.on("line", (line) => {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      for (const { reject, timer } of pending.values()) {
        clearTimeout(timer);
        reject(new Error(`invalid JSON from MCP server: ${error.message}\n${line}`));
      }
      pending.clear();
      return;
    }

    const entry = pending.get(message.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(message.id);
    if (message.error) {
      entry.reject(
        new Error(
          `MCP error ${message.error.code ?? "unknown"}: ${message.error.message ?? "unknown error"}`
        )
      );
      return;
    }
    entry.resolve(message);
  });

  child.on("exit", (code, signal) => {
    const detail = `weekend-browser-mcp exited code=${code ?? "null"} signal=${signal ?? "null"}`;
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error(`${detail}\n${stderr.join("")}`.trim()));
    }
    pending.clear();
  });

  function request(method, params = {}) {
    const id = nextId;
    nextId += 1;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timed out waiting for MCP response to ${method}`));
      }, REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${payload}\n`);
    });
  }

  try {
    await request("initialize", {});
    const listResult = await request("tools/call", {
      name: "browser_list_webviews",
      arguments: {},
    });
    const labels = parseJsonText(toolText(listResult), "browser_list_webviews response");
    if (!Array.isArray(labels) || labels.length === 0) {
      throw new Error("browser_list_webviews returned no labels");
    }

    const projectPrefix = `browser-pane:${env.WEEKEND_PROJECT}:`;
    const label =
      args.label ||
      labels.find((candidate) => typeof candidate === "string" && candidate.startsWith(projectPrefix)) ||
      (labels.length === 1 ? labels[0] : null);

    if (!label || typeof label !== "string") {
      throw new Error(
        `could not resolve browser label for project '${env.WEEKEND_PROJECT}'. labels=${JSON.stringify(labels)}`
      );
    }

    const urlResult = await request("tools/call", {
      name: "browser_get_url",
      arguments: { label },
    });
    const evalResult = await request("tools/call", {
      name: "browser_eval_js",
      arguments: {
        label,
        script:
          args.script ||
          "return ({ title: document.title, href: window.location.href, bridgeReady: Boolean(window.__WEEKEND_BRIDGE__) })",
      },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          projectRoot,
          project: env.WEEKEND_PROJECT,
          label,
          url: toolText(urlResult),
          eval: toolText(evalResult),
        },
        null,
        2
      )
    );
  } finally {
    child.stdin.end();
    child.kill();
    rl.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
