# `@weekend/design` fidelity audit

This directory tracks fidelity vs canonical upstream
[`mickadesign/fluid-functionalism`](https://github.com/mickadesign/fluid-functionalism).

**Current state:** post-Phase-D (commit `6de75be`). All foundation drift
closed; all HIGH-drift components ported; all MISSING primitives shipped;
262/262 tests passing. See `SUMMARY.md` for the per-phase record.

---

## Files in this directory

### Living docs (canonical state, kept in sync)

- **`INVENTORY.md`** — canonical list of upstream artifacts (components,
  tokens, hooks, lib) cross-referenced against ours. Status column shows
  post-Phase-D state for every component. **Read this first** if you
  want the current ground truth.
- **`SUMMARY.md`** — compact migration log. One paragraph per
  phase (A audit / F foundation / B+C primitives / B+C follow-ups / D
  new ports). Includes commit hashes, diff sizes, test deltas, key wins,
  and notable deviations. **The canonical "what we did" doc.**
- **`RESIDUAL.md`** — visual eyeball checklist. Per-component things to
  verify in `/dev/ds` against `fluidfunctionalism.com`, theme by theme,
  with KNOWN deviations called out. Plus the list of explicitly deferred
  follow-ups (EyeDropper Tauri fallback, D2 Radix swap, Slider `format`
  alias hard-deprecation, ColorPicker `ChannelSlider` inlining,
  TabsSubtle / ThinkingIndicator).
- **`MIGRATION-PLAN.md`** — the original Phase plan from `7ab5dc3`. Kept
  as historical artifact; the actual phases landed roughly per plan
  (some compromises documented in `SUMMARY.md`).

### Wave 2 per-artifact audits (historical, frozen at audit time)

- **`AUDIT-TEMPLATE.md`** — section structure used by Wave 2 agents.
- **`<component>.md`** — one per component. Frozen at the Wave 2 audit
  pass (commit `7ab5dc3`); use these to understand *why* each port
  decision was made. Status of each is now reflected in `INVENTORY.md`.
- **`_lib-*.md`, `_hook-*.md`, `_tokens.md`, `_html-transitioning.md`**
  — foundation-tier audits.
- **`_missing-*.md`** — audits of upstream primitives we didn't ship at
  audit time (Phase D closed the gap on Dropdown/MenuItem/CheckboxGroup/
  RadioGroup; TabsSubtle and ThinkingIndicator remain DEFERRED).
- **`_orphan-files-classification.md`** — verification that Wave 1's
  18-path orphan list was fabrication.

---

## Process used

**Wave 1 (pre-audit):** rough inventory; produced misclassifications.

**Wave 2 (audit, commit `7ab5dc3`):** 35 parallel agents each took one
upstream artifact, diffed against ours, produced a per-artifact `.md`
following `AUDIT-TEMPLATE.md`. Aggregated into `INVENTORY.md` and
`MIGRATION-PLAN.md`.

**Phase F (commit `5c4c8d6`):** single sequential agent ported
foundation layer (springs, icon-system, shape-context, proximity-hover,
tokens). Blocked all primitive work.

**Phase B+C (commit `8931043`):** 10 parallel agents, each with the
relevant `<component>.md` audit doc as its spec. Each agent owned one
component file + tests + CSS. ColorPicker (Phase C) ran on its own
track due to size.

**Phase D (commit `6de75be`):** 2 parallel agents added the four
remaining missing primitives.

**Phase E (this commit):** sync `AUDIT/` to ground truth — corrected
inventory, residual checklist, migration record.

---

## How to re-audit (when upstream changes)

1. **Pin a new upstream commit.** Clone or pull `mickadesign/fluid-functionalism`
   into `~/Code/fluid-functionalism-upstream/` (the exact path Wave 2
   used). Capture the commit hash.
2. **Diff the foundation first.** Run `git diff d850ecf..<new-hash>
   -- registry/default/lib/ registry/default/hooks/ app/globals.css`
   in the upstream clone. If any of those files changed, dispatch a
   Phase F-style sequential agent before primitive work.
3. **Per-component audit pattern.** For each upstream component file
   under `registry/default/`, follow the same Wave 2 dispatch:
   - Agent reads `AUDIT-TEMPLATE.md` for structure.
   - Agent reads upstream source + our source + the existing
     `<component>.md` (which becomes its diff baseline).
   - Agent produces an updated `<component>.md` with new drift findings.
4. **Bucket the findings.** Use `MIGRATION-PLAN.md`'s tier system
   (foundation / major rebuild / visual polish / nearly-identical).
5. **Dispatch port phases** in the same order: F (foundation) → B+C
   (primitives) → D (missing) → E (this doc-sync).
6. **Update `INVENTORY.md` + `SUMMARY.md` + `RESIDUAL.md`**
   to reflect the new state. Bump `INVENTORY.md`'s "audit basis" line
   to the new commit hash.

The `AUDIT/<component>.md` files are intentionally **frozen** at their
audit-time content — re-runs produce a new audit doc (Wave 3, Wave 4)
rather than overwriting Wave 2. That way the historical record of
"what drift existed when" stays intact.

---

## Reference paths

- Upstream clone (read-only): `/Users/venge/Code/fluid-functionalism-upstream/`
- Pinned commit: `d850ecf76a9972b185564faec0fd927f4b66979c` (no upstream tag)
- Intermediate vendored copy: `/Users/venge/Code/fluid/` — **do not audit
  against this**; it's a snapshot we already migrated from. Use the
  `-upstream` clone instead.
