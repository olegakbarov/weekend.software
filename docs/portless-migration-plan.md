# Portless Runtime Plan (Current)

Last updated: 2026-03-05

## Runtime Model

Weekend uses one runtime mode:

1. `runtime.mode` must be `"portless"`.
2. `runtime.url` must be a local URL (`localhost`, `*.localhost`, `127.0.0.1`, `::1`, `0.0.0.0`).
3. Local `localhost` / `*.localhost` URLs without an explicit port are normalized to `:1355`.

This behavior is enforced in config parsing and write paths.

## Config Backfill Rules

Backfill keeps existing valid runtime URLs and only repairs missing/invalid values.

1. Valid config:
   - Preserve existing `runtime.url`.
   - Normalize and rewrite canonical structure.
2. Missing config:
   - Create `weekend.config.json`.
   - Generate default `runtime.url` from project slug (`http://<slug>.localhost:1355`).
3. Invalid config:
   - Recover a valid local `runtime.url` from raw config if possible.
   - Otherwise generate default slug URL.

## Project Write Rules

`project_config_write` preserves runtime URL whenever possible.

1. Valid config: reuse current `runtime.url`.
2. Invalid config: recover local `runtime.url` from raw JSON when possible.
3. Missing config: generate slug-based default.

## UX and User Expectations

1. Users do not need to install `portless` globally.
2. Weekend uses bundled `portless` runtime assets for Play flows when available.
3. Project browser targets the configured `runtime.url` (with local URL normalization).
4. Runtime config editing should not silently change a user’s valid runtime URL.

## Validation Checklist

1. Frontend build passes: `pnpm build`.
2. Backend tests pass: `cargo test --manifest-path src-tauri/Cargo.toml`.
3. Existing `runtime.url` values survive `project_config_write` and startup backfill.
4. Missing/invalid local URLs are repaired to `http://<slug>.localhost:1355`.

## Follow-ups (Optional)

1. Add dedicated unit tests for backfill/write URL preservation behavior.
2. Remove unused backend commands (`terminal_list`, `terminal_active_processes`, `logs_read_project`) if no external caller depends on them.
