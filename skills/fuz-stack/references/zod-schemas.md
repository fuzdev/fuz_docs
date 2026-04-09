# Zod Schemas

Zod schema conventions for `@fuzdev` TypeScript/Svelte projects.

## Schema-First Design

Zod schemas are source of truth for JSON shape, TypeScript type (`z.infer`),
defaults, metadata, CLI help text, and serialization.

- **`.meta({description})`** — introspectable metadata for CLI help and runtime
  reflection
- **Runtime-inspectable** — walkable (`zod_to_schema_properties`), exportable
  as JSON Schema (`z.toJSONSchema`)
- **JSON-native** — branded strings for timestamps (`Datetime`), IDs (`Uuid`),
  paths (`FilePath`) eliminate serialization friction
- **Composition cascades** — `.extend()` for hierarchies, `.brand()` for
  domain safety, `.default()` for partial construction

### Schema helpers by layer

| Layer | Module | Capabilities |
|---|---|---|
| Foundation | `@fuzdev/fuz_util/zod.ts` | Schema introspection — extract descriptions, defaults, aliases, types, properties; unwrap wrappers; check optional/nullable/default; format values for display |
| Cell helpers | `@fuzdev/zzz/zod_helpers.ts` | `Uuid`, `Datetime` branded types and factories; schema unwrapping; field extraction; validation error formatting |
| CLI | `@fuzdev/fuz_app/cli/args.ts`, `help.ts` | Schema-validated CLI arg parsing; schema-driven help text generation |
| HTTP | `@fuzdev/fuz_app/http/schema_helpers.ts` | `schema_to_surface()` exports JSON Schema via `z.toJSONSchema()` for snapshot-testable API surfaces |
| Testing | `@fuzdev/fuz_app/testing/schema_generators.ts` | Schema-driven test data generation — valid bodies, adversarial inputs |

## Core Conventions

1. **`z.strictObject()`** — default for all object schemas, including inside
   `z.discriminatedUnion()` and `z.union()`. Rejects unknown keys.
   **Exception**: external data (`z.looseObject()` or `z.object()` with
   comment explaining why).
2. **PascalCase naming** — schema and inferred type share the same name.
3. **`.meta({description: '...'})`** — not `.describe()`. `.meta()` supports
   additional keys (`aliases`, `sensitivity`).
4. **`safeParse` at boundaries** — graceful errors for external input (HTTP
   requests, API responses). `parse` for internal assertions, config loading,
   CLI args, and factory functions where failure is fatal.

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

// WRONG: z.object inside discriminated union — same rule applies
const Action = z.discriminatedUnion('type', [
	z.object({type: z.literal('a'), value: z.string()}),
]);

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

// RIGHT: strictObject inside discriminated union
const Action = z.discriminatedUnion('type', [
	z.strictObject({type: z.literal('a'), value: z.string()}),
]);
```

## Input vs Output Types

Schemas with `.default()` or `.transform()` have different input and output
types. `z.infer<>` gives the output (post-parse) type. `z.input<>` gives the
pre-parse type — what callers provide before defaults are applied.

This is a **systematic pattern** in zzz and tx:

```typescript
// zzz — every Cell schema exports both types
export const ChatJson = CellJson.extend({
	name: z.string().default(''),
	thread_ids: z.array(Uuid).default(() => []),
	selected_thread_id: Uuid.nullable().default(null),
}).meta({cell_class_name: 'Chat'});
export type ChatJson = z.infer<typeof ChatJson>;       // all fields present
export type ChatJsonInput = z.input<typeof ChatJson>;   // defaults omittable

// tx — every resource schema exports an input type
export const PackageResource = ResourceBase.extend({
	type: z.literal('package'),
	from: PackageMapping,
	check: z.string().optional(),
});
export type PackageResource = z.infer<typeof PackageResource>;
export type PackageResourceInput = z.input<typeof PackageResource>;
```

Use `z.input<>` for:
- Constructor/factory parameters (Cell instantiation, resource builders)
- Config file shapes (before defaults are applied)
- Form inputs and partial data from storage

Use `z.infer<>` (the default) for:
- Runtime data after parsing
- Function return types
- Validated state

### Factory Functions with Input Types

tx uses a systematic factory pattern — accept `z.input<>` without the
discriminant field, parse to get the validated output:

```typescript
// tx/resources/types.ts
export const package_resource = (
	config: Omit<PackageResourceInput, 'type'>,
): PackageResource => {
	return PackageResource.parse({type: 'package', ...config});
};

