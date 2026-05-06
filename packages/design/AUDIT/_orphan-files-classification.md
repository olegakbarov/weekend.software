# Orphan files in `packages/design/src/components/` — classification

## TL;DR

**Wave 1's INVENTORY.md was wrong about the orphan files.** The list of "stale/orphan candidates" at INVENTORY.md L147–166 names ~18 files that **do not exist in this repo**. The current `src/components/` folder contains exactly 9 source files (button, number-stepper, seg, select, slider, switch, textarea — plus their `.css` and `.test.tsx` siblings), all of which are re-exported from `src/index.ts`. There are no orphans.

## Current ground truth

`git ls-files packages/design/src/components/` returns exactly:

```
button.css
button.test.tsx
button.tsx
number-stepper.css
number-stepper.tsx
seg.css
seg.tsx
select.css
select.test.tsx
select.tsx
slider.css
slider.tsx
switch.css
switch.test.tsx
switch.tsx
textarea.css
textarea.test.tsx
textarea.tsx
```

Cross-checked against `src/index.ts` — every `*.tsx` source file in `components/` is exported:

| File | Re-exported from `src/index.ts`? |
|---|---|
| `button.tsx` | yes (`Button`, `IconButton`, types) |
| `number-stepper.tsx` | yes (`NumberStepper`, `NumberStepperProps`) |
| `seg.tsx` | yes (`Seg`, `SegItem`, `SegProps`, `SegVariant`) |
| `select.tsx` | yes (`Select`, `SelectItem`, `SelectProps`) |
| `slider.tsx` | yes (`Slider`, `SliderProps`) |
| `switch.tsx` | yes (`Switch`, `SwitchProps`) |
| `textarea.tsx` | yes (`Textarea`, `TextareaProps`, `TextareaVariant`) |

`src/registry/` is the same story — every `*.tsx` (excluding `*.test.tsx`) is re-exported from `src/registry.ts`:

| File | Re-exported from `src/registry.ts`? |
|---|---|
| `accordion.tsx` | yes |
| `badge.tsx` | yes |
| `color-picker.tsx` | yes |
| `combobox.tsx` | yes |
| `dialog.tsx` | yes |
| `input-copy.tsx` | yes |
| `input-group.tsx` | yes |
| `mobile-drawer.tsx` | yes |
| `nav-item.tsx` | yes |
| `nav-menu.tsx` | yes |
| `select.tsx` | yes |
| `table.tsx` | yes |
| `tabs.tsx` | yes |
| `thinking-steps.tsx` | yes |
| `tooltip.tsx` | yes |

## Per-file classification of the INVENTORY.md "orphan" list

For each path Wave 1 flagged, here is the actual status:

| Path Wave 1 listed | Actual status | Recommendation |
|---|---|---|
| `src/components/menu-item.tsx` | does not exist | none — INVENTORY.md should drop this line |
| `src/components/dropdown.tsx` | does not exist | none — drop |
| `src/components/checkbox-group.tsx` | does not exist | none — drop |
| `src/components/radio-group.tsx` | does not exist | none — drop |
| `src/components/tabs-subtle.tsx` | does not exist | none — drop |
| `src/components/tabs.tsx` | does not exist (canonical lives at `src/registry/tabs.tsx`) | none — drop |
| `src/components/thinking-indicator.tsx` | does not exist | none — drop |
| `src/components/dialog.tsx` | does not exist (canonical at `src/registry/dialog.tsx`) | none — drop |
| `src/components/accordion.tsx` | does not exist (canonical at `src/registry/accordion.tsx`) | none — drop |
| `src/components/table.tsx` | does not exist (canonical at `src/registry/table.tsx`) | none — drop |
| `src/components/tooltip.tsx` | does not exist (canonical at `src/registry/tooltip.tsx`) | none — drop |
| `src/components/color-picker.tsx` | does not exist (canonical at `src/registry/color-picker.tsx`) | none — drop |
| `src/components/input-copy.tsx` | does not exist (canonical at `src/registry/input-copy.tsx`) | none — drop |
| `src/components/input-group.tsx` | does not exist (canonical at `src/registry/input-group.tsx`) | none — drop |
| `src/components/thinking-steps.tsx` | does not exist (canonical at `src/registry/thinking-steps.tsx`) | none — drop |
| `src/components/badge.tsx` | does not exist (canonical at `src/registry/badge.tsx`) | none — drop |
| `src/components/nav-item.tsx` | does not exist (canonical at `src/registry/nav-item.tsx`) | none — drop |
| `src/components/nav-menu.tsx` | does not exist (canonical at `src/registry/nav-menu.tsx`) | none — drop |
| `src/components/mobile-drawer.tsx` | does not exist (canonical at `src/registry/mobile-drawer.tsx`) | none — drop |

