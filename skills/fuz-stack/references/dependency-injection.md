# Dependency Injection

Typed interfaces for side effects, real implementations as defaults, accepted
as parameters, tested with plain object mocks. No `vi.mock` — dependencies
flow through function signatures.

## Convention

**Small standalone `*Deps` interfaces, composed bottom-up.** Replaces
`Pick<GodType>` narrowing.

### Bottom-up composition

Define small focused interfaces. Leaf functions import them directly. App-level
composites assemble them for wiring — the entry point builds the composite
and threads it down, but leaf functions never take the composite as a param.

```typescript
// Small standalone interfaces in fuz_app/runtime/deps.ts
export interface EnvDeps {
	env_get: (name: string) => string | undefined;
	env_set: (name: string, value: string) => void;
}

export interface FsReadDeps {
	stat: (path: string) => Promise<StatResult | null>;
	read_text_file: (path: string) => Promise<string>;
	read_file: (path: string) => Promise<Uint8Array>;
}

export interface FsWriteDeps {
	mkdir: (path: string, options?: {recursive?: boolean}) => Promise<void>;
	write_text_file: (path: string, content: string) => Promise<void>;
	write_file: (path: string, data: Uint8Array) => Promise<void>;
	rename: (old_path: string, new_path: string) => Promise<void>;
}

export interface CommandDeps {
	run_command: (cmd: string, args: Array<string>) => Promise<CommandResult>;
}

// Functions declare exactly what they need via intersection
export const generate_random_key = async (deps: CommandDeps): Promise<string> => {
	/* ... */
};
export const setup_env_file = async (
	deps: FsReadDeps & FsWriteDeps & CommandDeps,
	env_path: string,
	example_path: string,
): Promise<void> => {
	/* ... */
};

// App-level composite — flat intersection for the wiring layer
export interface RuntimeDeps
	extends EnvDeps, FsReadDeps, FsWriteDeps, FsRemoveDeps,
		CommandDeps, TerminalDeps, ProcessDeps, LogDeps {
	env_all: () => Record<string, string>;
	readonly args: ReadonlyArray<string>;
	cwd: () => string;
	run_command_inherit: (cmd: string, args: Array<string>) => Promise<number>;
}
```

### Why standalone interfaces beat Pick<GodType>

`Pick<AppRuntime, 'env_get'>` forces every consumer to import the god type.
Small standalone interfaces avoid this:

- **Shareable**: `EnvDeps` lives in fuz_app, imported by any project
- **Trivial mocks**: `{env_get: () => 'value', env_set: () => {}}` — no factory needed
- **Composable**: `FsReadDeps & CommandDeps` for multi-dep functions
- **Self-documenting**: the interface IS the dependency contract

### Where shared interfaces live

- **fuz_app `auth/deps.ts`**: `AppDeps` (server capabilities), `RouteFactoryDeps` (`Omit<AppDeps, 'db'>`)
- **fuz_app `auth/password.ts`**: `PasswordHashDeps` (hash, verify, verify_dummy)
- **fuz_app `runtime/deps.ts`**: `EnvDeps`, `FsReadDeps`, `FsWriteDeps`, `FsRemoveDeps`,
  `CommandDeps`, `LogDeps`, `TerminalDeps`, `ProcessDeps`, `RuntimeDeps` (full bundle)
- **fuz_app `db/query_deps.ts`**: `QueryDeps` (`{db: Db}` — base for all `query_*` functions)
- **fuz_css `deps.ts`**: `CacheDeps` (cache file I/O)
- **fuz_gitops `operations.ts`**: `GitopsOperations`, `GitOperations`, `FsOperations`, etc.
  (uses `*Operations` naming — see below)

### Repo naming: `*Deps` vs `*Operations`

**`*Deps` naming** (fuz_app, fuz_css — preferred):

| What              | Convention                  | Example                              |
| ----------------- | --------------------------- | ------------------------------------ |
| Small interface   | `{Domain}Deps`              | `EnvDeps`, `FsReadDeps`, `CacheDeps` |
| Capability bundle | `{Scope}Deps`               | `AppDeps`, `RouteFactoryDeps`        |
| Full composite    | `RuntimeDeps`               | extends all small `*Deps` interfaces |
| Default impl      | `default_{domain}_deps`     | `default_cache_deps`                 |
| Mock factory      | `create_mock_{domain}_deps` | `create_mock_cache_deps`             |
| Stub factory      | `stub_{scope}_deps`         | `stub_app_deps`                      |

