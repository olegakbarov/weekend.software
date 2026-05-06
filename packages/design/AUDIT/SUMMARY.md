# Migration record — `@weekend/design` ↔ fluid-functionalism upstream

Compact migration record. One paragraph per phase. Future-us re-audits
should diff against this baseline.

> Filename note: this file is the canonical "what we did" doc the original
> Phase E plan called `SUMMARY.md`. Renamed to `MIGRATION-RECORD.md`
> because the harness reserves the word "summary" for transient outputs.

**Upstream pin:** `mickadesign/fluid-functionalism` @ `d850ecf76a9972b185564faec0fd927f4b66979c` ("Polish color picker popover, format dropdown, and swatches"; no upstream tag).
**Local clone:** `/Users/venge/Code/fluid-functionalism-upstream/` (read-only reference).
**Final state:** 262/262 tests passing; `dist/index.js` ~ 41 kB; `dist/registry.js` ~ 126 kB; 100 consumer manifests.

---

## Phase A — Audit

**Commit:** `7ab5dc3` — _audit: full fidelity audit vs fluid-functionalism upstream_
**Diff size:** 39 files changed, +3921 / -0
**Test count:** 45/45 (audit-only; no source changes)

**Wins:**
- 35 per-artifact audit docs in `AUDIT/` covering every component, token, lib utility, hook.
- Cross-referenced everything against upstream `d850ecf`.
- Drift bucketed into 4 tiers (foundation / major rebuilds / visual polish / nearly-identical).

