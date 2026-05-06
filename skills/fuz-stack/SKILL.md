---
name: fuz-stack
description: Development conventions and coding patterns for the @fuzdev ecosystem — naming, file organization, testing, styling, documentation, and tooling for TypeScript and Svelte 5 projects. Use when writing or reviewing code in any @fuzdev project. Triggers include running gro commands (gro check, gro test, gro gen), styling with fuz_css, writing or splitting tests, generating code with .gen.ts files, naming functions or variables (snake_case conventions), organizing files in src/lib/ or src/test/, writing TSDoc comments, creating Svelte 5 components with runes, or formatting code. Also use for the Result type, fixture-based testing, CSS utility classes, TODO_ docs, breaking changes policy, async concurrency patterns, Gro task system, type utilities (Flavored, Branded), dependency injection patterns (*Deps/*Options/*Context interfaces, AppDeps, RuntimeDeps, mock factories), or setting up documentation (tomes, library.gen.ts, API routes, docs layout).
license: MIT
metadata:
  author: ryanatkn
  version: 0.1.0
---

# Fuz stack conventions

> **Pre-alpha**: Conventions are actively evolving. When code or a project's
> CLAUDE.md conflicts with this skill, the code is ground truth.
>
> **À la carte**: Each project adopts only what serves it. Deep imports and
> the flat namespace make this natural at the package level too.

> **Skip for**: Grimoire-only edits, Rust projects (use repo CLAUDE.md),
> third-party code review, simple git/shell operations.

## Why These Conventions

The Fuz stack is designed so the full software lifecycle — produce, deploy,
operate — is accessible to anyone with intent and an AI partner. These
conventions serve that goal: consistent, self-describing patterns that AI
agents can learn once and apply everywhere. snake_case aligns TS, Rust, and
SQL with zero renaming. Zod schemas are the single source of truth for shape,
types, defaults, and validation. The Cell pattern gives every piece of state
the same structure. When conventions are this consistent, AI can reliably
bridge the gap between a person's intent and the stack's implementation.

The stack composes: `fuz_util → fuz_css → fuz_ui → apps`, with `fuz_app`
as the shared backend spine (auth, sessions, DB, SSE). zzz (local-first
forge) and tx (cloud orchestrator) build on the same primitives. Understanding
one part transfers to understanding the others.

## Package Ecosystem

`@fuzdev/*` packages draw from these conventions. Each package's `CLAUDE.md`
is authoritative for what it actually uses.

| Package        | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `fuz_util`     | foundation utilities (zero deps) — hashing, async, schemas, types        |
| `gro`          | task runner and toolkit extending SvelteKit (temporary, until `fuz`)     |
| `fuz_css`      | CSS framework and design system — apps look good by default              |
| `fuz_ui`       | Svelte 5 components — themes, layouts, overlays, auto-docs               |
| `fuz_app`      | stack spine — auth, sessions, DB, SSE, route specs, CLI/daemon           |
| `fuz_docs`     | experimental AI-generated docs and skills for Fuz                        |
| `fuz_template` | a static web app and Node library template                               |
| `fuz_code`     | syntax styling utilities and components for TypeScript, Svelte, Markdown, and more |
| `fuz_blog`     | blog software from scratch with SvelteKit                                |
| `fuz_mastodon` | Mastodon components and helpers for Svelte, SvelteKit, and Fuz           |
| `fuz_gitops`   | a tool for managing many repos                                           |
| `blake3`       | BLAKE3 hashing compiled to WASM (`@fuzdev/blake3_wasm` + `blake3_wasm_small`) |
| `zzz`          | local-first forge — produce software with AI assistance                  |
| `tx`           | system orchestrator — deploy and operate infrastructure                  |

`gro` is a temporary build tool, will be replaced by `fuz`.

**Dependency flow**: `fuz_util -> gro + fuz_css -> fuz_ui -> fuz_app -> zzz, tx, apps`

## Coding Conventions

### Naming - snake_case + PascalCase

```typescript
// Functions and variables - snake_case
// applies equally to function declarations and arrow function exports
const format_bytes = (n: number): string => { ... };
export const git_current_branch_name = async (): Promise<GitBranch> => { ... };
export function create_context<T>(fallback?: () => T) { ... }
const user_data: Record<string, unknown> = {};

// Types, classes, components - PascalCase
type PackageJson = {};
class DocsLinks {}
// file: src/lib/DocsLink.svelte
```

**NOT** camelCase for functions/variables. Intentional divergence:

- **Cross-language alignment** — same identifiers in TS, Rust, and SQL with
  zero renaming cost (`keyed_hash`, `get_user_sessions`, `git_push`).
- **Legibility** — underscores as explicit word boundaries:
  `package_json_load` vs `packageJsonLoad`.

**External APIs keep their native casing.** `.map()`, `addEventListener()`,
`initSync` — only identifiers you define follow snake_case.

```typescript
// Constants - SCREAMING_SNAKE_CASE
const DEFAULT_TIMEOUT = 5000;
const GITOPS_CONFIG_PATH_DEFAULT = 'gitops.config.ts';
```

### Naming Patterns

Two forms, chosen by **disambiguation** in the flat namespace:

**Domain-prefix** (`domain_action`) — when the bare action name would be
ambiguous:

```typescript
git_push(); // git_* cluster (fuz_util/git.ts)
git_fetch(); // "push"/"fetch" alone are ambiguous
time_format(); // time_* cluster (fuz_util/time.ts)
contextmenu_open(); // contextmenu_* cluster (fuz_ui)
package_json_load(); // package_json_* cluster (gro)
```

**Action-first** (`action_domain`) — when already self-descriptive:

```typescript
truncate(); // standalone (fuz_util/string.ts)
strip_start(); // action is the concept (fuz_util/string.ts)
escape_js_string(); // action with domain qualifier (fuz_util/string.ts)
should_exclude_path(); // predicate form (fuz_util/path.ts)
to_file_path(); // conversion (fuz_util/path.ts)
```

| Pattern               | Example                | Use Case                        |
| --------------------- | ---------------------- | ------------------------------- |
| `domain_action`       | `git_push`             | Disambiguates in flat namespace |
| `domain_is_adjective` | `module_is_typescript` | Boolean in a domain cluster     |
| `to_target`           | `to_file_path`         | Conversions                     |
| `format_target`       | `format_number`        | Formatting                      |
| `action_domain`       | `escape_js_string`     | Self-descriptive utilities      |
| `create_domain`       | `create_context`       | Factory functions               |

**Rule of thumb**: domain-prefix when the bare name is ambiguous (`git_push`
not `push`); action-first when self-descriptive (`truncate`, `strip_start`).
File names often signal which: `git.ts` → `git_*`, `string.ts` → action-first.

**Action verbs**: `parse`, `create`, `get`, `to`, `is`, `has`, `format`,
`render`, `analyze`, `extract`, `load`, `save`, `escape`, `strip`, `ensure`,
`validate`, `should`

### Flat Namespace - Fail Fast

All exported identifiers must have **unique names across all modules**:

- `library.gen.ts` uses `library_throw_on_duplicates` (from fuz_ui) to detect
  conflicts during `gro gen` — every project opts in via
  `library_gen({on_duplicates: library_throw_on_duplicates})`
- Error shows all conflicts with module paths and kinds
- Resolution: rename one following the domain_action pattern, or add
  `/** @nodocs */` to exclude from validation
- **Which side to rename** — rename the side that is *not* the primary
  public API. `@nodocs` is the wrong tool when external consumers depend
  on the hidden symbol (it vanishes from docs and tomes).
  - Component is primary (class is a state/helper): suffix the class with
    `State` / `Info`. Example: `DocsLink` interface → `DocsLinkInfo` when
    it conflicts with `DocsLink.svelte`. Precedent: `ThemeState`,
    `AuthState`, `SidebarState`.
  - Class is primary (stateful with methods/lifecycle, consumers
    instantiate it): suffix the component with `View` / `Pane`. Example:
    `MusicPlayer` class kept, component renamed to `MusicPlayerView.svelte`.

### File Organization

```
src/
├── lib/              # exportable library code
│   ├── *.svelte      # UI components (PascalCase.svelte)
│   ├── *.ts          # TypeScript utilities
│   ├── *.svelte.ts   # Svelte 5 runes and reactive code
│   ├── *.gen.ts      # generated files (by Gro gen tasks)
│   └── domain/       # domain subdirectories (see below)
│       └── *.ts
├── test/             # tests (NOT co-located with source)
│   └── *.test.ts     # mirrors lib/ structure
└── routes/           # SvelteKit routes (if applicable)
```

#### Domain subdirectories

When a domain grows beyond a single file, group related modules in a
subdirectory under `lib/`. Each file is a distinct concern — no barrel/index
files.

```
src/lib/
├── env/              # environment variable handling
│   ├── load.ts       # schema-based env loading + validation
│   ├── resolve.ts    # $$VAR$$ reference resolution
│   ├── dotenv.ts     # .env file parsing
│   └── mask.ts       # secret value display masking
├── auth/             # authentication domain (~34 files)
│   ├── keyring.ts    # crypto: HMAC-SHA256 cookie signing
│   ├── password.ts   # crypto: password hashing interface
│   ├── account_schema.ts  # types + Zod schemas
│   ├── account_queries.ts # database queries
│   ├── session_middleware.ts  # Hono middleware
│   └── account_routes.ts     # route spec factories
├── http/             # generic HTTP framework
├── db/               # database infrastructure
├── server/           # backend lifecycle + assembly
├── runtime/          # composable runtime deps + implementations
├── cli/              # CLI infrastructure
├── actions/          # action spec system
├── realtime/         # SSE and pub/sub
├── testing/          # test utilities (shared across consumers)
├── ui/               # frontend components and state
└── dev/              # dev workflow helpers
```

**When to create a subdirectory**: 3+ closely related files sharing a domain
concept. A single file stays at `lib/` root. Don't create subdirectories
preemptively.

**Consumers import individual modules by full path** — the subdirectory is
part of the import path, not hidden behind re-exports:

```typescript
import {load_env} from '@fuzdev/fuz_app/env/load.js';
import {resolve_env_vars} from '@fuzdev/fuz_app/env/resolve.js';
import {create_app_backend} from '@fuzdev/fuz_app/server/app_backend.js';
```

**Tests mirror the subdirectory structure** in `src/test/`:

```
src/test/
├── env/
│   ├── load.test.ts
│   ├── resolve.test.ts
│   ├── dotenv.test.ts
│   └── mask.test.ts
├── auth/
│   ├── keyring.test.ts
│   └── account_queries.db.test.ts  # .db.test.ts suffix for PGlite tests
└── server/
    └── env.test.ts     # server-specific env (BaseServerEnv, validate_server_env)
```

### Code Style

- **TypeScript**: Strict mode, explicit types
- **Svelte**: Svelte 5 with runes API ($state, $derived, $effect)
- **Formatting**: Prettier with tabs, 100 char width
- **Extensions**: Always include `.js` in imports (even for `.ts` files):
  `import {foo} from './bar.js'` (for a `bar.ts` file)
- **Comments**:
  - JSDoc (`/** ... */`) = proper sentences with periods
  - Inline (`//`) = fragments, no capital or period
- **No barrel exports**: Import by exact file path, no `index.ts`. Package
  `exports` use wildcard patterns (`"./*.js"`) so every module is importable.
- **No backwards compatibility**: Delete unused code, rename directly, no
  deprecated stubs or shims. Document breaking changes in changesets.

## Gro Commands (Temporary Build Tool)

**IMPORTANT**: Gro is installed globally — always run `gro` directly, never
`npx gro`.

**Development:**

```bash
gro test         # run vitest tests
gro gen          # run code generators (*.gen.ts files)
gro format       # format with Prettier
gro lint         # run ESLint
gro typecheck    # run TypeScript type checking
```

**Production:**

```bash
gro build        # production build (runs plugin lifecycle)
gro check        # ALL checks: test + gen --check + format --check + lint + typecheck
gro publish      # version with Changesets, publish to npm, push to git
gro deploy       # build and force push to deploy branch
gro release      # combined publish + deploy workflow
```

**Utilities:** `gro sync` (gen + update exports), `gro run file.ts` (execute
TS), `gro changeset` (create changeset). `SKIP_EXAMPLE_TESTS=1 gro test`
to skip slow tests.

**Key behaviors:** `gro check` is the CI command. `gro gen --check` verifies
no drift. Tasks are overridable: local `src/lib/foo.task.ts` overrides
`gro/dist/foo.task.js`; call builtin with `gro gro/foo`.

**Never run `gro dev` or `npm run dev`** — user manages the dev server.

## Code Generation

Gen files (`*.gen.ts`) export a `gen` function, discovered by the `.gen.`
pattern in filenames. Naming: `foo.gen.ts` → `foo.ts`, `foo.gen.css.ts` →
`foo.css`. Return `string`, `{content, filename?, format?}`, `Array`, or
`null`.

Common gen patterns: `library.gen.ts` (library metadata for docs),
`fuz.gen.css.ts` (bundled fuz_css for a project), `theme.gen.css.ts`
(theme CSS from style variables).

See ./references/code-generation.md for the full API, dependencies, and
examples.

## TSDoc/JSDoc Conventions

See ./references/tsdoc-comments.md for the full tag guide, documentation
patterns, and auditing.

**Key rules:**

- Main description: complete sentences ending in a period
- `@param name - description`: hyphen separator; single-sentence: lowercase, no
  period; multi-sentence: capitalize, end with period
- `@returns` (not `@return`): same single/multi-sentence rule as `@param`
- `@module`: complex modules get a module-level doc comment with `@module` at end
- `@mutates target - description`: document parameter/state mutations
  (also `` @mutates `target` `` for self-evident mutations)
- `@nodocs`: exclude from docs and flat namespace validation
- Wrap identifier references in backticks for auto-linking via `mdz`

**Tag order**: description → `@param` → `@returns` → `@mutates` → `@throws` →
`@example` → `@deprecated` → `@see` → `@since` → `@default` → `@nodocs`

## Svelte 5 Patterns

See ./references/svelte-patterns.md for `$state.raw()`, `$derived.by()`,
reactive collections (SvelteMap/SvelteSet), schema-driven reactive classes,
snippets, effects, attachments, props, event handling, component composition,
and legacy features to avoid.

### Runes API

`$state.raw()` by default for all reactive state. `$state()` only for
arrays/objects mutated in place (push, splice, index assignment). `$derived`
for computed values, `$effect` for side effects.

### Context Pattern

Standardized via `create_context<T>()` from
`@fuzdev/fuz_ui/context_helpers.js`. Common contexts: `theme_state_context`
(theme), `library_context` (package API metadata), `tome_context` (current
doc page).

## Documentation System

Projects use **tomes** (not "stories") with auto-generated API docs.

**Pipeline**: source files → `library_generate()` → `library.json` +
`library.ts` → `Library` class → Tome pages + API routes.

See ./references/documentation-system.md for setup, the full pipeline, Tome
system, layout architecture, and component reference. TSDoc authoring
conventions: ./references/tsdoc-comments.md.

## mdz - Minimal Markdown Dialect

`mdz` is fuz_ui's markdown dialect for documentation (`@fuzdev/fuz_ui/mdz.ts`).

| Feature                | Syntax                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Code                   | `` `code` ``                                                                        |
| Bold / italic / strike | `**bold**`, `_italic_`, `~strike~`                                                  |
| Links                  | auto-detected URLs, `/internal/path`, `[text](url)`                                 |
| Headings               | `# Heading` (column 0 required, gets lowercase slugified `id` for fragment links)    |
| Code blocks            | fenced with language hints                                                          |
| Components             | `<Alert status="warning">content</Alert>` (registered via `mdz_components_context`) |

```svelte
<Mdz content="Some **bold** and `code` text." />
```

Backticked identifiers auto-link to API docs in TSDoc rendering.

### Path references in documentation

Use bare paths (no backticks) for navigational file references. Backticks are
reserved for code, CLI commands, and identifiers — not paths.

Valid bare-path forms — pick the most readable for the file's location:

- `./foo` and `../foo` — relative to the file's directory; mdz auto-linkifies
  these when preceded by whitespace
- `~/dev/foo` — anchored at the workspace root; reads cleanly at any nesting
  depth
- `grimoire/foo` — anchored at the workspace root; preferred over deep
  `../../grimoire/foo` from nested files

Backticks belong on code-shaped things, not paths:

- CLI commands: `gro check`, `deno task scry`
- Source-tree references: `src/lib/foo.ts`, `package.json`, `gitops.config.ts`
- System/config identifiers: `~/.fuz/`, `~/.mg/config.json`

Each file's relative paths assume the reader is in the file's parent directory.
For `~/dev/CLAUDE.md`, project paths are `./project/`. For
`~/dev/grimoire/CLAUDE.md`, sibling grimoire files use `./lore/` and repo
references use `../fuz_util/`. From deeply nested files like
`grimoire/lore/fuz/design/foo.md`, prefer `grimoire/quests/bar.md` over
`../../../quests/bar.md`.

**Web-rendered caveat**: in files published via mdz on a website (this SKILL.md
on fuz_docs), `./foo` and `../foo` examples must be backticked to prevent mdz
from rendering them as broken `<a>` tags. `~/dev/foo` and `grimoire/foo` are
safe bare in web context — mdz doesn't auto-linkify those prefixes.

**Anti-patterns** (linkifier won't fire, costing tokens and navigability):

- Backticking a path that points to a real file or directory:
  `` `./src/lib/foo.ts` `` defeats auto-linking; `` `~/dev/fuz_util` `` reads
  as a code identifier when it's actually a navigational target.
- Wrapping a path in markdown-link syntax when target equals visible text:
  `[../README.md](../README.md)` is redundant; bare `../README.md` already
  auto-links. Same for `[~/dev/foo](~/dev/foo)` — collapse to bare
  `~/dev/foo`. Reserve `[text](url)` for cases where the visible token
  *isn't* the path — e.g. a package-name-as-link:
  `[@fuzdev/fuz_app](../../fuz_app)`.

**Formatter cautions** (Prettier in particular — these have bitten real docs):

- A line wrapping after `+` becomes a sublist. `cell + fact` followed by
  Prettier wrapping to `+ cell_history` reflows as a bullet. Rephrase
  (`cell, fact, and cell_history`) or keep the `+` mid-line.
- Bare `_` in inline prose mixed with backticked identifiers can be parsed
  as italic delimiters and mangle text — eating spaces and swapping
  characters. Backtick identifiers like `scope_id` or `cell_*` even when
  the surrounding sentence isn't otherwise code-heavy. When several
  `_`-bearing identifiers appear in one sentence, restructure as a bullet
  list so each lands at end-of-line away from prose interactions.

## Testing

Tests live in `src/test/` (NOT co-located). Use `assert` from vitest —
choose methods for TypeScript type narrowing, not semantic precision.
`assert(x instanceof Error)` narrows the type;
`expect(x).toBeInstanceOf(Error)` does not. Name custom assertion helpers
`assert_*` (not `expect_*`).

Use `describe` blocks to organize tests — one or two levels deep is typical.
Use `test()` (not `it()`).

Split large suites with dot-separated aspects: `{module}.{aspect}.test.ts`
(e.g., `csp.core.test.ts`, `csp.security.test.ts`). Database tests use
`.db.test.ts` suffix to opt into shared PGlite WASM via vitest `projects`
(see ./references/testing-patterns.md).

For parsers and transformers, use fixture-based testing: input files in
`src/test/fixtures/<feature>/<case>/`, regenerate `expected.json` via
`gro src/test/fixtures/<feature>/update`. **Never manually edit
`expected.json`** — always regenerate via task.

See ./references/testing-patterns.md for file organization, test helpers,
shared test factories, mock factories, fixture workflow, database testing,
environment flags, and test structure.

## TODOs

Leave **copious** `// TODO:` comments in code — they're expected and encouraged
for visibility into known future work, not debt to hide.

For multi-session work, create `TODO_*.md` files in the project root with
status, next steps, and decisions. Delete when complete. **Update before ending
a session.**

## Custom Tasks

See ./references/task-patterns.md for the Task interface, Zod-based Args,
TaskContext, error handling, override patterns, and task composition.

## fuz_css

See ./references/css-patterns.md for setup, variables, composites, modifiers,
extraction, and dynamic theming.

**Minimal component styles**: Components should have minimal or zero custom CSS,
delegating to fuz_css utilities and design tokens. Use `box`/`row`/`column`
for layout, token classes for spacing/colors, and `<style>` only for
component-specific logic (positioning, pseudo-states, responsive breakpoints).
See css-patterns.md §Component Styling Philosophy for the full guide.

**Class naming**: fuz_css tokens use `snake_case` (`p_md`, `gap_lg`).
Component-local classes use `kebab-case` (`site-header`, `nav-links`).

### 3-Layer Architecture

| Layer              | File        | Purpose                                                   |
| ------------------ | ----------- | --------------------------------------------------------- |
| 1. Semantic styles | `style.css` | Reset + element defaults (buttons, inputs, forms, tables) |
| 2. Style variables | `theme.css` | 600+ design tokens as CSS custom properties               |
| 3. Utility classes | `fuz.css`   | Optional, generated per-project with only used classes    |

### CSS Classes

| Type                  | Example                               | Purpose                      |
| --------------------- | ------------------------------------- | ---------------------------- |
| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |
| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |
| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |

**Comment hints** for static extraction: `// @fuz-classes box row p_md`,
`// @fuz-elements button input`, `// @fuz-variables shade_40 text_50`.

### When to Use Classes vs Styles

| Need                   | Utility class | Style tag | Inline style |
| ---------------------- | ------------- | --------- | ------------ |
| Style own elements     | **Preferred** | Complex cases | OK        |
| Style child components | **Yes**       | No        | Limited      |
| Hover/focus/responsive | **Yes**       | Yes       | No           |
| Runtime dynamic values | No            | No        | **Yes**      |
| IDE autocomplete       | No            | **Yes**   | Partial      |

## Dependency Injection

**Small standalone `*Deps` interfaces, composed bottom-up.** Leaf functions
import small interfaces directly (not `Pick<Composite>`).

- **Three suffixes** — `*Deps` (capabilities/functions, fresh mock factories per
  test), `*Options` (data/config values, literal objects), `*Context` (scoped
  world for a callback/handler). No `*Config` suffix — use `*Options`.
- **Grouped deps** — composite interface by domain. fuz_css uses `deps.ts` +
  `deps_defaults.ts`; fuz_gitops uses `operations.ts` + `operations_defaults.ts`.
- **AppDeps** — stateless capabilities bundle for server code (fuz_app
  `auth/deps.ts`).
- **RuntimeDeps** — composable small `*Deps` interfaces for runtime operations
  (env, fs, commands), with platform-specific factories (Deno, Node, mock).
- **Design principles** — single `options` object params, `Result` returns
  (never throw), `null` for not-found, plain object mocks (no mocking libs),
  stateless capabilities, runtime agnosticism.

See ./references/dependency-injection.md for the full pattern guide, naming
conventions, consumption patterns, RuntimeDeps, and mock factories.

## Common Utilities

`@fuzdev/fuz_util` provides shared utilities:

- **Result type** — `Result<TValue, TError>` discriminated union for error
  handling without exceptions. Properties go directly on the result object via
  intersection: `({ok: true} & TValue) | ({ok: false} & TError)`.
- **Logger** — hierarchical logging via `new Logger('module')`, controlled by
  `PUBLIC_LOG_LEVEL` env var
- **Timings** — performance measurement via `timings.start('operation')`
- **DAG execution** — `run_dag()` for concurrent dependency graphs
- **Async concurrency** — `each_concurrent`, `map_concurrent`,
  `map_concurrent_settled`, `AsyncSemaphore`, `Deferred`
- **Type utilities** — `Flavored`/`Branded` nominal typing, `OmitStrict`,
  `PickUnion`, selective partials

See ./references/common-utilities.md for Result patterns, Logger configuration,
and Timings usage. See ./references/async-patterns.md for concurrency
primitives. See ./references/type-utilities.md for the full type API.

## Zod Schemas

Zod schemas are source of truth for JSON shape, TypeScript type, defaults,
metadata, CLI help text, and serialization. Schema changes cascade through the
stack; treat them as critical review points.

- **`z.strictObject()`** — default for all object schemas. `z.looseObject()`
  or `z.object()` for external/third-party data with a comment explaining why.
- **PascalCase naming** — schema and type share the same name, no suffix:
  `const Foo = z.strictObject({...}); type Foo = z.infer<typeof Foo>;`
- **`.meta({description: '...'})`** — not `.describe()`. Both work in Zod 4
  but `.meta()` is the convention and supports additional keys.
- **`.brand()` for validated nominal types** — `Uuid`, `Datetime`, `DiskfilePath`
- **`safeParse` at boundaries** — graceful errors for external input.
  `parse` for internal assertions.

See ./references/zod-schemas.md for branded types, transform pipelines,
discriminated unions, route specs, schemas as runtime data, instance schemas
(zzz Cell), and introspection.

## Quick Reference

- `gro check` to validate (never run dev server)
- snake_case for functions, PascalCase for types/components
- Tests in `src/test/`, not co-located
- Domain-prefix when ambiguous (`git_push`); action-first when self-descriptive
  (`truncate`)
- TSDoc conventions: ./references/tsdoc-comments.md
- Copious `// TODO:` comments; `TODO_*.md` for multi-session work
- Token classes for design system values, literal classes for arbitrary CSS
- `z.strictObject()` default, PascalCase naming, `.meta()` for descriptions
- Breaking changes acceptable — delete unused code, don't shim
- Never manually edit `expected.json` — regenerate via task
