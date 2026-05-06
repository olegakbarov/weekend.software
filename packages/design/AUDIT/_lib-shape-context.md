# Audit: lib/shape-context (control-shape switcher)

**Status**: major-drift (different mechanism: React Context vs DOM-attribute store)

**Upstream source**: `registry/default/lib/shape-context.tsx` (commit `d850ecf`)
**Our source**: `packages/design/src/lib/shape-context.ts`

## API drift

### Upstream surface
A `.tsx` file (returns JSX) exporting:
- `ShapeProvider` — React Context provider; takes `defaultShape: "pill" | "rounded"` (default `"pill"`); manages internal `useState<ShapeVariant>`; installs a global keydown handler for the **`R`** key to cycle shapes (skips inputs/textareas/contentEditable + meta/ctrl/alt modifiers); calls `transitionShape(...)` to wrap each switch.
- `useShape(): ShapeClasses` — reads context. Falls back to `shapeMap.pill` if no provider mounted.
- `useShapeContext(): { shape, setShape, classes }` — full context access. Throws if no provider.
- `transitionShape(callback)` — adds `transitioning` class to `<html>`, force-reflows (`offsetHeight` read), runs callback, removes class after **200 ms**. Pairs with the `html.transitioning *` CSS rule in upstream `globals.css` (180 ms transition).
- `shapeMap` — exported for direct consumption.
- Types: `ShapeVariant`, `ShapeClasses`.

`ShapeClasses` shape (upstream):
```ts
{
  item: string;
  bg: string;
  focusRing: string;
  mergedBg: string;        // ← we DON'T have this
  container: string;
  button: string;          // ← we DON'T have this
  input: string;
}
```

`shapeMap` values (upstream):
```ts
pill: {
  item: "rounded-[20px]", bg: "rounded-[20px]", focusRing: "rounded-[20px]",
  mergedBg: "rounded-2xl", container: "rounded-3xl",
  button: "rounded-[20px]", input: "rounded-[20px]",
},
rounded: {
  item: "rounded-lg", bg: "rounded-lg", focusRing: "rounded-[10px]",
  mergedBg: "rounded-lg", container: "rounded-xl",
  button: "rounded-lg", input: "rounded-lg",
},
```

### Our surface
A `.ts` file (no JSX, no provider) exporting:
- `useShape(): ShapeClasses` — `useSyncExternalStore` reading `document.documentElement.dataset.shape`. SSR-safe (`getServerSnapshot` returns `"pill"`). Subscribes to a `MutationObserver` on `<html>`'s `data-shape` attribute.
- Types: `ShapeMode`, `ShapeClasses`.

No provider. No `R` shortcut. No `transitionShape` helper. No exported `shapeMap`. No `useShapeContext`.

`ShapeClasses` shape (ours):
```ts
{
  input: string;
  item: string;
  container: string;
  bg: string;
  focusRing: string;
}
```

Class strings (ours):
```ts
PILL = {
  input: "rounded-2xl",     // upstream "rounded-[20px]"
  item: "rounded-2xl",       // upstream "rounded-[20px]"
  container: "rounded-3xl",  // matches
  bg: "rounded-2xl",         // upstream "rounded-[20px]"
  focusRing: "rounded-2xl",  // upstream "rounded-[20px]"
}
ROUNDED = {
  input: "rounded-lg",       // matches
  item: "rounded-lg",        // matches
  container: "rounded-xl",   // matches
  bg: "rounded-lg",          // matches
  focusRing: "rounded-md",   // upstream "rounded-[10px]"
}
```

### API drift summary

| Aspect | Upstream | Ours |
|---|---|---|
| File extension | `.tsx` | `.ts` |
| Mechanism | React Context provider | DOM attribute + `useSyncExternalStore` |
| State source | React `useState` inside provider | `<html data-shape>` attribute |
| `ShapeProvider` | exported | **MISSING** |
| `useShape()` | reads context | reads `<html>` attribute |
| `useShapeContext()` | exported (mutator + state) | **MISSING** |
| `transitionShape()` helper | exported | **MISSING** |
| `shapeMap` exported | yes | no |
| `R` keyboard shortcut | yes | **MISSING** |
| `mergedBg`, `button` keys | present | **MISSING** |
| `pill.input/item/bg/focusRing` class | `rounded-[20px]` | `rounded-2xl` (`16px`) |
| `pill.container` class | `rounded-3xl` (`24px`) | matches |
| `rounded.focusRing` class | `rounded-[10px]` | `rounded-md` (`6px`) |
| Mutates `html.transitioning` | yes | no |

