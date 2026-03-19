# Zod Schemas

Zod schema conventions for `@fuzdev` TypeScript/Svelte projects.

## Schema-First Design

Zod schemas are source of truth for JSON shape, TypeScript type (`z.infer`),
defaults, metadata, CLI help text, and serialization. Schema changes cascade
through the stack — treat them as critical review points.

- **`.meta({description})`** — introspectable metadata for CLI help and runtime
  reflection
- **Runtime-inspectable** — walkable (`zod_to_schema_properties`), exportable
  as JSON Schema (`z.toJSONSchema`)
- **JSON-native** — branded strings for timestamps (`Datetime`), IDs (`Uuid`),
  paths (`FilePath`) eliminate serialization friction
- **Composition cascades** — `.extend()` for hierarchies, `.brand()` for
  domain safety, `.default()` for partial construction

### Schemas as runtime data

| Capability | Module | What it does |
|---|---|---|
| Walk properties | `fuz_util/zod.ts` | `zod_to_schema_properties()` extracts names, types, defaults, descriptions, aliases |
| CLI help generation | `fuz_app/cli/help.ts` | `create_help()` reads schema properties for formatted help |
| Attack surface export | `fuz_app/http/schema_helpers.ts` | `schema_to_surface()` uses `z.toJSONSchema()` for snapshot-testable API surface |

### Cross-repo helper inventory

| Layer | Module | Key exports |
|---|---|---|
| Foundation | `@fuzdev/fuz_util/zod.ts` | `zod_to_schema_description`, `zod_to_schema_default`, `zod_to_schema_aliases`, `zod_to_schema_type_string`, `zod_to_schema_properties`, `zod_to_schema_names_with_aliases`, `zod_to_subschema`, `zod_unwrap_def`, `zod_get_base_type`, `zod_is_optional`, `zod_is_nullable`, `zod_has_default`, `zod_unwrap_to_object`, `zod_extract_fields` |
| Cell helpers | `@fuzdev/zzz/zod_helpers.ts` | `Uuid`, `Datetime`, `create_uuid`, `get_datetime_now`, `format_zod_validation_error`, `get_innermost_type`, `zod_get_schema_keys`, `get_field_schema` |
| CLI | `@fuzdev/fuz_app/cli/help.ts` | `create_help`, `format_arg_name` — schema-driven help text |

## Core Conventions

1. **`z.strictObject()`** — default for all object schemas. Rejects unknown
   keys. **Exception**: external data (`z.looseObject()` or `z.object()` with
   comment).
2. **PascalCase naming** — schema and inferred type share the same name.
3. **`.meta({description: '...'})`** — not `.describe()`. `.meta()` supports
   additional keys (`aliases`, `sensitivity`).
4. **`safeParse` at boundaries** — graceful errors for external input. `parse`
   for internal assertions.

### The Canonical Pattern

```typescript
import {z} from 'zod';

export const MyThing = z.strictObject({
	name: z.string().min(1),
	count: z.number().int().default(0),
	kind: z.enum(['a', 'b']),
});
export type MyThing = z.infer<typeof MyThing>;
```

The `const` and `type` share the same name — TypeScript resolves from context.

### Wrong Patterns

```typescript
// WRONG: z.object for internal types — allows unknown keys silently
const Foo = z.object({name: z.string()});

// OK: z.looseObject for external data — source adds fields without notice
// z.looseObject: parses external package.json (npm adds fields)
const PackageJson = z.looseObject({name: z.string(), version: z.string()});

// OK: z.object for external API responses — same reason
// z.object: parses external GitHub API responses
const GithubPullRequest = z.object({number: z.number(), title: z.string()});

// WRONG: .describe() — works but not the convention
const Bar = z.string().describe('a bar');

// WRONG: snake_case schema name or -Schema suffix
const my_thing = z.strictObject({...});
const MyThingSchema = z.strictObject({...});

// RIGHT
const Foo = z.strictObject({name: z.string()});
const Bar = z.string().meta({description: 'a bar'});
const MyThing = z.strictObject({...});
```

## Branded Types

Nominal typing for primitive schemas — a `Uuid` is not interchangeable with
`string` at the type level:

