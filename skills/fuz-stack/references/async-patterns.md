# Async Patterns

Async concurrency utilities in `@fuzdev/fuz_util/async.ts` and
`@fuzdev/fuz_util/dag.ts`. Controlled concurrency for file I/O, network
requests, task execution, and DAG scheduling.

## AsyncStatus

Lifecycle type for tracking async operations in UI:

```typescript
type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';
```

## Basic Utilities

### wait

```typescript
await wait(500); // wait 500ms
await wait(); // wait 0ms (next macrotask via setTimeout)
```

### is_promise

Type guard for Promise/thenable detection:

```typescript
if (is_promise(value)) {
	const result = await value;
}
```

## Deferred Pattern

Separates promise creation from resolution — external control over when and
how a promise resolves.

```typescript
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}
```

Create with `create_deferred()`:

```typescript
const deferred = create_deferred<string>();

// Pass the promise to a consumer
some_async_consumer(deferred.promise);

// Resolve later from the producer
deferred.resolve('done');
```

### When to use Deferred

- Coordinating between independent async flows (e.g., DAG node dependencies)
- Bridging callback-based APIs with promise-based code
- Signaling completion from one context to waiters in another

Used internally by `run_dag()` and `throttle`.

## Concurrent Operations

Three functions for bounded concurrency over iterables. All require
`concurrency >= 1` and accept an optional `AbortSignal`.

### Choosing the right function

| Function                 | Returns results | Fail behavior           | Use when               |
| ------------------------ | --------------- | ----------------------- | ---------------------- |
| `each_concurrent`        | No              | Fail-fast               | Side effects only      |
| `map_concurrent`         | Yes (ordered)   | Fail-fast               | Transform + collect    |
| `map_concurrent_settled` | Yes (settled)   | Collects all (no throw) | Best-effort collection |

### each_concurrent

Side effects only, no result collection:

```typescript
const each_concurrent: <T>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<void> | void,
	signal?: AbortSignal,
) => Promise<void>;
```

```typescript
await each_concurrent(
	file_paths,
	5, // max 5 concurrent deletions
	async (path) => {
		await unlink(path);
	},
);
```

**Fail-fast**: On first rejection, stops spawning new workers and rejects.
With `signal`, aborts immediately.

### map_concurrent

Like `each_concurrent` but collects results in input order:

```typescript
const map_concurrent: <T, R>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<R> | R,
	signal?: AbortSignal,
) => Promise<Array<R>>;
```

```typescript
const results = await map_concurrent(
	file_paths,
	5, // max 5 concurrent reads
	async (path) => readFile(path, 'utf8'),
);
// results[i] corresponds to file_paths[i]
```

**Fail-fast**: On first rejection, stops spawning and rejects. Partial results
are lost.

### map_concurrent_settled

Follows `Promise.allSettled` pattern — never rejects the outer promise:

```typescript
const map_concurrent_settled: <T, R>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<R> | R,
	signal?: AbortSignal,
) => Promise<Array<PromiseSettledResult<R>>>;
```

```typescript
const results = await map_concurrent_settled(urls, 5, fetch);
for (const [i, result] of results.entries()) {
	if (result.status === 'fulfilled') {
		console.log(`${urls[i]}: ${result.value.status}`);
	} else {
		console.error(`${urls[i]}: ${result.reason}`);
	}
}
```

**Abort behavior**: On abort, resolves with partial results — completed items
keep their real settlements, un-started items are rejected with abort reason.

### How concurrency control works

All three use the same internal pattern:

1. Maintain `active_count` and `next_index` counters
2. Spawn workers up to `concurrency` limit
3. On completion, decrement `active_count` and call `run_next()`
4. `run_next()` spawns more if slots are available

Empty iterables resolve immediately. The `fn` callback receives both item
and index, and may return synchronously.

## AsyncSemaphore

Class-based concurrency limiter for more flexible control than concurrent
map/each:

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

### Internal mechanics

- `acquire()`: If permits > 0, decrements and resolves. Otherwise queues.
- `release()`: If waiters queued, resolves next. Otherwise increments permits.

Used by `run_dag()` for controlling node execution concurrency.

## DAG Execution

`run_dag()` in `@fuzdev/fuz_util/dag.ts` executes nodes in a dependency graph
concurrently. Nodes declare dependencies via `depends_on`; independent nodes
run in parallel up to `max_concurrency`. Uses `AsyncSemaphore` for concurrency
and `Deferred` for dependency signaling.

```typescript
import {run_dag, type DagNode} from '@fuzdev/fuz_util/dag.js';

interface BuildStep extends DagNode {
	command: string;
}

const result = await run_dag<BuildStep>({
	nodes,
	execute: async (node) => {
		await run_command(node.command);
	},
	max_concurrency: 4,
	stop_on_failure: true, // default
});

if (!result.success) {
	console.error(result.error); // e.g., "2 node(s) failed"
}
```

### DagNode interface

```typescript
interface DagNode extends Sortable {
	id: string;
	depends_on?: Array<string>;
}
```

### DagOptions

```typescript
interface DagOptions<T extends DagNode> {
	nodes: Array<T>;
	execute: (node: T) => Promise<void>;
	on_error?: (node: T, error: Error) => Promise<void>;
	on_skip?: (node: T, reason: string) => Promise<void>;
	should_skip?: (node: T) => boolean;
	max_concurrency?: number; // default: Infinity
	stop_on_failure?: boolean; // default: true
	skip_validation?: boolean; // default: false
}
```

### DagResult

```typescript
interface DagResult {
	success: boolean;
	results: Map<string, DagNodeResult>;
	completed: number;
	failed: number;
	skipped: number;
	duration_ms: number;
	error?: string;
}
```

Node statuses: `'completed'`, `'failed'`, `'skipped'`. Failed dependency nodes
cascade — dependents are skipped with reason `'dependency failed'`.

Used by tx for pipeline execution and resource detection.

## Quick Reference

| Export                   | Module     | Type      | Purpose                                        |
| ------------------------ | ---------- | --------- | ---------------------------------------------- |
| `AsyncStatus`            | `async.ts` | Type      | Lifecycle status for async operations          |
| `wait`                   | `async.ts` | Function  | Promise-based delay                            |
| `is_promise`             | `async.ts` | Function  | Type guard for Promise/thenable                |
| `Deferred<T>`            | `async.ts` | Interface | Promise with external resolve/reject           |
| `create_deferred`        | `async.ts` | Function  | Creates a Deferred                             |
| `each_concurrent`        | `async.ts` | Function  | Concurrent side effects, fail-fast             |
| `map_concurrent`         | `async.ts` | Function  | Concurrent map with ordered results, fail-fast |
| `map_concurrent_settled` | `async.ts` | Function  | Concurrent map, allSettled pattern             |
| `AsyncSemaphore`         | `async.ts` | Class     | Concurrency limiter with acquire/release       |
| `run_dag`                | `dag.ts`   | Function  | Concurrent DAG executor                        |
| `DagNode`                | `dag.ts`   | Interface | Minimum shape for a DAG node                   |
| `DagOptions`             | `dag.ts`   | Interface | Options for `run_dag`                          |
| `DagResult`              | `dag.ts`   | Interface | Aggregated DAG execution result                |
| `DagNodeResult`          | `dag.ts`   | Interface | Per-node execution result                      |
