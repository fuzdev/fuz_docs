# Dependency Injection

Guide to the injectable interface patterns used across the `@fuzdev` ecosystem
for testability, mockability, and JS runtime agnosticism.

The core idea: define typed interfaces for side effects, provide real
implementations as defaults, accept them as parameters, and test with plain
object mocks. No `vi.mock`, no mocking libraries — dependencies flow through
function signatures.

## Convention

**Small standalone `*Deps` interfaces, composed bottom-up.** This replaces
`Pick<GodType>` narrowing and provides a single naming vocabulary across all
repos.

### Bottom-up composition

Define small focused interfaces. Leaf functions import them directly. App-level
composites assemble them for wiring — the entry point builds the composite and
threads it down, but leaf functions never take the composite as a param.

```typescript
// Small standalone interfaces (shareable across packages)
export interface EnvDeps {
	env_get: (key: string) => string | undefined;
}

export interface FsDeps {
	read_file: (path: string) => Promise<string>;
	write_file: (path: string, content: string) => Promise<void>;
	stat: (path: string) => Promise<StatResult | null>;
}

// Functions declare deps directly — no Pick<GodType> needed
export const load_env = (deps: EnvDeps): ServerEnv => {
	/* ... */
};
export const resolve_template = (deps: EnvDeps & FsDeps): string => {
	/* ... */
};

// App-level composite — flat intersection for small surfaces
export interface AppDeps extends EnvDeps, FsDeps, ProcessDeps {}

// Or grouped for larger surfaces
export interface GitopsDeps {
	changeset: ChangesetDeps;
	git: GitDeps;
	fs: FsDeps;
	// ...
}
```

### Why object literals beat Pick<GodType>

A `Pick<AppRuntime, 'env_get'>` pattern forces every consumer to import the
god type. Small standalone interfaces have no such coupling:

- **Shareable**: `EnvDeps` can live in fuz_util, imported by any project
- **Trivial mocks**: `{env_get: () => 'value'}` — no factory needed for simple cases
- **Composable**: `EnvDeps & FsDeps` for multi-dep functions
- **Self-documenting**: the interface IS the dependency contract

### `*Deps` naming everywhere

| What              | Convention                  | Example                        |
| ----------------- | --------------------------- | ------------------------------ |
| Small interface   | `{Domain}Deps`              | `EnvDeps`, `FsDeps`, `GitDeps` |
| Capability bundle | `{Scope}Deps`               | `AppDeps`, `RouteDeps`     |
| App composite     | `{App}Deps`                 | `GitopsDeps`                   |
| Default impl      | `default_{domain}_deps`     | `default_fs_deps`              |
| Mock factory      | `create_mock_{domain}_deps` | `create_mock_git_deps`         |

### Where shared interfaces live

- **fuz_app**: `AppDeps`, `PasswordHashDeps` (in `auth/deps.ts`);
  runtime deps — `RuntimeDeps`, `EnvDeps`, `FsReadDeps`, `CommandDeps` (in `runtime/deps.ts`)
- **Per-project**: Domain-specific deps — `GitDeps`, `GitHubDeps`, `AgentDeps`

### Migration

Some older code still uses `*Operations` naming (e.g. fuz_gitops).
New code uses `*Deps`; existing code migrates opportunistically.

## Three Naming Conventions

The ecosystem uses three suffixes for single-object parameters. Each carries
distinct signal about what the object is and how it behaves in tests:

| Suffix | What it contains | Test behavior | Rule |
| ----------- | ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `*Deps` | Capabilities (functions, services) | Fresh mock factories per test case | Things you swap for testing or platform abstraction |
| `*Options` | Data (config values, limits, flags) | Literal objects, constructed once, reused | Static values — no mock factory needed |
| `*Context` | Scoped world for a callback/handler | Depends on scope (may contain deps + data) | The world available within a bounded scope |

### Why three, not one

The `*Deps` / `*Options` boundary is validated by testing patterns: deps get
`create_mock_*_deps()` factories with per-test overrides, while options are
plain objects spread across test cases. Collapsing them would muddy that signal.

`*Context` is for the world available to a callback or handler within a bounded
scope. Examples:

- `RouteContext` — per-request: `{db, pool_db, pending_effects}`
- `AppServerContext` — per-setup-callback: `{deps, backend, session_options, ...}`
- `ExecutorContext` (tx) — per-change: `{runtime, execution, run, emit, ...}`

Context objects may contain both deps and data — they represent "everything
available in this scope," not a single category. The scope is the organizing
principle, not the content type.

### `*Config` eliminated, `*Input` for mutations

No separate `*Config` suffix — `?` on fields already communicates required vs
optional. All parameter bags use `*Options`. `*Input` is reserved for mutation
payloads (data being written in create/update operations).

## Grouped Deps Pattern

Used by **fuz_gitops** and **fuz_css**. A composite interface groups I/O by
domain, injected via context or optional parameters with defaults.

### Interface definition

```typescript
// deps.ts
export interface GitopsDeps {
	changeset: ChangesetDeps;
	git: GitDeps;
	process: ProcessDeps;
	npm: NpmDeps;
	preflight: PreflightDeps;
	fs: FsDeps;
	build: BuildDeps;
}
```

