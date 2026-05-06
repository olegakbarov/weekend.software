# Audit: tokens (CSS custom properties)

**Status**: major-drift (intentional Weekend additions on top of an upstream-compatible base)

**Upstream source**: `app/globals.css` (commit `d850ecf`)
**Our source**: `packages/design/src/tokens.css`

## API drift

### Surfaces / interactive / borders / destructive
All of upstream's surface tokens exist in ours with **identical values** in the
fluid theme block:

| Token | Upstream `:root` | Ours `:root[data-theme="fluid"]` | Match |
|---|---|---|---|
| `--background` | `#FAFAFA` | `#fafafa` | yes (case) |
| `--foreground` | `#171717` | `#171717` | yes |
| `--card` / `--card-foreground` | `#FFFFFF` / `#171717` | `#ffffff` / `#171717` | yes |
| `--muted` / `--muted-foreground` | `#F5F5F5` / `#737373` | `#f5f5f5` / `#737373` | yes |
| `--accent` / `--accent-foreground` | `#E5E5E5` / `#171717` | `#e5e5e5` / `#171717` | yes |
| `--selected` | `#D4D4D4` | `#d4d4d4` | yes |
| `--border` / `--ring` / `--input` | `#E5E5E5` | `#e5e5e5` | yes |
| `--destructive` / `--destructive-light` | `#EF4444` / `#FEF2F2` | `#ef4444` / `#fef2f2` | yes |
| `--hover` / `--active` | `color-mix` recipe | identical recipe | yes |

Dark theme parity (upstream `.dark`/media-query block vs our
`:root[data-theme="fluid-dark"]`):

| Token | Upstream `.dark` | Ours fluid-dark | Match |
|---|---|---|---|
| `--background` | `#171717` | `#0a0a0a` | **drift** (we picked `neutral-950`) |
| `--card` | `#262626` | `#171717` | **drift** (one shade darker) |
| `--muted` | `#262626` | `#1f1f1f` | **drift** (slightly different) |
| `--accent` | `#525252` | `#2a2a2a` | **drift** (much darker) |
| `--selected` | `#525252` | `#525252` | yes |
| `--border` / `--input` | `#404040` | `#2a2a2a` | **drift** |
| `--ring` | `#404040` | `#404040` | yes |
| `--destructive` | `#F87171` | `#f87171` | yes |
| `--destructive-light` | `#450A0A` | `#450a0a` | yes |
| `--muted-foreground` | `#A3A3A3` | `#a3a3a3` | yes |

