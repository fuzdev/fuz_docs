---
name: fuz-stack
description: Development conventions and coding patterns for the @fuzdev ecosystem — naming, file organization, testing, styling, documentation, and tooling for TypeScript and Svelte 5 projects. Use when writing or reviewing code in any @fuzdev project. Triggers include running gro commands (gro check, gro test, gro gen), styling with fuz_css, writing or splitting tests, generating code with .gen.ts files, naming functions or variables (snake_case conventions), organizing files in src/lib/ or src/test/, writing TSDoc comments, creating Svelte 5 components with runes, or formatting code. Also use for the Result type, fixture-based testing, CSS utility classes, TODO_ docs, breaking changes policy, async concurrency patterns, Gro task system, type utilities (Flavored, Branded), dependency injection patterns (*Deps interfaces, AppDeps, mock factories), or setting up documentation (tomes, library.gen.ts, API routes, docs layout).
license: MIT
metadata:
  author: ryanatkn
  version: 0.1.0
---

# Fuz stack conventions

> **Pre-alpha**: These conventions are actively evolving. Patterns described
> here reflect current practice but may change as the stack matures. When in
> doubt, check the project's CLAUDE.md and the actual code — they're the
> ground truth if they conflict with this skill.
>
> **À la carte**: Each project adopts only the conventions that serve it.
> Nothing here is all-or-nothing — a project might use the naming conventions
> but not the testing patterns, or the DI style but not the docs system.
> Deep imports and the flat namespace make this natural at the package level
> too: consumers import individual modules, not entire libraries.

> **Skip for**: Grimoire-only edits, Rust projects (use repo CLAUDE.md),
> third-party code review, simple git/shell operations.

## Package Ecosystem

`@fuzdev/*` packages draw from these conventions. Each package has a
`CLAUDE.md` with project-specific context — that's the authoritative source
for what a given project actually uses.

| Package        | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `fuz_util`     | utility belt for JS                                                      |
| `gro`          | task runner and toolkit extending SvelteKit                              |
| `fuz_css`      | CSS framework and design system for semantic HTML                        |
| `fuz_ui`       | Svelte UI library                                                        |
| `fuz_app`      | fullstack app library (auth, sessions, DB, SSE, routes, CLI)             |
| `fuz_docs`     | experimental AI-generated docs and skills for Fuz                        |
| `fuz_template` | a static web app and Node library template                               |
| `fuz_code`     | syntax styling utilities and components for TypeScript, Svelte, and more |
| `fuz_blog`     | blog software from scratch with SvelteKit                                |
| `fuz_mastodon` | Mastodon components and helpers for Svelte, SvelteKit, and Fuz           |
| `fuz_gitops`   | a tool for managing many repos                                           |
| `blake3`       | BLAKE3 WASM hashing (`@fuzdev/blake3_wasm`)                              |
| `zzz`          | local-first forge for power users and developers                         |

`gro` is a temporary build tool, will be replaced by `fuz`.

**Dependency flow**: `fuz_util -> gro + fuz_css -> fuz_ui -> fuz_* apps`

## Coding Conventions

### Naming - snake_case + PascalCase

```typescript
// Functions and variables - snake_case
// applies equally to function declarations and arrow function exports
function github_file_url(path: string) {}
const format_bytes = (n: number): string => `${n}B`;
export const create_context = <T>(key: symbol): Context<T> => { ... };
const user_data: Record<string, unknown> = {};

// Types, classes, components - PascalCase
type PackageJson = {};
class DocsLinks {}
// file: src/lib/DocsLink.svelte
```

**NOT** camelCase for functions/variables. This diverges from JS ecosystem
conventions intentionally:

- **Rust alignment** — Rust uses snake_case for functions and will progressively
  replace TS in this stack. `keyed_hash` stays `keyed_hash` in both languages,
  with zero renaming cost as code migrates.
- **PostgreSQL alignment** — SQL function names match TS identifiers directly.
  `get_user_sessions()` in TS calls `get_user_sessions()` in Postgres with no
  mental translation.