Each sub-interface groups related deps:

```typescript
export interface GitDeps {
	current_branch_name: (options?: {
		cwd?: string;
	}) => Promise<Result<{value: string}, {message: string}>>;
	checkout: (options: {branch: string; cwd?: string}) => Promise<Result<object, {message: string}>>;
	add_and_commit: (options: {
		files: string | Array<string>;
		message: string;
		cwd?: string;
	}) => Promise<Result<object, {message: string}>>;
	// ...
}

export interface FsDeps {
	read_text: (options: {path: string}) => Promise<string | null>;
	write_text_atomic: (options: {
		path: string;
		content: string;
	}) => Promise<Result<object, {message: string}>>;
	// ...
}
```

### Default implementations

```typescript
// deps_defaults.ts
export const default_git_deps: GitDeps = {
	current_branch_name: async (options) => {
		return wrap_with_value(() => git_current_branch_name(options?.cwd));
	},
	checkout: async ({branch, cwd}) => {
		return wrap_void(() => git_checkout({branch, cwd}));
	},
	// ...
};

export const default_gitops_deps: GitopsDeps = {
	changeset: default_changeset_deps,
	git: default_git_deps,
	process: default_process_deps,
	npm: default_npm_deps,
	preflight: default_preflight_deps,
	fs: default_fs_deps,
	build: default_build_deps,
};
```

### Scope naming

Name interfaces by their scope, not the generic mechanism:

- `GitopsDeps` (fuz_gitops) — multi-repo publishing deps
- `CacheDeps` (fuz_css) — cache file I/O deps

## AppDeps Pattern

Defined in **fuz_app** for server code. A stateless capabilities bundle with a
three-part vocabulary:

| Category          | Type        | Examples                                        | Rule                             |
| ----------------- | ----------- | ----------------------------------------------- | -------------------------------- |
| **Capabilities**  | `AppDeps`   | `keyring`, `password`, `db`, `log`              | Stateless, injectable, swappable |
| **Route caps**    | `RouteDeps` | `Omit<AppDeps, 'db'>` — for route factories     | Handlers get `db` via `RouteContext` |
| **Parameters**    | `*Options`  | `session_options`, `rate_limiter`, `token_path`  | Static values set at startup    |
| **Runtime state** | inline ref  | `bootstrap_status: {available, token_path}`      | Mutable — NOT in deps or options |

### Interface definition

```typescript
// auth/deps.ts
export interface AppDeps {
	keyring: Keyring;
	password: PasswordHashDeps;
	db: Db;
	log: Logger;
	stat: (path: string) => Promise<StatResult | null>;
	read_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
}

// Route factories use RouteDeps — AppDeps without db
export type RouteDeps = Omit<AppDeps, 'db'>;
```

### Route factory signatures

Factories take narrowed deps reflecting what they actually use:

```typescript
// Uses keyring, password, log — gets RouteDeps (AppDeps minus db)
export const create_account_route_specs = (
	deps: RouteDeps,
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

### Narrowing with `Pick<>`

`Pick<>` on small `*Deps` interfaces is fine — the coupling is minimal:

```typescript
// Only need hashing for account creation, not verification
password: Pick<PasswordHashDeps, 'hash_password'>;
```

The anti-pattern is `Pick<GodType>` — coupling every consumer to a large
composite type. Use small standalone `*Deps` interfaces instead.

### Two-step init flow

Backend initialization is always two explicit steps: create the backend
(DB + deps), then assemble the HTTP server.

```typescript
// server/app_backend.ts
export const create_app_backend = async (
	options: CreateAppBackendOptions,
): Promise<AppBackend> => {
	// creates db, runs auth migrations, bundles into AppDeps
};

// server/app_backend.ts — AppBackend wraps deps with metadata
export interface AppBackend {
	deps: AppDeps;
	db_type: DbType;
	db_name: string;
	readonly migration_results: ReadonlyArray<MigrationResult>;
	close: () => Promise<void>;
}
```

## Design Principles

### Single options object

All operations accept a single `options` object parameter:

```typescript
// Good
checkout: (options: {branch: string; cwd?: string}) => Promise<Result<...>>;

// Not this
checkout: (branch: string, cwd?: string) => Promise<Result<...>>;
```

### Result returns, never throw

Fallible operations return `Result`, never throw exceptions:

```typescript
export interface GitDeps {
	push: (options: {cwd?: string}) => Promise<Result<object, {message: string}>>;
}
```

### Null for not-found

Expected "not found" cases return `null`, not errors:

```typescript
read_json: <T>(options: {path: string}) => Promise<T | null>;
```

### No mocking libraries

Tests use plain objects implementing interfaces — no `vi.mock`, no Sinon:

```typescript
const mock_git: GitDeps = {
	checkout: async () => ({ok: true}),
	push: async () => ({ok: false, message: 'network error'}),
	// ...
};
```

### Declare minimum dependencies

Use small `*Deps` interfaces instead of `Pick<GodType>`:

```typescript
// Good — small standalone interface:
import type {EnvDeps} from '@fuzdev/fuz_app/runtime/deps.js';

