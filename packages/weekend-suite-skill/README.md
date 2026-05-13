# @weekend/suite-skill

A Claude Code skill that ships into every Weekend project. It teaches agents
working inside a project the things they need to know that they cannot infer
from the file tree alone: the portless runtime contract, the bundled
`@weekend/design` system, the `weekend` MCP, the `./shared-assets/`
discipline, and the small set of gotchas that bite first.

## Why a skill (vs. seeding `CLAUDE.md` inline)

Previously, the same content was written verbatim into every project's
`CLAUDE.md`. Every Claude Code conversation in a Weekend project loaded all
of it — even when working on an unrelated file. A skill replaces that with
progressive disclosure: the routing description (cheap) decides whether to
load the body, sibling `.md` files load only when the user's intent matches.

## Layout

- `src/SKILL.md` — routing entry, must-know rules, table of contents.
- `src/design-system.md` — `@weekend/design` consumption details.
- `src/mcp.md` — `weekend` MCP tool list and patterns.
- `src/runtime-config.md` — `weekend.config.json` and portless mode.
- `src/shared-assets.md` — `./shared-assets/` contract.
- `src/gotchas.md` — seeded failure-mode catalog.
- `evals.md` — manual routing checks (should/should-not/boundary).

## How it reaches projects

The desktop app syncs `src/` into `~/.weekend/shared-assets/weekend-suite-skill/`.
Each project gets a symlink `<project>/.claude/skills/weekend-suite` pointing
at that synced copy, so a skill update reaches every project at once without
rewriting any project files. Codex / other agents pick it up via their own
skill-discovery paths against the same directory.
