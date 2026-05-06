# Residual visual checklist — eyeball pass post-Phase-D

After Phase F / B+C / D land, the design package is **structurally** at
upstream parity (262/262 tests, all foundation drift closed, all
HIGH-drift components ported, all MISSING primitives shipped). This
document is the **visual** sign-off: open `/dev/ds` in the desktop, open
`https://www.fluidfunctionalism.com` in a browser, and walk through the
items below per component.

**How to use:**
1. Run `pnpm tauri:dev`. Navigate to `/dev/ds`.
2. Cycle the four themes via the topbar theme cycler: `fluid` →
   `fluid-dark` → `weekend-dark` → `weekend-paper`. Each component must
   look right in all four (deviations explicitly called out below are
   expected).
3. Diff each observable below against the upstream docs page at
   `fluidfunctionalism.com/docs/<component>`.
4. File any discrepancy as a `Phase-G` follow-up.

The known-deviation items are **expected** — don't file those as drift.

---

## Per-component checklist

### Accordion
- [ ] Trigger chevron is `chevron-right` (not `chevron-down`); rotates
      90° clockwise on expand via `springs.fast` (~80ms). Closing reverses
      smoothly without a snap.
- [ ] Expand/collapse height transition is height-only (no layout shift
      in siblings).
- [ ] Trigger label is dual-text: an invisible bold ghost layer behind
      the animated weight transition keeps width stable when the label
      goes from regular to bold on hover/expand. **Cycle to bold and
      back; the trigger row width must not jump.**
- [ ] **AccordionGroup**: hovering between sibling items, the rounded
      hover overlay slides between them on `springs.fast` rather than
      cross-fading. (Mouse left-to-right across 3 items — overlay
      tracks the cursor smoothly.)
- [ ] All 4 themes: trigger background uses `--card`; hover uses
      `--hover`. Verify no `--secondary` bleed-through.

### Badge
- [ ] Default size is h-22 (medium); xs is h-18; lg is h-26. **These
      were h-5/6/7 (20/24/28) pre-port — they should now match
      upstream's h-[18/22/26].**
- [ ] Solid color variants (`color="blue"` etc.) mix into `--background`
      (not `--card`) — surface tint should match the page background,
      not the card surface.
- [ ] `shape="pill"` resolves through `useShape()` (try toggling shape
      via `R` keyboard shortcut — badge corners should round/square
      live).
- [ ] All 4 themes: weekend-paper uses noticeably warmer surface; verify
      Badge solids stay legible against it.

### Button
- [ ] Default variant is `primary` (was `tertiary` pre-port). The "Save"
      affordance on the home page is now upstream-blue under fluid
      themes.
- [ ] **Loading state**: pass `loading={true}`; spinner uses
      `spinner-move` + `spinner-dash` keyframes overlaid above
      ghost-invisible label/icon. Label width does NOT collapse — the
      button stays the same size while spinning.
- [ ] Icon prop auto-sizes per button size: xs=12, sm=14, md=16, lg=20.
      Icon stroke-width animates on hover (1.5 → 1.75-ish).
- [ ] Weekend extension variants `destructive`, `success`, `link`: these
      have no upstream counterpart; verify they still render. **Known
      deviation: these are Weekend-only and won't appear on
      fluidfunctionalism.com.**
- [ ] All 4 themes: primary stays brand-blue under fluid themes; uses
      `--foreground`/`--background` inversion under weekend themes.

### Switch
- [ ] **Drag-to-toggle**: pointerdown on the thumb, drag horizontally —
      the switch follows the cursor, snapping to the nearest end on
      release via `springs.moderate`.
- [ ] Thumb morph: resting 16px circle → +2px on hover → 20×12 squashed
      pill on press. Releasing returns to circle smoothly.
- [ ] **ON-state color** (KNOWN DEVIATION):
  - `fluid` / `fluid-dark`: ON-state track is `#6B97FF` upstream signature blue.
  - `weekend-dark` / `weekend-paper`: ON-state track is `var(--foreground)`
    monochrome. **This is by design** (D1 decision); fluid keeps
    upstream identity, weekend keeps Weekend identity. Override is via
    `[data-theme="weekend-*"]` selector on `--switch-on`.
- [ ] OFF-state in all 4 themes: track uses `--neutral-300` light /
      `--neutral-700` dark; thumb is `--background`.

### Slider
- [ ] Track is the chunky 18px pill (NOT the 4px thin track from the
      pre-port placeholder). Thumb is a roughly 14px-tall pip embedded
      in the track.
