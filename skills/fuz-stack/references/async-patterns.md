# Async Patterns

Guide to async concurrency utilities in `@fuzdev/fuz_util/async.ts`.

These primitives provide controlled concurrency for parallel operations — file
I/O, network requests, task execution, and DAG scheduling. They are used
extensively throughout the ecosystem, especially in Gro's task runner and code
generation systems.

## Contents

- [AsyncStatus](#asyncstatus)
- [Basic Utilities](#basic-utilities)
- [Deferred Pattern](#deferred-pattern)
- [Concurrent Operations](#concurrent-operations)
- [AsyncSemaphore](#asyncsemaphore)
- [Quick Reference](#quick-reference)

## AsyncStatus

Lifecycle type for tracking async operations in UI:

```typescript
type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';
```

## Basic Utilities

### wait

Promise-based delay:

```typescript
await wait(500); // wait 500ms
await wait(); // wait 0ms (next microtask)
```

### is_promise

Type guard for Promise/thenable detection:

```typescript
if (is_promise(value)) {
	const result = await value;
}
```

## Deferred Pattern

A `Deferred<T>` separates promise creation from resolution, giving you external
control over when and how a promise resolves.

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

Used internally by `run_dag()` to wait on dependency completion and by
`AsyncSemaphore` for queuing.

## Concurrent Operations

Three functions for running async work over arrays with bounded concurrency. All
require `concurrency >= 1`.

### Choosing the right function

| Function                 | Returns results | Fail behavior | Use when               |
| ------------------------ | --------------- | ------------- | ---------------------- |
| `each_concurrent`        | No              | Fail-fast     | Side effects only      |
| `map_concurrent`         | Yes (ordered)   | Fail-fast     | Transform + collect    |
| `map_concurrent_settled` | Yes (settled)   | No fail-fast  | Best-effort collection |

### each_concurrent

Runs an async function on each item with controlled concurrency. Does not
collect results — more efficient when you only need side effects.

```typescript
await each_concurrent(
	file_paths,
	5, // max 5 concurrent deletions
	async (path) => {
		await unlink(path);
	},
);
```

**Fail-fast**: On first rejection, stops spawning new workers and rejects the
outer promise.

### map_concurrent

Like `each_concurrent` but collects results in input order:

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

Like `map_concurrent` but follows the `Promise.allSettled` pattern — never
rejects the outer promise:

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

Returns `Array<PromiseSettledResult<R>>` — each element is either
`{status: 'fulfilled', value}` or `{status: 'rejected', reason}`.

### How concurrency control works

All three functions use the same internal pattern:

1. Maintain `active_count` and `next_index` counters
2. Spawn workers up to `concurrency` limit
3. On worker completion, decrement `active_count` and call `run_next()`
4. `run_next()` spawns more workers if slots are available

Empty arrays resolve immediately.

## AsyncSemaphore

Class-based concurrency limiter for more flexible control than the concurrent
map/each functions:

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

### Infinity permits

With `new AsyncSemaphore(Infinity)`, `acquire()` always resolves immediately —
useful for disabling concurrency limits without changing call sites.

### Internal mechanics

- `acquire()`: If permits > 0, decrements and resolves. Otherwise queues the
  caller.
- `release()`: If waiters queued, resolves the next one. Otherwise increments
  permits.

Used by `run_dag()` for controlling node execution concurrency.

## Quick Reference

| Export                   | Type      | Purpose                                        |
| ------------------------ | --------- | ---------------------------------------------- |
| `AsyncStatus`            | Type      | Lifecycle status for async operations          |
| `wait`                   | Function  | Promise-based delay                            |
| `is_promise`             | Function  | Type guard for Promise/thenable                |
| `Deferred<T>`            | Interface | Promise with external resolve/reject           |
| `create_deferred`        | Function  | Creates a Deferred                             |
| `each_concurrent`        | Function  | Concurrent side effects, fail-fast             |
| `map_concurrent`         | Function  | Concurrent map with ordered results, fail-fast |
| `map_concurrent_settled` | Function  | Concurrent map, allSettled pattern             |
| `AsyncSemaphore`         | Class     | Concurrency limiter with acquire/release       |
