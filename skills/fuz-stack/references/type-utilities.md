---
description: Nominal typing (Flavored/Branded), strict utility types
---

# Type Utilities

TypeScript type helpers in `@fuzdev/fuz_util/types.ts` — which to reach for
and the conventions around them; full signatures live in the source and on
the generated API docs.

## Nominal Typing

### Flavored (loose) — the primary approach

`Flavored<TValue, TName>` adds an _optional_ invisible brand: unflavored base
values assign without casting, but different flavors are incompatible.

```typescript
type Email = Flavored<string, 'Email'>;
type Address = Flavored<string, 'Address'>;

const email1: Email = 'foo@bar.com'; // ok — plain string assigns
const email2: Email = 'foo' as Address; // error — Address !== Email
```

Real uses: `PathId` (`path.ts`), `GitOrigin`/`GitBranch` (`git.ts`), the
color channel types (`Hue`, `Saturation`, `Red`, …, `colors.ts`), `Url`
(`url.ts` — paired with a Zod schema of the same name), `BlogPostId`
(fuz_blog), `InputPath` (gro), `ReorderableId` (zzz).

### Branded (strict) — exported but unused

`Branded<TValue, TName>` requires a cast from the base type. Nothing in the
ecosystem uses it: in practice, use `Flavored` for compile-time-only nominal
typing, and Zod `.brand()` when the value crosses a runtime boundary and
should also validate (`Uuid`, `Datetime` — see ./zod-schemas.md §Branded
Types).

## Strict & Distributive Utilities

- **`OmitStrict<T, K extends keyof T>`** — `Omit` that rejects non-keys
  (standard `Omit` accepts any string, so typos compile silently). Widely
  used in fuz_ui, fuz_app, zzz.
- **`PickUnion<T, K>` / `KeyofUnion<T>`** — `Pick`/`keyof` that distribute
  over unions (the standard ones don't).

## Class & Element Helpers

- **`Assignable<T, K>`** — removes `readonly`; zzz uses it for
  self-referential init:
  `(this as Assignable<typeof this, 'app'>).app = this;`
- **`ClassConstructor<TInstance>`** — constructor type; zzz's Cell registry
  is `Map<string, ClassConstructor<Cell>>`.
- **`ArrayElement<T>`** — element type of a readonly array.

## Exported but currently unused

`PartialExcept`, `PartialOnly`, `PartialValues`, and `NotNull` have no
references outside `types.ts`; `Defined` has one (fuz_ui's `csp.ts`). Don't
model new code on them — reach for an inline mapped type until a recurring
need appears.