**`*Operations` naming** (fuz_gitops — established, not migrating):

| What              | Convention                        | Example                          |
| ----------------- | --------------------------------- | -------------------------------- |
| Sub-interface     | `{Domain}Operations`              | `GitOperations`, `NpmOperations` |
| Composite         | `GitopsOperations`                | groups all sub-operations        |
| Default impl      | `default_{domain}_operations`     | `default_git_operations`         |
| Combined default  | `default_gitops_operations`       | all sub-defaults                 |
| Mock factory      | `create_mock_{domain}_ops`        | `create_mock_git_ops`            |
| Combined mock     | `create_mock_gitops_ops`          | all sub-mocks                    |

## Parameter Type Suffixes

Three suffixes for single-object parameters, each with distinct test behavior:

| Suffix | What it contains | Test behavior | Rule |
| ----------- | ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `*Deps` | Capabilities (functions, services) | Fresh mock factories per test case | Things you swap for testing or platform abstraction |
| `*Options` | Data (config values, limits, flags) | Literal objects, constructed once, reused | Static values — no mock factory needed |
| `*Context` | Scoped world for a callback/handler | Depends on scope (may contain deps + data) | The world available within a bounded scope |

The `*Deps` / `*Options` boundary is validated by testing patterns: deps get
mock factories with per-test overrides; options are plain objects reused
across test cases.

`*Context` is the world available within a bounded scope — may contain both
deps and data:

- `RouteContext` — per-request: `{db, background_db, pending_effects}`
- `AppServerContext` — per-setup-callback: `{deps, backend, session_options, ...}`

### `*Config` eliminated, `*Input` for mutations

No `*Config` suffix — `?` on fields handles required vs optional. All parameter
bags use `*Options`. `*Input` is reserved for mutation payloads (create/update
data).

## Grouped Operations Pattern (fuz_gitops)

Composite interface grouping I/O by domain, injected as an optional parameter
with a production default.

### Interface definition

```typescript
// operations.ts
export interface GitopsOperations {
	changeset: ChangesetOperations;
	git: GitOperations;
	process: ProcessOperations;
	npm: NpmOperations;
	preflight: PreflightOperations;
	fs: FsOperations;
	build: BuildOperations;
}
```

Each sub-interface groups related operations:

```typescript
export interface GitOperations {
	current_branch_name: (options?: {
		cwd?: string;
	}) => Promise<Result<{value: string}, {message: string}>>;
	checkout: (options: {branch: string; cwd?: string}) => Promise<Result<object, {message: string}>>;
	add_and_commit: (options: {
		files: string | Array<string>;
		message: string;
		cwd?: string;
	}) => Promise<Result<object, {message: string}>>;
	// ... ~15 more methods
}

export interface FsOperations {
	readFile: (options: {
		path: string;
		encoding: BufferEncoding;
	}) => Promise<Result<{value: string}, FsError>>;
	writeFile: (options: {path: string; content: string}) => Promise<Result<object, FsError>>;
	mkdir: (options: {path: string; recursive?: boolean}) => Promise<Result<object, FsError>>;
	exists: (options: {path: string}) => Promise<boolean>;
}
```

`FsError` is the shared discriminated error type — see the L1 filesystem
contract under Design Principles.

### Default implementations

```typescript
// operations_defaults.ts
export const default_git_operations: GitOperations = {
	current_branch_name: async (options) => {
		return wrap_with_value(() => git_current_branch_name_required(options?.cwd));
	},
	checkout: async ({branch, cwd}) => {
		return wrap_void(() => git_checkout(branch, cwd ? {cwd} : undefined));
	},
	// ...
};

export const default_gitops_operations: GitopsOperations = {
	changeset: default_changeset_operations,
	git: default_git_operations,
	process: default_process_operations,
	npm: default_npm_operations,
	preflight: default_preflight_operations,
	fs: default_fs_operations,
	build: default_build_operations,
};
```

## CacheDeps Pattern (fuz_css)

Focused deps interface for cache file I/O. Files: `deps.ts` +
`deps_defaults.ts`.

