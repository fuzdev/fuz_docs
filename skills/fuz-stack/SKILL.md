---
name: fuz-stack
description: Development conventions and coding patterns for the @fuzdev ecosystem — naming, file organization, testing, styling, documentation, and tooling for TypeScript, Svelte 5, and Rust projects. Use when writing or reviewing code in any @fuzdev project. Triggers include running gro commands (gro check, gro test, gro gen), styling with fuz_css, writing or splitting tests, generating code with .gen.ts files, naming functions or variables (snake_case conventions), organizing files in src/lib/ or src/test/, writing TSDoc comments, creating Svelte 5 components with runes, or formatting code. Also use for the Result type, fixture-based testing, CSS utility classes, TODO_ docs, breaking changes policy, async concurrency patterns, Gro task system, type utilities (Flavored, Branded), dependency injection patterns (*Deps/*Options/*Context interfaces, AppDeps, RuntimeDeps, mock factories), or setting up documentation (tomes, svelte-docinfo, API routes, docs layout). Also covers the ecosystem's Rust workspaces — cargo and clippy lints, thiserror error handling, the dependency-injection escalation ladder, enum-dispatch and make-impossible-states idioms, spine-consumer servers (zzz_server, fuz_forge_server), daemon lifecycle, and CLI and xtask patterns. Triggers include running cargo or clippy, editing Cargo.toml, naming or organizing Rust crates, or working on the fuz and fuzd daemon, the zap convergence engine, or the spine crates.
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

> **Skip for**: planning/lore-only edits, third-party code review, simple
> git/shell operations. Repo `CLAUDE.md` is authoritative for
> project-specific patterns — this skill covers shared conventions across
> TypeScript, Svelte, and Rust crates.

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
as the shared backend spine (auth, sessions, DB, SSE). zzz (the garage)
and zap (machine-state convergence) build on the same primitives. Understanding
one part transfers to understanding the others.

## Package Ecosystem

`@fuzdev/*` packages draw from these conventions. Each package's `CLAUDE.md`
is authoritative for what it actually uses.

| Package        | Description                                                                        |
| -------------- | ---------------------------------------------------------------------------------- |
| `fuz_util`     | foundation utilities (zero deps) — hashing, async, schemas, types                  |
| `gro`          | task runner and toolkit extending SvelteKit (temporary, until `fuz`)               |
| `fuz_css`      | CSS framework and design system — apps look good by default                        |
| `fuz_ui`       | Svelte 5 components — themes, layouts, overlays, auto-docs                         |
| `fuz_app`      | stack spine — auth, sessions, DB, SSE, route specs, CLI/daemon                     |
| `fuz_docs`     | experimental AI-generated docs and skills for Fuz                                  |
| `fuz_template` | a static web app and Node library template                                         |
| `fuz_code`     | syntax styling utilities and components for TypeScript, Svelte, Markdown, and more |
| `fuz_blog`     | blog software from scratch with SvelteKit                                          |
| `fuz_mastodon` | Mastodon components and helpers for Svelte, SvelteKit, and Fuz                     |
| `fuz_gitops`   | a tool for managing many repos                                                     |
| `blake3`       | BLAKE3 hashing compiled to WASM (`@fuzdev/blake3_wasm` + `blake3_wasm_small`)      |
| `zzz`          | software garage — produce software with AI assistance                              |
| `zap`          | convergence — deploy and operate infrastructure                                    |

`gro` is a temporary build tool, will be replaced by `fuz`.

**Dependency flow**: `fuz_util -> gro + fuz_css -> fuz_ui -> fuz_app -> zzz, zap, apps`

**Adding deps**: prefer the approved allowlists (./references/npm-dependencies.md,
./references/rust-dependencies.md). Adding or upgrading needs approval; removing
an unused dep is pre-authorized.

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

- The `svelte-docinfo` analysis detects duplicate export names across modules
  in the flat namespace
- Error shows all conflicts with module paths and kinds
- Resolution: rename one following the domain_action pattern, or add
  `/** @nodocs */` to exclude from validation
- **Which side to rename** — rename the side that is _not_ the primary
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

- **`src/lib/`** — exportable library code: `PascalCase.svelte` components,
  `*.ts` utilities, `*.svelte.ts` runes/reactive code, `*.gen.ts` generated files
- **`src/test/`** — tests (NOT co-located), mirroring `lib/` structure
- **`src/routes/`** — SvelteKit routes (if applicable)
- **No barrels** — import every module by full path (`@fuzdev/fuz_app/env/load.js`);
  package `exports` use wildcards so each module is importable
- **Subdirectories** — group a domain into `lib/domain/` at 3+ related files;
  a lone file stays at `lib/` root. Tests mirror the subdir structure.

See ./references/file-organization.md for the full tree, domain examples, and
import/test-mirroring details.

### Code Style

- **TypeScript**: Strict mode, explicit types
- **Svelte**: Svelte 5 with runes API ($state, $derived, $effect)
- **Formatting**: Prettier with tabs, 100 char width
- **Extensions**: Always include `.js` in imports (even for `.ts` files):
  `import {foo} from './bar.js'` (for a `bar.ts` file)
- **Comments**:
  - JSDoc (`/** ... */`) = proper sentences with periods
  - Inline (`//`) = fragments, no capital or period
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

Common gen pattern: `theme.gen.css.ts` (theme CSS from style variables).
Two outputs that used to be gen tasks no longer are: fuz_css utility classes
come from the `vite_plugin_fuz_css` Vite plugin (the `virtual:fuz.css` module),
and library/API metadata comes from the `svelte-docinfo` Vite plugin — so most
projects run `gro gen` rarely, if ever.

See ./references/code-generation.md for the full API, dependencies, and
examples.

## TSDoc/JSDoc Conventions

See ./references/tsdoc-comments.md for the full tag guide, documentation
patterns, and drift-detection guidance.

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

**Pipeline**: source files → `svelte-docinfo` Vite plugin →
`virtual:svelte-docinfo` → `library_json_from_modules()` → `Library` class → Tome
pages + API routes.

See ./references/documentation-system.md for setup, the full pipeline, Tome
system, layout architecture, and component reference. TSDoc authoring
conventions: ./references/tsdoc-comments.md.

## mdz - Strict Markdown Dialect

`mdz` is the Fuz markdown dialect for documentation (`@fuzdev/mdz/mdz.ts`); fuz_ui
renders TSDoc prose through it, injecting `DocsLink` (inline code) and fuz_code's
`Code` (code blocks) via its rendering seam.

| Feature                | Syntax                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Code                   | "`code`"                                                                            |
| Bold / italic / strike | `**bold**`, `_italic_`, `~~strike~~` (single `~` is literal)                        |
| Links                  | auto-detected URLs, `/internal/path`, `[text](url)`                                 |
| Headings               | `# Heading` (column 0 required, gets lowercase slugified `id` for fragment links)   |
| Lists                  | `- item` / `1. item` (column 0 starts; indent nests, blank lines contained, items hold paragraphs/lists/code blocks) |
| Blockquotes            | `> ` per line (no lazy continuation); `>>` nests; bare `>` separates paragraphs in-quote; blank line ends the quote |
| Code blocks            | fenced with language hints                                                          |
| Components             | `<Alert status="warning">content</Alert>` (registered via `mdz_components_context`) |

```svelte
<Mdz content="Some **bold** and `code` text." />
```

Backticked identifiers auto-link to API docs in TSDoc rendering.

### Path references

Forms by typography:

- **Navigational paths** — bare, no backticks (`./foo`, `../foo`, `~/dev/foo`)
  for files referenced by location; mdz auto-linkifies `./`/`../` after whitespace.
  A bare path is a promise it **resolves on disk** — backtick an illustrative or
  conceptual path (`` `./build/` ``) as the escape hatch
- **src/lib module references** — backticked, src/lib-relative with **no** leading
  `./`, `../`, or redundant `src/lib/` prefix (e.g. "`auth/account_schema.ts`");
  the backticks frame a module identifier, so traversal/prefix contradicts the framing
- **Cross-repo references** — bare `../other-repo/...` for navigation, or the
  `@scope/pkg/foo.js` import specifier for a module's identity; the backticked
  src/lib form is same-repo only, and TSDoc must not point outside its own repo
- **Code-shaped non-paths** — backticks for CLI commands (`gro check`),
  top-level files (`package.json`), and config identifiers (`~/.fuz/`)

See ./references/path-references.md for all forms in full, the web-rendered
caveat, anti-patterns, and Prettier cautions.

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

**Semantic HTML first**: fuz_css styles HTML elements by default — buttons,
inputs, headings, links, lists, code, tables, `<aside>`, `<blockquote>`,
`<details>`, `<small>`, `<kbd>`, etc. all get sensible defaults via
`:where()` selectors. About half of fuz_ui's components have no `<style>`
block at all.

**Layered styling ladder**: Stop at the first rung that suffices —

1. Semantic HTML (right element, no class needed)
2. Built-in class conventions (`.selected`, `.color_a`–`.color_j` on buttons,
   `.inline`, `.unstyled`, `.sm`/`.md`)
3. Composite classes (`box`, `row`, `column`, `panel`, `chip`, `ellipsis`)
4. Token classes (`p_md`, `gap_lg`, `color_a_50`)
5. Literal classes (`display:flex`, `hover:opacity:80%`)
6. `<style>` block with design tokens — last resort

See css-patterns.md §The Default Path and §Component Styling Philosophy.

**Class naming**: fuz_css tokens use `snake_case` (`p_md`, `gap_lg`).
Component-local classes use `kebab-case` (`site-header`, `nav-links`).

### 3-Layer Architecture

- **Semantic styles** (`style.css`) — reset + element defaults (buttons, inputs, forms, tables)
- **Style variables** (`theme.css`) — 600+ design tokens as CSS custom properties
- **Utility classes** (`virtual:fuz.css`) — optional, generated per-project with only used classes

### CSS Classes

- **Token classes** (`.p_md`, `.color_a_50`, `.gap_lg`) — map to style variables
- **Composite classes** (`.box`, `.row`, `.ellipsis`) — multi-property shortcuts
- **Literal classes** (`.display:flex`, `.hover:opacity:80%`) — arbitrary CSS `property:value`

**Comment hints** for static extraction: `// @fuz-classes box row p_md`,
`// @fuz-elements button input`, `// @fuz-variables shade_40 text_50`.

### When to Use Classes vs Styles

- **Own elements** — utility classes preferred; `<style>` for complex cases; inline OK
- **Child components** — utility classes; not `<style>`; inline limited
- **Hover / focus / responsive** — utility classes or `<style>`; never inline
- **Runtime dynamic values** — inline `style:` only (not classes or `<style>`)
- **IDE autocomplete** — best in `<style>`; partial inline; none on utility classes

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
- **`to_error_message`** — `to_error_message(value, fallback?)` from
  `@fuzdev/fuz_util/error.js` normalizes an unknown caught value to a string
  (`value.message` for `Error`, else `fallback ?? String(value)`)
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

## Rust Crates

The ecosystem's Rust workspaces (the `fuz`/`fuzd` CLI + daemon, the spine
crates consumed by `zzz_server`/`fuz_forge_server`, the `zap` convergence
engine, the `blake3`/`tsv` bindings) share a distinct set of conventions from
the TS/Svelte side. snake_case carries over for cross-language alignment, but
Rust solves with the type system + crate graph what TS solves with `*Deps`
injection. Three references, loaded on demand:

- **./references/rust-patterns.md** — workspace layout, strict lints
  (`unsafe_code = "forbid"`, pedantic + nursery + restriction lints), `thiserror`
  error taxonomy + `.hint()`/`.exit_code()` binary helpers, the DI escalation
  ladder (`*Options`/capability-traits/enum-dispatch-before-`dyn`/RPITIT), the
  make-impossible-states-unrepresentable idiom (zap_types is the reference),
  graceful shutdown, daemon lifecycle, CLI/xtask patterns, and the shared
  spine-consumer patterns (`run_app`, env loading, `fuz_audit` check-release).
- **./references/rust-perf.md** — profiling, allocation/lock hygiene, bounds-check
  elision, inlining, the `unsafe` escape hatch, and what's out of scope.
- **./references/rust-dependencies.md** — the approved external-crate allowlist
  and the crate-vs-cargo-feature supply-chain isolation technique.

WASM binding crates additionally follow ./references/wasm-patterns.md. Each
Rust repo's `CLAUDE.md` is authoritative for project-specific conventions; these
cover the shared patterns across workspaces.