- **Domain-prefix legibility** — compound domain prefixes are far clearer with
  underscores as explicit word boundaries: `package_json_load`,
  `contextmenu_open`, `should_exclude_path`. camelCase collapses those
  boundaries (`packageJsonLoad`).
- **Flat namespace searchability** — `git_push` appears identically in TS, Rust,
  and SQL, so one grep finds all occurrences across layers.

**External APIs are not subject to this rule.** JS/browser built-ins and
third-party library methods remain in their native camelCase: `.map()`,
`.forEach()`, `addEventListener()`, `initSync`. Only identifiers you define
follow snake_case.

```typescript
// Constants - SCREAMING_SNAKE_CASE
const DEFAULT_TIMEOUT = 5000;
const GITOPS_CONFIG_PATH_DEFAULT = 'gitops.config.ts';
```

### Naming Patterns

Two main forms, chosen by **disambiguation** in the flat namespace:

**Domain-prefix** (`domain_action`) — use when the bare action name would be
ambiguous across the flat namespace:

```typescript
git_push(); // git_* cluster (fuz_util/git.ts)
git_fetch(); // "push"/"fetch" alone are ambiguous
time_format(); // time_* cluster (fuz_util/time.ts)
contextmenu_open(); // contextmenu_* cluster (fuz_ui)
package_json_load(); // package_json_* cluster (gro)
```

**Action-first** (`action_domain`) — use when the name is already
self-descriptive without a domain prefix:

