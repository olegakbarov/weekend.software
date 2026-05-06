# Missing: ThinkingIndicator

> Note: distinct from `ThinkingSteps`, which we DO ship (`src/registry/thinking-steps.tsx`).
> ThinkingSteps is a collapsible accordion of step rows with badges and sources;
> ThinkingIndicator is a single inline animated label.

## Upstream has it
- `registry/default/thinking-indicator.tsx` (commit `d850ecf`) — single forwardRef component
- Listed in upstream `registry.json`
- Demo at `app/docs/thinking-indicator/page.tsx`
- Depends on the `.shimmer-text` class + `@keyframes shimmer` block in upstream `app/globals.css`

## What it does

A small **inline "AI is working" affordance** — an animated 24x24 SVG glyph that morphs between three shapes (circle → infinity → circle, with infinity as the in-between) on a 6-second loop, paired with a shimmer-animated text label that cycles through `["Thinking", "Moonwalking", "Planning", "Refining"]` every 4 seconds.

### Visual mechanics

- **SVG morph**: a single `<motion.path>` whose `d` attribute is animated through 5 keyframes `[circleA, infinity, circleB, infinity, circleA]` over 6 seconds with `easeInOut` and `repeat: Infinity`. The transition is on `d` specifically so the path interpolates smoothly.
- **Word swap**: `AnimatePresence mode="popLayout"` enter/exit. New word slides up from `y: 80%, opacity: 0` to `y: 0, opacity: 1` over 240ms with cubic-bezier `[0.4, 0, 0.2, 1]`; old word slides up to `y: -80%, opacity: 0` over 160ms with the same easing.
- **Width stability**: an invisible reference span pre-allocates the width of the longest word in the list (`words.reduce((a, b) => a.length >= b.length ? a : b)`) so the text-row width doesn't jitter as words swap.
- **Shimmer**: both the visible word span and the invisible reference get the `shimmer-text` class, which in upstream `globals.css` defines a left-to-right shimmer gradient via `@keyframes shimmer` masked over the text. Without that keyframe block in our `tokens.css`, the text would render flat.

### Public API

```tsx
<ThinkingIndicator className?={string} {...HTMLAttributes<HTMLDivElement>} />
```

- No props beyond standard div attributes — the word list and animation timing are hardcoded inside the component.
- `role="status"` on the container for screen readers.

## Our gap

- Not exported from `@weekend/design` or `@weekend/design/registry`.
- The `.shimmer-text` class and `@keyframes shimmer` block are NOT in our `tokens.css` — so even if a consumer pasted the upstream component verbatim, the shimmer would silently fail (text would render but without the moving gradient).
- We have `ThinkingSteps` which is a different and much heavier component (collapsible accordion of multiple steps with sources) — it doesn't substitute for the inline animated indicator.

## Severity

**low** for current Weekend needs — no current consumer in the desktop app reaches for an "AI is thinking..." affordance, and the pre-existing inline status text we use is sufficient.

**low-medium** strategically — useful for chat/agent UIs in agent-built project apps. As we add more agent-driven affordances to the desktop (Wave 2A noted the editor has streaming response surfaces), this would replace ad-hoc spinners.

## Recommendation

1. **Defer absorption** until a Weekend or downstream chat/agent UI explicitly wants the cycling-words idiom. A simpler spinner is fine for shorter "loading…" states.
2. When absorbing:
   - Port the file as-is (no drift expected — it's small and self-contained, no shape/proximity-hover/spring deps).
   - Port the `.shimmer-text` class + `@keyframes shimmer` block from upstream `app/globals.css` into our `tokens.css`. Per CLAUDE.md token rules, add it to all four theme blocks (or to the top-level `:root` if the gradient colors should be theme-agnostic — likely they reference `--foreground` or similar, so they may auto-adapt without per-theme overrides).
   - Consider exposing `words` as a prop (`words?: ReadonlyArray<string>`) so consumers can pass project-specific labels — upstream hardcodes them, but a prop is a cheap addition that doesn't break upstream parity.
3. Update INVENTORY.md to mark this as "absorbed" once shipped.
4. Add docs page at `src/dev/docs/views/pages/thinking-indicator.tsx`.