```typescript
// deps.ts
import type {FsError} from '@fuzdev/fuz_util/fs.js';

export interface CacheDeps {
	read_text: (options: {path: string}) => Promise<Result<{value: string}, FsError>>;
	write_text_atomic: (options: {path: string; content: string}) => Promise<Result<object, FsError>>;
	unlink: (options: {path: string}) => Promise<Result<object, FsError>>;
}

// deps_defaults.ts — every fs throw routes through classify_fs_error
import {classify_fs_error} from '@fuzdev/fuz_util/fs.js';

export const default_cache_deps: CacheDeps = {
	read_text: async ({path}) => {
		try { return {ok: true, value: await readFile(path, 'utf8')}; }
		catch (error) { return {ok: false, ...classify_fs_error(error)}; }
	},
	write_text_atomic: async ({path, content}) => {
		try {
			await mkdir(dirname(path), {recursive: true});
			const temp_path = path + '.tmp.' + process.pid + '.' + Date.now();
			await writeFile(temp_path, content);
			await rename(temp_path, path);
			return {ok: true};
		} catch (error) { return {ok: false, ...classify_fs_error(error)}; }
	},
	unlink: async ({path}) => {
		try { await unlink(path); return {ok: true}; }
		catch (error) { return {ok: false, ...classify_fs_error(error)}; }
	},
};
```

Internal functions take `deps: CacheDeps` as a required first parameter.
Public APIs default to `default_cache_deps`:

```typescript
// gen_fuz_css.ts (public API)
const { deps = default_cache_deps } = options;
```

## AppDeps Pattern (fuz_app)

Stateless capabilities bundle for server code. Three-part vocabulary:

| Category          | Type        | Examples                                        | Rule                             |
| ----------------- | ----------- | ----------------------------------------------- | -------------------------------- |
| **Capabilities**  | `AppDeps`   | `keyring`, `password`, `db`, `log`, `on_audit_event` | Stateless, injectable, swappable |
| **Route caps**    | `RouteFactoryDeps` | `Omit<AppDeps, 'db'>` — for route factories     | Handlers get `db` via `RouteContext` |
| **Parameters**    | `*Options`  | `session_options`, `rate_limiter`, `token_path`  | Static values set at startup    |
| **Runtime state** | inline ref  | `bootstrap_status: {available, token_path}`      | Mutable — NOT in deps or options |

### Interface definition

```typescript
// auth/deps.ts
export interface AppDeps {
	stat: (path: string) => Promise<StatResult | null>;
	read_text_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
	keyring: Keyring;
	password: PasswordHashDeps;
	db: Db;
	log: Logger;
	on_audit_event: (event: AuditLogEvent) => void;
}

// Route factories use RouteFactoryDeps — AppDeps without db
export type RouteFactoryDeps = Omit<AppDeps, 'db'>;
```

### QueryDeps for database functions

All `query_*` functions take `deps: QueryDeps` as their first argument:

```typescript
// db/query_deps.ts
export interface QueryDeps {
	db: Db;
}

// Usage — structural typing means RouteContext satisfies QueryDeps
export const query_account_by_id = async (deps: QueryDeps, id: string) => { /* ... */ };
```

Route handlers pass `route` (the `RouteContext`) directly to query functions
because `RouteContext` structurally satisfies `QueryDeps`.

### Route factory signatures

Factories take narrowed deps reflecting what they actually use:

```typescript
// Uses keyring, password, log — gets RouteFactoryDeps (AppDeps minus db)
export const create_account_route_specs = (
	deps: RouteFactoryDeps,
	options: AccountRouteOptions,
): Array<RouteSpec> => {
	const {keyring, password} = deps;
	const {session_options, ip_rate_limiter} = options;
	// handlers receive (c, route) where route.db is transaction-scoped
	// ...
};

// Uses only log — inline deps type
export const create_admin_account_route_specs = (
	deps: {log: Logger},
	options?: AdminRouteOptions,
): Array<RouteSpec> => { /* ... */ };

// Uses nothing — no deps param
export const create_audit_log_route_specs = (
	options?: AuditLogRouteOptions,
): Array<RouteSpec> => { /* ... */ };
```

### Ad-hoc per-function deps

Functions with a unique combination of capabilities define their own
`*Deps` interface co-located with the consuming function:

```typescript
// auth/bootstrap_account.ts
export interface BootstrapAccountDeps {
	db: Db;
	token_path: string;
	read_text_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
	password: Pick<PasswordHashDeps, 'hash_password'>;
	log: Logger;
}

// auth/bootstrap_routes.ts
export interface CheckBootstrapStatusDeps {
	stat: (path: string) => Promise<StatResult | null>;
	db: Db;
	log: Logger;
}

// auth/api_token_queries.ts — extends QueryDeps with additional capabilities
export interface ApiTokenQueryDeps extends QueryDeps {
	log: Logger;
}
```