```typescript
truncate(); // standalone, self-descriptive (fuz_util/string.ts)
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

- Build fails during `gro gen` if duplicate names exist
- Error shows all conflicts with module paths and kinds
- Resolution: rename one following the domain_action pattern
- Example: `DocsLink` interface -> `DocsLinkInfo` when it conflicts with
  `DocsLink.svelte`

**Why**: Flat namespace design enables direct imports and prevents silent
overwrites.

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
subdirectory under `lib/`. Each file in the subdirectory is a distinct concern
within the domain — no barrel/index files.

```
src/lib/
├── env/              # environment variable handling
│   ├── load.ts       # schema-based env loading + validation
│   ├── resolve.ts    # $$VAR$$ reference resolution
│   ├── dotenv.ts     # .env file parsing
│   └── mask.ts       # secret value display masking
├── auth/             # authentication domain (~28 files)
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
└── cli/              # CLI infrastructure
```

**When to create a subdirectory**: when you have 3+ closely related files that
share a domain concept. A single file stays at the `lib/` root. Don't create
subdirectories preemptively — let the code grow into them.

**Consumers import individual modules by full path** — the subdirectory is part
of the import path, not hidden behind re-exports:

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
│   └── dotenv.test.ts
├── auth/
│   └── keyring.test.ts
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
- **No barrel exports or re-exports**: Every module is imported by its exact
  file path — no `index.ts` aggregation files. Consumers use deep imports like
  `import {foo} from '@fuzdev/pkg/path/to/module.js'`. This keeps bundler
  tree-shaking simple, makes import provenance obvious, and eliminates a class
  of maintenance work (keeping barrel files in sync). The flat namespace
  convention (unique names across all modules) makes this practical — you never
  need barrels to disambiguate. Package `exports` in `package.json` use wildcard
  patterns (`"./*.js"`) so every module in `dist/` is importable.
- **No backwards compatibility**: Delete unused code, rename directly, no
  deprecated stubs or shims. Document breaking changes in changesets. The flat
  namespace and `gro gen` duplicate detection catch missed references.

## Gro Commands (Temporary Build Tool)

Every project uses Gro (`@fuzdev/gro`) as the build system until `fuz` matures.

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
TS), `gro changeset` (create changeset). Environment:
`SKIP_EXAMPLE_TESTS=1 gro test` to skip slow tests.

**Key behaviors:** `gro check` is the CI command. `gro gen --check` verifies no
drift. Tasks are overridable: local `src/lib/foo.task.ts` overrides
`gro/dist/foo.task.js`; call builtin with `gro gro/foo`.

**Important**: Never run `gro dev` or `npm run dev` - user manages the dev
server.

## Code Generation

Gen files (`*.gen.ts`) export a `gen` function, discovered by the `.gen.`
pattern in filenames. Naming: `foo.gen.ts` → `foo.ts`, `foo.gen.css.ts` →
`foo.css`. Return `string`, `{content, filename?, format?}`, `Array`, or
`null`.

Common gen patterns: `package.gen.ts` (metadata), `*.gen.css.ts` (CSS from
style variables), `library.gen.ts` (library index for exports).

See `references/code_generation.md` for the full API, dependencies, and
examples.

## TSDoc/JSDoc Conventions

See `references/tsdoc_comments.md` for the full tag guide, documentation
patterns, and auditing.

**Key rules:**

- Main description: complete sentences ending in a period
- `@param name - description`: hyphen separator; single-sentence: lowercase, no
  period; multi-sentence: capitalize, end with period
- `@returns` (not `@return`): same single/multi-sentence rule as `@param`
- `@module`: every module gets a module-level doc comment with `@module` at end
- `@mutates target - description`: document parameter/state mutations
- `@nodocs`: exclude from docs and flat namespace validation
- Wrap identifier references in backticks for auto-linking via `mdz`

**Tag order**: description → `@param` → `@returns` → `@throws` → `@example` →
`@deprecated` → `@see` → `@since` → `@default` → `@nodocs` → `@mutates`

## Svelte 5 Patterns

See `references/svelte_patterns.md` for `$state.raw()`, `$derived.by()`,
snippets, effects, and attachments.

### Runes API

`$state()` for reactive state, `$derived` for computed values, `$effect` for
side effects. Use `$state.raw()` for data replaced wholesale (API responses).

### Context Pattern

Standardized context via `create_context<T>()` from
`@fuzdev/fuz_ui/context_helpers.js`. Common contexts: `theme_state_context` (theme),
`library_context` (package API metadata), `tome_context` (current doc page).

## Documentation System

Projects use **tomes** (not "stories") with auto-generated API docs.

**Pipeline**: svelte-docinfo → `library_gen.ts` → `library.json` → Tome pages +
API routes.

See `references/documentation_system.md` for setup and the full pipeline. TSDoc
authoring conventions: `references/tsdoc_comments.md`.

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

## Testing

Tests live in `src/test/` (NOT co-located with source). Use vitest with `assert`
(never `expect`) — choose methods for TypeScript type narrowing, not semantic
precision (`assert.ok` is often right when TS understands the flow).

Split large test suites using dot-separated aspects:
`{module}.{aspect}.test.ts` (e.g., `csp.core.test.ts`,
`csp.security.test.ts`). Database test files use `.db.test.ts` suffix
to opt into shared PGlite WASM via vitest `projects` (see
`references/testing_patterns.md`).

For parsers and transformers, use fixture-based testing: input files in
`src/test/fixtures/<feature>/<case>/`, regenerate `expected.json` via
`gro src/test/fixtures/<feature>/update`. **Never manually edit
`expected.json`** — always regenerate via task.

See `references/testing_patterns.md` for file organization, mock factories,
in-memory filesystem, fixture workflow, and assertion helpers.

## TODOs

Leave **copious** `// TODO:` comments in code — they're expected and encouraged
for visibility into known future work, not debt to hide.

For multi-session work, create `TODO_*.md` files in the project root with
status, next steps, and decisions. Delete when complete. **Update before ending
a session.**

## Custom Tasks

See `references/task_patterns.md` for the Task interface, Zod-based Args,
TaskContext, error handling, and override patterns.

## fuz_css

See `references/css_patterns.md` for setup, variables, composites, modifiers,
and extraction.

### 3-Layer Architecture

| Layer              | File        | Purpose                                                   |
| ------------------ | ----------- | --------------------------------------------------------- |
| 1. Semantic styles | `style.css` | Reset + element defaults (buttons, inputs, forms, tables) |
| 2. Style variables | `theme.css` | ~250+ design tokens as CSS custom properties              |
| 3. Utility classes | `fuz.css`   | Optional, generated per-project with only used classes    |

### CSS Classes

| Type                  | Example                               | Purpose                      |
| --------------------- | ------------------------------------- | ---------------------------- |
| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |
| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |
| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |

