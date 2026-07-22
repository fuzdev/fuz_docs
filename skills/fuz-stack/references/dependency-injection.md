---
description: Injectable *Deps interfaces, mock factories, composition patterns
---

# Dependency Injection

Typed interfaces for side effects, real implementations as defaults, accepted as
params, tested with plain object mocks. No `vi.mock` — dependencies flow through
function signatures. The goal is optimal testable TypeScript that is
runtime-independent (Deno / Node / tests) via simple parameterization, not
magic mocks or ambient singletons.

## Convention

**Small standalone `*Deps` interfaces, composed bottom-up.** Replaces
`Pick<GodType>` narrowing.

### Bottom-up composition

Define small focused interfaces; leaf functions import them directly. The entry
point assembles app-level composites for wiring and threads them down, but leaf
functions never take the composite as a param.

```typescript
// Small standalone interfaces (fuz_app's runtime layer is the exemplar)
export interface EnvDeps {
	env_get: (name: string) => string | undefined;
	env_set: (name: string, value: string) => void;
}

export interface FsReadDeps {
	stat: (path: string) => Promise<StatResult | null>;
	read_text_file: (path: string) => Promise<string>;
	read_file: (path: string) => Promise<Uint8Array>;
	read_text_from_offset: (path: string, offset: number) => Promise<ReadTextFromOffsetResult>;
	readdir: (path: string) => Promise<Array<string>>;
}

export interface CommandDeps {
	run_command: (
		cmd: string,
		args: Array<string>,
		options?: RunCommandOptions
	) => Promise<CommandResult>;
}

// Functions declare exactly what they need via intersection
export const setup_env_file = async (
	deps: FsReadDeps & FsWriteDeps & CommandDeps,
	env_path: string,
	example_path: string
): Promise<void> => {
	/* ... */
};

// App-level composite — for the wiring layer only
export interface RuntimeDeps
	extends
		EnvDeps,
		FsReadDeps,
		FsWriteDeps,
		FsRemoveDeps,
		FsStreamDeps,
		CommandDeps,
		TerminalDeps,
		ProcessDeps,
		LogDeps,
		FetchDeps {
	env_all: () => Record<string, string>;
	readonly args: ReadonlyArray<string>;
	cwd: () => string;
	run_command_inherit: (cmd: string, args: Array<string>) => Promise<number>;
}
```

Platform factories construct the composite once at the entry point:
`create_deno_runtime(args)`, `create_node_runtime(args)`,
`create_mock_runtime(args)` (test implementation with observable state).
Any object that structurally satisfies the interface works. There is no
browser factory — browser/component-tree DI is Svelte context, a different
mechanism (see "Scope" below).

### Why standalone interfaces beat Pick<GodType>

`Pick<AppRuntime, 'env_get'>` forces every consumer to import the god type.
Small standalone interfaces avoid this:

- **Shareable**: any project can import `EnvDeps` without pulling app types
- **Trivial mocks**: `{env_get: () => 'value', env_set: () => {}}` — no factory needed
- **Composable**: `FsReadDeps & CommandDeps` for multi-dep functions
- **Self-documenting**: the interface IS the dependency contract

`Pick<>` on a _small_ `*Deps` interface is fine (minimal coupling); the
anti-pattern is `Pick<GodType>`. A `Pick<>` narrowing reused across many
call sites is a named interface waiting to happen — fuz_app's action
factories take a standalone `ActionFactoryDeps {log, audit}` interface
(`auth/deps.ts`) rather than repeating
`Pick<RouteFactoryDeps, 'log' | 'audit'>` at a dozen sites.

### Bundles vs single capabilities

`*Deps` names the injected **bundle** — a record of capabilities a function
needs. The _members_ of a bundle are often pure-noun service interfaces or
classes (`Keyring`, `Logger`, `AuditEmitter`, `FactStore`), and a standalone
single-capability interface keeps its noun name too — fuz_util's `FactStore`
("interface only — backends live downstream") is the worked example. Don't
suffix a single service interface with `Deps`; the suffix marks the
parameter-bundle role.

## Parameter Type Suffixes

Three suffixes for single-object parameters, each with distinct test behavior:

| Suffix     | What it contains                    | Test behavior                              | Rule                                                |
| ---------- | ----------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `*Deps`    | Capabilities (functions, services)  | Fresh mock factories per test case         | Things you swap for testing or platform abstraction |
| `*Options` | Data (config values, limits, flags) | Literal objects, constructed once, reused  | Static values — no mock factory needed              |
| `*Context` | Scoped world for a callback/handler | Depends on scope (may contain deps + data) | The world available within a bounded scope          |

