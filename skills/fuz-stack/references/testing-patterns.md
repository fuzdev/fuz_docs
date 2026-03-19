# Testing Patterns

Testing conventions for the Fuz stack: vitest usage, fixtures, mocks, helpers.

## Contents

- [File Organization](#file-organization) (naming, subdirectories, assertions, jsdom)
- [Database Testing](#database-testing) (PGlite, vitest projects, describe_db)
- [Test Helpers](#test-helpers)
- [Fixture-Based Testing](#fixture-based-testing)
- [Mock Patterns](#mock-patterns)
- [Environment Flags](#environment-flags)
- [Test Structure](#test-structure) (basic, async, parameterized)
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

Tests are NOT co-located with source. All tests live in `src/test/`.

When source uses domain subdirectories (`src/lib/auth/`, `src/lib/env/`),
tests mirror that structure (`src/test/auth/`, `src/test/env/`).

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

Prefer `assert` from vitest in core repos (fuz_app, fuz_ui, fuz_util). Choose
methods for TypeScript type narrowing, not semantic precision:

```typescript
import {test, assert} from 'vitest';

assert.ok(value);            // narrows away null/undefined
assert.strictEqual(a, b);
assert.deepStrictEqual(a, b);
```

After `assert.isDefined(x)`, the type is `NonNullable<T>` — no `!` needed:

```typescript
assert.isDefined(result);
assert.strictEqual(result.id, expected_id); // no result! needed
```

Some repos (gro, zzz, fuz_css, fuz_gitops) use `expect` — follow existing
convention per repo. For new projects, prefer `assert`.

For throw assertions, use `assert.throws()` with Error constructor, string,
or RegExp. **Do not pass a function predicate** — causes
`"errorLike is not a constructor"`:

```typescript
import {test, assert} from 'vitest';

// Good — RegExp matching
assert.throws(() => fn(), /expected message/);

// Good — Error constructor
assert.throws(() => fn(), TypeError);

// BAD — function predicate does NOT work with chai assert.throws
// assert.throws(() => fn(), (e: any) => e.message.includes('msg'));

assert.doesNotThrow(() => fn());
```

`assert.throws()` returns `void`. To inspect the error, use try/catch:

```typescript
try {
	fn();
	assert.fail('Expected error');
} catch (e: any) {
	assert.include(e.message, 'expected substring');
	assert.strictEqual(e.code, 'EXPECTED_CODE');
}
```

For async rejects, same try/catch pattern:

```typescript
try {
	await async_fn();
	assert.fail('Expected error');
} catch (e: any) {
	assert.include(e.message, 'expected substring');
}
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

## Database Testing

fuz_app provides database testing infrastructure. Only fuz_app currently uses
this pattern.

### The `.db.test.ts` Convention

Any test using a `Db` instance should use `.db.test.ts` suffix. `.db` always
goes immediately before `.test.ts` — e.g., `foo.integration.db.test.ts`.

Enables vitest `projects` to run all DB tests in a single worker with
`isolate: false` + `fileParallelism: false`, sharing one PGlite WASM instance
(~500-700ms cold start saved per file). Non-DB tests stay fully parallel.

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
} from '$lib/testing/db.js';

const init_schema = async (db: Db): Promise<void> => {
	await run_migrations(db, [AUTH_MIGRATION_NS]);
};

export const pglite_factory = create_pglite_factory(init_schema);
export const pg_factory = create_pg_factory(init_schema, process.env.TEST_DATABASE_URL);
export const db_factories = [pglite_factory, pg_factory];

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

All `create_pglite_factory` instances in the same worker share a single PGlite
WASM instance via module-level cache. Subsequent `factory.create()` calls reset
the schema (`DROP SCHEMA public CASCADE`) instead of paying the cold-start cost.

## Test Helpers

### General Helpers

Each repo has `test_helpers.ts`:

```typescript
// src/test/test_helpers.ts — from gro
import type {Logger} from '@fuzdev/fuz_util/log.js';
import {vi} from 'vitest';

/**
 * Creates a mock logger for testing.
 */
export const create_mock_logger = (): Logger => ({...});

/**
 * Creates mock build cache metadata for testing.
 */
export const create_mock_build_cache_metadata = (
	overrides: Partial<BuildCacheMetadata> = {},
): BuildCacheMetadata => ({
	version: '1',
	git_commit: 'abc123',
	timestamp: '2025-10-21T10:00:00.000Z',
	outputs: [],
	...overrides,
});
```

### Domain-Specific Helpers

`{domain}_test_helpers.ts` pattern:

| File                                 | Repo     | Purpose                                  |
| ------------------------------------ | -------- | ---------------------------------------- |
| `test_helpers.ts`                    | all      | General shared helpers                   |
| `csp_test_helpers.ts`               | fuz_ui   | CSP policy test utilities                |
| `contextmenu_test_helpers.ts`       | fuz_ui   | DOM event factories, mount/unmount       |
| `deep_equal_test_helpers.ts`        | fuz_util | Deep equality test cases                 |
| `log_test_helpers.ts`               | fuz_util | Logger mock setup                        |
| `build_cache_test_helpers.ts`       | gro      | Build cache mock factories               |
| `deploy_task_test_helpers.ts`       | gro      | Deploy task mock operations              |
| `css_class_extractor_test_helpers.ts`| fuz_css  | Extractor assertion helpers              |

Fixture-specific helpers live inside the fixture directory:

| File                                       | Repo    | Purpose                      |
| ------------------------------------------ | ------- | ---------------------------- |
| `fixtures/mdz/mdz_test_helpers.ts`        | fuz_ui  | mdz fixture loading          |
| `fixtures/tsdoc/tsdoc_test_helpers.ts`    | fuz_ui  | tsdoc fixture loading        |
| `fixtures/svelte/svelte_test_helpers.ts`  | fuz_ui  | svelte fixture loading       |

### Svelte Component Test Helpers

For UI tests with jsdom:

```typescript
// src/test/test_helpers.ts — from fuz_ui
import {mount, unmount, type Component} from 'svelte';

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
```

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
Fixtures define repos with dependencies, changesets, and expected outcomes. See
`src/test/fixtures/generate_repos.ts` and `src/test/fixtures/check.test.ts`.

## Mock Patterns

### Dependency Injection (Preferred)

DI via small `*Deps` or `*Operations` interfaces. Functions accept an
operations parameter with a default; tests inject controlled implementations.

**fuz_gitops operations pattern:**

```typescript
// src/lib/operations.ts — interfaces for all side effects
export interface GitOperations {
	commit: (dir: string, msg: string) => Promise<void>;
	push: (dir: string) => Promise<void>;
	// ...
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
export const create_mock_operations = (): GitopsOperations => ({
	git: {
		commit: vi.fn(),
		push: vi.fn(),
		// ...
	},
	npm: {
		publish: vi.fn(),
		// ...
	},
	// ...
});
```

**fuz_app deps pattern:**

```typescript
import {stub_app_deps} from '$lib/testing/stubs.js';
import {create_mock_runtime} from '$lib/runtime/mock.js';

const deps = stub_app_deps();          // safe defaults for auth deps
const runtime = create_mock_runtime(); // MockRuntime for CLI tests
```

### vi.mock() Usage

Used in gro and some fuz_app unit tests, but avoid in `.db.test.ts` where
`isolate: false` shares module state. When needed:

- Pair with `vi.restoreAllMocks()` in `afterEach`
- Prefer DI-based testing when possible

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

Vitest mock typing creates precise tuple types for `.mock.calls`. Use `as any`:

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

| Flag                 | Repo    | Purpose                             |
| -------------------- | ------- | ----------------------------------- |
| `SKIP_EXAMPLE_TESTS` | fuz_css | Skip slow Vite plugin integration tests |
| `TEST_DATABASE_URL`  | fuz_app | Enable PostgreSQL tests (PGlite always runs) |

## Test Structure

### Basic Test Pattern

```typescript
import {describe, test, assert} from 'vitest';
import {query_create_account} from '$lib/auth/account_queries.js';

describe('account queries', () => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const account = await query_create_account({db}, {
			username: 'alice',
			password_hash: 'hash123',
		});

		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
```

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

For larger tables, extract as a typed constant. Use `null` sentinels for
"missing" cases:

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

Tests that compute expected values dynamically or need extra assertions should
stay standalone.

### Composable Test Suites (fuz_app)

| Suite                                          | Groups | Purpose                                  |
| ---------------------------------------------- | ------ | ---------------------------------------- |
| `describe_standard_attack_surface_tests`      | 5      | Snapshot, structure, adversarial auth/input/404 |
| `describe_standard_integration_tests`         | 10     | Login, cookies, sessions, bearer, passwords |
| `describe_standard_admin_integration_tests`   | 7      | Accounts, permits, sessions, audit log   |
| `describe_rate_limiting_tests`                | 3      | IP, per-account, bearer rate limiting    |
| `describe_round_trip_validation`              | varies | Schema-driven positive-path validation   |
| `describe_standard_adversarial_headers`       | 7      | Header injection cases                   |

Live in `fuz_app/src/lib/testing/` (library exports, not test files). Accept
configuration with `session_options` and `create_route_specs`.

## Quick Reference

| Pattern                           | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `src/test/`                       | All tests live here, not co-located              |
| `src/test/domain/`               | Mirrors `src/lib/domain/` subdirectories         |
| `module.aspect.test.ts`           | Split test suites by aspect                      |
| `module.db.test.ts`               | DB test — shared WASM worker via vitest projects |
| `module.fixtures.test.ts`         | Fixture-based test file                          |
| `test_helpers.ts`                 | General shared test utilities                    |
| `{domain}_test_helpers.ts`       | Domain-specific test utilities                   |
| `fixtures/feature/case/`          | Subdirectory per fixture case                    |
| `fixtures/update.task.ts`         | Parent: runs all child update tasks              |
| `fixtures/feature/update.task.ts` | Child: regenerates one feature                   |
| `assert` from vitest              | Preferred in core repos; follow existing convention per repo |
| `assert.isDefined(x); x.prop`    | Narrows to NonNullable — no `x!` needed          |
| `assert.throws(fn, /regex/)`     | Returns void; second arg: constructor/string/RegExp (not function) |
| try/catch + `assert.include`     | For inspecting thrown errors or async rejects    |
| `// @vitest-environment jsdom`    | Pragma for UI tests needing DOM                  |
| `describe_db(name, fn)`          | DB test wrapper (fuz_app)                        |
| `create_test_app()`              | Full Hono app for integration tests (fuz_app)    |
| `stub_app_deps()`                | Safe default deps for unit tests (fuz_app)       |
| DI via `*Operations`/`*Deps`     | Preferred over vi.mock() for side effects        |
| `create_mock_*()`                 | Factory functions for test data                  |
| `SKIP_EXAMPLE_TESTS=1`           | Skip slow fuz_css integration tests              |
| `TEST_DATABASE_URL`              | Enable PostgreSQL tests alongside PGlite         |
| Never edit `expected.json`        | Always regenerate via task                       |
