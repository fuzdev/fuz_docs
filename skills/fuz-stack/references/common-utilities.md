# Common Utilities

Shared utilities from `@fuzdev/fuz_util`.

## Result Type

`@fuzdev/fuz_util/result.js` — `Result<TValue, TError>` discriminated union
for error handling without exceptions. Uses intersection:
`({ok: true} & TValue) | ({ok: false} & TError)`, so properties go directly
on the result object (not nested under `.value`/`.error` wrappers).

```typescript
import type {Result} from '@fuzdev/fuz_util/result.js';
import {unwrap} from '@fuzdev/fuz_util/result.js';

function parse_config(text: string): Result<{value: Config}, {message: string}> {
	try {
		return {ok: true, value: JSON.parse(text)};
	} catch (e) {
		return {ok: false, message: e.message};
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

| Export         | Purpose                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `OK`           | Frozen `{ok: true}` constant for results with no extra data               |
| `NOT_OK`       | Frozen `{ok: false}` constant for results with no extra data              |
| `unwrap()`     | Returns `result.value` if ok, throws `ResultError` if not                 |
| `unwrap_error()`| Returns the type-narrowed `{ok: false} & TError` result, throws if ok    |
| `ResultError`  | Custom `Error` subclass thrown by `unwrap`, carries `.result` and supports `ErrorOptions` |

`unwrap` signature:

```typescript
const unwrap: <TValue extends {value?: unknown}, TError extends {message?: string}>(
	result: Result<TValue, TError>,
	message?: string,
) => TValue['value'];
```

`unwrap_error` returns the entire failed result (not just a value) — the
opposite of `unwrap` returning just `.value`.

### Conventions

- Spread data directly on the result: `{ok: true, ...data}` — not
  `{ok: true, value: {data: ...}}`
- Use `{value}` when `unwrap()` is expected
- Use `{message}` for errors (used by `ResultError`)
- Prefer Result over throwing for expected errors (parsing, validation)
- Use exceptions for unexpected errors (programmer mistakes, system failures)

## Logger

Hierarchical logging via `@fuzdev/fuz_util/log.js`:

```typescript
import {Logger} from '@fuzdev/fuz_util/log.js';

const log = new Logger('my_module');
log.info('starting');
log.debug('details', {data});

// Child loggers inherit level, colors, and console from parent
const child_log = log.child('submodule'); // label: 'my_module:submodule'
child_log.info('connected'); // [my_module:submodule] connected
```

### Constructor

```typescript
new Logger(label?: string, options?: LoggerOptions)
```

| Option    | Type        | Default                     | Purpose                        |
| --------- | ----------- | --------------------------- | ------------------------------ |
| `level`   | `LogLevel`  | Inherited or env-detected   | Log level for this instance    |
| `colors`  | `boolean`   | Inherited or env-detected   | Whether to use ANSI colors     |
| `console` | `LogConsole` | Inherited or global console | Console interface for output   |

### Log Levels

Override via `PUBLIC_LOG_LEVEL` env var. Default detection order:

1. `PUBLIC_LOG_LEVEL` env var (if set)
2. `'off'` when running under Vitest
3. `'debug'` in development (`DEV` from `esm-env`)
4. `'info'` in production

| Level   | Value | Purpose                           |
| ------- | ----- | --------------------------------- |
| `off`   | 0     | No output                         |
| `error` | 1     | Errors only                       |
| `warn`  | 2     | Errors and warnings               |
| `info`  | 3     | Normal operational messages        |
| `debug` | 4     | Detailed diagnostic information   |

### Logger Methods

| Method        | Level   | Console method | Use case                          |
| ------------- | ------- | -------------- | --------------------------------- |
| `log.error()` | `error` | `console.error`| Failures requiring attention      |
| `log.warn()`  | `warn`  | `console.warn` | Potential issues                  |
| `log.info()`  | `info`  | `console.log`  | Normal operations                 |
| `log.debug()` | `debug` | `console.log`  | Diagnostic details                |
| `log.raw()`   | (none)  | `console.log`  | Unfiltered, no prefix or level check |

Each method (except `raw`) checks `this.level` before outputting. Prefixes
include the label in brackets and a level indicator for error, warn, and debug.
Info has no level prefix — just the label.

### Inheritance

No static state. Level, colors, and console are instance properties.
Children inherit from parent — changing a parent's level affects children
that haven't set their own override.

```typescript
const root = new Logger('app');
const child = root.child('db');

root.level = 'debug';  // child also becomes debug (inherits)
child.level = 'warn';  // child overrides, root unaffected

child.clear_level_override();  // child inherits from root again
child.clear_colors_override(); // child inherits colors from root again
child.clear_console_override(); // child inherits console from root again
```

The `root` getter walks the parent chain to find the root logger, useful for
setting global configuration.

Colors automatically disabled when `NO_COLOR` or `CLAUDECODE` env vars are set.

### Additional Logger Exports

| Export               | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `log_level_to_number`| Converts a `LogLevel` to its numeric value (0-4) |
| `log_level_parse`    | Validates a log level string, throws on invalid   |

## Timings

Performance measurement via `@fuzdev/fuz_util/timings.js`. Tracks multiple
named timing operations, used in Gro's `TaskContext` for task performance.

```typescript
import {Timings} from '@fuzdev/fuz_util/timings.js';

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

### API

| Method/Property | Signature                                  | Purpose                                 |
| --------------- | ------------------------------------------ | --------------------------------------- |
| `constructor`   | `new Timings(decimals?: number)`           | Optional decimal precision for rounding |
| `start()`       | `(key: TimingsKey, decimals?) => () => number` | Start a timing, returns stop function |
| `get()`         | `(key: TimingsKey) => number`              | Get recorded duration for a key         |
| `entries()`     | `() => IterableIterator<[TimingsKey, number \| undefined]>` | Iterate all timings |
| `merge()`       | `(timings: Timings) => void`               | Merge other timings, summing shared keys |

`TimingsKey` is `string | number`. Duplicate keys are auto-suffixed
(`operation`, `operation_2`, `operation_3`, etc.).

### Integration with Logger

`print_timings(timings, log)` from `@fuzdev/fuz_util/print.js` outputs timing
data at debug level after task execution. `Timings` itself does not log.

### Stopwatch

`create_stopwatch(decimals?)` — lower-level primitive returning a `Stopwatch`
function that tracks elapsed time from creation. Call with `true` to reset.
Default `decimals` is 2.

```typescript
import {create_stopwatch, type Stopwatch} from '@fuzdev/fuz_util/timings.js';

const elapsed: Stopwatch = create_stopwatch();
await work();
console.log(elapsed()); // e.g., 142.37 — ms since creation
console.log(elapsed(true)); // ms since creation, then resets start time
console.log(elapsed()); // ms since reset
```

## DAG Execution

`@fuzdev/fuz_util/dag.js` — `run_dag()` for executing dependency graphs
concurrently. Nodes declare dependencies via `depends_on`; independent nodes
run in parallel up to `max_concurrency`. Uses `AsyncSemaphore` for concurrency
and `Deferred` for dependency signaling.

```typescript
import {run_dag} from '@fuzdev/fuz_util/dag.js';

const result = await run_dag({
	nodes,
	execute: async (node) => { /* ... */ },
	max_concurrency: 4,
	stop_on_failure: true,
});
```

Used by tx for pipeline execution and resource detection.

See ./async-patterns.md for the full DAG API (`DagOptions`, `DagResult`,
`DagNode`) and concurrency primitives. See ./type-utilities.md for nominal
typing and strict utility types.