`*Context` examples: a per-request `RouteContext` (`{db, pending_effects, ...}`),
a per-setup-callback `AppServerContext` (`{deps, backend, session_options, ...}`).
A `*Context` may structurally satisfy a `*Deps` interface — fuz_app's route
handlers pass the `RouteContext` directly to `query_*` functions because it
satisfies `QueryDeps = {db: Db}`.

**No `*Config` suffix** — `?` on fields already expresses required vs optional;
all parameter bags use `*Options`. `*Input` is reserved for mutation payloads
(create/update data).

**Keep the categories separate.** A `*Deps` type that mixes capability fields
with config values (thresholds, paths) is blurring two categories that test
differently — split it into a `*Deps` + an `*Options`, or, when the mix is
deliberate for a one-function signature, use the ad-hoc deps form below and
say so. (Rust collapses these categories into one `*Options` struct on
purpose; TS holds them apart — that's the language-appropriate shape on each
side.)

## Naming

| What              | Convention                  | Example                              |
| ----------------- | --------------------------- | ------------------------------------ |
| Small interface   | `{Domain}Deps`              | `EnvDeps`, `FsReadDeps`, `CacheDeps` |
| Capability bundle | `{Scope}Deps`               | `AppDeps`, `RouteFactoryDeps`        |
| Full composite    | `RuntimeDeps`               | extends all small `*Deps` interfaces |
| Default impl      | `default_{domain}_deps`     | `default_cache_deps`                 |
| Mock factory      | `create_mock_{domain}_deps` | `create_mock_cache_deps`             |
| Stub factory      | `stub_{scope}_deps`         | `stub_app_deps`                      |

File naming: `deps.ts` (interfaces) + `deps_defaults.ts` (production
defaults) + a test-side `mock_deps.ts` — fuz_css is the cleanest exemplar
(`CacheDeps` / `default_cache_deps` / `create_mock_cache_deps`).

**Legacy `*Operations` naming (fuz_gitops)**: an older spelling of the same
pattern — `GitOperations` / `default_git_operations` / `create_mock_git_ops`,
grouped under a `GitopsOperations` composite with an `ops` param. It is being
migrated to `*Deps` opportunistically (fuz_css already migrated its
`CacheOperations` → `CacheDeps`). **Never author new `*Operations` types**;
when touching fuz_gitops's DI surface, follow the existing local naming until
the rename lands, and use `*Deps` everywhere else.

## Layer Contracts (L0 platform vs L1 domain)

Two layers of injected interface, with deliberately different contracts:

**L0 — platform shims** (`FsReadDeps`, `CommandDeps`, ...): mirror the
platform. **Positional params, throws on error**, exactly like
`Deno.readTextFile` / `node:fs`. Stable signatures, trivially implemented by
any runtime.

**L1 — domain wrappers** (`CacheDeps`, git/npm operations, ...): **single
options-object params, uniform `Result` returns with typed errors** — reads,
writes, and queries all return `Result<{value: T}, FsError>`; no mixing
`string | null` reads with `Result` writes. Implementations route thrown
errors through `fs_classify_error(error)` from `@fuzdev/fuz_util/fs.ts`,
which maps platform codes (ENOENT/EACCES/EPERM/EEXIST) to a discriminated
`kind`:

```typescript
type FsError =
	| { kind: 'not_found'; message: string }
	| { kind: 'permission_denied'; message: string }
	| { kind: 'already_exists'; message: string }
	| { kind: 'io_error'; message: string };

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

// rm -f semantics (tolerate missing)
if (!r.ok && r.kind !== 'not_found') throw new Error(r.message);
```

The uniform shape keeps the contract symmetric with the Rust twin where
`Result<T, E>` is native. Don't mix the two contracts on one interface, and
don't leak platform types (e.g. node's `SpawnOptions`) through an L1 shape.

## Consumption Patterns

**Required first param** — internal/library functions take `deps` as a
required first parameter:

```typescript
export const create_account_route_specs = (
	deps: RouteFactoryDeps,
	options: AccountRouteOptions
): Array<RouteSpec> => {
	/* ... */
};
```

**Optional with default** — public API surfaces default to the production
implementation:

```typescript
const { deps = default_cache_deps } = options;
```

**Narrow intersection** — utility functions accept exactly the capabilities
used: `deps: FsReadDeps & FsWriteDeps & CommandDeps & EnvDeps`.

