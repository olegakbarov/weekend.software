// Runs after `vite build` to finish assembling dist/ as a self-contained npm
// package: copies tokens.css + bundled font, writes a minimal package.json,
// and emits a README with two consumption scenarios.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const dist = resolve(pkgRoot, "dist");

await mkdir(resolve(dist, "fonts"), { recursive: true });
await copyFile(resolve(pkgRoot, "src/tokens.css"), resolve(dist, "tokens.css"));
await copyFile(
  resolve(pkgRoot, "src/fonts/InterVariable.ttf"),
  resolve(dist, "fonts/InterVariable.ttf"),
);

const src = JSON.parse(await readFile(resolve(pkgRoot, "package.json"), "utf8"));
const distPkg = {
  name: "@weekend/design",
  version: src.version ?? "0.0.0",
  type: "module",
  main: "./index.js",
  module: "./index.js",
  types: "./index.d.ts",
  exports: {
    ".": { types: "./index.d.ts", default: "./index.js" },
    "./registry": { types: "./registry.d.ts", default: "./registry.js" },
    "./index.css": "./index.css",
    "./tokens.css": "./tokens.css",
    "./fonts/*": "./fonts/*",
  },
  sideEffects: ["**/*.css"],
  peerDependencies: src.peerDependencies,
  dependencies: src.dependencies,
};
await writeFile(resolve(dist, "package.json"), JSON.stringify(distPkg, null, 2) + "\n");

const readme = `# @weekend/design

Self-contained build of the Weekend design system. Two ways to use it.

## 1. Static HTML

Drop the CSS into any page. Set \`data-theme\` on \`<html>\` to opt into dark
mode (omit for light).

\`\`\`html
<!doctype html>
<html data-theme="dark">
  <head>
    <link rel="stylesheet" href="weekend-design/tokens.css" />
    <link rel="stylesheet" href="weekend-design/index.css" />
  </head>
  <body>
    <button class="btn btn-primary">Click</button>
  </body>
</html>
\`\`\`

## 2. React / Vite

\`\`\`ts
import "@weekend/design/tokens.css";
import "@weekend/design/index.css";
import { Button } from "@weekend/design";

export function App() {
  return <Button variant="primary">Click</Button>;
}
\`\`\`

Registry components (Dialog, Tooltip, Table, ...) are exported from
\`@weekend/design/registry\` and require Tailwind v4 in the consumer.
`;
await writeFile(resolve(dist, "README.md"), readme);
