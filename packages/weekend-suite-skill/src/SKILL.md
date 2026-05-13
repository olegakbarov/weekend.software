---
name: weekend-suite
description: Load when working inside a Weekend project (path under ~/.weekend/<project>/) — touching weekend.config.json, importing from @weekend/design, building UI, testing the running app, or reading ./shared-assets/. Triggers on portless runtime, Weekend MCP, theme tokens, four-theme support, "use the design system", "test in the browser pane".
---

# weekend-suite

You are working inside a Weekend project. Weekend is a desktop workspace that
owns the runtime, the live browser pane, and the shared design system on
your behalf. Projects live under `~/.weekend/<project>/`. They are normal
Node/Vite (or static) repos with four extras that you must respect:

- `weekend.config.json` — the runtime contract. The dev server is reached
  through a portless proxy URL Weekend manages, not a raw `localhost:<port>`.
- `./shared-assets/weekend-design/` — a prebuilt copy of `@weekend/design`
  (tokens, fonts, CSS, React components). It is read-only, synced from
  Weekend, and meant to be installed as a `file:` dependency.
- `./shared-assets/` (other entries) — user-managed files (fonts, data,
  reference images). Ask before consuming.
- `weekend` MCP — gives you the project's running browser pane so
  you can snapshot, click, type, and `eval_js` against the real app instead
  of spinning up a headless browser.

## Core rules

1. **Read `weekend.config.json` before launching runtime commands.** The dev
   endpoint comes from `runtime.url` (the portless proxy). Do not assume the
   process is wrapped; do not hardcode `http://localhost:<port>`. If you
   need the deployed URL, use `runtime.deployUrl` when present. See
   `runtime-config.md`.

2. **Use `@weekend/design` — don't reinvent visual primitives.** Button,
   Dialog, Input, Badge, Combobox, Tabs, Accordion, Toggle, Slider, and more
   already exist. Before writing a new component, check the package. See
   `design-system.md`.

3. **Switch themes by setting `<html data-theme="...">` only.** Valid values:
   `fluid`, `fluid-dark`, `weekend-dark`, `weekend-paper`. Never write
   `document.documentElement.style.setProperty('--foo', ...)` — inline
   styles win the cascade and break the design system's
   `:root[data-theme=...]` blocks.

4. **Prefer Weekend MCP browser tools over headless browsers, curl, or wget.**
   You have a live pane attached to this project. Start with
   `browser_snapshot`, then use ref-based actions (`browser_click_ref`,
   `browser_type_ref`). See `mcp.md`.

5. **Ask before consuming `./shared-assets/`.** User-managed assets (fonts,
   data, images outside `weekend-design/`) are not implicitly opt-in. If
   you think one applies, name it and ask. See `shared-assets.md`.

6. **`./shared-assets/weekend-design/` is read-only.** It is a consumed
   artifact, like `node_modules`. Do not patch it locally. If a primitive
   is missing or broken, report the blocker — don't fork it.

## When to load which sibling

- `design-system.md` — building UI, picking components, theming, adding
  `@weekend/design` to `package.json`, importing CSS.
- `mcp.md` — testing the running app, debugging UI, reading
  rendered text, filling forms, navigating.
- `runtime-config.md` — anything that touches `weekend.config.json`, dev
  server URLs, deploy URLs, or "why isn't my fetch working".
- `shared-assets.md` — user mentions fonts, images, datasets, or anything
  under `./shared-assets/` that isn't `weekend-design`.
- `gotchas.md` — read once on first load of this skill in a conversation,
  or whenever a behavior smells wrong (theme not switching, fetch hitting
  the wrong host, "I'll just wrap this Button…").