**Notable:**
- Identified Wave 1 misclassifications (mobile-drawer/nav-item/nav-menu marked EXTRA when they're upstream-canonical).
- Identified Wave 1's fabricated 18-path orphan-files list (`_orphan-files-classification.md`).
- Wave 1 had `useProximityHover` drift direction inverted - upstream IS the sophisticated version.

---

## Phase F — Foundation

**Commit:** `5c4c8d6` — _phase F: foundation port to upstream parity_
**Diff size:** 31 files changed, +989 / -207
**Test count:** 45 -> 45 (preserved; no breaking changes)

**Wins:**
- `lib/springs` migrated to framer-motion v12 `{type, duration, bounce}` API.
- `lib/icon-context` + new `lib/icon-map` ported (4-library swap: lucide always installed; tabler/phosphor/hugeicons via `registerIconLibrary` with peer-dep fallback; `I` keyboard shortcut; legacy 6-name camelCase shim preserved).
- `lib/shape-context` ported to Provider + `R` keyboard shortcut + `transitionShape` helper. Mounted in `src/main.tsx`.
- `hooks/use-proximity-hover` replaced upstream-verbatim (axis option, rAF, transform-aware, `useRegisterProximityItem`).
- Tokens added: `--checker-a/b`, `html.transitioning` block, `shimmer-text` keyframes, `spinner-move/dash` keyframes. fluid-dark surfaces reconciled to upstream verbatim per D1.

**Notable:**
- Zero breaking changes to public DS APIs by design - Phase B+ agents could rely on canonical foundations without churning consumers.

---

## Phase B+C — Primitive parity sweep + ColorPicker port

**Commit:** `8931043` — _phase B+C: full primitive parity port to upstream fluid_
**Diff size:** 50 files changed, +8355 / -580
**Test count:** 45 -> 200 (+155 across new and updated suites)

**Wins:**
- 10 parallel agents ported every HIGH-drift component to upstream `d850ecf`.
- B1 Accordion: 100->663 LOC; new `AccordionGroup` proximity-hover overlay; chevron-right + 90deg rotation; dual-text width-stable weight transition.
- B2 Tooltip: framer-motion directional spring slide-in; defaults realigned (`delayDuration` 200, `sideOffset` 8).
- B3 InputCopy: 3-state tooltip machine (`idle | copied | suppressed`) + `<mark>` hover-highlight.
- B4 Select: 312->769 LOC; animated overlays + Arrow/Home/End nav + hidden form input + new exports (`SelectGroup/Label/Separator`, `triggerVariants`).
- B5 Slider: 73->1515 LOC + 515 CSS; full Radix-backed port; keyboard a11y bug fixed; `(min, step)` snapping bug fixed; `SliderComfortable` variant; `format` retained as deprecated alias.
- B6 Switch: drag-to-toggle + thumb morph restored; ON-state is upstream blue under fluid themes, mono under weekend themes via `[data-theme="weekend-*"]` override (D1 decision).
- B7 Button: 4 upstream variants restored + 3 Weekend extras kept (D3 decision); default reverted `tertiary -> primary`; `loading` prop with spinner keyframes; auto-sized icons.
- B8 Badge + ThinkingSteps: forwardRef + shape-context + restored sizes; ThinkingSteps `[&>.absolute]:hidden` + `w-fit` header fix + `shimmer-text` on active label.
- B9 Dialog: close affordance routed through `Button variant="ghost"`; font-variation aligned.
- C ColorPicker: 92->1227 LOC; full HSV/HSL/OKLCH + eyedropper + scrubbable channels + ColorPickerPopover/ColorSwatch/ColorTile.

**Notable compromises (Phase D follow-ups):**
- ColorPicker `FormatDropdown` inlined because Dropdown wasn't shipped yet (closed in D1).
- ColorPicker `ChannelSlider` stays inline (real reason: needs a colored-tile thumb that the registry Slider doesn't expose).
- EyeDropper button gated on `"EyeDropper" in window` - silently hides on Tauri WKWebView; deferred.

---

## Phase B+C follow-ups (housekeeping)

**Commit:** `67fd671` — _docs: tidy follow-ups from phase B+C_
**Diff size:** 2 files changed, +10 / -4
**Test count:** 200 -> 200 (no test changes)

**Wins:**
- Slider `format` alias gets formal `@deprecated` JSDoc tag.
- ColorPicker `ChannelSlider` comment updated with the *real* reason it stays inline.
- EyeDropper Tauri fallback formally deferred to a separate research spike.

---

## Phase D — New ports

**Commit:** `6de75be` — _phase D: port Dropdown/MenuItem + CheckboxGroup/RadioGroup_
**Diff size:** 24 files changed, +2462 / -171
**Test count:** 200 -> 262 (+62)

**Wins:**
- D1 Dropdown + MenuItem (245 + 146 LOC, +28 tests): single-select menu surface with proximity-hover + animated checked-row + animated focus ring (same overlay pattern as Select). Exports: `Dropdown`, `DropdownLabel`, `DropdownSeparator`, `useDropdown`, `MenuItem`. **ColorPicker's inline `FormatDropdown` REPLACED** with the new `<Dropdown>` - closes the Phase C follow-up.
- D2 CheckboxGroup + RadioGroup (410 + 412 LOC, +34 tests): form-input pair on Phase F's proximity-hover + animated focus-ring infra. `role="checkbox"`/`role="radio"` + `aria-checked` + roving tabIndex (Space to toggle, Arrow/Home/End to navigate). Visual + a11y matches upstream verbatim.

**Notable deviations:**
- D2 doesn't yet wrap `@radix-ui/react-checkbox` / `@radix-ui/react-radio-group` (pnpm add was unavailable at port time). Public API stays upstream-identical, so swapping to Radix later is an API-compatible refactor.
- D1 ships two `exactOptionalPropertyTypes` adapters: `checkedIndex` undefined-vs-optional, key fallback `?? 0`.

---

## Aggregate

| Phase | Commit | Net diff | Test count |
|---|---|---|---|
| A audit | `7ab5dc3` | 39 files, +3921 | 45 -> 45 |
| F foundation | `5c4c8d6` | 31 files, +989/-207 | 45 -> 45 |
| B+C primitives | `8931043` | 50 files, +8355/-580 | 45 -> 200 |
| B+C follow-ups | `67fd671` | 2 files, +10/-4 | 200 -> 200 |
| D new ports | `6de75be` | 24 files, +2462/-171 | 200 -> 262 |
| **Total** | — | **+15,737 / -962** | **45 -> 262 (+217)** |

**State at end of Phase D:**
- All foundation drift closed.
- All HIGH-drift components ported to upstream-identical (or upstream-aligned + Weekend extension).
- All MISSING primitives shipped (Dropdown + MenuItem, CheckboxGroup + RadioGroup).
- 0 MISSING; 2 DEFERRED (TabsSubtle, ThinkingIndicator).
- 5 retained Weekend additions (Combobox, NumberStepper, Seg, Tabs simple-shape, Textarea), each with documented justification.
- 1 third-party-backed Weekend addition (FileTree -> @pierre/trees).
