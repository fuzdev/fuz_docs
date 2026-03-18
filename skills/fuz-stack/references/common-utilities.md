# Common Utilities

Guide to shared utilities across the `@fuzdev` ecosystem, primarily from
`@fuzdev/fuz_util` and `@fuzdev/gro`.

## Contents

- [Result Type](#result-type)
- [Logger](#logger)
- [Timings](#timings)
- [DAG Execution](#dag-execution)

## Result Type

`@fuzdev/fuz_util` provides a `Result<TValue, TError>` discriminated union for
error handling without exceptions. The type uses intersection:
`({ok: true} & TValue) | ({ok: false} & TError)`, so properties go directly on
the result object (not nested under `.value`/`.error` wrappers).

```typescript
import type {Result} from '@fuzdev/fuz_util/result.js';
import {unwrap} from '@fuzdev/fuz_util/result.js';

function parse_config(text: string): Result<{value: Config}, {error: ParseError}> {
	try {
		return {ok: true, value: JSON.parse(text)};
	} catch (e) {
		return {ok: false, error: new ParseError(e.message)};
	}
}

// Usage - discriminated union narrows via .ok
const result = parse_config(text);
if (result.ok) {
	console.log(result.value);
} else {
	console.error(result.error);
}

// Or unwrap (throws if error — requires {value} convention)
const config = unwrap(parse_config(text));
```

### Conventions

- Return `{ok: true, ...data}` with data properties spread directly on the
  result — not `{ok: true, value: {data: ...}}`
- Use `{value}` convention when `unwrap()` is expected
- Prefer Result over throwing for expected errors (parsing, validation)
- Use exceptions for unexpected errors (programmer mistakes, system failures)

## Logger

Hierarchical logging via `@fuzdev/fuz_util/log.js`:

```typescript
import {Logger} from '@fuzdev/fuz_util/log.js';

const log = new Logger('my_module');
log.info('starting');
log.debug('details', {data});

// Child loggers inherit level
const child_log = log.child('submodule');
```

### Log Levels

Control via `PUBLIC_LOG_LEVEL` env var:

| Level   | Purpose                           |
| ------- | --------------------------------- |
| `off`   | No output                         |
| `error` | Errors only                       |
| `warn`  | Errors and warnings               |
| `info`  | Normal operational messages        |
| `debug` | Detailed diagnostic information   |

### Logger Methods

| Method        | Level   | Use case                          |
| ------------- | ------- | --------------------------------- |
| `log.error()` | `error` | Failures requiring attention      |
| `log.warn()`  | `warn`  | Potential issues                  |
| `log.info()`  | `info`  | Normal operations                 |
| `log.debug()` | `debug` | Diagnostic details                |

### Static Configuration

`Logger.level` is a static property — setting it affects all Logger instances:

```typescript
Logger.level = 'debug'; // all loggers now output debug messages
```

## Timings

Performance measurement via Gro's task context:

```typescript
// In tasks and plugins
const timing = timings.start('operation');
await expensive_work();
timing(); // logs duration

// Nested timings
const outer = timings.start('outer');
const inner = timings.start('inner');
await inner_work();
inner();
await more_work();
outer();
```

Timings are automatically reported in task output, showing how long each named
operation took.

## DAG Execution

`@fuzdev/fuz_util` provides `run_dag()` for executing dependency graphs
concurrently. Nodes declare dependencies; `run_dag` schedules them respecting
the dependency order with configurable concurrency.

```typescript
import {run_dag} from '@fuzdev/fuz_util/dag.js';

const result = await run_dag(nodes, {
	concurrency: 4,
	on_node_complete: (node, result) => { /* ... */ },
});
```

Used internally by Gro for task dependency resolution.

See also ./async-patterns.md for concurrency primitives and
./type-utilities.md for nominal typing and strict utility types.
