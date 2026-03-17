# Task Patterns

Guide to Gro's task system for project automation in `@fuzdev/gro`.

Tasks are the primary automation unit in Gro. Each task is a TypeScript module
with a `.task.ts` suffix that exports a `task` object with a `run` function.

## Contents

- [Task Interface](#task-interface)
- [TaskContext](#taskcontext)
- [Error Handling](#error-handling)
- [Task Discovery](#task-discovery)
- [Task Override Pattern](#task-override-pattern)
- [Quick Reference](#quick-reference)

## Task Interface

```typescript
interface Task<TArgs = Args, TArgsSchema extends z.ZodType = z.ZodType, TReturn = unknown> {
  run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;
  summary?: string;
  Args?: TArgsSchema;
}
```

- `run` — the task's entry point, receives `TaskContext`
- `summary` — short description shown in `gro` task listing
- `Args` — optional Zod schema for CLI argument parsing and validation.
  See `references/zod_schemas.md` for full Zod conventions.

### Basic task example

```typescript
// src/lib/greet.task.ts
import type {Task} from '@fuzdev/gro/task.js';

export const task: Task = {
  summary: 'greet the user',
  run: async ({log}) => {
    log.info('hello!');
  },
};
```

Run with `gro greet` or `gro src/lib/greet`.

### Task with args

```typescript
import {z} from 'zod';
import type {Task} from '@fuzdev/gro/task.js';

const Args = z.strictObject({
  name: z.string().meta({description: 'who to greet'}).default('world'),
});
type Args = z.infer<typeof Args>;

export const task: Task<Args, typeof Args> = {
  summary: 'greet someone by name',
  Args,
  run: async ({args, log}) => {
    log.info(`hello, ${args.name}!`);
  },
};
```

Run with `gro greet --name Claude`.

## TaskContext

Every task receives a `TaskContext`. The most commonly used fields:

| Field           | Purpose                                                   |
| --------------- | --------------------------------------------------------- |
| `args`          | Parsed CLI arguments (validated by Zod schema if provided)|
| `log`           | Logger instance scoped to the task                        |
| `invoke_task`   | Call other tasks programmatically                         |

### invoke_task

Call other tasks from within a task:

```typescript
export const task: Task = {
  run: async ({invoke_task}) => {
    await invoke_task('typecheck');
    await invoke_task('test', {watch: false});
  },
};
```

Used by composite tasks like `check` which invokes `typecheck`, `test`,
`gen --check`, `format --check`, and `lint` in sequence.

## Error Handling

### TaskError

Signals a known failure with a clean error message. Gro logs the message without
a stack trace:

```typescript
import {TaskError} from '@fuzdev/gro/task.js';

throw new TaskError('Missing required config file: gro.config.ts');
```

Use when the error message is sufficient for the user to understand and fix the
problem.

### SilentError

Signals that the task should exit with a non-zero code, but the throwing code
has already handled error logging:

```typescript
import {SilentError} from '@fuzdev/gro/task.js';

log.error('Detailed error information...');
throw new SilentError();
```

Use when you've already printed comprehensive error output and don't want Gro to
add more noise.

### When to use which

| Error type    | Stack trace | Gro logs message | Use when                          |
| ------------- | ----------- | ---------------- | --------------------------------- |
| Regular Error | Yes         | Yes              | Unexpected failures               |
| `TaskError`   | No          | Yes              | Known failures with clear message |
| `SilentError` | No          | No               | Already logged the error yourself |

## Task Discovery

Task files use `.task.ts` (or `.task.js`) suffix:

```
src/lib/greet.task.ts      → gro greet
src/lib/deploy.task.ts     → gro deploy
src/lib/db/migrate.task.ts → gro db/migrate
```

## Task Override Pattern

Local tasks override Gro builtins with the same name:

- `src/lib/test.task.ts` overrides Gro's builtin `test` task
- Run the builtin explicitly: `gro gro/test`

This allows projects to customize behavior while keeping the familiar `gro test`
command.

## Quick Reference

| Export        | Type      | Purpose                                |
| ------------- | --------- | -------------------------------------- |
| `Task`        | Interface | Task definition (run, summary, Args)   |
| `TaskContext`  | Interface | Context passed to task.run            |
| `TaskError`   | Class     | Known failure (no stack trace)         |
| `SilentError` | Class     | Silent exit (error already logged)     |