```typescript
// zzz/zod_helpers.ts — Zod 4 built-in validators + brand
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// zzz/diskfile_types.ts — refine + brand for domain validation
export const DiskfilePath = z
	.string()
	.refine((p) => is_path_absolute(p), {message: 'path must be absolute'})
	.brand('DiskfilePath');
export type DiskfilePath = z.infer<typeof DiskfilePath>;

// tx/types.ts — simple string + brand (generic syntax)
export const ResourceId = z.string().min(1).brand<'ResourceId'>();
export type ResourceId = z.infer<typeof ResourceId>;

export const FilePath = z.string().min(1).brand<'FilePath'>();
export type FilePath = z.infer<typeof FilePath>;
```

Use branded types for values that should not be accidentally swapped. For
TypeScript-only nominal typing without runtime validation, see `Flavored` in
./type-utilities.md.

## Defaults with Factories

```typescript
export const create_uuid = (): Uuid => crypto.randomUUID() as Uuid;
export const get_datetime_now = (): Datetime => new Date().toISOString() as Datetime;

export const UuidWithDefault = Uuid.default(create_uuid);
export type UuidWithDefault = z.infer<typeof UuidWithDefault>;

export const DatetimeNow = Datetime.default(get_datetime_now);
export type DatetimeNow = z.infer<typeof DatetimeNow>;
```

## Transform Pipelines

```typescript
// zzz/zod_helpers.ts
export const PathWithTrailingSlash = z.string().transform((v) => ensure_end(v, '/'));
export const PathWithoutTrailingSlash = z.string().transform((v) => strip_end(v, '/'));
export const PathWithLeadingSlash = z.string().transform((v) => ensure_start(v, '/'));
export const PathWithoutLeadingSlash = z.string().transform((v) => strip_start(v, '/'));
```

Transforms run at parse time — output type differs from input type.

Compose with `.pipe()` for multi-stage validation:

```typescript
// zzz/diskfile_types.ts — transform then brand
export const DiskfileDirectoryPath =
	PathWithTrailingSlash.pipe(DiskfilePath).brand('DiskfileDirectoryPath');
```

Use `z.input<typeof Schema>` for the pre-transform/pre-default type (form
inputs, config files):

```typescript
export type DiskfileJsonInput = z.input<typeof DiskfileJson>;
```

## Zod 4 Primitives

```typescript
z.uuid()              // UUID validation (used with .brand('Uuid'))
z.iso.datetime()      // ISO 8601 datetime (used with .brand('Datetime'))
z.email()             // email validation
z.url()               // URL validation
z.coerce.number()     // string-to-number coercion (env vars)
z.looseObject({...})  // accepts unknown keys (external data)
z.toJSONSchema(schema) // export schema as JSON Schema
```

## Discriminated Unions

`z.discriminatedUnion()` when a type field determines the shape:

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

For simple string enums:

```typescript
export const ActionKind = z.enum(['request_response', 'remote_notification', 'local_call']);
export type ActionKind = z.infer<typeof ActionKind>;
```

## Schema Extension

`.extend()` adds or overrides fields, preserving strict mode:

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

### Cell Schemas (zzz)

Every Cell class has a schema built with `CellJson.extend()`. Fields must have
`.default()` for Cell instantiation from partial JSON:

```typescript
export const ChatJson = CellJson.extend({
	name: z.string().default(''),
	thread_ids: z.array(Uuid).default(() => []),
	view_mode: z.enum(['simple', 'multi']).default('simple'),
	selected_thread_id: Uuid.nullable().default(null),
}).meta({cell_class_name: 'Chat'});
export type ChatJson = z.infer<typeof ChatJson>;
```

`.meta({cell_class_name})` connects the schema to its Cell class for the
registry (zzz-specific).

## Metadata

`.meta()` attaches introspectable metadata. `description` powers CLI help;
other keys are domain-specific:

```typescript
export const DeployArgs = z.strictObject({
	_: z.array(z.string()).max(0).default([]),
	dry: z.boolean().meta({description: 'preview without deploying'}).default(false),
	branch: z.string().meta({
		description: 'deploy branch',
		aliases: ['b'],
	}).default('deploy'),
});
```

