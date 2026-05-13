# Routing evals

Informal prompts for sanity-checking the `weekend-suite` skill's
description as a routing trigger. Run them as the first user message
in a fresh Claude Code conversation inside a project under
`~/.weekend/<project>/` and check whether the skill loads.

## SHOULD LOAD

- "Add a settings page with tabs for Profile, Notifications, and Billing."
- "Why isn't the dark theme working? It only changes some colors."
- "Test the signup form in the browser pane — fill it out and submit."
- "How do I change the dev server URL for this project?"

## SHOULD NOT LOAD

- "Write a Python script to parse this CSV and emit JSON."
- "Explain Big-O notation with examples."
- "Fix this Rust borrow-checker error in `src-tauri/src/main.rs`."
  (Working on aios itself, not in a project under `~/.weekend/`.)
- "Summarize this academic paper I just pasted in."

## BOUNDARY

- "Make this button feel snappier." — Should load
  `make-interfaces-feel-better`, NOT this skill. Generic UI polish,
  not anything Weekend-specific. If this skill loads, the description
  is too eager on "button" / "feel".
- "Build a tooltip component." — Should consult this skill at least
  enough to check whether `@weekend/design` already has Tooltip. If
  it doesn't load, the design-system discipline is at risk.
- "Run the app and tell me what's on the home page." — Should load
  (Weekend MCP browser-tool territory). If a generic "use Playwright" reply comes
  back, the skill's browser-MCP framing isn't reaching the model.
- "Add a font from `./shared-assets/fonts/`." — Should load (shared
  assets territory, and the "ask which file" rule matters here).
