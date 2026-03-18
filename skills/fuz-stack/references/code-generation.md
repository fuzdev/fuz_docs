# Code Generation

Guide to Gro's code generation system (`.gen.*` files) in `@fuzdev/gro`.

Gen files produce source code at build time. They are discovered by the `.gen.`
pattern in filenames, executed by `gro gen`, and their output is committed
alongside the source. Use `gro gen --check` to verify generated files haven't
drifted.

## Contents

- [File Naming](#file-naming)
- [Gen Types](#gen-types)
- [Return Values](#return-values)
- [Dependencies](#dependencies)
- [Common Patterns](#common-patterns)
- [Quick Reference](#quick-reference)

## File Naming

Gen files use `.gen.` in the filename. The output file is produced by dropping
the `.gen.` segment:

| Gen file               | Output file       |
| ---------------------- | ----------------- |
| `library.gen.ts`       | `library.ts`      |
| `fuz.gen.css.ts`       | `fuz.css`         |
| `package.gen.ts`       | `package.ts`      |

The gen file always has a `.ts` (or `.js`) extension for execution. An optional
extension before `.ts` overrides the output extension.

### Naming rules

- Exactly one `.gen.` segment per filename (duplicates are invalid)
- At most one additional extension after `.gen.` (e.g., `.gen.css.ts` is valid,
  `.gen.foo.bar.ts` is not)
- Output filename cannot equal the gen filename

## Gen Types

A gen file exports a `gen` value that is either a function or a config object:

```typescript
type Gen = GenFunction | GenConfig;
```

### GenFunction (simple form)

```typescript
type GenFunction = (ctx: GenContext) => RawGenResult | Promise<RawGenResult>;
```

The gen function receives a `GenContext` with `log` (scoped logger),
`origin_id` (absolute path of the gen file), and `origin_path` (relative path
from project root).

```typescript
// library.gen.ts — simple form
import type {Gen} from '@fuzdev/gro/gen.js';

export const gen: Gen = async (ctx) => {
  return `// Generated at ${new Date().toISOString()}\nexport const version = '1.0.0';\n`;
};
```

### GenConfig (with dependencies)

```typescript
interface GenConfig {
  generate: GenFunction;
  dependencies?: GenDependencies;
}
```

```typescript
// library.gen.ts — config form with dependencies
import type {Gen} from '@fuzdev/gro/gen.js';

export const gen: Gen = {
  generate: async (ctx) => {
    return `export const name = '${ctx.origin_path}';\n`;
  },
  dependencies: {patterns: [/\.svelte$/]},
};
```

## Return Values

`RawGenResult` supports several forms:

```typescript
type RawGenResult = string | RawGenFile | null | Array<RawGenResult>;
```

### String — single file with default name

```typescript
export const gen: Gen = async () => {
  return '// generated content\n';
};
// library.gen.ts → writes library.ts
```

### RawGenFile — single file with options

```typescript
interface RawGenFile {
  content: string;
  filename?: string;  // override output name (can be relative path)
  format?: boolean;   // run Prettier (default: true)
}
```

```typescript
export const gen: Gen = async () => {
  return {content: '{"key": "value"}', filename: 'data.json', format: false};
};
```

### null — skip generation

```typescript
export const gen: Gen = async (ctx) => {
  if (some_condition) return null; // produce no output
  return 'content';
};
```

### Array — multiple output files

Nested arrays are flattened:

```typescript
export const gen: Gen = async () => {
  return [
    {content: 'export const A = 1;', filename: 'a.ts'},
    {content: 'export const B = 2;', filename: 'b.ts'},
  ];
};
```

Duplicate output file IDs within a single gen file are invalid.

## Dependencies

Control when a gen file re-runs during watch mode. Use the `GenConfig` form
and set `dependencies`:

### 'all' — re-run on any change

```typescript
export const gen: Gen = {
  generate: async (ctx) => { /* ... */ },
  dependencies: 'all',
};
```

### Config — patterns and files

```typescript
export const gen: Gen = {
  generate: async (ctx) => { /* ... */ },
  dependencies: {
    patterns: [/\.svelte$/, /\.ts$/],
    files: ['/absolute/path/to/config.json'],
  },
};
```

## Common Patterns

### CSS generation

Every project has a `fuz.gen.css.ts`:

```typescript
import {gen_fuz_css} from '@fuzdev/fuz_css/gen_fuz_css.js';

export const gen = gen_fuz_css();
```

Generates the bundled `fuz.css` with tree-shaking.

### Library metadata

Projects use `library.gen.ts` for API documentation:

```typescript
import {library_gen} from '@fuzdev/fuz_ui/library_gen.js';
import {throwOnDuplicates} from '@fuzdev/svelte-docinfo/analyze.js';

export const gen = library_gen({on_duplicates: throwOnDuplicates});
```

Generates `library.ts` with module listings, type signatures, and JSDoc content.

## Quick Reference

| Export        | Type      | Purpose                                  |
| ------------- | --------- | ---------------------------------------- |
| `Gen`         | Type      | GenFunction or GenConfig                 |
| `GenFunction` | Type      | `(ctx: GenContext) => RawGenResult`      |
| `GenConfig`   | Interface | generate + optional dependencies         |
| `RawGenResult`| Type      | string, RawGenFile, null, or nested array|
| `RawGenFile`  | Interface | Output file with content, filename, format|
