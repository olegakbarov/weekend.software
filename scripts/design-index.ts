#!/usr/bin/env tsx
/**
 * design-index.ts — scans the repo for consumers of `@weekend/design` and
 * `@weekend/design/registry`, then writes a JSON manifest per exported symbol
 * to `packages/design/.consumers/<kebab-symbol>.json`.
 *
 * Usage:
 *   pnpm design:index           # write manifest files
 *   pnpm design:index:check     # exit non-zero if any file would change
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind, type SourceFile } from "ts-morph";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const DESIGN_PKG_DIR = join(REPO_ROOT, "packages", "design");
const DESIGN_SRC_DIR = join(DESIGN_PKG_DIR, "src");
const CORE_INDEX = join(DESIGN_SRC_DIR, "index.ts");
const REGISTRY_INDEX = join(DESIGN_SRC_DIR, "registry.ts");
const OUTPUT_DIR = join(DESIGN_PKG_DIR, ".consumers");

const CORE_PKG = "@weekend/design";
const REGISTRY_PKG = "@weekend/design/registry";

type Tier = "core" | "registry";

interface ConsumerEntry {
  file: string;
  line: number;
  props: string[];
}

interface SymbolManifest {
  symbol: string;
  tier: Tier;
  consumers: ConsumerEntry[];
  propUsage: Record<string, number>;
  totalUsages: number;
}

function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();
}

/**
 * Parse a barrel file and collect runtime (value) export names. Skip
 * `export type { ... }` statements entirely.
 */
function collectRuntimeExports(filePath: string): string[] {
  const project = new Project({ useInMemoryFileSystem: false, skipAddingFilesFromTsConfig: true });
  const sf = project.addSourceFileAtPath(filePath);
  const names: string[] = [];

  for (const decl of sf.getExportDeclarations()) {
    if (decl.isTypeOnly()) continue;
    for (const spec of decl.getNamedExports()) {
      if (spec.isTypeOnly()) continue;
      // Use the alias if present (the externally visible name), else the actual name.
      const alias = spec.getAliasNode();
      names.push((alias ?? spec.getNameNode()).getText());
    }
  }

  return names;
}

interface ImportBinding {
  /** Local name in the consumer file. */
  localName: string;
  /** Original exported name from the package. */
  importedName: string;
  tier: Tier;
}

function collectImportBindings(sf: SourceFile): ImportBinding[] {
  const bindings: ImportBinding[] = [];
  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    let tier: Tier | null = null;
    if (spec === CORE_PKG) tier = "core";
    else if (spec === REGISTRY_PKG) tier = "registry";
    if (!tier) continue;
    if (imp.isTypeOnly()) continue;

    for (const named of imp.getNamedImports()) {
      if (named.isTypeOnly()) continue;
      const importedName = named.getNameNode().getText();
      const aliasNode = named.getAliasNode();
      const localName = aliasNode ? aliasNode.getText() : importedName;
      bindings.push({ localName, importedName, tier });
    }
    // Default and namespace imports are not part of the design package shape
    // (no `export default`), so we ignore them.
  }
  return bindings;
}

interface UsageRecord {
  file: string;
  line: number;
  props: string[];
}

/**
 * Walk JSX in the file and collect usages keyed by local identifier name.
 * Handles dotted names (e.g. `<Dialog.Trigger>`) by keying on the root token,
 * which is fine because we only care about identifiers that match an import.
 */
