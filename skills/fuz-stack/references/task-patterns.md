---
description: Gro task system — .task.ts files, TaskContext, error handling
---

# Task Patterns

Gro tasks are `*.task.ts` modules exporting a `task` object. Imports: `Task`,
`TaskContext`, `TaskError` from `@fuzdev/gro`; `SilentError`, `InvokeTask`
from `@fuzdev/gro/task.ts`.

## Task Interface

```typescript
interface Task<TArgs = Args, TArgsSchema extends z.ZodType<Args, Args> = z.ZodType<Args, Args>, TReturn = unknown> {
	run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;
	summary?: string; // shown in `gro` listing and --help
	Args?: TArgsSchema; // Zod schema for CLI arg parsing
}
```

Tasks are either `Task` or `Task<Args>` — the other params are rarely
customized. Both the Zod schema and its inferred type are exported as `Args`:

```typescript
// src/lib/greet.task.ts → `gro greet --name Claude`; `--help` is generated from the schema
export const Args = z.strictObject({
	name: z.string().meta({ description: 'who to greet' }).default('world')
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'greet someone by name',
	Args,
	run: async ({ args, log }) => {
		log.info(`hello, ${args.name}!`);
	}
};
```

**Args conventions**: `z.strictObject()`; `.meta({description})` for help
text; `.default()` (fields without one are required on the CLI);
`/** @nodocs */` on the `Args` exports to keep them out of API docs. Positional
args go in `_: z.array(z.string())` — `gro test foo bar --dir src/lib/` gives
`_ = ['foo', 'bar']`. Opt-out booleans use `--no-*`
duals — `typecheck: z.boolean().default(true)` paired with
`'no-typecheck': z.boolean().default(false)`; `--help` shows only the `no-*`
entry.

## TaskContext

Fields: `args`, `config: GroConfig`, `svelte_config: Promise<ParsedSvelteConfig>`, `filer`, `log`, `timings`, `invoke_task`.
`svelte_config` is lazy (resolved on first
access); `filer` tracks the filesystem (watches in dev); `log`/`timings` are
task-scoped.

**`invoke_task(task_name, args?, config?)`** composes tasks (omitting `config`
passes the current one) and respects overrides — `invoke_task('test')` runs the user's override if one exists.
`check.task.ts` is the core example: it invokes `typecheck`, `test`,
`gen` (`{check: true}`), `format` (`{check: true}`), `lint`, with `--no-*`
flags gating each. Direct import (`test_task.run(ctx)`) bypasses override
resolution — tighter coupling, rarely wanted. CLI args forward to composed
tasks via `--` sections: `gro check -- gro test --coverage` forwards
`--coverage` to `test`; multiple `--` sections target different sub-tasks.

## Error Handling

| Error type    | Stack trace | Gro logs message | Use when                              |
| ------------- | ----------- | ---------------- | ------------------------------------- |
| Regular Error | Yes         | Yes              | Unexpected failures                   |
| `TaskError`   | No          | Yes              | Known failure; the message suffices   |
| `SilentError` | No          | No               | Already logged; just exit non-zero    |

## Discovery and Overrides

Gro searches `task_root_dirs` in order (default `src/lib/`, `./`,
`gro/dist/`): `src/lib/greet.task.ts` → `gro greet`,
`src/lib/db/migrate.task.ts` → `gro db/migrate`; `gro src/lib/greet` also
works. `gro` alone or `gro some/dir` lists tasks. The `.task.js` form is only
gro's compiled builtins under `gro/dist/`, which the loader also discovers.

A local task with a builtin's name overrides it (`src/lib/test.task.ts`
overrides `test`); reach the builtin as `gro gro/test`. The common override
wraps the builtin:

```typescript
export const task: Task = {
	summary: 'run tests with custom setup',
	run: async ({ invoke_task, args }) => {
		// setup
		await invoke_task('gro/test', args);
		// teardown
	}
};
```
