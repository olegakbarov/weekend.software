# `@weekend/design` fidelity audit

This directory tracks fidelity vs canonical upstream
[`mickadesign/fluid-functionalism`](https://github.com/mickadesign/fluid-functionalism).

- **`INVENTORY.md`** — canonical list of upstream artifacts (components,
  tokens, hooks, lib) cross-referenced against ours. Produced by Wave 1.
  Read this first.
- **`AUDIT-TEMPLATE.md`** — section structure for per-component drift docs.
  Wave 2 agents copy this to `<component>.md` and fill it in.
- **`<component>.md`** — produced by Wave 2; one per component listed in
  `INVENTORY.md` as `EXISTS` with drift, or `MISSING` / `EXTRA` worth
  documenting.

Upstream clone (read-only reference): `/Users/venge/Code/fluid-functionalism-upstream/`
Pinned commit: `d850ecf76a9972b185564faec0fd927f4b66979c` (no upstream tag).

The intermediate vendored copy at `/Users/venge/Code/fluid/` (without the
`-upstream` suffix) is a snapshot we already migrated from — don't audit
against it; use the upstream clone instead.