function collectJsxUsages(sf: SourceFile, relPath: string): Map<string, UsageRecord[]> {
  const out = new Map<string, UsageRecord[]>();

  const record = (
    rootName: string,
    line: number,
    attrNodes: ReturnType<SourceFile["getDescendantsOfKind"]>,
  ) => {
    const props: string[] = [];
    for (const node of attrNodes) {
      if (node.getKind() === SyntaxKind.JsxAttribute) {
        // ts-morph: JsxAttribute has getNameNode()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (node as any).getNameNode().getText();
        props.push(name);
      }
      // JsxSpreadAttribute is intentionally skipped — props are unknown.
    }
    let bucket = out.get(rootName);
    if (!bucket) {
      bucket = [];
      out.set(rootName, bucket);
    }
    bucket.push({ file: relPath, line, props });
  };

  // Self-closing: <Foo ... />
  for (const el of sf.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)) {
    const tagText = el.getTagNameNode().getText();
    const root = tagText.split(".")[0]!;
    const attrs = el.getAttributes();
    record(
      root,
      el.getStartLineNumber(),
      // Filter to JsxAttribute kinds; ts-morph types JsxAttributeLike covers spreads too.
      attrs.filter((a) => a.getKind() === SyntaxKind.JsxAttribute) as ReturnType<
        SourceFile["getDescendantsOfKind"]
      >,
    );
  }

  // Open tag of paired element: <Foo ...>...</Foo>
  for (const el of sf.getDescendantsOfKind(SyntaxKind.JsxOpeningElement)) {
    const tagText = el.getTagNameNode().getText();
    const root = tagText.split(".")[0]!;
    const attrs = el.getAttributes();
    record(
      root,
      el.getStartLineNumber(),
      attrs.filter((a) => a.getKind() === SyntaxKind.JsxAttribute) as ReturnType<
        SourceFile["getDescendantsOfKind"]
      >,
    );
  }

  return out;
}

function sortPropUsage(propUsage: Record<string, number>): Record<string, number> {
  const sorted: Record<string, number> = {};
  for (const k of Object.keys(propUsage).toSorted()) {
    sorted[k] = propUsage[k]!;
  }
  return sorted;
}

function buildManifest(symbol: string, tier: Tier, raw: ConsumerEntry[]): SymbolManifest {
  const consumers = raw.toSorted((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line;
  });
  const propUsage: Record<string, number> = {};
  for (const c of consumers) {
    for (const p of c.props) {
      propUsage[p] = (propUsage[p] ?? 0) + 1;
    }
  }
  return {
    symbol,
    tier,
    consumers,
    propUsage: sortPropUsage(propUsage),
    totalUsages: consumers.length,
  };
}

function serializeManifest(m: SymbolManifest): string {
  // Stable JSON: keys in insertion order; consumers and propUsage already sorted.
  return JSON.stringify(m, null, 2) + "\n";
}