Use ad-hoc deps when:
- The combination is unique to one function
- Sharing the interface would add coupling without reuse
- The function mixes data (`token_path`) with capabilities (`read_text_file`)

### Narrowing with `Pick<>`

`Pick<>` on small `*Deps` interfaces is fine — minimal coupling.
The anti-pattern is `Pick<GodType>`, coupling every consumer to a large
composite.

```typescript
password: Pick<PasswordHashDeps, 'hash_password'>;
```

### Two-step init

Create backend (DB + deps), then assemble the HTTP server:

```typescript
// server/app_backend.ts
export const create_app_backend = async (
	options: CreateAppBackendOptions,
): Promise<AppBackend> => {
	// creates db, runs auth migrations, bundles into AppDeps
};

// AppBackend wraps deps with metadata
export interface AppBackend {
	deps: AppDeps;
	db_type: DbType;
	db_name: string;
	readonly migration_results: ReadonlyArray<MigrationResult>;
	close: () => Promise<void>;
}
```

## RuntimeDeps Pattern (fuz_app)

The 8 small `*Deps` interfaces and `RuntimeDeps` composite shown in
"Bottom-up composition" above live in `runtime/deps.ts`. Platform factories:

- `create_deno_runtime(args)` — Deno implementation
- `create_node_runtime(args)` — Node.js implementation
- `create_mock_runtime(args)` — test implementation with observable state

## Design Principles

### Single options object (in operations interfaces)

```typescript
// Good
checkout: (options: {branch: string; cwd?: string}) => Promise<Result<...>>;

// Not this
checkout: (branch: string, cwd?: string) => Promise<Result<...>>;
```

General utility functions may use positional parameters for simple signatures.

### Result returns, never throw

```typescript
export interface GitOperations {
	push: (options: {cwd?: string}) => Promise<Result<object, {message: string}>>;
}
```

### L1 filesystem contract: uniform Result with typed `FsError`

L1 domain filesystem wrappers (`CacheDeps`, `FsOperations`, mageguild's
`FsOperations`) use a uniform shape from `@fuzdev/fuz_util/fs.js`: reads,
writes, and queries all return `Result<{value: T}, FsError>` — no mix of
`string | null` reads with `Result` writes. Implementations route thrown
errors through `classify_fs_error(error)`, which maps Node `code`
(ENOENT/EACCES/EPERM/EEXIST) to a discriminated `kind`:

```typescript
type FsError =
	| {kind: 'not_found'; message: string}
	| {kind: 'permission_denied'; message: string}
	| {kind: 'already_exists'; message: string}
	| {kind: 'io_error'; message: string};

// FsJsonError adds {kind: 'invalid_json'} — for read_json-style deps where
// missing vs corrupt must be distinguishable (e.g. self-healing config loads).
```

Callers branch on `kind` instead of regex-matching `message`:

```typescript
// Missing is expected
if (!r.ok) return null;

// Missing returns a default
if (!r.ok) {
	if (r.kind === 'not_found') return [];
	throw new Error(`readdir failed: ${r.message}`);
}

// Missing is impossible
if (!r.ok) throw new Error(`read failed: ${r.message}`);

// rm -f semantics (tolerate missing)
if (!r.ok && r.kind !== 'not_found') throw new Error(r.message);
```

Uniform shape keeps the contract symmetric for a future Rust port where
`Result<T, E>` is native; typed kinds replace the `{message}` structural
shape that earlier code had to regex-match. Scope: L1 domain wrappers only.
The L0 platform runtime (`FsReadDeps` in `fuz_app/runtime/deps.ts`) keeps
throws-on-error to mirror `Deno.readTextFile` / `node:fs`. See the
ops-layering quest in the grimoire for the migration history.

### No `vi.mock` — plain objects instead

Plain objects implementing interfaces. No `vi.mock()`, no Sinon. Individual
`vi.fn()` for call tracking is acceptable, but DI interfaces are satisfied
by plain objects:

```typescript
const mock_git: GitOperations = {
	checkout: async () => ({ok: true}),
	current_branch_name: async () => ({ok: true, value: 'main'}),
	// ... all methods implemented as plain async functions
};
```

### Declare minimum dependencies

```typescript
// Good — small standalone interface:
import type {EnvDeps} from '@fuzdev/fuz_app/runtime/deps.js';

// Good — intersection of exactly what's needed:
deps: FsReadDeps & FsWriteDeps & CommandDeps

// Good — Pick<> on a small deps interface:
password: Pick<PasswordHashDeps, 'hash_password'>;

// Bad — Pick<> on a god type:
// runtime: Pick<RuntimeDeps, 'env_get'>
```