// usage — type-safe, defaults applied, discriminant injected
const pkg = package_resource({id: 'nginx', name: 'nginx', from: {apt: 'nginx'}});
```

This works because `parse` applies defaults and validates, while `Omit<Input, 'type'>`
lets callers skip the discriminant.

## Branded Types

Nominal typing for primitives — a `Uuid` is not interchangeable with `string`
at the type level:

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

Use branded types for values that should not be accidentally swapped.
Dynamic defaults use factory functions (`Uuid.default(create_uuid)`,
`Datetime.default(get_datetime_now)`). For TypeScript-only nominal typing
without runtime validation, see `Flavored` in ./type-utilities.md.

## Defaults and Optionality

```typescript
// .default() — static or factory
count: z.number().int().default(0),
thread_ids: z.array(Uuid).default(() => []),         // factory for mutable defaults
auth: DatabaseAuth.default({method: 'trust', hosts: ['127.0.0.1/32']}),

// .optional() — field can be omitted (undefined). For request fields callers may skip.
port: z.number().optional(),

// .nullable() — field is present but can be null. For database columns and
// explicit "no value" semantics.
email: Email.nullable(),
expires_at: z.string().nullable(),

// .nullable().default(null) — present, nullable, defaults to null if omitted.
// Common for Cell fields that are optional references.
selected_thread_id: Uuid.nullable().default(null),

// .nullish() — null | undefined. For flexible inputs that accept either.
// Use sparingly — prefer .optional() or .nullable() for clarity.
email: Email.nullish(),  // fuz_app invite creation

// .catch(fallback) — use fallback if present value fails validation.
// Different from .default() (missing field). For graceful degradation of
// stored data that may have been written by an older schema version.
before: PackageCurrent.nullable().catch(null),  // tx change schemas
```

## Transform Pipelines

```typescript
// zzz/zod_helpers.ts
export const PathWithTrailingSlash = z.string().transform((v) => ensure_end(v, '/'));
export const PathWithoutTrailingSlash = z.string().transform((v) => strip_end(v, '/'));
```

Transforms run at parse time — output type differs from input type.

Compose with `.pipe()` for multi-stage validation:

```typescript
// zzz/diskfile_types.ts — transform then brand
export const DiskfileDirectoryPath =
	PathWithTrailingSlash.pipe(DiskfilePath).brand('DiskfileDirectoryPath');
```

## Zod 4 Primitives

```typescript
z.uuid()               // UUID validation (used with .brand('Uuid'))
z.iso.datetime()       // ISO 8601 datetime (used with .brand('Datetime'))
z.email()              // email validation
z.url()                // URL validation
z.coerce.number()      // string-to-number coercion (env vars)
z.looseObject({...})   // accepts unknown keys (external data)
z.toJSONSchema(schema) // export schema as JSON Schema
z.prettifyError(error) // format ZodError for display (CLI args)
z.instanceof(MyClass)  // runtime class instance check (Cell class schemas in zzz)
z.void()               // no value — action specs with no input/output
z.record(K, V)         // key-value maps (env vars, resource maps)
z.custom<T>(check?)    // escape hatch for complex types without full Zod validation
```

- `z.void()` / `z.void().optional()` — action specs with no input or output
- `z.custom<T>(check?)` — embeds complex types without full Zod validation;
  use sparingly (e.g., `z.custom<Plan>()` in tx, `z.custom<z.ZodType>(...)` in
  fuz_app action specs)
- `z.instanceof(MyClass)` — runtime class instance check; used in zzz so
  action specs can reference Cell instances as typed values

## Unions and Enums

### Discriminated Unions

`z.discriminatedUnion()` when a type field determines the shape. Members use
`z.strictObject()`:

```typescript
// tx/resources/types.ts — 16 resource types
export const Resource = z.discriminatedUnion('type', [
	PackageResource,
	FileResource,
	DirectoryResource,
	// ...
]);
export type Resource = z.infer<typeof Resource>;

// inline members also use strictObject
export const FileContent = z.discriminatedUnion('type', [
	z.strictObject({type: z.literal('inline'), content: z.string()}),
	z.strictObject({type: z.literal('template'), template: z.string(), vars: TemplateVars.optional()}),
	z.strictObject({type: z.literal('source'), path: z.string()}),
]);
```

### Plain Unions

`z.union()` when there's no single discriminant field, or when mixing shapes
with literals:

```typescript
// zzz/jsonrpc.ts — multiple message shapes
export const JsonrpcMessage = z.union([
	JsonrpcRequest, JsonrpcNotification, JsonrpcResponse, JsonrpcErrorMessage,
]);

// fuz_app/actions/action_spec.ts — mixed literal + object
export const ActionAuth = z.union([
	z.literal('public'),
	z.literal('authenticated'),
	z.strictObject({role: z.string()}),
]);

