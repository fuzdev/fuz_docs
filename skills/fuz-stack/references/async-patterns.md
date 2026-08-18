---
description: Concurrency primitives — semaphore, deferred, concurrent map/each
---

# Async Patterns

Async concurrency utilities in `@fuzdev/fuz_util/async.ts` and
`@fuzdev/fuz_util/dag.ts` — controlled concurrency for file I/O, network
requests, task execution, and DAG scheduling.

## AsyncStatus

Lifecycle type for tracking async operations in UI:

```typescript
type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';
```

## Deferred Pattern

Separates promise creation from resolution — external control over when and
how a promise resolves. Create with `create_deferred()`:

```typescript
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}
```

```typescript
const deferred = create_deferred<string>();

// Pass the promise to a consumer
some_async_consumer(deferred.promise);

// Resolve later from the producer
deferred.resolve('done');
```

Used internally by `run_dag()` and `throttle`.

## Concurrent Operations

Three functions for bounded concurrency over iterables. All require
`concurrency >= 1`, accept an optional `AbortSignal`, and pass both item and
index to `fn` (which may return synchronously).

### Choosing the right function

| Function                 | Returns results | Fail behavior           | Use when               |
| ------------------------ | --------------- | ----------------------- | ---------------------- |
| `each_concurrent`        | No              | Fail-fast               | Side effects only      |
| `map_concurrent`         | Yes (ordered)   | Fail-fast               | Transform + collect    |
| `map_concurrent_settled` | Yes (settled)   | Collects all (no throw) | Best-effort collection |

**Fail-fast** (`each_concurrent`, `map_concurrent`): on first rejection,
stops spawning new workers and rejects — partial results are lost; with
`signal`, aborts immediately.

```typescript
const results = await map_concurrent(
	file_paths,
	5, // max 5 concurrent reads
	async (path) => readFile(path, 'utf8')
);
// results[i] corresponds to file_paths[i]
```

**Settled** (`map_concurrent_settled`): follows `Promise.allSettled` — the
outer promise never rejects. On abort it resolves with partial results:
completed items keep their real settlements, in-flight items reject with the
abort reason, and items never pulled from the iterator are absent from the
results array.

All three cap in-flight work at `concurrency`, spawning the next item as each
settles. Empty iterables resolve immediately.

## AsyncSemaphore

Class-based concurrency limiter — more flexible than concurrent map/each:

```typescript
const semaphore = new AsyncSemaphore(3); // max 3 concurrent

async function do_work(item: string): Promise<void> {
	await semaphore.acquire(); // blocks if 3 already active
	try {
		await process(item);
	} finally {
		semaphore.release(); // free the slot
	}
}
```

Constructor requires `permits >= 0`.

### Infinity permits

`new AsyncSemaphore(Infinity)` — `acquire()` always resolves immediately.
Useful for disabling concurrency limits without changing call sites.

Used by `run_dag()` to bound node execution concurrency.

## DAG Execution

`run_dag()` in `@fuzdev/fuz_util/dag.ts` executes dependency-graph nodes
concurrently. Nodes declare dependencies via `depends_on`; independent nodes
run in parallel up to `max_concurrency`. Uses `AsyncSemaphore` for concurrency
and `Deferred` for dependency signaling.

```typescript
import { run_dag, type DagNode } from '@fuzdev/fuz_util/dag.ts';

interface BuildStep extends DagNode {
	command: string;
}

const result = await run_dag<BuildStep>({
	nodes,
	execute: async (node) => {
		await run_command(node.command);
	},
	max_concurrency: 4,
	stop_on_failure: true // default
});

if (!result.success) {
	console.error(result.error); // e.g., "2 node(s) failed"
}
```

`DagNode` is `{id, depends_on?}` extending `Sortable`
(`@fuzdev/fuz_util/sort.ts`, topological-sort validation). `DagOptions` adds
`on_error`/`on_skip`/`should_skip` hooks, `max_concurrency` (default
`Infinity`), `stop_on_failure` (default `true`), and `skip_validation`;
`DagResult` aggregates per-node results with counts and `duration_ms`.
Failed dependency nodes cascade — dependents are skipped with reason
`'dependency failed'`.

Also in `async.ts`: `wait` (promise delay), `is_promise` (thenable guard).
