# Audit: lib/icon + lib/icon-context (icon registry)

**Status**: major-drift (different domain — single-library lookup vs runtime four-library swap)

**Upstream source**:
- `registry/default/lib/icon-context.tsx` (commit `d850ecf`) — Provider + hooks
- `registry/default/lib/icon-map.tsx` (commit `d850ecf`) — adapters and 40+ icon name → 4 implementations

**Our source**:
- `packages/design/src/lib/icon-context.ts` — 7-icon Lucide-only `useIcon` lookup
- `packages/design/src/lib/icon.ts` — `IconComponent` type alias only

(Upstream `icon-map.tsx`: **MISSING** in our package. No equivalent file.)

## API drift

### Upstream surface

**`lib/icon-map.tsx`** (~440 LOC) exports:
- Types: `IconComponent` (callable `{ size?: number; strokeWidth?: number; className?: string } → ReactNode`), `IconComponentProps`, `IconLibrary` (`"lucide" | "tabler" | "phosphor" | "hugeicons"`), `IconName` (40-name string-literal union with kebab-case names like `"chevron-right"`, `"square-library"`, `"message-circle"`).
- Constants: `iconLibraryOrder` (the cycle order), `iconLibraryLabels` (display names).
- Adapter factories: `tabler`, `phosphor`, `hugeicons` — wrap each library's primitive into the canonical `IconComponentProps` shape so any of the four implementations is drop-in interchangeable.
- The big map: `iconMap: Record<IconLibrary, Record<IconName, IconComponent>>` — 4 × 40 = 160 entries.

**`lib/icon-context.tsx`** exports:
- `IconProvider` — React Context provider with internal `useState<IconLibrary>`, defaultLibrary param, and a global `keydown` listener that **cycles libraries on the `I` key** (skipping inputs/textareas/contentEditable + meta/ctrl/alt modifiers).
- `useIcon(name)` — returns the `IconComponent` for the active library; falls back to `iconMap.lucide[name]` if no provider mounted.
- `useIcons()` — returns the entire `Record<IconName, IconComponent>` for the active library, memoised.
- `useIconLibrary()` — returns `{ iconLibrary, setIconLibrary }`. Throws if no provider mounted.
- Re-exports `IconComponent`, `IconName`, `IconLibrary`, `iconLibraryOrder`, `iconLibraryLabels` from `icon-map`.

### Our surface

**`src/lib/icon-context.ts`** exports:
- A 6-icon hard-coded Lucide registry: `check`, `chevronDown`, `chevronRight`, `copy`, `search`, `x`.
- `IconName` = `"check" | "chevronDown" | "chevronRight" | "copy" | "search" | "x"` (camelCase, not kebab-case).
- `IconComponent` = `LucideIcon` (the lucide-react primitive type — `ForwardRefExoticComponent<…>`, NOT a callable function shape).
- `useIcon(name)` — pure lookup function, **not a React hook** despite the `use` prefix. Just returns `REGISTRY[name]`. No provider, no state, no memoisation needed.

**`src/lib/icon.ts`** exports:
- `IconComponent` — callable `(props: { size?: number | string; strokeWidth?: number | string; className?: string }) => ReactNode`. **Numeric-or-string** size/strokeWidth (upstream is strictly numeric).

(Note: there are **two competing `IconComponent` types** in our package — one in `icon.ts` callable, one in `icon-context.ts` is `LucideIcon`. Wave 2B should determine which is canonical and de-duplicate.)

### Side-by-side: what's missing

| Upstream feature | Ours | Notes |
|---|---|---|
| Multi-library swap (lucide / tabler / phosphor / hugeicons) | NO | Lucide-only. |
| `IconProvider` React context | NO | No provider exists. |
| `I` keyboard shortcut to cycle libraries | NO | No global listener. |
| `useIconLibrary()` hook | NO | |
| `useIcons()` (full map) | NO | |
| `iconMap` (160-entry table) | NO (file absent) | |
| `iconLibraryOrder` / `iconLibraryLabels` | NO | |
| 40-name `IconName` union | NO (we have 6) | |
| Adapter factories (`tabler`/`phosphor`/`hugeicons`) | NO | |
| Devs-time deps (`@tabler/icons-react`, `@phosphor-icons/react`, `@hugeicons/react`, `@hugeicons/core-free-icons`) | NO | Not in `packages/design/package.json`. |
| Strict numeric `size` / `strokeWidth` types | NO (we accept `number \| string`) | |

