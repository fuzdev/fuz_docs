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
- [Test Structure](#test-structure) (basic, organization, parameterized)
- [Quick Reference](#quick-reference)

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

Tests live in `src/test/`, mirroring `src/lib/` subdirectories
(e.g., `src/lib/auth/` -> `src/test/auth/`).

### Test File Naming

Split large suites with dot-separated aspects:

| Pattern                            | Example                                       |
| ---------------------------------- | --------------------------------------------- |
| `{module}.test.ts`                 | `mdz.test.ts`, `ts_helpers.test.ts`           |
| `{module}.{aspect}.test.ts`        | `csp.core.test.ts`, `csp.security.test.ts`    |
| `{module}.svelte.{aspect}.test.ts` | `contextmenu_state.svelte.activation.test.ts` |
| `{module}.fixtures.test.ts`        | `svelte_preprocess_mdz.fixtures.test.ts`      |
| `{module}.db.test.ts`              | `account_queries.db.test.ts`                  |
| `{module}.integration.db.test.ts`  | `invite_signup.integration.db.test.ts`        |

Module name matches source file. `.svelte.` preserves the source extension.

Real examples:

- fuz_util: `deep_equal.arrays.test.ts`, `log.core.test.ts`, `log.caching.test.ts`
- gro: `build_cache.creation.test.ts`, `deploy_task.errors.test.ts`
- fuz_ui: `ContextmenuRoot.core.test.ts`, `csp.security.test.ts`
- fuz_css: `css_class_extractor.elements.test.ts`, `css_ruleset_parser.modifiers.test.ts`
- zzz: `cell.svelte.base.test.ts`, `indexed_collection.svelte.queries.test.ts`
- fuz_app: `rate_limiter.bootstrap.db.test.ts`, `request_context.ws.db.test.ts`

### Assertions

Use `assert` from vitest. Choose methods for TypeScript type narrowing, not
semantic precision. `assert.ok` is the standard guard for narrowing
`T | undefined` to `T` — don't replace it with `assert.isDefined` or other
methods unless the replacement provides better failure diagnostics without
losing narrowing.

```typescript
import {test, assert} from 'vitest';

assert.ok(value); // narrows away null/undefined — the standard guard
assert.strictEqual(a, b);
assert.deepStrictEqual(a, b);
```

Strengthen assertions when the value is **known** — use `assert.strictEqual`
for exact expected values, `assert.include`/`assert.notInclude` for array
membership (shows actual contents on failure). Leave `assert.ok` for guards
where the goal is narrowing, not value checking.

**Why `assert` over `expect`:** `assert` methods narrow types for TypeScript.
`expect` chains don't:

```typescript
// assert narrows — no type error
const result: string | Error = await get_result();
assert(result instanceof Error);
result.message; // TypeScript knows this is Error

// expect doesn't narrow — type error on .message
expect(result).toBeInstanceOf(Error);
result.message; // Property 'message' does not exist on type 'string | Error'
```

After `assert.isDefined(x)`, the type is `NonNullable<T>` — no `!` needed:

```typescript
assert.isDefined(result);
assert.strictEqual(result.id, expected_id); // no result! needed
```

Name custom assertion helpers `assert_*` (not `expect_*`).
Example: `assert_css_contains()` not `expect_css_contains()`.

For throw assertions, use `assert.throws()` with Error constructor, string,
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
TLDs, or arbitrary strings. The convention keeps test fixtures consistent
across the ecosystem and signals that the domain is owned/controllable.

```typescript
// Anonymous placeholders — letters for "any domain"
const A = src('a.fuz.dev');
const B = src('b.fuz.dev');

// Scenario placeholders — pick a meaningful subdomain
const cdn = src('cdn.fuz.dev');
const api = src('https://api.fuz.dev/');
const untrusted = src('untrusted-cdn.fuz.dev');

// Generated placeholders
Array.from({length: 100}, (_, i) => src(`source${i}.fuz.dev`));
```

Real third-party domains (`fonts.googleapis.com`, `js.stripe.com`,
`cdnjs.cloudflare.com`) are fine when the test specifically documents
integration with that vendor.

### Async Rejection Testing

For async functions that should reject, use `assert_rejects` from
`@fuzdev/fuz_util/testing.js`. It places `assert.fail` outside the catch
block to prevent accidentally catching assertion errors from the test itself:

```typescript
import {assert_rejects} from '@fuzdev/fuz_util/testing.js';

// Simple — just check the error pattern
await assert_rejects(
	() => local_repo_load({local_repo_path, git_ops, npm_ops}),
	/Failed to pull.*unstaged changes/,
);

// Pattern is optional — returns the Error for further assertions
const err = await assert_rejects(() =>
	local_repos_load({local_repo_paths: paths, git_ops, npm_ops}),
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
import {vi} from 'vitest';

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
```

## Database Testing

fuz_app provides database testing infrastructure. Only fuz_app uses this
pattern currently.

### The `.db.test.ts` Convention

Any test using a `Db` instance should use `.db.test.ts` suffix. `.db` always
goes immediately before `.test.ts` — e.g., `foo.integration.db.test.ts`.

Vitest `projects` runs all DB tests in a single worker (`isolate: false` +
`fileParallelism: false`), sharing one PGlite WASM instance (~500-700ms
cold start saved per file). Non-DB tests stay fully parallel.

### Vitest Projects Configuration

From fuz_app's `vite.config.ts`:

```typescript
import {availableParallelism} from 'node:os';
import {defineConfig} from 'vitest/config';
import {sveltekit} from '@sveltejs/kit/vite';

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
					exclude: ['src/test/**/*.db.test.ts'],
					maxWorkers: max_threads,
					sequence: {groupOrder: 1},
				},
			},
			{
				extends: true,
				test: {
					name: 'db',
					include: ['src/test/**/*.db.test.ts'],
					isolate: false,
					fileParallelism: false,
					sequence: {groupOrder: 2},
				},
			},
		],
	},
});
```

Because `isolate: false` shares module state, avoid `vi.mock()` in
`.db.test.ts` files. If needed, pair with `vi.restoreAllMocks()` (not
`vi.clearAllMocks()`) in `afterEach`.

### describe_db Pattern

fuz_app's `testing/db.ts` provides `create_describe_db(factories, truncate_tables)`.
Consumer projects create a `db_fixture.ts`:

```typescript
// src/test/db_fixture.ts
import type {Db} from '$lib/db/db.js';
import {run_migrations} from '$lib/db/migrate.js';
import {AUTH_MIGRATION_NS} from '$lib/auth/migrations.js';
import {
	create_pglite_factory,
	create_pg_factory,
	create_describe_db,
	AUTH_INTEGRATION_TRUNCATE_TABLES,
	log_db_factory_status,
} from '$lib/testing/db.js';

const init_schema = async (db: Db): Promise<void> => {
	await run_migrations(db, [AUTH_MIGRATION_NS]);
};

export const pglite_factory = create_pglite_factory(init_schema);
export const pg_factory = create_pg_factory(init_schema, process.env.TEST_DATABASE_URL);
export const db_factories = [pglite_factory, pg_factory];

log_db_factory_status(db_factories);

export const describe_db = create_describe_db(db_factories, AUTH_INTEGRATION_TRUNCATE_TABLES);
```

Test files import and use as a wrapper:

```typescript
// src/test/auth/account_queries.db.test.ts
import {describe, assert, test} from 'vitest';
import {query_create_account} from '$lib/auth/account_queries.js';
import {describe_db} from '../db_fixture.js';

describe_db('account queries', (get_db) => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const deps = {db};
		const account = await query_create_account(deps, {
			username: 'alice',
			password_hash: 'hash123',
		});
		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
```

### Integration Tests

Named `.integration.db.test.ts`. Use `create_test_app()` from
`$lib/testing/app_server.js` for a full Hono app with middleware, routes, and
database:

```typescript
const {app, create_session_headers, create_bearer_headers, create_account, cleanup} =
	await create_test_app({
		session_options: create_session_config('test_session'),
		create_route_specs: (ctx) => my_routes(ctx),
	});
```

### PGlite WASM Caching

`create_pglite_factory` instances in the same worker share a single PGlite
WASM instance via module-level cache. Subsequent calls reset the schema
(`DROP SCHEMA public CASCADE`) instead of paying cold-start cost.

## Test Helpers

### Shared Helpers (`@fuzdev/fuz_util/testing.js`)

Cross-repo test assertions live in `@fuzdev/fuz_util/testing.js`. Only
depends on vitest — safe for fuz_util's zero-runtime-deps constraint.

```typescript
import {assert_rejects, create_mock_logger} from '@fuzdev/fuz_util/testing.js';

// Async rejection — pattern is optional, returns Error
const err = await assert_rejects(() => do_thing(), /expected pattern/);

// Mock logger — vi.fn() methods + tracking arrays
const log = create_mock_logger();
do_thing(log);
assert.deepEqual(log.info_calls, ['expected message']);
```

For `Result` assertions, use `assert.ok(result.ok)` directly — `assert`
narrows discriminated unions, so no wrapper is needed.

### Repo-Local Helpers

Most repos also have `test_helpers.ts` for domain-specific factories
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

fuz_ui's `test_helpers.ts` also provides generic fixture infrastructure
(`load_fixtures_generic`, `run_update_task`) used by all fixture categories.

### Domain-Specific Helpers

`{domain}_test_helpers.ts` pattern:

| File                                  | Repo     | Purpose                                             |
| ------------------------------------- | -------- | --------------------------------------------------- |
| `csp_test_helpers.ts`                 | fuz_ui   | CSP test constants and source factories             |
| `contextmenu_test_helpers.ts`         | fuz_ui   | Contextmenu mounting and attachment setup           |
| `module_test_helpers.ts`              | fuz_ui   | Module analysis test options and program setup      |
| `deep_equal_test_helpers.ts`          | fuz_util | Bidirectional equality assertions and batch helpers |
| `log_test_helpers.ts`                 | fuz_util | Logger mock console with captured args              |
| `random_test_helpers.ts`              | fuz_util | Custom PRNG factories for distribution testing      |
| `build_cache_test_helpers.ts`         | gro      | Build cache mock factories                          |
| `build_task_test_helpers.ts`          | gro      | Build task context and mock plugins                 |
| `deploy_task_test_helpers.ts`         | gro      | Deploy task context and git mock setup              |
| `css_class_extractor_test_helpers.ts` | fuz_css  | Extractor assertion helpers                         |

Fixture-specific helpers live inside the fixture directory:

| File                                                                   | Repo   | Purpose                      |
| ---------------------------------------------------------------------- | ------ | ---------------------------- |
| `fixtures/mdz/mdz_test_helpers.ts`                                     | fuz_ui | mdz fixture loading          |
| `fixtures/tsdoc/tsdoc_test_helpers.ts`                                 | fuz_ui | tsdoc fixture loading        |
| `fixtures/ts/ts_test_helpers.ts`                                       | fuz_ui | TypeScript fixture loading   |
| `fixtures/svelte/svelte_test_helpers.ts`                               | fuz_ui | Svelte fixture loading       |
| `fixtures/svelte_preprocess_mdz/svelte_preprocess_mdz_test_helpers.ts` | fuz_ui | Preprocessor fixture loading |

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

// Fixture utilities
export const normalize_json = (obj: any): any => {...};
export const load_fixtures_generic = async <T>(config: FixtureLoaderConfig<T>): Promise<Array<GenericFixture<T>>> => {...};
export const run_update_task = async <TInput, TOutput>(config: UpdateTaskConfig<TInput, TOutput>, log): Promise<{...}> => {...};
```

## Shared Test Factories

When multiple components share behavior (e.g., `ContextmenuRoot` and
`ContextmenuRootForSafariCompatibility`), extract test logic into factory
modules exporting `create_shared_*_tests()`. Test files become thin wrappers:

```typescript
// src/test/contextmenu_test_core.ts — factory module (NOT a test file)
export const create_shared_core_tests = (
	Component: any,
	component_name: string,
	options: SharedTestOptions = {},
): void => {
	describe(`${component_name} - Core Functionality`, () => {
		// shared tests here
	});
};
```

```typescript
// src/test/ContextmenuRoot.core.test.ts — thin wrapper
// @vitest-environment jsdom
import {vi} from 'vitest';
import {create_shared_core_tests} from './contextmenu_test_core.js';
import ContextmenuRoot from '$lib/ContextmenuRoot.svelte';

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
create_shared_core_tests(ContextmenuRoot, 'ContextmenuRoot');
```

```typescript
// src/test/ContextmenuRootForSafariCompatibility.core.test.ts — same tests, different component
create_shared_core_tests(
	ContextmenuRootForSafariCompatibility,
	'ContextmenuRootForSafariCompatibility',
	{requires_longpress: true},
);
```

fuz*ui uses this for contextmenu components with 8 factory modules
(`contextmenu_test*{core,rendering,keyboard,nested,positioning,scoped,edge_cases,link_entries}.ts`).

## Fixture-Based Testing

For parsers, analyzers, and transformers. Used in fuz_ui (mdz, tsdoc, ts,
svelte, svelte_preprocess_mdz) and private_svelte-docinfo.

### Directory Structure

Each fixture is a subdirectory with input and generated `expected.json`:

```
src/test/fixtures/
├── update.task.ts              # parent: invokes all child update tasks
├── mdz/
│   ├── bold_simple/
│   │   ├── input.mdz           # test input
│   │   └── expected.json       # generated expected output
│   ├── heading/
│   │   ├── input.mdz
│   │   └── expected.json
│   ├── mdz_test_helpers.ts     # fixture-specific helpers
│   └── update.task.ts          # regeneration for this feature
├── tsdoc/
│   ├── comment_description_only/
│   │   ├── input.ts
│   │   └── expected.json
│   ├── tsdoc_test_helpers.ts
│   └── update.task.ts
└── svelte_preprocess_mdz/
    ├── bold_double_quoted/
    │   ├── input.svelte
    │   └── expected.json
    ├── svelte_preprocess_mdz_test_helpers.ts
    └── update.task.ts
```

### Parent Update Task

```typescript
// src/test/fixtures/update.task.ts — from fuz_ui
import type {Task} from '@fuzdev/gro';

export const task: Task = {
	summary: 'generate all fixture expected.json files',
	run: async ({invoke_task, log}) => {
		log.info('updating mdz fixtures...');
		await invoke_task('src/test/fixtures/mdz/update');

		log.info('updating tsdoc fixtures...');
		await invoke_task('src/test/fixtures/tsdoc/update');

		log.info('updating ts fixtures...');
		await invoke_task('src/test/fixtures/ts/update');

		log.info('updating svelte fixtures...');
		await invoke_task('src/test/fixtures/svelte/update');

		log.info('updating svelte_preprocess_mdz fixtures...');
		await invoke_task('src/test/fixtures/svelte_preprocess_mdz/update');

		log.info('all fixtures updated!');
	},
};
```

Run all: `gro src/test/fixtures/update`
Run one: `gro src/test/fixtures/mdz/update`

### Child Update Task

Each feature's `update.task.ts` uses `run_update_task`:

```typescript
// src/test/fixtures/mdz/update.task.ts — from fuz_ui
import type {Task} from '@fuzdev/gro';
import {join} from 'node:path';
import {mdz_parse} from '$lib/mdz.js';
import {run_update_task} from '../../test_helpers.js';

export const task: Task = {
	summary: 'generate expected.json files for mdz fixtures',
	run: async ({log}) => {
		await run_update_task(
			{
				fixtures_dir: join(import.meta.dirname),
				input_extension: '.mdz',
				process: (input) => mdz_parse(input),
			},
			log,
		);
	},
};
```

### Fixture Test Pattern

```typescript
// src/test/svelte_preprocess_mdz.fixtures.test.ts — from fuz_ui
import {test, assert, describe, beforeAll} from 'vitest';
import {
	load_fixtures,
	run_preprocess,
	DEFAULT_TEST_OPTIONS,
	type PreprocessMdzFixture,
} from './fixtures/svelte_preprocess_mdz/svelte_preprocess_mdz_test_helpers.js';

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
				`${fixture.name}.svelte`,
			);
			assert.equal(result, fixture.expected.code, `Fixture "${fixture.name}" failed`);
		}
	});
});
```

**CRITICAL:** Never manually create or edit `expected.json`. Only create input
files and run the update task.

### Fixture Testing in fuz_gitops

Different fixture pattern: generated git repositories from fixture data files.
Fixtures define repos with dependencies, changesets, and expected outcomes.

- `src/test/fixtures/repo_fixtures/*.ts` — source of truth for test repo definitions
- `src/test/fixtures/generate_repos.ts` — idempotent repo generation logic
- `src/test/fixtures/configs/*.config.ts` — isolated gitops config per fixture
- `src/test/fixtures/check.test.ts` — validates command output against expectations
- `src/test/fixtures/mock_operations.ts` — configurable DI mocks (not vi.fn())

10 scenarios covering publishing, cascades, cycles, private packages, major
bumps, peer deps, and isolation. Repos auto-generated on first test run;
regenerate with `gro src/test/fixtures/generate_repos`.

## Mock Patterns

### Dependency Injection (Preferred)

DI via small `*Deps` or `*Operations` interfaces. Functions accept an
operations parameter with a default; tests inject controlled implementations.
See [dependency-injection.md](./dependency-injection.md) for the full pattern.

**fuz_gitops operations pattern:**

```typescript
// src/lib/operations.ts — interfaces for all side effects
// each method uses options objects and returns Result
export interface GitOperations {
	current_branch_name: (options?: {
		cwd?: string;
	}) => Promise<Result<{value: string}, {message: string}>>;
	add_and_commit: (options: {
		files: string | Array<string>;
		message: string;
		cwd?: string;
	}) => Promise<Result<object, {message: string}>>;
	// ... ~15 more methods
}
export interface GitopsOperations {
	git: GitOperations;
	npm: NpmOperations;
	fs: FsOperations;
	// ...
}

// Production: multi_repo_publisher(repos, options, default_gitops_operations)
// Tests: multi_repo_publisher(repos, options, mock_operations)
```

```typescript
// src/test/test_helpers.ts — from fuz_gitops
// Granular factories per operations interface:
export const create_mock_git_ops = (): GitOperations => ({...});
export const create_mock_repo = (options: MockRepoOptions): LocalRepo => ({...});
export const create_mock_gitops_ops = (overrides?): GitopsOperations => ({...});

// src/test/fixtures/mock_operations.ts — configurable mocks for fixture tests
export const create_mock_git_ops = (): GitOperations => ({
	current_branch_name: async () => ({ok: true, value: 'main'}),
	// ... plain objects implementing interfaces, no vi.fn()
});
```

fuz_gitops uses **zero vi.mock()** — all tests inject mock operations via DI.

**fuz_app deps pattern:**

```typescript
import {stub_app_deps} from '$lib/testing/stubs.js';
import {create_mock_runtime} from '$lib/runtime/mock.js';

const deps = stub_app_deps; // throwing stubs for auth deps
const runtime = create_mock_runtime(); // MockRuntime for CLI tests
```

### vi.mock() Usage

Used in gro and some fuz_app unit tests. Avoid in `.db.test.ts` where
`isolate: false` shares module state. When needed:

- gro: `vi.clearAllMocks()` in `beforeEach`, `vi.resetAllMocks()` in `afterEach`
- `.db.test.ts`: if unavoidable, use `vi.restoreAllMocks()` in `afterEach` —
  module-level mocks leak with `isolate: false`
- Prefer DI when possible

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

| Flag                 | Repo    | Purpose                                      |
| -------------------- | ------- | -------------------------------------------- |
| `SKIP_EXAMPLE_TESTS` | fuz_css | Skip slow Vite plugin integration tests      |
| `TEST_DATABASE_URL`  | fuz_app | Enable PostgreSQL tests (PGlite always runs) |

## Test Structure

### Basic Test Pattern

```typescript
import {describe, test, assert} from 'vitest';
import {query_create_account} from '$lib/auth/account_queries.js';

describe('account queries', () => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const account = await query_create_account(
			{db},
			{
				username: 'alice',
				password_hash: 'hash123',
			},
		);

		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
```

### Test Organization

Use `describe` blocks to organize tests. One level is common; two levels
(feature → scenario) is typical for larger modules. Use `test()` not `it()`.

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

Labeled tuple types for self-documenting test tables:

```typescript
const duration_cases: Array<[label: string, input: number, expected: string]> = [
	['zero', 0, '0s'],
	['seconds', 1000, '1s'],
	['minutes', 60000, '1m'],
	['hours', 3600000, '1h'],
	['mixed', 3661000, '1h 1m 1s'],
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
	['creates if missing', null, 'KEY', 'KEY="new"'],
];

test.each(cases)('%s', async (_label, initial, key, expected) => {
	const fs = create_mock_fs(initial !== null ? {'.env': initial} : {});
	await update(key, 'new', fs);
	assert.strictEqual(fs.get('.env'), expected);
});
```

Object array form with `$prop` interpolation:

```typescript
const POSITION_CASES = [
	{position: 'left', align: 'start', expected: {right: '100%', top: '0px'}},
	{position: 'right', align: 'center', expected: {left: '100%', top: '50%'}},
];

test.each(POSITION_CASES)(
	'$position/$align applies correct styles',
	({position, align, expected}) => {
		const styles = generate_position_styles(position, align);
		for (const [prop, value] of Object.entries(expected)) {
			assert.strictEqual(styles[prop], value, `style '${prop}'`);
		}
	},
);
```

Tests with dynamic expected values or extra assertions should stay standalone.

### Composable Test Suites (fuz_app)

| Suite                                       | Groups | Purpose                                         |
| ------------------------------------------- | ------ | ----------------------------------------------- |
| `describe_standard_attack_surface_tests`    | 5      | Snapshot, structure, adversarial auth/input/404 |
| `describe_standard_integration_tests`       | 10     | Login, cookies, sessions, bearer, passwords     |
| `describe_standard_admin_integration_tests` | 7      | Accounts, permits, sessions, audit log          |
| `describe_rate_limiting_tests`              | 3      | IP, per-account, bearer rate limiting           |
| `describe_round_trip_validation`            | varies | Schema-driven positive-path validation          |
| `describe_data_exposure_tests`              | 6      | Schema-level + runtime field blocklists         |
| `describe_standard_adversarial_headers`     | 7      | Header injection cases                          |
| `describe_standard_tests`                   | -      | Convenience wrapper: integration + admin        |

Live in `fuz_app/src/lib/testing/` (library exports, not test files). Accept
configuration with `session_options` and `create_route_specs`.

### WebSocket Round-Trip Tests

WebSocket JSON-RPC endpoints are tested in-process via
`@fuzdev/fuz_app/testing/ws_round_trip.js` — no HTTP server, no Deno. The
harness drives the real `register_action_ws` dispatcher and
`BackendWebsocketTransport` against `MockWsClient` connections, so
per-action auth, input validation, `ctx.notify`, and broadcast fan-out
all run through the real code paths.

Convention (used in tx, zzz, undying.dealt.dev):

1. **All round-trip helpers live in fuz_app**
   (`@fuzdev/fuz_app/testing/ws_round_trip.js`):
   - `create_ws_test_harness({specs, handlers, ...})` → `{transport,
     connect}`. `connect(identity?)` is async and resolves after
     `on_socket_open` completes. Passes through `register_action_ws`
     options (`on_socket_open`, `on_socket_close`, `extend_context`,
     `transport`, `log`); share a `BackendWebsocketTransport` via the
     `transport` option to test cross-harness broadcast fan-out.
   - `MockWsClient.request<R>(id, method, params, timeout?)` — the
     default for request/response. Returns `result` on success; throws
     `rpc #id failed: [code] message data=...` on error frames.
   - `client.send(message)` + `client.wait_for(predicate)` — raw
     primitives. Use them to assert on an error frame directly (e.g.
     `-32602` + zod issues) or when the request never resolves
     (`ctx.signal` abort tests).
   - Predicates: `is_notification(method)`, `is_response_for(id)`, and
     `is_notification_with<P>(method, (params) => boolean)` — a type
     guard that narrows `wait_for` / `messages.filter` results without
     an explicit `<T>` at the call site.
   - Wire-frame types for narrowing: `JsonrpcNotificationFrame<P>`,
     `JsonrpcSuccessResponseFrame<R>`, `JsonrpcErrorResponseFrame<D>`.
   - `build_broadcast_api<TApi>({harness, specs})` — wires peer +
     transport + typed broadcast API, mirroring real backend assembly.
   - `keeper_identity()` — default identity for keeper-authed connections.

2. **Repo-local `ws_test_harness.ts` is only for project-specific
   setup** — not a re-implementation of the above. undying has one
   (memoized pglite+schema+seed+world_state init per worker, plus a
   `make_client_tracker` that closes tracked clients in `afterEach`
   because module-level world_state leaks between tests). tx and zzz
   have no repo-local harness at all — tests import directly from
   `@fuzdev/fuz_app/testing/ws_round_trip.js`.

3. **Split test files by aspect** (same as other test suites —
   see _Test File Naming_ above):
   - `ws.integration.dispatch.test.ts` — request/response, `ctx.notify`,
     per-action auth, input validation, `ctx.signal`, concurrent requests
   - `ws.integration.broadcast.test.ts` — `create_broadcast_api`
     fan-out, close-removes-from-transport

4. **DB-backed WS tests** (e.g. undying.dealt.dev) use the
   `.db.test.ts` suffix and memoize the harness per worker since
   `isolate: false` + `fileParallelism: false` means module-level state
   (world_state globals, embodiments map) would otherwise double-init.
   Non-DB WS tests (tx, zzz) build a fresh harness per test — setup
   is cheap and each test can supply its own ad-hoc specs + handlers.

## Quick Reference

| Pattern                           | Purpose                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `src/test/`                       | All tests live here, not co-located                                |
| `src/test/domain/`                | Mirrors `src/lib/domain/` subdirectories                           |
| `module.aspect.test.ts`           | Split test suites by aspect                                        |
| `module.db.test.ts`               | DB test — shared WASM worker via vitest projects                   |
| `module.fixtures.test.ts`         | Fixture-based test file                                            |
| `test_helpers.ts`                 | General shared test utilities (most repos)                         |
| `{domain}_test_helpers.ts`        | Domain-specific test utilities                                     |
| `{domain}_test_{aspect}.ts`       | Shared test factory modules (not test files)                       |
| `create_shared_*_tests()`         | Factory function for reusable test suites                          |
| `fixtures/feature/case/`          | Subdirectory per fixture case                                      |
| `fixtures/update.task.ts`         | Parent: runs all child update tasks                                |
| `fixtures/feature/update.task.ts` | Child: regenerates one feature                                     |
| `assert` from vitest              | Ecosystem-wide standard                                            |
| `assert.isDefined(x); x.prop`     | Narrows to NonNullable — no `x!` needed                            |
| `assert(x instanceof T); x.prop`  | Narrows union types — the key advantage over `expect`              |
| `assert.throws(fn, /regex/)`      | Returns void; second arg: constructor/string/RegExp (not function) |
| `assert_rejects(fn, /regex?/)`    | Shared — async rejection, optional pattern, returns Error          |
| `create_mock_logger()`            | Shared — `vi.fn()` methods + tracking arrays                       |
| try/catch + `assert.include`      | For inspecting thrown errors when helper isn't enough              |
| `assert_*` (not `expect_*`)       | Custom assertion helper naming convention                          |
| `describe` + `test` (not `it`)    | Default structure; 1-2 levels of `describe` typical                |
| `// @vitest-environment jsdom`    | Pragma for UI tests needing DOM                                    |
| `vi.stubGlobal('ResizeObserver')` | Required in jsdom for components using ResizeObserver              |
| `describe_db(name, fn)`           | DB test wrapper (fuz_app)                                          |
| `create_test_app()`               | Full Hono app for integration tests (fuz_app)                      |
| `create_ws_test_harness()`        | In-process WS JSON-RPC harness (fuz_app); async `connect()`        |
| `client.request(id, method, ...)` | Send + await response; throws on error frame                       |
| `build_broadcast_api({harness})`  | Typed broadcast API wired to the harness transport (fuz_app)       |
| `ws_test_harness.ts` (repo-local) | Only for project-specific setup (memoized DB, client tracking)     |
| `stub_app_deps`                   | Throwing stub deps for unit tests (fuz_app)                        |
| DI via `*Operations`/`*Deps`      | Preferred over vi.mock() for side effects                          |
| `create_mock_*()`                 | Factory functions for test data                                    |
| `SKIP_EXAMPLE_TESTS=1`            | Skip slow fuz_css integration tests                                |
| `TEST_DATABASE_URL`               | Enable PostgreSQL tests alongside PGlite                           |
| Never edit `expected.json`        | Always regenerate via task                                         |