**Comment hints** for static extraction: `// @fuz-classes box row p_md`,
`// @fuz-elements button input`.

### When to Use Classes vs Styles

| Need                   | Style tag | Utility class | Inline style |
| ---------------------- | --------- | ------------- | ------------ |
| Style own elements     | **Best**  | OK            | OK           |
| Style child components | No        | **Yes**       | Limited      |
| Hover/focus/responsive | Yes       | **Yes**       | No           |
| Runtime dynamic values | No        | No            | **Yes**      |
| IDE autocomplete       | **Yes**   | No            | Partial      |

## Dependency Injection

**Small standalone `*Deps` interfaces, composed bottom-up.** Leaf functions
import small interfaces directly (not `Pick<Composite>`).

- **Grouped deps** — composite interface by domain (`deps.ts` +
  `deps_defaults.ts`). Used by fuz_gitops, fuz_css.
- **AppDeps** — stateless capabilities bundle for server code. Defined in
  fuz_app (`auth/deps.ts`).
- **Design principles** — single `options` object params, `Result` returns
  (never throw), `null` for not-found, plain object mocks (no mocking libs).

See `references/dependency_injection.md` for the full pattern guide, file naming
conventions, consumption patterns, and mock factories.

## Common Utilities

`@fuzdev/fuz_util` provides shared utilities used across the ecosystem:

- **Result type** — `Result<TValue, TError>` discriminated union for error
  handling without exceptions. Properties go directly on the result object via
  intersection: `({ok: true} & TValue) | ({ok: false} & TError)`.
- **Logger** — hierarchical logging via `new Logger('module')`, controlled by
  `PUBLIC_LOG_LEVEL` env var
- **Timings** — performance measurement via `timings.start('operation')`
- **DAG execution** — `run_dag()` for concurrent dependency graphs
- **Async concurrency** — `each_concurrent`, `map_concurrent`,
  `AsyncSemaphore`, `Deferred`
- **Type utilities** — `Flavored`/`Branded` nominal typing, `OmitStrict`,
  `PickUnion`, selective partials

See `references/common_utilities.md` for Result patterns, Logger configuration,
and Timings usage. See `references/async_patterns.md` for concurrency
primitives. See `references/type_utilities.md` for the full type API.

## Zod Schemas

Zod schemas are architectural centerpieces — source of truth for JSON shape,
TypeScript type, defaults, metadata, CLI help text, and serialization. Schema
changes cascade through the stack; treat them as critical review points.

- **`z.strictObject()`** — default for all object schemas. Use `z.object()`
  only for external/third-party data with a comment explaining why.
- **PascalCase naming** — schema and type share the same name, no suffix:
  `const Foo = z.strictObject({...}); type Foo = z.infer<typeof Foo>;`
- **`.meta({description: '...'})`** — not `.describe()`. Both work in Zod 4
  but `.meta()` is the convention and supports additional keys.
- **`.brand()`** for validated nominal types — `Uuid`, `Datetime`, `DiskfilePath`
- **`safeParse` at boundaries** — graceful errors for external input.
  `parse` for internal assertions.

See `references/zod_schemas.md` for branded types, transform pipelines,
discriminated unions, route specs, and introspection.

## Quick Reference

**When working with fuz-stack projects (TypeScript/Svelte):**

- Use `gro check` to validate (never run dev server)
- Follow snake_case for functions, PascalCase for types/components
- Put tests in `src/test/`, not co-located
- Use domain-prefix naming when bare names would be ambiguous (`git_push`,
  `time_format`); action-first when self-descriptive (`truncate`, `strip_start`)
- Document with TSDoc using proper conventions (see
  `references/tsdoc_comments.md` for details)
- Leave copious `// TODO:` comments in code for known future work
- Track long work in `TODO_*.md` files
- Use token classes for design system values, literal classes for arbitrary CSS
- Use `z.strictObject()` by default, PascalCase naming, `.meta()` for
  descriptions (`z.object()` only for external data with a comment)
- Breaking changes are acceptable - delete unused code, don't shim
- Never manually edit `expected.json` fixtures - regenerate via task
