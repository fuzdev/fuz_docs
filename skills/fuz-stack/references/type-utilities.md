# Type Utilities

TypeScript type helpers in `@fuzdev/fuz_util/types.js` — nominal typing,
stricter standard utilities, and selective partial types.

## Nominal Typing

TypeScript uses structural typing — two types with the same shape are
interchangeable. Nominal typing adds invisible brands to distinguish them.

### Flavored (loose)

`Flavored<TValue, TName>` adds an optional invisible brand. Unflavored base
types are assignable without casting, but different flavors are incompatible:

```typescript
// Implementation:
declare const FlavoredSymbol: unique symbol;
interface Flavor<T> {
  readonly [FlavoredSymbol]?: T;  // optional — base types still assignable
}
type Flavored<TValue, TName> = TValue & Flavor<TName>;
```

```typescript
type Email = Flavored<string, 'Email'>;
type Address = Flavored<string, 'Address'>;

const email1: Email = 'foo@bar.com';         // ok — plain string is fine
const email2: Email = 'foo' as Address;       // error — Address !== Email
```

Primary nominal typing approach. Real uses in fuz_util:

```typescript
// fuz_util/id.ts
export type Uuid = Flavored<string, 'Uuid'>;

// fuz_util/git.ts
export type GitOrigin = Flavored<string, 'GitOrigin'>;
export type GitBranch = Flavored<string, 'GitBranch'>;

// fuz_util/path.ts
export type PathId = Flavored<string, 'PathId'>;

// fuz_util/colors.ts
export type Hue = Flavored<number, 'Hue'>;           // [0, 1]
export type Saturation = Flavored<number, 'Saturation'>; // [0, 1]
```

Also: `BlogPostId` (fuz_blog), `InputPath` (gro), `VocabName`/`ReorderableId`
(zzz), `Url` (fuz_util).

### Branded (strict)

`Branded<TValue, TName>` adds a required brand. Plain base types NOT
assignable — must cast:

```typescript
// Implementation:
declare const BrandedSymbol: unique symbol;
interface Brand<T> {
  readonly [BrandedSymbol]: T;  // required — base types NOT assignable
}
type Branded<TValue, TName> = TValue & Brand<TName>;
```

```typescript
type PhoneNumber = Branded<string, 'PhoneNumber'>;

const phone1: PhoneNumber = '555-1234';                // error — must cast
const phone2: PhoneNumber = '555-1234' as PhoneNumber;  // ok
```

Exported but not used in the ecosystem. In practice: `Flavored` for
TypeScript-only nominal typing, Zod `.brand()` for runtime-validated types.

### Choosing between them

| Type     | Cast from base | Safety  | Use when                               |
| -------- | -------------- | ------- | -------------------------------------- |
| Flavored | Not required   | Loose   | IDs, paths, ergonomic APIs             |
| Branded  | Required       | Strict  | Validated data, security-sensitive     |

### Zod `.brand()` — runtime-validated nominal types

For types needing runtime validation, Zod `.brand()` (distinct from fuz_util's
`Branded`):

```typescript
// zzz/zod_helpers.ts
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// zzz/diskfile_types.ts
export const DiskfilePath = z
  .string()
  .refine((p) => is_path_absolute(p), {message: 'path must be absolute'})
  .brand('DiskfilePath');
export type DiskfilePath = z.infer<typeof DiskfilePath>;
```

fuz_util's `Uuid` uses `Flavored` (no runtime validation); zzz's `Uuid` uses
Zod `.brand()` (with validation). Separate types.

See ./zod-schemas.md for full Zod schema conventions including branded types.

## Strict Utility Types

### OmitStrict

Stricter `Omit` — `K` must be an actual key of `T`:

```typescript
type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

Standard `Omit` accepts any string for `K` (typos compile silently).
`OmitStrict` catches them. Widely used in fuz_ui, fuz_app, zzz.

### PickUnion and KeyofUnion

Standard `Pick` and `keyof` don't distribute over unions. These do:

```typescript
type KeyofUnion<T> = T extends unknown ? keyof T : never;
type PickUnion<T, K extends KeyofUnion<T>> = T extends unknown
  ? K & keyof T extends never ? never : Pick<T, K & keyof T>
  : never;
```

```typescript
type A = {x: number; y: string};
type B = {x: number; z: boolean};

type Keys = KeyofUnion<A | B>;        // 'x' | 'y' | 'z'
type Picked = PickUnion<A | B, 'x'>;  // {x: number} | {x: number}
```

## Partial Variants

### PartialExcept

Everything optional EXCEPT specified keys:

```typescript
type PartialExcept<T, K extends keyof T> = {[P in K]: T[P]} & {
  [P in Exclude<keyof T, K>]?: T[P];
};
```

```typescript
interface User { id: string; name: string; email: string; }
type UserUpdate = PartialExcept<User, 'id'>;
// { id: string; name?: string; email?: string; }
```

### PartialOnly

Only specified keys optional:

```typescript
type PartialOnly<T, K extends keyof T> = {[P in K]?: T[P]} & {
  [P in Exclude<keyof T, K>]: T[P];
};
```

### PartialValues

Values of `T` become partial (not the keys):

```typescript
type PartialValues<T> = { [P in keyof T]: Partial<T[P]> };
```

## Modifier Types

### Assignable

Removes `readonly`:

```typescript
type Assignable<T, K extends keyof T = keyof T> = { -readonly [P in K]: T[P] };
```

Used in zzz for self-referential initialization:

```typescript
// zzz/frontend.svelte.ts
(this as Assignable<typeof this, 'app'>).app = this;
```

## Extraction Types

### ClassConstructor

```typescript
type ClassConstructor<TInstance, TArgs extends Array<any> = Array<any>> =
  new (...args: TArgs) => TInstance;
```

Used in zzz Cell registry:

```typescript
// zzz/cell_registry.svelte.ts
readonly #constructors: Map<string, ClassConstructor<Cell>> = new Map();
```

### ArrayElement

```typescript
type ArrayElement<T> = T extends ReadonlyArray<infer U> ? U : never;
```

```typescript
type Item = ArrayElement<Array<{id: string}>>;  // {id: string}
```

### Defined and NotNull

```typescript
type Defined<T> = T extends undefined ? never : T;
type NotNull<T> = T extends null ? never : T;
```

## Quick Reference

| Type              | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `Flavored<TValue, TName>` | Loose nominal typing (no cast from base) |
| `Branded<TValue, TName>`  | Strict nominal typing (cast required, unused in ecosystem) |
| `OmitStrict<T, K>`| Omit with key validation                        |
| `PickUnion<T, K>` | Pick that distributes over unions               |
| `KeyofUnion<T>`   | keyof that distributes over unions              |
| `PartialExcept`   | All optional except specified keys              |
| `PartialOnly`     | Only specified keys optional                    |
| `PartialValues`   | Values of T become partial                      |
| `Assignable`      | Remove readonly                                 |
| `ClassConstructor`| Match constructor functions                     |
| `ArrayElement`    | Extract element type from array                 |
| `Defined`         | Exclude undefined                               |
| `NotNull`         | Exclude null                                    |
