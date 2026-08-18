---
description: Vitest patterns, fixtures, mocks, assertion helpers
---

# Testing Patterns

Testing conventions for the Fuz stack: vitest usage, fixtures, mocks, helpers.

## Contents

- [File Organization](#file-organization) (naming, subdirectories, assertions, async rejection, jsdom)
- [Database Testing](#database-testing) (PGlite, vitest projects, describe_db)
- [Test Helpers](#test-helpers)
- [Shared Test Factories](#shared-test-factories)
- [Fixture-Based Testing](#fixture-based-testing)
- [Mock Patterns](#mock-patterns)
- [Environment Flags](#environment-flags)
- [Test Structure](#test-structure) (organization, parameterized)
- [Serde Boundary Conformance](#serde-boundary-conformance) (Rust ↔ hand-written TS: round-trip + coverage guard)

## File Organization

```
src/
├── lib/               # source code
│   └── domain/        # domain subdirectories
└── test/              # all tests (NOT co-located)
    ├── module.test.ts              # single-file tests
    ├── module.aspect.test.ts       # split tests by aspect
    ├── test_helpers.ts             # shared test utilities
    ├── domain_test_helpers.ts      # domain-specific helpers
    ├── domain_test_aspect.ts       # shared test factory (NOT a test file)
    ├── domain/                     # mirrors lib/ subdirectories
    │   ├── module.test.ts
    │   └── module.db.test.ts
    └── fixtures/                   # fixture-based test data
        ├── update.task.ts          # runs all child update tasks
        └── feature_name/
            ├── case_name/
            │   ├── input.{ext}     # test input
            │   └── expected.json   # generated expected output
            ├── feature_name_test_helpers.ts  # fixture-specific helpers
            └── update.task.ts      # regeneration task for this feature
```

Tests live in `src/test/` (not co-located), mirroring `src/lib/`
subdirectories (e.g., `src/lib/auth/` -> `src/test/auth/`).

### Test File Naming

Split large suites with dot-separated aspects:

| Pattern                            | Example                                       |
| ---------------------------------- | --------------------------------------------- |
| `{module}.test.ts`                 | `mdz.test.ts`, `ts_helpers.test.ts`           |
| `{module}.{aspect}.test.ts`        | `csp.base.test.ts`, `csp.security.test.ts`    |
| `{module}.svelte.{aspect}.test.ts` | `contextmenu_state.svelte.activation.test.ts` |
| `{module}.fixtures.test.ts`        | `svelte_preprocess_mdz.fixtures.test.ts`      |
| `{module}.db.test.ts`              | `account_queries.db.test.ts`                  |
| `{module}.integration.db.test.ts`  | `invite_signup.integration.db.test.ts`        |

Module name matches source file. `.svelte.` preserves the source extension.

### Assertions

Use `assert` from vitest. Choose methods for TypeScript type narrowing, not
semantic precision. `assert.ok` is the standard guard for narrowing
`T | undefined` to `T` — don't replace it with `assert.isDefined` (which
narrows to `NonNullable<T>`, also removing the need for `!`) or other methods
unless the replacement improves failure diagnostics without losing narrowing.

```typescript
import { test, assert } from 'vitest';

assert.ok(value); // narrows away null/undefined — the standard guard
assert.strictEqual(a, b);
assert.deepStrictEqual(a, b);
```

Strengthen assertions when the value is **known**: `assert.strictEqual` for
exact expected values, `assert.include`/`assert.notInclude` for array
membership (shows actual contents on failure). Leave `assert.ok` for guards
where the goal is narrowing, not value checking.

**Why `assert` over `expect`:** `assert(x instanceof Error)` narrows `x` for
TypeScript; `expect(x).toBeInstanceOf(Error)` doesn't, so member access after
it is a type error.

Name custom assertion helpers `assert_*`, not `expect_*` — e.g.
`assert_css_contains()`.

For throw assertions, use `assert.throws()` with an Error constructor, string,
or RegExp. **Do not pass a function predicate** — causes
`"errorLike is not a constructor"`:

```typescript
// Good — RegExp matching
assert.throws(() => fn(), /expected message/);

// Good — Error constructor
assert.throws(() => fn(), TypeError);

// BAD — function predicate does NOT work with chai assert.throws
// assert.throws(() => fn(), (e: any) => e.message.includes('msg'));

assert.doesNotThrow(() => fn());
```

`assert.throws()` returns `void`. To inspect the error, place `assert.fail`
**after** the catch block — never inside the try block, where it would be
caught and swallowed:

```typescript
try {
	fn();
} catch (e) {
	assert(e instanceof Error);
	assert.include(e.message, 'expected substring');
	assert.strictEqual((e as any).code, 'EXPECTED_CODE');
	return;
}
assert.fail('Expected error');
```

### Test Placeholder Domains

When tests need stand-in domain names (allowlists, URL parsing, CSP sources,
etc.), use `*.fuz.dev` subdomains rather than `example.com`, RFC-2606 reserved
TLDs, or arbitrary strings. This keeps fixtures consistent across the ecosystem
and signals that the domain is owned/controllable.

```typescript
// Anonymous placeholders — letters for "any domain"
const A = src('a.fuz.dev');
const B = src('b.fuz.dev');

// Scenario placeholders — pick a meaningful subdomain
const cdn = src('cdn.fuz.dev');
const api = src('https://api.fuz.dev/');
const untrusted = src('untrusted-cdn.fuz.dev');

// Generated placeholders
Array.from({ length: 100 }, (_, i) => src(`source${i}.fuz.dev`));
```

Real third-party domains (`fonts.googleapis.com`, `js.stripe.com`,
`cdnjs.cloudflare.com`) are fine when the test specifically documents
integration with that vendor.

### Async Rejection Testing

For async functions that should reject, use `assert_rejects` from
`@fuzdev/fuz_util/testing.ts`. It places `assert.fail` outside the catch
block so the test's own assertion errors aren't accidentally caught:

```typescript
import { assert_rejects } from '@fuzdev/fuz_util/testing.ts';

// Simple — just check the error pattern
await assert_rejects(
	() => local_repo_load({ local_repo_path, git_ops, npm_ops }),
	/Failed to pull.*unstaged changes/
);

// Pattern is optional — returns the Error for further assertions
const err = await assert_rejects(() =>
	local_repos_load({ local_repo_paths: paths, git_ops, npm_ops })
);
assert.include(err.message, 'repo-a');
assert.include(err.message, 'repo-b');
```

### jsdom Environment

For UI tests needing a DOM, add the pragma before imports:

```typescript
// @vitest-environment jsdom
```

Used in fuz_ui (contextmenu, intersect tests), zzz (cell, UI state), and
fuz_app (auth_state, popover).

**Gotcha:** jsdom normalizes CSS values — `style.setProperty('top', '0')`
stores `'0px'`. Match the normalized form in assertions.

**Gotcha:** jsdom lacks `ResizeObserver` and `IntersectionObserver`. Mock them
before importing components:

```typescript
// @vitest-environment jsdom
import { vi } from 'vitest';

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
```

## Database Testing

fuz_app owns the database testing infrastructure (`testing/db.ts`); fuz_app
and zzz both run the vitest projects split below (zzz's config is committed
with the same `unit`/`db` shape and cross-backend gating).

### The `.db.test.ts` Convention

Any test using a `Db` instance uses the `.db.test.ts` suffix, with `.db`
immediately before `.test.ts` — e.g., `foo.integration.db.test.ts`.

Vitest `projects` runs all DB tests in a single worker (`isolate: false` +
`fileParallelism: false`), sharing one PGlite WASM instance (~500-700ms
cold start saved per file). Non-DB tests stay fully parallel.

### Vitest Projects Configuration

The core pattern, adapted from fuz_app's `vite.config.ts` (simplified — the
real file adds more plugins and the cross-backend projects below):

```typescript
import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

const max_threads = Math.max(1, Math.ceil(availableParallelism() / 2));

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/test/**/*.test.ts'],
					exclude: ['src/test/**/*.db.test.ts', 'src/test/**/*.cross.test.ts'],
					maxWorkers: max_threads,
					sequence: { groupOrder: 1 }
				}
			},
			{
				extends: true,
				test: {
					name: 'db',
					include: ['src/test/**/*.db.test.ts'],
					isolate: false,
					fileParallelism: false,
					sequence: { groupOrder: 2 }
				}
			}
		]
	}
});
```

fuz_app additionally gates a `cross_backend_*` project family behind
`FUZ_TEST_CROSS_BACKEND=1` — per-runtime projects (`rust_spine_stub`,
`ts_node`, `ts_deno`, `ts_bun`) running `src/test/cross_backend/*.cross.test.ts`,
plus dedicated `parity` and `security` projects with their own global setups.

Because `isolate: false` shares module state, avoid `vi.mock()` in
`.db.test.ts` files. If needed, pair with `vi.restoreAllMocks()` (not
`vi.clearAllMocks()`) in `afterEach`.

### describe_db Pattern

fuz_app's `testing/db.ts` provides
`create_describe_db(factories, truncate_tables)`. Consumer projects create a
`db_fixture.ts`:

```typescript
// src/test/db_fixture.ts (adapted from fuz_app's, which also wires
// pglet + pglet-wasm factories from local test modules)
import type { Db } from '#lib/db/db.ts';
import { run_migrations } from '#lib/db/migrate.ts';
import { auth_migration_ns } from '#lib/auth/migrations.ts';
import {
	create_pglite_factory,
	create_pg_factory,
	create_describe_db,
	auth_integration_truncate_tables,
	log_db_factory_status
} from '#lib/testing/db.ts';

const init_schema = async (db: Db): Promise<void> => {
	await run_migrations(db, [auth_migration_ns]);
};

export const pglite_factory = create_pglite_factory(init_schema);
export const pg_factory = create_pg_factory(init_schema, process.env.TEST_DATABASE_URL);
export const db_factories = [pglite_factory, pg_factory];

log_db_factory_status(db_factories);

export const describe_db = create_describe_db(db_factories, auth_integration_truncate_tables);
```

Test files import and use as a wrapper:

```typescript
// src/test/auth/account_queries.db.test.ts
import { describe, assert, test } from 'vitest';
import { query_create_account } from '#lib/auth/account_queries.ts';
import { describe_db } from '../db_fixture.ts';

describe_db('account queries', (get_db) => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const deps = { db };
		const account = await query_create_account(deps, {
			username: 'alice',
			password_hash: 'hash123'
		});
		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
```

### Integration Tests

Named `.integration.db.test.ts`. Use `create_test_app()` from
`#lib/testing/app_server.ts` for a full Hono app with middleware, routes, and
database:

```typescript
const { app, create_session_headers, create_bearer_headers, create_account, cleanup } =
	await create_test_app({
		session_options: create_session_config('test_session'),
		create_route_specs: (ctx) => my_routes(ctx)
	});
```

### PGlite WASM Caching

`create_pglite_factory` instances in the same worker share a single PGlite
WASM instance via module-level cache. Subsequent calls reset the schema
(`DROP SCHEMA public CASCADE`) instead of paying the cold-start cost.

## Test Helpers

### Shared Helpers (`@fuzdev/fuz_util/testing.ts`)

Cross-repo test assertions live in `@fuzdev/fuz_util/testing.ts`. Depends
only on vitest — safe for fuz_util's zero-runtime-deps constraint.

```typescript
import { assert_rejects, create_mock_logger } from '@fuzdev/fuz_util/testing.ts';

// Async rejection — pattern is optional, returns Error
const err = await assert_rejects(() => do_thing(), /expected pattern/);

// Mock logger — vi.fn() methods + tracking arrays
const log = create_mock_logger();
do_thing(log);
assert.deepEqual(log.info_calls, ['expected message']);
```

For `Result` assertions, `assert.ok(result.ok)` narrows the union directly.
The general discriminated-union form is `assert_property(obj, key, value)`
(also in `@fuzdev/fuz_util/testing.ts`) — `assert_property(r, 'ok', true)`,
or any discriminator (`kind`, `type`). Its `const V` type param is
load-bearing: without it `Extract` collapses to the full union and the
narrowing silently vanishes — keep the signature intact if you copy it.

### Repo-Local Helpers

Most repos also have a `test_helpers.ts` for domain-specific factories
(fuz_ui, fuz_css, gro, fuz_gitops). fuz_app's test infrastructure lives
in `src/lib/testing/` (library exports, not test helpers).

```typescript
// src/test/test_helpers.ts — domain-specific example from gro
export const create_mock_task_context = <TArgs extends object = any>(
	args: Partial<TArgs> = {},
	config_overrides: Partial<GroConfig> = {},
	defaults?: TArgs,
): TaskContext<TArgs> => ({...});
```

mdz's `test_helpers.ts` also provides generic fixture infrastructure
(`load_fixtures_generic`, `run_update_task`) used by its fixture categories
(see Fixture-Based Testing below).

### Domain-Specific Helpers

Helpers for one domain go in `{domain}_test_helpers.ts` beside the tests
(`csp_test_helpers.ts`, `build_cache_test_helpers.ts`, …). Helpers for one
fixture category go **inside** that fixture directory
(`fixtures/mdz/mdz_test_helpers.ts`), not at `src/test/` root.

(svelte-docinfo keeps its `ts`/`tsdoc`/`svelte` fixture helpers in its own
`src/test/test-helpers.ts` — a pre-existing-style repo with camelCase
identifiers, not the canonical shape.)

### Svelte Component Test Helpers

fuz_ui's `test_helpers.ts` provides component lifecycle and DOM event
factories for jsdom tests:

```typescript
// src/test/test_helpers.ts — from fuz_ui
import {mount, unmount, type Component} from 'svelte';

// Component lifecycle
export const mount_component = <TProps extends Record<string, any>>(
	Component: Component<TProps>,
	props: TProps,
): {instance: any; container: HTMLElement} => {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const instance = mount(Component, {target: container, props});
	return {instance, container};
};

export const unmount_component = async (instance: any, container: HTMLElement): Promise<void> => {
	await unmount(instance);
	container.remove();
};

// DOM event factories
export const create_contextmenu_event = (x: number, y: number, options?: MouseEventInit): MouseEvent => {...};
export const create_keyboard_event = (key: string, options?: KeyboardEventInit): KeyboardEvent => {...};
export const create_mouse_event = (type: string, options?: MouseEventInit): MouseEvent => {...};
export const create_touch_event = (type: string, touches: Array<{clientX: number; clientY: number}>, options?: TouchEventInit): TouchEvent => {...};
export const set_event_target = (event: Event, target: EventTarget): void => {...};
```

## Shared Test Factories

When multiple components share behavior (e.g., `ContextmenuRoot` and
`ContextmenuRootForSafariCompatibility`), extract test logic into factory
modules exporting `create_shared_*_tests()`; test files become thin wrappers:

```typescript
// src/test/contextmenu_test_core.ts — factory module (NOT a test file)
export const create_shared_core_tests = (
	Component: any,
	component_name: string,
	options: SharedTestOptions = {}
): void => {
	describe(`${component_name} - Core Functionality`, () => {
		// shared tests here
	});
};
```

```typescript
// src/test/ContextmenuRoot.core.test.ts — thin wrapper
// @vitest-environment jsdom
import { vi } from 'vitest';
import { create_shared_core_tests } from './contextmenu_test_core.ts';
import ContextmenuRoot from '#lib/ContextmenuRoot.svelte';

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
create_shared_core_tests(ContextmenuRoot, 'ContextmenuRoot');
```

```typescript
// src/test/ContextmenuRootForSafariCompatibility.core.test.ts — same tests, different component
create_shared_core_tests(
	ContextmenuRootForSafariCompatibility,
	'ContextmenuRootForSafariCompatibility',
	{ requires_longpress: true }
);
```

`fuz_ui` uses this for contextmenu components with 8 factory modules
(`contextmenu_test_{core,rendering,keyboard,nested,positioning,scoped,edge_cases,link_entries}.ts`).

## Fixture-Based Testing

For parsers, analyzers, and transformers. Used in mdz (`mdz`,
`svelte_preprocess_mdz` features) and svelte-docinfo (`ts`, `tsdoc`, `svelte`
features), and other static-analysis tooling.

### Directory Structure

Each fixture is a subdirectory with an input and a generated `expected.json`
(mdz's layout — svelte-docinfo nests further by sub-kind, e.g.
`ts/declarations/class/`):

```
src/test/fixtures/
├── mdz/
│   ├── bold_simple/
│   │   ├── input.mdz           # test input
│   │   └── expected.json       # generated expected output
│   ├── heading/
│   │   ├── input.mdz
│   │   └── expected.json
│   ├── mdz_test_helpers.ts     # fixture-specific helpers
│   └── update.task.ts          # regeneration for this feature
└── svelte_preprocess_mdz/
    ├── bold_double_quoted/
    │   ├── input.svelte
    │   └── expected.json
    ├── svelte_preprocess_mdz_test_helpers.ts
    └── update.task.ts
```

### Update Tasks

Each feature's `update.task.ts` uses `run_update_task` from the repo's
`test_helpers.ts` — it diffs against the existing `expected.json` and only
writes on change:

```typescript
// src/test/fixtures/mdz/update.task.ts — from mdz
import type { Task } from '@fuzdev/gro';
import { join } from 'node:path';
import { mdz_parse } from '$lib/mdz.ts';
import { run_update_task } from '../../test_helpers.ts';

export const task: Task = {
	summary: 'generate expected.json files for mdz fixtures',
	run: async ({ log }) => {
		await run_update_task(
			{
				fixtures_dir: join(import.meta.dirname),
				input_extension: '.mdz',
				process: (input) => mdz_parse(input)
			},
			log
		);
	}
};
```

Run one feature: `gro src/test/fixtures/mdz/update`. A repo with several
features can add a parent task that fans out — svelte-docinfo's
`src/test/fixtures/update.task.ts` calls `invoke_task` on its `tsdoc`, `ts`,
and `svelte` children (its `svelte` child is bespoke: it builds one shared TS
program across all fixtures before analyzing each, since Svelte type analysis
needs a shared checker).

### Fixture Test Pattern

```typescript
// src/test/svelte_preprocess_mdz.fixtures.test.ts — from mdz
import { test, assert, describe, beforeAll } from 'vitest';
import {
	load_fixtures,
	run_preprocess,
	DEFAULT_TEST_OPTIONS,
	type PreprocessMdzFixture
} from './fixtures/svelte_preprocess_mdz/svelte_preprocess_mdz_test_helpers.ts';

let fixtures: Array<PreprocessMdzFixture> = [];

beforeAll(async () => {
	fixtures = await load_fixtures();
});

describe('svelte_preprocess_mdz fixtures', () => {
	test('all fixtures transform correctly', async () => {
		for (const fixture of fixtures) {
			const result = await run_preprocess(
				fixture.input,
				DEFAULT_TEST_OPTIONS,
				`${fixture.name}.svelte`
			);
			assert.equal(result, fixture.expected.code, `Fixture "${fixture.name}" failed`);
		}
	});
});
```

**CRITICAL:** Never manually create or edit `expected.json`. Only create input
files and run the update task.

### Fixture Testing in fuz_gitops

Different fixture pattern: git repositories generated from fixture data files
defining repos with dependencies, changesets, and expected outcomes.

- `src/test/fixtures/repo_fixtures/*.ts` — source of truth for test repo definitions
- `src/test/fixtures/generate_repos.ts` — idempotent repo generation logic
- `src/test/fixtures/configs/*.config.ts` — isolated gitops config per fixture
- `src/test/fixtures/check.test.ts` — validates command output against expectations
- `src/test/fixtures/mock_operations.ts` — configurable DI mocks (not vi.fn())

10 scenarios cover publishing, cascades, cycles, private packages, major
bumps, peer deps, and isolation. Repos are auto-generated on first test run;
regenerate with `gro src/test/fixtures/generate_repos`.

## Mock Patterns

### Dependency Injection (Preferred)

Functions accept a deps parameter; tests inject plain-object implementations —
no mocking library. The interfaces, factory naming, stub tiers, and the
tracking/in-memory/throwing mock shapes all live in ./dependency-injection.md;
this section covers only what's specific to writing the tests.

fuz_gitops injects mock operations via DI nearly everywhere — its one
`vi.mock()` exception is `npm_registry.test.ts`, which module-mocks fuz_util's
`spawn_out`/`wait` because that module shells out to npm with no DI seam.

### vi.mock() Usage

Legacy escape hatch, not a pattern — it exists where code predates the DI
convention (gro's build/deploy/cache tests are the big cluster) or where a
call site has no injectable seam. fuz_app module-mocks its auth `query_*`
cluster from several middleware tests (bearer auth, daemon token, rate
limiter, audit log, request context); the bearer-auth subset is factored into
`testing/middleware.ts` as table-driven `describe_bearer_auth_cases` /
`create_bearer_auth_test_app` helpers — a documented carve-out. Treat any
_new_ `vi.mock` as a signal to add a deps seam
instead. Avoid entirely in `.db.test.ts` where `isolate: false` shares
module state. When unavoidable:

- gro: `vi.clearAllMocks()` in `beforeEach`, `vi.resetAllMocks()` in `afterEach`
- `.db.test.ts`: use `vi.restoreAllMocks()` in `afterEach` —
  module-level mocks leak with `isolate: false`

### Mock Factory Naming

`create_mock_*()` pattern:

```typescript
// From gro/src/test/build_cache_test_helpers.ts
export const create_mock_build_cache_metadata = (
	overrides: Partial<BuildCacheMetadata> = {},
): BuildCacheMetadata => ({
	version: '1',
	git_commit: 'abc123',
	build_cache_config_hash: 'jkl012',
	timestamp: '2025-10-21T10:00:00.000Z',
	outputs: [],
	...overrides,
});

// From fuz_gitops/src/test/test_helpers.ts
export const create_mock_repo = (options: MockRepoOptions): LocalRepo => ({...});
```

### Mock Call Assertions

Vitest creates precise tuple types for `.mock.calls`. Use `as any`:

```typescript
const spy = vi.fn();
spy('hello', 42);

assert.deepEqual(spy.mock.calls[0], ['hello', 42] as any);
```

## Environment Flags

```typescript
// src/test/vite_plugin_examples.test.ts — from fuz_css
const SKIP = !!process.env.SKIP_EXAMPLE_TESTS;

describe.skipIf(SKIP)('vite plugin examples', () => {
	test('builds example project', async () => {
		// ... runs vite build on example projects
	});
});
```

```bash
SKIP_EXAMPLE_TESTS=1 gro test
```

| Flag                              | Repo    | Purpose                                           |
| --------------------------------- | ------- | ------------------------------------------------- |
| `SKIP_EXAMPLE_TESTS`              | fuz_css | Skip slow Vite plugin integration tests           |
| `TEST_DATABASE_URL`               | fuz_app      | Enable PostgreSQL tests (PGlite always runs) |
| `FUZ_TEST_CROSS_BACKEND`          | fuz_app, zzz | Enable the `cross_backend_*` vitest projects |
| `FUZ_TESTING_RUST_SPINE_STUB_BIN` | fuz_app | Path to the Rust spine stub binary for cross runs |

## Test Structure

### Test Organization

Organize tests with `describe` blocks. One level is common; two levels
(feature → scenario) is typical for larger modules. Use `test()`, not `it()`.

```typescript
// one level — most modules
describe('format_duration', () => {
	test('zero returns 0s', () => { ... });
	test('mixed units', () => { ... });
});

// two levels — larger modules with distinct behaviors
describe('local_repo_load', () => {
	describe('error propagation', () => {
		test('pull failure includes message', async () => { ... });
		test('checkout failure includes message', async () => { ... });
	});
	describe('skip behaviors', () => {
		test('local-only repos skip pull', async () => { ... });
	});
});
```

Flat top-level `test()` calls without `describe` are fine for very small
files, but `describe` is the default.

### Parameterized Tests

Use labeled tuple types for self-documenting test tables:

```typescript
const duration_cases: Array<[label: string, input: number, expected: string]> = [
	['zero', 0, '0s'],
	['seconds', 1000, '1s'],
	['minutes', 60000, '1m'],
	['hours', 3600000, '1h'],
	['mixed', 3661000, '1h 1m 1s']
];

describe('format_duration', () => {
	test.each(duration_cases)('%s', (_label, input, expected) => {
		assert.strictEqual(format_duration(input), expected);
	});
});
```

For larger tables, extract as a typed constant. Use `null` for "missing" cases:

```typescript
const cases: Array<[label: string, initial: string | null, key: string, expected: string]> = [
	['updates existing', 'KEY="old"', 'KEY', 'KEY="new"'],
	['creates if missing', null, 'KEY', 'KEY="new"']
];

test.each(cases)('%s', async (_label, initial, key, expected) => {
	const fs = create_mock_fs(initial !== null ? { '.env': initial } : {});
	await update(key, 'new', fs);
	assert.strictEqual(fs.get_file('.env'), expected);
});
```

Tests with dynamic expected values or extra assertions should stay standalone.

### Composable Test Suites (fuz_app)

fuz_app ships `describe_*` suite factories in `src/lib/testing/` (library
exports, not test files) that a consumer calls to inherit whole categories of
coverage — attack surface, integration, admin, audit completeness, rate
limiting, round-trip validation, data exposure — plus a `describe_standard_tests`
bundle. They take configuration (`session_options`, `create_route_specs`,
`rpc_endpoints`, `bootstrap`) and silently skip groups whose config is absent.
The suite roster and each one's options are fuz_app inventory — see its
`src/lib/testing/CLAUDE.md`.

### WebSocket Round-Trip Tests

WebSocket JSON-RPC endpoints are tested **in-process** — no HTTP server, no
Deno. The harness drives the real dispatcher and backend transport against
client connections, so per-action auth, input validation, `ctx.notify`, and
broadcast fan-out all run through real code paths. Test files follow the usual
`{module}.{aspect}.test.ts` naming.

The one convention that isn't API detail: **DB-backed WS tests** use the
`.db.test.ts` suffix and ride the same shared-PGlite factory as other DB
tests. Non-DB WS tests build a fresh harness per test — setup is cheap and
each test can supply its own ad-hoc action specs.

## Serde Boundary Conformance

Rust ↔ hand-written TS serde boundaries are guarded with a round-trip +
coverage-guard pattern rather than codegen — the full treatment lives in
./twin-impl.md §Serde boundary conformance.