### Stateless capabilities

Deps are stateless functions and instances — never mutable state. Mutable refs
(like `bootstrap_status: {available: boolean}`) are passed separately.

### Runtime agnosticism

Never import env at module level in server code that might run outside
SvelteKit — breaks Deno compilation. Load env via deps parameters.

## File Naming Convention

**fuz_css** (`*Deps` naming):
```
src/lib/
├── deps.ts            # CacheDeps interface
├── deps_defaults.ts   # default_cache_deps implementation
src/test/
├── fixtures/mock_deps.ts  # create_mock_cache_deps, create_mock_fs_state
```

**fuz_gitops** (`*Operations` naming):
```
src/lib/
├── operations.ts           # GitopsOperations + all sub-interfaces
├── operations_defaults.ts  # default_gitops_operations + all sub-defaults
src/test/
├── test_helpers.ts              # create_mock_gitops_ops + sub-mock factories
├── fixtures/mock_operations.ts  # fixture-oriented mock factories
```

**fuz_app** (`*Deps` across multiple directories):
```
src/lib/
├── auth/deps.ts       # AppDeps, RouteFactoryDeps
├── auth/password.ts   # PasswordHashDeps
├── runtime/deps.ts    # EnvDeps, FsReadDeps, ..., RuntimeDeps
├── runtime/mock.ts    # create_mock_runtime (MockRuntime)
├── db/query_deps.ts   # QueryDeps
├── testing/stubs.ts   # stub_app_deps, create_stub_app_deps
```

## Consumption Patterns

### Optional with default (fuz_gitops)

```typescript
export const publish_repos = async (
	repos: Array<LocalRepo>,
	options: PublishingOptions,
): Promise<PublishingResult> => {
	const {ops = default_gitops_operations} = options;
	await ops.preflight.run_preflight_checks({repos, ...});
};
```

### Subset injection (fuz_gitops)

```typescript
export const update_package_json = async (
	repo: LocalRepo,
	updates: Map<string, string>,
	options: UpdatePackageJsonOptions = {},
): Promise<void> => {
	const {git_ops = default_git_operations, fs_ops = default_fs_operations} = options;
	// only uses git and fs, not the full composite
};
```

### Required first param (fuz_app route factories)

```typescript
export const create_account_route_specs = (
	deps: RouteFactoryDeps,
	options: AccountRouteOptions,
): Array<RouteSpec> => {
	/* ... */
};
```

### Narrow intersection (fuz_app utility functions)

```typescript
// dev/setup.ts — accepts exactly the capabilities needed
export const setup_bootstrap_token = async (
	deps: FsReadDeps & FsWriteDeps & CommandDeps & EnvDeps,
	app_name: string,
	options?: SetupBootstrapTokenOptions,
): Promise<void> => { /* ... */ };
```

## Mock and Stub Patterns

See ./testing-patterns.md for in-memory filesystem patterns and general mock
structure.

### Plain object mocks (fuz_gitops)

```typescript
// test_helpers.ts
export const create_mock_git_ops = (
	overrides: Partial<GitOperations> = {},
): GitOperations => ({
	current_branch_name: async () => ({ok: true, value: 'main'}),
	checkout: async () => ({ok: true}),
	add_and_commit: async () => ({ok: true}),
	has_changes: async () => ({ok: true, value: false}),
	// ... all methods with sensible defaults
	...overrides,
});
```

### Composite mock factory (fuz_gitops)

```typescript
export const create_mock_gitops_ops = (
	overrides: Partial<{
		changeset: Partial<GitopsOperations['changeset']>;
		git: Partial<GitopsOperations['git']>;
		// ...
	}> = {},
): GitopsOperations => ({
	changeset: { /* defaults */ ...overrides.changeset },
	git: create_mock_git_ops(overrides.git),
	npm: create_mock_npm_ops(overrides.npm),
	// ...
});
```

### In-memory filesystem mock (fuz_gitops)

```typescript
export const create_mock_fs_ops = (): FsOperations & {
	get: (path: string) => string | undefined;
	set: (path: string, content: string) => void;
} => {
	const files: Map<string, string> = new Map();
	return {
		readFile: async (options) => {
			const content = files.get(options.path);
			if (content === undefined) return {ok: false, message: `File not found`};
			return {ok: true, value: content};
		},
		writeFile: async (options) => { files.set(options.path, options.content); return {ok: true}; },
		// ... plus get/set helpers for test setup
	};
};
```

