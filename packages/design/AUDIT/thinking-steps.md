# Audit: ThinkingSteps

**Status**: major-drift

**Upstream source**: `registry/default/thinking-steps.tsx` (commit `d850ecf`, 377 lines)
**Our source**: `packages/design/src/registry/thinking-steps.tsx` (190 lines)

## API drift

Missing exports:

- `ThinkingStepDetails` — nested accordion of step sub-details (summary +
  list of bullet `details: string[]` + children). Visible in upstream
  `app/docs/thinking-steps/page.tsx`. Not exported by us.
- `ThinkingStepImage` — animated image attachment with optional `caption`.
  Includes blur-in motion. Not exported by us.

Missing props on `ThinkingStep`:

- `icon?: IconName` (default `"dot"`) — selects an icon from the upstream
  icon-context registry (e.g. `dot`, `search`, `globe`, etc). We hard-code
  the dot indicator and have no icon plumbing.
- `showIcon?: boolean` (default `true`) — when `false`, falls through to a
  smaller dot. Missing.
- `index: number` — kept on type only? **Required** in upstream, **absent**
  in ours. (Upstream uses it for proximity hover ordering even though the
  current upstream code path doesn't actively register it — keep parity.)
- `delay?: number` — propagates a stagger delay into the source motion.
  Missing.

Missing props on `ThinkingStepSource`:

- `delay?: number` — drives the stagger of the badge appear animation
  (`opacity 0 → 1`, `scale 0.85 → 1`, `blur 4px → 0`, with `springs.moderate`).
  Without it consumers cannot stagger source pills. We just render a `<Badge>`.

Missing root behavior on `ThinkingSteps`:

- Upstream uses `<Accordion ref={ref} type="single" collapsible … >` directly
  (forwarding the ref to the Accordion root) and adds
  `[&>.absolute]:hidden` on the `AccordionItem` to hide the standalone
  accordion's expanded background. We instead wrap the Accordion in an outer
  `<div ref={ref}>` and **drop the `[&>.absolute]:hidden`** rule entirely.
  Result: in our rendering, the underlying Accordion's expanded-state
  background **is visible** — visual drift.

Missing classname tweak on `ThinkingStepsHeader`:

- Upstream: wraps trigger in `<div className="w-fit">` and uses
  `[&>span:first-child]:flex-none w-auto` on the trigger itself, so the
  header sits in a content-shrinking pill rather than a full-width row.
- Ours: drops the `<div>` wrapper AND uses `w-full` on the trigger — the
  thinking header expands to the full container width. Inverted layout.

## Visual drift

Missing per-step icon column:

- Upstream conditionally renders `<Icon size={14} strokeWidth={1.5} className="text-muted-foreground" />`
  (from icon context) when `showIcon`, otherwise a 6px dot. Ours always
  renders just the dot (loses the per-step iconography that the upstream
  /dev/ds page demonstrates).

Missing `shimmer-text` shimmer:

- Upstream label: `cn("text-[13px] leading-tight text-foreground", isActive && "shimmer-text")`.
- Ours drops the `shimmer-text` class. **And** the keyframes/utility class
  `shimmer-text` and `@keyframes shimmer` are absent from our `tokens.css`
  (confirmed in INVENTORY.md). So even if we re-added the class string,
  there's nothing to animate.
- Effect: an active step in upstream pulses with a gradient sweep on the
  label text. In ours, an active step is visually identical to a complete
  step except for the trailing ellipsis.

Missing source-pill animation:

- Upstream wraps each `<Badge>` in a `motion.span` that animates
  `{ opacity, scale, filter: blur(4px → 0) }` with `springs.moderate` and
  per-source `delay`. Ours renders a bare `<Badge>` with no motion.

Missing image attachment:

- Upstream `ThinkingStepImage` wraps an `<img>` in `motion.div` with
  `opacity 0 → 1` and `filter blur(4px → 0)`. Has `caption` slot. Missing.

Missing details sub-accordion:

- Upstream `ThinkingStepDetails` mounts a nested Accordion with
  `summary` + `details: string[]` + custom children. Renders details as
  `text-[12px] text-muted-foreground`. Missing.

Inherited drift:

- The outer step `motion.div` uses `springs.slow` for height. The inner
  fade uses a tween (`duration: 0.24, delay: 0.08`) — those two we mirror
  faithfully. The `springs.slow` definition itself drifts (see
  `_lib-springs.md`).
- Both files use `useShape()`. Inherits `_lib-shape-context.md` drift.

## Behavioral drift

- Without `icon` plumbing, `useIcon()` is never called, so consumers of the
  registry tier cannot retheme step iconography by swapping the icon
  library — but our package-wide story is "Lucide only" anyway, so this is
  the icon-context inheritance, not a fresh bug. Document via reference to
  `_lib-icon-and-icon-context.md`.
- Without the `[&>.absolute]:hidden` rule, the Accordion's selected/hover
  background bleeds through under each step. This is a visual bug that
  appears the moment the consumer wraps a `ThinkingStep` in this registry.
- `index` removal means upstream's proximity-hover ordering hook (whichever
  variant ships in the future) cannot key off step position.

## Severity

**high** — The component still works for the basic "expand/collapse with
list of completed steps" use case, but: (1) the missing `[&>.absolute]:hidden`
rule introduces a visible Accordion-bg artifact under every step;
(2) `shimmer-text` is the only signal an active step gives, and we don't
ship it; (3) two whole exports (`ThinkingStepDetails`, `ThinkingStepImage`)
are missing, blocking any consumer who wants the upstream demo's full UX;
(4) source pills no longer stagger-animate.

## Recommended fix

(1) Add `shimmer-text` keyframes to `tokens.css` (port the upstream block
verbatim); (2) restore `[&>.absolute]:hidden` on the inner `AccordionItem`
and switch the root to forward `ref` directly to `Accordion` (drop the
wrapper `<div>`); (3) restore the `<div className="w-fit">` wrapper and
`[&>span:first-child]:flex-none w-auto` classes on the header; (4) port
`ThinkingStepDetails` and `ThinkingStepImage` and add `icon`/`showIcon`/
`index`/`delay` props on `ThinkingStep`; (5) re-add the `motion.span`
wrapper with stagger `delay` on `ThinkingStepSource`. Once `_lib-icon-and-icon-context.md`
gets resolved, re-thread `useIcon` through `ThinkingStep`'s icon prop.
