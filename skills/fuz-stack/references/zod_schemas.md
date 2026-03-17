# Zod Schemas

Zod schema conventions across grimoire-tracked `@fuzdev` repos. These
conventions apply to all repos in `gitops.config.ts` — the TypeScript/Svelte
projects maintained through the grimoire.

## Schema-First Design

### Why schemas are the center

- **Single source of truth** — a Zod schema defines JSON shape, TypeScript type
  (`z.infer`), defaults, metadata, CLI help text, and serialization — all from
  one definition. Change the schema, everything updates.
- **High-signal review points** — schema changes cascade through validation,
  types, CLI, UI, and serialization. Both humans and agents should treat schema
  definitions with extra scrutiny — they are the most impactful lines in any
  module.
- **Self-documenting via `.meta()`** — `.meta({description, aliases})` attaches
  introspectable metadata that powers CLI help generation and runtime
  reflection. The schema describes itself.
- **Schemas are data, not just types** — walkable at runtime
  (`zod_to_schema_properties`), exportable as JSON Schema
  (`z.toJSONSchema`), registerable for bidirectional lookup
  (`SchemaRegistry`). This makes them programmatically leverageable in ways
  that TypeScript types alone cannot be.
- **JSON-native by design** — the ecosystem uses branded strings for
  timestamps (`Datetime`), IDs (`Uuid`), and paths (`FilePath`) rather than
  rich objects (`Date`, `URL`). This eliminates serialization friction —
  schemas describe what's actually stored and transmitted, not a mapping
  between representations. Bidirectional codecs (`z.codec()`) become relevant
  only at boundaries like database drivers where representation genuinely
  differs.
- **Composition details cascade** — `.extend()` for schema hierarchies,
  `.brand()` for domain safety, `.default()` for construction from partial data.
  Get the schema details right and strict; downstream code inherits that
  precision.

### Schemas as runtime data

Schemas are not erased at runtime — they remain inspectable, crawlable data
structures. The ecosystem leverages this across several layers:

| Capability | Module | What it does |
|---|---|---|
| Walk properties | `fuz_util/zod.ts` | `zod_to_schema_properties()` extracts names, types, defaults, descriptions, aliases from any object schema |
| CLI help generation | `fuz_app/cli/help.ts` | `create_help()` reads schema properties to generate formatted help text dynamically |
| Attack surface export | `fuz_app/endpoints/route_spec.ts` | `z.toJSONSchema()` for snapshot-testable API surface docs |

### Cross-repo helper inventory

Schema introspection is layered across packages:

| Layer | Module | Key exports |
|---|---|---|
| Foundation | `@fuzdev/fuz_util/zod.ts` | `zod_to_schema_description`, `zod_to_schema_default`, `zod_to_schema_aliases`, `zod_to_schema_type_string`, `zod_to_schema_properties`, `zod_to_schema_names_with_aliases`, `zod_to_subschema` |
| CLI | `fuz_app/cli/help.ts` | `create_help`, `format_arg_name` — schema-driven help text |

## Core Conventions

Four rules:

1. **`z.strictObject()`** — default for all object schemas. Rejects unknown
   keys at parse time, catching typos and stale fields early. **Exception**:
   schemas parsing external/third-party data (e.g., GitHub API responses) where
   the source may add fields — use `z.object()` with a comment explaining why.
2. **PascalCase naming** — schema and inferred type share the same name.
3. **`.meta({description: '...'})`** — not `.describe()`. Both work identically
   in Zod 4 (`.describe()` calls `.meta()` internally), but `.meta()` is the
   ecosystem convention and supports additional keys beyond `description`.
4. **`safeParse` at I/O boundaries** — graceful structured errors for
   external input. `parse` only for internal assertions that should throw.

### The Canonical Pattern

Every schema follows this shape:

```typescript
import {z} from 'zod';

export const MyThing = z.strictObject({
	name: z.string().min(1),
	count: z.number().int().default(0),
	kind: z.enum(['a', 'b']),
});
export type MyThing = z.infer<typeof MyThing>;
```

The `const` and `type` share the same name. TypeScript resolves which is meant
from context (value position vs type position). This is idiomatic across the
ecosystem — `ActionSpec`, `RouteSpec`, `TxConfig`, `PackageJson`, `Uuid`.

### Wrong Patterns

