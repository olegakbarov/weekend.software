# Audit: `html.transitioning` global CSS rule

**Status**: not-in-ours (rule absent)

**Upstream source**: `app/globals.css` lines 145–154 (commit `d850ecf`)
**Our source**: `packages/design/src/tokens.css` (no equivalent block)

## Upstream rule (verbatim)

```css
html.transitioning *,
html.transitioning *::before,
html.transitioning *::after {
  transition: border-radius 180ms ease-in-out,
              background-color 180ms ease-in-out,
              color 180ms ease-in-out,
              border-color 180ms ease-in-out,
              fill 180ms ease-in-out,
              stroke 180ms ease-in-out !important;
}
```

## API drift
None — this is a global CSS class, not a JS export. Surface is "is the
class present in your stylesheet, yes or no". Upstream: yes. Ours: no.

## Visual drift
The rule is **paired** with two upstream JS APIs:

1. `lib/shape-context.tsx` calls `transitionShape(...)`, which adds
   `html.transitioning`, force-reflows, runs the state mutation, and
   removes the class after **200 ms**. The mutation flips `[data-shape]`
   on the `:root` (or, in the upstream context-driven design, swaps the
   class strings inside React state).
2. The same `html.transitioning` class is intended to wrap any
   `data-theme` swap so the colour-token cascade animates rather than
   flashes.

Without the rule, when our desktop's `ThemeProvider` writes
`document.documentElement.dataset.theme = "weekend-dark"` (or any of the
four themes), every styled element snaps from light values to dark values
**in the same paint frame**. Side-by-side against an upstream theme switch:

| Token category | Upstream | Ours |
|---|---|---|
| `background-color` | 180 ms ease-in-out | instant snap |
| `color` | 180 ms ease-in-out | instant snap |
| `border-color` | 180 ms ease-in-out | instant snap |
| `border-radius` (shape switch) | 180 ms ease-in-out | instant snap |
| `fill` / `stroke` (icons) | 180 ms ease-in-out | instant snap |

This is most noticeable on **theme cycle in `/dev/ds`** (the topbar theme
cycler is the biggest in-app trigger) and on **shape switch** (`R` key in
upstream; if Weekend ever exposes a setShape API, the same gap applies).

## Behavioral drift
- The rule is `!important` everywhere — so it **wins** over any
  component-level `transition: none` declared on, say, an icon. Upstream's
  decision: theme/shape transitions are global animations, not per-component
  opt-ins.
- The 180 ms duration is shorter than the wrapper class's 200 ms removal
  timeout — gives the transition a 20 ms safety buffer to finish before
  the class is removed and elements snap to their final state.
- The rule targets `*`, `*::before`, `*::after` — pseudo-elements (focus
  ring rendered via `::before`, etc.) animate alongside the host element.
- No filter on `transform` / `opacity` / `box-shadow` → those properties
  remain instantaneous during a theme swap, which is what you want
  (`transform` mid-flight would feel like the UI is sliding while
  re-colouring).

## Severity
**low** — for two reasons:

1. The visible cost is only at the moment of theme/shape switch, which is
   rare in normal use. Day-to-day app interactions are unaffected.
2. The CSS itself is small (10 lines), with **no** runtime cost when the
   class isn't present (selectors only match when `html.transitioning` is
   set).

The reason it isn't "trivial":
- It must be paired with whoever toggles the class. Today nothing in our
  package adds the class. The desktop's `ThemeProvider` (in the app,
  not the package) would need updating, and any future shape API would
  need to add it.
- Once added, it interacts with **every** themable element — agents
  building inside Weekend projects will inherit it. We need to be sure
  no consumer relies on instantaneous colour transitions.

## Recommended fix

### Step 1 — port the rule into `tokens.css`
Add at the bottom of `packages/design/src/tokens.css`:

```css
/* =====================================================================
   Theme / shape transition envelope.
   Active only while <html class="transitioning"> is set. Pair with
   ThemeProvider / setShape() — they should add the class, swap
   data-theme / data-shape, and remove the class after 200ms.
   ===================================================================== */
html.transitioning *,
html.transitioning *::before,
html.transitioning *::after {
  transition:
    border-radius     180ms ease-in-out,
    background-color  180ms ease-in-out,
    color             180ms ease-in-out,
    border-color      180ms ease-in-out,
    fill              180ms ease-in-out,
    stroke            180ms ease-in-out
    !important;
}
```

### Step 2 — wire the desktop's `ThemeProvider` to use it
In `src/components/theme/theme-provider.tsx`, wrap the
`document.documentElement.dataset.theme = ...` assignment in a small
helper that adds/removes the class:

```ts
function transitionTheme(next: string) {
  const html = document.documentElement;
  html.classList.add("transitioning");
  void html.offsetHeight;          // force reflow
  html.dataset.theme = next;
  setTimeout(() => html.classList.remove("transitioning"), 200);
}
```

(This is the same pattern as upstream's `transitionShape`.)

### Step 3 — expose a small helper from `@weekend/design`
Add to `packages/design/src/lib/shape-context.ts` (or a new
`lib/transition.ts`) so future consumers — including agent-built apps
inside Weekend projects — can call the same helper without re-implementing
the timing. See `_lib-shape-context.md` for the recommended `setShape`
helper that already wraps this.

This makes the design system the canonical owner of the
"swap-with-easing" pattern and brings us into parity with upstream.
