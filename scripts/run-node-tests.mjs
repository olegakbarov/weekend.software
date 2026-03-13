import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { spawn } from "node:child_process";

async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTestFiles(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

const rootDir = process.cwd();
const srcDir = join(rootDir, "src");
const testFiles = (await collectTestFiles(srcDir))
  .map((filePath) => relative(rootDir, filePath))
  .sort();

if (testFiles.length === 0) {
  console.log("No Node test files found.");
  process.exit(0);
}

const child = spawn(
  process.execPath,
  ["--experimental-strip-types", "--test", ...testFiles],
  {
    cwd: rootDir,
    stdio: "inherit",
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