The fluid-dark theme has materially darker surfaces than the upstream `.dark`
block. This is a deliberate Weekend choice (see `data-theme` indirection in
the file's documentation) but it does mean our fluid-dark **does not match**
upstream's dark out of the box — even when a consumer asks for the "fluid"
identity.

### Neutral ramp
Upstream ships `--neutral-100` through `--neutral-900`. We additionally ship
`--neutral-50` (`#fafafa`) and `--neutral-950` (`#0a0a0a`) — extras, not
drift. Values match upstream exactly for `100..900`.

### Tokens upstream has, we lack
- `--checker-a` / `--checker-b` (light: `#bbbbbb`/`#ffffff`; dark:
  `#1f1f1f`/`#2a2a2a`). Used by upstream `color-picker.tsx` to render the
  alpha-channel checkerboard. Wave 2B should verify our ColorPicker still
  renders correctly without these.
- `html.transitioning *` rule (180 ms transition on `border-radius`,
  `background-color`, `color`, `border-color`, `fill`, `stroke`). Documented
  separately in `_html-transitioning.md`.
- `@keyframes spinner-move` / `@keyframes spinner-dash` — upstream Button
  loading state spinner. Not in our `tokens.css`. Wave 2B (Button) needs to
  confirm whether our button.css ships an equivalent or imports these
  separately.
- `@keyframes shimmer` + `.shimmer-text` — used by upstream
  `thinking-indicator.tsx`, which we don't ship. If we ever add it, port
  these.
- `.bento-card-border`, `.shiki .*`, `.scrollbar-hide`, bento-grid media
  queries — all demo-site only; correctly omitted.

### Tokens we add (Weekend extras, not in upstream)

| Category | Tokens | Why |
|---|---|---|
| Focus | `--focus-ring` | Weekend brand focus colour (`#6b97ff` fluid, `#00be83` weekend-dark, `#e84b8a` weekend-paper). Upstream uses `--ring` for the same job; we split them so focus stays themable independently of border tone. |
| Status | `--success`, `--success-foreground`, `--destructive-foreground` | Upstream has no success token at all. We need it for save buttons / confirmations. `--destructive-foreground` is set so destructive buttons can paint readable text. |
| Secondary | `--secondary`, `--secondary-foreground` | **Tension with upstream policy** — upstream forbids `bg-secondary` outside `/compare` (eslint-enforced). We use it heavily. Wave 2B–F should treat anywhere we use `secondary` as a fidelity question: upstream component would use `--muted` or `--accent` instead. |
| Type scale | `--text-xxs`/`xs`/`sm`/`md`/`lg`/`h1`/`h2`/`h3` | Upstream relies on Tailwind's defaults; we tokenise so the weekend themes can shift the entire scale `+2px`. |
| Radii | `--radius-sm/md/lg/xl/2xl/3xl/pill` | Upstream uses Tailwind's `rounded-*` directly. |
| Shape | `--radius-control`, `--radius-container`, with `[data-shape="pill"\|"rounded"]` overrides | Upstream achieves the same outcome via JS `lib/shape-context.tsx` swapping class strings. Two different mechanisms — see `_lib-shape-context.md`. |
| Spacing | `--space-0_5`..`--space-12` | Tokenised Tailwind 4-pt scale. Upstream uses Tailwind utilities directly. |
| Shadow | `--shadow-card`, `--shadow-card-hover`, `--shadow-popover`, `--shadow-modal` | Upstream sets shadows inline (e.g. in `.bento-card-border`). We tokenise so weekend-dark / weekend-paper can override. |
| Motion | `--spring-fast-ms`, `--spring-moderate-ms`, `--spring-slow-ms`, `--ease-out-ui` | CSS-side companions to `lib/springs.ts`. Upstream has neither (springs are JS-only). |
| Font slots | `--font-ui`, `--font-mono-ui`, `--font-display`, `--font-mono` | Allow weekend-dark/paper to inject Berkeley Mono + VCR OSD Mono. Upstream uses `--font-sans` only. |
| FW axes | `--fw-normal`/`medium`/`semibold`/`bold` (e.g. `"wght" 400`) | CSS mirror of `lib/font-weight.ts`. Upstream is JS-only. |
| Accent palette | `--color-gray`/`red`/`orange`/`amber`/`yellow`/`lime`/`green`/`emerald`/`teal`/`cyan`/`blue`/`indigo`/`violet`/`purple`/`fuchsia`/`pink`/`rose` (Tailwind 500s) | Used by ColorPicker / project accent picker. Not in upstream. |
| Weekend | `--card-red` (only inside `.dark`) | Single weekend-leak token; consider scoping to a `weekend-*` namespace. |

### Theme strategy: fundamentally different
- **Upstream**: light is `:root`, dark is `prefers-color-scheme: dark` _and_
  `.dark` class. There is **one** light and **one** dark.
- **Ours**: a `:root` base block (matches upstream light), a `.dark` block
  (drift from upstream — see table above), and four named themes via
  `:root[data-theme="fluid"|"fluid-dark"|"weekend-dark"|"weekend-paper"]`.
  The `data-theme` set is the canonical switch — `.dark` is kept for
  legacy cascade compatibility but the desktop's `ThemeProvider` writes
  `data-theme` only.

### Inter @font-face block

| Aspect | Upstream | Ours |
|---|---|---|
| `src url()` | `/fonts/InterVariable.ttf` | `./fonts/InterVariable.ttf` |
| `format()` | `"truetype"` | `"truetype-variations"` |
| `font-weight` range | `100 900` | `100 900` |
| `font-style` declaration | (absent) | `normal` |
| `font-display` | `swap` | `swap` |

`format("truetype-variations")` is the more precise hint for variable fonts;
`"truetype"` works in modern browsers because the variable axes are still
exposed. Functionally equivalent. The path differs because upstream is a
Next.js app loading from `public/`, while we bundle the TTF inside the
package and reference relatively.

### `@theme inline` block
Upstream wraps custom-property → Tailwind-utility mappings inside an
`@theme inline { ... }` block (Tailwind v4 idiom). We **don't** declare a
`@theme` block in `tokens.css`; consumers wire Tailwind themselves via
`@source` against our `src/`. Wave 2B should verify that consuming apps
pick up the necessary `--color-*` aliases (e.g. so `bg-card` resolves) —
likely the desktop app's own `globals.css` declares them.

### Reserved-only tokens (`--primary`, `--secondary`, `--popover`, etc.)
Upstream's `@theme inline` maps `--color-primary`, `--color-popover`, etc.
to vars that are **only defined in `.shadcn-theme`** (`/compare` route).
Outside `/compare` they're undefined; the eslint rule forbids using
`bg-primary`/`bg-popover` utilities in design components.

We define `--secondary` everywhere. Wave 2B–F should grep for
`bg-secondary`/`text-secondary-foreground` in our components and decide
whether each call site should switch to `bg-muted`/`bg-accent` for
upstream parity.

## Visual drift
- Light theme: pixel-identical for the in-scope tokens.
- Dark theme: surfaces sit lower (darker) in our fluid-dark vs upstream
  `.dark`. Cards/borders 2 shades darker. Likely visible if you A/B against
  upstream's `/docs` page in dark mode.
- ColorPicker checkerboard: visually broken in any consumer that relies on
  `--checker-a/b` (we never set them).

## Behavioral drift
- Theme switching: upstream uses `prefers-color-scheme` + `.dark` toggle;
  ours uses `[data-theme]` (set by the desktop's `ThemeProvider`). The
  package itself is theme-mechanism agnostic — both `prefers-color-scheme`
  and `.dark` still cascade correctly thanks to keeping the upstream
  `:root`/`.dark` blocks at the top of the file.
- `html.transitioning` block missing → token swaps will **flash** instead of
  ease (covered in `_html-transitioning.md`).
- Spinner keyframes (`spinner-move`, `spinner-dash`) and `.shimmer-text`
  not in tokens.css — Wave 2B (Button loading state) must confirm where
  these now live, if anywhere.

## Severity
**high** — multiple components depend on tokens that aren't there
(`--checker-a/b`, the spinner keyframes, the `html.transitioning` rule).
Dark-theme parity drift is also wider than expected. The intentional
Weekend additions (focus, success, type scale, radii, motion) are not
fidelity issues.

## Recommended fix
1. Port `--checker-a/b` (both modes), `@keyframes spinner-move`,
   `@keyframes spinner-dash`, `.shimmer-text` + `@keyframes shimmer`, and
   the `html.transitioning *` rule into `tokens.css`. These are
   component-coupled CSS — leaving them out is a fidelity gap.
2. Decide whether fluid-dark should match upstream `.dark` (lift surfaces by
   2 shades) or stay Weekend-flavoured. If "match upstream", change
   `--background` → `#171717`, `--card` → `#262626`, `--muted` → `#262626`,
   `--accent` → `#525252`, `--border`/`--input` → `#404040` in the
   `:root[data-theme="fluid-dark"]` block. If "stay Weekend-flavoured",
   document the choice in the file header.
3. Audit `bg-secondary` usage in our components (separate Wave 2B–F task) —
   either keep it and document the upstream-policy departure, or migrate
   to `bg-muted`/`bg-accent` to match upstream eslint policy.
