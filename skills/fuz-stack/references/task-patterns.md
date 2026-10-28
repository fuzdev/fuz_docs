---
description: Gro task system — .task.ts files, TaskContext, error handling
---

# Task Patterns

Gro tasks are `*.task.ts` modules exporting a `task` object. Imports: `Task`,
`TaskContext`, `TaskError` from `@fuzdev/gro`; `SilentError`, `InvokeTask`
from `@fuzdev/gro/task.ts`.

## Task Interface

```typescript
interface Task<TArgs = Args, TArgsSchema extends Schema<Args, Args> = Schema<Args, Args>, TReturn = unknown> {
	run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;
	summary?: string; // shown in `gro` listing and --help
	Args?: TArgsSchema; // fuz_schema schema for CLI arg parsing
}
```

Tasks are either `Task` or `Task<Args>` — the other params are rarely
customized. `Args` is a `@fuzdev/fuz_schema` schema, not Zod; the schema and
its inferred type are both exported as `Args`:

```typescript
// src/lib/greet.task.ts → `gro greet --name Claude`; `--help` is generated from the schema
import type { Task } from '@fuzdev/gro';
import * as s from '@fuzdev/fuz_schema/schema.ts';
import { meta } from '@fuzdev/fuz_schema/meta.ts';

export const Args = s.object({
	name: s.with_default(meta(s.string, { description: 'who to greet', aliases: ['n'] }), 'world')
});
export type Args = s.Infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'greet someone by name',
	Args,
	run: async ({ args, log }) => {
		log.info(`hello, ${args.name}!`);
	}
};
```

**Args conventions**:

- `s.object()`, which refuses unknown flags
- `meta(entry, {description, aliases})` for help text and short flags (`-n`),
  `meta` from `@fuzdev/fuz_schema/meta.ts` (fuz_util's `args.ts` declares
  `aliases` on `SchemaMeta`)
- `s.with_default(entry, x)`, `s.with_default_fn(entry, make)`, or
  `s.optional(entry)` for a flag that may be left out; an entry without one is
  required on the CLI. A defaulted flag is the default alone — an
  `s.optional` around it leaves a missing key out, so the default never applies
- `s.with_default_fn(entry, () => [])` for an array or object default — a
  `with_default` value is the same object on every parse
- integers as `s.pipe(s.number, s.safe_integer)`
- `/** @nodocs */` on the `Args` exports to keep them out of API docs
- positional args in `_: s.with_default_fn(s.array(s.string), () => [])` —
  `gro test foo bar --dir src/lib/` gives `_ = ['foo', 'bar']`
- opt-out booleans as `--no-*` duals — `typecheck: s.with_default(s.boolean, true)`
  paired with `'no-typecheck': s.with_default(s.boolean, false)`; `--help`
  shows only the `no-*` entry

Gro parses with `args_parse` from `@fuzdev/fuz_util/args.ts`: it expands
aliases, syncs `--no-*` duals, and returns `{ok: true, value}` or
`{ok: false, issues}`, each issue printable with fuz_schema's `format_issue`
(`bogus: expected no unknown keys, received number`). `--help` reads the
schema through fuz_schema's `introspect.ts` (`get_schema_fields`,
`format_schema_type`). A CLI outside Gro takes the same schemas through
fuz_util's `args_parse(argv_parse(argv), schema)`. `s.parse_or_throw(Args, value)`
skips alias expansion and `--no-*` sync — fine for a test that passes
canonical keys; `args_parse` for one that exercises flags.

## TaskContext

Fields: `args`, `config: GroConfig`,
`svelte_config: Promise<ParsedSvelteConfig>`, `filer`, `log`, `timings`,
`invoke_task`. `svelte_config` is lazy (resolved on first access); `filer`
tracks the filesystem (watches in dev); `log`/`timings` are task-scoped.

**`invoke_task(task_name, args?, config?)`** composes tasks (omitting `config`
passes the current one) and respects overrides — `invoke_task('test')` runs the
user's override if one exists. `check.task.ts` is the core example: it invokes
`typecheck`, `test`, `gen` (`{check: true}`), `format` (`{check: true}`),
`lint`, with `--no-*` flags gating each. Direct import (`test_task.run(ctx)`)
bypasses override resolution — tighter coupling, rarely wanted. CLI args forward
to composed tasks via `--` sections: `gro check -- gro test --coverage` forwards
`--coverage` to `test`; multiple `--` sections target different sub-tasks.

**Typed names and args**: `InvokeTask` checks a literal name against
`TaskRegistry` and args against the input type of the task module's exported
`Args` schema — defaulted args optional, the rest required. Gro's builtins
(and their `gro/` names) are typed out of the box; a project types its own
tasks with a genfile that writes a `ProjectTasks` augmentation, project names
shadowing builtins like runtime resolution:

```typescript
// src/gro_tasks.gen.ts → src/gro_tasks.ts
import { gen_task_registry } from '@fuzdev/gro/task_registry.ts';

export const gen = gen_task_registry;
```

Names are the ones `gro` lists — path-form for tasks outside `src/lib/`
(`'src/test/fixtures/ts/update'`). A name widened to `string` (dynamic, a
`./` or absolute path, a directory) opts out with loose args. A task without
an exported `Args` accepts any args, so export the schema. `gro dev`
regenerates on task add/change but not delete — run `gro gen` after removing
a task (`gro gen --check` in `gro check` catches it).

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
wraps the builtin, sharing its `Args` schema so the passed-through `args`
type-check against it (untyped `args` can fail with "no properties in common"):

```typescript
import type { Task } from '@fuzdev/gro';
import { Args } from '@fuzdev/gro/test.task.ts';

export const task: Task<Args> = {
	summary: 'run tests with custom setup',
	Args,
	run: async ({ invoke_task, args }) => {
		// setup
		await invoke_task('gro/test', args);
		// teardown
	}
};
```
