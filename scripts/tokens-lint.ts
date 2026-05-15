#!/usr/bin/env tsx
/**
 * tokens-lint.ts — Phase 1 guard rail for the legacy token migration.
 *
 * Diagnoses drift between two token systems that currently coexist:
 *   - LEGACY:    src/styles.css           (.light / .dark / :root class blocks)
 *   - CANONICAL: packages/design/src/tokens.css   (:root[data-theme="..."] blocks)
 *
 * Reports:
 *   1. DUPLICATES — tokens defined in both files (drift hazard).
 *   2. MIGRATION TARGETS — tokens defined only in the legacy file but still
 *      consumed by .ts/.tsx/.css elsewhere in src/. These are what Phase 2+
 *      need to move into the canonical file.
 *
 * Usage:
 *   pnpm tokens:lint           # informational, always exits 0
 *   pnpm tokens:lint:check     # exit 1 if any migration target remains
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LEGACY = resolve(REPO, "src/styles.css");
const CANONICAL = resolve(REPO, "packages/design/src/tokens.css");

function tokenNames(file: string): Set<string> {
  const text = readFileSync(file, "utf8");
  return new Set(
    [...text.matchAll(/^\s*(--[a-z][a-z0-9-]*)\s*:/gm)].map((m) => m[1]!),
  );
}

function consumerFiles(token: string): string[] {
  try {
    const out = execSync(
      `grep -rl --include='*.ts' --include='*.tsx' --include='*.css' "var(${token})" src/`,
      { cwd: REPO, encoding: "utf8" },
    );
    return out
      .split("\n")
      .filter((f) => f && f !== "src/styles.css");
  } catch {
    return [];
  }
}

const legacy = tokenNames(LEGACY);
const canonical = tokenNames(CANONICAL);
const both = [...legacy].filter((t) => canonical.has(t)).toSorted();
const onlyLegacy = [...legacy].filter((t) => !canonical.has(t)).toSorted();

const migrationTargets = onlyLegacy.flatMap((token) => {
  const files = consumerFiles(token);
  return files.length > 0 ? [{ token, files }] : [];
});

console.log(`legacy:    ${relative(REPO, LEGACY)}  (${legacy.size} tokens)`);
console.log(`canonical: ${relative(REPO, CANONICAL)}  (${canonical.size} tokens)`);
console.log();
console.log(`DUPLICATES — defined in both files (${both.length}):`);
for (const t of both) console.log(`  ${t}`);
console.log();
console.log(
  `MIGRATION TARGETS — only in legacy, consumed by app code (${migrationTargets.length}):`,
);
for (const row of migrationTargets) {
  console.log(`  ${row.token}`);
  for (const f of row.files) console.log(`    ${f}`);
}

if (process.argv.includes("--check") && migrationTargets.length > 0) {
  console.error(
    "\nFAIL: legacy-only tokens have consumers — migrate to packages/design/src/tokens.css",
  );
  process.exit(1);
}