### Naming convention drift
Upstream uses **kebab-case** icon names (`"chevron-right"`, `"message-circle"`). Ours uses **camelCase** (`chevronRight`, `messageCircle` — though we don't have `messageCircle`). This is a public-API break — every consumer of `useIcon` calls a different name.

## Visual drift
- All visual diversity available in upstream (Tabler's lighter strokes, Phosphor's filled-weight variants, HugeIcons' richer shapes) is unavailable. Weekend ships only the Lucide "look".
- The 34 icon names absent from ours (`menu`, `dot`, `monitor`, `sun`, `moon`, `rectangle-horizontal`, `circle`, `square-library`, `clock`, `star`, `settings`, `plus`, `arrow-right`, `loader`, `users`, `lock`, `mail`, `bell`, `shield`, `palette`, `lightbulb`, `rocket`, `heart`, `paintbrush`, `brain`, `globe`, `user`, `image`, `link`, `rotate-ccw`, `play`, `pause`, `pipette`, `home`, `message-circle`, `inbox`) cannot be looked up via `useIcon` — consumers must import directly from `lucide-react`.

## Behavioral drift
- **Upstream `useIcon` is reactive** (subscribes to provider state — switches at runtime when `I` is pressed); **our `useIcon` is a pure synchronous lookup** with no subscription. Components that hot-swap on library change in upstream will be frozen on Lucide in ours.
- **Provider absence**: components designed to be wrapped in `<IconProvider>` will run unwrapped — upstream's `useIcon` falls back to Lucide silently in that case (so it would still work in ours), but `useIconLibrary()` would throw. Since we don't ship the latter, this is moot.
- **Type drift on `IconComponent`**:
  - Upstream's adapter shape is callable `(props) => ReactNode`.
  - Our `LucideIcon` shape is `ForwardRefExoticComponent`, which has different `propTypes` variance behaviour. Components written against the upstream callable shape will need `forwardRef` wrappers when ported back to Lucide.
  - The duplicate `IconComponent` in `src/lib/icon.ts` (callable, numeric-or-string size) suggests an in-progress migration — neither is currently the single source of truth.
- **No `I` key shortcut** → the demo / docs experience that lets you preview the same UI under four icon libraries is unavailable in our `/dev/ds`.

## Severity
**high** — three concrete reasons:

1. **Public-API break.** Anyone porting an upstream component that calls `useIcon("chevron-right")` will get a TypeScript error (we don't have that name) and, if it compiled, a runtime undefined.
2. **Dropped capability.** Runtime icon-library swap is a designed-in feature of fluid-functionalism. Cutting it removes the one thing that makes the design system "library-agnostic" rather than "Lucide-with-extra-steps".
3. **Internal inconsistency.** Two competing `IconComponent` types (`icon.ts` callable; `icon-context.ts` LucideIcon) means downstream type errors will surface at integration boundaries.

The "we deliberately scoped down" framing is reasonable — adding `@tabler/icons-react`, `@phosphor-icons/react`, and `@hugeicons/*` brings substantial bundle weight. But the **scoped-down design is itself drift**, and Wave 2B–F components written against `useIcon("chevron-right")` upstream cannot be ported as-is.

## Recommended fix
Two options, ordered by fidelity:

### Option A — full upstream parity
1. Port `registry/default/lib/icon-map.tsx` verbatim into `src/lib/icon-map.tsx`.
2. Port `registry/default/lib/icon-context.tsx` into `src/lib/icon-context.tsx` (replace ours).
3. Add `@tabler/icons-react`, `@phosphor-icons/react`, `@hugeicons/react`, `@hugeicons/core-free-icons` to `packages/design/package.json` `peerDependencies` (consumer chooses to install). Keep the Lucide path as the always-installed default.
4. Delete the two-`IconComponent` confusion: collapse `src/lib/icon.ts` into `icon-map.tsx`.
5. Re-skin `IconProvider` to be no-op-friendly when only Lucide is installed (try/catch the dynamic imports).

This keeps Weekend lean by default but allows opt-in fidelity.

### Option B — keep scoped, but align names + types
1. Rename our 6 icon keys from camelCase → kebab-case to match upstream (`chevronDown` → `chevron-down`).
2. Pick one `IconComponent` shape — recommend the callable `(props) => ReactNode` from `src/lib/icon.ts` so upstream components port over without ref-forwarding gymnastics.
3. Document the Weekend scope-down in `CREDITS.md` and the `lib/icon-context.ts` header so future contributors know the gap is intentional.
4. Expand the registry to cover the names that upstream registry components actually use (audit `registry/default/*.tsx` for `useIcon("...")` call sites; add at minimum `menu`, `loader`, `arrow-right`, `plus`, `dot`).

Either path closes the most consequential gap (the camelCase ↔ kebab-case API break) without committing to four-library bundle weight.
