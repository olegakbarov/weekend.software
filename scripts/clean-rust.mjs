#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const PROFILE_MARKERS = [".fingerprint", "deps", "build", "incremental"];

const USAGE = [
  "Usage: node scripts/clean-rust.mjs [options]",
  "",
  "Options:",
  "  --dry-run, -n         Print what would be removed without deleting",
  "  --keep-profiles <n>   Keep N most-recent build profiles (default: 1)",
  "  --keep <n>            Alias for --keep-profiles",
  "  --target-dir <p>      Override cargo target directory",
  "  --verbose, -v         Print extra details",
  "  --help                Show this help",
].join("\n");

function parseArgs(argv) {
  const parsed = {
    dryRun: false,
    keepProfiles: 1,
    targetDir: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run" || arg === "-n") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      parsed.verbose = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--keep" || arg === "--keep-profiles") {
      const raw = argv[i + 1];
      if (raw) {
        parsed.keepProfiles = Number(raw);
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--keep=")) {
      parsed.keepProfiles = Number(arg.slice("--keep=".length));
      continue;
    }

    if (arg.startsWith("--keep-profiles=")) {
      parsed.keepProfiles = Number(arg.slice("--keep-profiles=".length));
      continue;
    }

    if (arg === "--target-dir") {
      const raw = argv[i + 1];
      if (raw) {
        parsed.targetDir = raw;
        i += 1;
      }
      continue;
    }

    if (arg.startsWith("--target-dir=")) {
      parsed.targetDir = arg.slice("--target-dir=".length);
      continue;
    }
  }

  if (!Number.isInteger(parsed.keepProfiles) || parsed.keepProfiles < 1) {
    throw new Error(`Invalid --keep-profiles value: ${parsed.keepProfiles}`);
  }

  return parsed;
}

async function pathExists(value) {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

function resolveTargetDir(explicit) {
  if (explicit) {
    return path.isAbsolute(explicit)
      ? explicit
      : path.resolve(repoRoot, explicit);
  }

  try {
    const output = execSync("cargo metadata --format-version 1 --no-deps", {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const metadata = JSON.parse(output);
    if (metadata?.target_directory) {
      return metadata.target_directory;
    }
  } catch {
    // Fall back to repo-root target directory.
  }

  return path.join(repoRoot, "target");
}

async function listDirs(dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => path.join(dir, entry.name));
}

async function hasProfileMarkers(dir) {
  for (const marker of PROFILE_MARKERS) {
    if (await pathExists(path.join(dir, marker))) {
      return true;
    }
  }
  return false;
}

async function listProfileDirs(targetDir) {
  const profileDirs = new Set();
  const topDirs = await listDirs(targetDir);

  for (const dir of topDirs) {
    if (await hasProfileMarkers(dir)) {
      profileDirs.add(dir);
      continue;
    }

    const nestedDirs = await listDirs(dir);
    for (const nested of nestedDirs) {
      if (await hasProfileMarkers(nested)) {
        profileDirs.add(nested);
      }
    }
  }

  return Array.from(profileDirs);
}

async function maxMtime(paths) {
  let max = 0;
  for (const candidate of paths) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.mtimeMs > max) {
        max = stat.mtimeMs;
      }
    } catch {
      // ignore missing paths
    }
  }
  return max;
}

async function profileMtime(dir) {
  const candidates = [
    dir,
    path.join(dir, ".cargo-lock"),
    ...PROFILE_MARKERS.map((marker) => path.join(dir, marker)),
  ];

  return maxMtime(candidates);
}

function formatPath(filePath) {
  const relative = path.relative(repoRoot, filePath);
  return relative && !relative.startsWith("..") ? relative : filePath;
}

async function removeDir(dirPath, options) {
  const label = formatPath(dirPath);
  if (options.dryRun) {
    process.stdout.write(`[dry-run] rm -rf ${label}\n`);
    return;
  }

  await fs.rm(dirPath, { recursive: true, force: true });
  if (options.verbose) {
    process.stdout.write(`removed ${label}\n`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }

  const targetDir = resolveTargetDir(options.targetDir);
  if (!(await pathExists(targetDir))) {
    process.stdout.write(`No Rust target directory found at ${formatPath(targetDir)}.\n`);
    return;
  }

  const profileDirs = await listProfileDirs(targetDir);
  if (profileDirs.length === 0) {
    process.stdout.write(
      `No Rust build profiles found under ${formatPath(targetDir)}.\n`,
    );
    return;
  }

  const profilesWithTimes = [];
  for (const dir of profileDirs) {
    const mtimeMs = await profileMtime(dir);
    profilesWithTimes.push({ dir, mtimeMs });
  }

  profilesWithTimes.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const keepCount = Math.min(options.keepProfiles, profilesWithTimes.length);
  const keepSet = new Set(
    profilesWithTimes.slice(0, keepCount).map((entry) => entry.dir),
  );

  if (options.verbose) {
    const kept = profilesWithTimes
      .slice(0, keepCount)
      .map((entry) => formatPath(entry.dir));
    process.stdout.write(`keeping profiles: ${kept.join(", ") || "(none)"}\n`);
  }

  let removed = 0;
  for (const entry of profilesWithTimes) {
    if (keepSet.has(entry.dir)) {
      continue;
    }
    removed += 1;
    await removeDir(entry.dir, options);
  }

  const modeLabel = options.dryRun ? "dry run" : "applied";
  process.stdout.write(
    `Rust cleanup ${modeLabel}. Kept ${keepCount} profile(s), removed ${removed}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`clean-rust failed: ${error.message}\n`);
  process.exit(1);
});
