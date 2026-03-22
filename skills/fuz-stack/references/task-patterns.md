# Task Patterns

Gro's task system for project automation in `@fuzdev/gro`. Tasks are TypeScript
modules with a `.task.ts` suffix that export a `task` object with a `run`
function.

## Task Interface

```typescript
interface Task<
  TArgs = Args,
  TArgsSchema extends z.ZodType<Args, Args> = z.ZodType<Args, Args>,
  TReturn = unknown,
> {
  run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;
  summary?: string;
  Args?: TArgsSchema;
}
```

- `run` — entry point, receives `TaskContext`
- `summary` — shown in `gro` task listing and `--help`
- `Args` — optional Zod schema for CLI argument parsing and validation
  (see ./zod-schemas.md)

`TArgsSchema` and `TReturn` are rarely customized — tasks are either
`Task` (default args) or `Task<Args>` (with a custom Zod-inferred `Args` type).

### Basic task example

```typescript
// src/lib/greet.task.ts
import type {Task} from '@fuzdev/gro';

export const task: Task = {
  summary: 'greet the user',
  run: async ({log}) => {
    log.info('hello!');
  },
};
```

Run with `gro greet` or `gro src/lib/greet`.

### Task with args

Both the Zod schema (value) and inferred type share the name `Args`:

```typescript
// src/lib/greet.task.ts
import type {Task} from '@fuzdev/gro';
import {z} from 'zod';

export const Args = z.strictObject({
  name: z.string().meta({description: 'who to greet'}).default('world'),
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
  summary: 'greet someone by name',
  Args,
  run: async ({args, log}) => {
    log.info(`hello, ${args.name}!`);
  },
};
```

Run with `gro greet --name Claude`. `gro greet --help` shows auto-generated
help from the Zod schema.

## TaskContext

```typescript
interface TaskContext<TArgs = object> {
  args: TArgs;
  config: GroConfig;
  svelte_config: ParsedSvelteConfig;
  filer: Filer;
  log: Logger;
  timings: Timings;
  invoke_task: InvokeTask;
}
```

| Field           | Type                | Purpose                                         |
| --------------- | ------------------- | ----------------------------------------------- |
| `args`          | `TArgs`             | Parsed CLI arguments (validated by Zod if set)   |
| `config`        | `GroConfig`         | Gro configuration (plugins, task_root_dirs, etc) |
| `svelte_config` | `ParsedSvelteConfig`| Parsed SvelteKit config (aliases, paths)         |
| `filer`         | `Filer`             | Filesystem tracker (watches files in dev mode)   |
| `log`           | `Logger`            | Logger instance scoped to the task               |
| `timings`       | `Timings`           | Performance measurement (start/stop timers)      |
| `invoke_task`   | `InvokeTask`        | Call other tasks programmatically                |

### invoke_task

```typescript
type InvokeTask = (task_name: string, args?: Args, config?: GroConfig) => Promise<void>;
```

Omitting `config` passes the current config. Respects the override system —
`invoke_task('test')` runs the user's override if one exists.

```typescript
export const task: Task = {
  run: async ({invoke_task}) => {
    await invoke_task('typecheck');
    await invoke_task('test');
    await invoke_task('gen', {check: true});
    await invoke_task('format', {check: true});
    await invoke_task('lint');
  },
};
```

This is the core pattern used by `check.task.ts` (which adds conditional
execution via `--no-*` flags).

## Args Pattern

### Conventions

- Export both Zod schema and inferred type as `Args` at module level
- Use `z.strictObject()` (not `z.object()`)
- `.meta({description: '...'})` for CLI help text
- `.default(...)` for defaults — required fields without defaults must be
  passed via CLI
- `/** @nodocs */` to exclude from docs generation

### Positional arguments

`_` key for positional arguments (array of strings):