function main(): void {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");

  const t0 = Date.now();

  // 1. Read exported symbol names per tier.
  const coreNames = collectRuntimeExports(CORE_INDEX);
  const registryNames = collectRuntimeExports(REGISTRY_INDEX);

  // Map symbol -> tier; if a symbol is in both, prefer "core".
  const symbolTier = new Map<string, Tier>();
  for (const n of registryNames) symbolTier.set(n, "registry");
  for (const n of coreNames) symbolTier.set(n, "core");

  // 2. Build a project of all .ts/.tsx files in the repo (excluding ignored dirs).
  const project = new Project({
    tsConfigFilePath: join(REPO_ROOT, "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });

  const includeGlobs = [
    `${REPO_ROOT}/src/**/*.{ts,tsx}`,
    `${REPO_ROOT}/scripts/**/*.{ts,tsx}`,
    `${REPO_ROOT}/packages/*/src/**/*.{ts,tsx}`,
    `${REPO_ROOT}/src-mcp/**/*.{ts,tsx}`,
  ];
  const excludeGlobs = [
    `!${REPO_ROOT}/**/node_modules/**`,
    `!${REPO_ROOT}/**/.git/**`,
    `!${REPO_ROOT}/**/target/**`,
    `!${REPO_ROOT}/**/dist/**`,
    `!${REPO_ROOT}/**/.tanstack/**`,
    `!${REPO_ROOT}/**/.home-merge/**`,
    `!${REPO_ROOT}/packages/design/src/**`,
  ];

  project.addSourceFilesAtPaths([...includeGlobs, ...excludeGlobs]);

  // 3. For each scanned file, gather imports and JSX usages.
  // Map: tier|symbol -> ConsumerEntry[]
  const accum = new Map<string, ConsumerEntry[]>();
  const keyOf = (tier: Tier, symbol: string) => `${tier}::${symbol}`;

  for (const sf of project.getSourceFiles()) {
    const bindings = collectImportBindings(sf);
    if (bindings.length === 0) continue;

    const relPath = relative(REPO_ROOT, sf.getFilePath());
    const usages = collectJsxUsages(sf, relPath);

    for (const b of bindings) {
      // Consumers are recorded under the *exported* name, with the tier
      // determined by which barrel re-exports it (preferring core if both).
      const effectiveTier = symbolTier.get(b.importedName) ?? b.tier;
      const found = usages.get(b.localName);
      if (!found || found.length === 0) continue;
      const key = keyOf(effectiveTier, b.importedName);
      let bucket = accum.get(key);
      if (!bucket) {
        bucket = [];
        accum.set(key, bucket);
      }
      bucket.push(...found);
    }
  }

  // 4. Build manifests for every exported symbol (zero-consumer symbols included).
  const manifests = new Map<string, SymbolManifest>();
  for (const [symbol, tier] of symbolTier) {
    const key = keyOf(tier, symbol);
    const raw = accum.get(key) ?? [];
    manifests.set(symbol, buildManifest(symbol, tier, raw));
  }

  // 5. Determine on-disk file paths.
  // File name is kebab-cased symbol; collisions get a `-2`, `-3`, etc. suffix
  // by sorting symbols and disambiguating deterministically.
  const usedNames = new Set<string>();
  const fileNameFor = (symbol: string): string => {
    const base = kebabCase(symbol);
    let candidate = `${base}.json`;
    let i = 2;
    while (usedNames.has(candidate)) {
      candidate = `${base}-${i}.json`;
      i += 1;
    }
    usedNames.add(candidate);
    return candidate;
  };

  // Sort symbols so file naming is deterministic.
  const orderedSymbols = [...manifests.keys()].toSorted();
  const targets = new Map<string, string>(); // absPath -> serialized content
  for (const sym of orderedSymbols) {
    const m = manifests.get(sym)!;
    const fileName = fileNameFor(sym);
    targets.set(join(OUTPUT_DIR, fileName), serializeManifest(m));
  }

  // 6. Write or check.
  if (checkMode) {
    const issues: string[] = [];
    const expectedFiles = new Set([...targets.keys()].map((p) => relative(REPO_ROOT, p)));
    if (existsSync(OUTPUT_DIR)) {
      for (const entry of readdirSync(OUTPUT_DIR)) {
        if (!entry.endsWith(".json")) continue;
        const abs = join(OUTPUT_DIR, entry);
        if (!targets.has(abs)) {
          issues.push(`unexpected file (would be removed): ${relative(REPO_ROOT, abs)}`);
        }
      }
    }
    for (const [abs, content] of targets) {
      const rel = relative(REPO_ROOT, abs);
      if (!existsSync(abs)) {
        issues.push(`missing file (would be created): ${rel}`);
        continue;
      }
      const current = readFileSync(abs, "utf8");
      if (current !== content) {
        issues.push(`stale file (would be rewritten): ${rel}`);
      }
    }
    const elapsed = Date.now() - t0;
    if (issues.length > 0) {
      console.error(
        `design:index:check FAILED (${issues.length} issue${issues.length === 1 ? "" : "s"}):`,
      );
      for (const i of issues) console.error(`  - ${i}`);
      console.error(`(${expectedFiles.size} expected files, took ${elapsed}ms)`);
      process.exit(1);
    }
    console.log(
      `design:index:check OK — ${expectedFiles.size} manifest files match (${elapsed}ms)`,
    );
    return;
  }

  // Write mode: clean and rewrite.
  if (existsSync(OUTPUT_DIR)) {
    for (const entry of readdirSync(OUTPUT_DIR)) {
      if (entry.endsWith(".json")) {
        rmSync(join(OUTPUT_DIR, entry));
      }
    }
  } else {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  for (const [abs, content] of targets) {
    writeFileSync(abs, content);
  }
  const elapsed = Date.now() - t0;
  console.log(
    `design:index wrote ${targets.size} manifest files to ${relative(REPO_ROOT, OUTPUT_DIR)}/ (${elapsed}ms)`,
  );
}

main();
