---
description: Result type, Logger, Timings, DAG execution
---

# Common Utilities

Shared utilities from `@fuzdev/fuz_util`.

## Result Type

`@fuzdev/fuz_util/result.ts` — `Result<TValue, TError>` discriminated union
for error handling without exceptions. Uses intersection:
`({ok: true} & TValue) | ({ok: false} & TError)`, so properties go directly
on the result object (not nested under `.value`/`.error` wrappers).

```typescript
import type { Result } from '@fuzdev/fuz_util/result.ts';
import { unwrap } from '@fuzdev/fuz_util/result.ts';

function parse_config(text: string): Result<{ value: Config }, { message: string }> {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch (e) {
		return { ok: false, message: e.message };
	}
}

// Usage - discriminated union narrows via .ok
const result = parse_config(text);
if (result.ok) {
	console.log(result.value);
} else {
	console.error(result.message);
}

// Or unwrap (throws ResultError if not ok — requires {value} convention)
const config = unwrap(parse_config(text));
```

### Helper exports

| Export           | Purpose                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `OK`             | Frozen `{ok: true}` constant for results with no extra data                               |
| `NOT_OK`         | Frozen `{ok: false}` constant for results with no extra data                              |
| `unwrap()`       | Returns `result.value` if ok, throws `ResultError` if not                                 |
| `unwrap_error()` | Returns the type-narrowed `{ok: false} & TError` result, throws if ok                     |
| `ResultError`    | Custom `Error` subclass thrown by `unwrap`, carries `.result` and supports `ErrorOptions` |

`unwrap_error` returns the entire failed result (not just a value) — the
opposite of `unwrap` returning just `.value`.

### Conventions

- Spread data directly on the result: `{ok: true, ...data}` — not
  `{ok: true, value: {data: ...}}`
- Use `{value}` when `unwrap()` is expected; `{message}` for errors (used by
  `ResultError`)
- Prefer Result over throwing for expected errors (parsing, validation); use
  exceptions for unexpected errors (programmer mistakes, system failures)

## Error Helpers

`@fuzdev/fuz_util/error.ts`:

- **`to_error_message(value, fallback?)`** — normalizes an unknown caught
  value to a string (`value.message` for `Error`, else
  `fallback ?? String(value)`). The standard `catch (err)` normalizer.
- **`unreachable(value: never)`** — exhaustive-match guard; throws
  `UnreachableError`. Because `throw` isn't an expression, `unreachable(x)`
  also works where an expression is required (ternaries, Svelte markup).
- **`UnreachableError`** — the class `unreachable` throws; catchable
  separately when a default case must be distinguishable.

## Logger

Hierarchical logging via `@fuzdev/fuz_util/log.ts`:

```typescript
import { Logger } from '@fuzdev/fuz_util/log.ts';

const log = new Logger('my_module');
log.info('starting');
log.debug('details', { data });

// Child loggers inherit level, colors, and console from parent
const child_log = log.child('submodule'); // label: 'my_module:submodule'
child_log.info('connected'); // [my_module:submodule] connected
```

### Log Levels

Override via `PUBLIC_LOG_LEVEL` env var. Default detection order:

1. `PUBLIC_LOG_LEVEL` env var (if set)
2. `'off'` when running under Vitest
3. `'debug'` in development (`DEV` from `esm-env`)
4. `'info'` in production

Levels ascending: `off` (0), `error` (1), `warn` (2), `info` (3), `debug` (4).

### Inheritance

No static state — level, colors, and console are instance properties.
Children inherit from parent, so changing a parent's level affects children
that haven't set their own override.

```typescript
const root = new Logger('app');
const child = root.child('db');

root.level = 'debug'; // child also becomes debug (inherits)
child.level = 'warn'; // child overrides, root unaffected

child.clear_level_override(); // child inherits from root again
child.clear_colors_override(); // child inherits colors from root again
child.clear_console_override(); // child inherits console from root again
```

The `root` getter walks the parent chain to find the root logger, useful for
setting global configuration.

Colors automatically disabled when `NO_COLOR` or `CLAUDECODE` env vars are set.

## Timings

Performance measurement via `@fuzdev/fuz_util/timings.ts`. Tracks multiple
named timing operations; used in Gro's `TaskContext` for task performance.

```typescript
import { Timings } from '@fuzdev/fuz_util/timings.ts';

const timings = new Timings();

// start() returns a stop function
const stop = timings.start('operation');
await expensive_work();
const elapsed_ms = stop(); // returns elapsed milliseconds (does not log)

// Nested timings
const stop_outer = timings.start('outer');
const stop_inner = timings.start('inner');
await inner_work();
stop_inner();
await more_work();
stop_outer();
```

Duplicate keys are auto-suffixed (`operation`, `operation_2`, …). `Timings`
itself does not log — `print_timings(timings, log)` from
`@fuzdev/fuz_util/print.ts` outputs the data at debug level.
`create_stopwatch(decimals?)` is the lower-level single-timer primitive
(call the returned function for elapsed ms; pass `true` to reset).

## DAG Execution

`@fuzdev/fuz_util/dag.ts` — `run_dag()` executes dependency graphs concurrently
(nodes declare `depends_on`; independent nodes run in parallel up to
`max_concurrency`). See ./async-patterns.md for the full DAG API (`DagOptions`,
`DagResult`, `DagNode`) and concurrency primitives, and ./type-utilities.md for
nominal typing and strict utility types.

## DOM Helpers

`@fuzdev/fuz_util/dom.ts` — browser DOM utilities.

### `swallow`

Claims an event by preventing its default action and stopping propagation —
`swallow(event, immediate?, preventDefault?)`. The design principle (handling
an event = claiming it) and usage guidance: ./svelte-patterns.md §Event
Handling.

### `handle_target_value`

Wraps an input event callback with value extraction and optional swallowing:

```typescript
import {handle_target_value} from '@fuzdev/fuz_util/dom.ts';

// Swallows by default (preventDefault + stopImmediatePropagation)
<input oninput={handle_target_value((value) => { name = value; })} />

// Without swallowing
<input oninput={handle_target_value((value) => { name = value; }, false)} />
```
