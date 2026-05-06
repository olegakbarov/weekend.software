# Audit: Textarea

**Status**: not-in-upstream

**Upstream source**: _none_. There is no `textarea.tsx` in `registry/default/`, no demo in `app/docs/textarea/`, and no entry in `registry.json`. CLAUDE.md confirms: _"design has no Textarea — could be added if a second consumer appears"_.
**Our source**: `packages/design/src/components/textarea.tsx` (+ `textarea.css`)

> No upstream parity expected. The audit below is a self-consistency check — does our Textarea follow the conventions established by the rest of the design system?

## API drift

N/A — no upstream baseline. Surface:

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `"default" \| "ghost"` | `"default"` | matches Button's `ghost` convention (transparent bg, no border) |
| All `<textarea>` HTML attrs | via `ComponentPropsWithoutRef<"textarea">` | — | spread; ✓ |

The `ghost` variant convention is good — it mirrors `Button`'s `ghost` (transparent, no border) and matches Weekend's documented pattern in CLAUDE.md ("if you can imagine an agent-created project app wanting this pattern, absorb it"). If Textarea grows a second variant, naming it consistently with the existing variant taxonomy (`default | ghost`, future `error`, `success`?) preserves the pattern.

Defaults pre-applied: `autoCapitalize="off"`, `autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}`. These are sensible for code/agent-prompt textareas (the primary Weekend use case) but **wrong for prose-input textareas** (e.g. comment fields, description fields). Consumers can override since they're spread before `{...props}`. Worth documenting.

## Visual drift

Self-consistency vs. other Weekend form controls:

- **Min-height**: `80px` — reasonable.
- **Padding**: `var(--space-2) var(--space-3)` (8px / 12px). Vertical 8px is tighter than `.btn` / `.ds-select-trigger` (which are 32px tall with no explicit vertical padding because the height is fixed). For a multi-line input, 8px top/bottom is fine.
- **Border-radius**: `var(--radius-md)`. **Drift from other form controls** which use `var(--radius-control)` (`.btn`, `.ds-select-trigger`, `.ds-number-stepper`). At default tokens these are likely close (both ~8px) but they're different tokens — if a theme overrides one, they diverge. Should probably be `var(--radius-control)` for family consistency.
- **Border + bg**: `1px solid var(--border)` + `background: transparent`. ✓ matches `.ds-select-trigger` _border-style_, but `.ds-select-trigger` uses `var(--card)` for bg. Drift — Textarea is transparent, Select trigger is `var(--card)`. Consider unifying.
- **Font**: `font: inherit` + `font-size: var(--text-sm)` + `line-height: 1.5`. ✓ — same as the rest of the family.
- **Resize**: `resize: none`. Common Weekend choice (consumers often auto-grow externally); upstream form-input convention would also be `resize: none` since manual resize handles look bad in design systems.
- **`overflow-wrap: anywhere; word-break: break-word`**: aggressive wrap rules — good for code/long URLs, may look ugly for prose. Worth a callout.
- **Focus state**: `border-color: var(--focus-ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--focus-ring), transparent 80%)`. ✓ **matches `.ds-select-trigger` focus** exactly. Good consistency. Note: differs from `.btn` and `.btn-icon` which use the double-box-shadow style (`0 0 0 2px var(--background), 0 0 0 3px var(--focus-ring)`). Two focus styles in the system isn't ideal — pick one. The select-trigger / textarea style is more apt for inputs (colored border + soft halo); the button style is more apt for tappable solid surfaces. Acceptable inconsistency, but document.
- **Disabled**: `opacity: 0.5; cursor: not-allowed`. ✓.
- **Placeholder**: `color: var(--muted-foreground); opacity: 0.5`. Halving an already-muted color — visible but light. Match the `--muted-foreground` directly without the opacity? Worth eyeballing.
- **`@layer components`** wrapper: ours is the only file in `src/components/*.css` using `@layer components`. The others (`.btn`, `.ds-select-*`, etc.) write rules unlayered. If any Tailwind cascade happens, this could matter — comment in source explains the rationale (`* { border-color: var(--color-border) }` interferes). Document the pattern.

## Ghost variant

- `border: 0; background: transparent; padding: 0;` — minimal, no focus ring. Used for borderless prompts (the home page agent textarea before its recent ghost-double-border fix; cf. recent commit `7d095ab`).
- The inline source comment explains why `border: 0` (vs. `border-color: transparent`) is required: Weekend's global `* { border-color: var(--color-border) }` is unlayered and outranks layered rules. Good engineering note. **Same trick should be inherited if Textarea ever gets variants like `error`** — they'd need `border: 1px solid var(--destructive)` (full shorthand) inside `@layer components`, not just `border-color: var(--destructive)`.

## Behavioral drift

- **A11y**: just a `<textarea>`. The pre-applied `spellCheck={false}` is a usability decision — fine for code, suboptimal for written content. Document.
- **No auto-grow**: textareas don't grow with content. Weekend already has callsites that wrap Textarea with their own auto-grow logic (the home page agent textarea per recent commit `a9f4d22`). Worth either adding a built-in `autoGrow?: boolean` prop or leaving it explicitly to consumers and noting in the JSDoc.
- **No spring/icon dependencies** — pure CSS, no framer-motion. Doesn't inherit from `_lib-springs.md` or `_lib-icon-and-icon-context.md`.
- **No `useShape`** — radii are hard-coded to `var(--radius-md)` rather than reading from the shape context. If shape morphing matters for textareas, this is an inconsistency.

## Severity
**low** — works, follows conventions reasonably, has a documented rationale for the `@layer components` quirk. The two consequential nits are the `--radius-md` (vs. `--radius-control`) drift and the missing `useShape` integration.

## Recommended fix

1. **Switch `border-radius: var(--radius-md)` → `var(--radius-control)`** so Textarea, Button, Select, NumberStepper all share the same radius token. One-line CSS change.
2. **Read shape from `useShape()`** if the design system commits to shape-context-driven radii (see `_lib-shape-context.md`). Today our shape context is read-only via `[data-shape]` on `<html>` so the CSS variable approach already works — the JS-side `useShape()` integration is mostly a nice-to-have for parity.
3. **Document the autocomplete-disabled defaults** in the JSDoc — call out that consumers building prose inputs should override them.
4. **Consider absorbing into upstream** — CLAUDE.md explicitly notes Textarea is a candidate for absorption "if a second consumer appears." With Weekend's home page + project file editor + agent prompts, there are already several consumers. Time to formalize as part of `@weekend/design` and document the variant taxonomy (`default | ghost`, future `error`).
5. **Future-proof the variant pattern**: when `error` / `success` variants are needed, follow the `border: 1px solid <color>` (full shorthand) trick from `ghost` to defeat the global `* { border-color }` rule.