- [ ] Keyboard a11y: focus the slider, press Arrow Left/Right (steps),
      Home (min), End (max), PageUp/PageDown (large step). Each
      produces a visual+value change. **This was the a11y bug — verify
      it's fixed.**
- [ ] `min`/`step` snapping: set `min={3} step={5}`, drag — values
      snap to 3, 8, 13, 18 (not 0, 5, 10, 15).
- [ ] `SliderComfortable` variant: chunky pip-style scrubber visible at
      each step.
- [ ] `format` prop (deprecated alias of `formatValue`) still works but
      JSDoc shows `@deprecated`.
- [ ] All 4 themes: track gradient uses theme-correct neutral pair;
      thumb visible against track in every theme.

### Select (registry)
- [ ] Open the menu — items have a proximity-hover bg overlay that
      tracks the cursor (not a per-item :hover paint).
- [ ] Selected item: animated checked-row bg under the current item.
- [ ] Focused item: animated focus ring (rounded outline) that slides
      between items with Arrow keys.
- [ ] Keyboard: open with Enter/Space, navigate with Arrow Up/Down,
      jump to first/last with Home/End, select with Enter, close with
      Escape.
- [ ] Hidden form input: render a `<form>` around `<Select name="x" required />`;
      submitting unselected should fail required-validation.
- [ ] Error state: `error="Pick one"` adds aria-invalid + inline
      message below trigger; trigger border switches to `--destructive`.
- [ ] All 4 themes: menu surface uses `--card`, overlays use `--hover`.

### Tooltip
- [ ] Hover a trigger — tooltip slides in from the side (top/right/
      bottom/left) on `springs.fast` (~80ms). Slide direction matches
      placement.
- [ ] Close: tooltip slides out on a 100ms duration linear ease (NOT
      a spring).
- [ ] Defaults: `delayDuration` is now 200ms (was 300ms);
      `sideOffset` is now 8px (was 4px).
- [ ] Multiple tooltips on one page: hovering between them respects
      Radix's grouped delay (skips the delay after the first show).

### Dialog
- [ ] Close button (top-right) uses `Button variant="ghost"` styling
      (text-only, no border). Pre-port it was a custom X button.
- [ ] Backdrop fade-in/out is the upstream value.
- [ ] Content slide-in on open matches upstream timing.
- [ ] All 4 themes: backdrop tint differs per theme — verify no
      pure-black backdrop on weekend-paper (should be warm shadow).

### Combobox
- [ ] **KNOWN: not-in-upstream, retained.** Combobox is a Weekend
      addition; no fluidfunctionalism.com page to diff against.
- [ ] Verify it still renders for the home-page `AgentCommandPicker`.
      Type to filter; Arrow keys navigate; Enter selects. Empty state
      shows "No results."

### Tabs
- [ ] **KNOWN: simple Radix wrapper, retained.** Upstream Tabs is
      richer/animated. We deliberately ship the simple shape; settings
      and `/dev/ds` consume it.
- [ ] Verify horizontal tab list, content swap on click, focus ring
      on Tab key.

### ThinkingSteps
- [ ] **Active step label has `shimmer-text` class** — gradient slides
      across the label horizontally. Matches upstream
      `ThinkingIndicator` shimmer.
- [ ] Header is `w-fit` (not full-width) — pre-port the underlying
      Accordion's hover bg bled through every step. Verify no step row
      paints a wider hover bg than its header content.
- [ ] `[&>.absolute]:hidden` rule active: any positioned children
      inside steps are hidden by default.
- [ ] All 4 themes: shimmer gradient uses theme-correct color stops
      (verify the gradient is visible in all 4, not invisible-against-bg
      in any).

### ColorPicker
- [ ] **HSV sat/val plane**: the 2D area paints correctly per hue;
      cursor dot follows pointer on drag.
- [ ] **Hue slider**: rainbow gradient, thumb tracks hue.
- [ ] **Alpha slider**: checker pattern visible behind transparent
      colors. Verify `--checker-a` / `--checker-b` tokens render in all
      4 themes (these were missing pre-port).
- [ ] **Format dropdown** (HSV/HSL/RGB/HEX/OKLCH cycle): now uses the
      new `<Dropdown>` + `<MenuItem>` (was inline pre-D1). Click — menu
      opens with proximity-hover overlay; select format — channel
      labels update.
- [ ] **Channel sliders** (the inline ones, not the registry `Slider`):
      drag a channel — value updates live; thumb is a colored tile
      reflecting current channel value. **KNOWN DEVIATION: stays inline
      because the registry Slider thumb is fixed-shape; ChannelSlider
      needs a thumb that *displays* the current channel color.**