**Ad-hoc per-function deps** — a function with a unique combination defines
its own interface co-located with it:

```typescript
export interface BootstrapAccountDeps {
	db: Db;
	token_path: string; // data mixed in deliberately — one-signature convenience
	read_text_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
	password: Pick<PasswordHashDeps, 'hash_password'>;
	log: Logger;
}
```

Use ad-hoc deps when the combination is unique to one function and sharing
would add coupling without reuse.

**Composition root** — capabilities are assembled once, at an explicit wiring
point, and flow down. fuz_app's two-step server assembly is the exemplar:
`create_app_backend(options)` builds the capability bundle (`AppDeps`) and
returns it wrapped with lifecycle metadata; `create_app_server({backend, ...})`
consumes it. Extension points that must run after assembly register through
documented methods on the capability itself (the audit emitter's
`add_listener` — same identifier as its Rust twin) rather than copying or
re-shaping the deps bundle.

## Design Principles

- **Result returns, never throw** in L1 domain interfaces (see Layer
  Contracts); L0 mirrors the platform and throws.
- **Stateless capabilities** — deps are stateless functions and service
  instances; mutable state (e.g. `bootstrap_status: {available: boolean}`)
  is passed separately, never smuggled into a deps bundle.
- **Runtime agnosticism** — never import env/fs at module level in code that
  might run outside one runtime; load via deps params. Direct platform
  imports are for the platform factory files and explicitly-single-runtime
  modules only (document the carve-out at the module when you make one).
- **Logging in shared deps: required, never optional-with-fallback.** A
  shared library module consumed by multiple apps can't own a `Logger`
  singleton — the label belongs to the consumer. Keep `LogDeps` required;
  where a consumer has no logger, its adapter delegates explicitly
  (`warn: (...args) => console.warn(...args)`). Diagnostic-only `log?`
  params on leaf helpers (silently absent = no extra diagnostics) are a
  different, acceptable shape — the rule is about capabilities the function
  _needs_ on some path.

## Testing

Plain objects implementing the interfaces — no `vi.mock()`, no Sinon.
Individual `vi.fn()` for call tracking is acceptable. See
./testing-patterns.md for general mock structure.

**Mock factory with overrides** — every method implemented with a sensible
default, `Partial<T>` overrides spread last:

```typescript
export const create_mock_git_deps = (overrides: Partial<GitDeps> = {}): GitDeps => ({
	current_branch_name: async () => ({ ok: true, value: 'main' }),
	checkout: async () => ({ ok: true }),
	// ... all methods with sensible defaults
	...overrides
});
```

**In-memory state mock** — state object created separately so tests can seed
and inspect it:

```typescript
export const create_mock_cache_deps = (state: MockFsState): CacheDeps => ({
	read_text: async ({ path }) => {
		const content = state.files.get(path);
		return content === undefined
			? { ok: false, kind: 'not_found', message: `not found: ${path}` }
			: { ok: true, value: content };
	},
	write_text_atomic: async ({ path, content }) => {
		state.files.set(path, content);
		return { ok: true };
	},
	unlink: async ({ path }) => {
		state.files.delete(path);
		return { ok: true };
	}
});
```

**Tracking mock** — records calls for assertions, returned alongside the
deps object:

```typescript
export const create_tracking_process_deps = (): {
	deps: ProcessDeps;
	get_spawned_commands: () => Array<TrackedCommand>;
} => {
	/* push into a local array, expose getters */
};
```

