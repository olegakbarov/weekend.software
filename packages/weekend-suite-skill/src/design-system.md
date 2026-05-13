# Design system — `@weekend/design`

Load when: building UI, picking a component, theming, or wiring the
design system into a fresh project.

`./shared-assets/weekend-design/` is a self-contained npm-installable
bundle: design tokens, base CSS, fonts, and a React component library.
For any new UI in a Weekend project, adopt it by default. Only skip it
when the user explicitly opts out (`designSystem=none`) or the project
genuinely cannot consume it (e.g. a non-web target).

## Install — React / Vite project

Add the local dependency:

```json
{
  "dependencies": {
    "@weekend/design": "file:./shared-assets/weekend-design"
  }
}
```

Then `pnpm install` (or `npm install` / whichever PM the project uses).
The `file:` protocol copies on install; re-install if the directory is
re-synced by Weekend.

Import the global CSS once, from the app's entry CSS file:

```css
@import "@weekend/design/tokens.css";
@import "@weekend/design/tailwind-theme.css";
@import "@weekend/design/index.css";
```

- `tokens.css` — all four `:root[data-theme="…"]` blocks (colors, radii,
  spacing, typography). Required.
- `tailwind-theme.css` — Tailwind v4 `@theme inline` generators so
  utilities like `text-xs`, `font-mono`, `rounded-sm` map to the tokens.
  Required if the project uses Tailwind.
- `index.css` — base reset, font faces, app-level defaults (`.btn`, etc.).

Then import components by name:

```ts
import { Button, Dialog, Input, Badge, Tabs } from "@weekend/design";
```

## Install — static HTML

```html
<link rel="stylesheet" href="./shared-assets/weekend-design/tokens.css">
<link rel="stylesheet" href="./shared-assets/weekend-design/index.css">
<button class="btn btn-primary">Click</button>
```

## Themes

Four themes ship in `tokens.css`. Switch by setting `data-theme` on
`<html>`:

```ts
document.documentElement.setAttribute("data-theme", "fluid-dark");
```

| Value           | Use                                          |
| --------------- | -------------------------------------------- |
| `fluid`         | Default. Light, generic.                     |
| `fluid-dark`    | Dark counterpart of `fluid`.                 |
| `weekend-dark`  | Weekend desktop's dark identity.             |
| `weekend-paper` | Paper-like light theme with warmer neutrals. |

`ThemeProvider` (if you build one) writes `data-theme` only. Never write
CSS variables onto `<html>` inline — that is specificity 1,0,0,0 and
overrides every theme block in `tokens.css`. Also toggle `.light` /
`.dark` classes if you need Tailwind's `dark:` variant; the tokens do
not depend on those classes.

## "Check before creating" discipline

Before writing a new visual primitive:

1. Grep `./shared-assets/weekend-design/` (or
   `node_modules/@weekend/design`) for the name and obvious synonyms
   (`Modal` → `Dialog`, `Dropdown` → `Combobox` or `Select`).
2. If a near-match exists with the wrong props, prefer composing it over
   forking. The package already covers more than its name suggests.
3. If nothing exists, ask: "wrap locally for this project, or report a
   design-system gap to Weekend?" Local wrappers are fine; silently
   re-implementing tokens / focus rings / motion is not — they will
   drift from the rest of the app.

## What NOT to do

- Don't `import` from `@fluid/*` — that scope was retired.
- Don't add a second component library (shadcn, MUI, etc.) alongside
  `@weekend/design` without the user asking.
- Don't edit anything under `./shared-assets/weekend-design/`. It is a
  read-only sync target. Edits get overwritten.
- Don't hand-roll dark mode with `prefers-color-scheme` overrides on top
  of the design system. Set `data-theme` instead.
- Don't redefine token names (`--color-bg`, `--radius-md`, etc.) in app
  CSS. Consume them.
