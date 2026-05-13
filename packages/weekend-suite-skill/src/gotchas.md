# Gotchas

Load when: starting work in a Weekend project (read once), or when a
behavior smells wrong — theme not switching, a wrapper sneaking in,
something getting silently overwritten.

Each entry: rule, why it fails, how to apply.

## 1. Not checking `@weekend/design` before writing a new component

**Rule.** Before writing any visual primitive, grep
`./shared-assets/weekend-design/` (or `node_modules/@weekend/design`)
for the symbol and obvious synonyms.

**Why.** The package covers more than its name suggests: Button,
Dialog, Input, Badge, Combobox, Tabs, Accordion, Toggle, Slider, and
more. Reinventing one drifts the project away from the shared design
language, doubles the maintenance surface, and almost always misses
focus rings, motion, and theme support.

**How to apply.** If a near-match exists with wrong props, compose
around it rather than forking. Map vocabulary: "Modal" → `Dialog`,
"Dropdown" → `Combobox` or `Select`, "Pill" → `Badge`. Only after the
grep comes back empty should you build new — and even then, see #3.

## 2. Writing `document.documentElement.style.setProperty('--foo', ...)` to change themes

**Rule.** Switch themes only by setting `<html data-theme="…">`.
Never write CSS variables onto `<html>` via inline style.

**Why.** Inline styles have specificity 1,0,0,0 and beat every
`:root[data-theme="…"]` block in `tokens.css`. Once you've written one
variable inline, the theme system is silently bypassed for that
property and every theme that depends on it. Symptoms: "the dark
theme partially works", "the accent color is stuck on light".

**How to apply.** Use `setAttribute("data-theme", value)` only. If you
need per-component overrides, do them in a scoped class with normal CSS
specificity. If you ever feel the need to write a CSS variable onto
`<html>` inline, stop and re-think — that need is a sign the token
system is missing something, which is a design-system bug to report.

## 3. Creating a local UI wrapper for a pattern the shared system already covers

**Rule.** Don't wrap a `@weekend/design` component locally just to
rename props or add a default — at least not silently.

**Why.** Local wrappers fragment the design language across projects.
A wrapped Button that adds a `tone` prop becomes a slightly different
Button than every other project's, and over time the wrappers
accumulate enough divergence to make the shared system feel optional.

**How to apply.** If you find yourself reaching for a wrapper:
(a) check whether the design system already supports the prop you
want; (b) if it almost does, ask whether to wrap locally for this
project or report a design-system gap to Weekend. Either answer is
fine. The wrong move is to wrap without surfacing the choice.

## 4. Trying to modify `./shared-assets/weekend-design/`

**Rule.** Treat `./shared-assets/weekend-design/` as read-only. Do
not edit, patch, or add files inside it.

**Why.** It is a consumed artifact synced from Weekend itself, like
`node_modules`. Edits will be overwritten on the next sync — silently,
without warning. Anything that depended on your edit will then break
in a way that looks unrelated.

**How to apply.** If a primitive is missing, broken, or doesn't fit:
say so. Report the blocker — name the symbol, describe the need — and
either work around it temporarily (a local component, clearly marked
as a stand-in) or stop and surface the gap. Don't extend the read-only
directory.