```typescript
export const Args = z.strictObject({
  _: z.array(z.string()).meta({description: 'file patterns to filter'}).default(['.test.']),
  dir: z.string().meta({description: 'working directory'}).default('src/'),
});
export type Args = z.infer<typeof Args>;
```

Run with: `gro test foo bar --dir src/lib/` (positional `foo`, `bar` go to `_`).

### Boolean dual flags

`--no-*` dual flags for opt-out behavior:

```typescript
export const Args = z.strictObject({
  typecheck: z.boolean().meta({description: 'dual of no-typecheck'}).default(true),
  'no-typecheck': z.boolean().meta({description: 'opt out of typechecking'}).default(false),
  test: z.boolean().meta({description: 'dual of no-test'}).default(true),
  'no-test': z.boolean().meta({description: 'opt out of running tests'}).default(false),
});
```

`gro check --no-test` disables testing. `--help` hides the positive flags
when a `no-*` dual exists, showing only the `no-*` entry.

## Error Handling

### TaskError

Known failure with clean message (no stack trace):

```typescript
import {TaskError} from '@fuzdev/gro';

throw new TaskError('Missing required config file: gro.config.ts');
```

Use when the message is sufficient for the user to fix the problem.

### SilentError

Exit with non-zero code when the error is already logged. Primarily
internal to `invoke_task.ts`:

```typescript
import {SilentError} from '@fuzdev/gro/task.js';

log.error('Detailed error information...');
throw new SilentError();
```

### When to use which

| Error type    | Stack trace | Gro logs message | Use when                          |
| ------------- | ----------- | ---------------- | --------------------------------- |
| Regular Error | Yes         | Yes              | Unexpected failures               |
| `TaskError`   | No          | Yes              | Known failures with clear message |
| `SilentError` | No          | No               | Already logged the error yourself |

## Task Discovery

Task files use `.task.ts` (or `.task.js`) suffix. Gro searches `task_root_dirs`
in order (default: `src/lib/` then `./` then `gro/dist/`):

```
src/lib/greet.task.ts      -> gro greet
src/lib/deploy.task.ts     -> gro deploy
src/lib/db/migrate.task.ts -> gro db/migrate
```

`gro` with no task name or `gro some/dir` lists all tasks without executing.

## Task Override Pattern

Local tasks override Gro builtins with the same name:

- `src/lib/test.task.ts` overrides Gro's builtin `test` task
- Run the builtin explicitly: `gro gro/test`

Common override pattern wraps the builtin:

```typescript
import type {Task} from '@fuzdev/gro';

export const task: Task = {
  summary: 'run tests with custom setup',
  run: async ({invoke_task, args}) => {
    // custom setup
    await invoke_task('gro/test', args); // call the builtin
    // custom teardown
  },
};
```

## Task Composition

**`invoke_task` (recommended):** Respects overrides, provides logging context,
auto-forwards CLI args from `--` sections:

```typescript
await invoke_task('build', {sync: false, gen: false});
```

**Direct import:** Bypasses override resolution, tighter coupling:

```typescript
import {task as test_task} from './test.task.js';
await test_task.run(ctx);
```

### Args forwarding

CLI args forwarded to composed tasks via `--` separators:

```bash
gro check -- gro test --coverage
```

Forwards `--coverage` to `test` when `check` invokes it. Multiple `--`
sections can target different sub-tasks.

## Quick Reference

| Export        | Type      | Import from           | Purpose                                        |
| ------------- | --------- | --------------------- | ---------------------------------------------- |
| `Task`        | Interface | `@fuzdev/gro`         | Task definition (run, summary, Args)           |
| `TaskContext` | Interface | `@fuzdev/gro`         | Context passed to task.run                     |
| `TaskError`   | Class     | `@fuzdev/gro`         | Known failure (no stack trace)                 |
| `SilentError` | Class     | `@fuzdev/gro/task.js` | Exit silently (error already logged)           |
| `InvokeTask`  | Type      | `@fuzdev/gro/task.js` | `(task_name, args?, config?) => Promise<void>` |