## Verified actual `src/components/` contents

| Path | Classification | Notes |
|---|---|---|
| `src/components/button.tsx` | canonical (Weekend re-skin) | exported; see CLAUDE.md — wraps `@weekend/design` registry Button (or rather Weekend's expanded Button) and adds `soundCue`, icon-size variants. |
| `src/components/button.css` | canonical | sibling of button.tsx |
| `src/components/button.test.tsx` | canonical | tests for button |
| `src/components/number-stepper.tsx` | canonical (Weekend addition) | exported; not in upstream — Weekend-only primitive |
| `src/components/number-stepper.css` | canonical | sibling |
| `src/components/seg.tsx` | canonical (Weekend addition) | exported; visually overlaps with upstream `tabs-subtle` but is its own primitive |
| `src/components/seg.css` | canonical | sibling |
| `src/components/select.tsx` | canonical (Weekend re-skin) | exported as `Select` from `index.ts`. Distinct from `src/registry/select.tsx`. |
| `src/components/select.css` | canonical | sibling |
| `src/components/select.test.tsx` | canonical | tests |
| `src/components/slider.tsx` | canonical (Weekend re-skin) | exported; not under registry/ |
| `src/components/slider.css` | canonical | sibling |
| `src/components/switch.tsx` | canonical (Weekend re-skin) | exported; not under registry/ |
| `src/components/switch.css` | canonical | sibling |
| `src/components/switch.test.tsx` | canonical | tests |
| `src/components/textarea.tsx` | canonical (Weekend addition) | exported; CLAUDE.md notes "design has no Textarea" — Weekend-only primitive |
| `src/components/textarea.css` | canonical | sibling |
| `src/components/textarea.test.tsx` | canonical | tests |

## Outstanding decision: `select.tsx` parallel pair

We DO have two Select implementations:
- `src/components/select.tsx` — exported from `@weekend/design` (index.ts) as `Select`, `SelectItem`, `SelectProps`. **Single-component prop-driven API** (likely Weekend re-skin).
- `src/registry/select.tsx` — exported from `@weekend/design/registry` as `Select`, `SelectContent`, `SelectItem`, `SelectTrigger` + types. **Compound Radix API**.

These are intentionally different APIs surfaced under different entry points (`@weekend/design` vs `@weekend/design/registry`), each with its own consumers. Not an orphan; this is by design but **deserves its own audit doc** to clarify which the desktop UI consumes (Open Question 2 in INVENTORY.md). Outside the scope of this Wave 2F batch.

## Recommendation summary

- **Update INVENTORY.md L147–166** to either remove the orphan list entirely or rewrite it as "Wave 1 noted these may exist; Wave 2F verified none do." This is documentation hygiene, not a code change.
- **Do not delete or rebuild any current `src/components/*` files** — they are all canonical and re-exported.
- **Surface nothing that doesn't exist.** The four upstream-only primitives (`Dropdown`, `MenuItem`, `CheckboxGroup`, `RadioGroup`, `TabsSubtle`, `ThinkingIndicator`) are genuinely missing from our package; their absence is a real gap (covered in `_missing-*.md` docs in this batch and in `tabs.md`).
- **Keep an eye on parallel-API pairs**: `src/components/select.tsx` ↔ `src/registry/select.tsx` is the single remaining "two-files-one-name" situation, and the only one that warrants its own future audit.
