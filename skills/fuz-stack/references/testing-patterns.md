# Testing Patterns

Testing conventions for the Fuz stack, covering vitest usage, fixtures,
mocks, and helpers.

## Contents

- [File Organization](#file-organization) (naming, assertions, jsdom)
- [Test Helpers](#test-helpers)
- [Fixture-Based Testing](#fixture-based-testing)
- [Mock Patterns](#mock-patterns)
- [Environment Flags](#environment-flags)
- [Assertion Helpers](#assertion-helpers)
- [Test Structure](#test-structure) (basic, async, parameterized)
- [Quick Reference](#quick-reference)

## File Organization

```
src/
├── lib/               # source code
└── test/              # all tests (NOT co-located)
    ├── module.test.ts              # single-file tests
    ├── module.aspect.test.ts       # split tests by aspect
    ├── test_helpers.ts             # shared test utilities
    └── fixtures/                   # fixture-based test data
        ├── update.task.ts          # runs all child update tasks
        └── feature_name/
            ├── case_name/
            │   ├── input.{ext}     # test input
            │   └── expected.json   # generated expected output
            ├── feature_test_helpers.ts  # fixture-specific helpers
            └── update.task.ts      # regeneration task for this feature
```

**Key principle:** Tests are NOT co-located with source files. All tests live in
`src/test/`.

### Test File Naming

Split large test suites using dot-separated aspects:

| Pattern                            | Example                                       |
| ---------------------------------- | --------------------------------------------- |
| `{module}.test.ts`                 | `mdz.test.ts`, `ts_helpers.test.ts`           |
| `{module}.{aspect}.test.ts`        | `csp.core.test.ts`, `csp.security.test.ts`    |
| `{module}.svelte.{aspect}.test.ts` | `contextmenu_state.svelte.activation.test.ts` |
| `{module}.fixtures.test.ts`        | `svelte_preprocess_mdz.fixtures.test.ts`      |
| `{module}.db.test.ts`              | `account_queries.db.test.ts`                  |
| `{module}.integration.db.test.ts`  | `auth_flow.integration.db.test.ts`            |

The module name matches the source file. Dots separate test aspects. The
`.svelte.` segment preserves the source extension (e.g., for `.svelte.ts` runes
files).

### Database Test Files (`.db.test.ts`)

Any test file that creates or uses a `Db` instance (via `describe_db`,
`create_test_app`, `create_pglite_factory`, or raw PGlite) should use the
`.db.test.ts` suffix. The `.db` segment always goes immediately before
`.test.ts` — e.g., `foo.integration.db.test.ts`, not `foo.db.integration.test.ts`.

This convention enables vitest `projects` configuration to run all DB test files
in a single worker with `isolate: false` + `fileParallelism: false`, sharing one
PGlite WASM instance instead of loading it per file (~500-700ms cold start each).
Non-DB test files stay fully parallel in a separate `unit` project.

```typescript
// vite.config.ts — vitest projects split
test: {
  projects: [
    {extends: true, test: {name: 'unit', include: ['src/test/**/*.test.ts'], exclude: ['src/test/**/*.db.test.ts'], sequence: {groupOrder: 2}}},
    {extends: true, test: {name: 'db', include: ['src/test/**/*.db.test.ts'], isolate: false, fileParallelism: false, sequence: {groupOrder: 1}}},
  ],
}
```

`sequence.groupOrder` is required by vitest when projects have different
`maxWorkers` settings. `groupOrder: 1` for `db` starts the WASM cold start early.

Because `isolate: false` shares module state across files, avoid `vi.mock()` in
`.db.test.ts` files. Use `vi.restoreAllMocks()` (not `vi.clearAllMocks()`) in
`afterEach` to fully restore original implementations.

### Assertions

Prefer `assert` from vitest over `expect` — the goal is good TypeScript type
narrowing. Choose whichever method TypeScript understands best in context, not
the most semantically precise one. `assert.ok(value)` is often the right choice
when TypeScript narrows the type correctly from a truthy check:

```typescript
import {test, assert} from 'vitest';

assert.ok(value);            // narrows away null/undefined — use when TS understands the flow
assert.strictEqual(a, b);   // use when equality itself is what narrows
assert.deepStrictEqual(a, b);
```

After `assert.isDefined(x)`, the type is narrowed to `NonNullable<T>` — no `!`
needed on subsequent lines:

```typescript
assert.isDefined(result);
assert.strictEqual(result.id, expected_id); // no result! needed
```

For throw assertions, use `assert.throws()` with a second argument that is an
Error constructor, string, or RegExp. **Do not pass a function predicate** — it
causes `"errorLike is not a constructor"` at runtime:

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

Note: `assert.throws()` returns `void`, not the thrown error. To inspect the
error, use try/catch:

```typescript
try {
	fn();
	assert.fail('Expected error');
} catch (e: any) {
	assert.include(e.message, 'expected substring');
	assert.strictEqual(e.code, 'EXPECTED_CODE');
}
```

For async functions that reject, use the same try/catch pattern:

```typescript
try {
	await async_fn();
	assert.fail('Expected error');
} catch (e: any) {
	assert.include(e.message, 'expected substring');
}
```

### jsdom Environment

For UI tests that need a DOM, add the vitest environment pragma before imports:

```typescript
// @vitest-environment jsdom
```

**Gotcha:** jsdom normalizes some CSS values — e.g., `style.setProperty('top', '0')`
stores `'0px'`. When asserting DOM style values, match the normalized form, not
the source value.

## Test Helpers

Create `*_helpers.ts` files for reusable test utilities:

```typescript
// src/test/test_helpers.ts
import {assert} from 'vitest';

/**
 * Creates a mock message for testing.
 */
export function create_mock_message(overrides?: Partial<Message>): Message {
	return {
		id: crypto.randomUUID(),
		content: 'Test message',
		role: 'user',
		created: Date.now(),
		...overrides,
	};
}

/**
 * Creates a mock conversation with messages.
 */
export function create_mock_conversation(message_count = 3): Conversation {
	return {
		id: crypto.randomUUID(),
		messages: Array.from({length: message_count}, (_, i) =>
			create_mock_message({content: `Message ${i + 1}`}),
		),
	};
}
```

### Domain-Specific Helpers

Name helpers by domain prefix:

```typescript
// src/test/css_test_helpers.ts
export function assert_css_contains(css: string, expected: string): void {
	const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
	assert.include(normalize(css), normalize(expected));
}

export function create_mock_style_variable(name: string): Style_Variable {
	return {
		name,
		value: 'test-value',
		light: 'light-value',
		dark: 'dark-value',
	};
}
```

## Fixture-Based Testing

For parsers, analyzers, and transformers, use the fixture pattern.

### Directory Structure

Each fixture is a subdirectory with an input file and generated `expected.json`:

```
src/test/fixtures/
├── update.task.ts              # parent: invokes all child update tasks
├── mdz/
│   ├── bold/
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

### Parent Update Task

The parent `update.task.ts` invokes all child tasks:

```typescript
// src/test/fixtures/update.task.ts
import type {Task} from '@fuzdev/gro';

export const task: Task = {
	summary: 'generate all fixture expected.json files',
	run: async ({invoke_task, log}) => {
		log.info('updating mdz fixtures...');
		await invoke_task('src/test/fixtures/mdz/update');

		log.info('updating svelte_preprocess_mdz fixtures...');
		await invoke_task('src/test/fixtures/svelte_preprocess_mdz/update');

		log.info('all fixtures updated!');
	},
};
```

Run all: `gro src/test/fixtures/update`
Run one: `gro src/test/fixtures/mdz/update`

### Child Update Task

Each feature's `update.task.ts` uses `run_update_task` from shared helpers:

```typescript
// src/test/fixtures/mdz/update.task.ts
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
// src/test/mdz.fixtures.test.ts
import {test, assert, beforeAll} from 'vitest';
import {load_fixtures} from './fixtures/mdz/mdz_test_helpers.js';

let fixtures = [];

beforeAll(async () => {
	fixtures = await load_fixtures();
});

test('all fixtures transform correctly', async () => {
	for (const fixture of fixtures) {
		const result = process(fixture.input);
		assert.equal(result, fixture.expected, `Fixture "${fixture.name}" failed`);
	}
});
```

**CRITICAL:** Never manually create or edit `expected.json` files. Only create
input files and run the update task. This ensures fixtures match implementation.

## Mock Patterns

### Mock Factories

Create factory functions for consistent mock objects:

```typescript
// src/test/test_helpers.ts

/**
 * Creates a mock filesystem state.
 */
export interface MockFsState {
	files: Map<string, string>;
	directories: Set<string>;
}

export function create_mock_fs_state(initial_files?: Record<string, string>): MockFsState {
	const files = new Map<string, string>();
	const directories = new Set<string>();

	if (initial_files) {
		for (const [path, content] of Object.entries(initial_files)) {
			files.set(path, content);
			// Add parent directories
			const parts = path.split('/');
			for (let i = 1; i < parts.length; i++) {
				directories.add(parts.slice(0, i).join('/'));
			}
		}
	}

	return {files, directories};
}
```

### Mock Call Assertions

Vitest's mock typing creates precise tuple types for `.mock.calls` that don't
match loose array literals. Use `as any` on the expected array:

```typescript
const spy = vi.fn();
spy('hello', 42);

// TypeScript rejects the literal — use `as any`
assert.deepEqual(spy.mock.calls[0], ['hello', 42] as any);
```

This is the idiomatic pattern for mock call assertions — the `as any` is
acceptable here since the runtime comparison is exact.

### In-Memory Filesystem

For CLI testing, implement `FsDeps` against a `MockFsState` with `Map<string,
string>` for files and `Set<string>` for directories. See `create_mock_fs_state`
above for the state factory — the ops implementation maps each method to the
underlying Maps/Sets.

## Environment Flags

Use environment flags to skip slow tests:

```typescript
// src/test/example.test.ts
import {describe, test} from 'vitest';

const SKIP_EXAMPLE_TESTS = process.env.SKIP_EXAMPLE_TESTS === '1';

describe.skipIf(SKIP_EXAMPLE_TESTS)('example integration tests', () => {
	test('slow integration test', async () => {
		// ... test that hits real APIs or filesystem
	});
});
```

Run fast tests only:

```bash
SKIP_EXAMPLE_TESTS=1 gro test
```

Common flags:

| Flag                 | Purpose                             |
| -------------------- | ----------------------------------- |
| `SKIP_EXAMPLE_TESTS` | Skip slow integration tests         |
| `SKIP_NETWORK_TESTS` | Skip tests requiring network        |
| `UPDATE_FIXTURES`    | Regenerate fixtures during test run |

## Assertion Helpers

Create semantic assertion helpers for better test readability:

```typescript
import {assert} from 'vitest';

// CSS assertions
export function assert_css_contains(actual: string, expected: string): void {
	const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
	assert.include(normalize(actual), normalize(expected));
}

export function assert_css_not_contains(actual: string, unexpected: string): void {
	const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
	assert.notInclude(normalize(actual), normalize(unexpected));
}

// DOM style assertion — handles jsdom normalization
export const assert_style = (el: HTMLElement, prop: string, expected: string): void => {
	assert.strictEqual(
		el.style.getPropertyValue(prop),
		expected,
		`style '${prop}' should be '${expected}'`,
	);
};
```

## Test Structure

### Basic Test Pattern

```typescript
import {describe, test, assert} from 'vitest';
import {parse_config} from '$lib/config.js';
import {create_mock_config} from './test_helpers.js';

describe('parse_config', () => {
	test('parses valid config', () => {
		const input = create_mock_config();
		const result = parse_config(input);

		assert.strictEqual(result.ok, true);
		assert.strictEqual(result.value.version, 1);
	});

	test('returns error for invalid version', () => {
		const input = create_mock_config({version: -1});
		const result = parse_config(input);

		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.error.code, 'INVALID_VERSION');
	});
});
```

### Async Test Pattern

```typescript
describe('fetch_repos', () => {
	test('fetches repositories from API', async () => {
		const {ctx} = create_mock_context();

		const result = await fetch_repos(ctx, {org: 'fuzdev'});

		assert_result_ok(result);
		assert.strictEqual(result.value.repos.length, 5);
	});

	test('handles network error', async () => {
		const {ctx, mock_github} = create_mock_context();
		mock_github.should_fail = true;

		const result = await fetch_repos(ctx, {org: 'fuzdev'});

		assert_result_err(result);
		assert.strictEqual(result.error.code, 'NETWORK_ERROR');
	});
});
```

### Parameterized Tests

Use labeled tuple types for self-documenting test tables. The labels name each
position in the tuple, visible in editor tooltips and type errors:

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

For larger tables where many tests share identical setup/assert logic, extract
the table as a typed constant. Use `null` sentinels for "missing" cases:

```typescript
// null initial means no file exists (triggers create)
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

Object array form with `$prop` interpolation — useful for complex expected values:

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

Tests that compute expected values dynamically or need extra assertions beyond
the table pattern should stay as standalone tests.

## Quick Reference

| Pattern                           | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `src/test/`                       | All tests live here, not co-located              |
| `module.aspect.test.ts`           | Split test suites by aspect                      |
| `module.db.test.ts`               | DB test — shared WASM worker via vitest projects |
| `module.fixtures.test.ts`         | Fixture-based test file                          |
| `*_helpers.ts`                    | Test utilities and factories                     |
| `fixtures/feature/case/`          | Subdirectory per fixture case                    |
| `fixtures/update.task.ts`         | Parent: runs all child update tasks              |
| `fixtures/feature/update.task.ts` | Child: regenerates one feature                   |
| `assert` from vitest              | Use for all assertions — pick method for TS narrowing, not semantics |
| `assert.isDefined(x); x.prop`    | Narrows to NonNullable — no `x!` needed          |
| `assert.throws(fn, /regex/)`     | Returns void; second arg: constructor/string/RegExp (not function) |
| `assert.doesNotThrow(fn)`         | Assert no throw                                  |
| try/catch + `assert.include`     | For inspecting thrown errors or async rejects    |
| `// @vitest-environment jsdom`    | Pragma for UI tests needing DOM                  |
| `Array<[label: string, ...]>`    | Labeled tuple types for self-documenting test.each tables |
| `test.each(objects)('$prop ...')` | Data-driven tests with object interpolation      |
| `spy.mock.calls[0] as any`       | Mock call assertions need `as any` for vitest tuple types |
| `create_mock_*()`                 | Factory functions for mocks                      |
| `SKIP_*` env vars                 | Skip slow test categories                        |
| Never edit `expected.json`        | Always regenerate via task                       |
