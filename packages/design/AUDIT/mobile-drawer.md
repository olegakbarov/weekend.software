# Audit: MobileDrawer

**Status**: minor-drift (Wave 1 mis-classified as `not-in-upstream`)

**Upstream source**: `registry/default/mobile-drawer.tsx` (commit `d850ecf`)
**Our source**: `packages/design/src/registry/mobile-drawer.tsx`

> Wave 1 listed this as EXTRA. That was incorrect. Upstream **does** ship
> `registry/default/mobile-drawer.tsx`; it's used by the upstream demo's
> `app/components/sidebar-layout.tsx`. It is simply **not registered in
> `registry.json`** (so shadcn `add` consumers don't pull it directly), and
> there is **no `app/docs/mobile-drawer/page.tsx`** reference demo. Despite
> that, the file is canonical upstream — the component originated upstream,
> not in Weekend.

## API drift
None. Public API is identical:
- Props: `open: boolean`, `onClose: () => void`, `children: ReactNode`,
  `triggerRef?: RefObject<HTMLElement | null>`.
- Single named + default export upstream; we export named only (no default).
  Doc-comment-only drift: ours adds `/** Optional: focus is restored to this
  element on close. */` JSDoc on `triggerRef` (improvement).
- Return type annotation: ours is explicit `: React.JSX.Element`; upstream is
  inferred. Cosmetic only.

## Visual drift
None observed. Both render:
- Overlay: `fixed inset-0 bg-black/20 dark:bg-black/40 z-40`, fade in/out
  (`opacity 0→1`, in `0.16s` / out `0.12s`).
- Panel: `fixed top-0 left-0 bottom-0 w-64 bg-background z-50 border-r
  border-border/60 overflow-y-auto p-4`, slide from `x: -100%` with
  `springs.moderate` (out duration `0.12s`).

Shape tokens, border tokens, and motion durations match upstream exactly.

## Behavioral drift
None. Both implementations:
- Lock `document.body.style.overflow = "hidden"` while open and restore on
  unmount.
- Capture `previousFocusRef` from `document.activeElement`, focus the first
  focusable inside the panel (or the panel itself), and restore focus to
  `triggerRef ?? previousFocusRef` on close.
- Trap Tab / Shift+Tab inside the panel, intercept Escape to call `onClose`.
- Identical `FOCUSABLE_SELECTOR` (quoting style differs — single vs double
  quotes — semantically identical when joined).
- Identical `aria-modal="true"`, `role="dialog"`, `aria-label="Navigation"`.

Subtle internal-naming drift only: `getFocusableElements` → `getFocusable`,
`handleKeyDown` → `onKeyDown`, `firstFocusable` → `focusables[0]`. Output
identical.

## Severity
**low** — the implementations are byte-equivalent in behavior. The only
artifact-level concern is that Wave 1's INVENTORY classified this as EXTRA,
which would have implied Weekend authored it. The fidelity is intact.

## Recommended fix
1. Update `INVENTORY.md` to re-classify MobileDrawer from **EXTRA** to
   **EXISTS (drift: none)**. Note that upstream omits this from
   `registry.json` (so shadcn consumers don't get it via `add`) but the
   source file is canonical at `registry/default/mobile-drawer.tsx`.
2. Optionally export `default` alongside the named export to match upstream
   `export default MobileDrawer;` — low value, but eliminates a trivial diff.
3. No source changes required for fidelity.