// Good — Pick<> on a small deps interface:
password: Pick<PasswordHashDeps, 'hash_password'>;

// Bad — Pick<> on a god type:
// runtime: Pick<AppRuntime, 'env_get'>
```

### Stateless capabilities

Deps are stateless functions and instances — never mutable state. Mutable refs
(like `bootstrap_status: {available: boolean}`) are passed separately.

### Runtime agnosticism

Never import env at module level in server code that might run outside
SvelteKit — it breaks Deno compilation and other runtimes. Load env via deps
parameters, flow through constructors.

## File Naming Convention

```
src/lib/
├── deps.ts            # Interface definitions
├── deps_defaults.ts   # Real implementations
└── ...
src/test/
├── test_helpers.ts    # Mock factories (or fixtures/mock_deps.ts)
└── ...
```

### Naming

| What              | Pattern                     | Example                          |
| ----------------- | --------------------------- | -------------------------------- |
| Small interface   | `{Domain}Deps`              | `EnvDeps`, `FsDeps`, `GitDeps`   |
| Capability bundle | `{Scope}Deps`               | `AppDeps`, `RouteDeps`       |
| App composite     | `{App}Deps`                 | `GitopsDeps`                     |
| Default impl      | `default_{domain}_deps`     | `default_git_deps`               |
| Combined default  | `default_{app}_deps`        | `default_gitops_deps`            |
| Mock factory      | `create_mock_{domain}_deps` | `create_mock_git_deps`           |
| Combined mock     | `create_mock_{app}_deps`    | `create_mock_gitops_deps`        |
| Init factory      | `create_{scope}`            | `create_app_backend`             |
| Backend wrapper   | `AppBackend`                | `{deps, db_type, db_name, close}`|

## Consumption Patterns

### Optional with default (fuz_gitops, fuz_css)

```typescript
export const publish_repos = async (
	repos: Array<LocalRepo>,
	options: PublishingOptions,
): Promise<PublishingResult> => {
	const {deps = default_gitops_deps} = options;
	await deps.preflight.run_preflight_checks({repos});
};
```

### Subset injection (fuz_gitops)

```typescript
export const update_package_json = async (
	repo: LocalRepo,
	updates: Map<string, string>,
	options: UpdatePackageJsonOptions = {},
): Promise<void> => {
	const {git_deps = default_git_deps, fs_deps = default_fs_deps} = options;
	// only uses git and fs, not the full composite
};
```

### Required first param (fuz_app)

```typescript
export const create_account_route_specs = (
	deps: RouteDeps,
	options: AccountRouteOptions,
): Array<RouteSpec> => {
	/* ... */
};
```

## Mock Factories

See ./testing-patterns.md for the in-memory filesystem pattern and general mock
structure. Here are patterns specific to deps mocking.

### Tracking mocks

Mocks that record calls for test assertions:

```typescript
export const create_mock_git_deps = (
	options: MockGitOptions = {},
): GitDeps & {
	calls: Array<TrackedGitCall>;
	get_calls: (method: string) => Array<TrackedGitCall>;
	clear: () => void;
} => {
	const calls: Array<TrackedGitCall> = [];
	return {
		calls,
		get_calls: (method) => calls.filter((c) => c.method === method),
		clear: () => calls.splice(0, calls.length),
		push_branch: async (options) => {
			calls.push({method: 'push_branch', args: options});
			return options.push_fails ? {ok: false, message: 'push failed'} : {ok: true};
		},
		// ...
	};
};
```

### Composite mock factory

Assembles all sub-mocks into the full composite:

```typescript
export const create_mock_gitops_deps = (options: MockGitopsOptions = {}): GitopsDeps => {
	const git = create_mock_git_deps(options.git);
	const fs = create_memory_fs_deps();
	const changeset = create_mock_changeset_deps(options.changeset);
	// ...
	return {changeset, git, process, npm, preflight, fs, build};
};
```

### Override mocks

```typescript
const deps = create_mock_gitops_deps({
	changeset: {
		predict_next_version: async ({repo}) => {
			if (repo.library.name === 'pkg-a') {
				return {ok: true, version: '0.1.1', bump_type: 'patch'};
			}
			return null;
		},
	},
});
```

## Quick Reference

| Flavor              | When                      | Interface file   | Injection style                         |
| ------------------- | ------------------------- | ---------------- | --------------------------------------- |
| **Grouped deps**    | CLI tools, I/O-heavy code | `deps.ts`        | Optional param with default             |
| **AppDeps**         | Server route factories    | `auth/deps.ts`   | Required first param (`deps, options`)  |

| Principle  | Rule                                                                 |
| ---------- | -------------------------------------------------------------------- |
| Parameters | Single `options` object                                              |
| Errors     | Return `Result`, never throw                                         |
| Not found  | Return `null`                                                        |
| Testing    | Plain objects, no mocking libraries                                  |
| State      | Deps are stateless — mutable refs passed separately                  |
| Naming     | `{Domain}Deps`, `default_{domain}_deps`, `create_mock_{domain}_deps` |
