# Type Utilities

Guide to TypeScript type helpers in `@fuzdev/fuz_util/types.ts`.

These provide nominal typing, stricter standard utilities, and selective partial
types used across the Fuz ecosystem.

## Contents

- [Nominal Typing](#nominal-typing)
- [Strict Utility Types](#strict-utility-types)
- [Partial Variants](#partial-variants)
- [Modifier Types](#modifier-types)
- [Extraction Types](#extraction-types)
- [Quick Reference](#quick-reference)

## Nominal Typing

TypeScript uses structural typing — two types with the same shape are
interchangeable. Nominal typing adds invisible brands to distinguish types that
share the same underlying structure.

### Flavored (loose)

`Flavored<T, Name>` adds an optional invisible brand. Unflavored base types
are assignable without casting, but different flavors are incompatible:

```typescript
type Email = Flavored<string, 'Email'>;
type Address = Flavored<string, 'Address'>;

const email1: Email = 'foo@bar.com';         // ok — plain string is fine
const email2: Email = 'foo' as Address;       // error — Address !== Email
```

Use Flavored for IDs, paths, and ergonomic APIs where you want to catch
mismatched types without requiring casts everywhere.

### Branded (strict)

`Branded<T, Name>` adds a required invisible brand. Plain base types are NOT
assignable — you must cast explicitly:

```typescript
type PhoneNumber = Branded<string, 'PhoneNumber'>;

const phone1: PhoneNumber = '555-1234';                // error — must cast
const phone2: PhoneNumber = '555-1234' as PhoneNumber;  // ok
```

Use Branded for validated data or security-sensitive types where you want the
type system to enforce that values have gone through validation.

### Choosing between them

| Type     | Cast from base | Safety  | Use when                               |
| -------- | -------------- | ------- | -------------------------------------- |
| Flavored | Not required   | Loose   | IDs, paths, ergonomic APIs             |
| Branded  | Required       | Strict  | Validated data, security-sensitive     |

See `references/zod_schemas.md` for Zod `.brand()` schemas (runtime validation
+ branding), branded types with defaults, and transform pipelines.

## Strict Utility Types

### OmitStrict

Stricter version of `Omit` — `K` must be an actual key of `T`:

```typescript
type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
```

Standard `Omit` accepts any string for `K`, which means typos compile silently.
`OmitStrict` catches them at compile time.

### PickUnion and KeyofUnion

Standard `Pick` and `keyof` don't distribute correctly over union types.
These variants do:

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

Makes everything optional EXCEPT the specified keys:

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

Inverse — makes only the specified keys optional:

```typescript
type PartialOnly<T, K extends keyof T> = {[P in K]?: T[P]} & {
  [P in Exclude<keyof T, K>]: T[P];
};
```

### PartialValues

Makes the values of `T` partial (not the keys themselves):

```typescript
type PartialValues<T> = { [P in keyof T]: Partial<T[P]> };
```

## Modifier Types

### Assignable

Removes `readonly` from properties:

```typescript
type Assignable<T, K extends keyof T = keyof T> = { -readonly [P in K]: T[P] };
```

Useful in tests or setup code where you need to write to normally readonly
properties.

## Extraction Types

### ClassConstructor

Matches constructor functions:

```typescript
type ClassConstructor<TInstance, TArgs extends Array<any> = Array<any>> =
  new (...args: TArgs) => TInstance;
```

Use in factory patterns or dependency injection.

### ArrayElement

Extracts the element type from an array:

```typescript
type ArrayElement<T> = T extends ReadonlyArray<infer U> ? U : never;
```

```typescript
type Item = ArrayElement<Array<{id: string}>>;  // {id: string}
```

### Defined and NotNull

Filter out `undefined` or `null`:

```typescript
type Defined<T> = T extends undefined ? never : T;
type NotNull<T> = T extends null ? never : T;
```

## Quick Reference

| Type              | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| `Flavored<T, N>`  | Loose nominal typing (no cast from base)        |
| `Branded<T, N>`   | Strict nominal typing (cast required)           |
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