- [ ] **EyeDropper button**: visible in Chrome/Edge browsers; **hidden
      on Tauri WKWebView (macOS desktop)** because the EyeDropper API
      isn't exposed there. **KNOWN DEFERRED**: no Tauri fallback yet.
- [ ] `ColorPickerPopover` opens on swatch click; portal-renders to
      `document.body` by default (override via `ColorPickerPortalContainer`).

### Dropdown + MenuItem
- [ ] Single-select menu surface. Open — items animate in with the
      same proximity-hover bg + checked-row + focus-ring overlays as
      Select.
- [ ] `MenuItem` requires an `icon` prop (mandatory); test by passing
      `<NoOpIcon>` or any 16px icon.
- [ ] `useDropdown()` returns the controlled state for parent-driven
      open/close.
- [ ] All 4 themes: menu surface, hover, and checked-row colors
      consistent with Select.

### CheckboxGroup + CheckboxItem
- [ ] Multiple selection. Click an item — checkmark appears; aria-checked
      flips.
- [ ] Keyboard: Tab to enter the group, Arrow Up/Down to navigate items,
      Space to toggle. Roving tabIndex (only one item is tab-focusable
      at a time).
- [ ] Proximity-hover bg overlay (same pattern as Select / Dropdown).
- [ ] Animated focus ring slides between items.
- [ ] **KNOWN DEFERRED**: doesn't yet wrap `@radix-ui/react-checkbox`.
      Public API matches upstream; swap is API-compatible when the
      Radix dep is added.

### RadioGroup + RadioItem
- [ ] Single selection. Same proximity/focus-ring as CheckboxGroup but
      with radio mutual-exclusion.
- [ ] Same keyboard model (Arrow + Space + Home/End).
- [ ] **KNOWN DEFERRED**: same Radix-deferred status as CheckboxGroup.

---

## Cross-cutting visual checks

### Theme tokens — switch all four and look for:
- [ ] No FOUC on theme switch — `html.transitioning` 180ms transition
      block is active during swap.
- [ ] `--checker-a` / `--checker-b` render correctly behind transparent
      ColorPicker swatches in every theme.
- [ ] `shimmer-text` keyframes animate in every theme.
- [ ] `spinner-move` / `spinner-dash` keyframes animate on Button
      `loading` in every theme.

### Shape context
- [ ] Press `R` keyboard shortcut at any point in `/dev/ds` — shape
      cycles `pill → rounded → sharp` and back. All shape-aware
      components (Button, Badge, Input) re-render their corner radii
      smoothly.
- [ ] Mounted `ShapeProvider` in `src/main.tsx` — verify by checking
      `<html data-shape>` updates.

### Icon context
- [ ] Press `I` keyboard shortcut — icon library cycles
      `lucide → tabler → phosphor → hugeicons`. **Tabler/Phosphor/
      HugeIcons aren't installed by default**; the cycle should
      surface a fallback or skip libraries with no resolver registered.
      Verify no crash.

---

## Known follow-ups still open

These are deliberately deferred — listed here so future-us doesn't
re-discover them:

1. **EyeDropper Tauri WKWebView fallback**. The `EyeDropper` API is
   Chromium-only and not exposed under WKWebView (macOS Tauri). We
   currently hide the button. A real fallback would route through a
   Tauri Rust command that reads the screen pixel under the cursor;
   research deferred (separate spike).
2. **D2 Radix swap**. `CheckboxGroup` and `RadioGroup` should wrap
   `@radix-ui/react-checkbox` and `@radix-ui/react-radio-group`
   respectively (upstream uses these). Public API is identical, so
   the swap is a no-API-change refactor when the deps are added to
   `packages/design/package.json`.
3. **Slider `format` alias hard-deprecation**. `format` is now an
   alias of `formatValue` with `@deprecated` JSDoc. Plan: leave for
   one minor version cycle (per `MIGRATION-PLAN.md`), then remove.
   Track active consumers via `.consumers/slider.json`.
4. **ColorPicker `ChannelSlider` stays inline**. The picker's
   per-channel sliders need a thumb that *displays* the current
   channel color as a tile (e.g. the R-slider thumb is a red tile
   showing the current red value). Our registry `Slider` thumb is
   fixed-shape — replacing it would require a `thumbContent` slot or
   render-prop on Slider, which adds API surface for one consumer.
   Documented in `color-picker.tsx`. Re-evaluate if a second consumer
   needs a custom-thumb slider.
5. **TabsSubtle / ThinkingIndicator deferred**. TabsSubtle overlaps
   with Weekend `Seg` (D2 decision). ThinkingIndicator is one-file
   away (keyframes already in tokens) — port when a consumer needs it.