Extracted by `fuz_util/zod.ts`:
- `zod_to_schema_description(schema)` — `.meta().description`
- `zod_to_schema_aliases(schema)` — `.meta().aliases`
- `zod_to_schema_default(schema)` — unwraps to find `.default()` value

### fuz_app Schema Metadata (`SchemaFieldMeta`)

`SchemaFieldMeta` (from `@fuzdev/fuz_app/schema_meta.js`):

```typescript
interface SchemaFieldMeta {
	description?: string;    // human-readable (env surface, docs)
	sensitivity?: string;    // 'secret' masks values in logs/surface
}
```

Usage in env schemas:

```typescript
DATABASE_URL: z.union([z.url(), z.literal('')]).optional()
	.meta({description: 'Database connection URL', sensitivity: 'secret'}),
ALLOWED_ORIGINS: z.string().min(1, 'ALLOWED_ORIGINS is required')
	.meta({description: 'Comma-separated origin patterns for API verification'}),
PORT: z.coerce.number().default(4040)
	.meta({description: 'HTTP server port'}),
```

- `env_schema_to_surface` reads `sensitivity` and `description` into `AppSurfaceEnv`
- `format_env_display_value` masks values where `sensitivity === 'secret'`
- `generate_valid_value` generates values from type heuristics via JSON Schema

## Validation at Boundaries

### safeParse for External Input

```typescript
// fuz_app/route_spec.ts — input validation middleware
const result = input_schema.safeParse(body);
if (!result.success) {
	return c.json({error: 'invalid_request_body', issues: result.error.issues}, 400);
}
c.set('validated_input', result.data);
```

### parse for Internal Assertions

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

`@fuzdev/fuz_util/zod.ts` — generic schema introspection for CLI help:

| Function | Purpose |
|----------|---------|
| `zod_to_schema_description(schema)` | Extract `.meta().description`, unwrapping wrappers |
| `zod_to_schema_default(schema)` | Extract `.default()` value |
| `zod_to_schema_aliases(schema)` | Extract `.meta().aliases` |
| `zod_to_schema_type_string(schema)` | Human-readable type string for display |
| `zod_to_schema_properties(schema)` | Extract all properties from an object schema |
| `zod_to_schema_names_with_aliases(schema)` | All property names + aliases as a `Set` |
| `zod_to_subschema(def)` | Unwrap one layer (optional, default, nullable, etc.) |
| `zod_unwrap_def(schema)` | Unwrap all wrappers to get the base type definition |
| `zod_get_base_type(schema)` | Get base type name (e.g., `'string'`, `'object'`, `'uuid'`) |
| `zod_is_optional(schema)` | Check if schema is optional at outermost level |
| `zod_is_nullable(schema)` | Check if schema accepts null at any wrapping level |
| `zod_has_default(schema)` | Check if schema has a default value |
| `zod_unwrap_to_object(schema)` | Unwrap to inner `ZodObject`, or `null` |
| `zod_extract_fields(schema)` | Extract `ZodFieldInfo[]` from an object schema |

## Route Spec Schemas

`fuz_app` route specs declare input/output schemas:

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

- `z.null()` for routes with no request body
- `z.strictObject()` for inputs — rejects unknown keys
- `z.looseObject()` for outputs with variable extra fields
- Input validated by auto-generated middleware (`safeParse`)
- Output validated in DEV only (console warning on mismatch)

### JSON Schema Export

```typescript
const json_schema = z.toJSONSchema(schema);
```

Used by `schema_to_surface()` in `fuz_app/http/schema_helpers.ts`.

## Quick Reference

| Convention | Correct | Wrong |
|-----------|---------|-------|
| Object schemas (internal) | `z.strictObject({...})` | `z.object({...})` |
| Object schemas (external data) | `z.looseObject({...})` or `z.object({...})` with comment | `z.strictObject({...})` |
| Descriptions | `.meta({description: '...'})` | `.describe('...')` |
| Schema naming | `const MyThing = z.strictObject(...)` | `const my_thing`, `const MyThingSchema` |
| Type inference | `type MyThing = z.infer<typeof MyThing>` | separate name from schema |
| IDs and paths | `z.string().brand('MyId')` | plain `z.string()` |
| External input | `schema.safeParse(data)` | `schema.parse(data)` at boundaries |