```typescript
// WRONG: z.object for internal types — allows unknown keys to pass silently
const Foo = z.object({name: z.string()});

// OK: z.object for external API responses — source adds fields without notice
// z.object: parses external GitHub API responses
const GithubPullRequest = z.object({number: z.number(), title: z.string()});

// WRONG: .describe() — works but not the ecosystem convention
const Bar = z.string().describe('a bar');

// WRONG: constructor description — not introspectable
const Baz = z.string({description: 'a baz'});

// WRONG: snake_case schema name or -Schema suffix
const my_thing = z.strictObject({...});
const MyThingSchema = z.strictObject({...});

// RIGHT
const Foo = z.strictObject({name: z.string()});
const Bar = z.string().meta({description: 'a bar'});
const MyThing = z.strictObject({...});
```

## Branded Types

Branded types add nominal typing to primitive schemas — a `Uuid` is not
interchangeable with a plain `string` at the type level, even though both are
strings at runtime.

```typescript
// zzz/zod_helpers.ts
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// domain-specific branded types
export const ResourceId = z.string().min(1).brand<'ResourceId'>();
export type ResourceId = z.infer<typeof ResourceId>;

export const FilePath = z.string().min(1).brand<'FilePath'>();
export type FilePath = z.infer<typeof FilePath>;

export const ShellCommand = z.string().min(1).brand<'ShellCommand'>();
export type ShellCommand = z.infer<typeof ShellCommand>;
```

Use branded types for values that should not be accidentally swapped — IDs,
paths, commands, timestamps. For TypeScript-only nominal typing without runtime
validation, see `Flavored` and `Branded` in `references/type_utilities.md`.

## Defaults with Factories

Schemas can provide dynamic defaults via factory functions:

```typescript
export const create_uuid = (): Uuid => crypto.randomUUID() as Uuid;
export const get_datetime_now = (): Datetime => new Date().toISOString() as Datetime;

export const UuidWithDefault = Uuid.default(create_uuid);
export type UuidWithDefault = z.infer<typeof UuidWithDefault>;

export const DatetimeNow = Datetime.default(get_datetime_now);
export type DatetimeNow = z.infer<typeof DatetimeNow>;
```

## Transform Pipelines

Transform schemas that normalize values on parse:

```typescript
// zzz/zod_helpers.ts
export const PathWithTrailingSlash = z.string().transform((v) => ensure_end(v, '/'));
export const PathWithoutTrailingSlash = z.string().transform((v) => strip_end(v, '/'));
export const PathWithLeadingSlash = z.string().transform((v) => ensure_start(v, '/'));
export const PathWithoutLeadingSlash = z.string().transform((v) => strip_start(v, '/'));
```

Transforms run at parse time — the output type differs from the input type.

## Discriminated Unions

Use `z.discriminatedUnion()` when a type field determines the shape:

```typescript
// setup/schemas.ts
export const InstallStrategy = z.discriminatedUnion('type', [
	AptStrategy,
	AptRepoStrategy,
	CurlScriptStrategy,
	CustomStrategy,
]);
export type InstallStrategy = z.infer<typeof InstallStrategy>;
```

For simple string enums, use `z.enum()`:

```typescript
export const ActionKind = z.enum(['request_response', 'remote_notification', 'local_call']);
export type ActionKind = z.infer<typeof ActionKind>;
```

## Schema Extension

Extend existing schemas with `.extend()` to add or override fields:

```typescript
// fuz_app/action_spec.ts
export const ActionSpec = z.strictObject({
	method: z.string(),
	kind: ActionKind,
	input: z.custom<z.ZodType>((v) => v instanceof z.ZodType),
	output: z.custom<z.ZodType>((v) => v instanceof z.ZodType),
	// ...
});

export const RequestResponseActionSpec = ActionSpec.extend({
	kind: z.literal('request_response').default('request_response'),
	auth: ActionAuth,
	async: z.literal(true).default(true),
});
```

`.extend()` preserves strict mode from the parent schema.

## Metadata

`.meta()` attaches introspectable metadata to schemas. The `description` key
powers CLI help generation; other keys are domain-specific:

```typescript
// CLI argument descriptions and aliases
export const DeployArgs = z.strictObject({
	_: z.array(z.string()).max(0).default([]),
	dry: z.boolean().meta({description: 'preview without deploying'}).default(false),
	branch: z.string().meta({
		description: 'deploy branch',
		aliases: ['b'],
	}).default('deploy'),
});

```

Metadata is extracted by `fuz_util/zod.ts`:
- `zod_to_schema_description(schema)` — `.meta().description`
- `zod_to_schema_aliases(schema)` — `.meta().aliases`
- `zod_to_schema_default(schema)` — unwraps to find `.default()` value

### fuz_app Schema Metadata (`SchemaFieldMeta`)

