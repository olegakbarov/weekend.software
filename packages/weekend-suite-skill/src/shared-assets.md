# Shared assets — `./shared-assets/`

Load when: the user mentions fonts, images, datasets, sample data,
brand assets, or anything else under `./shared-assets/` that isn't
the design system.

`./shared-assets/` is a per-project directory Weekend keeps in sync
with the user's global `~/.weekend/shared-assets/`. It mixes two
distinct kinds of content:

1. **`./shared-assets/weekend-design/`** — the prebuilt
   `@weekend/design` system. Read-only, system-managed. See
   `design-system.md`. Treat it like `node_modules`: do not edit.

2. **Everything else** — user-managed assets. Fonts, reference images,
   datasets, brand kits, screenshots, scratch files. These are the
   user's working set, not a curated library.

## The "ask before consuming" rule

Do not assume any non-design shared asset applies to the current task.
The user may have a font in `./shared-assets/fonts/` that they want
used only on certain projects. They may have ten reference images and
only one is relevant.

When you think an asset applies:

1. Name it explicitly: "I see `./shared-assets/fonts/Inter.woff2` —
   should I wire it in as the body font?"
2. Wait for confirmation before adding it to `package.json`, importing
   it, or copying it elsewhere.
3. If multiple assets could apply, list them and ask the user to pick.

For obvious, unambiguous cases (the user said "use the logo in
shared-assets") you can act directly — the rule is about avoiding
silent assumptions, not about adding friction.

## What NOT to do

- Don't auto-import every font in `./shared-assets/fonts/`.
- Don't copy shared assets into the project's `src/` to "make them
  local" — they are already accessible via the relative path.
- Don't write into `./shared-assets/` from project code. Sync goes one
  way (Weekend → project).