// tx/resources/types.ts — union with literal false for opt-out
sudo: z.union([z.enum(['nopasswd', 'password']), z.literal(false)]).optional(),
```

Prefer `z.discriminatedUnion()` when possible — it gives better error messages.

### Enums

```typescript
export const ActionKind = z.enum(['request_response', 'remote_notification', 'local_call']);
export type ActionKind = z.infer<typeof ActionKind>;
```

For extensible enums, use a factory:

```typescript
// fuz_app/auth/role_schema.ts — dynamic enum from builtin + app-defined roles
export const create_role_schema = (app_roles: Array<string>) => {
	const all_roles = [...BUILTIN_ROLES, ...app_roles];
	const Role = z.enum(all_roles as [string, ...Array<string>]);
	return {Role, role_options: new Map(/* ... */)};
};
```

## Schema Extension

`.extend()` adds or overrides fields, preserving strict mode:

```typescript
// fuz_app/actions/action_spec.ts
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

Every Cell class has a schema built with `CellJson.extend()` (see `ChatJson`
example in Input vs Output Types above). Cell schema conventions:

- All fields must have `.default()` for Cell instantiation from partial JSON
- `.meta({cell_class_name})` connects the schema to its Cell class for the
  registry
- Every Cell exports both `FooJson` (output, fully validated) and
  `FooJsonInput` (input, defaults omittable for constructors and `set_json()`)
- The Cell base class is generic over the schema:
  `abstract class Cell<TSchema extends z.ZodType>` — validates internally
  with `this.schema.parse()`

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

### Sensitivity Metadata (fuz_app)

`SchemaFieldMeta` (from `@fuzdev/fuz_app/schema_meta.js`) extends `.meta()`
with a `sensitivity` key:

```typescript
DATABASE_URL: z.string().min(1).meta({
	description: 'Database URL (postgres://, file://, or memory://)',
	sensitivity: 'secret',
}),
PORT: z.coerce.number().default(4040)
	.meta({description: 'HTTP server port'}),
```

`sensitivity: 'secret'` masks values in logs and API surface snapshots.

## Validation at Boundaries

### safeParse for External Input

Use `safeParse` when invalid data is a normal condition and you need to
respond gracefully:

```typescript
// fuz_app/http/route_spec.ts — input validation middleware
const result = input_schema.safeParse(body);
if (!result.success) {
	return c.json({error: ERROR_INVALID_REQUEST_BODY, issues: result.error.issues}, 400);
}
c.set('validated_input', result.data);

// zzz/ollama.svelte.ts — external API responses
const parsed = OllamaListResponse.safeParse(response);
```

Route specs declare input/output schemas for auto-generated validation
middleware. Input validated via `safeParse`; output validated in DEV only.

### parse for Fail-Fast Contexts

Use `parse` when invalid data means a bug or fatal misconfiguration:

```typescript
RoleName.parse(name);                                    // internal assertion
return TxOptions.parse(raw);                             // config loading
const args = RunApplyArgs.parse(raw_args);               // CLI args
return PackageResource.parse({type: 'package', ...config}); // factory function
const parsed = this.schema.parse(v);                     // Cell field update
```

### Formatting Errors

```typescript
// Zod 4 built-in — multi-line, human-readable (CLI args, error display)
return {success: false, error: z.prettifyError(parsed.error)};

// zzz/zod_helpers.ts — single-line, compact (inline error messages)
export const format_zod_validation_error = (error: z.ZodError): string =>
	error.issues
		.map((i) => {
			const path = i.path.length > 0 ? `${i.path.join('.')}: ` : '';
			return `${path}${i.message}`;
		})
		.join(', ');
```

## Quick Reference

| Convention | Correct | Wrong |
|-----------|---------|-------|
| Object schemas (internal) | `z.strictObject({...})` | `z.object({...})` |
| Object schemas (external data) | `z.looseObject({...})` or `z.object({...})` with comment | `z.strictObject({...})` |
| Discriminated union members | `z.strictObject({type: z.literal('a'), ...})` | `z.object({type: z.literal('a'), ...})` |
| Descriptions | `.meta({description: '...'})` | `.describe('...')` |
| Schema naming | `const MyThing = z.strictObject(...)` | `const my_thing`, `const MyThingSchema` |
| Type inference (output) | `type MyThing = z.infer<typeof MyThing>` | separate name from schema |
| Type inference (input) | `type MyThingInput = z.input<typeof MyThing>` | manual partial types |
| IDs and paths | `z.string().brand('MyId')` | plain `z.string()` |
| HTTP/API input | `schema.safeParse(data)` | `schema.parse(data)` |
| Config/CLI/factories | `schema.parse(data)` | `schema.safeParse(data)` with unnecessary error handling |
| No input/output | `z.void()` or `z.void().optional()` | `z.undefined()`, omitting the field |
| Optional reference | `Uuid.nullable().default(null)` | `Uuid.optional()` (ambiguous undefined vs absent) |
| Complex embedded types | `z.custom<MyType>()` | hand-rolled validation |
| Key-value maps | `z.record(z.string(), ValueSchema)` | `z.strictObject` with dynamic keys |