`SchemaFieldMeta` (from `@fuzdev/fuz_app/schema_meta.js`) defines the `.meta()`
shape used across fuz_app env schemas and auth input schemas:

```typescript
interface SchemaFieldMeta {
	description?: string;    // human-readable (env surface, docs)
	sensitivity?: string;    // 'secret' masks values in logs/surface
	example?: unknown;       // valid example for test generation
}
```

Usage in env schemas:

```typescript
DATABASE_URL: z.string().optional()
	.meta({description: 'Database connection URL', sensitivity: 'secret'}),
ALLOWED_ORIGINS: z.string()
	.meta({description: 'Comma-separated origin patterns', example: 'https://example.com'}),
```

Usage in auth input schemas:

```typescript
password: z.string().min(1).max(MAX_PASSWORD_LENGTH)
	.meta({sensitivity: 'secret', example: 'hunter2pass'}),
```

- `env_schema_to_surface` reads `sensitivity` and `description` into `AppSurfaceEnv` entries
- `generate_valid_value` (test helpers) checks `example` before falling back to type heuristics
- `format_env_display_value` masks values where `sensitivity === 'secret'`

## Validation at Boundaries

### safeParse for External Input

At API boundaries (routes, CLI args, config files), use `safeParse` for
structured error responses:

```typescript
// fuz_app/route_spec.ts — input validation middleware
const result = input_schema.safeParse(body);
if (!result.success) {
	return c.json({error: 'invalid_request_body', issues: result.error.issues}, 400);
}
c.set('validated_input', result.data);
```

### parse for Internal Assertions

Inside trusted code where invalid data means a bug, `parse` is appropriate —
it throws on failure:

```typescript
RoleName.parse(name); // throws if name doesn't match the regex
```

### Formatting Errors

```typescript
// zzz/zod_helpers.ts
export const format_zod_validation_error = (error: z.ZodError): string =>
	error.issues
		.map((i) => {
			const path = i.path.length > 0 ? `${i.path.join('.')}: ` : '';
			return `${path}${i.message}`;
		})
		.join(', ');
```

## Schema Introspection

`@fuzdev/fuz_util/zod.ts` provides generic schema introspection, primarily for
CLI help generation:

| Function | Purpose |
|----------|---------|
| `zod_to_schema_description(schema)` | Extract `.meta().description`, unwrapping wrappers |
| `zod_to_schema_default(schema)` | Extract `.default()` value |
| `zod_to_schema_aliases(schema)` | Extract `.meta().aliases` |
| `zod_to_schema_type_string(schema)` | Human-readable type string for display |
| `zod_to_schema_properties(schema)` | Extract all properties from an object schema |
| `zod_to_schema_names_with_aliases(schema)` | All property names + aliases as a `Set` |
| `zod_to_subschema(def)` | Unwrap one layer (optional, default, nullable, etc.) |

## Route Spec Schemas

`fuz_app` route specs declare input/output schemas for request validation:

```typescript
const My_Input = z.strictObject({name: z.string().min(1)});
const My_Output = z.strictObject({ok: z.literal(true), id: z.string()});

const my_route: RouteSpec = {
	method: 'POST',
	path: '/things',
	input: My_Input,
	output: My_Output,
	// ...
};
```

- `z.null()` for routes with no request body (GET, or POST with no input)
- `z.strictObject()` for inputs — rejects unknown keys
- `z.looseObject()` for outputs with variable extra fields (accepts unknown
  keys but validates known ones — distinct from `z.record()` which validates
  all values against a single schema)
- Input validated by auto-generated middleware (`safeParse`)
- Output validated in DEV only (console warning on mismatch)

### JSON Schema Export

For attack surface snapshots and documentation:

```typescript
const json_schema = z.toJSONSchema(schema);
```

Used by `schema_to_surface()` in `fuz_app/route_spec.ts`.

## Quick Reference

| Convention | Correct | Wrong |
|-----------|---------|-------|
| Object schemas (internal) | `z.strictObject({...})` | `z.object({...})` |
| Object schemas (external data) | `z.object({...})` with comment | `z.strictObject({...})` |
| Descriptions | `.meta({description: '...'})` | `.describe('...')` |
| Schema naming | `const MyThing = z.strictObject(...)` | `const my_thing`, `const MyThingSchema` |
| Type inference | `type MyThing = z.infer<typeof MyThing>` | separate name from schema |
| IDs and paths | `z.string().brand('MyId')` | plain `z.string()` |
| External input | `schema.safeParse(data)` | `schema.parse(data)` at boundaries |