**Stubs — two safety levels** (fuz_app's `testing/stubs.ts` is the exemplar):

- `create_throwing_stub<T>(label)` — Proxy that throws on any access;
  `stub_app_deps` builds a whole bundle of these. Catches _unexpected_
  capability use with a descriptive error — prefer this default: a silent
  no-op mock can mask test-setup mistakes.
- `create_noop_stub<T>(label)` / `create_stub_app_deps()` — silent no-ops
  for tests where incidental access is fine.

**Observable runtime mock** — `create_mock_runtime(args)` returns the full
`RuntimeDeps` with observable state (`mock_env`, `mock_fs`, `exit_calls`,
`command_calls`, ...); `exit` throws a `MockExitError` instead of
terminating. Stub factories accept the same narrow `*Deps` contracts
production code uses — never `Pick<GodType>`.

## Traps

Failure modes seen in real code — each with the rule that avoids it:

- **Optional capability with a silent platform fallback.** A
  `read_file?: (...)` field defaulting to a module-level `node:fs` import
  quietly couples the module to one runtime and hides the effect from the
  signature. Either require the dep, or default at an explicit platform
  factory / entry point — not per-field at module scope.
- **Category blurring under a `*Deps` name.** Config values
  (`embedded_threshold`, `disk_root`) mixed with capabilities in one
  `*Deps` interface, several optional-with-fallback — tests can't tell what
  needs a mock vs a literal. Split `*Deps` from `*Options`, or use the
  documented ad-hoc form deliberately.
- **No seam at the call site.** Functions called _by name_ from middleware
  (`query_account_by_id(...)` imported directly) leave `vi.mock` as the only
  test seam — this is how module-mocking creeps back in. Where a module's
  callers need to substitute behavior in tests, thread the function through
  a deps param. fuz_app documents its remaining bearer-auth query cluster as
  an explicit carve-out (module mocks with `vi.restoreAllMocks()` hygiene);
  treat any new instance as a smell, not a precedent.
- **God-type coupling.** `Pick<Composite, ...>` at leaf functions, or
  passing the app composite down more than one level. Composites exist for
  the wiring layer.
- **Deps spreading.** `{...deps, extra}` at downstream call sites re-shapes
  the bundle mid-flight. Constructing a purpose-built deps object at a
  wiring point where multiple sources converge is legitimate; spreading to
  _extend_ someone else's bundle is not. Inline narrowing (`{db}` selected
  from a bundle) is fine — selection, not extension.
- **Forcing `*Deps` params across a component tree.** Browser/UI code uses
  the platform's DI: Svelte context (`create_context`), e.g. fuz_app's
  `*_rpc_context` adapters. Function-param deps are for plain TS call
  graphs; context is for component scoping. Both are the pattern done
  right, in their own domain.

## Scope — where the pattern doesn't apply

- **Floor-tier utility modules**: foundation packages (fuz_util) export
  bare functions over the platform (`fs.ts`, `process.ts`, `git.ts`) plus
  the shared contracts (`FsError`, `Result`) that `*Deps` interfaces
  elsewhere are typed against. They are what default implementations are
  _made of_ — they don't take deps themselves.
- **Pure libraries** (parsers, renderers, formatters) have no side effects
  to inject; a rendering/plugin seam (mdz's component injection) is
  composition, not capability DI.
- **Narrow duck-typed interfaces** that intentionally match multiple
  existing objects (svelte-docinfo's `AnalysisLog`, satisfiable by both
  fuz_util's `Logger` and Vite's logger) are the same spirit without the
  suffix — fine as-is.

## Rust Analog

The `*Deps` suffix is **TS-only**. Rust traits _are_ capabilities —
appending `Deps` imports TS shape into a language that doesn't need it.
Rust uses pure-noun capability traits (`PasswordHasher`, `Storage`,
`SocketRevoker`) and `*Options` structs for per-call parameter bags, with
`cfg`/features, the crate graph, and enum dispatch covering much of what TS
solves with injection. For the full treatment — escalation ladder, hot/cold
dispatch, enum-dispatch-before-`dyn`, object-safety annotation rules, what
stays concrete — see ./rust-patterns.md#dependency-injection.

## Quick Reference

| Flavor                                                                                  | Exemplar           | Injection style                                                    |
| --------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| Narrow platform deps + `RuntimeDeps` composite                                          | fuz_app `runtime/` | Required first param (narrow interface); composite at entry points |
| App capability bundle (`AppDeps`, `RouteFactoryDeps`, `QueryDeps`, `ActionFactoryDeps`) | fuz_app server     | Required first param; two-step composition root                    |
| Focused domain deps (`CacheDeps`)                                                       | fuz_css            | Optional param with default (`deps = default_cache_deps`)          |
| Grouped legacy `*Operations`                                                            | fuz_gitops         | Optional param with default (`ops`) — migrating to `*Deps`         |

| Principle  | Rule                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| Suffixes   | `*Deps` capabilities / `*Options` data / `*Context` scoped world; no `*Config` |
| Errors     | L1: uniform `Result<{value: T}, FsError>`; L0: platform mirror, throws         |
| Parameters | L1: single options object; L0: positional                                      |
| Testing    | Plain objects — no `vi.mock()`; throwing stubs over silent no-ops              |
| State      | Deps are stateless — mutable refs passed separately                            |
| Narrowing  | Accept the smallest `*Deps` interface that covers usage                        |
| New code   | `*Deps` naming everywhere — never new `*Operations`                            |
