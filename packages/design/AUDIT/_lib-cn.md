# Audit: lib/cn (className merge utility)

**Status**: identical (filename-only difference)

**Upstream source**: `registry/default/lib/utils.ts` (commit `d850ecf`)
**Our source**: `packages/design/src/lib/cn.ts`

## API drift
None.

| Aspect | Upstream | Ours |
|---|---|---|
| Filename | `utils.ts` | `cn.ts` |
| Export | `cn` | `cn` |
| Implementation | `twMerge(clsx(inputs))` | `twMerge(clsx(inputs))` |
| Param type | `ClassValue[]` from `clsx` | `ClassValue[]` from `clsx` |
| Return type | inferred `string` | annotated `string` |
| JSDoc | none | one-line summary |

Side-by-side bodies:

```ts
// upstream
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```ts
// ours
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
/** clsx + tailwind-merge: dedupes/conflicts Tailwind utility classes. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

## Visual drift
None.

## Behavioral drift
None. Identical inputs → identical outputs.

## Severity
**low** — file rename only. The rename matters only for someone porting
upstream code (`@/lib/utils` → `@weekend/design`'s `cn` export).

## Recommended fix
No action required. The filename rename (`utils.ts` → `cn.ts`) is a
deliberate clean-up in our package — `utils` is a non-name. Consumers
should always import the symbol, not the file path, so the rename is
free.