### In-memory filesystem mock (fuz_css)

```typescript
// test/fixtures/mock_deps.ts
export const create_mock_fs_state = (): MockFsState => ({
	files: new Map(),
});

export const create_mock_cache_deps = (state: MockFsState): CacheDeps => ({
	read_text: async ({path}) => state.files.get(path) ?? null,
	write_text_atomic: async ({path, content}) => { state.files.set(path, content); return {ok: true}; },
	unlink: async ({path}) => { state.files.delete(path); return {ok: true}; },
});
```

### Tracking mocks (fuz_gitops)

Record calls for test assertions:

```typescript
export const create_tracking_process_ops = (): {
	ops: ProcessOperations;
	get_spawned_commands: () => Array<TrackedCommand>;
	get_commands_by_type: (cmd_name: string) => Array<TrackedCommand>;
} => {
	const spawned_commands: Array<TrackedCommand> = [];
	return {
		ops: {
			spawn: async (options) => {
				spawned_commands.push({cmd: options.cmd, args: options.args, cwd: /*...*/});
				return {ok: true};
			},
		},
		get_spawned_commands: () => spawned_commands,
		get_commands_by_type: (cmd_name) =>
			spawned_commands.filter((c) => c.cmd === 'gro' && c.args[0] === cmd_name),
	};
};
```

### Stub and throwing proxy (fuz_app)

Two safety levels for surface testing (simplified — actual code handles
additional JS internals):

```typescript
// Throwing stub — catches unexpected access with descriptive errors
export const create_throwing_stub = <T>(label: string): T =>
	new Proxy({} as any, {
		get: (_target, prop) => {
			throw new Error(`Throwing stub '${label}' — unexpected access to '${prop}'`);
		},
	}) as T;

// stub_app_deps — all fields are throwing stubs
export const stub_app_deps: AppDeps = {
	stat: create_throwing_stub('stat'),
	read_text_file: create_throwing_stub('read_text_file'),
	delete_file: create_throwing_stub('delete_file'),
	keyring: create_throwing_stub('keyring'),
	password: create_throwing_stub('password'),
	db: create_throwing_stub('db'),
	log: create_throwing_stub('log'),
	on_audit_event: () => {},
};

// create_stub_app_deps — no-op stubs that silently pass
export const create_stub_app_deps = (): AppDeps => ({
	stat: async () => null,
	read_text_file: async () => '',
	delete_file: async () => {},
	keyring: create_noop_stub('keyring'),
	password: create_noop_stub('password'),
	db: stub_db,
	log: new Logger('test', {level: 'off'}),
	on_audit_event: () => {},
});
```

### MockRuntime (fuz_app)

Full mock of `RuntimeDeps` with observable state for CLI testing:

```typescript
const runtime = create_mock_runtime(['apply', 'tx.ts']);
runtime.mock_env.set('HOME', '/home/test');
runtime.mock_fs.set('/home/test/.app/config.json', '{}');

await some_function(runtime);

assert.strictEqual(runtime.command_calls.length, 1);
assert.deepStrictEqual(runtime.exit_calls, [0]);
```

## Quick Reference

| Flavor              | Repo        | Interface file        | Injection style                         |
| ------------------- | ----------- | --------------------- | --------------------------------------- |
| **Grouped ops**     | fuz_gitops  | `operations.ts`       | Optional param with default (`ops`)     |
| **CacheDeps**       | fuz_css     | `deps.ts`             | Optional param with default (`deps`)    |
| **AppDeps**         | fuz_app     | `auth/deps.ts`        | Required first param (`deps, options`)  |
| **RuntimeDeps**     | fuz_app     | `runtime/deps.ts`     | Required first param (narrow interface) |
| **QueryDeps**       | fuz_app     | `db/query_deps.ts`    | Required first param (`deps`)           |

| Principle  | Rule                                                                 |
| ---------- | -------------------------------------------------------------------- |
| Parameters | Single `options` object in operations interfaces                     |
| Errors     | Return `Result`, never throw                                         |
| L1 fs      | Uniform `Result<{value: T}, FsError>` — reads, writes, queries alike |
| L0 fs      | Platform mirror — throws on error (`FsReadDeps` in fuz_app)          |
| Testing    | Plain objects — no `vi.mock()` for module replacement                |
| State      | Deps are stateless — mutable refs passed separately                  |
| Narrowing  | Accept the smallest `*Deps` interface that covers usage              |
