#!/usr/bin/env tsx
/**
 * sync-weekend-suite-skill.ts — mirror the weekend-suite-skill package into
 * the host's shared-assets directory so project seeding can symlink to it.
 *
 *   SOURCE: packages/weekend-suite-skill/src/
 *   DEST:   ~/.weekend/shared-assets/weekend-suite-skill/
 *
 * Mirror-style copy: top-level entries that exist in DEST but not in SOURCE
 * are removed (except `node_modules`, matching how the Rust side handles the
 * design dist sync). Nested directories are wiped before being recopied so a
 * removed file in SOURCE does not linger in DEST.
 *
 * The skill is a plain markdown bundle - there is no build step. If SOURCE
 * does not exist yet (the package is being created in parallel) the script
 * logs a friendly message and exits 0.
 *
 * Usage:
 *   pnpm sync:weekend-suite-skill
 */

import { existsSync, statSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TAG = "[sync-weekend-suite-skill]";
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(REPO, "packages/weekend-suite-skill/src");
const DEST = join(homedir(), ".weekend", "shared-assets", "weekend-suite-skill");

// Top-level entries we never delete from DEST, mirroring the Rust design-sync
// guard for npm install artifacts.
const PROTECTED_DEST_ENTRIES = new Set(["node_modules"]);

async function main(): Promise<void> {
  if (!existsSync(SOURCE)) {
    console.log(`${TAG} source not found at ${SOURCE}, skipping`);
    return;
  }

  if (!statSync(SOURCE).isDirectory()) {
    console.error(`${TAG} source ${SOURCE} exists but is not a directory`);
    process.exit(1);
  }

  await mkdir(DEST, { recursive: true });

  const sourceNames = new Set(await readdir(SOURCE));

  // Remove stale top-level entries in DEST.
  const destNames = await readdir(DEST);
  for (const name of destNames) {
    if (PROTECTED_DEST_ENTRIES.has(name)) continue;
    if (sourceNames.has(name)) continue;
    await rm(join(DEST, name), { recursive: true, force: true });
  }

  // Copy each top-level entry. Directories are wiped first so removed files
  // inside them do not linger.
  let fileCount = 0;
  for (const name of sourceNames) {
    const from = join(SOURCE, name);
    const to = join(DEST, name);
    const info = statSync(from);
    if (info.isDirectory()) {
      await rm(to, { recursive: true, force: true });
      await cp(from, to, { recursive: true });
      fileCount += await countFiles(to);
    } else {
      await cp(from, to);
      fileCount += 1;
    }
  }

  const prettyDest = DEST.replace(homedir(), "~");
  console.log(`${TAG} copied ${fileCount} file(s) to ${prettyDest}/`);
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await countFiles(full);
    } else {
      count += 1;
    }
  }
  return count;
}

main().catch((error) => {
  console.error(`${TAG} failed:`, error);
  process.exit(1);
});