## Visual drift
- **`pill` shape is 4 px less round in ours** (16 px vs 20 px). Visible on Buttons, Selects, Tabs indicators, and any focus ring. Upstream's `rounded-[20px]` is the design's "signature" pill curve; we're using Tailwind's `rounded-2xl` (16 px) instead.
- **`rounded` focus ring is 4 px less round** (6 px vs 10 px). Focus halos on inputs in `rounded` mode will look tighter than upstream.
- **Container radii match** in both modes.
- Components consuming `mergedBg` or `button` from upstream will not type-check against ours (those keys don't exist) — and any switch from `--radius-control` token to a class string will produce different curves.
- No `html.transitioning` class is added on switch → in our system, **shape changes flash** rather than ease (covered in `_html-transitioning.md`).

## Behavioral drift
- **No `R` keyboard shortcut.** Demo / docs / power-user shape cycling does not work. The desktop's `/dev/ds` route would need to wire its own toggler.
- **No imperative API.** Upstream consumers can call `setShape("rounded")` from a settings panel via `useShapeContext()`. Ours offers no setter — consumers must write `document.documentElement.dataset.shape = "rounded"` themselves.
- **DOM-attribute mechanism is more robust across iframes / multiple webviews.** This is the deliberate trade-off Weekend made: in a Tauri app with multiple webviews each rendering its own React tree, a shared `<html data-shape>` is single-source-of-truth across windows. A React Context only spans one tree.
- **Mutation-observer cost.** `useSyncExternalStore` + `MutationObserver` runs an attribute-filtered observer per consumer. Cheap but non-zero.
- **SSR**: ours is SSR-safe (`getServerSnapshot` returns `"pill"`); upstream's provider is `"use client"` and would `useState` to default during hydration. Both deliver a stable initial render.

## Severity
**medium** — high enough that components built upstream-style (referencing `mergedBg` or `button` keys, or wrapping in `<ShapeProvider>`) won't drop in clean; low enough that the day-to-day UX in our apps is nearly identical (the 4 px curvature delta is the only visible thing, and the shape never changes after page load in production).

The DOM-attribute mechanism is **defensibly Weekend's choice** for cross-webview consistency — that part should stay. The class-string drift is a fidelity bug we should fix.

## Recommended fix

### Required (fidelity)
1. Bring our `shapeMap` class strings into pixel-parity with upstream:
   - `PILL.input / item / bg / focusRing` → `"rounded-[20px]"`
   - `ROUNDED.focusRing` → `"rounded-[10px]"`
2. Add the missing keys to `ShapeClasses` and both `PILL` / `ROUNDED` blocks:
   - `mergedBg`: `"rounded-2xl"` (pill) / `"rounded-lg"` (rounded)
   - `button`: `"rounded-[20px]"` (pill) / `"rounded-lg"` (rounded)
3. Hook the DOM-attribute mutator into `html.transitioning` — when a consumer writes `dataset.shape = "rounded"`, our package should add `html.transitioning` for 180–200 ms. This requires a small public helper:
   ```ts
   export function setShape(next: ShapeMode) {
     document.documentElement.classList.add("transitioning");
     void document.documentElement.offsetHeight;
     document.documentElement.dataset.shape = next;
     setTimeout(() => document.documentElement.classList.remove("transitioning"), 200);
   }
   ```
   ...and ship the `html.transitioning` block in `tokens.css` (see `_html-transitioning.md`).

### Recommended (developer affordance)
4. Optionally export an `R`-keyboard handler as a hook — `useShapeShortcut()` — that consumers can opt into without forcing the global behaviour into the package. Keeps the demo experience available without imposing it on every consumer.
5. Keep the DOM-attribute mechanism as canonical. Document the deliberate divergence from upstream's Context-based approach in the file header (cross-webview rationale).
