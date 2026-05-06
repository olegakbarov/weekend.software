# Audit: lib/springs (motion spring presets)

**Status**: major-drift (different framer-motion API generation)

**Upstream source**: `registry/default/lib/springs.ts` (commit `d850ecf`)
**Our source**: `packages/design/src/lib/springs.ts`

## API drift

Upstream and ours both export an object named `springs` with the same three
keys (`fast`, `moderate`, `slow`) — but the **shape of each value** is
fundamentally different.

### Upstream — framer-motion v12 duration/bounce API

```ts
export const springs = {
  fast:     { type: "spring" as const, duration: 0.08, bounce: 0    },
  moderate: { type: "spring" as const, duration: 0.16, bounce: 0.15 },
  slow:     { type: "spring" as const, duration: 0.24, bounce: 0.15 },
} as const;
```

Properties used: `type`, `duration` (seconds), `bounce` (0–1).

This is the framer-motion v12 "perceptual" spring API
(<https://motion.dev/docs/spring>): you specify the **target visual
duration** and the **bounciness**, and the engine derives the underlying
stiffness/damping/mass to land on that envelope. Designed to make spring
authoring feel like authoring a tween.

### Ours — legacy stiffness/damping/mass API

```ts
import type { Transition } from "framer-motion";

export const springs = {
  fast:     { type: "spring", stiffness: 600, damping: 40, mass: 0.5 },
  moderate: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
  slow:     { type: "spring", stiffness: 200, damping: 25, mass: 1   },
} as const satisfies Record<string, Transition>;

export type SpringName = keyof typeof springs;
```

Properties used: `type`, `stiffness`, `damping`, `mass`.

This is the **legacy spring API** (still supported by framer-motion v12 but
not the documented preferred path). The two APIs are **mutually exclusive**
when passed in the same transition object — framer-motion picks one based
on which keys are present.

### Type drift
- Upstream uses `as const` (no `Transition` import). Type widens to a
  literal-typed object.
- Ours uses `satisfies Record<string, Transition>` plus a re-export of
  the union type `SpringName`. Imports `Transition` from `framer-motion`.

### Mathematical (non-)equivalence
The two APIs are **not** mathematically equivalent presets:

| Preset | Upstream visual envelope | Ours derived envelope (approx) |
|---|---|---|
| `fast` | 80 ms, no bounce — perceptually a snap | stiffness 600 / damping 40 / mass 0.5 → ~135 ms settling time, slight under-shoot risk |
| `moderate` | 160 ms with 15% overshoot | stiffness 400 / damping 30 / mass 0.8 → ~250 ms settling, similar overshoot |
| `slow` | 240 ms with 15% overshoot | stiffness 200 / damping 25 / mass 1 → ~400 ms settling, more bounce |

Ours are **systematically slower and more bouncy** than upstream's named
presets. The CSS companion tokens
(`--spring-fast-ms: 80ms` / `--spring-moderate-ms: 160ms` /
`--spring-slow-ms: 240ms`) match upstream's `duration` numbers — a smoking
gun that the JS values were ported from an earlier, looser intent and the
CSS tokens were authored against the upstream-correct numbers. The two are
out of sync within our own package.

## Visual drift
Every component that animates with `springs.fast` / `.moderate` / `.slow`
will feel **slower and bouncier** than its upstream counterpart. The
strongest mismatches:

- Tabs underline / segmented backgrounds — `springs.moderate` is the
  classic "menu indicator" preset. Ours overshoots and settles ~90 ms
  later. Visible side-by-side.
- Tooltip enter/exit — `springs.fast`. Ours is ~55 ms slower; barely
  perceptible alone but enough to make Tooltip feel "heavier".
- Modal / Dialog enter/exit — `springs.slow`. Ours overshoots and settles
  later; the dialog "lands" with a soft bump rather than a clean stop.
- Switch thumb movement — `springs.moderate`. Will overshoot the track end.
- Accordion / mobile-drawer / select-menu open — same `springs.moderate`
  drift everywhere.

The CSS tokens (used for non-framer transitions: `--spring-fast-ms` etc.)
animate over the upstream-correct durations, which means the **CSS-driven
animations and the JS-driven animations no longer agree** within Weekend.
Hover backgrounds (CSS) settle in 80 ms while the active-tab indicator
(framer-motion) takes ~250 ms — that gap is precisely what makes a UI
feel laggy.

## Behavioral drift
- Type-checking surface: ours exports `SpringName` (extra). Components in
  upstream use `keyof typeof springs` inline; ours can pass `SpringName`
  through props.
- Runtime: anywhere both APIs are mixed in a single `transition` object,
  framer-motion silently picks one based on key presence — no warning. If
  a consumer ever spreads `...springs.moderate` and adds `duration: 0.5`
  to override, upstream behaves correctly (duration override wins) while
  ours produces a different preset (mass/stiffness ignored, only `type`
  + `duration` survive — implicit shape change).

## Severity
**high** — three reasons:

1. **Cross-cutting visible drift.** Every animated component looks/feels
   different from upstream. Wave 2B–F will repeatedly flag "slight bounce"
   or "settles too slow" and the cause is here, not in the component file.
2. **Self-inconsistency.** Our CSS tokens already match upstream's
   duration numbers; only the JS lags. So our own design system disagrees
   with itself — a CSS hover that finishes in 80 ms next to a JS
   transition that finishes in ~135 ms.
3. **Forward compatibility.** framer-motion v12+ documentation steers
   users toward `{ duration, bounce }`. Sticking with the legacy API is
   technical debt that grows as upstream evolves.

## Recommended fix
Replace the body of `src/lib/springs.ts` with the upstream object verbatim:

```ts
export const springs = {
  fast:     { type: "spring" as const, duration: 0.08, bounce: 0    },
  moderate: { type: "spring" as const, duration: 0.16, bounce: 0.15 },
  slow:     { type: "spring" as const, duration: 0.24, bounce: 0.15 },
} as const;

export type SpringName = keyof typeof springs;
```

(Drop the `Transition` import and the `satisfies` clause — the upstream
shape is what framer-motion v12 expects; the type checker will accept it
when passed to `transition={}` because v12's `Transition` union covers
both API shapes.)

A11y / `prefers-reduced-motion` is **not** handled by either implementation
— that's a separate concern owned by the consuming component.

After the fix, audit components individually: most will simply look right.
Components that bake in their own `transition={{ stiffness: ..., damping:
... }}` (rather than spreading `springs.foo`) need to be updated to use
the named presets so they pick up the corrected envelope.
