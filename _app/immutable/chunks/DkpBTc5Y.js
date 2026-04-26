const e={content:"# Fuz stack conventions\n\n> **Pre-alpha**: Conventions are actively evolving. When code or a project's\n> CLAUDE.md conflicts with this skill, the code is ground truth.\n>\n> **À la carte**: Each project adopts only what serves it. Deep imports and\n> the flat namespace make this natural at the package level too.\n\n> **Skip for**: Grimoire-only edits, Rust projects (use repo CLAUDE.md),\n> third-party code review, simple git/shell operations.\n\n## Why These Conventions\n\nThe Fuz stack is designed so the full software lifecycle — produce, deploy,\noperate — is accessible to anyone with intent and an AI partner. These\nconventions serve that goal: consistent, self-describing patterns that AI\nagents can learn once and apply everywhere. snake_case aligns TS, Rust, and\nSQL with zero renaming. Zod schemas are the single source of truth for shape,\ntypes, defaults, and validation. The Cell pattern gives every piece of state\nthe same structure. When conventions are this consistent, AI can reliably\nbridge the gap between a person's intent and the stack's implementation.\n\nThe stack composes: `fuz_util → fuz_css → fuz_ui → apps`, with `fuz_app`\nas the shared backend spine (auth, sessions, DB, SSE). zzz (local-first\nforge) and tx (cloud orchestrator) build on the same primitives. Understanding\none part transfers to understanding the others.\n\n## Package Ecosystem\n\n`@fuzdev/*` packages draw from these conventions. Each package's `CLAUDE.md`\nis authoritative for what it actually uses.\n\n| Package        | Description                                                              |\n| -------------- | ------------------------------------------------------------------------ |\n| `fuz_util`     | foundation utilities (zero deps) — hashing, async, schemas, types        |\n| `gro`          | task runner and toolkit extending SvelteKit (temporary, until `fuz`)     |\n| `fuz_css`      | CSS framework and design system — apps look good by default              |\n| `fuz_ui`       | Svelte 5 components — themes, layouts, overlays, auto-docs               |\n| `fuz_app`      | stack spine — auth, sessions, DB, SSE, route specs, CLI/daemon           |\n| `fuz_docs`     | experimental AI-generated docs and skills for Fuz                        |\n| `fuz_template` | a static web app and Node library template                               |\n| `fuz_code`     | syntax styling utilities and components for TypeScript, Svelte, Markdown, and more |\n| `fuz_blog`     | blog software from scratch with SvelteKit                                |\n| `fuz_mastodon` | Mastodon components and helpers for Svelte, SvelteKit, and Fuz           |\n| `fuz_gitops`   | a tool for managing many repos                                           |\n| `blake3`       | BLAKE3 hashing compiled to WASM (`@fuzdev/blake3_wasm` + `blake3_wasm_small`) |\n| `zzz`          | local-first forge — produce software with AI assistance                  |\n| `tx`           | system orchestrator — deploy and operate infrastructure                  |\n\n`gro` is a temporary build tool, will be replaced by `fuz`.\n\n**Dependency flow**: `fuz_util -> gro + fuz_css -> fuz_ui -> fuz_app -> zzz, tx, apps`\n\n## Coding Conventions\n\n### Naming - snake_case + PascalCase\n\n```typescript\n// Functions and variables - snake_case\n// applies equally to function declarations and arrow function exports\nconst format_bytes = (n: number): string => { ... };\nexport const git_current_branch_name = async (): Promise<GitBranch> => { ... };\nexport function create_context<T>(fallback?: () => T) { ... }\nconst user_data: Record<string, unknown> = {};\n\n// Types, classes, components - PascalCase\ntype PackageJson = {};\nclass DocsLinks {}\n// file: src/lib/DocsLink.svelte\n```\n\n**NOT** camelCase for functions/variables. Intentional divergence:\n\n- **Cross-language alignment** — same identifiers in TS, Rust, and SQL with\n  zero renaming cost (`keyed_hash`, `get_user_sessions`, `git_push`).\n- **Legibility** — underscores as explicit word boundaries:\n  `package_json_load` vs `packageJsonLoad`.\n\n**External APIs keep their native casing.** `.map()`, `addEventListener()`,\n`initSync` — only identifiers you define follow snake_case.\n\n```typescript\n// Constants - SCREAMING_SNAKE_CASE\nconst DEFAULT_TIMEOUT = 5000;\nconst GITOPS_CONFIG_PATH_DEFAULT = 'gitops.config.ts';\n```\n\n### Naming Patterns\n\nTwo forms, chosen by **disambiguation** in the flat namespace:\n\n**Domain-prefix** (`domain_action`) — when the bare action name would be\nambiguous:\n\n```typescript\ngit_push(); // git_* cluster (fuz_util/git.ts)\ngit_fetch(); // \"push\"/\"fetch\" alone are ambiguous\ntime_format(); // time_* cluster (fuz_util/time.ts)\ncontextmenu_open(); // contextmenu_* cluster (fuz_ui)\npackage_json_load(); // package_json_* cluster (gro)\n```\n\n**Action-first** (`action_domain`) — when already self-descriptive:\n\n```typescript\ntruncate(); // standalone (fuz_util/string.ts)\nstrip_start(); // action is the concept (fuz_util/string.ts)\nescape_js_string(); // action with domain qualifier (fuz_util/string.ts)\nshould_exclude_path(); // predicate form (fuz_util/path.ts)\nto_file_path(); // conversion (fuz_util/path.ts)\n```\n\n| Pattern               | Example                | Use Case                        |\n| --------------------- | ---------------------- | ------------------------------- |\n| `domain_action`       | `git_push`             | Disambiguates in flat namespace |\n| `domain_is_adjective` | `module_is_typescript` | Boolean in a domain cluster     |\n| `to_target`           | `to_file_path`         | Conversions                     |\n| `format_target`       | `format_number`        | Formatting                      |\n| `action_domain`       | `escape_js_string`     | Self-descriptive utilities      |\n| `create_domain`       | `create_context`       | Factory functions               |\n\n**Rule of thumb**: domain-prefix when the bare name is ambiguous (`git_push`\nnot `push`); action-first when self-descriptive (`truncate`, `strip_start`).\nFile names often signal which: `git.ts` → `git_*`, `string.ts` → action-first.\n\n**Action verbs**: `parse`, `create`, `get`, `to`, `is`, `has`, `format`,\n`render`, `analyze`, `extract`, `load`, `save`, `escape`, `strip`, `ensure`,\n`validate`, `should`\n\n### Flat Namespace - Fail Fast\n\nAll exported identifiers must have **unique names across all modules**:\n\n- `library.gen.ts` uses `library_throw_on_duplicates` (from fuz_ui) to detect\n  conflicts during `gro gen` — every project opts in via\n  `library_gen({on_duplicates: library_throw_on_duplicates})`\n- Error shows all conflicts with module paths and kinds\n- Resolution: rename one following the domain_action pattern, or add\n  `/** @nodocs */` to exclude from validation\n- **Which side to rename** — rename the side that is *not* the primary\n  public API. `@nodocs` is the wrong tool when external consumers depend\n  on the hidden symbol (it vanishes from docs and tomes).\n  - Component is primary (class is a state/helper): suffix the class with\n    `State` / `Info`. Example: `DocsLink` interface → `DocsLinkInfo` when\n    it conflicts with `DocsLink.svelte`. Precedent: `ThemeState`,\n    `AuthState`, `SidebarState`.\n  - Class is primary (stateful with methods/lifecycle, consumers\n    instantiate it): suffix the component with `View` / `Pane`. Example:\n    `MusicPlayer` class kept, component renamed to `MusicPlayerView.svelte`.\n\n### File Organization\n\n```\nsrc/\n├── lib/              # exportable library code\n│   ├── *.svelte      # UI components (PascalCase.svelte)\n│   ├── *.ts          # TypeScript utilities\n│   ├── *.svelte.ts   # Svelte 5 runes and reactive code\n│   ├── *.gen.ts      # generated files (by Gro gen tasks)\n│   └── domain/       # domain subdirectories (see below)\n│       └── *.ts\n├── test/             # tests (NOT co-located with source)\n│   └── *.test.ts     # mirrors lib/ structure\n└── routes/           # SvelteKit routes (if applicable)\n```\n\n#### Domain subdirectories\n\nWhen a domain grows beyond a single file, group related modules in a\nsubdirectory under `lib/`. Each file is a distinct concern — no barrel/index\nfiles.\n\n```\nsrc/lib/\n├── env/              # environment variable handling\n│   ├── load.ts       # schema-based env loading + validation\n│   ├── resolve.ts    # $$VAR$$ reference resolution\n│   ├── dotenv.ts     # .env file parsing\n│   └── mask.ts       # secret value display masking\n├── auth/             # authentication domain (~34 files)\n│   ├── keyring.ts    # crypto: HMAC-SHA256 cookie signing\n│   ├── password.ts   # crypto: password hashing interface\n│   ├── account_schema.ts  # types + Zod schemas\n│   ├── account_queries.ts # database queries\n│   ├── session_middleware.ts  # Hono middleware\n│   └── account_routes.ts     # route spec factories\n├── http/             # generic HTTP framework\n├── db/               # database infrastructure\n├── server/           # backend lifecycle + assembly\n├── runtime/          # composable runtime deps + implementations\n├── cli/              # CLI infrastructure\n├── actions/          # action spec system\n├── realtime/         # SSE and pub/sub\n├── testing/          # test utilities (shared across consumers)\n├── ui/               # frontend components and state\n└── dev/              # dev workflow helpers\n```\n\n**When to create a subdirectory**: 3+ closely related files sharing a domain\nconcept. A single file stays at `lib/` root. Don't create subdirectories\npreemptively.\n\n**Consumers import individual modules by full path** — the subdirectory is\npart of the import path, not hidden behind re-exports:\n\n```typescript\nimport {load_env} from '@fuzdev/fuz_app/env/load.js';\nimport {resolve_env_vars} from '@fuzdev/fuz_app/env/resolve.js';\nimport {create_app_backend} from '@fuzdev/fuz_app/server/app_backend.js';\n```\n\n**Tests mirror the subdirectory structure** in `src/test/`:\n\n```\nsrc/test/\n├── env/\n│   ├── load.test.ts\n│   ├── resolve.test.ts\n│   ├── dotenv.test.ts\n│   └── mask.test.ts\n├── auth/\n│   ├── keyring.test.ts\n│   └── account_queries.db.test.ts  # .db.test.ts suffix for PGlite tests\n└── server/\n    └── env.test.ts     # server-specific env (BaseServerEnv, validate_server_env)\n```\n\n### Code Style\n\n- **TypeScript**: Strict mode, explicit types\n- **Svelte**: Svelte 5 with runes API ($state, $derived, $effect)\n- **Formatting**: Prettier with tabs, 100 char width\n- **Extensions**: Always include `.js` in imports (even for `.ts` files):\n  `import {foo} from './bar.js'` (for a `bar.ts` file)\n- **Comments**:\n  - JSDoc (`/** ... */`) = proper sentences with periods\n  - Inline (`//`) = fragments, no capital or period\n- **No barrel exports**: Import by exact file path, no `index.ts`. Package\n  `exports` use wildcard patterns (`\"./*.js\"`) so every module is importable.\n- **No backwards compatibility**: Delete unused code, rename directly, no\n  deprecated stubs or shims. Document breaking changes in changesets.\n\n## Gro Commands (Temporary Build Tool)\n\n**IMPORTANT**: Gro is installed globally — always run `gro` directly, never\n`npx gro`.\n\n**Development:**\n\n```bash\ngro test         # run vitest tests\ngro gen          # run code generators (*.gen.ts files)\ngro format       # format with Prettier\ngro lint         # run ESLint\ngro typecheck    # run TypeScript type checking\n```\n\n**Production:**\n\n```bash\ngro build        # production build (runs plugin lifecycle)\ngro check        # ALL checks: test + gen --check + format --check + lint + typecheck\ngro publish      # version with Changesets, publish to npm, push to git\ngro deploy       # build and force push to deploy branch\ngro release      # combined publish + deploy workflow\n```\n\n**Utilities:** `gro sync` (gen + update exports), `gro run file.ts` (execute\nTS), `gro changeset` (create changeset). `SKIP_EXAMPLE_TESTS=1 gro test`\nto skip slow tests.\n\n**Key behaviors:** `gro check` is the CI command. `gro gen --check` verifies\nno drift. Tasks are overridable: local `src/lib/foo.task.ts` overrides\n`gro/dist/foo.task.js`; call builtin with `gro gro/foo`.\n\n**Never run `gro dev` or `npm run dev`** — user manages the dev server.\n\n## Code Generation\n\nGen files (`*.gen.ts`) export a `gen` function, discovered by the `.gen.`\npattern in filenames. Naming: `foo.gen.ts` → `foo.ts`, `foo.gen.css.ts` →\n`foo.css`. Return `string`, `{content, filename?, format?}`, `Array`, or\n`null`.\n\nCommon gen patterns: `library.gen.ts` (library metadata for docs),\n`fuz.gen.css.ts` (bundled fuz_css for a project), `theme.gen.css.ts`\n(theme CSS from style variables).\n\nSee ./references/code-generation for the full API, dependencies, and\nexamples.\n\n## TSDoc/JSDoc Conventions\n\nSee ./references/tsdoc-comments for the full tag guide, documentation\npatterns, and auditing.\n\n**Key rules:**\n\n- Main description: complete sentences ending in a period\n- `@param name - description`: hyphen separator; single-sentence: lowercase, no\n  period; multi-sentence: capitalize, end with period\n- `@returns` (not `@return`): same single/multi-sentence rule as `@param`\n- `@module`: complex modules get a module-level doc comment with `@module` at end\n- `@mutates target - description`: document parameter/state mutations\n  (also `` @mutates `target` `` for self-evident mutations)\n- `@nodocs`: exclude from docs and flat namespace validation\n- Wrap identifier references in backticks for auto-linking via `mdz`\n\n**Tag order**: description → `@param` → `@returns` → `@mutates` → `@throws` →\n`@example` → `@deprecated` → `@see` → `@since` → `@default` → `@nodocs`\n\n## Svelte 5 Patterns\n\nSee ./references/svelte-patterns for `$state.raw()`, `$derived.by()`,\nreactive collections (SvelteMap/SvelteSet), schema-driven reactive classes,\nsnippets, effects, attachments, props, event handling, component composition,\nand legacy features to avoid.\n\n### Runes API\n\n`$state.raw()` by default for all reactive state. `$state()` only for\narrays/objects mutated in place (push, splice, index assignment). `$derived`\nfor computed values, `$effect` for side effects.\n\n### Context Pattern\n\nStandardized via `create_context<T>()` from\n`@fuzdev/fuz_ui/context_helpers.js`. Common contexts: `theme_state_context`\n(theme), `library_context` (package API metadata), `tome_context` (current\ndoc page).\n\n## Documentation System\n\nProjects use **tomes** (not \"stories\") with auto-generated API docs.\n\n**Pipeline**: source files → `library_generate()` → `library.json` +\n`library.ts` → `Library` class → Tome pages + API routes.\n\nSee ./references/documentation-system for setup, the full pipeline, Tome\nsystem, layout architecture, and component reference. TSDoc authoring\nconventions: ./references/tsdoc-comments.\n\n## mdz - Minimal Markdown Dialect\n\n`mdz` is fuz_ui's markdown dialect for documentation (`@fuzdev/fuz_ui/mdz.ts`).\n\n| Feature                | Syntax                                                                              |\n| ---------------------- | ----------------------------------------------------------------------------------- |\n| Code                   | `` `code` ``                                                                        |\n| Bold / italic / strike | `**bold**`, `_italic_`, `~strike~`                                                  |\n| Links                  | auto-detected URLs, `/internal/path`, `[text](url)`                                 |\n| Headings               | `# Heading` (column 0 required, gets lowercase slugified `id` for fragment links)    |\n| Code blocks            | fenced with language hints                                                          |\n| Components             | `<Alert status=\"warning\">content</Alert>` (registered via `mdz_components_context`) |\n\n```svelte\n<Mdz content=\"Some **bold** and `code` text.\" />\n```\n\nBackticked identifiers auto-link to API docs in TSDoc rendering.\n\n### Path references in documentation\n\nmdz auto-linkifies bare paths starting with `./`, `../`, or `/` when preceded\nby whitespace. Use this in CLAUDE.md files and other markdown docs to make\nfile and directory references navigable:\n\n- **Navigational paths** — bare, no backticks: `./grimoire/lore/fuz/design/`\n- **CLI commands and code** — backticked: `gro check`, `src/lib/`\n- **Template/placeholder paths** — bare, consistent even though they won't\n  resolve: `./{project}/CLAUDE.md`\n\nEach file assumes the reader is in the file's parent directory. For\n`~/dev/CLAUDE.md`, all project paths are `./project/` since `~/dev/` is the\nworking directory. For `~/dev/grimoire/CLAUDE.md`, sibling grimoire files use\n`./lore/` and repo references use `../fuz_util/`. Deeply nested files use as\nmany `../` segments as needed — `../../../fuz_app` is fine. Consistency\n(always relative) beats aesthetics.\n\nNote: in files rendered by mdz on a website (like this SKILL.md on fuz_docs),\nexample paths must be backticked to prevent mdz from linkifying them. The bare\nsyntax is for CLAUDE.md files and docs where the paths resolve relative to the\nfile's location on disk.\n\n## Testing\n\nTests live in `src/test/` (NOT co-located). Use `assert` from vitest —\nchoose methods for TypeScript type narrowing, not semantic precision.\n`assert(x instanceof Error)` narrows the type;\n`expect(x).toBeInstanceOf(Error)` does not. Name custom assertion helpers\n`assert_*` (not `expect_*`).\n\nUse `describe` blocks to organize tests — one or two levels deep is typical.\nUse `test()` (not `it()`).\n\nSplit large suites with dot-separated aspects: `{module}.{aspect}.test.ts`\n(e.g., `csp.core.test.ts`, `csp.security.test.ts`). Database tests use\n`.db.test.ts` suffix to opt into shared PGlite WASM via vitest `projects`\n(see ./references/testing-patterns).\n\nFor parsers and transformers, use fixture-based testing: input files in\n`src/test/fixtures/<feature>/<case>/`, regenerate `expected.json` via\n`gro src/test/fixtures/<feature>/update`. **Never manually edit\n`expected.json`** — always regenerate via task.\n\nSee ./references/testing-patterns for file organization, test helpers,\nshared test factories, mock factories, fixture workflow, database testing,\nenvironment flags, and test structure.\n\n## TODOs\n\nLeave **copious** `// TODO:` comments in code — they're expected and encouraged\nfor visibility into known future work, not debt to hide.\n\nFor multi-session work, create `TODO_*.md` files in the project root with\nstatus, next steps, and decisions. Delete when complete. **Update before ending\na session.**\n\n## Custom Tasks\n\nSee ./references/task-patterns for the Task interface, Zod-based Args,\nTaskContext, error handling, override patterns, and task composition.\n\n## fuz_css\n\nSee ./references/css-patterns for setup, variables, composites, modifiers,\nextraction, and dynamic theming.\n\n**Minimal component styles**: Components should have minimal or zero custom CSS,\ndelegating to fuz_css utilities and design tokens. Use `box`/`row`/`column`\nfor layout, token classes for spacing/colors, and `<style>` only for\ncomponent-specific logic (positioning, pseudo-states, responsive breakpoints).\nSee css-patterns.md §Component Styling Philosophy for the full guide.\n\n**Class naming**: fuz_css tokens use `snake_case` (`p_md`, `gap_lg`).\nComponent-local classes use `kebab-case` (`site-header`, `nav-links`).\n\n### 3-Layer Architecture\n\n| Layer              | File        | Purpose                                                   |\n| ------------------ | ----------- | --------------------------------------------------------- |\n| 1. Semantic styles | `style.css` | Reset + element defaults (buttons, inputs, forms, tables) |\n| 2. Style variables | `theme.css` | 600+ design tokens as CSS custom properties               |\n| 3. Utility classes | `fuz.css`   | Optional, generated per-project with only used classes    |\n\n### CSS Classes\n\n| Type                  | Example                               | Purpose                      |\n| --------------------- | ------------------------------------- | ---------------------------- |\n| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |\n| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |\n| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |\n\n**Comment hints** for static extraction: `// @fuz-classes box row p_md`,\n`// @fuz-elements button input`, `// @fuz-variables shade_40 text_50`.\n\n### When to Use Classes vs Styles\n\n| Need                   | Utility class | Style tag | Inline style |\n| ---------------------- | ------------- | --------- | ------------ |\n| Style own elements     | **Preferred** | Complex cases | OK        |\n| Style child components | **Yes**       | No        | Limited      |\n| Hover/focus/responsive | **Yes**       | Yes       | No           |\n| Runtime dynamic values | No            | No        | **Yes**      |\n| IDE autocomplete       | No            | **Yes**   | Partial      |\n\n## Dependency Injection\n\n**Small standalone `*Deps` interfaces, composed bottom-up.** Leaf functions\nimport small interfaces directly (not `Pick<Composite>`).\n\n- **Three suffixes** — `*Deps` (capabilities/functions, fresh mock factories per\n  test), `*Options` (data/config values, literal objects), `*Context` (scoped\n  world for a callback/handler). No `*Config` suffix — use `*Options`.\n- **Grouped deps** — composite interface by domain. fuz_css uses `deps.ts` +\n  `deps_defaults.ts`; fuz_gitops uses `operations.ts` + `operations_defaults.ts`.\n- **AppDeps** — stateless capabilities bundle for server code (fuz_app\n  `auth/deps.ts`).\n- **RuntimeDeps** — composable small `*Deps` interfaces for runtime operations\n  (env, fs, commands), with platform-specific factories (Deno, Node, mock).\n- **Design principles** — single `options` object params, `Result` returns\n  (never throw), `null` for not-found, plain object mocks (no mocking libs),\n  stateless capabilities, runtime agnosticism.\n\nSee ./references/dependency-injection for the full pattern guide, naming\nconventions, consumption patterns, RuntimeDeps, and mock factories.\n\n## Common Utilities\n\n`@fuzdev/fuz_util` provides shared utilities:\n\n- **Result type** — `Result<TValue, TError>` discriminated union for error\n  handling without exceptions. Properties go directly on the result object via\n  intersection: `({ok: true} & TValue) | ({ok: false} & TError)`.\n- **Logger** — hierarchical logging via `new Logger('module')`, controlled by\n  `PUBLIC_LOG_LEVEL` env var\n- **Timings** — performance measurement via `timings.start('operation')`\n- **DAG execution** — `run_dag()` for concurrent dependency graphs\n- **Async concurrency** — `each_concurrent`, `map_concurrent`,\n  `map_concurrent_settled`, `AsyncSemaphore`, `Deferred`\n- **Type utilities** — `Flavored`/`Branded` nominal typing, `OmitStrict`,\n  `PickUnion`, selective partials\n\nSee ./references/common-utilities for Result patterns, Logger configuration,\nand Timings usage. See ./references/async-patterns for concurrency\nprimitives. See ./references/type-utilities for the full type API.\n\n## Zod Schemas\n\nZod schemas are source of truth for JSON shape, TypeScript type, defaults,\nmetadata, CLI help text, and serialization. Schema changes cascade through the\nstack; treat them as critical review points.\n\n- **`z.strictObject()`** — default for all object schemas. `z.looseObject()`\n  or `z.object()` for external/third-party data with a comment explaining why.\n- **PascalCase naming** — schema and type share the same name, no suffix:\n  `const Foo = z.strictObject({...}); type Foo = z.infer<typeof Foo>;`\n- **`.meta({description: '...'})`** — not `.describe()`. Both work in Zod 4\n  but `.meta()` is the convention and supports additional keys.\n- **`.brand()` for validated nominal types** — `Uuid`, `Datetime`, `DiskfilePath`\n- **`safeParse` at boundaries** — graceful errors for external input.\n  `parse` for internal assertions.\n\nSee ./references/zod-schemas for branded types, transform pipelines,\ndiscriminated unions, route specs, schemas as runtime data, instance schemas\n(zzz Cell), and introspection.\n\n## Quick Reference\n\n- `gro check` to validate (never run dev server)\n- snake_case for functions, PascalCase for types/components\n- Tests in `src/test/`, not co-located\n- Domain-prefix when ambiguous (`git_push`); action-first when self-descriptive\n  (`truncate`)\n- TSDoc conventions: ./references/tsdoc-comments\n- Copious `// TODO:` comments; `TODO_*.md` for multi-session work\n- Token classes for design system values, literal classes for arbitrary CSS\n- `z.strictObject()` default, PascalCase naming, `.meta()` for descriptions\n- Breaking changes acceptable — delete unused code, don't shim\n- Never manually edit `expected.json` — regenerate via task\n"},n=[{slug:"async-patterns",title:"Async Patterns",content:`# Async Patterns

Async concurrency utilities in \`@fuzdev/fuz_util/async.js\` and
\`@fuzdev/fuz_util/dag.js\`. Controlled concurrency for file I/O, network
requests, task execution, and DAG scheduling.

## AsyncStatus

Lifecycle type for tracking async operations in UI:

\`\`\`typescript
type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';
\`\`\`

## Basic Utilities

### wait

\`\`\`typescript
await wait(500); // wait 500ms
await wait(); // wait 0ms (next macrotask via setTimeout)
\`\`\`

### is_promise

Type guard for Promise/thenable detection:

\`\`\`typescript
if (is_promise(value)) {
	const result = await value;
}
\`\`\`

## Deferred Pattern

Separates promise creation from resolution — external control over when and
how a promise resolves.

\`\`\`typescript
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}
\`\`\`

Create with \`create_deferred()\`:

\`\`\`typescript
const deferred = create_deferred<string>();

// Pass the promise to a consumer
some_async_consumer(deferred.promise);

// Resolve later from the producer
deferred.resolve('done');
\`\`\`

### When to use Deferred

- Coordinating between independent async flows (e.g., DAG node dependencies)
- Bridging callback-based APIs with promise-based code
- Signaling completion from one context to waiters in another

Used internally by \`run_dag()\` and \`throttle\`.

## Concurrent Operations

Three functions for bounded concurrency over iterables. All require
\`concurrency >= 1\` and accept an optional \`AbortSignal\`.

### Choosing the right function

| Function                 | Returns results | Fail behavior           | Use when               |
| ------------------------ | --------------- | ----------------------- | ---------------------- |
| \`each_concurrent\`        | No              | Fail-fast               | Side effects only      |
| \`map_concurrent\`         | Yes (ordered)   | Fail-fast               | Transform + collect    |
| \`map_concurrent_settled\` | Yes (settled)   | Collects all (no throw) | Best-effort collection |

### each_concurrent

Side effects only, no result collection:

\`\`\`typescript
const each_concurrent: <T>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<void> | void,
	signal?: AbortSignal,
) => Promise<void>;
\`\`\`

\`\`\`typescript
await each_concurrent(
	file_paths,
	5, // max 5 concurrent deletions
	async (path) => {
		await unlink(path);
	},
);
\`\`\`

**Fail-fast**: On first rejection, stops spawning new workers and rejects.
With \`signal\`, aborts immediately.

### map_concurrent

Like \`each_concurrent\` but collects results in input order:

\`\`\`typescript
const map_concurrent: <T, R>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<R> | R,
	signal?: AbortSignal,
) => Promise<Array<R>>;
\`\`\`

\`\`\`typescript
const results = await map_concurrent(
	file_paths,
	5, // max 5 concurrent reads
	async (path) => readFile(path, 'utf8'),
);
// results[i] corresponds to file_paths[i]
\`\`\`

**Fail-fast**: On first rejection, stops spawning and rejects. Partial results
are lost.

### map_concurrent_settled

Follows \`Promise.allSettled\` pattern — never rejects the outer promise:

\`\`\`typescript
const map_concurrent_settled: <T, R>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<R> | R,
	signal?: AbortSignal,
) => Promise<Array<PromiseSettledResult<R>>>;
\`\`\`

\`\`\`typescript
const results = await map_concurrent_settled(urls, 5, fetch);
for (const [i, result] of results.entries()) {
	if (result.status === 'fulfilled') {
		console.log(\`\${urls[i]}: \${result.value.status}\`);
	} else {
		console.error(\`\${urls[i]}: \${result.reason}\`);
	}
}
\`\`\`

**Abort behavior**: On abort, resolves with partial results — completed items
keep their real settlements, in-flight items are rejected with abort reason.
Items never pulled from the iterator are absent from the results array.

### How concurrency control works

All three use the same internal pattern:

1. Maintain \`active_count\` and \`next_index\` counters
2. Spawn workers up to \`concurrency\` limit
3. On completion, decrement \`active_count\` and call \`run_next()\`
4. \`run_next()\` spawns more if slots are available

Empty iterables resolve immediately. The \`fn\` callback receives both item
and index, and may return synchronously.

## AsyncSemaphore

Class-based concurrency limiter for more flexible control than concurrent
map/each:

\`\`\`typescript
const semaphore = new AsyncSemaphore(3); // max 3 concurrent

async function do_work(item: string): Promise<void> {
	await semaphore.acquire(); // blocks if 3 already active
	try {
		await process(item);
	} finally {
		semaphore.release(); // free the slot
	}
}
\`\`\`

Constructor requires \`permits >= 0\`.

### Infinity permits

\`new AsyncSemaphore(Infinity)\` — \`acquire()\` always resolves immediately.
Useful for disabling concurrency limits without changing call sites.

### Internal mechanics

- \`acquire()\`: If permits > 0, decrements and resolves. Otherwise queues.
- \`release()\`: If waiters queued, resolves next. Otherwise increments permits.

Used by \`run_dag()\` for controlling node execution concurrency.

## DAG Execution

\`run_dag()\` in \`@fuzdev/fuz_util/dag.js\` executes nodes in a dependency graph
concurrently. Nodes declare dependencies via \`depends_on\`; independent nodes
run in parallel up to \`max_concurrency\`. Uses \`AsyncSemaphore\` for concurrency
and \`Deferred\` for dependency signaling.

\`\`\`typescript
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
\`\`\`

### DagNode interface

\`Sortable\` is from \`@fuzdev/fuz_util/sort.js\` (topological sort validation).

\`\`\`typescript
interface DagNode extends Sortable {
	id: string;
	depends_on?: Array<string>;
}
\`\`\`

### DagOptions

\`\`\`typescript
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
\`\`\`

### DagResult

\`\`\`typescript
interface DagResult {
	success: boolean;
	results: Map<string, DagNodeResult>;
	completed: number;
	failed: number;
	skipped: number;
	duration_ms: number;
	error?: string;
}
\`\`\`

### DagNodeResult

\`\`\`typescript
interface DagNodeResult {
	id: string;
	status: 'completed' | 'failed' | 'skipped';
	error?: string;
	duration_ms: number;
}
\`\`\`

Failed dependency nodes cascade — dependents are skipped with reason
\`'dependency failed'\`.

Used by tx for pipeline execution and resource detection.

## Quick Reference

| Export                   | Module     | Type      | Purpose                                        |
| ------------------------ | ---------- | --------- | ---------------------------------------------- |
| \`AsyncStatus\`            | \`async.js\` | Type      | Lifecycle status for async operations          |
| \`wait\`                   | \`async.js\` | Function  | Promise-based delay                            |
| \`is_promise\`             | \`async.js\` | Function  | Type guard for Promise/thenable                |
| \`Deferred<T>\`            | \`async.js\` | Interface | Promise with external resolve/reject           |
| \`create_deferred\`        | \`async.js\` | Function  | Creates a Deferred                             |
| \`each_concurrent\`        | \`async.js\` | Function  | Concurrent side effects, fail-fast             |
| \`map_concurrent\`         | \`async.js\` | Function  | Concurrent map with ordered results, fail-fast |
| \`map_concurrent_settled\` | \`async.js\` | Function  | Concurrent map, allSettled pattern             |
| \`AsyncSemaphore\`         | \`async.js\` | Class     | Concurrency limiter with acquire/release       |
| \`run_dag\`                | \`dag.js\`   | Function  | Concurrent DAG executor                        |
| \`DagNode\`                | \`dag.js\`   | Interface | Minimum shape for a DAG node                   |
| \`DagOptions\`             | \`dag.js\`   | Interface | Options for \`run_dag\`                          |
| \`DagResult\`              | \`dag.js\`   | Interface | Aggregated DAG execution result                |
| \`DagNodeResult\`          | \`dag.js\`   | Interface | Per-node execution result                      |
`},{slug:"code-generation",title:"Code Generation",content:"# Code Generation\n\nGro's code generation system (`.gen.*` files) in `@fuzdev/gro`.\n\nGen files produce source code at build time. Discovered by the `.gen.`\npattern in filenames, executed by `gro gen`, output committed alongside\nsource. `gro gen --check` verifies no drift.\n\n## File Naming\n\nOutput file is produced by dropping the `.gen.` segment:\n\n| Gen file                             | Output file                |\n| ------------------------------------ | -------------------------- |\n| `library.gen.ts`                     | `library.ts`               |\n| `fuz.gen.css.ts`                     | `fuz.css`                  |\n| `theme.gen.css.ts`                   | `theme.css`                |\n| `css_classes_fixture.gen.json.ts`    | `css_classes_fixture.json` |\n| `README.gen.md.ts`                   | `README.md`                |\n| `auth_attack_surface.gen.json.ts`    | `auth_attack_surface.json` |\n\nThe gen file always has a `.ts` (or `.js`) extension. An optional extension\nbetween `.gen.` and `.ts` overrides the output extension.\n\n### Naming rules\n\n- Exactly one `.gen.` segment per filename (duplicates are invalid)\n- At most one additional extension after `.gen.` (e.g., `.gen.css.ts` is valid,\n  `.gen.foo.bar.ts` is not)\n- Output filename cannot equal the gen filename\n\n## Gen Types\n\nA gen file exports a `gen` value — either a function or a config object:\n\n```typescript\ntype Gen = GenFunction | GenConfig;\n```\n\nBoth importable from `@fuzdev/gro` or `@fuzdev/gro/gen.js`.\n\n### GenFunction (simple form)\n\n```typescript\ntype GenFunction = (ctx: GenContext) => RawGenResult | Promise<RawGenResult>;\n```\n\n```typescript\n// theme.gen.css.ts — simple form\nimport type {Gen} from '@fuzdev/gro';\n\nexport const gen: Gen = ({origin_path}) => {\n  const banner = `/* generated by ${origin_path} */`;\n  return `${banner}\\n:root { --my-var: 1; }\\n`;\n};\n```\n\n### GenConfig (with dependencies)\n\n```typescript\ninterface GenConfig {\n  generate: GenFunction;\n  dependencies?: GenDependencies;\n}\n```\n\n```typescript\n// highlight_priorities.gen.ts — config form with dependencies\nimport type {Gen} from '@fuzdev/gro';\n\nexport const gen: Gen = {\n  generate: ({origin_path}) => {\n    return `// generated by ${origin_path}\\nexport const data = {};\\n`;\n  },\n  dependencies: {files: ['src/lib/theme_highlight.css']},\n};\n```\n\n## GenContext\n\n| Property          | Type                    | Description                                         |\n| ----------------- | ----------------------- | --------------------------------------------------- |\n| `origin_id`       | `PathId`                | absolute path of the gen file                       |\n| `origin_path`     | `string`                | `origin_id` relative to the project root            |\n| `config`          | `GroConfig`             | the project's Gro configuration                     |\n| `svelte_config`   | `ParsedSvelteConfig`    | parsed svelte.config.js                             |\n| `filer`           | `Filer`                 | filesystem tracker (file contents, dependency graph) |\n| `log`             | `Logger`                | scoped logger                                       |\n| `timings`         | `Timings`               | performance measurement                             |\n| `invoke_task`     | `InvokeTask`            | invoke other Gro tasks                              |\n| `changed_file_id` | `PathId \\| undefined`   | set during dependency resolution; `undefined` during generation |\n\nMost commonly used: `origin_path` (generated-by banners), `log`, and `filer`\n(reading source files).\n\n## Return Values\n\n```typescript\ntype RawGenResult = string | RawGenFile | null | Array<RawGenResult>;\n```\n\n### String — single file with default name\n\n```typescript\nexport const gen: Gen = () => {\n  return '// generated content\\n';\n};\n// theme.gen.css.ts → writes theme.css\n```\n\n### RawGenFile — single file with options\n\n```typescript\ninterface RawGenFile {\n  content: string;\n  filename?: string;  // override output name (can be relative or absolute path)\n  format?: boolean;   // run Prettier (default: true)\n}\n```\n\n```typescript\nexport const gen: Gen = () => {\n  return {content: '{\"key\": \"value\"}', filename: 'data.json', format: false};\n};\n```\n\nRelative `filename` resolves from the gen file's directory. Absolute paths\nwrite to that exact location (e.g., `blog.gen.ts` writes `static/blog/feed.xml`).\n\n### null — skip generation\n\n```typescript\nexport const gen: Gen = (ctx) => {\n  if (some_condition) return null; // produce no output\n  return 'content';\n};\n```\n\n### Array — multiple output files\n\nNested arrays are flattened:\n\n```typescript\nexport const gen: Gen = () => {\n  return [\n    {content: 'export const A = 1;', filename: 'a.ts'},\n    {content: 'export const B = 2;', filename: 'b.ts'},\n  ];\n};\n```\n\nDuplicate output file IDs within a single gen file are invalid.\n\nA single gen file can produce many output files — e.g., `skill_docs.gen.ts`\ngenerates a manifest, per-skill data files, and per-page `+page.svelte` routes.\n\n## Dependencies\n\nControl when a gen file re-runs during watch mode. Without `dependencies`,\nre-runs only when the gen file or its imports change (tracked by filer).\nUse `GenConfig` for broader triggers:\n\n```typescript\ntype GenDependencies = 'all' | GenDependenciesConfig | GenDependenciesResolver;\n```\n\n### 'all' — re-run on any change\n\nUsed by `library_gen` since it analyzes all source files:\n\n```typescript\nexport const gen: Gen = {\n  generate: async (ctx) => { /* ... */ },\n  dependencies: 'all',\n};\n```\n\n### Config — patterns and files\n\n```typescript\nexport const gen: Gen = {\n  generate: ({origin_path}) => { /* ... */ },\n  dependencies: {\n    patterns: [/\\.svelte$/, /\\.ts$/],\n    files: ['src/lib/theme_highlight.css'],\n  },\n};\n```\n\n`patterns` are tested against absolute paths. `files` can be relative\n(resolved to absolute) or absolute.\n\n### Function — dynamic resolution\n\nReceives `GenContext` and returns a config, `'all'`, or `null`.\n`changed_file_id` is set on context during dependency resolution:\n\n```typescript\ntype GenDependenciesResolver = (\n  ctx: GenContext,\n) => GenDependenciesConfig | 'all' | null | Promise<GenDependenciesConfig | 'all' | null>;\n```\n\n## CLI Usage\n\n```bash\ngro gen              # run all gen files in src/\ngro gen src/lib/     # run gen files in a specific directory\ngro gen src/lib/foo.gen.ts  # run a specific gen file\ngro gen --check      # verify no drift (used by gro check and CI)\n```\n\n| Arg          | Default         | Description                                       |\n| ------------ | --------------- | ------------------------------------------------- |\n| `_`          | `['src']`       | input paths (files or directories to scan)        |\n| `--root_dirs`| `[process.cwd()]` | root directories to resolve input paths against |\n| `--check`    | `false`         | exit nonzero if any generated files have changed  |\n\n`gro gen --check` compares generated output against existing files. If any\nfile is new or changed, it fails with a message to run `gro gen`. Called by\n`gro check` as part of CI.\n\n## Common Patterns\n\n### CSS generation\n\nEvery project with fuz_css has a `fuz.gen.css.ts` (typically in `src/routes/`):\n\n```typescript\nimport {gen_fuz_css} from '@fuzdev/fuz_css/gen_fuz_css.js';\n\nexport const gen = gen_fuz_css();\n```\n\nReturns a `GenConfig` that scans source files, extracts CSS class usage via\nAST, and generates a bundled `fuz.css` with only the classes, base styles,\nand theme variables actually used. Accepts `GenFuzCssOptions` for customization.\n\n### Theme CSS generation\n\n`fuz_css` uses `theme.gen.css.ts` to generate the full base theme:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro';\n\nimport {default_themes} from './themes.js';\nimport {render_theme_style} from './theme.js';\n\nexport const gen: Gen = ({origin_path}) => {\n  const banner = `/* generated by ${origin_path} */`;\n  const theme = default_themes[0]!;\n  const theme_style = render_theme_style(theme, {\n    comments: true,\n    empty_default_theme: false,\n    specificity: 1,\n  });\n  return `${banner}\\n${theme_style}\\n`;\n};\n```\n\n### Library metadata\n\nEvery project uses `library.gen.ts` (typically in `src/routes/`) for API\ndocumentation metadata. Analyzes TypeScript and Svelte source files and\nproduces `library.ts` and `library.json`:\n\n```typescript\nimport {library_gen} from '@fuzdev/fuz_ui/library_gen.js';\nimport {library_throw_on_duplicates} from '@fuzdev/fuz_ui/library_generate.js';\n\nexport const gen = library_gen({on_duplicates: library_throw_on_duplicates});\n```\n\nReturns a `GenConfig` with `dependencies: 'all'` (re-runs on any source\nchange). `library_throw_on_duplicates` enforces the flat namespace convention\nby throwing on duplicate export names across modules.\n\n### Blog feed generation\n\n`fuz_blog` provides `blog.gen.ts` for Atom feeds, feed data, and slug routes:\n\n```typescript\nexport * from '@fuzdev/fuz_blog/blog.gen.js';\n```\n\nConsumer projects re-export the gen. Returns an array with `feed.xml` (at an\nabsolute path in `static/`), `feed.ts`, and one `+page.svelte` per slug route.\n\n### Fixture generation\n\nTest fixtures can use gen files for snapshot data:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro';\n\nimport {create_tx_app_surface_spec} from './auth_attack_surface_helpers.js';\n\nexport const gen: Gen = () => {\n  return JSON.stringify(create_tx_app_surface_spec().surface);\n};\n// auth_attack_surface.gen.json.ts → auth_attack_surface.json\n```\n\n### Action codegen (zzz)\n\nGen files can generate TypeScript types from runtime registries. zzz reads\naction specs and produces typed collections, metatypes, and handler interfaces:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro/gen.js';\n\nimport * as action_specs from './action_specs.js';\nimport {is_action_spec} from './action_spec.js';\nimport {ActionRegistry} from './action_registry.js';\n\nexport const gen: Gen = ({origin_path}) => {\n  const registry = new ActionRegistry(\n    Object.values(action_specs).filter((s) => is_action_spec(s)),\n  );\n  return `\n    // generated by ${origin_path}\n    export const ActionMethods = [\n      ${registry.methods.map((m) => `'${m}'`).join(',\\n')}\n    ] as const;\n  `;\n};\n```\n\n### Multi-file route generation\n\nA single gen file can generate entire route trees. `skill_docs.gen.ts`\nauto-discovers skills and generates manifests, data files, and `+page.svelte`\nroutes:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro/gen.js';\n\nexport const gen: Gen = ({origin_path}) => {\n  // ... discover skills, read markdown ...\n  return [\n    {content: manifest_content, filename: 'skills_manifest.ts'},\n    {content: skill_data, filename: join(skill_route_dir, 'skill_data.ts')},\n    {content: page_content, filename: join(skill_route_dir, '+page.svelte')},\n    // ... more files\n  ];\n};\n```\n\n## Quick Reference\n\n| Export                 | Type      | Source                | Purpose                                          |\n| ---------------------- | --------- | --------------------- | ------------------------------------------------ |\n| `Gen`                  | Type      | `@fuzdev/gro/gen.js`  | GenFunction or GenConfig                         |\n| `GenFunction`          | Type      | `@fuzdev/gro/gen.js`  | `(ctx: GenContext) => RawGenResult`               |\n| `GenConfig`            | Interface | `@fuzdev/gro/gen.js`  | generate + optional dependencies                 |\n| `GenContext`           | Interface | `@fuzdev/gro/gen.js`  | context passed to gen functions                  |\n| `RawGenResult`         | Type      | `@fuzdev/gro/gen.js`  | string, RawGenFile, null, or nested array        |\n| `RawGenFile`           | Interface | `@fuzdev/gro/gen.js`  | output file with content, filename, format       |\n| `GenDependencies`      | Type      | `@fuzdev/gro/gen.js`  | 'all', config object, or resolver function       |\n| `GenDependenciesConfig`| Interface | `@fuzdev/gro/gen.js`  | patterns? (RegExp[]) and files? (PathId[])       |\n\n`Gen` and `GenContext` are also re-exported from `@fuzdev/gro` (the package\nindex).\n"},{slug:"common-utilities",title:"Common Utilities",content:"# Common Utilities\n\nShared utilities from `@fuzdev/fuz_util`.\n\n## Result Type\n\n`@fuzdev/fuz_util/result.js` — `Result<TValue, TError>` discriminated union\nfor error handling without exceptions. Uses intersection:\n`({ok: true} & TValue) | ({ok: false} & TError)`, so properties go directly\non the result object (not nested under `.value`/`.error` wrappers).\n\n```typescript\nimport type {Result} from '@fuzdev/fuz_util/result.js';\nimport {unwrap} from '@fuzdev/fuz_util/result.js';\n\nfunction parse_config(text: string): Result<{value: Config}, {message: string}> {\n	try {\n		return {ok: true, value: JSON.parse(text)};\n	} catch (e) {\n		return {ok: false, message: e.message};\n	}\n}\n\n// Usage - discriminated union narrows via .ok\nconst result = parse_config(text);\nif (result.ok) {\n	console.log(result.value);\n} else {\n	console.error(result.message);\n}\n\n// Or unwrap (throws ResultError if not ok — requires {value} convention)\nconst config = unwrap(parse_config(text));\n```\n\n### Helper exports\n\n| Export         | Purpose                                                                    |\n| -------------- | -------------------------------------------------------------------------- |\n| `OK`           | Frozen `{ok: true}` constant for results with no extra data               |\n| `NOT_OK`       | Frozen `{ok: false}` constant for results with no extra data              |\n| `unwrap()`     | Returns `result.value` if ok, throws `ResultError` if not                 |\n| `unwrap_error()`| Returns the type-narrowed `{ok: false} & TError` result, throws if ok    |\n| `ResultError`  | Custom `Error` subclass thrown by `unwrap`, carries `.result` and supports `ErrorOptions` |\n\n`unwrap` signature:\n\n```typescript\nconst unwrap: <TValue extends {value?: unknown}, TError extends {message?: string}>(\n	result: Result<TValue, TError>,\n	message?: string,\n) => TValue['value'];\n```\n\n`unwrap_error` returns the entire failed result (not just a value) — the\nopposite of `unwrap` returning just `.value`.\n\n### Conventions\n\n- Spread data directly on the result: `{ok: true, ...data}` — not\n  `{ok: true, value: {data: ...}}`\n- Use `{value}` when `unwrap()` is expected\n- Use `{message}` for errors (used by `ResultError`)\n- Prefer Result over throwing for expected errors (parsing, validation)\n- Use exceptions for unexpected errors (programmer mistakes, system failures)\n\n## Logger\n\nHierarchical logging via `@fuzdev/fuz_util/log.js`:\n\n```typescript\nimport {Logger} from '@fuzdev/fuz_util/log.js';\n\nconst log = new Logger('my_module');\nlog.info('starting');\nlog.debug('details', {data});\n\n// Child loggers inherit level, colors, and console from parent\nconst child_log = log.child('submodule'); // label: 'my_module:submodule'\nchild_log.info('connected'); // [my_module:submodule] connected\n```\n\n### Constructor\n\n```typescript\nnew Logger(label?: string, options?: LoggerOptions)\n```\n\n| Option    | Type        | Default                     | Purpose                        |\n| --------- | ----------- | --------------------------- | ------------------------------ |\n| `level`   | `LogLevel`  | Inherited or env-detected   | Log level for this instance    |\n| `colors`  | `boolean`   | Inherited or env-detected   | Whether to use ANSI colors     |\n| `console` | `LogConsole` | Inherited or global console | Console interface for output   |\n\n### Log Levels\n\nOverride via `PUBLIC_LOG_LEVEL` env var. Default detection order:\n\n1. `PUBLIC_LOG_LEVEL` env var (if set)\n2. `'off'` when running under Vitest\n3. `'debug'` in development (`DEV` from `esm-env`)\n4. `'info'` in production\n\n| Level   | Value | Purpose                           |\n| ------- | ----- | --------------------------------- |\n| `off`   | 0     | No output                         |\n| `error` | 1     | Errors only                       |\n| `warn`  | 2     | Errors and warnings               |\n| `info`  | 3     | Normal operational messages        |\n| `debug` | 4     | Detailed diagnostic information   |\n\n### Logger Methods\n\n| Method        | Level   | Console method | Use case                          |\n| ------------- | ------- | -------------- | --------------------------------- |\n| `log.error()` | `error` | `console.error`| Failures requiring attention      |\n| `log.warn()`  | `warn`  | `console.warn` | Potential issues                  |\n| `log.info()`  | `info`  | `console.log`  | Normal operations                 |\n| `log.debug()` | `debug` | `console.log`  | Diagnostic details                |\n| `log.raw()`   | (none)  | `console.log`  | Unfiltered, no prefix or level check |\n\nEach method (except `raw`) checks `this.level` before outputting. Prefixes\ninclude the label in brackets and a level indicator for error, warn, and debug.\nInfo has no level prefix — just the label.\n\n### Inheritance\n\nNo static state. Level, colors, and console are instance properties.\nChildren inherit from parent — changing a parent's level affects children\nthat haven't set their own override.\n\n```typescript\nconst root = new Logger('app');\nconst child = root.child('db');\n\nroot.level = 'debug';  // child also becomes debug (inherits)\nchild.level = 'warn';  // child overrides, root unaffected\n\nchild.clear_level_override();  // child inherits from root again\nchild.clear_colors_override(); // child inherits colors from root again\nchild.clear_console_override(); // child inherits console from root again\n```\n\nThe `root` getter walks the parent chain to find the root logger, useful for\nsetting global configuration.\n\nColors automatically disabled when `NO_COLOR` or `CLAUDECODE` env vars are set.\n\n### Additional Logger Exports\n\n| Export               | Purpose                                   |\n| -------------------- | ----------------------------------------- |\n| `log_level_to_number`| Converts a `LogLevel` to its numeric value (0-4) |\n| `log_level_parse`    | Validates a log level string, throws on invalid   |\n\n## Timings\n\nPerformance measurement via `@fuzdev/fuz_util/timings.js`. Tracks multiple\nnamed timing operations, used in Gro's `TaskContext` for task performance.\n\n```typescript\nimport {Timings} from '@fuzdev/fuz_util/timings.js';\n\nconst timings = new Timings();\n\n// start() returns a stop function\nconst stop = timings.start('operation');\nawait expensive_work();\nconst elapsed_ms = stop(); // returns elapsed milliseconds (does not log)\n\n// Nested timings\nconst stop_outer = timings.start('outer');\nconst stop_inner = timings.start('inner');\nawait inner_work();\nstop_inner();\nawait more_work();\nstop_outer();\n```\n\n### API\n\n| Method/Property | Signature                                  | Purpose                                 |\n| --------------- | ------------------------------------------ | --------------------------------------- |\n| `constructor`   | `new Timings(decimals?: number)`           | Optional decimal precision for rounding |\n| `start()`       | `(key: TimingsKey, decimals?) => () => number` | Start a timing, returns stop function |\n| `get()`         | `(key: TimingsKey) => number`              | Get recorded duration for a key         |\n| `entries()`     | `() => IterableIterator<[TimingsKey, number \\| undefined]>` | Iterate all timings |\n| `merge()`       | `(timings: Timings) => void`               | Merge other timings, summing shared keys |\n\n`TimingsKey` is `string | number`. Duplicate keys are auto-suffixed\n(`operation`, `operation_2`, `operation_3`, etc.).\n\n### Integration with Logger\n\n`print_timings(timings, log)` from `@fuzdev/fuz_util/print.js` outputs timing\ndata at debug level after task execution. `Timings` itself does not log.\n\n### Stopwatch\n\n`create_stopwatch(decimals?)` — lower-level primitive returning a `Stopwatch`\nfunction that tracks elapsed time from creation. Call with `true` to reset.\nDefault `decimals` is 2.\n\n```typescript\nimport {create_stopwatch, type Stopwatch} from '@fuzdev/fuz_util/timings.js';\n\nconst elapsed: Stopwatch = create_stopwatch();\nawait work();\nconsole.log(elapsed()); // e.g., 142.37 — ms since creation\nconsole.log(elapsed(true)); // ms since creation, then resets start time\nconsole.log(elapsed()); // ms since reset\n```\n\n## DAG Execution\n\n`@fuzdev/fuz_util/dag.js` — `run_dag()` for executing dependency graphs\nconcurrently. Nodes declare dependencies via `depends_on`; independent nodes\nrun in parallel up to `max_concurrency`. Uses `AsyncSemaphore` for concurrency\nand `Deferred` for dependency signaling.\n\n```typescript\nimport {run_dag} from '@fuzdev/fuz_util/dag.js';\n\nconst result = await run_dag({\n	nodes,\n	execute: async (node) => { /* ... */ },\n	max_concurrency: 4,\n	stop_on_failure: true,\n});\n```\n\nUsed by tx for pipeline execution and resource detection.\n\nSee ./async-patterns for the full DAG API (`DagOptions`, `DagResult`,\n`DagNode`) and concurrency primitives. See ./type-utilities for nominal\ntyping and strict utility types.\n\n## DOM Helpers\n\n`@fuzdev/fuz_util/dom.js` — browser DOM utilities.\n\n### `swallow`\n\nClaims an event by preventing its default action and stopping propagation:\n\n```typescript\nimport {swallow} from '@fuzdev/fuz_util/dom.js';\n\nswallow(event);                  // preventDefault + stopImmediatePropagation\nswallow(event, false);           // preventDefault + stopPropagation (non-immediate)\nswallow(event, true, false);     // stopImmediatePropagation only (no preventDefault)\n```\n\nDesign principle: if you `preventDefault`, you're claiming the event — use\n`swallow` to also stop propagation. Parents that need to observe before\nchildren claim should use the `capture` phase. See ./svelte-patterns\n§Event Handling for full guidance.\n\n### `handle_target_value`\n\nWraps an input event callback with value extraction and optional swallowing:\n\n```typescript\nimport {handle_target_value} from '@fuzdev/fuz_util/dom.js';\n\n// Swallows by default (preventDefault + stopImmediatePropagation)\n<input oninput={handle_target_value((value) => { name = value; })} />\n\n// Without swallowing\n<input oninput={handle_target_value((value) => { name = value; }, false)} />\n```\n"},{slug:"css-patterns",title:"CSS Patterns",content:'# CSS Patterns\n\nfuz_css: **semantic styles** (classless element defaults), **style variables**\n(design tokens as CSS custom properties), and optional **utility classes**\ngenerated per-project with only used classes.\n\n## Project Setup\n\n### Import Order\n\nImport CSS in `+layout.svelte` (`src/routes`). First import is universal;\nothers as needed:\n\n```typescript\nimport \'$routes/fuz.css\'; // generated bundled CSS (all projects)\nimport \'@fuzdev/fuz_code/theme.css\'; // package-specific themes (if any)\nimport \'$routes/style.css\'; // project-specific global styles (app projects)\n```\n\n`$routes` resolves to `src/routes` in SvelteKit. Library/tool repos\n(fuz_css, fuz_ui, `gro`, etc.) often import only `fuz.css`. Application repos\n(fuz_template, fuz_blog, zzz, etc.) typically use all three.\n\n### CSS Generation\n\nMost consumer projects have an identical `src/routes/fuz.gen.css.ts`:\n\n```typescript\nimport {gen_fuz_css} from \'@fuzdev/fuz_css/gen_fuz_css.js\';\n\nexport const gen = gen_fuz_css();\n```\n\nNo custom options needed — default bundled mode with tree-shaking handles\neverything. Run `gro gen` to regenerate after adding new classes.\n\nfuz_css itself uses `gen_fuz_css({additional_variables: \'all\'})` to include all\nvariables for its docs site demos.\n\n**Vite plugin alternative**: For non-SvelteKit projects (Svelte, React, Preact,\nSolid):\n\n```typescript\n// vite.config.ts\nimport {vite_plugin_fuz_css} from \'@fuzdev/fuz_css/vite_plugin_fuz_css.js\';\nexport default defineConfig({plugins: [vite_plugin_fuz_css()]});\n\n// main.ts\nimport \'virtual:fuz.css\';\n```\n\nThe Vite plugin supports HMR — source changes automatically trigger CSS\nregeneration.\n\n### Project `style.css`\n\nProject-specific global styles in `src/routes/style.css`:\n\n- Custom element overrides (e.g., heading fonts, textarea styling)\n- Patterns being prototyped before upstreaming to fuz_css\n- App-specific layout (e.g., sidebar widths, primary nav height)\n\nKeep minimal — most apps have near-empty `style.css` files.\n\n## Three-Layer Architecture\n\n| Layer              | File        | Purpose                                                   |\n| ------------------ | ----------- | --------------------------------------------------------- |\n| 1. Semantic styles | `style.css` | Reset + element defaults (buttons, inputs, forms, tables) |\n| 2. Style variables | `theme.css` | 600+ design tokens as CSS custom properties               |\n| 3. Utility classes | `fuz.css`   | Optional, generated per-project with only used classes    |\n\n### Semantic Styles\n\n`style.css` styles HTML elements without classes using low-specificity `:where()`\nselectors. Elements get sensible defaults automatically.\n\nKey behaviors:\n\n- **Flow margins**: Block elements (`p`, `ul`, `ol`, `form`, `fieldset`,\n  `table`, `textarea`, etc.) get `margin-bottom: var(--flow_margin, var(--space_lg))`\n  unless `:last-child`\n- **Row margin reset**: `.row > *` resets margins to 0 (use `gap_*` instead)\n- **Button styling**: Fill, border, shadow, hover/active/disabled/selected\n  states. Hue variants via `color_a`-`color_j` classes\n- **Input styling**: Inputs, textareas, selects share consistent sizing and\n  borders\n\n#### Semantic Elements for Content\n\nUse these elements to get styling for free instead of writing custom CSS:\n\n| Element        | Styling                                                              |\n| -------------- | -------------------------------------------------------------------- |\n| `<small>`      | `font-size: var(--font_size_sm)` — secondary text, metadata, labels  |\n| `<aside>`      | Left border, `--fg_10` background, padding — callouts, info boxes    |\n| `<blockquote>` | Left border (thick), padding — quotations, emphasis blocks           |\n| `<code>`       | Monospace font, subtle background, padding — inline code             |\n| `<summary>`    | Pointer cursor, hover/active backgrounds — expandable sections       |\n| `<kbd>`/`<samp>` | Monospace font — keyboard input, sample output                    |\n| `<abbr>`       | Dotted underline on titled abbreviations                             |\n\n**Prefer semantic HTML over custom CSS for text sizing.** Instead of\n`font-size: var(--font_size_sm)` in a style block, wrap the content in\n`<small>`. Combine with utility classes for color:\n\n```svelte\n<!-- Instead of custom CSS for secondary metadata -->\n<small class="text_50">{metadata}</small>\n<small class="text_70">{subtitle}</small>\n\n<!-- Instead of custom flex + font-size for a row of metadata -->\n<small class="row gap_sm">{items}</small>\n```\n\n### `.unstyled` Class\n\nOpts out of opinionated styling (colors, borders, decorative properties) while\nkeeping normalizations (font inheritance, border-collapse):\n\n```svelte\n<ul class="unstyled column gap_xs">  <!-- reset list, use as flex column -->\n<a class="unstyled">                 <!-- reset link styling -->\n<menu class="unstyled row gap_sm">   <!-- reset menu, use as flex row -->\n```\n\nCommon for navigation menus, custom list components, and links used as buttons.\nApplied to interactive elements and decorative containers.\n\n### `.inline` Class\n\nForces inline-block display on elements that normally render as block-level,\nfor embedding within paragraph text:\n\n```svelte\n<p>Click <button class="inline">here</button> to continue.</p>\n<p>Enter your <input class="inline" /> name.</p>\n```\n\nApplies to `code`, `input`, `textarea`, `select`, and `button`. These elements\nalso get inline-block automatically when nested inside `<p>` tags (no class\nneeded).\n\n## Style Variables (Design Tokens)\n\nDefined in TypeScript, rendered to CSS. Each can have `light` and/or `dark`\nvalues.\n\n### Colors\n\n10 hues with semantic roles:\n\n- `a` (primary/blue), `b` (success/green), `c` (error/red), `d`\n  (secondary/purple), `e` (tertiary/yellow)\n- `f` (muted/brown), `g` (decorative/pink), `h` (caution/orange), `i`\n  (info/cyan), `j` (flourish/teal)\n\n**Intensity scale**: 13 stops from `color_a_00` (lightest) → `color_a_50`\n(base) → `color_a_100` (darkest). Steps: `00`, `05`, `10`, `20`, `30`, `40`,\n`50`, `60`, `70`, `80`, `90`, `95`, `100`.\n\n### Color-Scheme Variants\n\n| Prefix      | Behavior                                          | Use case                      |\n| ----------- | ------------------------------------------------- | ----------------------------- |\n| `fg_*`      | Toward contrast (darkens light, lightens dark)     | Foreground overlays that stack |\n| `bg_*`      | Toward surface (lightens light, darkens dark)      | Background overlays that stack |\n| `darken_*`  | Always darkens (agnostic, alpha-based)             | Shadows, backdrops            |\n| `lighten_*` | Always lightens (agnostic, alpha-based)            | Highlights                    |\n| `text_*`    | Opaque, scheme-aware (low=subtle, high=bold)       | Text (alpha hurts performance) |\n| `shade_*`   | Opaque, tinted neutrals (00→100), scheme-aware     | Backgrounds, surfaces         |\n\n`fg_*`/`bg_*` overlays use alpha and stack when nested (alpha accumulates),\nunlike opaque `shade_*`. Both `shade_*` and `text_*` include `_min`/`_max`\nvariants for untinted extremes (pure black/white).\n\n### Sizes\n\n`xs5` → `xs4` → `xs3` → `xs2` → `xs` → `sm` → `md` → `lg` → `xl` → `xl2` →\n... → `xl15` (23 stops for spacing). Other families use subsets:\n\n- **Font sizes**: 13 stops (`xs`-`xl9`)\n- **Icon sizes**: 7 stops (`xs`-`xl3`, in px not rem)\n- **Border radii**: 7 stops (`xs3`-`xl`)\n- **Distances**: 5 stops (`xs`-`xl`, in px for absolute widths)\n- **Shadows, line heights**: 5 stops (`xs`-`xl`)\n\n### Additional Variable Families\n\n- **`border_color_*`**: Alpha-based tinted borders (00-100 scale)\n- **`shadow_alpha_*`**: Shadow opacity scale (00-100)\n- **`darken_*`/`lighten_*`**: Non-adaptive alpha overlays (00-100)\n- **`border_width_*`**: Numbered 1-9 (in px)\n- **`duration_*`**: Numbered 1-6 (0.08s to 3s)\n- **`hue_*`**: Base hue values for each color (`hue_a` through `hue_j`)\n- **Non-adaptive variants**: `shade_XX_light`/`shade_XX_dark` and\n  `color_X_XX_light`/`color_X_XX_dark` for fixed appearance regardless of\n  color scheme\n\n### Theme Specificity\n\nBundled mode: `:root` and `:root.dark`. Runtime theme switching (via\n`render_theme_style()`): selector repeats for higher specificity (default\n`:root:root` and `:root:root.dark`) to handle unpredictable CSS insertion order.\n\nColors are HSL-based (OKLCH migration planned).\n\n## CSS Classes\n\nThree types of utility classes, generated on-demand:\n\n| Type                  | Example                               | Purpose                      |\n| --------------------- | ------------------------------------- | ---------------------------- |\n| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |\n| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |\n| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |\n\n### Token Classes\n\nMap directly to style variable values:\n\n- **Spacing**: `p_md`, `px_lg`, `mt_xl`, `gap_sm`, `mx_auto`, `m_0`\n- **Text colors**: `text_70`, `text_min`, `color_a_50`, `color_b_50`\n- **Background colors**: `shade_00`, `bg_10`, `fg_20`, `darken_30`,\n  `bg_a_50` (hue + intensity background)\n- **Typography**: `font_size_lg`, `font_family_mono`, `line_height_md`,\n  `icon_size_sm`\n- **Layout**: `width_md`, `width_atmost_lg`, `height_xl`, `top_sm`,\n  `inset_md`\n- **Borders**: `border_radius_xs`, `border_width_2`, `border_color_30`,\n  `border_color_a_50`\n- **Shadows**: `shadow_md`, `shadow_top_md`, `shadow_bottom_lg`,\n  `shadow_inset_xs`, `shadow_inset_top_sm`, `shadow_inset_bottom_xs`,\n  `shadow_alpha_50`, `shadow_color_umbra` (also `_highlight`, `_glow`,\n  `_shroud`)\n- **Hue**: `hue_a` through `hue_j` (sets `--hue` variable)\n\n### Composite Classes\n\n| Class         | What it does                                                     |\n| ------------- | ---------------------------------------------------------------- |\n| `box`         | Flex column, items centered, justify centered                    |\n| `row`         | Flex row, align-items centered (overrides `box` direction)       |\n| `column`      | Flex column (like `box` but uncentered)                          |\n| `panel`       | Embedded container with tinted background and border-radius      |\n| `pane`        | Floating container with opaque background and shadow             |\n| `ellipsis`    | Block with text truncation (nowrap, overflow hidden, ellipsis)   |\n| `clickable`   | Hover/focus/active scale transform effects (includes state styles) |\n| `selectable`  | Button-like fill with hover/active/selected states               |\n| `chip`        | Inline label with padding and `color_X` hue variants             |\n| `menuitem`    | Full-width list item with icon, title, and selected state        |\n| `icon_button` | Square button sized to `--input_height` (flex-shrink: 0)         |\n| `plain`       | Transparent border/fill/shadow when not hovered                  |\n| `pixelated`   | Crisp pixel-art image rendering                                  |\n| `circular`    | `border-radius: 50%`                                             |\n| `chevron`     | Small right-pointing arrow via CSS border trick                  |\n| `sm`          | Tighter sizing by overriding `--font_size`, `--input_height`, etc. |\n| `md`          | Default sizing reset (reverses `sm` in a cascade)                |\n| `mb_flow`     | Flow-aware `margin-bottom` (responds to `--flow_margin`)         |\n| `mt_flow`     | Flow-aware `margin-top` (responds to `--flow_margin`)            |\n\n**Gotcha**: Composites with rulesets (`clickable`, `selectable`, `menuitem`,\n`plain`, `chip`) already include state styles. `hover:clickable` is redundant.\n\n### Literal Classes\n\n`property:value` maps directly to CSS:\n\n```svelte\n<div class="display:flex justify-content:center gap:var(--space_md)">\n```\n\n**Space encoding**: Use `~` for spaces in multi-value properties:\n\n```svelte\n<div class="margin:0~auto padding:var(--space_sm)~var(--space_lg)">\n<div class="width:calc(100%~-~20px)">  <!-- calc requires ~ around +/- -->\n```\n\nIf you need more than 2-3 `~` characters, use a `<style>` block instead.\n\n## Modifiers\n\nState/responsive/color-scheme styling that inline styles can\'t do:\n\n```svelte\n<!-- Responsive -->\n<div class="display:none md:display:flex">\n\n<!-- State -->\n<button class="hover:opacity:80% focus:outline:2px~solid~var(--color_a_50)">\n\n<!-- Color-scheme -->\n<div class="box-shadow:var(--shadow_lg) dark:box-shadow:var(--shadow_sm)">\n\n<!-- Pseudo-element (explicit content required) -->\n<div class=\'before:content:"" before:display:block before:width:2rem\'>\n```\n\n### Available Modifiers\n\n**Responsive breakpoints**: `sm:` (40rem), `md:` (48rem), `lg:` (64rem), `xl:`\n(80rem), `2xl:` (96rem). Max-width variants: `max-sm:`, `max-md:`, etc.\nArbitrary: `min-width(800px):`, `max-width(600px):`\n\n**State modifiers — interaction**: `hover:`, `focus:`, `focus-visible:`,\n`focus-within:`, `active:`, `visited:`, `any-link:`, `link:`, `target:`\n\n**State modifiers — form**: `disabled:`, `enabled:`, `checked:`,\n`indeterminate:`, `valid:`, `invalid:`, `user-valid:`, `user-invalid:`,\n`required:`, `optional:`, `autofill:`, `blank:`, `default:`, `in-range:`,\n`out-of-range:`, `placeholder-shown:`, `read-only:`, `read-write:`\n\n**State modifiers — structural**: `first:`, `last:`, `only:`, `odd:`, `even:`,\n`first-of-type:`, `last-of-type:`, `only-of-type:`, `empty:`. Parameterized:\n`nth-child(2n+1):`, `nth-last-child(2n):`, `nth-of-type(2n):`,\n`nth-last-of-type(2n):`\n\n**State modifiers — UI**: `fullscreen:`, `modal:`, `open:`, `popover-open:`,\n`paused:`, `playing:`\n\n**Media features**: `print:`, `motion-safe:`, `motion-reduce:`,\n`contrast-more:`, `contrast-less:`, `portrait:`, `landscape:`, `forced-colors:`\n\n**Ancestor modifiers**: `dark:`, `light:`\n\n**Pseudo-elements**: `before:`, `after:`, `placeholder:`, `selection:`,\n`marker:`, `first-letter:`, `first-line:`, `cue:`, `file:`, `backdrop:`\n\n### Modifier Order\n\n`[media]:[ancestor]:[state...]:[pseudo-element]:property:value`\n\n```svelte\n<!-- Correct -->\n<div class="md:dark:hover:opacity:80%">\n<div class="md:hover:before:opacity:100%">\n\n<!-- Multiple states must be alphabetical -->\n<button class="focus:hover:outline:2px~solid~blue">  <!-- focus < hover -->\n\n<!-- Wrong - will error -->\n<div class="dark:md:hover:opacity:80%">   <!-- ancestor before media -->\n<div class="hover:focus:opacity:80%">     <!-- h > f, not alphabetical -->\n```\n\n### Modifiers in Practice\n\nResponsive design typically uses `@media` queries in component `<style>`\nblocks. Modifier classes are most commonly used for hover/focus states on\nliteral classes. The full responsive modifier system is available but\nconvention favors `<style>` for complex responsive layouts.\n\n## Class Extraction\n\nClasses extracted via AST parsing at build time:\n\n- `class="..."` attributes\n- `class={[...]}` and `class={{...}}` (Svelte 5.16+)\n- `class:name` directives\n- `clsx()`, `cn()`, `cx()` calls\n- Variables ending in `classes`/`className`\n\n### Dynamic Classes\n\nFor dynamically constructed class strings the extractor can\'t see statically,\nuse `@fuz-classes` comments:\n\n```typescript\n// @fuz-classes opacity:50% opacity:75% opacity:100%\nconst opacity_classes = [50, 75, 100].map((n) => `opacity:${n}%`);\n```\n\nOutside fuz_css\'s own docs site, AST extraction handles all cases and\n`@fuz-classes` is rarely needed.\n\n### Dynamic Elements\n\n`@fuz-elements` declares HTML elements whose base styles should be included\nwhen not statically detectable:\n\n```typescript\n// @fuz-elements button input textarea\n```\n\n### Dynamic Variables\n\n`@fuz-variables` ensures specific theme variables are included even when not\ndetected by the automatic `var(--name)` scan:\n\n```typescript\n// @fuz-variables shade_40 text_50\n```\n\n**Automatic variable detection**: CSS variables also detected via regex scan of\n`var(--name)` patterns. Only known theme variables included; unknown silently\nignored. Catches usage in component props like `size="var(--icon_size_xs)"` that\nAST-based extraction would miss.\n\n### Error Handling\n\n- **Auto-detected classes/elements/variables**: Silently skip if unresolvable\n- **`@fuz-classes`/`@fuz-elements`/`@fuz-variables` entries**: Error if\n  unresolvable (explicitly requested), with typo suggestions via string\n  similarity\n\n## Dynamic Theming\n\n### Runtime Variable Overrides\n\nUse Svelte\'s `style:` directive for runtime CSS variable overrides:\n\n```svelte\n<div style:--docs_menu_width={width}>\n<Alert style:--text_color={color}>\n<HueInput style:--hue={value}>\n```\n\nComponents expose CSS variables as their theming API; consumers override inline.\n\n### Color Scheme\n\nDark/light mode controlled by `dark`/`light` class on the root element.\n`style.css` includes `:root.dark { color-scheme: dark; }` and\n`:root.light { color-scheme: light; }`. Theme state management (persistence,\nsystem preference) handled by fuz_ui\'s `ThemeState` class and `ThemeRoot`\ncomponent.\n\n### Theme Switching\n\nThree built-in themes: `base`, `low contrast`, `high contrast`. Custom themes\nare arrays of `StyleVariable` overrides. Theme CSS rendered via\n`render_theme_style()` with higher specificity (default `:root:root`) to\noverride bundled theme variables regardless of CSS insertion order.\n\n## Component Styling Philosophy\n\nThe fuz stack\'s core styling principle: **components should have minimal custom\nCSS, delegating styling to fuz_css**. Most components need zero or near-zero\nlines in their `<style>` block. The design system exists so components don\'t\nreinvent layout, spacing, color, or typography.\n\n### What "Minimal Styles" Looks Like\n\nWell-designed fuz components (fuz_ui, zzz, fuz_code, fuz_gitops) share these\ntraits:\n\n- **Many components have no `<style>` block at all** — all styling comes from\n  utility classes and semantic HTML\n- **When `<style>` exists, it\'s 5-30 lines** — only component-specific layout\n  logic (positioning, complex pseudo-states, responsive breakpoints)\n- **All colors, spacing, typography come from design tokens** — never hardcoded\n  values\n- **Layout uses composites and utilities** — `box`, `row`, `column`, `panel`,\n  `p_md`, `gap_lg` instead of manual flex declarations\n\n```svelte\n<!-- GOOD: No <style> block needed — utility classes handle everything -->\n<div class="column gap_md p_lg">\n  <header class="row gap_sm">\n    <h2>{title}</h2>\n    <small class="text_50">{subtitle}</small>\n  </header>\n  <div class="panel p_md">{@render children()}</div>\n</div>\n```\n\n### Anti-Patterns\n\nThese patterns indicate a component is doing too much styling work:\n\n#### Writing flex layout in `<style>` instead of using composites\n\n```svelte\n<!-- BAD: manual flex in <style> -->\n<div class="container">...</div>\n<div class="header">...</div>\n<style>\n  .container { display: flex; flex-direction: column; gap: var(--space_md); }\n  .header { display: flex; align-items: center; }\n</style>\n\n<!-- GOOD: utility classes -->\n<div class="column gap_md">...</div>\n<div class="row">...</div>\n```\n\n#### Referencing design tokens in `<style>` when a utility class exists\n\n```svelte\n<!-- BAD: token reference in <style> for something a class does -->\n<span class="subtitle">...</span>\n<style>\n  .subtitle { color: var(--text_70); font-size: var(--font_size_sm); }\n</style>\n\n<!-- GOOD: utility classes (or semantic HTML) -->\n<small class="text_70">...</small>\n```\n\n#### Repeating the same layout patterns across components\n\nIf multiple components each define their own `.sidebar`, `.header`,\n`.content` classes with the same flex/padding/border patterns, those\nshould be utility classes, project `style.css` classes, or composites.\n\n#### Hardcoding pixel values\n\n```svelte\n<!-- BAD: hardcoded pixels -->\n<style>\n  .sidebar { width: 220px; padding-top: 40px; }\n</style>\n\n<!-- GOOD: design tokens or CSS custom properties -->\n<style>\n  .sidebar { width: var(--sidebar_width); padding-top: var(--space_xl2); }\n</style>\n```\n\n### When Custom CSS IS Justified\n\nCustom `<style>` blocks are appropriate for:\n\n- **Complex interactive states** — multi-property hover/active/selected\n  combinations, especially with `color-mix` shadows or parent-child selectors\n  like `.parent:hover .child`. Examples: tab shadow state machines,\n  hover-to-reveal controls.\n- **Structural behavior** — `flex-direction: column-reverse` for bottom-up\n  scrolling, `position: sticky/absolute/fixed` with calculated offsets\n- **Responsive layouts** — `@media` queries for structural layout changes\n- **Animations/transitions** — `@keyframes`, `transition` definitions\n- **Rendering contexts** — canvas, 3D, or other surfaces with inherently\n  custom layout\n\nEven justified custom CSS should use design tokens (`var(--space_md)`,\n`var(--border_color)`) rather than hardcoded values.\n\n### Project `style.css` for Shared App Patterns\n\nWhen a pattern recurs across multiple components in one app but isn\'t\ngeneral enough for fuz_css, put it in the project\'s `style.css` (e.g.,\n`src/routes/style.css`). This is the right place for app-scoped shared\nclasses — button variants, layout columns, drag indicators, scroll\nshadows, etc.\n\nMark patterns with `// TODO upstream` if they might belong in fuz_css.\nThis keeps component `<style>` blocks focused on truly component-specific\nlogic while avoiding premature generalization into the design system.\n\n### Class Naming Conventions\n\nTwo naming systems coexist:\n\n- **fuz_css design tokens**: `snake_case` — `p_md`, `color_a_50`, `gap_lg`,\n  `font_size_sm`. These are the global vocabulary.\n- **Component-local classes**: `kebab-case` — `nav-separator`, `edit-sidebar`,\n  `character-entry`. Distinguishes component-scoped styles from design\n  system classes at a glance.\n\n```svelte\n<!-- snake_case = fuz_css utility, kebab-case = component-local -->\n<div class="column gap_md site-header">\n  <nav class="row gap_sm nav-links">...</nav>\n</div>\n\n<style>\n  .site-header { position: sticky; top: 0; z-index: 10; }\n  .nav-links { border-bottom: var(--border_width_1) var(--border_style) var(--border_color); }\n</style>\n```\n\nThis convention is fully adopted — all 13 repos in the ecosystem have been\nmigrated from `snake_case` to `kebab-case` for component-local classes.\n\n## When to Use Classes vs Styles\n\n| Need                   | Utility class | Style tag | Inline style |\n| ---------------------- | ------------- | --------- | ------------ |\n| Style own elements     | **Preferred** | Complex cases | OK        |\n| Style child components | **Yes**       | No        | Limited      |\n| Hover/focus/responsive | **Yes**       | Yes       | No           |\n| Runtime dynamic values | No            | No        | **Yes**      |\n| IDE autocomplete       | No            | **Yes**   | Partial      |\n\n### Rules of Thumb\n\n- **Literal classes for primary layout** — `display:flex`, `gap_md`,\n  `justify-content:center` appear in nearly every component\n- **`<style>` blocks for complex styling** — media queries, animations,\n  complex selectors, multi-property pseudo-elements\n- **Token classes for design system values** — spacing (`p_md`, `gap_lg`)\n  and colors (`color_a_50`) maintain consistency; avoid hardcoded values\n- **Inline `style:prop` for runtime values** — dynamic widths, computed\n  colors, CSS variable overrides\n- **Utility class strings are fine at length** — 6-12 classes per element is\n  common and works well. Only move to `<style>` when readability suffers\n  (complex responsive logic, multi-property pseudo-elements) not just because\n  the class list is long\n- **`<style>` for responsive layouts** — `@media` queries in component styles\n  are conventional; reserve responsive modifiers for simple one-off overrides\n\n## Quick Reference\n\n### Common Spacing\n\n| Class     | CSS                                                            |\n| --------- | -------------------------------------------------------------- |\n| `p_md`    | `padding: var(--space_md)`                                     |\n| `px_lg`   | `padding-left: var(--space_lg); padding-right: var(--space_lg)` |\n| `mt_xl`   | `margin-top: var(--space_xl)`                                  |\n| `mx_auto` | `margin-left: auto; margin-right: auto`                        |\n| `gap_sm`  | `gap: var(--space_sm)`                                         |\n\n### Common Layout\n\n| Class / literal                 | What it does                    |\n| ------------------------------- | ------------------------------- |\n| `box`                           | Flex column, centered both axes |\n| `row`                           | Flex row, align-items centered  |\n| `column`                        | Flex column (uncentered)        |\n| `display:flex`                  | Flexbox                         |\n| `flex:1`                        | Flex grow                       |\n| `flex-wrap:wrap`                | Allow wrapping                  |\n| `align-items:center`            | Cross-axis center               |\n| `justify-content:space-between` | Even spacing                    |\n| `width:100%`                    | Full width                      |\n\n### Common Typography\n\n| Class                  | What it does                        |\n| ---------------------- | ----------------------------------- |\n| `font_size_lg`         | Large text                          |\n| `font_family_mono`     | Monospace font                      |\n| `ellipsis`             | Truncate with ...                   |\n| `text-align:center`    | Center text                         |\n| `white-space:pre-wrap` | Preserve whitespace, allow wrapping |\n\n### Cascading Variable Pattern\n\nMany token classes set both a CSS property and a cascading custom property,\nenabling children to inherit:\n\n- `font_size_lg` sets `font-size` and `--font_size`\n- `color_a_50` sets `color` and `--text_color`\n- `border_color_30` sets `border-color` and `--border_color`\n- `shadow_color_umbra` sets `--shadow_color`\n\nChildren of `font_size_lg` can reference `var(--font_size)` and get the\ninherited value.\n'},{slug:"dependency-injection",title:"Dependency Injection",content:`# Dependency Injection

Typed interfaces for side effects, real implementations as defaults, accepted
as parameters, tested with plain object mocks. No \`vi.mock\` — dependencies
flow through function signatures.

## Convention

**Small standalone \`*Deps\` interfaces, composed bottom-up.** Replaces
\`Pick<GodType>\` narrowing.

### Bottom-up composition

Define small focused interfaces. Leaf functions import them directly. App-level
composites assemble them for wiring — the entry point builds the composite
and threads it down, but leaf functions never take the composite as a param.

\`\`\`typescript
// Small standalone interfaces in fuz_app/runtime/deps.ts
export interface EnvDeps {
	env_get: (name: string) => string | undefined;
	env_set: (name: string, value: string) => void;
}

export interface FsReadDeps {
	stat: (path: string) => Promise<StatResult | null>;
	read_text_file: (path: string) => Promise<string>;
	read_file: (path: string) => Promise<Uint8Array>;
}

export interface FsWriteDeps {
	mkdir: (path: string, options?: {recursive?: boolean}) => Promise<void>;
	write_text_file: (path: string, content: string) => Promise<void>;
	write_file: (path: string, data: Uint8Array) => Promise<void>;
	rename: (old_path: string, new_path: string) => Promise<void>;
}

export interface CommandDeps {
	run_command: (cmd: string, args: Array<string>) => Promise<CommandResult>;
}

// Functions declare exactly what they need via intersection
export const generate_random_key = async (deps: CommandDeps): Promise<string> => {
	/* ... */
};
export const setup_env_file = async (
	deps: FsReadDeps & FsWriteDeps & CommandDeps,
	env_path: string,
	example_path: string,
): Promise<void> => {
	/* ... */
};

// App-level composite — flat intersection for the wiring layer
export interface RuntimeDeps
	extends EnvDeps, FsReadDeps, FsWriteDeps, FsRemoveDeps,
		CommandDeps, TerminalDeps, ProcessDeps, LogDeps {
	env_all: () => Record<string, string>;
	readonly args: ReadonlyArray<string>;
	cwd: () => string;
	run_command_inherit: (cmd: string, args: Array<string>) => Promise<number>;
}
\`\`\`

### Why standalone interfaces beat Pick<GodType>

\`Pick<AppRuntime, 'env_get'>\` forces every consumer to import the god type.
Small standalone interfaces avoid this:

- **Shareable**: \`EnvDeps\` lives in fuz_app, imported by any project
- **Trivial mocks**: \`{env_get: () => 'value', env_set: () => {}}\` — no factory needed
- **Composable**: \`FsReadDeps & CommandDeps\` for multi-dep functions
- **Self-documenting**: the interface IS the dependency contract

### Where shared interfaces live

- **fuz_app \`auth/deps.ts\`**: \`AppDeps\` (server capabilities), \`RouteFactoryDeps\` (\`Omit<AppDeps, 'db'>\`)
- **fuz_app \`auth/password.ts\`**: \`PasswordHashDeps\` (hash, verify, verify_dummy)
- **fuz_app \`runtime/deps.ts\`**: \`EnvDeps\`, \`FsReadDeps\`, \`FsWriteDeps\`, \`FsRemoveDeps\`,
  \`CommandDeps\`, \`LogDeps\`, \`TerminalDeps\`, \`ProcessDeps\`, \`RuntimeDeps\` (full bundle)
- **fuz_app \`db/query_deps.ts\`**: \`QueryDeps\` (\`{db: Db}\` — base for all \`query_*\` functions)
- **fuz_css \`deps.ts\`**: \`CacheDeps\` (cache file I/O)
- **fuz_gitops \`operations.ts\`**: \`GitopsOperations\`, \`GitOperations\`, \`FsOperations\`, etc.
  (uses \`*Operations\` naming — see below)

### Repo naming: \`*Deps\` vs \`*Operations\`

**\`*Deps\` naming** (fuz_app, fuz_css — preferred):

| What              | Convention                  | Example                              |
| ----------------- | --------------------------- | ------------------------------------ |
| Small interface   | \`{Domain}Deps\`              | \`EnvDeps\`, \`FsReadDeps\`, \`CacheDeps\` |
| Capability bundle | \`{Scope}Deps\`               | \`AppDeps\`, \`RouteFactoryDeps\`        |
| Full composite    | \`RuntimeDeps\`               | extends all small \`*Deps\` interfaces |
| Default impl      | \`default_{domain}_deps\`     | \`default_cache_deps\`                 |
| Mock factory      | \`create_mock_{domain}_deps\` | \`create_mock_cache_deps\`             |
| Stub factory      | \`stub_{scope}_deps\`         | \`stub_app_deps\`                      |

**\`*Operations\` naming** (fuz_gitops — established, not migrating):

| What              | Convention                        | Example                          |
| ----------------- | --------------------------------- | -------------------------------- |
| Sub-interface     | \`{Domain}Operations\`              | \`GitOperations\`, \`NpmOperations\` |
| Composite         | \`GitopsOperations\`                | groups all sub-operations        |
| Default impl      | \`default_{domain}_operations\`     | \`default_git_operations\`         |
| Combined default  | \`default_gitops_operations\`       | all sub-defaults                 |
| Mock factory      | \`create_mock_{domain}_ops\`        | \`create_mock_git_ops\`            |
| Combined mock     | \`create_mock_gitops_ops\`          | all sub-mocks                    |

## Parameter Type Suffixes

Three suffixes for single-object parameters, each with distinct test behavior:

| Suffix | What it contains | Test behavior | Rule |
| ----------- | ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| \`*Deps\` | Capabilities (functions, services) | Fresh mock factories per test case | Things you swap for testing or platform abstraction |
| \`*Options\` | Data (config values, limits, flags) | Literal objects, constructed once, reused | Static values — no mock factory needed |
| \`*Context\` | Scoped world for a callback/handler | Depends on scope (may contain deps + data) | The world available within a bounded scope |

The \`*Deps\` / \`*Options\` boundary is validated by testing patterns: deps get
mock factories with per-test overrides; options are plain objects reused
across test cases.

\`*Context\` is the world available within a bounded scope — may contain both
deps and data:

- \`RouteContext\` — per-request: \`{db, background_db, pending_effects}\`
- \`AppServerContext\` — per-setup-callback: \`{deps, backend, session_options, ...}\`

### \`*Config\` eliminated, \`*Input\` for mutations

No \`*Config\` suffix — \`?\` on fields handles required vs optional. All parameter
bags use \`*Options\`. \`*Input\` is reserved for mutation payloads (create/update
data).

## Grouped Operations Pattern (fuz_gitops)

Composite interface grouping I/O by domain, injected as an optional parameter
with a production default.

### Interface definition

\`\`\`typescript
// operations.ts
export interface GitopsOperations {
	changeset: ChangesetOperations;
	git: GitOperations;
	process: ProcessOperations;
	npm: NpmOperations;
	preflight: PreflightOperations;
	fs: FsOperations;
	build: BuildOperations;
}
\`\`\`

Each sub-interface groups related operations:

\`\`\`typescript
export interface GitOperations {
	current_branch_name: (options?: {
		cwd?: string;
	}) => Promise<Result<{value: string}, {message: string}>>;
	checkout: (options: {branch: string; cwd?: string}) => Promise<Result<object, {message: string}>>;
	add_and_commit: (options: {
		files: string | Array<string>;
		message: string;
		cwd?: string;
	}) => Promise<Result<object, {message: string}>>;
	// ... ~15 more methods
}

export interface FsOperations {
	readFile: (options: {
		path: string;
		encoding: BufferEncoding;
	}) => Promise<Result<{value: string}, FsError>>;
	writeFile: (options: {path: string; content: string}) => Promise<Result<object, FsError>>;
	mkdir: (options: {path: string; recursive?: boolean}) => Promise<Result<object, FsError>>;
	exists: (options: {path: string}) => Promise<boolean>;
}
\`\`\`

\`FsError\` is the shared discriminated error type — see the L1 filesystem
contract under Design Principles.

### Default implementations

\`\`\`typescript
// operations_defaults.ts
export const default_git_operations: GitOperations = {
	current_branch_name: async (options) => {
		return wrap_with_value(() => git_current_branch_name_required(options?.cwd));
	},
	checkout: async ({branch, cwd}) => {
		return wrap_void(() => git_checkout(branch, cwd ? {cwd} : undefined));
	},
	// ...
};

export const default_gitops_operations: GitopsOperations = {
	changeset: default_changeset_operations,
	git: default_git_operations,
	process: default_process_operations,
	npm: default_npm_operations,
	preflight: default_preflight_operations,
	fs: default_fs_operations,
	build: default_build_operations,
};
\`\`\`

## CacheDeps Pattern (fuz_css)

Focused deps interface for cache file I/O. Files: \`deps.ts\` +
\`deps_defaults.ts\`.

\`\`\`typescript
// deps.ts
import type {FsError} from '@fuzdev/fuz_util/fs.js';

export interface CacheDeps {
	read_text: (options: {path: string}) => Promise<Result<{value: string}, FsError>>;
	write_text_atomic: (options: {path: string; content: string}) => Promise<Result<object, FsError>>;
	unlink: (options: {path: string}) => Promise<Result<object, FsError>>;
}

// deps_defaults.ts — every fs throw routes through fs_classify_error
import {fs_classify_error} from '@fuzdev/fuz_util/fs.js';

export const default_cache_deps: CacheDeps = {
	read_text: async ({path}) => {
		try { return {ok: true, value: await readFile(path, 'utf8')}; }
		catch (error) { return {ok: false, ...fs_classify_error(error)}; }
	},
	write_text_atomic: async ({path, content}) => {
		try {
			await mkdir(dirname(path), {recursive: true});
			const temp_path = path + '.tmp.' + process.pid + '.' + Date.now();
			await writeFile(temp_path, content);
			await rename(temp_path, path);
			return {ok: true};
		} catch (error) { return {ok: false, ...fs_classify_error(error)}; }
	},
	unlink: async ({path}) => {
		try { await unlink(path); return {ok: true}; }
		catch (error) { return {ok: false, ...fs_classify_error(error)}; }
	},
};
\`\`\`

Internal functions take \`deps: CacheDeps\` as a required first parameter.
Public APIs default to \`default_cache_deps\`:

\`\`\`typescript
// gen_fuz_css.ts (public API)
const { deps = default_cache_deps } = options;
\`\`\`

## AppDeps Pattern (fuz_app)

Stateless capabilities bundle for server code. Three-part vocabulary:

| Category          | Type        | Examples                                        | Rule                             |
| ----------------- | ----------- | ----------------------------------------------- | -------------------------------- |
| **Capabilities**  | \`AppDeps\`   | \`keyring\`, \`password\`, \`db\`, \`log\`, \`on_audit_event\` | Stateless, injectable, swappable |
| **Route caps**    | \`RouteFactoryDeps\` | \`Omit<AppDeps, 'db'>\` — for route factories     | Handlers get \`db\` via \`RouteContext\` |
| **Parameters**    | \`*Options\`  | \`session_options\`, \`rate_limiter\`, \`token_path\`  | Static values set at startup    |
| **Runtime state** | inline ref  | \`bootstrap_status: {available, token_path}\`      | Mutable — NOT in deps or options |

### Interface definition

\`\`\`typescript
// auth/deps.ts
export interface AppDeps {
	stat: (path: string) => Promise<StatResult | null>;
	read_text_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
	keyring: Keyring;
	password: PasswordHashDeps;
	db: Db;
	log: Logger;
	on_audit_event: (event: AuditLogEvent) => void;
}

// Route factories use RouteFactoryDeps — AppDeps without db
export type RouteFactoryDeps = Omit<AppDeps, 'db'>;
\`\`\`

### QueryDeps for database functions

All \`query_*\` functions take \`deps: QueryDeps\` as their first argument:

\`\`\`typescript
// db/query_deps.ts
export interface QueryDeps {
	db: Db;
}

// Usage — structural typing means RouteContext satisfies QueryDeps
export const query_account_by_id = async (deps: QueryDeps, id: string) => { /* ... */ };
\`\`\`

Route handlers pass \`route\` (the \`RouteContext\`) directly to query functions
because \`RouteContext\` structurally satisfies \`QueryDeps\`.

### Route factory signatures

Factories take narrowed deps reflecting what they actually use:

\`\`\`typescript
// Uses keyring, password, log — gets RouteFactoryDeps (AppDeps minus db)
export const create_account_route_specs = (
	deps: RouteFactoryDeps,
	options: AccountRouteOptions,
): Array<RouteSpec> => {
	const {keyring, password} = deps;
	const {session_options, ip_rate_limiter} = options;
	// handlers receive (c, route) where route.db is transaction-scoped
	// ...
};

// Uses only log — inline deps type
export const create_admin_account_route_specs = (
	deps: {log: Logger},
	options?: AdminRouteOptions,
): Array<RouteSpec> => { /* ... */ };

// Uses nothing — no deps param
export const create_audit_log_route_specs = (
	options?: AuditLogRouteOptions,
): Array<RouteSpec> => { /* ... */ };
\`\`\`

### Ad-hoc per-function deps

Functions with a unique combination of capabilities define their own
\`*Deps\` interface co-located with the consuming function:

\`\`\`typescript
// auth/bootstrap_account.ts
export interface BootstrapAccountDeps {
	db: Db;
	token_path: string;
	read_text_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
	password: Pick<PasswordHashDeps, 'hash_password'>;
	log: Logger;
}

// auth/bootstrap_routes.ts
export interface CheckBootstrapStatusDeps {
	stat: (path: string) => Promise<StatResult | null>;
	db: Db;
	log: Logger;
}

// auth/api_token_queries.ts — extends QueryDeps with additional capabilities
export interface ApiTokenQueryDeps extends QueryDeps {
	log: Logger;
}
\`\`\`

Use ad-hoc deps when:
- The combination is unique to one function
- Sharing the interface would add coupling without reuse
- The function mixes data (\`token_path\`) with capabilities (\`read_text_file\`)

### Narrowing with \`Pick<>\`

\`Pick<>\` on small \`*Deps\` interfaces is fine — minimal coupling.
The anti-pattern is \`Pick<GodType>\`, coupling every consumer to a large
composite.

\`\`\`typescript
password: Pick<PasswordHashDeps, 'hash_password'>;
\`\`\`

### Two-step init

Create backend (DB + deps), then assemble the HTTP server:

\`\`\`typescript
// server/app_backend.ts
export const create_app_backend = async (
	options: CreateAppBackendOptions,
): Promise<AppBackend> => {
	// creates db, runs auth migrations, bundles into AppDeps
};

// AppBackend wraps deps with metadata
export interface AppBackend {
	deps: AppDeps;
	db_type: DbType;
	db_name: string;
	readonly migration_results: ReadonlyArray<MigrationResult>;
	close: () => Promise<void>;
}
\`\`\`

## RuntimeDeps Pattern (fuz_app)

The 8 small \`*Deps\` interfaces and \`RuntimeDeps\` composite shown in
"Bottom-up composition" above live in \`runtime/deps.ts\`. Platform factories:

- \`create_deno_runtime(args)\` — Deno implementation
- \`create_node_runtime(args)\` — Node.js implementation
- \`create_mock_runtime(args)\` — test implementation with observable state

## Design Principles

### Single options object (in operations interfaces)

\`\`\`typescript
// Good
checkout: (options: {branch: string; cwd?: string}) => Promise<Result<...>>;

// Not this
checkout: (branch: string, cwd?: string) => Promise<Result<...>>;
\`\`\`

General utility functions may use positional parameters for simple signatures.

### Result returns, never throw

\`\`\`typescript
export interface GitOperations {
	push: (options: {cwd?: string}) => Promise<Result<object, {message: string}>>;
}
\`\`\`

### L1 filesystem contract: uniform Result with typed \`FsError\`

L1 domain filesystem wrappers (\`CacheDeps\`, \`FsOperations\`, mageguild's
\`FsOperations\`) use a uniform shape from \`@fuzdev/fuz_util/fs.js\`: reads,
writes, and queries all return \`Result<{value: T}, FsError>\` — no mix of
\`string | null\` reads with \`Result\` writes. Implementations route thrown
errors through \`fs_classify_error(error)\`, which maps Node \`code\`
(ENOENT/EACCES/EPERM/EEXIST) to a discriminated \`kind\`:

\`\`\`typescript
type FsError =
	| {kind: 'not_found'; message: string}
	| {kind: 'permission_denied'; message: string}
	| {kind: 'already_exists'; message: string}
	| {kind: 'io_error'; message: string};

// FsJsonError adds {kind: 'invalid_json'} — for read_json-style deps where
// missing vs corrupt must be distinguishable (e.g. self-healing config loads).
\`\`\`

Callers branch on \`kind\` instead of regex-matching \`message\`:

\`\`\`typescript
// Missing is expected
if (!r.ok) return null;

// Missing returns a default
if (!r.ok) {
	if (r.kind === 'not_found') return [];
	throw new Error(\`readdir failed: \${r.message}\`);
}

// Missing is impossible
if (!r.ok) throw new Error(\`read failed: \${r.message}\`);

// rm -f semantics (tolerate missing)
if (!r.ok && r.kind !== 'not_found') throw new Error(r.message);
\`\`\`

Uniform shape keeps the contract symmetric for a future Rust port where
\`Result<T, E>\` is native; typed kinds replace the \`{message}\` structural
shape that earlier code had to regex-match. Scope: L1 domain wrappers only.
The L0 platform runtime (\`FsReadDeps\` in \`fuz_app/runtime/deps.ts\`) keeps
throws-on-error to mirror \`Deno.readTextFile\` / \`node:fs\`. See the
ops-layering quest in the grimoire for the migration history.

### No \`vi.mock\` — plain objects instead

Plain objects implementing interfaces. No \`vi.mock()\`, no Sinon. Individual
\`vi.fn()\` for call tracking is acceptable, but DI interfaces are satisfied
by plain objects:

\`\`\`typescript
const mock_git: GitOperations = {
	checkout: async () => ({ok: true}),
	current_branch_name: async () => ({ok: true, value: 'main'}),
	// ... all methods implemented as plain async functions
};
\`\`\`

### Declare minimum dependencies

\`\`\`typescript
// Good — small standalone interface:
import type {EnvDeps} from '@fuzdev/fuz_app/runtime/deps.js';

// Good — intersection of exactly what's needed:
deps: FsReadDeps & FsWriteDeps & CommandDeps

// Good — Pick<> on a small deps interface:
password: Pick<PasswordHashDeps, 'hash_password'>;

// Bad — Pick<> on a god type:
// runtime: Pick<RuntimeDeps, 'env_get'>
\`\`\`

### Stateless capabilities

Deps are stateless functions and instances — never mutable state. Mutable refs
(like \`bootstrap_status: {available: boolean}\`) are passed separately.

### Runtime agnosticism

Never import env at module level in server code that might run outside
SvelteKit — breaks Deno compilation. Load env via deps parameters.

## File Naming Convention

**fuz_css** (\`*Deps\` naming):
\`\`\`
src/lib/
├── deps.ts            # CacheDeps interface
├── deps_defaults.ts   # default_cache_deps implementation
src/test/
├── fixtures/mock_deps.ts  # create_mock_cache_deps, create_mock_fs_state
\`\`\`

**fuz_gitops** (\`*Operations\` naming):
\`\`\`
src/lib/
├── operations.ts           # GitopsOperations + all sub-interfaces
├── operations_defaults.ts  # default_gitops_operations + all sub-defaults
src/test/
├── test_helpers.ts              # create_mock_gitops_ops + sub-mock factories
├── fixtures/mock_operations.ts  # fixture-oriented mock factories
\`\`\`

**fuz_app** (\`*Deps\` across multiple directories):
\`\`\`
src/lib/
├── auth/deps.ts       # AppDeps, RouteFactoryDeps
├── auth/password.ts   # PasswordHashDeps
├── runtime/deps.ts    # EnvDeps, FsReadDeps, ..., RuntimeDeps
├── runtime/mock.ts    # create_mock_runtime (MockRuntime)
├── db/query_deps.ts   # QueryDeps
├── testing/stubs.ts   # stub_app_deps, create_stub_app_deps
\`\`\`

## Consumption Patterns

### Optional with default (fuz_gitops)

\`\`\`typescript
export const publish_repos = async (
	repos: Array<LocalRepo>,
	options: PublishingOptions,
): Promise<PublishingResult> => {
	const {ops = default_gitops_operations} = options;
	await ops.preflight.run_preflight_checks({repos, ...});
};
\`\`\`

### Subset injection (fuz_gitops)

\`\`\`typescript
export const update_package_json = async (
	repo: LocalRepo,
	updates: Map<string, string>,
	options: UpdatePackageJsonOptions = {},
): Promise<void> => {
	const {git_ops = default_git_operations, fs_ops = default_fs_operations} = options;
	// only uses git and fs, not the full composite
};
\`\`\`

### Required first param (fuz_app route factories)

\`\`\`typescript
export const create_account_route_specs = (
	deps: RouteFactoryDeps,
	options: AccountRouteOptions,
): Array<RouteSpec> => {
	/* ... */
};
\`\`\`

### Narrow intersection (fuz_app utility functions)

\`\`\`typescript
// dev/setup.ts — accepts exactly the capabilities needed
export const setup_bootstrap_token = async (
	deps: FsReadDeps & FsWriteDeps & CommandDeps & EnvDeps,
	app_name: string,
	options?: SetupBootstrapTokenOptions,
): Promise<void> => { /* ... */ };
\`\`\`

## Mock and Stub Patterns

See ./testing-patterns for in-memory filesystem patterns and general mock
structure.

### Plain object mocks (fuz_gitops)

\`\`\`typescript
// test_helpers.ts
export const create_mock_git_ops = (
	overrides: Partial<GitOperations> = {},
): GitOperations => ({
	current_branch_name: async () => ({ok: true, value: 'main'}),
	checkout: async () => ({ok: true}),
	add_and_commit: async () => ({ok: true}),
	has_changes: async () => ({ok: true, value: false}),
	// ... all methods with sensible defaults
	...overrides,
});
\`\`\`

### Composite mock factory (fuz_gitops)

\`\`\`typescript
export const create_mock_gitops_ops = (
	overrides: Partial<{
		changeset: Partial<GitopsOperations['changeset']>;
		git: Partial<GitopsOperations['git']>;
		// ...
	}> = {},
): GitopsOperations => ({
	changeset: { /* defaults */ ...overrides.changeset },
	git: create_mock_git_ops(overrides.git),
	npm: create_mock_npm_ops(overrides.npm),
	// ...
});
\`\`\`

### In-memory filesystem mock (fuz_gitops)

\`\`\`typescript
export const create_mock_fs_ops = (): FsOperations & {
	get: (path: string) => string | undefined;
	set: (path: string, content: string) => void;
} => {
	const files: Map<string, string> = new Map();
	return {
		readFile: async (options) => {
			const content = files.get(options.path);
			if (content === undefined) return {ok: false, message: \`File not found\`};
			return {ok: true, value: content};
		},
		writeFile: async (options) => { files.set(options.path, options.content); return {ok: true}; },
		// ... plus get/set helpers for test setup
	};
};
\`\`\`

### In-memory filesystem mock (fuz_css)

\`\`\`typescript
// test/fixtures/mock_deps.ts
export const create_mock_fs_state = (): MockFsState => ({
	files: new Map(),
});

export const create_mock_cache_deps = (state: MockFsState): CacheDeps => ({
	read_text: async ({path}) => state.files.get(path) ?? null,
	write_text_atomic: async ({path, content}) => { state.files.set(path, content); return {ok: true}; },
	unlink: async ({path}) => { state.files.delete(path); return {ok: true}; },
});
\`\`\`

### Tracking mocks (fuz_gitops)

Record calls for test assertions:

\`\`\`typescript
export const create_tracking_process_ops = (): {
	ops: ProcessOperations;
	get_spawned_commands: () => Array<TrackedCommand>;
	get_commands_by_type: (cmd_name: string) => Array<TrackedCommand>;
} => {
	const spawned_commands: Array<TrackedCommand> = [];
	return {
		ops: {
			spawn: async (options) => {
				spawned_commands.push({cmd: options.cmd, args: options.args, cwd: /*...*/});
				return {ok: true};
			},
		},
		get_spawned_commands: () => spawned_commands,
		get_commands_by_type: (cmd_name) =>
			spawned_commands.filter((c) => c.cmd === 'gro' && c.args[0] === cmd_name),
	};
};
\`\`\`

### Stub and throwing proxy (fuz_app)

Two safety levels for surface testing (simplified — actual code handles
additional JS internals):

\`\`\`typescript
// Throwing stub — catches unexpected access with descriptive errors
export const create_throwing_stub = <T>(label: string): T =>
	new Proxy({} as any, {
		get: (_target, prop) => {
			throw new Error(\`Throwing stub '\${label}' — unexpected access to '\${prop}'\`);
		},
	}) as T;

// stub_app_deps — all fields are throwing stubs
export const stub_app_deps: AppDeps = {
	stat: create_throwing_stub('stat'),
	read_text_file: create_throwing_stub('read_text_file'),
	delete_file: create_throwing_stub('delete_file'),
	keyring: create_throwing_stub('keyring'),
	password: create_throwing_stub('password'),
	db: create_throwing_stub('db'),
	log: create_throwing_stub('log'),
	on_audit_event: () => {},
};

// create_stub_app_deps — no-op stubs that silently pass
export const create_stub_app_deps = (): AppDeps => ({
	stat: async () => null,
	read_text_file: async () => '',
	delete_file: async () => {},
	keyring: create_noop_stub('keyring'),
	password: create_noop_stub('password'),
	db: stub_db,
	log: new Logger('test', {level: 'off'}),
	on_audit_event: () => {},
});
\`\`\`

### MockRuntime (fuz_app)

Full mock of \`RuntimeDeps\` with observable state for CLI testing:

\`\`\`typescript
const runtime = create_mock_runtime(['apply', 'tx.ts']);
runtime.mock_env.set('HOME', '/home/test');
runtime.mock_fs.set('/home/test/.app/config.json', '{}');

await some_function(runtime);

assert.strictEqual(runtime.command_calls.length, 1);
assert.deepStrictEqual(runtime.exit_calls, [0]);
\`\`\`

## Quick Reference

| Flavor              | Repo        | Interface file        | Injection style                         |
| ------------------- | ----------- | --------------------- | --------------------------------------- |
| **Grouped ops**     | fuz_gitops  | \`operations.ts\`       | Optional param with default (\`ops\`)     |
| **CacheDeps**       | fuz_css     | \`deps.ts\`             | Optional param with default (\`deps\`)    |
| **AppDeps**         | fuz_app     | \`auth/deps.ts\`        | Required first param (\`deps, options\`)  |
| **RuntimeDeps**     | fuz_app     | \`runtime/deps.ts\`     | Required first param (narrow interface) |
| **QueryDeps**       | fuz_app     | \`db/query_deps.ts\`    | Required first param (\`deps\`)           |

| Principle  | Rule                                                                 |
| ---------- | -------------------------------------------------------------------- |
| Parameters | Single \`options\` object in operations interfaces                     |
| Errors     | Return \`Result\`, never throw                                         |
| L1 fs      | Uniform \`Result<{value: T}, FsError>\` — reads, writes, queries alike |
| L0 fs      | Platform mirror — throws on error (\`FsReadDeps\` in fuz_app)          |
| Testing    | Plain objects — no \`vi.mock()\` for module replacement                |
| State      | Deps are stateless — mutable refs passed separately                  |
| Narrowing  | Accept the smallest \`*Deps\` interface that covers usage              |
`},{slug:"documentation-system",title:"Documentation System",content:"# Documentation System\n\nPipeline, Tome system, layout architecture, and project setup for `@fuzdev`\ndocs. For TSDoc/JSDoc authoring conventions, see ./tsdoc-comments.\n\n## Pipeline Overview\n\n```\nsource files → library_generate() → library.json + library.ts → Library class → Tome pages + API routes\n```\n\n| Stage             | What                          | Key details                                                                                            |\n| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |\n| **Analysis**      | fuz_ui analysis modules       | `ts_helpers.ts`, `svelte_helpers.ts`, `tsdoc_helpers.ts` extract metadata via TypeScript compiler API. `library_analysis.ts` dispatches to the appropriate analyzer based on file type |\n| **Generation**    | `library_gen()` in fuz_ui     | Wraps `library_generate()` with Gro `Gen` format. `library_pipeline.ts` handles collection, validation, dedup, re-export merging. Run via `gro gen` |\n| **Serialization** | `library.json` + `library.ts` | `library_output.ts` produces JSON and a typed TS wrapper. `LibraryJson` (from `@fuzdev/fuz_util/library_json.js`) combines `PackageJson` + `SourceJson` with computed properties |\n| **Runtime**       | `Library` class               | Wraps `LibraryJson` into `Module` and `Declaration` instances with `$derived` properties, search, and lookup maps |\n| **Rendering**     | Tome pages + API routes       | Manual tomes + auto-generated API docs. `mdz` auto-links backticked identifiers in TSDoc via `tsdoc_mdz.ts` |\n\n### Analysis Modules\n\n| Module                | Purpose                                                                |\n| --------------------- | ---------------------------------------------------------------------- |\n| `library_gen.ts`      | Gro-specific entry point — adapts Gro's `Disknode` to `SourceFileInfo` |\n| `library_generate.ts` | Build-tool agnostic entry point — orchestrates the full pipeline       |\n| `library_analysis.ts` | Unified dispatcher — routes to `ts_analyze_module` or `svelte_analyze_module` based on file type |\n| `library_pipeline.ts` | Pipeline helpers — collect source files, find duplicates, merge re-exports, sort modules |\n| `library_output.ts`   | Output generation — produces `library.json` and `library.ts` files     |\n| `ts_helpers.ts`       | TypeScript compiler API utilities — analyzes TS/JS module exports      |\n| `svelte_helpers.ts`   | Svelte component analysis — uses svelte2tsx + TypeScript compiler API  |\n| `tsdoc_helpers.ts`    | JSDoc/TSDoc parsing — extracts `@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`, `@since`, `@nodocs`, `@mutates` |\n| `module_helpers.ts`   | Path utilities — file type detection, path extraction, `SourceFileInfo` type |\n| `analysis_context.ts` | Diagnostic collection — structured error/warning accumulation          |\n\n### Two-Phase Analysis\n\n1. **Phase 1**: Analyze each module, collecting declarations and re-export\n   information. Dispatches to `ts_analyze_module` (.ts/.js) or\n   `svelte_analyze_module` (.svelte) via `library_analyze_module`.\n2. **Phase 2**: Merge re-exports via `library_merge_re_exports` to build\n   `also_exported_from` arrays on canonical declarations.\n\nAfter both phases: sort modules, check for duplicate names in the flat\nnamespace, and generate output files.\n\n## Tome System\n\nA **Tome** is a documentation page. Zod schema in `@fuzdev/fuz_ui/tome.js`:\n\n```typescript\nconst Tome = z.object({\n  name: z.string(),            // URL slug and display name\n  category: z.string(),        // grouping in sidebar navigation\n  Component: z.custom<Component<any, any>>(), // the +page.svelte component\n  related_tomes: z.array(z.string()),         // cross-links to other tome pages\n  related_modules: z.array(z.string()),       // links to source modules in API docs\n  related_declarations: z.array(z.string()),  // links to specific exports in API docs\n});\n```\n\n### Cross-references\n\n| Field                  | Links to                     | Example value                 |\n| ---------------------- | ---------------------------- | ----------------------------- |\n| `related_tomes`        | Other tome pages             | `['ThemeRoot']`               |\n| `related_modules`      | Source files in `/docs/api/` | `['theme_state.svelte.ts']`   |\n| `related_declarations` | Specific exports in API docs | `['ThemeRoot', 'ThemeState']` |\n\n### Categories\n\nCategories group tomes in sidebar navigation. Project-specific:\n\n| Project | Categories                       |\n| ------- | -------------------------------- |\n| fuz_ui  | `guide`, `helpers`, `components` |\n| fuz_css | `guide`, `systems`, `styles`     |\n\n### Registry\n\nEvery project with docs has `src/routes/docs/tomes.ts`:\n\n```typescript\nimport type {Tome} from '@fuzdev/fuz_ui/tome.js';\nimport introduction from '$routes/docs/introduction/+page.svelte';\nimport api from '$routes/docs/api/+page.svelte';\n\nexport const tomes: Array<Tome> = [\n	{\n		name: 'introduction',\n		category: 'guide',\n		Component: introduction,\n		related_tomes: ['api'],\n		related_modules: [],\n		related_declarations: [],\n	},\n	// ...\n];\n```\n\n### Helpers\n\nFrom `@fuzdev/fuz_ui/tome.js`:\n\n- `get_tome_by_name(name)` — look up a Tome from `tomes_context` (throws if not found)\n- `to_tome_pathname(tome, docs_path?, hash?)` — generate URL for a tome\n- `tomes_context` — context holding `() => Map<string, Tome>` (set by `Docs`)\n- `tome_context` — context holding `() => Tome` for the current page (set by `TomeContent`)\n\nFrom `@fuzdev/fuz_ui/docs_helpers.svelte.js`:\n\n- `docs_slugify(name)` — convert tome name to URL-safe slug (preserves case)\n- `docs_links_context` — context holding `DocsLinks` for section navigation\n- `DOCS_PATH_DEFAULT`, `DOCS_PATH`, `DOCS_API_PATH` — path constants\n\n## Setting Up Docs in a Project\n\nSix files, following the pattern in fuz_ui and fuz_css.\n\n### 1. Library generation\n\n`src/routes/library.gen.ts`:\n\n```typescript\nimport {library_gen} from '@fuzdev/fuz_ui/library_gen.js';\nimport {library_throw_on_duplicates} from '@fuzdev/fuz_ui/library_generate.js';\n\nexport const gen = library_gen({on_duplicates: library_throw_on_duplicates});\n```\n\nRun `gro gen` to produce `library.json` and `library.ts`.\n\n### 2. Root layout\n\nIn `src/routes/+layout.svelte`, create a `Library` instance and provide it:\n\n```svelte\n<script lang=\"ts\">\n	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.js';\n	import {library_json} from '$routes/library.js';\n\n	library_context.set(new Library(library_json));\n<\/script>\n```\n\n### 3. Docs layout\n\n`src/routes/docs/+layout.svelte`:\n\n```svelte\n<script lang=\"ts\">\n	import type {Snippet} from 'svelte';\n	import Docs from '@fuzdev/fuz_ui/Docs.svelte';\n	import {library_context} from '@fuzdev/fuz_ui/library.svelte.js';\n	import {tomes} from '$routes/docs/tomes.js';\n\n	const {children}: {children: Snippet} = $props();\n	const library = library_context.get();\n<\/script>\n\n<Docs {tomes} {library}>\n	{@render children()}\n</Docs>\n```\n\nOptional `breadcrumb_children` snippet for custom logo in the top nav:\n\n```svelte\n<Docs {tomes} {library}>\n	{#snippet breadcrumb_children(is_primary_nav)}\n		{#if is_primary_nav}\n			<div class=\"icon row\">\n				<Svg data={logo} size=\"var(--icon_size_sm)\" /> <span class=\"ml_sm\">my_project</span>\n			</div>\n		{:else}\n			<Svg data={logo} size=\"var(--icon_size_sm)\" />\n		{/if}\n	{/snippet}\n	{@render children()}\n</Docs>\n```\n\n### 4. Tomes registry\n\n`src/routes/docs/tomes.ts` — see [Registry](#registry) above.\n\n### 5. Individual tome pages\n\nEach tome is a `+page.svelte` in `src/routes/docs/{name}/`:\n\n```svelte\n<script lang=\"ts\">\n	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';\n	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';\n	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';\n	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';\n\n	const LIBRARY_ITEM_NAME = 'MyComponent';\n	const tome = get_tome_by_name(LIBRARY_ITEM_NAME);\n<\/script>\n\n<TomeContent {tome}>\n	<section>\n		<!-- Introduction content -->\n	</section>\n	<TomeSection>\n		<TomeSectionHeader text=\"Usage\" />\n		<!-- Section content with examples -->\n	</TomeSection>\n	<TomeSection>\n		<TomeSectionHeader text=\"Options\" />\n		<!-- Another section -->\n	</TomeSection>\n</TomeContent>\n```\n\n`TomeSectionHeader` auto-detects heading level (h2/h3/h4) based on nesting\ndepth. Sections tracked by IntersectionObserver for right sidebar TOC.\n\n### 6. API routes\n\n`src/routes/docs/api/+page.svelte` — API overview:\n\n```svelte\n<script lang=\"ts\">\n	import ApiIndex from '@fuzdev/fuz_ui/ApiIndex.svelte';\n<\/script>\n\n<ApiIndex />\n```\n\n`src/routes/docs/api/[...module_path]/+page.svelte` — per-module docs:\n\n```svelte\n<script lang=\"ts\">\n	import ApiModule from '@fuzdev/fuz_ui/ApiModule.svelte';\n\n	const {params} = $props();\n	const module_path = $derived(params.module_path ?? '');\n<\/script>\n\n<ApiModule {module_path} />\n```\n\n## Docs Layout Architecture\n\n`<Docs>` provides a three-column responsive layout:\n\n| Column        | Component          | Content                              |\n| ------------- | ------------------ | ------------------------------------ |\n| Top bar       | `DocsPrimaryNav`   | Breadcrumb, nav dialog toggle        |\n| Left sidebar  | `DocsSecondaryNav` | Tome list grouped by category        |\n| Center        | `main`             | Route content (tome pages, API docs) |\n| Right sidebar | `DocsTertiaryNav`  | Section headers within current page  |\n\nRight sidebar collapses below ~1000px, left below ~800px. Both move into a\ndialog accessible from the top bar's menu button.\n\n### Key contexts\n\nSee [Helpers](#helpers) for the full list. The four contexts that wire the\nlayout together:\n\n- `library_context` (`Library`) — API metadata\n- `tomes_context` (`() => Map<string, Tome>`) — registered tomes (set by `Docs`)\n- `tome_context` (`() => Tome`) — current page's tome (set by `TomeContent`)\n- `docs_links_context` (`DocsLinks`) — fragment tracking for section navigation\n\n### Runtime Classes\n\n`Library` class (`library.svelte.ts`) provides the runtime API documentation\nhierarchy:\n\n- **`Library`** — wraps `LibraryJson`, provides `modules`, `declarations`,\n  `module_by_path`, `declaration_by_name` lookup maps, and\n  `search_declarations(query)` for multi-term search\n- **`Module`** (`module.svelte.ts`) — wraps `ModuleJson`, provides `path`,\n  `declarations`, `url_api`, `module_comment`\n- **`Declaration`** (`declaration.svelte.ts`) — wraps `DeclarationJson`,\n  provides `name`, `kind`, `module_path`, `url_api`, `url_github`\n\nAll use `$derived` for reactive computed properties.\n\n## Component Reference\n\n### Documentation layout\n\n| Component          | Purpose                                                      |\n| ------------------ | ------------------------------------------------------------ |\n| `Docs`             | Three-column layout, sets `tomes_context` and `docs_links_context` |\n| `DocsPrimaryNav`   | Top bar with breadcrumb navigation and menu toggle           |\n| `DocsSecondaryNav` | Left sidebar — tome list grouped by category                 |\n| `DocsTertiaryNav`  | Right sidebar — section headers within current page          |\n| `DocsContent`      | Content wrapper for docs pages                               |\n| `DocsFooter`       | Footer with library info and breadcrumb                      |\n| `DocsSearch`       | Search input for filtering modules and declarations          |\n| `DocsMenu`         | Navigation menu for tomes                                    |\n| `DocsLink`         | Navigation link within docs                                  |\n| `DocsList`         | List component for docs navigation                           |\n| `DocsPageLinks`    | Links section within a docs page                             |\n| `DocsMenuHeader`   | Header within the docs navigation menu                       |\n\n### Tome components\n\n| Component           | Purpose                                               |\n| ------------------- | ----------------------------------------------------- |\n| `TomeContent`       | Individual tome page wrapper, sets `tome_context`     |\n| `TomeHeader`        | Default header rendered by `TomeContent`              |\n| `TomeSection`       | Section container with depth tracking and intersection |\n| `TomeSectionHeader` | Section heading with hashlink (auto h2/h3/h4)         |\n| `TomeLink`          | Cross-reference link to another tome                   |\n\n### API documentation\n\n| Component            | Purpose                                                      |\n| -------------------- | ------------------------------------------------------------ |\n| `ApiIndex`           | API overview with search, lists all modules and declarations |\n| `ApiModule`          | Single module's declarations with full detail                |\n| `ApiModulesList`     | Module listing within the API index                          |\n| `ApiDeclarationList` | Declaration listing within a module                          |\n| `DeclarationDetail`  | Full detail view of a single declaration                     |\n| `DeclarationLink`    | Link to a declaration in API docs                            |\n| `ModuleLink`         | Link to a module in API docs                                 |\n| `TypeLink`           | Link to a type reference                                     |\n\n### Library metadata\n\n| Component        | Purpose                                          |\n| ---------------- | ------------------------------------------------ |\n| `LibrarySummary` | Compact package metadata card                    |\n| `LibraryDetail`  | Expanded package info with file type breakdown   |\n\n## Cross-Project Pattern\n\nfuz_ui **defines** all documentation components and the analysis pipeline.\nOther projects **import** them:\n\n```typescript\n// In fuz_ui (defines the components)\nimport Docs from '$lib/Docs.svelte';\nimport {library_context} from '$lib/library.svelte.js';\n\n// In fuz_css or any consumer project\nimport Docs from '@fuzdev/fuz_ui/Docs.svelte';\nimport {library_context} from '@fuzdev/fuz_ui/library.svelte.js';\n```\n\nLayout structure is identical — only tomes, categories, and breadcrumb\nbranding differ. `library_gen()` with fuz_ui's built-in analysis is the shared\ngeneration engine.\n\n## See Also\n\n- **`svelte_preprocess_mdz`** — build-time compilation of static `<Mdz>` content\n  to pre-rendered Svelte markup, eliminating runtime parsing for known-static\n  doc strings\n- **`vite_plugin_library_well_known`** — publishes library metadata at\n  `.well-known/library.json` (RFC 8615) for external tool discovery\n- **`svelte-docinfo`** (`@fuzdev/svelte-docinfo`) — standalone package with the\n  same TypeScript/Svelte analysis as fuz_ui, with CLI, Vite plugin, and\n  build-tool agnostic API. fuz_ui does not depend on it.\n- **./tsdoc-comments** — TSDoc/JSDoc authoring conventions, tag reference,\n  mdz auto-linking, and documentation auditing\n"},{slug:"rust-patterns",title:"Rust Patterns for the Fuz Ecosystem",content:`# Rust Patterns for the Fuz Ecosystem

**Applies to**: \`fuz\` (daemon + CLI), \`tsv\` (parser/formatter), \`blake3\` (WASM
bindings), \`zzz_server\` (axum web server). All projects use **Rust edition
2024**, resolver 2.

Each project's \`CLAUDE.md\` is authoritative for project-specific conventions.
This covers shared patterns.

## Core Values

- **No backwards compatibility**: Pre-1.0 means breaking changes. Delete old
  code, don't shim.
- **Code quality**: \`unsafe_code = "forbid"\`, pedantic lints, tests expected.
- **Performance**: If it's slow, it's a bug.
- **Copious \`// TODO:\` comments**: Mark known future work, unfinished parts.
- **\`todo!()\` macro warns**: All projects set \`todo = "warn"\` — use
  \`#[allow(clippy::todo)]\` with justification when needed.

## Lints

Strict lint configuration in \`Cargo.toml\`:

\`\`\`toml
[workspace.lints.rust]
unsafe_code = "forbid"
trivial_casts = "warn"
trivial_numeric_casts = "warn"
unused_lifetimes = "warn"
unused_qualifications = "warn"

[workspace.lints.clippy]
# Enable lint groups (priority -1 so individual lints can override)
all = { level = "warn", priority = -1 }
pedantic = { level = "warn", priority = -1 }
nursery = { level = "warn", priority = -1 }
cargo = { level = "warn", priority = -1 }

# Common pedantic allows
module_name_repetitions = "allow"
must_use_candidate = "allow"
similar_names = "allow"
too_many_lines = "allow"

# Nursery overrides
significant_drop_tightening = "allow"

# Cargo allows (private repos)
cargo_common_metadata = "allow"
multiple_crate_versions = "allow"

# Restriction lints (panic points need explicit #[allow] with justification)
clone_on_ref_ptr = "warn"
dbg_macro = "warn"
expect_used = "warn"
panic = "warn"
todo = "warn"
unwrap_used = "warn"
\`\`\`

### Project-specific lint differences

- \`missing_debug_implementations\`: "warn" in fuz, "allow" in tsv (parser types
  contain non-Debug fields like \`Chars\`, \`RefCell<Interner>\`), not set in blake3
- tsv has additional pedantic/nursery allows for parser code:
  \`cast_possible_truncation\`, \`cast_lossless\`, \`cast_possible_wrap\`,
  \`wildcard_imports\`, \`cognitive_complexity\`, etc.
- **Crate-level overrides**: \`fuz_pty\`, \`tsv_napi\`, and \`blake3_component\`
  override \`unsafe_code = "allow"\` (FFI/N-API/wit-bindgen require unsafe).
  These crates duplicate workspace lints since Cargo doesn't allow partial
  overrides. \`blake3_component\` also allows \`same_length_and_capacity\` and
  \`use_self\` (false positives from wit-bindgen generated code).

Each crate opts in with \`[lints] workspace = true\`.

## Release Profile

\`\`\`toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
\`\`\`

Slower builds (~2x), no symbol names in backtraces. Worth it for binary size
and performance.

**blake3 exception**: \`opt-level = "s"\` for smaller WASM. Individual builds
override via \`RUSTFLAGS\`.

tsv profiling profile:

\`\`\`toml
[profile.profiling]
inherits = "release"
debug = true
strip = false
\`\`\`

## Error Handling

### fuz and tsv: \`thiserror\` for typed errors

\`\`\`rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MyError {
    #[error("file not found: {0}")]
    FileNotFound(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),
}
\`\`\`

### Binary vs library pattern (fuz)

Libraries export typed errors. Binaries wrap them with top-level error for
display and exit codes:

\`\`\`rust
// Library crate - typed errors
pub async fn call_tool(name: &str) -> Result<Value, ClientError> { ... }

// Binary crate - wraps library errors via #[from]
#[derive(Debug, Error)]
pub enum CliError {
    #[error(transparent)]
    Client(#[from] ClientError),

    #[error(transparent)]
    Artifact(#[from] ArtifactError),
}

// Central error handling in main()
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(hint) = e.hint() {
            eprintln!("{hint}");
        }
        std::process::exit(e.exit_code());
    }
}
\`\`\`

### Helper methods (fuz)

\`\`\`rust
impl CliError {
    pub fn hint(&self) -> Option<HintMessage> { ... }  // User-facing fix suggestion
    pub fn exit_code(&self) -> i32 { ... }             // Process exit code
}

impl ClientError {
    pub fn hint(&self) -> &'static str { ... }         // User-facing fix suggestion
    pub fn is_transient(&self) -> bool { ... }         // Retry might succeed
}

impl SidecarError {
    pub fn is_recoverable(&self) -> bool { ... }       // Should trigger restart
}
\`\`\`

### Context enrichment (tsv)

\`\`\`rust
parser.parse().map_err(|e| e.with_context(source))
// Adds line/column info + source snippet with caret pointer
\`\`\`

### WASM boundary errors (blake3)

No \`thiserror\`. Use \`JsError\` directly for wasm-bindgen:

\`\`\`rust
pub fn keyed_hash(key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsError> {
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
    Ok(blake3::keyed_hash(&key, data).as_bytes().to_vec())
}
\`\`\`

For component model errors, see \`references/wasm-patterns.md\`.

## Naming Conventions

Standard Rust — **snake_case + PascalCase**:

\`\`\`rust
// Functions, variables, modules - snake_case
fn parse_typescript() {}
let source_text = "";
mod ast_builder;

// Types, structs, enums - PascalCase
struct AstNode {}
enum TokenKind {}

// Constants - SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE: usize = 4 * 1024 * 1024 * 1024;
\`\`\`

Unlike TypeScript's domain-first naming, Rust free functions use natural naming:

\`\`\`rust
impl Span {
    fn extract<'a>(&self, source: &'a str) -> &'a str { ... }
    fn range(&self) -> Range<usize> { ... }
}

// Free functions - natural Rust naming
fn create_artifact(inputs: &ArtifactInputs) -> Result<ArtifactMeta> { ... }
fn parse(source: &str) -> Result<Program> { ... }
fn format(program: &Program, source: &str) -> String { ... }
\`\`\`

## Project Structure

### Workspace Organization

\`\`\`
project/
├── Cargo.toml          # Workspace config with shared deps, lints, profile
├── crates/
│   ├── {proj}_common/  # Foundation utilities (shared types, errors)
│   ├── {proj}_*/       # Feature-specific crates
│   ├── {proj}_cli/     # Production binary (or just {proj}/ — see below)
│   ├── {proj}_debug/   # Dev binary (may use Deno sidecar)
│   └── {proj}_wasm/    # Interface crates: WASM, FFI, N-API
├── tests/              # Integration tests (tsv only; fuz uses unit tests)
│   └── fixtures/       # Test fixtures (if applicable)
└── docs/               # Architecture and reference documentation
\`\`\`

Crate naming: generally \`{project}_{crate}\` (\`fuz_common\`, \`tsv_lang\`,
\`blake3_wasm_core\`). Exceptions: fuz's CLI is just \`fuz\` (not \`fuz_cli\`) and
its daemon is \`fuzd\` (not \`fuz_daemon\`) — short names for frequently-typed
commands.

### Common crate patterns

- **Foundation crate**: Shared types (Span, errors, config) with minimal deps
  (\`fuz_common\`, \`tsv_lang\`, \`blake3_wasm_core\`)
- **Feature crates**: Domain logic with \`lib.rs\` public API
- **Debug crate**: Dev tooling, may embed external runtimes (Deno sidecars)
- **Interface crates**: Binding layers (CLI, C FFI, N-API, WASM)
- **xtask crate**: Dev automation (\`cargo xtask install\`), used by fuz

## Commands

\`\`\`bash
cargo check --workspace            # Fast syntax check (no codegen)
cargo test --workspace             # Run all tests
cargo clippy --workspace           # Lint
cargo fmt                          # Format
cargo build --workspace            # Debug build
cargo build --workspace --release  # Optimized build
\`\`\`

## Build Configuration

### build.rs

- **Git version embedding** (fuz, fuzd): \`cargo::rustc-env=FUZ_GIT_INFO={hash}\`
- **Compile-time data** (fuz_crypto): Parse/validate public keys, generate
  constants
- **Target triple** (fuz_release): \`cargo:rustc-env=TARGET={triple}\`
- **HTML entity tables** (tsv_html): \`phf::Map\` via \`phf_codegen\`
- **N-API build** (tsv_napi): \`napi-build\` bindings boilerplate

### xtask pattern (fuz)

\`\`\`bash
cargo xtask install              # Build, install to ~/.fuz/, restart daemon
cargo xtask install --new-token  # Regenerate auth token
cargo xtask clean                # Remove ~/.fuz/, stop daemon
\`\`\`

### .cargo/config.toml (fuz only)

\`\`\`toml
[env]
FUZ_PORT = "3621"    # Dev port override (avoids conflict with prod port 3620)

[alias]
xtask = "run --package xtask --"
\`\`\`

Does NOT set \`FUZ_AUTH_TOKEN\`. Dev config comes from \`~/.fuz/config/env\`,
generated by \`cargo xtask install\`.

## Testing

- \`cargo test --workspace\` runs all tests
- Unit tests in \`#[cfg(test)] mod tests\`
- Integration tests in \`tests/\` (tsv only)
- See each project's \`CLAUDE.md\` for specifics

### By project

- **tsv**: Fixture-based TDD with Deno for canonical comparison against
  Prettier and Svelte's parser. Integration tests in \`tests/\`.
- **fuz**: Unit tests in modules. Covers error handling, serialization, auth,
  crypto, artifacts.
- **blake3**: TypeScript correctness tests (WASM vs native reference). Rust
  tests for compilation. Component model tested via Wasmtime.

## CLI Patterns

Both fuz and tsv use manual arg parsing (no clap) for binary size and compile
times.

**fuz** — simple match in \`main.rs\`:

\`\`\`rust
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(hint) = e.hint() {
            eprintln!("{hint}");
        }
        std::process::exit(e.exit_code());
    }
}

#[tokio::main]
async fn run() -> Result<(), CliError> {
    let args: Vec<String> = std::env::args().collect();
    match args[1].as_str() {
        "build" => build::cmd_build(&args[2..]).await,
        "status" => status::cmd_status(&args[2..]).await,
        _ => { print_usage(); std::process::exit(1); }
    }
}
\`\`\`

**tsv** — \`CommandRegistry\` with trait objects and shared input modes:

\`\`\`rust
fn main() {
    let registry = cli::build_registry();
    registry.run(args);
}
\`\`\`

Both share input modes: file path, \`--content <string>\`, \`--stdin\`.

## Dependencies

Minimal dependency philosophy. Prefer workspace-level sharing. No new deps
without explicit request.

### Shared

| Crate                              | Purpose            | Used by                            |
| ---------------------------------- | ------------------ | ---------------------------------- |
| \`serde\`, \`serde_json\`              | Serialization      | fuz, tsv, zzz_server (blake3 bench crate only) |
| \`thiserror\`                        | Error derivation   | fuz, tsv, zzz_server               |
| \`tracing\`, \`tracing-subscriber\`    | Structured logging | fuz, zzz_server                    |

### Domain-specific

**Async / networking** (fuz, zzz_server):

| Crate         | Purpose                        |
| ------------- | ------------------------------ |
| \`tokio\`       | Async runtime                  |
| \`axum\`        | HTTP server (built on hyper)   |
| \`reqwest\`     | HTTP client (fuz only)         |
| \`tokio-util\`  | CancellationToken, TaskTracker |
| \`parking_lot\` | Faster mutex (no poisoning)    |

**Database** (zzz_server):

| Crate               | Purpose                        |
| -------------------- | ------------------------------ |
| \`tokio-postgres\`     | Async PostgreSQL client        |
| \`deadpool-postgres\`  | Connection pooling             |

**Parsing** (tsv):

| Crate                | Purpose                             |
| -------------------- | ----------------------------------- |
| \`smallvec\`           | Stack-allocated vectors             |
| \`string-interner\`    | String interning for AST            |
| \`phf\`                | Compile-time perfect hash maps      |
| \`unicode-ident\`      | XID_Start/XID_Continue              |
| \`unicode-segmentation\` | Grapheme cluster iteration        |
| \`unicode-width\`      | Visual width calculation            |

**Crypto / hashing** (fuz):

| Crate           | Purpose                      |
| --------------- | ---------------------------- |
| \`blake3\`        | Content-addressed artifacts  |
| \`ed25519-dalek\` | Signing/verification         |
| \`subtle\`        | Constant-time comparison     |
| \`zeroize\`       | Secure memory clearing       |

**WASM** (blake3, tsv):

| Crate          | Purpose                     |
| -------------- | --------------------------- |
| \`wasm-bindgen\` | JS interop (wasm-pack)      |
| \`wit-bindgen\`  | Component model (blake3)    |
| \`napi\`         | N-API bindings (tsv)        |

See \`references/wasm-patterns.md\` for build targets, WIT design, and
optimization profiles.

## Patterns

### AST Architecture (tsv)

- **Internal AST**: Clean, semantic. No \`serde::Serialize\`.
- **Public AST**: Conversion layer matching external JSON output (Svelte's
  parser format).
- Raw strings extracted via \`source[span.range()]\`, never duplicated.

\`\`\`rust
// Internal - clean and semantic
struct Literal {
    value: LiteralValue,  // Decoded
    span: Span,
}

// Public conversion - applies quirks at boundary
fn to_json(lit: &Literal, source: &str) -> Value {
    json!({
        "value": lit.value,
        "raw": &source[lit.span.range()],
    })
}
\`\`\`

### Span Types (tsv)

- **Span**: \`u32\` for start/end (memory efficient, max 4GB)
- **Lexer/Parser**: \`usize\` (natural for indexing)
- Convert at boundaries. Helpers: \`span.extract(source)\`, \`span.range()\`

### Comment Handling (tsv)

Stored separately in flat \`Vec<Comment>\` at root. Printer finds comments via
O(log n) binary search on span positions.

### Security Patterns (fuz)

- **Constant-time token comparison** via \`subtle::ConstantTimeEq\`
- **TOCTOU-safe file operations**: Open with \`O_NOFOLLOW\`, check permissions
  on fd not path
- **Secure file permissions**: \`0o600\` for files, \`0o700\` for directories
- **Environment isolation**: Strip sensitive env vars before spawning sidecars

### Logging

**Servers** (zzz_server): \`tracing\` with \`tracing-subscriber\` for structured
logging. axum integrates with \`tracing\` natively. Use \`tracing::info!\`,
\`tracing::error!\`, etc.

**CLIs / daemons** (fuz, tsv): \`eprintln!\` — simple, no framework. Batched
request logging for performance. \`--json\` for machine-readable output.

## Documentation

- **Copious \`// TODO:\` comments** — expected and valued
- \`todo!()\` macro: allowed in tsv, warned in fuz
- Doc comments (\`///\`) for public API
- Inline comments (\`//\`) for implementation notes

See each project's \`CLAUDE.md\` for detailed conventions.
`},{slug:"rust-conventions",title:"Rust Conventions for the Fuz Ecosystem",content:`# Rust Conventions for the Fuz Ecosystem

**Applies to**: \`fuz\` (daemon + CLI), \`tsv\` (parser/formatter), \`blake3\` (WASM
bindings), \`zzz_server\` (axum web server). All projects use **Rust edition
2024**, resolver 2.

Each project's \`CLAUDE.md\` is authoritative for project-specific conventions.
This covers shared patterns.

## Core Values

- **No backwards compatibility**: Pre-1.0 means breaking changes. Delete old
  code, don't shim.
- **Code quality**: \`unsafe_code = "forbid"\`, pedantic lints, tests expected.
- **Performance**: If it's slow, it's a bug.
- **Copious \`// TODO:\` comments**: Mark known future work, unfinished parts.
- **\`todo!()\` macro policy varies**: tsv allows it (parser development). fuz
  warns via \`todo = "warn"\` — use \`#[allow(clippy::todo)]\` with justification.

## Lints

Strict lint configuration in \`Cargo.toml\`:

\`\`\`toml
[workspace.lints.rust]
unsafe_code = "forbid"
trivial_casts = "warn"
trivial_numeric_casts = "warn"
unused_lifetimes = "warn"
unused_qualifications = "warn"

[workspace.lints.clippy]
# Enable lint groups (priority -1 so individual lints can override)
all = { level = "warn", priority = -1 }
pedantic = { level = "warn", priority = -1 }
nursery = { level = "warn", priority = -1 }
cargo = { level = "warn", priority = -1 }

# Common pedantic allows
module_name_repetitions = "allow"
must_use_candidate = "allow"
similar_names = "allow"
too_many_lines = "allow"

# Nursery overrides
significant_drop_tightening = "allow"

# Cargo allows (private repos)
cargo_common_metadata = "allow"
multiple_crate_versions = "allow"

# Restriction lints (panic points need explicit #[allow] with justification)
dbg_macro = "warn"
expect_used = "warn"
panic = "warn"
unwrap_used = "warn"
\`\`\`

### Project-specific lint differences

- \`missing_debug_implementations\`: "warn" in fuz, "allow" in tsv/blake3
  (parser types contain non-Debug fields like \`Chars\`, \`RefCell<Interner>\`)
- \`todo\`: "warn" in fuz (requires explicit \`#[allow]\`), not set in tsv/blake3
- \`clone_on_ref_ptr\`: "warn" in tsv only
- tsv/blake3 share additional pedantic/nursery allows for parser code:
  \`cast_possible_truncation\`, \`cast_lossless\`, \`cast_possible_wrap\`,
  \`wildcard_imports\`, \`cognitive_complexity\`, etc.
- **Crate-level overrides**: \`fuz_pty\` and \`tsv_napi\` override
  \`unsafe_code = "allow"\` (FFI/N-API require unsafe). These crates duplicate
  workspace lints since Cargo doesn't allow partial overrides.

Each crate opts in with \`[lints] workspace = true\`.

## Release Profile

\`\`\`toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
\`\`\`

Slower builds (~2x), no symbol names in backtraces. Worth it for binary size
and performance.

**blake3 exception**: \`opt-level = "s"\` for smaller WASM. Individual builds
override via \`RUSTFLAGS\`.

tsv profiling profile:

\`\`\`toml
[profile.profiling]
inherits = "release"
debug = true
strip = false
\`\`\`

## Error Handling

### fuz and tsv: \`thiserror\` for typed errors

\`\`\`rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MyError {
    #[error("file not found: {0}")]
    FileNotFound(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),
}
\`\`\`

### Binary vs library pattern (fuz)

Libraries export typed errors. Binaries wrap them with top-level error for
display and exit codes:

\`\`\`rust
// Library crate - typed errors
pub async fn call_tool(name: &str) -> Result<Value, ClientError> { ... }

// Binary crate - wraps library errors via #[from]
#[derive(Debug, Error)]
pub enum CliError {
    #[error(transparent)]
    Client(#[from] ClientError),

    #[error(transparent)]
    Artifact(#[from] ArtifactError),
}

// Central error handling in main()
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(hint) = e.hint() {
            eprintln!("{hint}");
        }
        std::process::exit(e.exit_code());
    }
}
\`\`\`

### Helper methods (fuz)

\`\`\`rust
impl CliError {
    pub fn hint(&self) -> Option<HintMessage> { ... }  // User-facing fix suggestion
    pub fn exit_code(&self) -> i32 { ... }             // Process exit code
}

impl ClientError {
    pub fn hint(&self) -> &'static str { ... }         // User-facing fix suggestion
    pub fn is_transient(&self) -> bool { ... }         // Retry might succeed
}

impl SidecarError {
    pub fn is_recoverable(&self) -> bool { ... }       // Should trigger restart
}
\`\`\`

### Context enrichment (tsv)

\`\`\`rust
parser.parse().map_err(|e| e.with_context(source))
// Adds line/column info + source snippet with caret pointer
\`\`\`

### WASM boundary errors (blake3)

No \`thiserror\`. Use \`JsError\` directly for wasm-bindgen:

\`\`\`rust
pub fn keyed_hash(key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsError> {
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
    Ok(blake3::keyed_hash(&key, data).as_bytes().to_vec())
}
\`\`\`

For component model errors, see \`references/wasm_patterns.md\`.

## Naming Conventions

Standard Rust — **snake_case + PascalCase**:

\`\`\`rust
// Functions, variables, modules - snake_case
fn parse_typescript() {}
let source_text = "";
mod ast_builder;

// Types, structs, enums - PascalCase
struct AstNode {}
enum TokenKind {}

// Constants - SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE: usize = 4 * 1024 * 1024 * 1024;
\`\`\`

Unlike TypeScript's domain-first naming, Rust free functions use natural naming:

\`\`\`rust
impl Span {
    fn extract<'a>(&self, source: &'a str) -> &'a str { ... }
    fn range(&self) -> Range<usize> { ... }
}

// Free functions - natural Rust naming
fn create_artifact(inputs: &ArtifactInputs) -> Result<ArtifactMeta> { ... }
fn parse(source: &str) -> Result<Program> { ... }
fn format(program: &Program, source: &str) -> String { ... }
\`\`\`

## Project Structure

### Workspace Organization

\`\`\`
project/
├── Cargo.toml          # Workspace config with shared deps, lints, profile
├── crates/
│   ├── {proj}_common/  # Foundation utilities (shared types, errors)
│   ├── {proj}_*/       # Feature-specific crates
│   ├── {proj}_cli/     # Production binary (pure Rust)
│   ├── {proj}_debug/   # Dev binary (may use Deno sidecar)
│   └── {proj}_wasm/    # Interface crates: WASM, FFI, N-API
├── tests/              # Integration tests (tsv only; fuz uses unit tests)
│   └── fixtures/       # Test fixtures (if applicable)
└── docs/               # Architecture and reference documentation
\`\`\`

Crate naming: \`{project}_{crate}\` (\`fuz_common\`, \`tsv_lang\`, \`blake3_wasm_core\`).

### Common crate patterns

- **Foundation crate**: Shared types (Span, errors, config) with minimal deps
  (\`fuz_common\`, \`tsv_lang\`, \`blake3_wasm_core\`)
- **Feature crates**: Domain logic with \`lib.rs\` public API
- **Debug crate**: Dev tooling, may embed external runtimes (Deno sidecars)
- **Interface crates**: Binding layers (CLI, C FFI, N-API, WASM)
- **xtask crate**: Dev automation (\`cargo xtask install\`), used by fuz

## Commands

\`\`\`bash
cargo check --workspace            # Fast syntax check (no codegen)
cargo test --workspace             # Run all tests
cargo clippy --workspace           # Lint
cargo fmt                          # Format
cargo build --workspace            # Debug build
cargo build --workspace --release  # Optimized build
\`\`\`

## Build Configuration

### build.rs

- **Git version embedding** (fuz, fuzd): \`cargo::rustc-env=FUZ_GIT_INFO={hash}\`
- **Compile-time data** (fuz_crypto): Parse/validate public keys, generate
  constants
- **Target triple** (fuz_release): \`cargo:rustc-env=TARGET={triple}\`
- **HTML entity tables** (tsv_html): \`phf::Map\` via \`phf_codegen\`
- **N-API build** (tsv_napi): \`napi-build\` bindings boilerplate

### xtask pattern (fuz)

\`\`\`bash
cargo xtask install              # Build, install to ~/.fuz/, restart daemon
cargo xtask install --new-token  # Regenerate auth token
cargo xtask clean                # Remove ~/.fuz/, stop daemon
\`\`\`

### .cargo/config.toml (fuz only)

\`\`\`toml
[env]
FUZ_PORT = "3621"    # Dev port override (avoids conflict with prod port 3620)

[alias]
xtask = "run --package xtask --"
\`\`\`

Does NOT set \`FUZ_AUTH_TOKEN\`. Dev config comes from \`~/.fuz/config/env\`,
generated by \`cargo xtask install\`.

## Testing

- \`cargo test --workspace\` runs all tests
- Unit tests in \`#[cfg(test)] mod tests\`
- Integration tests in \`tests/\` (tsv only)
- See each project's \`CLAUDE.md\` for specifics

### By project

- **tsv**: Fixture-based TDD with Deno for canonical comparison against
  Prettier and Svelte's parser. Integration tests in \`tests/\`.
- **fuz**: Unit tests in modules. Covers error handling, serialization, auth,
  crypto, artifacts.
- **blake3**: TypeScript correctness tests (WASM vs native reference). Rust
  tests for compilation. Component model tested via Wasmtime.

## CLI Patterns

Both fuz and tsv use manual arg parsing (no clap) for binary size and compile
times.

**fuz** — simple match in \`main.rs\`:

\`\`\`rust
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(hint) = e.hint() {
            eprintln!("{hint}");
        }
        std::process::exit(e.exit_code());
    }
}

#[tokio::main]
async fn run() -> Result<(), CliError> {
    let args: Vec<String> = std::env::args().collect();
    match args[1].as_str() {
        "build" => build::cmd_build(&args[2..]).await,
        "status" => status::cmd_status(&args[2..]).await,
        _ => { print_usage(); std::process::exit(1); }
    }
}
\`\`\`

**tsv** — \`CommandRegistry\` with trait objects and shared input modes:

\`\`\`rust
fn main() {
    let registry = cli::build_registry();
    registry.run(args);
}
\`\`\`

Both share input modes: file path, \`--content <string>\`, \`--stdin\`.

## Dependencies

Minimal dependency philosophy. Prefer workspace-level sharing. No new deps
without explicit request.

### Shared

| Crate                              | Purpose            | Used by                            |
| ---------------------------------- | ------------------ | ---------------------------------- |
| \`serde\`, \`serde_json\`              | Serialization      | fuz, tsv, zzz_server (blake3 bench crate only) |
| \`thiserror\`                        | Error derivation   | fuz, tsv, zzz_server               |
| \`tracing\`, \`tracing-subscriber\`    | Structured logging | fuz, zzz_server                    |

### Domain-specific

**Async / networking** (fuz, zzz_server):

| Crate         | Purpose                        |
| ------------- | ------------------------------ |
| \`tokio\`       | Async runtime                  |
| \`axum\`        | HTTP server (built on hyper)   |
| \`reqwest\`     | HTTP client (fuz only)         |
| \`tokio-util\`  | CancellationToken, TaskTracker |
| \`parking_lot\` | Faster mutex (no poisoning)    |

**Database** (zzz_server):

| Crate               | Purpose                        |
| -------------------- | ------------------------------ |
| \`tokio-postgres\`     | Async PostgreSQL client        |
| \`deadpool-postgres\`  | Connection pooling             |

**Parsing** (tsv):

| Crate                | Purpose                             |
| -------------------- | ----------------------------------- |
| \`smallvec\`           | Stack-allocated vectors             |
| \`string-interner\`    | String interning for AST            |
| \`phf\`                | Compile-time perfect hash maps      |
| \`unicode-ident\`      | XID_Start/XID_Continue              |
| \`unicode-segmentation\` | Grapheme cluster iteration        |
| \`unicode-width\`      | Visual width calculation            |

**Crypto / hashing** (fuz):

| Crate           | Purpose                      |
| --------------- | ---------------------------- |
| \`blake3\`        | Content-addressed artifacts  |
| \`ed25519-dalek\` | Signing/verification         |
| \`subtle\`        | Constant-time comparison     |
| \`zeroize\`       | Secure memory clearing       |

**WASM** (blake3, tsv):

| Crate          | Purpose                     |
| -------------- | --------------------------- |
| \`wasm-bindgen\` | JS interop (wasm-pack)      |
| \`wit-bindgen\`  | Component model (blake3)    |
| \`napi\`         | N-API bindings (tsv)        |

See \`references/wasm_patterns.md\` for build targets, WIT design, and
optimization profiles.

## Patterns

### AST Architecture (tsv)

- **Internal AST**: Clean, semantic. No \`serde::Serialize\`.
- **Public AST**: Conversion layer matching external JSON output (Svelte's
  parser format).
- Raw strings extracted via \`source[span.range()]\`, never duplicated.

\`\`\`rust
// Internal - clean and semantic
struct Literal {
    value: LiteralValue,  // Decoded
    span: Span,
}

// Public conversion - applies quirks at boundary
fn to_json(lit: &Literal, source: &str) -> Value {
    json!({
        "value": lit.value,
        "raw": &source[lit.span.range()],
    })
}
\`\`\`

### Span Types (tsv)

- **Span**: \`u32\` for start/end (memory efficient, max 4GB)
- **Lexer/Parser**: \`usize\` (natural for indexing)
- Convert at boundaries. Helpers: \`span.extract(source)\`, \`span.range()\`

### Comment Handling (tsv)

Stored separately in flat \`Vec<Comment>\` at root. Printer finds comments via
O(log n) binary search on span positions.

### Security Patterns (fuz)

- **Constant-time token comparison** via \`subtle::ConstantTimeEq\`
- **TOCTOU-safe file operations**: Open with \`O_NOFOLLOW\`, check permissions
  on fd not path
- **Secure file permissions**: \`0o600\` for files, \`0o700\` for directories
- **Environment isolation**: Strip sensitive env vars before spawning sidecars

### Logging

**Servers** (zzz_server): \`tracing\` with \`tracing-subscriber\` for structured
logging. axum integrates with \`tracing\` natively. Use \`tracing::info!\`,
\`tracing::error!\`, etc.

**CLIs / daemons** (fuz, tsv): \`eprintln!\` — simple, no framework. Batched
request logging for performance. \`--json\` for machine-readable output.

## Documentation

- **Copious \`// TODO:\` comments** — expected and valued
- \`todo!()\` macro: allowed in tsv, warned in fuz
- Doc comments (\`///\`) for public API
- Inline comments (\`//\`) for implementation notes

See each project's \`CLAUDE.md\` for detailed conventions.
`},{slug:"svelte-patterns",title:"Svelte 5 Patterns",content:`# Svelte 5 Patterns

Svelte 5 runes and patterns used across the Fuz ecosystem.

## Contents

- [State Runes](#state-runes)
- [Derived Values](#derived-values)
- [Reactive Collections](#reactive-collections)
- [Schema-Driven Reactive Classes](#schema-driven-reactive-classes)
- [Context Patterns](#context-patterns)
- [Snippet Patterns](#snippet-patterns)
- [Effect Patterns](#effect-patterns)
- [Attachment Patterns](#attachment-patterns)
- [Props Patterns](#props-patterns)
- [Event Handling](#event-handling)
- [Component Composition](#component-composition)
- [Runes in .svelte.ts Files](#runes-in-sveltets-files)
- [Debugging](#debugging)
- [Each Blocks](#each-blocks)
- [CSS in Components](#css-in-components)
- [Legacy Features to Avoid](#legacy-features-to-avoid)
- [Quick Reference](#quick-reference)

## State Runes

Only use \`$state\` for variables that should be _reactive_ — variables that
cause an \`$effect\`, \`$derived\`, or template expression to update. Everything
else can be a normal variable.

### \`$state.raw()\` vs \`$state()\` — prefer \`$state.raw()\`

**Use \`$state.raw()\` by default for all types** — primitives, objects, and arrays.
It stores values directly with no proxy overhead.

**Use \`$state()\` only** when you need deep proxy reactivity on an array or object —
meaning you mutate it in place with \`push\`, \`splice\`, index assignment, or nested
property writes, and need those mutations to trigger reactivity.

\`$state()\` wraps non-primitives in a \`Proxy\` on init and on every reassignment.
This adds overhead and creates proxy objects that break \`structuredClone\` and
other APIs that expect plain values. For primitives, \`$state()\` compiles to an
extra \`proxy()\` call per set (a \`typeof\` check + early return, so cheap but
non-zero). Use \`$state.raw()\` unless you have a specific reason not to.

\`\`\`typescript
// $state.raw() - the default for all types
let name = $state.raw(''); // primitive — no difference in behavior
let api_response = $state.raw<ApiResponse | null>(null); // object replaced wholesale
let selections: ReadonlyArray<Item> = $state.raw([]); // array replaced wholesale

// $state() - opt-in for arrays/objects mutated in place
let items = $state<string[]>([]); // needs push/splice reactivity
items.push('new'); // triggers reactivity
let form_data = $state({name: '', email: ''});
form_data.name = 'Alice'; // triggers reactivity via proxy

// $state() required for const objects with bind: or property writes
const config = $state({iterations: 5, warmup: 2});
// in template: bind:value={config.iterations} — writes a property, needs $state()
// $state.raw() here would silently break — const prevents reassignment,
// and raw doesn't track property writes, so nothing triggers reactivity
\`\`\`

**When to use \`$state()\`** (the exception, not the default):

- Arrays mutated with \`push\`, \`splice\`, \`pop\`, \`sort\`, index assignment
- Objects with individual property mutations that must trigger reactivity
- \`bind:value\` or \`bind:checked\` on object properties (e.g., \`bind:value={config.name}\`)
  — bindings write to individual properties, which requires deep proxy reactivity

**Watch for \`const\` objects:** A \`const\` object declared with \`$state.raw()\` has
no way to trigger reactivity — it can't be reassigned (it's \`const\`) and property
mutations aren't tracked (it's \`raw\`). If the object's properties are mutated
(directly or via \`bind:\`), use \`$state()\`.

**Check consumer files, not just the declaring file.** A class field may be
mutated in place by external code that accesses it — e.g., a component importing
a state class and calling \`thing.items.splice(i, 1)\`. Grep the entire \`src/\`
directory for mutation patterns on the field name before deciding.

**Everything else uses \`$state.raw()\`:**

- All primitives (strings, numbers, booleans, enums)
- API responses, external data
- Objects/arrays replaced wholesale (filter, spread, reassignment)
- Data passed to non-reactive APIs (\`structuredClone\`, \`JSON.stringify\`, action systems)

### The \`$state.raw()!\` Non-null Assertion Pattern

Class properties initialized by constructor or \`init()\` use \`$state.raw()!\`:

\`\`\`typescript
export class ThemeState {
	theme: Theme = $state.raw()!;
	color_scheme: ColorScheme = $state.raw()!;

	constructor(options?: ThemeStateOptions) {
		this.theme = options?.theme ?? default_themes[0]!;
		this.color_scheme = options?.color_scheme ?? 'auto';
	}
}
\`\`\`

Used across fuz_ui state classes and zzz Cell subclasses. Use \`$state()!\` only
for arrays/objects that are mutated in place (see above).

### Arrays and Collections

\`\`\`typescript
// Default: $state.raw() - only replacement tracked
let selections: ReadonlyArray<ItemState> = $state.raw([]);
selections = [...selections, new_item]; // triggers
selections.push(new_item); // does NOT trigger (and type error with ReadonlyArray)

// Opt-in: $state() - when you need in-place mutation reactivity
let items = $state<string[]>([]);
items.push('new'); // triggers reactivity
items[0] = 'updated'; // triggers reactivity
\`\`\`

### \`$state.snapshot()\`

Returns a deep-cloned plain copy of reactive state. Works on both \`$state()\`
and \`$state.raw()\` values — it calls \`toJSON()\` on class instances either way,
so it's needed whenever the value holds objects with \`toJSON\` methods (e.g.,
Cell instances) regardless of proxy status.

\`\`\`typescript
// cell.svelte.ts - encode_property uses snapshot for serialization
encode_property(value: unknown, _key: string): unknown {
	return $state.snapshot(value);
}
\`\`\`

**When you need snapshot:**

- \`$state()\` proxy values being passed to \`structuredClone\` or non-reactive APIs
- \`$state.raw()\` values holding class instances with \`toJSON()\` (snapshot calls
  \`toJSON\` and recursively clones the result)
- Any reactive value you need a plain deep copy of

**When you don't need snapshot:**

- \`$state.raw()\` values holding only plain data (primitives, plain objects/arrays)
  — these are already non-proxied and can be used directly

## Derived Values

Use \`$derived\` to compute from state — never \`$effect\` with assignment.
Deriveds are writable (assign to override, but the expression re-evaluates on
dependency change). Derived objects/arrays are not made deeply reactive.

### \`$derived\` vs \`$derived.by()\`

\`$derived\` takes an expression (not a function). \`$derived.by()\` for loops,
conditionals, or multi-step logic.

\`\`\`typescript
// Simple expression - use $derived
let count = $state(0);
let doubled = $derived(count * 2);
let is_empty = $derived(items.length === 0);

// Complex logic - use $derived.by()
let filtered_items = $derived.by(() => {
	if (!filter) return items;
	return items.filter((item) => item.name.includes(filter));
});

// Loops require $derived.by()
let total = $derived.by(() => {
	let sum = 0;
	for (const item of items) {
		sum += item.value;
	}
	return sum;
});
\`\`\`

### \`$derived\` in Classes

Class properties use \`readonly $derived\` and \`readonly $derived.by()\`. Always
mark \`$derived\` class properties as \`readonly\` unless you explicitly need
reassignment (which Svelte 5 does allow):

\`\`\`typescript
// From Library class (fuz_ui/library.svelte.ts)
export class Library {
	readonly library_json: LibraryJson = $state.raw()!;

	readonly package_json = $derived(this.library_json.package_json);
	readonly source_json = $derived(this.library_json.source_json);
	readonly name = $derived(this.library_json.name);
	readonly repo_url = $derived(this.library_json.repo_url);
	readonly modules = $derived(
		this.source_json.modules
			? this.source_json.modules.map((module_json) => new Module(this, module_json))
			: [],
	);
	readonly module_by_path = $derived(
		new Map(this.modules.map((m) => [m.path, m])),
	);
}
\`\`\`

\`\`\`typescript
// From Thread class (zzz/thread.svelte.ts) - $derived.by for complex logic
readonly model: Model = $derived.by(() => {
	const model = this.app.models.find_by_name(this.model_name);
	if (!model) throw new Error(\`Model "\${this.model_name}" not found\`);
	return model;
});

// From ContextmenuState - $derived for simple, $derived.by for multi-step
readonly can_collapse = $derived(this.selections.length > 1);

readonly can_expand = $derived.by(() => {
	const selected = this.selections.at(-1);
	return !!selected?.is_menu && selected.items.length > 0;
});
\`\`\`

### Derived from Props

Treat props as though they will change — use \`$derived\` for values that depend
on props:

\`\`\`typescript
let {type} = $props();

// Do this — updates when type changes
let color = $derived(type === 'danger' ? 'red' : 'green');

// Don't do this — color won't update if type changes
// let color = type === 'danger' ? 'red' : 'green';
\`\`\`

## Reactive Collections

### \`SvelteMap\` and \`SvelteSet\`

From \`svelte/reactivity\` — reactive Map/Set that trigger updates on mutations:

\`\`\`typescript
import {SvelteMap, SvelteSet} from 'svelte/reactivity';

// From DocsLinks class (fuz_ui/docs_helpers.svelte.ts)
export class DocsLinks {
	readonly links: SvelteMap<string, DocsLinkInfo> = new SvelteMap();
	readonly fragments_onscreen: SvelteSet<string> = new SvelteSet();

	// $derived.by works with SvelteMap - recomputes when links change
	readonly docs_links = $derived.by(() => {
		const children_map: Map<string | undefined, Array<DocsLinkInfo>> = new Map();
		for (const link of this.links.values()) {
			// ... build tree from SvelteMap entries
		}
		return result;
	});
}
\`\`\`

Standard \`Map\`/\`Set\` are not tracked by Svelte's reactivity.

For entity streams where the same data is consumed by different
lookups, maintain **multiple \`SvelteMap\` indexes** over it — rebuild
on snapshot events, update incrementally on delta events. Deriveds
then use \`.get()\` lookups instead of array scans.

## Schema-Driven Reactive Classes

Zod schemas paired with Svelte 5 runes classes — the schema defines the JSON
shape, the class adds reactivity and behavior. See ./zod-schemas.

### Simple Pattern (fuz_ui)

\`\`\`typescript
// theme_state.svelte.ts
export class ThemeState {
	theme: Theme = $state.raw()!;
	color_scheme: ColorScheme = $state.raw()!;

	constructor(options?: ThemeStateOptions) {
		this.theme = options?.theme ?? default_themes[0]!;
		this.color_scheme = options?.color_scheme ?? 'auto';
	}

	toJSON(): ThemeStateJson {
		return {
			theme: this.theme,
			color_scheme: this.color_scheme,
		};
	}
}
\`\`\`

### Cell Pattern (zzz)

Advanced version with \`Cell\` base class that automates JSON hydration from
Zod schemas:

\`\`\`typescript
// Schema with CellJson base, .meta for class registration
export const ChatJson = CellJson.extend({
	name: z.string().default(''),
	thread_ids: z.array(Uuid).default(() => []),
}).meta({cell_class_name: 'Chat'});

export class Chat extends Cell<typeof ChatJson> {
	// $state.raw()! for fields set by Cell.init() — the default
	name: string = $state.raw()!;
	// $state()! only for arrays mutated in place (push/splice)
	thread_ids: Array<Uuid> = $state()!;

	// Computed values use $derived or $derived.by()
	readonly threads: Array<Thread> = $derived.by(() => {
		const result: Array<Thread> = [];
		for (const id of this.thread_ids) {
			const thread = this.app.threads.items.by_id.get(id);
			if (thread) result.push(thread);
		}
		return result;
	});

	constructor(options: ChatOptions) {
		super(ChatJson, options);
		this.init(); // Must call at end of constructor
	}
}
\`\`\`

**Key patterns:**

- Zod schema defines the JSON shape (see ./zod-schemas)
- Class properties use \`$state.raw()!\` by default (non-null assertion)
- \`$state()!\` only for arrays/objects with in-place mutations (push, splice, etc.)
- \`readonly $derived\` / \`readonly $derived.by()\` for computed values in classes
- \`toJSON()\` or \`to_json()\` for serialization (zzz Cell uses a \`$derived\` \`json\`
  property)

## Context Patterns

### Creating Context

\`create_context<T>()\` from \`@fuzdev/fuz_ui/context_helpers.js\`. Two overloads:
without fallback, \`get()\` throws if unset and \`get_maybe()\` returns \`undefined\`;
with fallback, \`get()\` uses it and \`set()\` value is optional:

\`\`\`typescript
// Without fallback -- get() throws if unset, get_maybe() returns undefined
export function create_context<T>(): {
	get: (error_message?: string) => T;
	get_maybe: () => T | undefined;
	set: (value: T) => T;
};

// With fallback -- get() uses fallback if unset, set() value is optional
export function create_context<T>(fallback: () => T): {
	get: () => T;
	set: (value?: T) => T;
};
\`\`\`

### Using Context

\`\`\`typescript
// Define the context (typically in a shared module)
export const frontend_context = create_context<Frontend>();
export const section_depth_context = create_context(() => 0);
\`\`\`

\`\`\`svelte
<!-- Provider component sets the context -->
<script>
  import type {Snippet} from 'svelte';
  import {frontend_context} from './frontend.svelte.js';

  const {app, children}: {app: Frontend; children: Snippet} = $props();
  frontend_context.set(app);
<\/script>

{@render children()}
\`\`\`

\`\`\`svelte
<!-- Consumer components get the context -->
<script>
  import {frontend_context} from './frontend.svelte.js';
  const app = frontend_context.get();
<\/script>
\`\`\`

### Getter Function Context Pattern

Some contexts wrap values in \`() => T\` so the context reference stays stable
while the value can change:

\`\`\`typescript
// Type is () => ThemeState, not ThemeState
export const theme_state_context = create_context<() => ThemeState>();

// Setting with a getter
theme_state_context.set(() => theme_state);

// Consuming - call the getter
const get_theme_state = theme_state_context.get();
const theme_state = get_theme_state();
\`\`\`

Used when the context value might be reassigned (e.g., \`theme_state\` is a prop).
Direct value contexts like \`frontend_context\` and \`library_context\` are for
values stable for the context's lifetime.

### Common Contexts

**fuz_ui contexts:**

| Context                            | Type                         | Source file                        | Purpose                          |
| ---------------------------------- | ---------------------------- | ---------------------------------- | -------------------------------- |
| \`theme_state_context\`              | \`() => ThemeState\`           | \`theme_state.svelte.ts\`            | Theme state (getter pattern)     |
| \`library_context\`                  | \`Library\`                    | \`library.svelte.ts\`                | Package API metadata for docs    |
| \`tomes_context\`                    | \`() => Map<string, Tome>\`   | \`tome.ts\`                          | Available documentation tomes    |
| \`tome_context\`                     | \`() => Tome\`                 | \`tome.ts\`                          | Current documentation page       |
| \`docs_links_context\`               | \`DocsLinks\`                  | \`docs_helpers.svelte.ts\`           | Documentation navigation         |
| \`section_depth_context\`            | \`number\`                     | \`TomeSection.svelte\`               | Heading depth (fallback: 0)      |
| \`register_section_header_context\`  | \`RegisterSectionHeader\`      | \`TomeSection.svelte\`               | Register section header callback |
| \`section_id_context\`               | \`string \\| undefined\`        | \`TomeSection.svelte\`               | Current section ID               |
| \`contextmenu_context\`              | \`() => ContextmenuState\`     | \`contextmenu_state.svelte.ts\`      | Context menu state (getter)      |
| \`contextmenu_submenu_context\`      | \`SubmenuState\`               | \`contextmenu_state.svelte.ts\`      | Current submenu state            |
| \`contextmenu_dimensions_context\`   | \`Dimensions\`                 | \`contextmenu_state.svelte.ts\`      | Context menu positioning         |
| \`selected_variable_context\`        | \`SelectedStyleVariable\`      | \`style_variable_helpers.svelte.ts\` | Style variable selection         |
| \`mdz_components_context\`           | \`MdzComponents\`              | \`mdz_components.ts\`                | Custom mdz components            |
| \`mdz_elements_context\`             | \`MdzElements\`                | \`mdz_components.ts\`                | Allowed HTML elements in mdz     |
| \`mdz_base_context\`                 | \`() => string \\| undefined\`  | \`mdz_components.ts\`                | Base path for mdz links          |

**zzz contexts:**

| Context              | Type       | Source file          | Purpose           |
| -------------------- | ---------- | -------------------- | ----------------- |
| \`frontend_context\`   | \`Frontend\` | \`frontend.svelte.ts\` | Application state |

## Snippet Patterns

Svelte 5 replaces slots with snippets (\`{#snippet}\` and \`{@render}\`).

### The \`children\` Snippet

Implicit \`children\` replaces the default slot. Typed as \`Snippet\` (or
\`Snippet<[params]>\` with parameters):

\`\`\`svelte
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {children}: {children: Snippet} = $props();
<\/script>

<div class="wrapper">
	{@render children()}
</div>
\`\`\`

Content between component tags becomes \`children\`:

\`\`\`svelte
<Wrapper>
	<p>This becomes the children snippet.</p>
</Wrapper>
\`\`\`

### Children with Parameters

\`ThemeRoot\` and \`Dialog\` pass data back via parameterized children:

\`\`\`svelte
<!-- ThemeRoot.svelte passes theme_state, style, and html to children -->
<script lang="ts">
	const {children}: {
		children: Snippet<[theme_state: ThemeState, style: string | null, theme_style_html: string | null]>;
	} = $props();
<\/script>

{@render children(theme_state, style, theme_style_html)}
\`\`\`

\`\`\`svelte
<!-- Dialog.svelte passes a close function -->
<script lang="ts">
	const {children}: {
		children: Snippet<[close: (e?: Event) => void]>;
	} = $props();
<\/script>

{@render children(close)}
\`\`\`

### Named Snippets

\`\`\`svelte
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {
		summary,
		children,
	}: {
		summary: string | Snippet;
		children: Snippet;
	} = $props();
<\/script>

<details>
	<summary>
		{#if typeof summary === 'string'}
			{summary}
		{:else}
			{@render summary()}
		{/if}
	</summary>
	{@render children()}
</details>
\`\`\`

### Snippets with Parameters

\`\`\`svelte
<!-- List.svelte -->
<script lang="ts" generics="T">
	import type {Snippet} from 'svelte';

	const {
		items,
		item,
		empty,
	}: {
		items: T[];
		item: Snippet<[T]>;
		empty?: Snippet;
	} = $props();
<\/script>

{#if items.length === 0}
	{#if empty}
		{@render empty()}
	{/if}
{:else}
	{#each items as entry}
		{@render item(entry)}
	{/each}
{/if}
\`\`\`

### Default Snippet Content

\`\`\`svelte
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {menu}: {menu?: Snippet} = $props();
<\/script>

{#if menu}
	{@render menu()}
{:else}
	<!-- Default content when no snippet provided -->
	<button>Default Menu</button>
{/if}
\`\`\`

### Icon as String or Snippet

\`Card\` accepts icons as string (emoji) or Snippet:

\`\`\`typescript
const {icon}: {icon?: string | Snippet} = $props();
\`\`\`

\`Alert\` uses a richer variant — the Snippet receives the resolved icon string,
and \`null\` hides the icon:

\`\`\`typescript
const {icon}: {icon?: string | Snippet<[icon: string]> | null | undefined} = $props();
\`\`\`

\`\`\`svelte
{#if typeof final_icon === 'string'}
	{final_icon}
{:else}
	{@render final_icon()}
{/if}
\`\`\`

## Effect Patterns

Effects are an escape hatch — avoid when possible. Prefer:

- \`$derived\` / \`$derived.by()\` for computing from state
- \`{@attach}\` for syncing with external libraries or DOM
- Event handlers / function bindings for responding to user interaction
- \`$inspect\` / \`$inspect.trace()\` for debugging (not \`$effect\` + \`console.log\`)
- \`createSubscriber\` from \`svelte/reactivity\` for observing external sources

Don't wrap effect contents in \`if (browser) {...}\` — effects don't run on the
server. Avoid updating \`$state\` inside effects.

### Basic Effects

\`\`\`typescript
$effect(() => {
	// Runs when any tracked dependency changes
	console.log('Count is now:', count);
});
\`\`\`

### Effect Cleanup

Return a cleanup function for subscriptions, timers, or listeners:

\`\`\`typescript
$effect(() => {
	const interval = setInterval(() => {
		tick_count++;
	}, 1000);

	// Cleanup runs before next effect and on destroy
	return () => clearInterval(interval);
});

$effect(() => {
	const handler = (e: KeyboardEvent) => {
		if (e.key === 'Escape') close();
	};
	window.addEventListener('keydown', handler);
	return () => window.removeEventListener('keydown', handler);
});
\`\`\`

### \`$effect.pre()\`

Runs before DOM updates. Used for dev-mode validation and scroll management:

\`\`\`typescript
// Dev-mode validation (GithubLink.svelte)
if (DEV) {
	$effect.pre(() => {
		if (!path && !href_prop) {
			throw new Error('GithubLink requires either \`path\` or \`href\` prop');
		}
	});
}
\`\`\`

### \`effect_with_count()\`

From \`@fuzdev/fuz_ui/rune_helpers.svelte.js\` — passes call count to the
effect, useful for skipping the initial run:

\`\`\`typescript
import {effect_with_count} from '@fuzdev/fuz_ui/rune_helpers.svelte.js';

// Skip the first run (count === 1), save on subsequent changes
effect_with_count((count) => {
	const v = theme_state.color_scheme;
	if (count === 1) return; // skip initial
	save_color_scheme(v);
});
\`\`\`

### \`untrack()\`

Read values without creating dependencies:

\`\`\`typescript
import {untrack} from 'svelte';

$effect(() => {
	// count is tracked
	console.log('Count changed to:', count);

	// other_value is NOT tracked - reading it won't re-run the effect
	const snapshot = untrack(() => other_value);
	save_snapshot(count, snapshot);
});
\`\`\`

**Use cases:** reading config that shouldn't trigger re-runs, accessing
stable references, breaking infinite loops in bidirectional syncing.

## Attachment Patterns

Svelte 5 attachments (\`{@attach}\`) replace actions (\`use:\`). Attachments live
in \`*.svelte.ts\` files and use \`Attachment\` from \`svelte/attachments\`.

### Attachment API

An attachment is \`(element) => cleanup | void\`. fuz_ui uses a **factory
pattern** — export a function that accepts configuration and returns the
\`Attachment\`:

\`\`\`typescript
import type {Attachment} from 'svelte/attachments';

export const my_attachment =
	(options?: MyOptions): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		// setup
		return () => {
			// cleanup (optional)
		};
	};
\`\`\`

Usage: \`{@attach my_attachment()}\` or \`{@attach my_attachment({...options})}\`

### fuz_ui Attachments

#### \`autofocus\` -- Focus on Mount

Solves the HTML \`autofocus\` attribute not working when elements mount from
reactive conditionals (\`{#if}\`) in SPAs.

\`\`\`typescript
// autofocus.svelte.ts
import type {Attachment} from 'svelte/attachments';

export const autofocus =
	(options?: FocusOptions): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		el.focus({focusVisible: true, ...options} as FocusOptions);
	};
\`\`\`

\`\`\`svelte
<script>
	import {autofocus} from '@fuzdev/fuz_ui/autofocus.svelte.js';
<\/script>

<!-- Basic usage -->
<input {@attach autofocus()} />

<!-- With options -->
<input {@attach autofocus({preventScroll: true})} />
\`\`\`

#### \`intersect\` -- IntersectionObserver

Wraps IntersectionObserver with a **lazy function pattern** — reactive
callbacks update without recreating the observer.

\`\`\`typescript
// intersect.svelte.ts — signature only, see source for implementation
export const intersect =
	(
		get_params: () => IntersectParamsOrCallback | null | undefined,
	): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		// Uses $effect internally: callbacks update reactively,
		// observer only recreates when options change (deep equality check)
	};
\`\`\`

\`\`\`svelte
<script>
	import {intersect} from '@fuzdev/fuz_ui/intersect.svelte.js';
<\/script>

<!-- Simple callback (receives IntersectState: intersecting, intersections, el, observer, disconnect) -->
<div {@attach intersect(() => ({intersecting}) => { ... })}>

<!-- Full params with options -->
<div {@attach intersect(() => ({
	onintersect: ({intersecting, el}) => {
		el.classList.toggle('visible', intersecting);
	},
	ondisconnect: ({intersecting, intersections}) => { ... },
	count: 1,
	options: {threshold: 0.5},
}))}>
\`\`\`

#### \`contextmenu_attachment\` -- Context Menu Data

Caches context menu params on an element via dataset. Direct params (no lazy
function). Returns cleanup that removes the cache entry.

\`\`\`typescript
// contextmenu_state.svelte.ts (exported alongside Contextmenu state class)
export const contextmenu_attachment =
	<T extends ContextmenuParams, U extends T | Array<T>>(
		params: U | null | undefined,
	): Attachment<HTMLElement | SVGElement> =>
	(el): undefined | (() => void) => {
		if (params == null) return;
		// cache params in dataset, return cleanup
	};
\`\`\`

### Class Method Attachments (zzz)

Attachments as class properties, sharing reactive state with the instance:

\`\`\`typescript
// scrollable.svelte.ts (simplified — see source for flex-direction handling)
export class Scrollable {
	scroll_y: number = $state(0);
	readonly scrolled: boolean = $derived(this.scroll_y > this.threshold);

	// Listens to scroll events, updates class state
	container: Attachment = (element) => {
		const cleanup = on(element, 'scroll', () => {
			this.scroll_y = element.scrollTop;
		});
		return () => cleanup();
	};

	// Attachments run in an effect context — reruns when \`this.scrolled\` changes
	target: Attachment = (element) => {
		if (this.scrolled) {
			element.classList.add(this.target_class);
		} else {
			element.classList.remove(this.target_class);
		}
		return () => element.classList.remove(this.target_class);
	};
}
\`\`\`

\`\`\`svelte
<div {@attach scrollable.container} {@attach scrollable.target}>
\`\`\`

### Choosing a Pattern

| Pattern                       | When to use                               | Example         |
| ----------------------------- | ----------------------------------------- | --------------- |
| **Simple factory**            | Fire-once, no ongoing observation         | \`autofocus\`     |
| **Lazy function** (\`() => p\`) | Reactive callbacks without observer churn | \`intersect\`     |
| **Direct params**             | Static config cached for later retrieval  | \`contextmenu\`   |
| **Class method**              | Attachment shares state with a class      | \`Scrollable\`    |

### Writing a New Attachment

1. Create \`src/lib/my_attachment.svelte.ts\`
2. Export a factory function returning \`Attachment<HTMLElement | SVGElement>\`
3. Return cleanup if holding resources (observers, listeners)
4. Use \`$effect\` inside for reactive behavior, \`on()\` for event listeners
5. Add JSDoc with \`@module\` and \`@param\` tags

## Props Patterns

### Basic Props

\`\`\`svelte
<script lang="ts">
	const {
		name,
		count = 0,
		items = [],
	}: {
		name: string;
		count?: number;
		items?: string[];
	} = $props();
<\/script>
\`\`\`

### Bindable Props

Use \`let\` (not \`const\`) for \`$bindable()\` props:

\`\`\`svelte
<script lang="ts">
	let {
		value = $bindable(180),
		children,
	}: {
		value?: number;
		children?: Snippet;
	} = $props();
<\/script>

<!-- Usage -->
<HueInput bind:value={hue} />
\`\`\`

Real examples from fuz_ui:

\`\`\`typescript
// HueInput.svelte
let {value = $bindable(180), children, ...rest} = $props();

// Details.svelte
let {open = $bindable(), ...rest} = $props();

// DocsSearch.svelte
let {search_query = $bindable(), ...rest} = $props();
\`\`\`

### Rest Props with SvelteHTMLElements

Use \`SvelteHTMLElements\` from \`svelte/elements\` intersected with custom props:

\`\`\`svelte
<script lang="ts">
	import type {Snippet} from 'svelte';
	import type {SvelteHTMLElements} from 'svelte/elements';

	const {
		align = 'left',
		icon,
		children,
		...rest
	}: SvelteHTMLElements['div'] & SvelteHTMLElements['a'] & {
		align?: 'left' | 'right' | 'above' | 'below';
		icon?: string | Snippet;
		children: Snippet;
	} = $props();
<\/script>

<div {...rest} class="card {rest.class}">
	{@render children()}
</div>
\`\`\`

Use \`SvelteHTMLElements['div']\` (not \`HTMLAttributes<HTMLDivElement>\`).

## Event Handling

Svelte 5 uses standard DOM event syntax:

\`\`\`svelte
<button onclick={handle_click}>Click</button>
<input oninput={(e) => value = e.currentTarget.value} />

<!-- Conditional event handlers (pass undefined to remove) -->
<svelte:window onkeydown={active ? on_window_keydown : undefined} />
\`\`\`

### Programmatic Event Listeners

\`on()\` from \`svelte/events\` for programmatic listeners in attachments,
\`.svelte.ts\` files, and plain \`.ts\` modules. Preserves correct ordering
relative to declarative handlers that use event delegation. Always prefer
\`on()\` over \`addEventListener\` — even in non-component code. Returns a
cleanup function:

\`\`\`typescript
import {on} from 'svelte/events';

// Inside an attachment or module
const cleanup = on(element, 'scroll', onscroll);
return () => cleanup();

// With options (e.g., passive: false for wheel events)
const cleanup = on(element, 'wheel', onwheel, {passive: false});
\`\`\`

### \`swallow\` — Claiming Events

\`swallow()\` from \`@fuzdev/fuz_util/dom.js\` combines \`preventDefault()\` and
\`stopImmediatePropagation()\` (or \`stopPropagation()\` with \`immediate: false\`).

**Design principle: handling an event = claiming it.** If you call
\`preventDefault\`, you're already saying "I own this event's default behavior."
Use \`swallow\` to extend that to "and no one else should react to it either."
If a parent needs to observe events before children claim them, use the
\`capture\` phase explicitly — don't rely on implicit bubbling.

\`\`\`typescript
import {swallow} from '@fuzdev/fuz_util/dom.js';

// swallow(event, immediate?, preventDefault?)
swallow(e);                  // preventDefault + stopImmediatePropagation (default)
swallow(e, false);           // preventDefault + stopPropagation (non-immediate)
swallow(e, true, false);     // stopImmediatePropagation only (no preventDefault)
\`\`\`

Use \`swallow\` whenever you would call \`preventDefault\` — the event is yours,
stop it from propagating too. For handlers that only need \`stopPropagation\`
without \`preventDefault\` (e.g., preventing game input from seeing keystrokes
in a chat input), use \`e.stopPropagation()\` directly.

\`\`\`svelte
<!-- Claiming an event in a handler -->
<script lang="ts">
  import {swallow} from '@fuzdev/fuz_util/dom.js';

  const on_keydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      swallow(e);
      send();
    } else if (e.key === 'Escape') {
      swallow(e);
      close();
    } else {
      // only stop propagation, don't prevent default (e.g., typing characters)
      e.stopPropagation();
    }
  };
<\/script>
\`\`\`

\`\`\`typescript
// Programmatic listener claiming context menu and wheel events
const cleanup_contextmenu = on(canvas, 'contextmenu', (e) => {
  swallow(e);
});

const cleanup_wheel = on(canvas, 'wheel', (e) => {
  handle_zoom(e);
  swallow(e);
}, {passive: false});
\`\`\`

## Component Composition

### Module Script Block

\`<script lang="ts" module>\` for component-level exports (contexts, types):

\`\`\`svelte
<!-- TomeSection.svelte -->
<script lang="ts" module>
	import {create_context} from './context_helpers.js';

	export type RegisterSectionHeader = (get_fragment: () => string) => string | undefined;
	export const register_section_header_context = create_context<RegisterSectionHeader>();
	export const section_depth_context = create_context(() => 0);
	export const section_id_context = create_context<string | undefined>();
<\/script>

<script lang="ts">
	// instance script
<\/script>
\`\`\`

### Forwarding Snippets

\`\`\`svelte
<!-- Wrapper.svelte -->
<script lang="ts">
	import type {Snippet} from 'svelte';
	import Inner from './Inner.svelte';

	const {
		header,
		children,
	}: {
		header?: Snippet;
		children?: Snippet;
	} = $props();
<\/script>

<div class="wrapper">
	<Inner {header}>
		{#if children}
			{@render children()}
		{/if}
	</Inner>
</div>
\`\`\`

### Generic Components

\`\`\`svelte
<script lang="ts" generics="T">
	import type {Snippet} from 'svelte';

	const {
		items,
		render,
	}: {
		items: T[];
		render: Snippet<[T, number]>;
	} = $props();
<\/script>

{#each items as item, index}
	{@render render(item, index)}
{/each}
\`\`\`

### Dynamic Elements

\`svelte:element\` for components rendering different HTML tags:

\`\`\`svelte
<script lang="ts">
	const {tag, href, children, ...rest} = $props();

	const link = $derived(!!href);
	const final_tag = $derived(tag ?? (link ? 'a' : 'div'));
<\/script>

<svelte:element this={final_tag} {...rest} {href}>
	{@render children()}
</svelte:element>
\`\`\`

### Transitions

\`\`\`svelte
<script>
	import {slide} from 'svelte/transition';
<\/script>

{#if open}
	<div transition:slide>{@render children()}</div>
{/if}
\`\`\`

## Runes in .svelte.ts Files

\`.svelte.ts\` files use runes (\`$state\`, \`$derived\`, \`$effect\`) outside
components. Prefer **classes** over module-level state — export a class,
instantiate once at the appropriate root, and share it via context.

### Avoid Module-Level Runes for Shared State

Don't declare \`$state\` variables at module scope and expose them through
getter/setter objects. A module-level rune is a hidden global: it can't be
reset per test, per realm, or per session; it ties the lifetime of the
state to the module rather than to a component; and a second instance is
impossible when you later decide you need one.

\`\`\`typescript
// Anti-pattern: module-level runes exposed through a singleton
let show_map = $state.raw(false);
let show_sidebar = $state.raw(true);

export const world_ui = {
	get show_map() { return show_map; },
	set show_map(v: boolean) { show_map = v; },
	get show_sidebar() { return show_sidebar; },
	set show_sidebar(v: boolean) { show_sidebar = v; },
};
\`\`\`

Use a class + context instead — the class owns its state, and a root
component sets it once:

\`\`\`typescript
// world_ui_state.svelte.ts
import {create_context} from '@fuzdev/fuz_ui/context_helpers.js';

export const world_ui_context = create_context<WorldUiState>();

export class WorldUiState {
	show_map: boolean = $state.raw(false);
	show_sidebar: boolean = $state.raw(true);
}
\`\`\`

\`\`\`svelte
<!-- +layout.svelte or similar root component -->
<script>
	import {WorldUiState, world_ui_context} from '$lib/world_ui_state.svelte.js';
	world_ui_context.set(new WorldUiState());
<\/script>
\`\`\`

\`\`\`svelte
<!-- any descendant component -->
<script>
	import {world_ui_context} from '$lib/world_ui_state.svelte.js';
	const world_ui = world_ui_context.get();
<\/script>
\`\`\`

**When module-level runes are fine:** inside a factory function body (see
below) — the state is scoped to the returned object, not the module.

### Factory Functions with Getter/Setter Proxies

\`\`\`typescript
// api_search.svelte.ts
export const create_api_search = (library: Library): ApiSearchState => {
	let query = $state('');

	const all_modules = $derived(library.modules_sorted);
	const filtered_modules = $derived.by(() => {
		if (!query.trim()) return all_modules;
		const terms = query.trim().toLowerCase().split(/\\s+/);
		return all_modules.filter((m) => {
			const path_lower = m.path.toLowerCase();
			const comment_lower = m.module_comment?.toLowerCase() ?? '';
			return terms.every((term) => path_lower.includes(term) || comment_lower.includes(term));
		});
	});

	const all_declarations = $derived(library.declarations);
	const filtered_declarations = $derived.by(() => {
		const items = query.trim() ? library.search_declarations(query) : all_declarations;
		return items.sort((a, b) => a.name.localeCompare(b.name));
	});

	return {
		get query() { return query; },
		set query(v: string) { query = v; },
		modules: {
			get all() { return all_modules; },
			get filtered() { return filtered_modules; },
		},
		declarations: {
			get all() { return all_declarations; },
			get filtered() { return filtered_declarations; },
		},
	};
};
\`\`\`

### Reactive State Classes

The most common pattern for shared state:

\`\`\`typescript
// dimensions.svelte.ts
export class Dimensions {
	width: number = $state.raw(0);
	height: number = $state.raw(0);
}
\`\`\`

### Effect Helpers

\`\`\`typescript
// rune_helpers.svelte.ts
export const effect_with_count = (fn: (count: number) => void, initial = 0): void => {
	let count = initial;
	$effect(() => {
		fn(++count);
	});
};
\`\`\`

### Plain Classes for Imperative Loops

Canvas2D/WebGPU renderers, \`requestAnimationFrame\` loops, and
long-lived pointer listeners are the inverse case: use a **plain
class with no runes**, mounted by a thin \`.svelte\` wrapper. Private
fields (e.g. \`#hovered_id\`, \`#cursor_x\`) stay non-reactive on purpose
— mutating them from an rAF tick must not schedule reruns. The
wrapper binds dimensions, forwards reactive sources via
getter-backed options, and calls \`destroy()\` on unmount. Runes live
in the wrapper, never in the loop.

## Debugging

### \`$inspect.trace()\`

Add as the first line of an \`$effect\` or \`$derived.by\` to trace dependencies
and discover which one triggered an update:

\`\`\`typescript
$effect(() => {
	$inspect.trace('my-effect');
	// ... effect body
});
\`\`\`

## Each Blocks

Prefer keyed each blocks — Svelte can surgically insert or remove items
rather than updating existing DOM:

\`\`\`svelte
{#each items as item (item.id)}
	<li>{item.name}</li>
{/each}
\`\`\`

The key must uniquely identify the object — do not use the array index.
Avoid destructuring if you need to mutate the item (e.g.,
\`bind:value={item.count}\`).

## CSS in Components

**Goal: minimal \`<style>\` blocks.** Components should delegate styling to
fuz_css utility classes and design tokens. Many well-designed components
have no \`<style>\` block at all. See \`css-patterns.md\` §Component Styling
Philosophy for the full rationale, anti-patterns, and examples.

When a \`<style>\` block is needed, keep it focused on component-specific
layout logic (positioning, complex pseudo-states, responsive breakpoints).
All values should reference design tokens, not hardcoded pixels or colors.

**Class naming**: fuz_css utilities use \`snake_case\` (\`p_md\`, \`gap_lg\`).
Component-local classes use \`kebab-case\` (\`site-header\`, \`nav-links\`) to
distinguish them visually.

### JS Variables in CSS

Use \`style:\` directive to pass JS values as CSS custom properties:

\`\`\`svelte
<div style:--columns={columns}>...</div>

<style>
	div { grid-template-columns: repeat(var(--columns), 1fr); }
</style>
\`\`\`

### Styling Child Components

Prefer CSS custom properties. Use \`:global\` only when necessary (e.g.,
third-party components):

\`\`\`svelte
<!-- Parent passes custom property -->
<Child --color="red" />

<!-- Child uses it -->
<style>
	h1 { color: var(--color); }
</style>
\`\`\`

\`\`\`svelte
<!-- :global override (last resort) -->
<div>
	<Child />
</div>

<style>
	div :global {
		h1 { color: red; }
	}
</style>
\`\`\`

Use clsx-style arrays and objects in \`class\` attributes instead of \`class:\`
directive:

\`\`\`svelte
<!-- Do this -->
<div class={['card', active && 'active', size]}></div>

<!-- Not this -->
<div class="card" class:active class:size></div>
\`\`\`

## Legacy Features to Avoid

Always use runes mode. Deprecated patterns and their replacements:

| Instead of                         | Use                                           |
| ---------------------------------- | --------------------------------------------- |
| \`let count = 0\` (implicit)         | \`let count = $state(0)\`                       |
| \`$:\` assignments/statements        | \`$derived\` / \`$effect\`                        |
| \`export let\`                       | \`$props()\`                                    |
| \`on:click={...}\`                   | \`onclick={...}\`                               |
| \`<slot>\`                           | \`{#snippet}\` / \`{@render}\`                    |
| \`<svelte:component this={C}>\`      | \`<C />\` (dynamic component directly)          |
| \`<svelte:self>\`                    | \`import Self from './Self.svelte'\` + \`<Self>\` |
| \`use:action\`                       | \`{@attach}\`                                   |
| \`class:active\`                     | \`class={['base', active && 'active']}\`        |
| Stores (\`writable\`, \`readable\`)    | Classes with \`$state\` fields                  |

## Quick Reference

| Pattern              | Use Case                                      |
| -------------------- | --------------------------------------------- |
| \`$state.raw()\`       | Default for all reactive state                |
| \`$state.raw()!\`      | Class properties initialized by constructor   |
| \`$state()\`           | Arrays/objects with in-place mutations only   |
| \`$state.snapshot()\`  | Plain copy of reactive state for serialization |
| \`readonly $derived\`  | Simple computed values, class properties       |
| \`readonly $derived.by()\` | Complex logic, loops, conditionals         |
| \`$effect\`            | Side effects, subscriptions                    |
| \`$effect.pre()\`      | Before DOM update, dev-mode validation         |
| \`effect_with_count\`  | Skip initial effect run                        |
| \`untrack()\`          | Read without tracking                          |
| \`$inspect.trace()\`   | Debug dependency tracking in effects/derived   |
| \`$props()\`           | Component inputs (\`const\` or \`let\`)            |
| \`$bindable()\`        | Two-way binding props (requires \`let\`)         |
| \`{#snippet}\`         | Named content areas                            |
| \`{@render}\`          | Render snippets                                |
| \`{@attach}\`          | DOM element behaviors (replaces \`use:\`)        |
| \`create_context\`     | Typed Svelte context                           |
| \`SvelteMap/Set\`      | Reactive Map/Set collections                   |
| \`on()\` (events)      | Programmatic event listeners                   |
`},{slug:"task-patterns",title:"Task Patterns",content:"# Task Patterns\n\nGro's task system for project automation in `@fuzdev/gro`. Tasks are TypeScript\nmodules with a `.task.ts` suffix that export a `task` object with a `run`\nfunction.\n\n## Task Interface\n\n```typescript\ninterface Task<\n  TArgs = Args,\n  TArgsSchema extends z.ZodType<Args, Args> = z.ZodType<Args, Args>,\n  TReturn = unknown,\n> {\n  run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;\n  summary?: string;\n  Args?: TArgsSchema;\n}\n```\n\n- `run` — entry point, receives `TaskContext`\n- `summary` — shown in `gro` task listing and `--help`\n- `Args` — optional Zod schema for CLI argument parsing and validation\n  (see ./zod-schemas)\n\n`TArgsSchema` and `TReturn` are rarely customized — tasks are either\n`Task` (default args) or `Task<Args>` (with a custom Zod-inferred `Args` type).\n\n### Basic task example\n\n```typescript\n// src/lib/greet.task.ts\nimport type {Task} from '@fuzdev/gro';\n\nexport const task: Task = {\n  summary: 'greet the user',\n  run: async ({log}) => {\n    log.info('hello!');\n  },\n};\n```\n\nRun with `gro greet` or `gro src/lib/greet`.\n\n### Task with args\n\nBoth the Zod schema (value) and inferred type share the name `Args`:\n\n```typescript\n// src/lib/greet.task.ts\nimport type {Task} from '@fuzdev/gro';\nimport {z} from 'zod';\n\nexport const Args = z.strictObject({\n  name: z.string().meta({description: 'who to greet'}).default('world'),\n});\nexport type Args = z.infer<typeof Args>;\n\nexport const task: Task<Args> = {\n  summary: 'greet someone by name',\n  Args,\n  run: async ({args, log}) => {\n    log.info(`hello, ${args.name}!`);\n  },\n};\n```\n\nRun with `gro greet --name Claude`. `gro greet --help` shows auto-generated\nhelp from the Zod schema.\n\n## TaskContext\n\n```typescript\ninterface TaskContext<TArgs = object> {\n  args: TArgs;\n  config: GroConfig;\n  svelte_config: ParsedSvelteConfig;\n  filer: Filer;\n  log: Logger;\n  timings: Timings;\n  invoke_task: InvokeTask;\n}\n```\n\n| Field           | Type                | Purpose                                         |\n| --------------- | ------------------- | ----------------------------------------------- |\n| `args`          | `TArgs`             | Parsed CLI arguments (validated by Zod if set)   |\n| `config`        | `GroConfig`         | Gro configuration (plugins, task_root_dirs, etc) |\n| `svelte_config` | `ParsedSvelteConfig`| Parsed SvelteKit config (aliases, paths)         |\n| `filer`         | `Filer`             | Filesystem tracker (watches files in dev mode)   |\n| `log`           | `Logger`            | Logger instance scoped to the task               |\n| `timings`       | `Timings`           | Performance measurement (start/stop timers)      |\n| `invoke_task`   | `InvokeTask`        | Call other tasks programmatically                |\n\n### invoke_task\n\n```typescript\ntype InvokeTask = (task_name: string, args?: Args, config?: GroConfig) => Promise<void>;\n```\n\nOmitting `config` passes the current config. Respects the override system —\n`invoke_task('test')` runs the user's override if one exists.\n\n```typescript\nexport const task: Task = {\n  run: async ({invoke_task}) => {\n    await invoke_task('typecheck');\n    await invoke_task('test');\n    await invoke_task('gen', {check: true});\n    await invoke_task('format', {check: true});\n    await invoke_task('lint');\n  },\n};\n```\n\nThis is the core pattern used by `check.task.ts` (which adds conditional\nexecution via `--no-*` flags).\n\n## Args Pattern\n\n### Conventions\n\n- Export both Zod schema and inferred type as `Args` at module level\n- Use `z.strictObject()` (not `z.object()`)\n- `.meta({description: '...'})` for CLI help text\n- `.default(...)` for defaults — required fields without defaults must be\n  passed via CLI\n- `/** @nodocs */` to exclude from docs generation\n\n### Positional arguments\n\n`_` key for positional arguments (array of strings):\n\n```typescript\nexport const Args = z.strictObject({\n  _: z.array(z.string()).meta({description: 'file patterns to filter'}).default(['.test.']),\n  dir: z.string().meta({description: 'working directory'}).default('src/'),\n});\nexport type Args = z.infer<typeof Args>;\n```\n\nRun with: `gro test foo bar --dir src/lib/` (positional `foo`, `bar` go to `_`).\n\n### Boolean dual flags\n\n`--no-*` dual flags for opt-out behavior:\n\n```typescript\nexport const Args = z.strictObject({\n  typecheck: z.boolean().meta({description: 'dual of no-typecheck'}).default(true),\n  'no-typecheck': z.boolean().meta({description: 'opt out of typechecking'}).default(false),\n  test: z.boolean().meta({description: 'dual of no-test'}).default(true),\n  'no-test': z.boolean().meta({description: 'opt out of running tests'}).default(false),\n});\n```\n\n`gro check --no-test` disables testing. `--help` hides the positive flags\nwhen a `no-*` dual exists, showing only the `no-*` entry.\n\n## Error Handling\n\n### TaskError\n\nKnown failure with clean message (no stack trace):\n\n```typescript\nimport {TaskError} from '@fuzdev/gro';\n\nthrow new TaskError('Missing required config file: gro.config.ts');\n```\n\nUse when the message is sufficient for the user to fix the problem.\n\n### SilentError\n\nExit with non-zero code when the error is already logged. Primarily\ninternal to `invoke_task.ts`:\n\n```typescript\nimport {SilentError} from '@fuzdev/gro/task.js';\n\nlog.error('Detailed error information...');\nthrow new SilentError();\n```\n\n### When to use which\n\n| Error type    | Stack trace | Gro logs message | Use when                          |\n| ------------- | ----------- | ---------------- | --------------------------------- |\n| Regular Error | Yes         | Yes              | Unexpected failures               |\n| `TaskError`   | No          | Yes              | Known failures with clear message |\n| `SilentError` | No          | No               | Already logged the error yourself |\n\n## Task Discovery\n\nTask files use `.task.ts` (or `.task.js`) suffix. Gro searches `task_root_dirs`\nin order (default: `src/lib/` then `./` then `gro/dist/`):\n\n```\nsrc/lib/greet.task.ts      -> gro greet\nsrc/lib/deploy.task.ts     -> gro deploy\nsrc/lib/db/migrate.task.ts -> gro db/migrate\n```\n\n`gro` with no task name or `gro some/dir` lists all tasks without executing.\n\n## Task Override Pattern\n\nLocal tasks override Gro builtins with the same name:\n\n- `src/lib/test.task.ts` overrides Gro's builtin `test` task\n- Run the builtin explicitly: `gro gro/test`\n\nCommon override pattern wraps the builtin:\n\n```typescript\nimport type {Task} from '@fuzdev/gro';\n\nexport const task: Task = {\n  summary: 'run tests with custom setup',\n  run: async ({invoke_task, args}) => {\n    // custom setup\n    await invoke_task('gro/test', args); // call the builtin\n    // custom teardown\n  },\n};\n```\n\n## Task Composition\n\n**`invoke_task` (recommended):** Respects overrides, provides logging context,\nauto-forwards CLI args from `--` sections:\n\n```typescript\nawait invoke_task('build', {sync: false, gen: false});\n```\n\n**Direct import:** Bypasses override resolution, tighter coupling:\n\n```typescript\nimport {task as test_task} from './test.task.js';\nawait test_task.run(ctx);\n```\n\n### Args forwarding\n\nCLI args forwarded to composed tasks via `--` separators:\n\n```bash\ngro check -- gro test --coverage\n```\n\nForwards `--coverage` to `test` when `check` invokes it. Multiple `--`\nsections can target different sub-tasks.\n\n## Quick Reference\n\n| Export        | Type      | Import from           | Purpose                                        |\n| ------------- | --------- | --------------------- | ---------------------------------------------- |\n| `Task`        | Interface | `@fuzdev/gro`         | Task definition (run, summary, Args)           |\n| `TaskContext` | Interface | `@fuzdev/gro`         | Context passed to task.run                     |\n| `TaskError`   | Class     | `@fuzdev/gro`         | Known failure (no stack trace)                 |\n| `SilentError` | Class     | `@fuzdev/gro/task.js` | Exit silently (error already logged)           |\n| `InvokeTask`  | Type      | `@fuzdev/gro/task.js` | `(task_name, args?, config?) => Promise<void>` |\n"},{slug:"testing-patterns",title:"Testing Patterns",content:`# Testing Patterns

Testing conventions for the Fuz stack: vitest usage, fixtures, mocks, helpers.

## Contents

- [File Organization](#file-organization) (naming, subdirectories, assertions, async rejection, jsdom)
- [Database Testing](#database-testing) (PGlite, vitest projects, describe_db)
- [Test Helpers](#test-helpers)
- [Shared Test Factories](#shared-test-factories)
- [Fixture-Based Testing](#fixture-based-testing)
- [Mock Patterns](#mock-patterns)
- [Environment Flags](#environment-flags)
- [Test Structure](#test-structure) (basic, organization, parameterized)
- [Quick Reference](#quick-reference)

## File Organization

\`\`\`
src/
├── lib/               # source code
│   └── domain/        # domain subdirectories
└── test/              # all tests (NOT co-located)
    ├── module.test.ts              # single-file tests
    ├── module.aspect.test.ts       # split tests by aspect
    ├── test_helpers.ts             # shared test utilities
    ├── domain_test_helpers.ts      # domain-specific helpers
    ├── domain_test_aspect.ts       # shared test factory (NOT a test file)
    ├── domain/                     # mirrors lib/ subdirectories
    │   ├── module.test.ts
    │   └── module.db.test.ts
    └── fixtures/                   # fixture-based test data
        ├── update.task.ts          # runs all child update tasks
        └── feature_name/
            ├── case_name/
            │   ├── input.{ext}     # test input
            │   └── expected.json   # generated expected output
            ├── feature_name_test_helpers.ts  # fixture-specific helpers
            └── update.task.ts      # regeneration task for this feature
\`\`\`

Tests live in \`src/test/\`, mirroring \`src/lib/\` subdirectories
(e.g., \`src/lib/auth/\` -> \`src/test/auth/\`).

### Test File Naming

Split large suites with dot-separated aspects:

| Pattern                            | Example                                       |
| ---------------------------------- | --------------------------------------------- |
| \`{module}.test.ts\`                 | \`mdz.test.ts\`, \`ts_helpers.test.ts\`           |
| \`{module}.{aspect}.test.ts\`        | \`csp.core.test.ts\`, \`csp.security.test.ts\`    |
| \`{module}.svelte.{aspect}.test.ts\` | \`contextmenu_state.svelte.activation.test.ts\` |
| \`{module}.fixtures.test.ts\`        | \`svelte_preprocess_mdz.fixtures.test.ts\`      |
| \`{module}.db.test.ts\`              | \`account_queries.db.test.ts\`                  |
| \`{module}.integration.db.test.ts\`  | \`invite_signup.integration.db.test.ts\`        |

Module name matches source file. \`.svelte.\` preserves the source extension.

Real examples:

- fuz_util: \`deep_equal.arrays.test.ts\`, \`log.core.test.ts\`, \`log.caching.test.ts\`
- gro: \`build_cache.creation.test.ts\`, \`deploy_task.errors.test.ts\`
- fuz_ui: \`ContextmenuRoot.core.test.ts\`, \`csp.security.test.ts\`
- fuz_css: \`css_class_extractor.elements.test.ts\`, \`css_ruleset_parser.modifiers.test.ts\`
- zzz: \`cell.svelte.base.test.ts\`, \`indexed_collection.svelte.queries.test.ts\`
- fuz_app: \`rate_limiter.bootstrap.db.test.ts\`, \`request_context.ws.db.test.ts\`

### Assertions

Use \`assert\` from vitest. Choose methods for TypeScript type narrowing, not
semantic precision. \`assert.ok\` is the standard guard for narrowing
\`T | undefined\` to \`T\` — don't replace it with \`assert.isDefined\` or other
methods unless the replacement provides better failure diagnostics without
losing narrowing.

\`\`\`typescript
import {test, assert} from 'vitest';

assert.ok(value); // narrows away null/undefined — the standard guard
assert.strictEqual(a, b);
assert.deepStrictEqual(a, b);
\`\`\`

Strengthen assertions when the value is **known** — use \`assert.strictEqual\`
for exact expected values, \`assert.include\`/\`assert.notInclude\` for array
membership (shows actual contents on failure). Leave \`assert.ok\` for guards
where the goal is narrowing, not value checking.

**Why \`assert\` over \`expect\`:** \`assert\` methods narrow types for TypeScript.
\`expect\` chains don't:

\`\`\`typescript
// assert narrows — no type error
const result: string | Error = await get_result();
assert(result instanceof Error);
result.message; // TypeScript knows this is Error

// expect doesn't narrow — type error on .message
expect(result).toBeInstanceOf(Error);
result.message; // Property 'message' does not exist on type 'string | Error'
\`\`\`

After \`assert.isDefined(x)\`, the type is \`NonNullable<T>\` — no \`!\` needed:

\`\`\`typescript
assert.isDefined(result);
assert.strictEqual(result.id, expected_id); // no result! needed
\`\`\`

Name custom assertion helpers \`assert_*\` (not \`expect_*\`).
Example: \`assert_css_contains()\` not \`expect_css_contains()\`.

For throw assertions, use \`assert.throws()\` with Error constructor, string,
or RegExp. **Do not pass a function predicate** — causes
\`"errorLike is not a constructor"\`:

\`\`\`typescript
// Good — RegExp matching
assert.throws(() => fn(), /expected message/);

// Good — Error constructor
assert.throws(() => fn(), TypeError);

// BAD — function predicate does NOT work with chai assert.throws
// assert.throws(() => fn(), (e: any) => e.message.includes('msg'));

assert.doesNotThrow(() => fn());
\`\`\`

\`assert.throws()\` returns \`void\`. To inspect the error, place \`assert.fail\`
**after** the catch block — never inside the try block, where it would be
caught and swallowed:

\`\`\`typescript
try {
	fn();
} catch (e) {
	assert(e instanceof Error);
	assert.include(e.message, 'expected substring');
	assert.strictEqual((e as any).code, 'EXPECTED_CODE');
	return;
}
assert.fail('Expected error');
\`\`\`

### Async Rejection Testing

For async functions that should reject, use \`assert_rejects\` from
\`@fuzdev/fuz_util/testing.js\`. It places \`assert.fail\` outside the catch
block to prevent accidentally catching assertion errors from the test itself:

\`\`\`typescript
import {assert_rejects} from '@fuzdev/fuz_util/testing.js';

// Simple — just check the error pattern
await assert_rejects(
	() => local_repo_load({local_repo_path, git_ops, npm_ops}),
	/Failed to pull.*unstaged changes/,
);

// Pattern is optional — returns the Error for further assertions
const err = await assert_rejects(() =>
	local_repos_load({local_repo_paths: paths, git_ops, npm_ops}),
);
assert.include(err.message, 'repo-a');
assert.include(err.message, 'repo-b');
\`\`\`

### jsdom Environment

For UI tests needing a DOM, add the pragma before imports:

\`\`\`typescript
// @vitest-environment jsdom
\`\`\`

Used in fuz_ui (contextmenu, intersect tests), zzz (cell, UI state), and
fuz_app (auth_state, popover).

**Gotcha:** jsdom normalizes CSS values — \`style.setProperty('top', '0')\`
stores \`'0px'\`. Match the normalized form in assertions.

**Gotcha:** jsdom lacks \`ResizeObserver\` and \`IntersectionObserver\`. Mock them
before importing components:

\`\`\`typescript
// @vitest-environment jsdom
import {vi} from 'vitest';

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
\`\`\`

## Database Testing

fuz_app provides database testing infrastructure. Only fuz_app uses this
pattern currently.

### The \`.db.test.ts\` Convention

Any test using a \`Db\` instance should use \`.db.test.ts\` suffix. \`.db\` always
goes immediately before \`.test.ts\` — e.g., \`foo.integration.db.test.ts\`.

Vitest \`projects\` runs all DB tests in a single worker (\`isolate: false\` +
\`fileParallelism: false\`), sharing one PGlite WASM instance (~500-700ms
cold start saved per file). Non-DB tests stay fully parallel.

### Vitest Projects Configuration

From fuz_app's \`vite.config.ts\`:

\`\`\`typescript
import {availableParallelism} from 'node:os';
import {defineConfig} from 'vitest/config';
import {sveltekit} from '@sveltejs/kit/vite';

const max_threads = Math.max(1, Math.ceil(availableParallelism() / 2));

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					include: ['src/test/**/*.test.ts'],
					exclude: ['src/test/**/*.db.test.ts'],
					maxWorkers: max_threads,
					sequence: {groupOrder: 1},
				},
			},
			{
				extends: true,
				test: {
					name: 'db',
					include: ['src/test/**/*.db.test.ts'],
					isolate: false,
					fileParallelism: false,
					sequence: {groupOrder: 2},
				},
			},
		],
	},
});
\`\`\`

Because \`isolate: false\` shares module state, avoid \`vi.mock()\` in
\`.db.test.ts\` files. If needed, pair with \`vi.restoreAllMocks()\` (not
\`vi.clearAllMocks()\`) in \`afterEach\`.

### describe_db Pattern

fuz_app's \`testing/db.ts\` provides \`create_describe_db(factories, truncate_tables)\`.
Consumer projects create a \`db_fixture.ts\`:

\`\`\`typescript
// src/test/db_fixture.ts
import type {Db} from '$lib/db/db.js';
import {run_migrations} from '$lib/db/migrate.js';
import {AUTH_MIGRATION_NS} from '$lib/auth/migrations.js';
import {
	create_pglite_factory,
	create_pg_factory,
	create_describe_db,
	AUTH_INTEGRATION_TRUNCATE_TABLES,
	log_db_factory_status,
} from '$lib/testing/db.js';

const init_schema = async (db: Db): Promise<void> => {
	await run_migrations(db, [AUTH_MIGRATION_NS]);
};

export const pglite_factory = create_pglite_factory(init_schema);
export const pg_factory = create_pg_factory(init_schema, process.env.TEST_DATABASE_URL);
export const db_factories = [pglite_factory, pg_factory];

log_db_factory_status(db_factories);

export const describe_db = create_describe_db(db_factories, AUTH_INTEGRATION_TRUNCATE_TABLES);
\`\`\`

Test files import and use as a wrapper:

\`\`\`typescript
// src/test/auth/account_queries.db.test.ts
import {describe, assert, test} from 'vitest';
import {query_create_account} from '$lib/auth/account_queries.js';
import {describe_db} from '../db_fixture.js';

describe_db('account queries', (get_db) => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const deps = {db};
		const account = await query_create_account(deps, {
			username: 'alice',
			password_hash: 'hash123',
		});
		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
\`\`\`

### Integration Tests

Named \`.integration.db.test.ts\`. Use \`create_test_app()\` from
\`$lib/testing/app_server.js\` for a full Hono app with middleware, routes, and
database:

\`\`\`typescript
const {app, create_session_headers, create_bearer_headers, create_account, cleanup} =
	await create_test_app({
		session_options: create_session_config('test_session'),
		create_route_specs: (ctx) => my_routes(ctx),
	});
\`\`\`

### PGlite WASM Caching

\`create_pglite_factory\` instances in the same worker share a single PGlite
WASM instance via module-level cache. Subsequent calls reset the schema
(\`DROP SCHEMA public CASCADE\`) instead of paying cold-start cost.

## Test Helpers

### Shared Helpers (\`@fuzdev/fuz_util/testing.js\`)

Cross-repo test assertions live in \`@fuzdev/fuz_util/testing.js\`. Only
depends on vitest — safe for fuz_util's zero-runtime-deps constraint.

\`\`\`typescript
import {assert_rejects, create_mock_logger} from '@fuzdev/fuz_util/testing.js';

// Async rejection — pattern is optional, returns Error
const err = await assert_rejects(() => do_thing(), /expected pattern/);

// Mock logger — vi.fn() methods + tracking arrays
const log = create_mock_logger();
do_thing(log);
assert.deepEqual(log.info_calls, ['expected message']);
\`\`\`

For \`Result\` assertions, use \`assert.ok(result.ok)\` directly — \`assert\`
narrows discriminated unions, so no wrapper is needed.

### Repo-Local Helpers

Most repos also have \`test_helpers.ts\` for domain-specific factories
(fuz_ui, fuz_css, gro, fuz_gitops). fuz_app's test infrastructure lives
in \`src/lib/testing/\` (library exports, not test helpers).

\`\`\`typescript
// src/test/test_helpers.ts — domain-specific example from gro
export const create_mock_task_context = <TArgs extends object = any>(
	args: Partial<TArgs> = {},
	config_overrides: Partial<GroConfig> = {},
	defaults?: TArgs,
): TaskContext<TArgs> => ({...});
\`\`\`

fuz_ui's \`test_helpers.ts\` also provides generic fixture infrastructure
(\`load_fixtures_generic\`, \`run_update_task\`) used by all fixture categories.

### Domain-Specific Helpers

\`{domain}_test_helpers.ts\` pattern:

| File                                  | Repo     | Purpose                                             |
| ------------------------------------- | -------- | --------------------------------------------------- |
| \`csp_test_helpers.ts\`                 | fuz_ui   | CSP test constants and source factories             |
| \`contextmenu_test_helpers.ts\`         | fuz_ui   | Contextmenu mounting and attachment setup           |
| \`module_test_helpers.ts\`              | fuz_ui   | Module analysis test options and program setup      |
| \`deep_equal_test_helpers.ts\`          | fuz_util | Bidirectional equality assertions and batch helpers |
| \`log_test_helpers.ts\`                 | fuz_util | Logger mock console with captured args              |
| \`random_test_helpers.ts\`              | fuz_util | Custom PRNG factories for distribution testing      |
| \`build_cache_test_helpers.ts\`         | gro      | Build cache mock factories                          |
| \`build_task_test_helpers.ts\`          | gro      | Build task context and mock plugins                 |
| \`deploy_task_test_helpers.ts\`         | gro      | Deploy task context and git mock setup              |
| \`css_class_extractor_test_helpers.ts\` | fuz_css  | Extractor assertion helpers                         |

Fixture-specific helpers live inside the fixture directory:

| File                                                                   | Repo   | Purpose                      |
| ---------------------------------------------------------------------- | ------ | ---------------------------- |
| \`fixtures/mdz/mdz_test_helpers.ts\`                                     | fuz_ui | mdz fixture loading          |
| \`fixtures/tsdoc/tsdoc_test_helpers.ts\`                                 | fuz_ui | tsdoc fixture loading        |
| \`fixtures/ts/ts_test_helpers.ts\`                                       | fuz_ui | TypeScript fixture loading   |
| \`fixtures/svelte/svelte_test_helpers.ts\`                               | fuz_ui | Svelte fixture loading       |
| \`fixtures/svelte_preprocess_mdz/svelte_preprocess_mdz_test_helpers.ts\` | fuz_ui | Preprocessor fixture loading |

### Svelte Component Test Helpers

fuz_ui's \`test_helpers.ts\` provides component lifecycle and DOM event
factories for jsdom tests:

\`\`\`typescript
// src/test/test_helpers.ts — from fuz_ui
import {mount, unmount, type Component} from 'svelte';

// Component lifecycle
export const mount_component = <TProps extends Record<string, any>>(
	Component: Component<TProps>,
	props: TProps,
): {instance: any; container: HTMLElement} => {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const instance = mount(Component, {target: container, props});
	return {instance, container};
};

export const unmount_component = async (instance: any, container: HTMLElement): Promise<void> => {
	await unmount(instance);
	container.remove();
};

// DOM event factories
export const create_contextmenu_event = (x: number, y: number, options?: MouseEventInit): MouseEvent => {...};
export const create_keyboard_event = (key: string, options?: KeyboardEventInit): KeyboardEvent => {...};
export const create_mouse_event = (type: string, options?: MouseEventInit): MouseEvent => {...};
export const create_touch_event = (type: string, touches: Array<{clientX: number; clientY: number}>, options?: TouchEventInit): TouchEvent => {...};
export const set_event_target = (event: Event, target: EventTarget): void => {...};

// Fixture utilities
export const normalize_json = (obj: any): any => {...};
export const load_fixtures_generic = async <T>(config: FixtureLoaderConfig<T>): Promise<Array<GenericFixture<T>>> => {...};
export const run_update_task = async <TInput, TOutput>(config: UpdateTaskConfig<TInput, TOutput>, log): Promise<{...}> => {...};
\`\`\`

## Shared Test Factories

When multiple components share behavior (e.g., \`ContextmenuRoot\` and
\`ContextmenuRootForSafariCompatibility\`), extract test logic into factory
modules exporting \`create_shared_*_tests()\`. Test files become thin wrappers:

\`\`\`typescript
// src/test/contextmenu_test_core.ts — factory module (NOT a test file)
export const create_shared_core_tests = (
	Component: any,
	component_name: string,
	options: SharedTestOptions = {},
): void => {
	describe(\`\${component_name} - Core Functionality\`, () => {
		// shared tests here
	});
};
\`\`\`

\`\`\`typescript
// src/test/ContextmenuRoot.core.test.ts — thin wrapper
// @vitest-environment jsdom
import {vi} from 'vitest';
import {create_shared_core_tests} from './contextmenu_test_core.js';
import ContextmenuRoot from '$lib/ContextmenuRoot.svelte';

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
create_shared_core_tests(ContextmenuRoot, 'ContextmenuRoot');
\`\`\`

\`\`\`typescript
// src/test/ContextmenuRootForSafariCompatibility.core.test.ts — same tests, different component
create_shared_core_tests(
	ContextmenuRootForSafariCompatibility,
	'ContextmenuRootForSafariCompatibility',
	{requires_longpress: true},
);
\`\`\`

fuz*ui uses this for contextmenu components with 8 factory modules
(\`contextmenu_test*{core,rendering,keyboard,nested,positioning,scoped,edge_cases,link_entries}.ts\`).

## Fixture-Based Testing

For parsers, analyzers, and transformers. Used in fuz_ui (mdz, tsdoc, ts,
svelte, svelte_preprocess_mdz) and private_svelte-docinfo.

### Directory Structure

Each fixture is a subdirectory with input and generated \`expected.json\`:

\`\`\`
src/test/fixtures/
├── update.task.ts              # parent: invokes all child update tasks
├── mdz/
│   ├── bold_simple/
│   │   ├── input.mdz           # test input
│   │   └── expected.json       # generated expected output
│   ├── heading/
│   │   ├── input.mdz
│   │   └── expected.json
│   ├── mdz_test_helpers.ts     # fixture-specific helpers
│   └── update.task.ts          # regeneration for this feature
├── tsdoc/
│   ├── comment_description_only/
│   │   ├── input.ts
│   │   └── expected.json
│   ├── tsdoc_test_helpers.ts
│   └── update.task.ts
└── svelte_preprocess_mdz/
    ├── bold_double_quoted/
    │   ├── input.svelte
    │   └── expected.json
    ├── svelte_preprocess_mdz_test_helpers.ts
    └── update.task.ts
\`\`\`

### Parent Update Task

\`\`\`typescript
// src/test/fixtures/update.task.ts — from fuz_ui
import type {Task} from '@fuzdev/gro';

export const task: Task = {
	summary: 'generate all fixture expected.json files',
	run: async ({invoke_task, log}) => {
		log.info('updating mdz fixtures...');
		await invoke_task('src/test/fixtures/mdz/update');

		log.info('updating tsdoc fixtures...');
		await invoke_task('src/test/fixtures/tsdoc/update');

		log.info('updating ts fixtures...');
		await invoke_task('src/test/fixtures/ts/update');

		log.info('updating svelte fixtures...');
		await invoke_task('src/test/fixtures/svelte/update');

		log.info('updating svelte_preprocess_mdz fixtures...');
		await invoke_task('src/test/fixtures/svelte_preprocess_mdz/update');

		log.info('all fixtures updated!');
	},
};
\`\`\`

Run all: \`gro src/test/fixtures/update\`
Run one: \`gro src/test/fixtures/mdz/update\`

### Child Update Task

Each feature's \`update.task.ts\` uses \`run_update_task\`:

\`\`\`typescript
// src/test/fixtures/mdz/update.task.ts — from fuz_ui
import type {Task} from '@fuzdev/gro';
import {join} from 'node:path';
import {mdz_parse} from '$lib/mdz.js';
import {run_update_task} from '../../test_helpers.js';

export const task: Task = {
	summary: 'generate expected.json files for mdz fixtures',
	run: async ({log}) => {
		await run_update_task(
			{
				fixtures_dir: join(import.meta.dirname),
				input_extension: '.mdz',
				process: (input) => mdz_parse(input),
			},
			log,
		);
	},
};
\`\`\`

### Fixture Test Pattern

\`\`\`typescript
// src/test/svelte_preprocess_mdz.fixtures.test.ts — from fuz_ui
import {test, assert, describe, beforeAll} from 'vitest';
import {
	load_fixtures,
	run_preprocess,
	DEFAULT_TEST_OPTIONS,
	type PreprocessMdzFixture,
} from './fixtures/svelte_preprocess_mdz/svelte_preprocess_mdz_test_helpers.js';

let fixtures: Array<PreprocessMdzFixture> = [];

beforeAll(async () => {
	fixtures = await load_fixtures();
});

describe('svelte_preprocess_mdz fixtures', () => {
	test('all fixtures transform correctly', async () => {
		for (const fixture of fixtures) {
			const result = await run_preprocess(
				fixture.input,
				DEFAULT_TEST_OPTIONS,
				\`\${fixture.name}.svelte\`,
			);
			assert.equal(result, fixture.expected.code, \`Fixture "\${fixture.name}" failed\`);
		}
	});
});
\`\`\`

**CRITICAL:** Never manually create or edit \`expected.json\`. Only create input
files and run the update task.

### Fixture Testing in fuz_gitops

Different fixture pattern: generated git repositories from fixture data files.
Fixtures define repos with dependencies, changesets, and expected outcomes.

- \`src/test/fixtures/repo_fixtures/*.ts\` — source of truth for test repo definitions
- \`src/test/fixtures/generate_repos.ts\` — idempotent repo generation logic
- \`src/test/fixtures/configs/*.config.ts\` — isolated gitops config per fixture
- \`src/test/fixtures/check.test.ts\` — validates command output against expectations
- \`src/test/fixtures/mock_operations.ts\` — configurable DI mocks (not vi.fn())

10 scenarios covering publishing, cascades, cycles, private packages, major
bumps, peer deps, and isolation. Repos auto-generated on first test run;
regenerate with \`gro src/test/fixtures/generate_repos\`.

## Mock Patterns

### Dependency Injection (Preferred)

DI via small \`*Deps\` or \`*Operations\` interfaces. Functions accept an
operations parameter with a default; tests inject controlled implementations.
See [dependency-injection.md](./dependency-injection) for the full pattern.

**fuz_gitops operations pattern:**

\`\`\`typescript
// src/lib/operations.ts — interfaces for all side effects
// each method uses options objects and returns Result
export interface GitOperations {
	current_branch_name: (options?: {
		cwd?: string;
	}) => Promise<Result<{value: string}, {message: string}>>;
	add_and_commit: (options: {
		files: string | Array<string>;
		message: string;
		cwd?: string;
	}) => Promise<Result<object, {message: string}>>;
	// ... ~15 more methods
}
export interface GitopsOperations {
	git: GitOperations;
	npm: NpmOperations;
	fs: FsOperations;
	// ...
}

// Production: multi_repo_publisher(repos, options, default_gitops_operations)
// Tests: multi_repo_publisher(repos, options, mock_operations)
\`\`\`

\`\`\`typescript
// src/test/test_helpers.ts — from fuz_gitops
// Granular factories per operations interface:
export const create_mock_git_ops = (): GitOperations => ({...});
export const create_mock_repo = (options: MockRepoOptions): LocalRepo => ({...});
export const create_mock_gitops_ops = (overrides?): GitopsOperations => ({...});

// src/test/fixtures/mock_operations.ts — configurable mocks for fixture tests
export const create_mock_git_ops = (): GitOperations => ({
	current_branch_name: async () => ({ok: true, value: 'main'}),
	// ... plain objects implementing interfaces, no vi.fn()
});
\`\`\`

fuz_gitops uses **zero vi.mock()** — all tests inject mock operations via DI.

**fuz_app deps pattern:**

\`\`\`typescript
import {stub_app_deps} from '$lib/testing/stubs.js';
import {create_mock_runtime} from '$lib/runtime/mock.js';

const deps = stub_app_deps; // throwing stubs for auth deps
const runtime = create_mock_runtime(); // MockRuntime for CLI tests
\`\`\`

### vi.mock() Usage

Used in gro and some fuz_app unit tests. Avoid in \`.db.test.ts\` where
\`isolate: false\` shares module state. When needed:

- gro: \`vi.clearAllMocks()\` in \`beforeEach\`, \`vi.resetAllMocks()\` in \`afterEach\`
- \`.db.test.ts\`: if unavoidable, use \`vi.restoreAllMocks()\` in \`afterEach\` —
  module-level mocks leak with \`isolate: false\`
- Prefer DI when possible

### Mock Factory Naming

\`create_mock_*()\` pattern:

\`\`\`typescript
// From gro/src/test/build_cache_test_helpers.ts
export const create_mock_build_cache_metadata = (
	overrides: Partial<BuildCacheMetadata> = {},
): BuildCacheMetadata => ({
	version: '1',
	git_commit: 'abc123',
	build_cache_config_hash: 'jkl012',
	timestamp: '2025-10-21T10:00:00.000Z',
	outputs: [],
	...overrides,
});

// From fuz_gitops/src/test/test_helpers.ts
export const create_mock_repo = (options: MockRepoOptions): LocalRepo => ({...});
\`\`\`

### Mock Call Assertions

Vitest creates precise tuple types for \`.mock.calls\`. Use \`as any\`:

\`\`\`typescript
const spy = vi.fn();
spy('hello', 42);

assert.deepEqual(spy.mock.calls[0], ['hello', 42] as any);
\`\`\`

## Environment Flags

\`\`\`typescript
// src/test/vite_plugin_examples.test.ts — from fuz_css
const SKIP = !!process.env.SKIP_EXAMPLE_TESTS;

describe.skipIf(SKIP)('vite plugin examples', () => {
	test('builds example project', async () => {
		// ... runs vite build on example projects
	});
});
\`\`\`

\`\`\`bash
SKIP_EXAMPLE_TESTS=1 gro test
\`\`\`

| Flag                 | Repo    | Purpose                                      |
| -------------------- | ------- | -------------------------------------------- |
| \`SKIP_EXAMPLE_TESTS\` | fuz_css | Skip slow Vite plugin integration tests      |
| \`TEST_DATABASE_URL\`  | fuz_app | Enable PostgreSQL tests (PGlite always runs) |

## Test Structure

### Basic Test Pattern

\`\`\`typescript
import {describe, test, assert} from 'vitest';
import {query_create_account} from '$lib/auth/account_queries.js';

describe('account queries', () => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const account = await query_create_account(
			{db},
			{
				username: 'alice',
				password_hash: 'hash123',
			},
		);

		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
\`\`\`

### Test Organization

Use \`describe\` blocks to organize tests. One level is common; two levels
(feature → scenario) is typical for larger modules. Use \`test()\` not \`it()\`.

\`\`\`typescript
// one level — most modules
describe('format_duration', () => {
	test('zero returns 0s', () => { ... });
	test('mixed units', () => { ... });
});

// two levels — larger modules with distinct behaviors
describe('local_repo_load', () => {
	describe('error propagation', () => {
		test('pull failure includes message', async () => { ... });
		test('checkout failure includes message', async () => { ... });
	});
	describe('skip behaviors', () => {
		test('local-only repos skip pull', async () => { ... });
	});
});
\`\`\`

Flat top-level \`test()\` calls without \`describe\` are fine for very small
files, but \`describe\` is the default.

### Parameterized Tests

Labeled tuple types for self-documenting test tables:

\`\`\`typescript
const duration_cases: Array<[label: string, input: number, expected: string]> = [
	['zero', 0, '0s'],
	['seconds', 1000, '1s'],
	['minutes', 60000, '1m'],
	['hours', 3600000, '1h'],
	['mixed', 3661000, '1h 1m 1s'],
];

describe('format_duration', () => {
	test.each(duration_cases)('%s', (_label, input, expected) => {
		assert.strictEqual(format_duration(input), expected);
	});
});
\`\`\`

For larger tables, extract as a typed constant. Use \`null\` for "missing" cases:

\`\`\`typescript
const cases: Array<[label: string, initial: string | null, key: string, expected: string]> = [
	['updates existing', 'KEY="old"', 'KEY', 'KEY="new"'],
	['creates if missing', null, 'KEY', 'KEY="new"'],
];

test.each(cases)('%s', async (_label, initial, key, expected) => {
	const fs = create_mock_fs(initial !== null ? {'.env': initial} : {});
	await update(key, 'new', fs);
	assert.strictEqual(fs.get('.env'), expected);
});
\`\`\`

Object array form with \`$prop\` interpolation:

\`\`\`typescript
const POSITION_CASES = [
	{position: 'left', align: 'start', expected: {right: '100%', top: '0px'}},
	{position: 'right', align: 'center', expected: {left: '100%', top: '50%'}},
];

test.each(POSITION_CASES)(
	'$position/$align applies correct styles',
	({position, align, expected}) => {
		const styles = generate_position_styles(position, align);
		for (const [prop, value] of Object.entries(expected)) {
			assert.strictEqual(styles[prop], value, \`style '\${prop}'\`);
		}
	},
);
\`\`\`

Tests with dynamic expected values or extra assertions should stay standalone.

### Composable Test Suites (fuz_app)

| Suite                                       | Groups | Purpose                                         |
| ------------------------------------------- | ------ | ----------------------------------------------- |
| \`describe_standard_attack_surface_tests\`    | 5      | Snapshot, structure, adversarial auth/input/404 |
| \`describe_standard_integration_tests\`       | 10     | Login, cookies, sessions, bearer, passwords     |
| \`describe_standard_admin_integration_tests\` | 7      | Accounts, permits, sessions, audit log          |
| \`describe_rate_limiting_tests\`              | 3      | IP, per-account, bearer rate limiting           |
| \`describe_round_trip_validation\`            | varies | Schema-driven positive-path validation          |
| \`describe_data_exposure_tests\`              | 6      | Schema-level + runtime field blocklists         |
| \`describe_standard_adversarial_headers\`     | 7      | Header injection cases                          |
| \`describe_standard_tests\`                   | -      | Convenience wrapper: integration + admin        |

Live in \`fuz_app/src/lib/testing/\` (library exports, not test files). Accept
configuration with \`session_options\` and \`create_route_specs\`.

### WebSocket Round-Trip Tests

WebSocket JSON-RPC endpoints are tested in-process via
\`@fuzdev/fuz_app/testing/ws_round_trip.js\` — no HTTP server, no Deno. The
harness drives the real \`register_action_ws\` dispatcher and
\`BackendWebsocketTransport\` against \`MockWsClient\` connections, so
per-action auth, input validation, \`ctx.notify\`, and broadcast fan-out
all run through the real code paths.

Convention (used in tx, zzz, undying.dealt.dev):

1. **All round-trip helpers live in fuz_app**
   (\`@fuzdev/fuz_app/testing/ws_round_trip.js\`):
   - \`create_ws_test_harness({specs, handlers, ...})\` → \`{transport,
     connect}\`. \`connect(identity?)\` is async and resolves after
     \`on_socket_open\` completes. Passes through \`register_action_ws\`
     options (\`on_socket_open\`, \`on_socket_close\`, \`extend_context\`,
     \`transport\`, \`log\`); share a \`BackendWebsocketTransport\` via the
     \`transport\` option to test cross-harness broadcast fan-out.
   - \`MockWsClient.request<R>(id, method, params, timeout?)\` — the
     default for request/response. Returns \`result\` on success; throws
     \`rpc #id failed: [code] message data=...\` on error frames.
   - \`client.send(message)\` + \`client.wait_for(predicate)\` — raw
     primitives. Use them to assert on an error frame directly (e.g.
     \`-32602\` + zod issues) or when the request never resolves
     (\`ctx.signal\` abort tests).
   - Predicates: \`is_notification(method)\`, \`is_response_for(id)\`, and
     \`is_notification_with<P>(method, (params) => boolean)\` — a type
     guard that narrows \`wait_for\` / \`messages.filter\` results without
     an explicit \`<T>\` at the call site.
   - Wire-frame types for narrowing: \`JsonrpcNotificationFrame<P>\`,
     \`JsonrpcSuccessResponseFrame<R>\`, \`JsonrpcErrorResponseFrame<D>\`.
   - \`build_broadcast_api<TApi>({harness, specs})\` — wires peer +
     transport + typed broadcast API, mirroring real backend assembly.
   - \`keeper_identity()\` — default identity for keeper-authed connections.

2. **Repo-local \`ws_test_harness.ts\` is only for project-specific
   setup** — not a re-implementation of the above. undying has one
   (memoized pglite+schema+seed+world_state init per worker, plus a
   \`make_client_tracker\` that closes tracked clients in \`afterEach\`
   because module-level world_state leaks between tests). tx and zzz
   have no repo-local harness at all — tests import directly from
   \`@fuzdev/fuz_app/testing/ws_round_trip.js\`.

3. **Split test files by aspect** (same as other test suites —
   see _Test File Naming_ above):
   - \`ws.integration.dispatch.test.ts\` — request/response, \`ctx.notify\`,
     per-action auth, input validation, \`ctx.signal\`, concurrent requests
   - \`ws.integration.broadcast.test.ts\` — \`create_broadcast_api\`
     fan-out, close-removes-from-transport

4. **DB-backed WS tests** (e.g. undying.dealt.dev) use the
   \`.db.test.ts\` suffix and memoize the harness per worker since
   \`isolate: false\` + \`fileParallelism: false\` means module-level state
   (world_state globals, embodiments map) would otherwise double-init.
   Non-DB WS tests (tx, zzz) build a fresh harness per test — setup
   is cheap and each test can supply its own ad-hoc specs + handlers.

## Quick Reference

| Pattern                           | Purpose                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| \`src/test/\`                       | All tests live here, not co-located                                |
| \`src/test/domain/\`                | Mirrors \`src/lib/domain/\` subdirectories                           |
| \`module.aspect.test.ts\`           | Split test suites by aspect                                        |
| \`module.db.test.ts\`               | DB test — shared WASM worker via vitest projects                   |
| \`module.fixtures.test.ts\`         | Fixture-based test file                                            |
| \`test_helpers.ts\`                 | General shared test utilities (most repos)                         |
| \`{domain}_test_helpers.ts\`        | Domain-specific test utilities                                     |
| \`{domain}_test_{aspect}.ts\`       | Shared test factory modules (not test files)                       |
| \`create_shared_*_tests()\`         | Factory function for reusable test suites                          |
| \`fixtures/feature/case/\`          | Subdirectory per fixture case                                      |
| \`fixtures/update.task.ts\`         | Parent: runs all child update tasks                                |
| \`fixtures/feature/update.task.ts\` | Child: regenerates one feature                                     |
| \`assert\` from vitest              | Ecosystem-wide standard                                            |
| \`assert.isDefined(x); x.prop\`     | Narrows to NonNullable — no \`x!\` needed                            |
| \`assert(x instanceof T); x.prop\`  | Narrows union types — the key advantage over \`expect\`              |
| \`assert.throws(fn, /regex/)\`      | Returns void; second arg: constructor/string/RegExp (not function) |
| \`assert_rejects(fn, /regex?/)\`    | Shared — async rejection, optional pattern, returns Error          |
| \`create_mock_logger()\`            | Shared — \`vi.fn()\` methods + tracking arrays                       |
| try/catch + \`assert.include\`      | For inspecting thrown errors when helper isn't enough              |
| \`assert_*\` (not \`expect_*\`)       | Custom assertion helper naming convention                          |
| \`describe\` + \`test\` (not \`it\`)    | Default structure; 1-2 levels of \`describe\` typical                |
| \`// @vitest-environment jsdom\`    | Pragma for UI tests needing DOM                                    |
| \`vi.stubGlobal('ResizeObserver')\` | Required in jsdom for components using ResizeObserver              |
| \`describe_db(name, fn)\`           | DB test wrapper (fuz_app)                                          |
| \`create_test_app()\`               | Full Hono app for integration tests (fuz_app)                      |
| \`create_ws_test_harness()\`        | In-process WS JSON-RPC harness (fuz_app); async \`connect()\`        |
| \`client.request(id, method, ...)\` | Send + await response; throws on error frame                       |
| \`build_broadcast_api({harness})\`  | Typed broadcast API wired to the harness transport (fuz_app)       |
| \`ws_test_harness.ts\` (repo-local) | Only for project-specific setup (memoized DB, client tracking)     |
| \`stub_app_deps\`                   | Throwing stub deps for unit tests (fuz_app)                        |
| DI via \`*Operations\`/\`*Deps\`      | Preferred over vi.mock() for side effects                          |
| \`create_mock_*()\`                 | Factory functions for test data                                    |
| \`SKIP_EXAMPLE_TESTS=1\`            | Skip slow fuz_css integration tests                                |
| \`TEST_DATABASE_URL\`               | Enable PostgreSQL tests alongside PGlite                           |
| Never edit \`expected.json\`        | Always regenerate via task                                         |
`},{slug:"tsdoc-comments",title:"TSDoc Comment Style Guide",content:`# TSDoc Comment Style Guide

JSDoc/TSDoc conventions for \`@fuzdev\` packages.

## Overview

Doc comments flow through a three-stage pipeline:

1. **fuz_ui analysis** — \`tsdoc_helpers.ts\`, \`ts_helpers.ts\`,
   \`svelte_helpers.ts\` extract JSDoc/TSDoc from the TypeScript AST into
   per-declaration metadata
2. **Gro gen tasks** — \`library.gen.ts\` emits \`library.json\` and
   \`library.ts\` with module and declaration metadata
3. **\`mdz\`** renders docs with auto-linking — backticked identifiers become
   clickable API-doc links

**Write standard JSDoc with the tags below, wrap identifier references in
backticks, and the system handles the rest.**

## Writing Good Documentation

### Prioritize "why" over "what"

Don't restate the function name. Explain why this exists and what problem it
solves.

\`\`\`typescript
// Weak — restates function name
/**
 * Predicts the next version for a repo based on its changesets.
 */

// Strong — explains purpose
/**
 * Predicts the next version by analyzing all changesets in a repo.
 *
 * Critical for dry-run mode accuracy — allows simulating publishes without
 * actually running \`gro publish\` which consumes changesets.
 *
 * @returns predicted version and bump type, or null if no changesets
 */
\`\`\`

### Document workflows with numbered steps

\`\`\`typescript
/**
 * Multi-repo publishing pipeline.
 *
 * Steps:
 * 1. **Sort** — \`compute_topological_order\` determines publish order
 * 2. **Changeset** — \`predict_next_version\` simulates version bumps
 * 3. **Publish** — \`publish_package\` publishes and waits for propagation
 * 4. **Update** — \`update_dependents\` bumps downstream version ranges
 *
 * @module
 */
\`\`\`

### Name algorithms and explain rationale

Name the algorithm so readers can look it up, and note rationale for
non-obvious parameter choices.

\`\`\`typescript
/**
 * Computes topological sort order for dependency graph.
 *
 * Uses Kahn's algorithm with alphabetical ordering within tiers for
 * deterministic results.
 *
 * @param exclude_dev - If true, excludes dev dependencies to break cycles.
 *   Publishing uses exclude_dev=true to handle circular dev deps.
 */
\`\`\`

### Explain system context

State the function's role in the larger system — what depends on it, what
it enables.

\`\`\`typescript
/**
 * Waits for package version to propagate to NPM registry.
 *
 * Critical for multi-repo publishing: ensures published packages are available
 * before updating dependent packages.
 */
\`\`\`

### When to document

Focus on:

- **Public API surfaces** — all exported functions consumers use
- **Complexity** — where the "why" isn't obvious
- **Side effects** — mutations, async operations, error conditions
- **Domain knowledge** — business rules, algorithms

Skip:

- Simple getters/setters with obvious behavior
- Internal helpers with clear names
- Code where TypeScript types provide sufficient documentation

### CLAUDE.md is a map; TSDoc is the detail

When a symbol has non-obvious semantics — wire shape, invariants, ordering
constraints, failure modes — the explanation belongs on the symbol's TSDoc
(or its return type's), not in downstream CLAUDE.md or architecture docs.
mdz renders TSDoc through the \`library.json\` pipeline, so the detail stays
one hop from the code and moves when the code moves.

CLAUDE.md entries should read as one-line pointers: symbol name plus a
short hook. If you're writing three sentences about what a function returns
or how it interacts with sibling symbols, that content belongs in source
TSDoc. The failure mode is drift: CLAUDE.md prose goes stale because it
lives far from the code it describes, while TSDoc on the same symbol often
stays current because it's visible during the edit.

## Tag Reference

### Main description

Complete sentences ending in a period. Separate summary from details with a
blank line:

\`\`\`typescript
/**
 * Formats a person's name in display order.
 *
 * Combines first and last names, handling edge cases like hyphenated or
 * compound surnames. See \`format_person_parts\` for splitting.
 */
\`\`\`

### \`@param\`

**Format:** \`@param name - description\`

- Hyphen separator (per TSDoc spec)
- **Single-sentence:** lowercase, no period
- **Multi-sentence:** capitalize, end with period
- Acronyms (CSS, HTML, URL) and proper names (Zod, Fisher-Yates) stay uppercase
- Wrap type/identifier references in backticks
- Must be in source parameter order
- Parser strips leading \`- \` for rendering

\`\`\`typescript
/**
 * Parses a semantic version string.
 * @param version_string - version to parse (format: "major.minor.patch")
 * @param allow_prerelease - allow versions with prerelease suffixes like "1.0.0-alpha"
 */
\`\`\`

Multi-sentence:

\`\`\`typescript
/**
 * Computes topological sort order for dependency graph.
 * @param exclude_dev - If true, excludes dev dependencies to break cycles.
 *   Publishing uses exclude_dev=true to handle circular dev deps.
 */
\`\`\`

### \`@returns\`

Use \`@returns\` (not \`@return\`). Same capitalization rules as \`@param\`.

\`\`\`typescript
/**
 * Gets the current time.
 * @returns the current \`Date\` in milliseconds since epoch
 */
\`\`\`

For async functions, describe what the \`Promise\` resolves to:

\`\`\`typescript
/**
 * Fetches user data from the API.
 * @returns user object with id, name, and email fields
 */
export async function fetch_user(id: string): Promise<User> {
	// ...
}
\`\`\`

### \`@throws\`

Three formats (all used):

- \`@throws ErrorType description\` — type as first word (most common)
- \`@throws {ErrorType} description\` — type in curly braces
- \`@throws description\` — no type

\`\`\`typescript
/**
 * @throws Error if task with given name doesn't exist
 */

/**
 * @throws {TaskError} if production cycles detected
 */

/**
 * @throws if timeout_ms is negative
 */
\`\`\`

### \`@example\`

Code must be in fenced code blocks for syntax highlighting — \`mdz\` renders
examples as markdown.

\`\`\`\`typescript
/**
 * Convert raw TSDoc \`@see\` content to mdz format for rendering.
 *
 * @param content - raw \`@see\` tag content in TSDoc format
 * @returns mdz-formatted string ready for \`Mdz\` component
 *
 * @example
 * \`\`\`typescript
 * tsdoc_see_to_mdz('{@link https://fuz.dev|API Docs}')
 * // → '[API Docs](https://fuz.dev)'
 *
 * tsdoc_see_to_mdz('{@link SomeType}')
 * // → '\`SomeType\`'
 * \`\`\`
 */
\`\`\`\`

Interface fields can have inline \`@example\` tags:

\`\`\`\`typescript
export interface ModuleSourceOptions {
	/**
	 * Source directory paths to include, relative to \`project_root\`.
	 *
	 * @example
	 * \`\`\`typescript
	 * ['src/lib'] // single source directory
	 * \`\`\`
	 * @example
	 * \`\`\`typescript
	 * ['src/lib', 'src/routes'] // multiple directories
	 * \`\`\`
	 */
	source_paths: Array<string>;
}
\`\`\`\`

#### Writing effective examples

Focus on giving the reader a clear mental model of how to use the API:

- Show the most common use case first — additional \`@example\` tags for variants
- Use \`// =>\` or \`// →\` comments to show return values inline
- For option objects, show the minimal required fields
- For type narrowing helpers, show the pattern that makes the types useful
- Constants and simple predicates don't need examples unless usage is non-obvious
- Keep examples complete enough to understand without reading the implementation

\`\`\`\`typescript
// Good — shows input and return value
/**
 * @example
 * \`\`\`ts
 * get_component_name('components/Button.svelte') // => 'Button'
 * \`\`\`
 */

// Good — shows the pattern that motivates the API
/**
 * @example
 * \`\`\`ts
 * if (is_kind(declaration, 'function')) {
 *   declaration.parameters; // narrowed to FunctionDeclarationJson
 *   declaration.return_type; // accessible after narrowing
 * }
 * \`\`\`
 */

// Good — shows minimal setup and the typical workflow
/**
 * @example
 * \`\`\`ts
 * const {modules, diagnostics} = await analyze_from_files({
 *   project_root: process.cwd(),
 * });
 * if (diagnostics.has_errors()) {
 *   for (const err of diagnostics.errors()) {
 *     console.error(format_diagnostic(err));
 *   }
 * }
 * \`\`\`
 */

// Weak — doesn't show what the function does or returns
/**
 * @example
 * \`\`\`ts
 * process_data(input);
 * \`\`\`
 */
\`\`\`\`

### \`@deprecated\`

Include migration guidance with backtick-linked replacement. Rarely used —
"no backwards compatibility" policy means deprecated code is usually deleted.

\`\`\`typescript
/**
 * Legacy way to process data.
 * @deprecated Use \`process_data_v2\` instead for better performance.
 */
\`\`\`

### \`@see\`

Three patterns:

**External URLs** — \`{@link}\` for display text, bare URL when self-explanatory:

\`\`\`typescript
/** @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event} */
/** @see {@link https://tools.ietf.org/html/rfc5322|RFC 5322} */
/** @see https://github.com/colinhacks/zod#brand */
\`\`\`

**Sibling modules** — module path relative to \`src/lib/\` for cross-references
within a package. See [Module path format](#module-path-format) for the exact
shape.

\`\`\`typescript
/**
 * Gro-specific library metadata generation.
 *
 * @see library_generate.ts for the generic generation entry point
 * @see library_pipeline.ts for pipeline helpers
 * @see library_output.ts for output file generation
 *
 * @module
 */
\`\`\`

For nested modules, use the full lib-relative path:

\`\`\`typescript
/** @see \`actions/composables.ts\` for the action set to spread here */
\`\`\`

**Identifiers** — wrap in backticks (not \`{@link}\`):

\`\`\`typescript
/** @see \`tsdoc_parse\` for the extraction step */
/** @see \`format_number\` in \`maths.ts\` for the underlying implementation. */
\`\`\`

### \`@since\`

Supported by the parser but not currently used. Use when versioning matters.

\`\`\`typescript
/**
 * Generates a UUID v4.
 * @since 1.5.0
 */
\`\`\`

### \`@default\`

Documents default values for interface fields and component props:

\`\`\`svelte
const {
	layout = 'centered',
	index = 0,
	content_selector = '.pane',
}: {
	/**
	 * @default 'centered'
	 */
	layout?: DialogLayout;
	/**
	 * Index 0 is under 1 is under 2 — the topmost dialog is last in the array.
	 * @default 0
	 */
	index?: number;
	/**
	 * If provided, prevents clicks that would close the dialog
	 * from bubbling past any elements matching this selector.
	 * @default '.pane'
	 */
	content_selector?: string | null;
} = $props();
\`\`\`

### \`@nodocs\` (non-standard)

Excludes from docs generation and flat namespace validation. Supported by
fuz_ui's \`tsdoc_helpers.ts\` and \`svelte-docinfo\`.

Use cases:

- **Gro task exports** — \`Args\` and \`task\` are build system internals (most
  common use)
- **Gen file exports** — \`gen\` function called by Gro
- **Flat namespace conflicts** — declarations that need to coexist

\`\`\`typescript
/** @nodocs */
export const Args = z.object({...});

/** @nodocs */
export const task: Task<typeof Args> = {...};
\`\`\`

Prefer renaming to \`domain_action\` patterns when possible. Use \`@nodocs\` only
when exclusion is the right solution.

**Never \`@nodocs\` a symbol that external consumers import and use directly.**
If it's part of the public API, rename one side of the collision instead —
hiding the primary surface from the flat namespace also hides it from
generated docs and tomes, which silently breaks downstream documentation.
See \`../SKILL.md\` §Flat Namespace for which side to rename.

### \`@mutates\` (non-standard)

Documents mutations to parameters or external state. Supported by fuz_ui's
\`tsdoc_helpers.ts\`.

Two formats:

- \`@mutates target - description\` — bare name with hyphen (most common)
- \`\` @mutates \`target\` \`\` — backtick-wrapped, no description (when obvious)

Same capitalization rules as \`@param\`. Only document mutations visible outside
the function — not internal locals, closure state, or \`this.x\` in methods.

\`\`\`typescript
/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array - the array to shuffle
 * @mutates array - randomly reorders elements in place
 */
export function shuffle<T>(array: T[]): T[] {
	// ...
}
\`\`\`

\`\`\`typescript
/**
 * Apply named middleware specs to a Hono app.
 *
 * @param app - the Hono app
 * @param specs - middleware specs to apply
 * @mutates \`app\`
 */
\`\`\`

### \`@module\`

Marks a module-level doc comment. Place at end of comment block. Works in
\`.ts\` files and \`.svelte\` components.

\`\`\`svelte
<script lang="ts">
	/**
	 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/alert/}
	 *
	 * @module
	 */
<\/script>
\`\`\`

### Tag order

1. Main description
2. \`@param\` (in source parameter order)
3. \`@returns\`
4. \`@mutates\`
5. \`@throws\`
6. \`@example\`
7. \`@deprecated\`
8. \`@see\`
9. \`@since\`
10. \`@default\`
11. \`@nodocs\`

\`@mutates\` goes after \`@returns\` (or after \`@param\` if no return), logically
adjacent to parameter and return documentation.

## Inter-linking with mdz

Backtick-wrapped identifiers auto-link to API docs.

### How it works

1. \`mdz\` parses backtick content as \`Code\` nodes
2. \`DocsLink.svelte\` resolves: \`library.declaration_by_name.get(ref)\` →
   \`library.module_by_path.get(ref)\` → plain \`<code>\` fallback
3. Matches render as clickable links to API docs

### Always link

**Wrap every mention of an exported identifier, module filename, or type name
in backticks.** Unmatched references fall through to plain \`<code>\`, so there's
no cost to wrapping defensively.

\`\`\`typescript
/**
 * Wraps \`LibraryJson\` with computed properties and provides the root
 * of the API documentation hierarchy: \`Library\` → \`Module\` → \`Declaration\`.
 *
 * @see \`module.svelte.ts\` for \`Module\` class
 * @see \`declaration.svelte.ts\` for \`Declaration\` class
 */
\`\`\`

What to wrap:

- exported function names: \`\` \`tsdoc_parse\` \`\`, \`\` \`shuffle\` \`\`
- type and interface names: \`\` \`ModuleJson\` \`\`, \`\` \`SourceFileInfo\` \`\`
- class names: \`\` \`Library\` \`\`, \`\` \`Declaration\` \`\`
- module paths: \`\` \`module_helpers.ts\` \`\`, \`\` \`actions/composables.ts\` \`\`,
  \`\` \`DocsLink.svelte\` \`\` — see [Module path format](#module-path-format)
- tag names in prose: \`\` \`@param\` \`\`, \`\` \`@returns\` \`\`
- enum and constant names

### Module path format

Module references must use the **canonical path** that \`Library.module_by_path\`
indexes — the \`src/lib/\`-relative path with the source extension. Anything
else falls through to plain \`<code>\` and the auto-link silently breaks.

\`\`\`typescript
// GOOD — lib-relative path with source extension
/** @see \`actions/composables.ts\` for the action set to spread here */
/** Wraps \`LibraryJson\`. @see \`module.svelte.ts\` for the \`Module\` class */

// BAD — relative \`./\` prefix doesn't match canonical paths
/** Spread \`composable_actions\` from \`./composables.js\` here */

// BAD — \`.js\` runtime extension doesn't match the indexed \`.ts\` source path
/** @see \`composables.js\` for the bundled action set */

// BAD — bare filename of a nested module ambiguous and won't resolve
/** @see \`composables.ts\` */ // breaks if the file is at actions/composables.ts
\`\`\`

Top-level files (e.g., \`src/lib/Alert.ts\`) match by bare filename
(\`\` \`Alert.ts\` \`\`). Nested files (e.g., \`src/lib/actions/composables.ts\`)
require the full sub-path (\`\` \`actions/composables.ts\` \`\`). When in doubt,
include the directory — the longer form always works.

The canonical format is documented on \`Module.path\` in \`module.svelte.ts\`
(fuz_ui).

### Internal paths

Paths starting with \`/\` after whitespace auto-link as internal navigation.

**Gotcha — API route lists**: \`/word\` patterns get auto-linked, including HTTP
routes. Bare paths create broken links that fail SvelteKit prerender:

\`\`\`typescript
// BAD — mdz auto-links /login as internal route, breaks prerender
/**
 * - POST /login
 * - GET /session
 */

// GOOD — backtick-wrapped renders as <code>, not <a>
/**
 * - \`POST /login\`
 * - \`GET /session\`
 */
\`\`\`

### Case sensitivity

References are case-sensitive. \`\` \`library\` \`\` will NOT match \`Library\`.

### \`{@link}\` vs backticks

Backticks for identifiers. \`{@link}\` for external URLs in \`@see\`:

\`\`\`typescript
// Preferred — backtick for identifier
/** See \`tsdoc_parse\` for the extraction step. */

// Avoid — {@link} for identifier
/** See {@link tsdoc_parse} for the extraction step. */

// Correct — {@link} for URL
/** @see {@link https://fuz.dev|Fuz documentation} */
\`\`\`

## Documentation Patterns

### Module-level documentation

Prioritize \`@module\` for modules with design rationale, pipeline stages, or
cross-references.

**Basic:**

\`\`\`typescript
/**
 * Module path and metadata helpers.
 *
 * Provides utilities for working with source module paths, file types,
 * and import relationships in the package generation system.
 *
 * @module
 */
\`\`\`

**Design sections** with \`##\` headings for complex modules:

\`\`\`typescript
/**
 * TSDoc/JSDoc parsing helpers using the TypeScript Compiler API.
 *
 * ## Design
 *
 * Pure extraction approach: extracts documentation as-is with minimal
 * transformation, preserving source intent. Works around TypeScript
 * Compiler API quirks where needed.
 *
 * ## Tag support
 *
 * Supports a subset of standard TSDoc tags:
 * \`@param\`, \`@returns\`, \`@throws\`, \`@example\`, \`@deprecated\`, \`@see\`,
 * \`@since\`, \`@nodocs\`.
 *
 * ## Behavioral notes
 *
 * Due to TS Compiler API limitations:
 * - \`@throws\` tags have \`{Type}\` stripped by TS API; fallback regex
 *   extracts first word as error type
 * - TS API strips URL protocols from \`@see\` tag text; we use
 *   \`getText()\` to preserve original format
 *
 * @module
 */
\`\`\`

**Pipeline stages** — combines numbered steps with \`@see\` cross-references
(see also the [Document workflows with numbered steps](#document-workflows-with-numbered-steps)
pattern above):

\`\`\`typescript
/**
 * Library metadata generation pipeline.
 *
 * Pipeline stages:
 * 1. **Collection** — \`library_collect_source_files\` gathers and filters
 * 2. **Analysis** — \`library_analyze_module\` extracts metadata
 * 3. **Validation** — \`library_find_duplicates\` checks flat namespace
 * 4. **Transformation** — \`library_merge_re_exports\` resolves re-exports
 * 5. **Output** — \`library_sort_modules\` prepares deterministic output
 *
 * @see library_generate.ts for the main generation entry point
 * @see library_analysis.ts for module-level analysis
 * @see library_output.ts for output file generation
 * @see library_gen.ts for Gro-specific integration
 *
 * @module
 */
\`\`\`

**Design philosophy:**

\`\`\`typescript
/**
 * mdz — minimal markdown dialect for Fuz documentation.
 *
 * ## Design philosophy
 *
 * - **False negatives over false positives**: When in doubt, treat as
 *   plain text.
 * - **One way to do things**: Single unambiguous syntax per feature.
 * - **Explicit over implicit**: Clear delimiters avoid ambiguity.
 * - **Simple over complete**: Prefer simple parsing rules.
 *
 * @module
 */
\`\`\`

### Functions

\`\`\`typescript
/**
 * Find duplicate declaration names across modules.
 *
 * Returns a \`Map\` of declaration names to their full metadata
 * (only includes duplicates). Callers decide how to handle duplicates
 * (throw, warn, ignore).
 *
 * @example
 * const duplicates = library_find_duplicates(source_json);
 * if (duplicates.size > 0) {
 *   for (const [name, occurrences] of duplicates) {
 *     console.error(\`"\${name}" found in:\`);
 *     for (const {declaration, module} of occurrences) {
 *       console.error(\`  - \${module}:\${declaration.source_line}\`);
 *     }
 *   }
 * }
 */
export const library_find_duplicates = (
	source_json: SourceJson,
): Map<string, Array<DuplicateInfo>> => {
	// ...
};
\`\`\`

### Classes

\`\`\`typescript
/**
 * Rich runtime representation of a library.
 *
 * Wraps \`LibraryJson\` with computed properties and provides the root
 * of the API documentation hierarchy: \`Library\` → \`Module\` → \`Declaration\`.
 *
 * @see \`module.svelte.ts\` for \`Module\` class
 * @see \`declaration.svelte.ts\` for \`Declaration\` class
 */
export class Library {
	/**
	 * URL path prefix for multi-package documentation sites.
	 * Prepended to \`/docs/api/\` paths in \`Module.url_api\` and
	 * \`Declaration.url_api\`. Default \`''\` preserves single-package behavior.
	 */
	readonly url_prefix: string;

	/**
	 * All modules as rich \`Module\` instances.
	 */
	modules = $derived(/* ... */);

	/**
	 * Search declarations by query string with multi-term AND logic.
	 */
	search_declarations(query: string): Array<Declaration> {
		// ...
	}
}
\`\`\`

### Interfaces

\`\`\`\`typescript
/**
 * File information for source analysis.
 *
 * Can be constructed from Gro's \`Disknode\` or from plain file system access.
 * This abstraction enables non-Gro usage while keeping Gro support via adapter.
 *
 * Note: \`content\` is required to keep analysis functions pure (no hidden I/O).
 */
export interface SourceFileInfo {
	/** Absolute path to the file. */
	id: string;
	/** File content (required - analysis functions don't read from disk). */
	content: string;
	/**
	 * Absolute file paths of modules this file imports (optional).
	 * Only include resolved local imports, not node_modules.
	 * Order should be declaration order in source for deterministic output.
	 */
	dependencies?: ReadonlyArray<string>;
	/**
	 * Absolute file paths of modules that import this file (optional).
	 * Only include resolved local imports, not node_modules.
	 */
	dependents?: ReadonlyArray<string>;
}
\`\`\`\`

\`\`\`\`typescript
export interface ModuleSourceOptions {
	/**
	 * Absolute path to the project root directory.
	 *
	 * All \`source_paths\` are relative to this.
	 *
	 * @example
	 * \`\`\`typescript
	 * '/home/user/my-project'
	 * \`\`\`
	 */
	project_root: string;
	/**
	 * Source directory paths to include, relative to \`project_root\`.
	 *
	 * @example
	 * \`\`\`typescript
	 * ['src/lib'] // single source directory
	 * \`\`\`
	 * @example
	 * \`\`\`typescript
	 * ['src/lib', 'src/routes'] // multiple directories
	 * \`\`\`
	 */
	source_paths: Array<string>;
}
\`\`\`\`

### Svelte components

Document props inline in the \`$props()\` type annotation:

\`\`\`svelte
<script lang="ts">
	const {
		container,
		layout = 'centered',
		index = 0,
		active = true,
		content_selector = '.pane',
		onclose,
		children,
	}: {
		container?: HTMLElement;
		/**
		 * @default 'centered'
		 */
		layout?: DialogLayout;
		/**
		 * Index 0 is under 1 is under 2 — the topmost dialog
		 * is last in the array.
		 * @default 0
		 */
		index?: number;
		/**
		 * @default true
		 */
		active?: boolean;
		/**
		 * If provided, prevents clicks that would close the dialog
		 * from bubbling past any elements matching this selector.
		 * @default '.pane'
		 */
		content_selector?: string | null;
		onclose?: () => void;
		children: Snippet<[close: (e?: Event) => void]>;
	} = $props();
<\/script>
\`\`\`

For obvious props with no default, a comment is optional. Focus on behavior,
constraints, and non-obvious defaults.

### Type aliases

\`\`\`typescript
/**
 * Analyzer type for source files.
 *
 * - \`'typescript'\` - TypeScript/JS files analyzed via TypeScript Compiler API
 * - \`'svelte'\` - Svelte components analyzed via svelte2tsx + TypeScript Compiler API
 */
export type AnalyzerType = 'typescript' | 'svelte';
\`\`\`

### Bullet items

Non-sentence bullets: lowercase, no trailing period:

\`\`\`md
- this is a bullet item describing something
- another item without a period
- complete sentences in bullets are fine too. They end with periods.
\`\`\`

## Auditing Coverage

\`\`\`bash
gro run skills/fuz-stack/scripts/generate_jsdoc_audit.ts
\`\`\`

Generates \`jsdoc_audit.md\` — a checklist of \`src/lib/\` files that contain
JSDoc, for reviewing and cleaning up existing comments. Files without JSDoc
are omitted.

### When to audit

- Pre-release — ensure public APIs are documented
- Post-refactoring — verify docs stayed in sync
- Code reviews — identify documentation gaps

### Correctness, not just coverage

**A wrong doc comment is worse than a missing one**: it looks authoritative,
so downstream readers trust it and propagate the mistake. Coverage
(presence) is one axis; correctness (currency) is the other, and usually
the failure mode. When refactoring a public API — changing signatures,
adding fields to return types, tightening error semantics, or renaming
constants — re-read the TSDoc on every touched symbol before shipping.

Common drift patterns to watch for:

- **Signature changed** — \`@param\` list no longer matches parameter order, or
  names refer to renamed arguments
- **Return shape widened** — new fields on a returned type go undocumented on
  the function that produces them
- **Error semantics tightened** — a thrown error class was replaced or a
  distinct \`error.data.reason\` was added, but \`@throws\` still names the old one
- **Cross-refs rotted** — \`@see some_helper.ts\` points at a file that was
  moved, merged, or deleted

## Ecosystem Conventions

Shared across \`@fuzdev\` packages (fuz_ui, fuz_css, fuz_util, fuz_app, gro).
All use \`domain_action\` naming, the same JSDoc tags, and generate docs through
fuz_ui analysis → \`library.json\` → \`mdz\` pipeline.
`},{slug:"type-utilities",title:"Type Utilities",content:`# Type Utilities

TypeScript type helpers in \`@fuzdev/fuz_util/types.js\` — nominal typing,
stricter standard utilities, and selective partial types.

## Nominal Typing

TypeScript uses structural typing — two types with the same shape are
interchangeable. Nominal typing adds invisible brands to distinguish them.

### Flavored (loose)

\`Flavored<TValue, TName>\` adds an optional invisible brand. Unflavored base
types are assignable without casting, but different flavors are incompatible:

\`\`\`typescript
// Implementation:
declare const FlavoredSymbol: unique symbol;
interface Flavor<T> {
  readonly [FlavoredSymbol]?: T;  // optional — base types still assignable
}
type Flavored<TValue, TName> = TValue & Flavor<TName>;
\`\`\`

\`\`\`typescript
type Email = Flavored<string, 'Email'>;
type Address = Flavored<string, 'Address'>;

const email1: Email = 'foo@bar.com';         // ok — plain string is fine
const email2: Email = 'foo' as Address;       // error — Address !== Email
\`\`\`

Primary nominal typing approach. Real uses in fuz_util:

\`\`\`typescript
// fuz_util/id.ts
export type Uuid = Flavored<string, 'Uuid'>;

// fuz_util/git.ts
export type GitOrigin = Flavored<string, 'GitOrigin'>;
export type GitBranch = Flavored<string, 'GitBranch'>;

// fuz_util/path.ts
export type PathId = Flavored<string, 'PathId'>;

// fuz_util/colors.ts
export type Hue = Flavored<number, 'Hue'>;           // [0, 1]
export type Saturation = Flavored<number, 'Saturation'>; // [0, 1]
export type Lightness = Flavored<number, 'Lightness'>; // [0, 1]
export type Red = Flavored<number, 'Red'>;             // [0, 255]
export type Green = Flavored<number, 'Green'>;         // [0, 255]
export type Blue = Flavored<number, 'Blue'>;           // [0, 255]

// fuz_util/url.ts
export type Url = Flavored<string, 'Url'>;
\`\`\`

Also: \`BlogPostId\` (fuz_blog), \`InputPath\` (gro), \`VocabName\`/\`ReorderableId\`
(zzz).

### Branded (strict)

\`Branded<TValue, TName>\` adds a required brand. Plain base types NOT
assignable — must cast:

\`\`\`typescript
// Implementation:
declare const BrandedSymbol: unique symbol;
interface Brand<T> {
  readonly [BrandedSymbol]: T;  // required — base types NOT assignable
}
type Branded<TValue, TName> = TValue & Brand<TName>;
\`\`\`

\`\`\`typescript
type PhoneNumber = Branded<string, 'PhoneNumber'>;

const phone1: PhoneNumber = '555-1234';                // error — must cast
const phone2: PhoneNumber = '555-1234' as PhoneNumber;  // ok
\`\`\`

Exported but unused in the ecosystem. In practice, use \`Flavored\` for
compile-time nominal typing and Zod \`.brand()\` for runtime-validated types.

### Choosing between them

| Type     | Base assignable? | Safety | Use when                           |
| -------- | ---------------- | ------ | ---------------------------------- |
| Flavored | Yes (no cast)    | Loose  | IDs, paths, ergonomic APIs         |
| Branded  | No (cast needed) | Strict | Validated data, security-sensitive |

### Zod \`.brand()\` — runtime-validated nominal types

For types needing runtime validation, Zod \`.brand()\` (distinct from fuz_util's
\`Branded\`):

\`\`\`typescript
// zzz/zod_helpers.ts
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// zzz/diskfile_types.ts
export const DiskfilePath = z
  .string()
  .refine((p) => is_path_absolute(p), {message: 'path must be absolute'})
  .brand('DiskfilePath');
export type DiskfilePath = z.infer<typeof DiskfilePath>;
\`\`\`

fuz_util's \`Uuid\` uses \`Flavored\` (no runtime validation); zzz's \`Uuid\` uses
Zod \`.brand()\` (with validation). Separate types.

See ./zod-schemas for full Zod schema conventions including branded types.

## Strict Utility Types

### OmitStrict

Stricter \`Omit\` — \`K\` must be an actual key of \`T\`:

\`\`\`typescript
type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
\`\`\`

Standard \`Omit\` accepts any string for \`K\` (typos compile silently).
\`OmitStrict\` catches them. Widely used in fuz_ui, fuz_app, zzz.

### PickUnion and KeyofUnion

Standard \`Pick\` and \`keyof\` don't distribute over unions. These do:

\`\`\`typescript
type KeyofUnion<T> = T extends unknown ? keyof T : never;
type PickUnion<T, K extends KeyofUnion<T>> = T extends unknown
  ? K & keyof T extends never ? never : Pick<T, K & keyof T>
  : never;
\`\`\`

\`\`\`typescript
type A = {x: number; y: string};
type B = {x: number; z: boolean};

type Keys = KeyofUnion<A | B>;        // 'x' | 'y' | 'z'
type Picked = PickUnion<A | B, 'x'>;  // {x: number} | {x: number}
\`\`\`

## Partial Variants

### PartialExcept

Everything optional EXCEPT specified keys:

\`\`\`typescript
type PartialExcept<T, K extends keyof T> = {[P in K]: T[P]} & {
  [P in Exclude<keyof T, K>]?: T[P];
};
\`\`\`

\`\`\`typescript
interface User { id: string; name: string; email: string; }
type UserUpdate = PartialExcept<User, 'id'>;
// { id: string; name?: string; email?: string; }
\`\`\`

### PartialOnly

Only specified keys optional:

\`\`\`typescript
type PartialOnly<T, K extends keyof T> = {[P in K]?: T[P]} & {
  [P in Exclude<keyof T, K>]: T[P];
};
\`\`\`

### PartialValues

Values of \`T\` become partial (not the keys):

\`\`\`typescript
type PartialValues<T> = { [P in keyof T]: Partial<T[P]> };
\`\`\`

## Modifier Types

### Assignable

Removes \`readonly\`:

\`\`\`typescript
type Assignable<T, K extends keyof T = keyof T> = { -readonly [P in K]: T[P] };
\`\`\`

Used in zzz for self-referential initialization:

\`\`\`typescript
// zzz/frontend.svelte.ts
(this as Assignable<typeof this, 'app'>).app = this;
\`\`\`

## Extraction Types

### ClassConstructor

\`\`\`typescript
type ClassConstructor<TInstance, TArgs extends Array<any> = Array<any>> =
  new (...args: TArgs) => TInstance;
\`\`\`

Used in zzz Cell registry:

\`\`\`typescript
// zzz/cell_registry.svelte.ts
readonly #constructors: Map<string, ClassConstructor<Cell>> = new Map();
\`\`\`

### ArrayElement

\`\`\`typescript
type ArrayElement<T> = T extends ReadonlyArray<infer U> ? U : never;
\`\`\`

\`\`\`typescript
type Item = ArrayElement<Array<{id: string}>>;  // {id: string}
\`\`\`

### Defined and NotNull

\`\`\`typescript
type Defined<T> = T extends undefined ? never : T;
type NotNull<T> = T extends null ? never : T;
\`\`\`

## Quick Reference

| Type              | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| \`Flavored<TValue, TName>\` | Loose nominal typing (no cast from base) |
| \`Branded<TValue, TName>\`  | Strict nominal typing (cast required, ecosystem uses Zod \`.brand()\` instead) |
| \`OmitStrict<T, K>\`| Omit with key validation                        |
| \`PickUnion<T, K>\` | Pick that distributes over unions               |
| \`KeyofUnion<T>\`   | keyof that distributes over unions              |
| \`PartialExcept\`   | All optional except specified keys              |
| \`PartialOnly\`     | Only specified keys optional                    |
| \`PartialValues\`   | Values of T become partial                      |
| \`Assignable\`      | Remove readonly                                 |
| \`ClassConstructor\`| Match constructor functions                     |
| \`ArrayElement\`    | Extract element type from array                 |
| \`Defined\`         | Exclude undefined                               |
| \`NotNull\`         | Exclude null                                    |
`},{slug:"wasm-patterns",title:"WASM Patterns for the Fuz Ecosystem",content:`# WASM Patterns for the Fuz Ecosystem

**Applies to**: \`blake3\` (WASM hashing), \`tsv\` (parser/formatter bindings).
\`fuz\` does not currently use WASM.

## Two Build Targets

| Approach       | Tool           | Consumer            | Use case                        |
| -------------- | -------------- | -------------------- | ------------------------------- |
| wasm-bindgen   | \`wasm-pack\`    | JS runtimes          | Ship Rust to Deno/Node/browsers |
| Component model | \`cargo-component\` | Wasmtime / plugins | Sandboxed execution, composition |

**wasm-bindgen**: generates glue code, handles memory management, produces
\`.wasm\` + \`.js\` ready to import.

**Component model**: capability-controlled execution. Components declare
imports/exports via WIT interfaces for sandboxing and composition.

### When to use which

- **Publishing to JSR/npm**: wasm-bindgen
- **Benchmarking across runtimes**: both
- **Plugin systems** (speculative): component model

## WIT Interface Design

### Package naming

\`\`\`wit
package fuzdev:blake3@0.0.1;
\`\`\`

Format: \`<namespace>:<name>@<version>\`. Use \`fuzdev\` namespace.

### Kebab-case identifiers

WIT **requires** kebab-case (rejects snake_case/camelCase). Binding generators
convert to idiomatic casing per language.

### World and interface structure

From \`blake3/wit/blake3.wit\`:

\`\`\`wit
interface hashing {
    enum hash-error {
        invalid-key-length,
    }

    hash: func(data: list<u8>) -> list<u8>;
    keyed-hash: func(key: list<u8>, data: list<u8>) -> result<list<u8>, hash-error>;
    derive-key: func(context: string, key-material: list<u8>) -> list<u8>;

    resource hasher {
        constructor();
        new-keyed: static func(key: list<u8>) -> result<hasher, hash-error>;
        new-derive-key: static func(context: string) -> hasher;
        update: func(data: list<u8>);
        finalize: func() -> list<u8>;
        finalize-and-reset: func() -> list<u8>;
        reset: func();
    }
}

world blake3 {
    export hashing;
}
\`\`\`

### Design principles

- **One-shot functions** for stateless operations
- **Resources** for stateful streaming (\`hasher\` holds state across
  \`update\`/\`finalize\`)
- **\`result<T, E>\`** with typed error enums (not strings) for fallible ops
- **Minimal error enums** — one variant per distinct failure mode
- **Worlds declare capabilities** — \`export hashing\` with no imports = pure
  computation

## Component Implementation (wit-bindgen)

From \`blake3/crates/blake3_component/src/lib.rs\`:

\`\`\`rust
use std::cell::RefCell;
use exports::fuzdev::blake3::hashing;

wit_bindgen::generate!({
    path: "../../wit",
    world: "blake3",
});

struct Component;

export!(Component);

impl hashing::Guest for Component {
    type Hasher = HasherResource;

    fn hash(data: Vec<u8>) -> Vec<u8> {
        blake3::hash(&data).as_bytes().to_vec()
    }

    fn keyed_hash(key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(blake3::keyed_hash(&key, &data).as_bytes().to_vec())
    }

    fn derive_key(context: String, key_material: Vec<u8>) -> Vec<u8> {
        blake3::derive_key(&context, &key_material).to_vec()
    }
}

struct HasherResource {
    inner: RefCell<blake3::Hasher>,
}

impl hashing::GuestHasher for HasherResource {
    fn new() -> Self {
        Self { inner: RefCell::new(blake3::Hasher::new()) }
    }

    fn new_keyed(key: Vec<u8>) -> Result<hashing::Hasher, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(hashing::Hasher::new(HasherResource {
            inner: RefCell::new(blake3::Hasher::new_keyed(&key)),
        }))
    }

    fn new_derive_key(context: String) -> hashing::Hasher {
        hashing::Hasher::new(HasherResource {
            inner: RefCell::new(blake3::Hasher::new_derive_key(&context)),
        })
    }

    fn update(&self, data: Vec<u8>) {
        self.inner.borrow_mut().update(&data);
    }

    fn finalize(&self) -> Vec<u8> {
        self.inner.borrow().finalize().as_bytes().to_vec()
    }

    fn finalize_and_reset(&self) -> Vec<u8> {
        let mut inner = self.inner.borrow_mut();
        let result = inner.finalize().as_bytes().to_vec();
        inner.reset();
        result
    }

    fn reset(&self) {
        self.inner.borrow_mut().reset();
    }
}
\`\`\`

### Key patterns

- **\`wit_bindgen::generate!\`** generates bindings at compile time from WIT
- **Struct + \`export!\`** — unit struct implements \`Guest\` trait
- **\`RefCell\` for resource state** — resources receive \`&self\`, need interior
  mutability
- **Static factories return \`hashing::Hasher\`** wrapping the resource struct
- **Cannot use \`lints.workspace = true\`** — \`wit-bindgen\` generates
  \`#[export_name]\` and unsafe ABI stubs. Must override \`unsafe_code = "allow"\`.

### Cargo.toml for component crates

\`\`\`toml
[lib]
crate-type = ["cdylib"]

[dependencies]
blake3 = { workspace = true, features = ["wasm32_simd"] }
wit-bindgen.workspace = true

# Cannot use \`lints.workspace = true\` because wit-bindgen generates unsafe stubs
[lints.rust]
unsafe_code = "allow"

[package.metadata.component]
package = "fuzdev:blake3"

[package.metadata.component.target]
world = "blake3"
path = "../../wit"
\`\`\`

\`[package.metadata.component.target]\` is a sub-table — \`world\` and \`path\` go
under \`target\`, not under \`component\`.

### Build

\`\`\`bash
RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128' \\
    cargo component build -p blake3_component --release
\`\`\`

Requires \`cargo-component\` and \`wasm32-wasip1\` target.

## Host-Side Embedding (wasmtime)

\`\`\`rust
wasmtime::component::bindgen!({
    path: "../../wit",
    world: "blake3",
});

struct HostState {
    ctx: WasiCtx,
    table: ResourceTable,
}

impl WasiView for HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView { ctx: &mut self.ctx, table: &mut self.table }
    }
}

// Setup
let engine = wasmtime::Engine::new(
    wasmtime::Config::new().wasm_component_model(true)
)?;

let mut linker = wasmtime::component::Linker::new(&engine);
wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;

let component = wasmtime::component::Component::from_file(&engine, wasm_path)?;
let mut store = wasmtime::Store::new(&engine, HostState { ctx, table });

// Instantiate and call
let instance = Blake3::instantiate(&mut store, &component, &linker)?;
let hashing = instance.fuzdev_blake3_hashing();
let digest = hashing.call_hash(&mut store, data)?;
\`\`\`

### Resource lifecycle on the host

\`\`\`rust
let hasher = hashing.hasher().call_constructor(&mut store)?;

hashing.hasher().call_update(&mut store, hasher, chunk)?;
let result = hashing.hasher().call_finalize(&mut store, hasher)?;

// Drop resource — required to free guest memory
hasher.resource_drop(&mut store)?;
\`\`\`

Resources must be explicitly dropped. Host owns the handle; guest owns memory.

## wasm-bindgen Patterns

### Crate architecture (blake3)

Shared core crate with thin wrappers:

| Crate              | Type    | Purpose                                |
| ------------------ | ------- | -------------------------------------- |
| \`blake3_wasm_core\` | \`rlib\`  | Shared wasm-bindgen exports + TS types |
| \`blake3_wasm\`      | \`cdylib + rlib\` | SIMD build (enables \`blake3/wasm32_simd\`)  |
| \`blake3_wasm_small\`| \`cdylib + rlib\` | Size-optimized build (no SIMD)             |

Both wrappers contain only \`pub use blake3_wasm_core::*;\`.

### Rust side

\`\`\`rust
#[wasm_bindgen]
pub fn hash(data: &[u8]) -> Vec<u8> {
    blake3::hash(data).as_bytes().to_vec()
}

#[wasm_bindgen]
pub fn keyed_hash(key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsError> {
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
    Ok(blake3::keyed_hash(&key, data).as_bytes().to_vec())
}

#[wasm_bindgen]
pub struct Blake3Hasher { inner: blake3::Hasher }

#[wasm_bindgen]
impl Blake3Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { Self { inner: blake3::Hasher::new() } }

    pub fn new_keyed(key: &[u8]) -> Result<Blake3Hasher, JsError> { /* ... */ }
    pub fn new_derive_key(context: &str) -> Self { /* ... */ }
    pub fn update(&mut self, data: &[u8]) { self.inner.update(data); }
    pub fn finalize(&self) -> Vec<u8> { self.inner.finalize().as_bytes().to_vec() }
    pub fn finalize_and_reset(&mut self) -> Vec<u8> { /* finalize + reset in one call */ }
    pub fn reset(&mut self) { self.inner.reset(); }
}
\`\`\`

**Differences from component model**:

- \`&[u8]\` and \`&mut self\` — wasm-bindgen handles borrowing. No \`RefCell\`.
- \`JsError\` for errors — string messages, not typed enums
- \`free()\` and \`Symbol.dispose\` generated by wasm-bindgen automatically

### tsv wasm-bindgen patterns

Uses \`serde-wasm-bindgen\` for complex return types (ASTs):

\`\`\`rust
#[wasm_bindgen]
pub fn parse_svelte(source: &str) -> Result<JsValue, JsError> {
    let ast = tsv_svelte::parse(source).map_err(|e| JsError::new(&e.to_string()))?;
    let public = tsv_svelte::convert_ast(&ast, source);
    serde_wasm_bindgen::to_value(&public)
        .map_err(|e| JsError::new(&e.to_string()))
}
\`\`\`

\`serde_wasm_bindgen::to_value()\` converts serde types directly to \`JsValue\` —
more efficient than JSON strings. Also provides \`parse_internal_*()\` benchmarks
that skip serialization via \`std::hint::black_box()\`.

### TypeScript entry points

Re-export from wasm-pack's \`pkg/\` output and add stream functions:

\`\`\`typescript
import { Blake3Hasher, derive_key, hash, keyed_hash } from './pkg/deno/blake3_wasm.js';
export { Blake3Hasher, derive_key, hash, keyed_hash };
export type { Blake3HasherInstance } from './types.ts';
export type { StreamFunctions } from './stream.ts';

import { make_stream_functions } from './stream.ts';
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(
    Blake3Hasher,
);
\`\`\`

Node entry uses synchronous initialization:

\`\`\`typescript
import { readFileSync } from 'node:fs';
import { Blake3Hasher, derive_key, hash, initSync, keyed_hash } from './pkg/web/blake3_wasm.js';

const wasm = readFileSync(new URL('./pkg/web/blake3_wasm_bg.wasm', import.meta.url));
initSync({ module: wasm });
\`\`\`

### npm package structure

\`scripts/patch_npm_package.ts\` generates:

- \`index.js\` — Node.js: auto-init via \`readFileSync\` + \`initSync\`
- \`browser.js\` — Browser: async \`init()\`, exports guarded with \`_check()\`
- \`stream.js\` — Stream functions
- \`index.d.ts\` — Type declarations

Package exports use \`"node"\` / \`"default"\` conditions.

### Symbol.dispose usage

\`\`\`typescript
using hasher = new Blake3Hasher();
hasher.update(data);
const digest = hasher.finalize();
// hasher.free() called automatically at scope exit
\`\`\`

### Shared TypeScript interfaces

\`\`\`typescript
export interface Blake3HasherInstance {
    update(data: Uint8Array): void;
    finalize(): Uint8Array;
    finalize_and_reset(): Uint8Array;
    reset(): void;
    free(): void;
    [Symbol.dispose](): void;
}

export interface Blake3HasherConstructor {
    new (): Blake3HasherInstance;
    new_keyed(key: Uint8Array): Blake3HasherInstance;
    new_derive_key(context: string): Blake3HasherInstance;
}
\`\`\`

### Stream convenience functions

16 KB batch size to reduce WASM boundary crossings:

\`\`\`typescript
const digest = await hash_stream(file.stream());
const keyed = await keyed_hash_stream(key, file.stream());
const derived = await derive_key_stream('context', file.stream());
\`\`\`

Built via \`make_stream_functions(Blake3Hasher)\`. Browser entry passes
\`_check\` callback to guard against uninitialized WASM.

### Consumer API (fuz_util)

\`@fuzdev/fuz_util/hash_blake3.ts\` wraps blake3_wasm:

\`\`\`typescript
import { hash, init } from '@fuzdev/blake3_wasm';

export const blake3_ready = init(); // Eagerly start WASM initialization
export const hash_blake3 = (data: BufferSource | string): string =>
    to_hex(hash(to_bytes(data)));
\`\`\`

Returns 64-character hex strings. \`blake3_ready\` resolves immediately in
Node.js/Deno (sync init), must be awaited in browsers.

### Cargo.toml for wasm-bindgen crates

blake3_wasm:

\`\`\`toml
[lib]
crate-type = ["cdylib", "rlib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-O3", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core", features = ["simd"] }
wasm-bindgen.workspace = true
\`\`\`

blake3_wasm_small:

\`\`\`toml
[lib]
crate-type = ["cdylib", "rlib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Os", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core" }  # no simd feature
wasm-bindgen.workspace = true
\`\`\`

tsv_wasm:

\`\`\`toml
[lib]
crate-type = ["cdylib", "rlib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = false  # Disabled until wasm-opt supports Rust 2024's bulk memory

[dependencies]
wasm-bindgen = "0.2"
serde-wasm-bindgen = "0.6"
\`\`\`

## Multiple Binding Crates (tsv pattern)

| Crate      | Technology     | Target              | Error type           |
| ---------- | -------------- | -------------------- | -------------------- |
| \`tsv_wasm\` | wasm-bindgen   | Deno, browsers, Node | \`Result<T, JsError>\` |
| \`tsv_napi\` | napi-rs        | Node.js, Bun         | \`napi::Result<T>\`    |
| \`tsv_ffi\`  | C ABI          | Deno FFI, Python     | JSON error objects    |

All export identical signatures. Consumers choose by runtime.

- \`parse_internal_*()\` benchmarks skip serialization via \`black_box()\`
- N-API requires \`unsafe_code = "allow"\`
- FFI uses raw pointers with \`tsv_free(ptr, len)\` for memory management

## Two Packages, Not Two Profiles

blake3 ships two npm packages from different crates:

| Package                     | Crate              | RUSTFLAGS                                | wasm-opt   | Size    |
| --------------------------- | ------------------ | ---------------------------------------- | ---------- | ------- |
| \`@fuzdev/blake3_wasm\`       | \`blake3_wasm\`      | \`-C opt-level=3 -C target-feature=+simd128\` | \`-O3 --enable-simd\` | ~47 KB |
| \`@fuzdev/blake3_wasm_small\` | \`blake3_wasm_small\` | \`-C opt-level=s\`                         | \`-Os\`      | ~32 KB |

SIMD build: ~2.6x faster at large inputs (Deno/Node), slower on Bun (WASM
SIMD regression). Small build for Bun and bundle-size-sensitive contexts.

### Build commands

\`\`\`bash
# SIMD build
RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128' \\
    wasm-pack build crates/blake3_wasm --scope fuzdev --target deno --release --out-dir pkg/deno

# Size-optimized build
RUSTFLAGS='-C opt-level=s' \\
    wasm-pack build crates/blake3_wasm_small --scope fuzdev --target deno --release --out-dir pkg/deno
\`\`\`

**Why RUSTFLAGS**: \`wasm-pack\` doesn't support \`--profile\` (conflicts with
\`--release\`). RUSTFLAGS overrides at the compiler level.

Build pipeline runs both packages in parallel; deno and web targets sequential
within each (shared cargo intermediate artifacts).

### Release profile

\`\`\`toml
[profile.release]
opt-level = "s"      # Base: size-optimized (overridden by RUSTFLAGS)
lto = true
codegen-units = 1
panic = "abort"
strip = true
\`\`\`

### wasm-opt

Per-crate with explicit feature flags. Rust 2024 enables bulk memory for
\`wasm32-unknown-unknown\`, so wasm-opt must know:

\`\`\`toml
# blake3_wasm — speed-optimized, SIMD
wasm-opt = ["-O3", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

# blake3_wasm_small — size-optimized, no SIMD
wasm-opt = ["-Os", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]
\`\`\`

Without \`--enable-*\` flags, wasm-opt fails with "Bulk memory operations
require bulk memory". \`--strip-producers\` removes compiler metadata (~26 bytes).

### deno compile compatibility

wasm-bindgen's deno target uses \`fetch()\` to load WASM, incompatible with
\`deno compile\`. Build pipeline patches generated JS to use
\`Deno.readFileSync\`, creates \`_bg.js\` stub for module resolution.

## Cross-References

| Resource                         | Link                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Blake3 WASM bindings             | [fuzdev/blake3](https://github.com/fuzdev/blake3)                               |
| tsv WASM bindings                | \`private_tsv/crates/tsv_wasm/\`                                                  |
| Component model spec — WIT       | [WebAssembly/component-model WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md) |
| Component model spec — Explainer | [WebAssembly/component-model Explainer](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md) |
| Rust patterns (WASM errors)      | \`references/rust-patterns.md\`                                                   |
`},{slug:"zod-schemas",title:"Zod Schemas",content:`# Zod Schemas

Zod schema conventions for \`@fuzdev\` TypeScript/Svelte projects.

## Schema-First Design

Zod schemas are source of truth for JSON shape, TypeScript type (\`z.infer\`),
defaults, metadata, CLI help text, and serialization.

- **\`.meta({description})\`** — introspectable metadata for CLI help and runtime
  reflection
- **Runtime-inspectable** — walkable (\`zod_to_schema_properties\`), exportable
  as JSON Schema (\`z.toJSONSchema\`)
- **JSON-native** — branded strings for timestamps (\`Datetime\`), IDs (\`Uuid\`),
  paths (\`FilePath\`) eliminate serialization friction
- **Composition cascades** — \`.extend()\` for hierarchies, \`.brand()\` for
  domain safety, \`.default()\` for partial construction

### Schema helpers by layer

| Layer | Module | Capabilities |
|---|---|---|
| Foundation | \`@fuzdev/fuz_util/zod.ts\` | Schema introspection — extract descriptions, defaults, aliases, types, properties; unwrap wrappers (\`zod_get_innermost_type\`, \`zod_unwrap_to_object\`); object-field helpers (\`zod_get_schema_keys\`, \`zod_get_field_schema\`, \`zod_maybe_get_field_schema\`); check optional/nullable/default; format values for display |
| Foundation | \`@fuzdev/fuz_util/uuid.ts\`, \`@fuzdev/fuz_util/datetime.ts\` | \`Uuid\`, \`Datetime\` branded types and factories (\`create_uuid\`, \`get_datetime_now\`, \`UuidWithDefault\`, \`DatetimeNow\`) |
| Cell helpers | \`@fuzdev/zzz/zod_helpers.ts\` | Re-exports \`Uuid\`/\`Datetime\` from fuz_util; \`TypeLiteral\` and path-transform schemas (\`PathWithTrailingSlash\`, etc.); \`SvelteMapSchema\`; validation error formatting |
| CLI | \`@fuzdev/fuz_app/cli/args.ts\`, \`help.ts\` | Schema-validated CLI arg parsing; schema-driven help text generation |
| HTTP | \`@fuzdev/fuz_app/http/schema_helpers.ts\` | \`schema_to_surface()\` exports JSON Schema via \`z.toJSONSchema()\` for snapshot-testable API surfaces; \`instanceof\` checks for schema type detection |
| Testing | \`@fuzdev/fuz_app/testing/schema_generators.ts\` | Schema-driven test data generation — valid bodies, adversarial inputs |

## Core Conventions

1. **\`z.strictObject()\`** — default for all object schemas, including inside
   \`z.discriminatedUnion()\` and \`z.union()\`. Rejects unknown keys.
   **Exceptions**: external data (\`z.looseObject()\` or \`z.object()\` with
   comment explaining why); response/error schemas consumed by clients
   (\`z.looseObject()\` — allows adding fields without breaking consumers);
   protocol schemas where the other side may add fields per spec (e.g.,
   JSON-RPC messages).
2. **PascalCase naming** — schema and inferred type share the same name.
3. **\`.meta({description: '...'})\`** — not \`.describe()\`. \`.meta()\` supports
   additional keys (\`aliases\`, \`sensitivity\`).
4. **\`safeParse\` at boundaries** — graceful errors for external input (HTTP
   requests, API responses). \`parse\` for internal assertions, CLI args, and
   factory functions where failure is fatal. \`safeParse\` + custom throw when
   you need better error context than \`parse\` provides (e.g., env loading).
   \`safeParse\` + return null for optional config files that may be absent.

### The Canonical Pattern

\`\`\`typescript
import {z} from 'zod';

export const MyThing = z.strictObject({
	name: z.string().min(1),
	count: z.number().int().default(0),
	kind: z.enum(['a', 'b']),
});
export type MyThing = z.infer<typeof MyThing>;
\`\`\`

The \`const\` and \`type\` share the same name — TypeScript resolves from context.

### Wrong Patterns

\`\`\`typescript
// WRONG: z.object for internal types — allows unknown keys silently
const Foo = z.object({name: z.string()});

// WRONG: z.object inside discriminated union — same rule applies
const Action = z.discriminatedUnion('type', [
	z.object({type: z.literal('a'), value: z.string()}),
]);

// OK: z.looseObject for external data — source adds fields without notice
// z.looseObject: parses external package.json (npm adds fields)
const PackageJson = z.looseObject({name: z.string(), version: z.string()});

// OK: z.object for external API responses — same reason
// z.object: parses external GitHub API responses
const GithubPullRequest = z.object({number: z.number(), title: z.string()});

// OK: z.looseObject for response/error schemas — clients tolerate additions
// z.looseObject: error responses may carry extra context fields
const ApiError = z.looseObject({error: z.string()});
const TableListOutput = z.looseObject({tables: z.array(z.strictObject({name: z.string()}))});

// WRONG: .describe() — works but not the convention
const Bar = z.string().describe('a bar');

// WRONG: snake_case schema name or -Schema suffix
const my_thing = z.strictObject({...});
const MyThingSchema = z.strictObject({...});

// RIGHT
const Foo = z.strictObject({name: z.string()});
const Bar = z.string().meta({description: 'a bar'});
const MyThing = z.strictObject({...});

// RIGHT: strictObject inside discriminated union
const Action = z.discriminatedUnion('type', [
	z.strictObject({type: z.literal('a'), value: z.string()}),
]);
\`\`\`

## Input vs Output Types

Schemas with \`.default()\` or \`.transform()\` have different input and output
types. \`z.infer<>\` gives the output (post-parse) type. \`z.input<>\` gives the
pre-parse type — what callers provide before defaults are applied.

Export \`z.input<>\` when callers construct partial instances via \`.parse()\` —
Cell instantiation, resource builders, config files. Skip it when the schema
is only consumed internally (env loading, action spec \`satisfies\`).

This is a **systematic pattern** in zzz and tx:

\`\`\`typescript
// zzz — every Cell schema exports both types
export const ChatJson = CellJson.extend({
	name: z.string().default(''),
	thread_ids: z.array(Uuid).default(() => []),
	selected_thread_id: Uuid.nullable().default(null),
}).meta({cell_class_name: 'Chat'});
export type ChatJson = z.infer<typeof ChatJson>;       // all fields present
export type ChatJsonInput = z.input<typeof ChatJson>;   // defaults omittable

// tx — every resource schema exports an input type
export const PackageResource = ResourceBase.extend({
	type: z.literal('package'),
	from: PackageMapping,
	check: z.string().optional(),
});
export type PackageResource = z.infer<typeof PackageResource>;
export type PackageResourceInput = z.input<typeof PackageResource>;
\`\`\`

Use \`z.input<>\` for:
- Constructor/factory parameters (Cell instantiation, resource builders)
- Config file shapes (before defaults are applied)
- Form inputs and partial data from storage

Use \`z.infer<>\` (the default) for:
- Runtime data after parsing
- Function return types
- Validated state

### Factory Functions with Input Types

tx uses a systematic factory pattern — accept \`z.input<>\` without the
discriminant field, parse to get the validated output:

\`\`\`typescript
// tx/resources/types.ts
export const package_resource = (
	config: Omit<PackageResourceInput, 'type'>,
): PackageResource => {
	return PackageResource.parse({type: 'package', ...config});
};

// usage — type-safe, defaults applied, discriminant injected
const pkg = package_resource({id: 'nginx', name: 'nginx', from: {apt: 'nginx'}});
\`\`\`

This works because \`parse\` applies defaults and validates, while \`Omit<Input, 'type'>\`
lets callers skip the discriminant.

## Branded Types

Nominal typing for primitives — a \`Uuid\` is not interchangeable with \`string\`
at the type level:

\`\`\`typescript
// fuz_util/uuid.ts — Zod 4 built-in validators + brand
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

// fuz_util/datetime.ts
export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// zzz/diskfile_types.ts — refine + brand for domain validation
export const DiskfilePath = z
	.string()
	.refine((p) => is_path_absolute(p), {message: 'path must be absolute'})
	.brand('DiskfilePath');
export type DiskfilePath = z.infer<typeof DiskfilePath>;

// tx/types.ts — simple string + brand (generic syntax)
export const ResourceId = z.string().min(1).brand<'ResourceId'>();
export type ResourceId = z.infer<typeof ResourceId>;

export const FilePath = z.string().min(1).brand<'FilePath'>();
export type FilePath = z.infer<typeof FilePath>;
\`\`\`

Use branded types for values that should not be accidentally swapped.
Dynamic defaults use factory functions (\`Uuid.default(create_uuid)\`,
\`Datetime.default(get_datetime_now)\`). For TypeScript-only nominal typing
without runtime validation, see \`Flavored\` in ./type-utilities.

## Defaults and Optionality

\`\`\`typescript
// .default() — static or factory
count: z.number().int().default(0),
thread_ids: z.array(Uuid).default(() => []),         // factory for mutable defaults
auth: DatabaseAuth.default({method: 'trust', hosts: ['127.0.0.1/32']}),

// .optional() — field can be omitted (undefined). For request fields callers may skip.
port: z.number().optional(),

// .nullable() — field is present but can be null. For database columns and
// explicit "no value" semantics.
email: Email.nullable(),
expires_at: z.string().nullable(),

// .nullable().default(null) — present, nullable, defaults to null if omitted.
// Common for Cell fields that are optional references.
selected_thread_id: Uuid.nullable().default(null),

// .nullish() — null | undefined. For flexible inputs that accept either.
// Use sparingly — prefer .optional() or .nullable() for clarity.
email: Email.nullish(),  // fuz_app invite creation

// .catch(fallback) — use fallback if present value fails validation.
// Different from .default() (missing field). For graceful degradation of
// stored data that may have been written by an older schema version.
before: PackageCurrent.nullable().catch(null),  // tx change schemas
\`\`\`

## Field-Level Validation

Use \`.shape\` to validate individual fields without parsing the whole object:

\`\`\`typescript
// zzz — validate a single field value
ProviderJson.shape.name.parse(value);

// zzz/socket.svelte.ts — Cell field mutations via shape access
SocketJson.shape.url.parse(new_url);
\`\`\`

## Transform Pipelines

\`\`\`typescript
// zzz/zod_helpers.ts
export const PathWithTrailingSlash = z.string().transform((v) => ensure_end(v, '/'));
export const PathWithoutTrailingSlash = z.string().transform((v) => strip_end(v, '/'));
\`\`\`

Transforms run at parse time — output type differs from input type.

Compose with \`.pipe()\` for multi-stage validation:

\`\`\`typescript
// zzz/diskfile_types.ts — transform then brand
export const DiskfileDirectoryPath =
	PathWithTrailingSlash.pipe(DiskfilePath).brand('DiskfileDirectoryPath');
\`\`\`

## Zod 4 Primitives

\`\`\`typescript
z.uuid()               // UUID validation (used with .brand('Uuid'))
z.iso.datetime()       // ISO 8601 datetime (used with .brand('Datetime'))
z.email()              // email validation
z.url()                // URL validation
z.coerce.number()      // string-to-number coercion (env vars)
z.looseObject({...})   // accepts unknown keys (external data)
z.toJSONSchema(schema) // export schema as JSON Schema
z.prettifyError(error) // format ZodError for display (CLI args)
z.instanceof(MyClass)  // runtime class instance check (Cell class schemas in zzz)
z.void()               // no value — action specs with no input/output
z.record(K, V)         // key-value maps (env vars, resource maps)
z.custom<T>(check?)    // escape hatch for complex types without full Zod validation
\`\`\`

- \`z.null()\` — no request body in route specs (\`input: z.null()\`). Distinct
  from \`z.void()\` — use \`z.null()\` for HTTP input (JSON \`null\`), \`z.void()\`
  for action specs with no value
- \`z.void()\` / \`z.void().optional()\` — action specs with no input or output
- \`z.custom<T>(check?)\` — embeds complex types without full Zod validation;
  use sparingly (e.g., \`z.custom<Plan>()\` in tx, \`z.custom<z.ZodType>(...)\` in
  fuz_app action specs)
- \`z.instanceof(MyClass)\` — runtime class instance check; used in zzz so
  action specs can reference Cell instances as typed values

## Schema Introspection

When inspecting schema types at runtime, prefer \`instanceof\` checks and the
public \`.def\` property:

\`\`\`typescript
// instanceof — type detection without internal APIs
schema instanceof z.ZodNull
schema instanceof z.ZodObject
schema instanceof z.ZodArray

// .def — public getter for the type definition (same as _zod.def)
const def = schema.def;
def.type    // 'string', 'object', 'null', etc.

// WRONG: ._zod.def — internal API, same value but not public
schema._zod.def  // works but prefer schema.def
\`\`\`

See \`@fuzdev/fuz_util/zod.ts\` for unwrapping utilities (\`zod_unwrap_def\`,
\`zod_get_base_type\`, \`zod_to_subschema\`, \`zod_get_innermost_type\`,
\`zod_get_innermost_type_name\`, \`zod_unwrap_to_object\`) that handle wrappers
like optional, nullable, default, transform, and pipe; and field helpers
(\`zod_get_schema_keys\`, \`zod_get_field_schema\`, \`zod_maybe_get_field_schema\`)
for inspecting object schemas.

## Unions and Enums

### Discriminated Unions

\`z.discriminatedUnion()\` when a type field determines the shape. Members use
\`z.strictObject()\`:

\`\`\`typescript
// tx/resources/types.ts — 16 resource types
export const Resource = z.discriminatedUnion('type', [
	PackageResource,
	FileResource,
	DirectoryResource,
	// ...
]);
export type Resource = z.infer<typeof Resource>;

// inline members also use strictObject
export const FileContent = z.discriminatedUnion('type', [
	z.strictObject({type: z.literal('inline'), content: z.string()}),
	z.strictObject({type: z.literal('template'), template: z.string(), vars: TemplateVars.optional()}),
	z.strictObject({type: z.literal('source'), path: z.string()}),
]);
\`\`\`

### Plain Unions

\`z.union()\` when there's no single discriminant field, or when mixing shapes
with literals:

\`\`\`typescript
// zzz/jsonrpc.ts — multiple message shapes
export const JsonrpcMessage = z.union([
	JsonrpcRequest, JsonrpcNotification, JsonrpcResponse, JsonrpcErrorMessage,
]);

// fuz_app/actions/action_spec.ts — mixed literal + object
export const ActionAuth = z.union([
	z.literal('public'),
	z.literal('authenticated'),
	z.strictObject({role: z.string()}),
]);

// tx/resources/types.ts — union with literal false for opt-out
sudo: z.union([z.enum(['nopasswd', 'password']), z.literal(false)]).optional(),
\`\`\`

Prefer \`z.discriminatedUnion()\` when possible — it gives better error messages.

### Enums

\`\`\`typescript
export const ActionKind = z.enum(['request_response', 'remote_notification', 'local_call']);
export type ActionKind = z.infer<typeof ActionKind>;
\`\`\`

For extensible enums, use a factory:

\`\`\`typescript
// fuz_app/auth/role_schema.ts — dynamic enum from builtin + app-defined roles
export const create_role_schema = (app_roles: Array<string>) => {
	const all_roles = [...BUILTIN_ROLES, ...app_roles];
	const Role = z.enum(all_roles as [string, ...Array<string>]);
	return {Role, role_options: new Map(/* ... */)};
};
\`\`\`

## Schema Extension

\`.extend()\` adds or overrides fields, preserving strict mode:

\`\`\`typescript
// fuz_app/actions/action_spec.ts
export const ActionSpec = z.strictObject({
	method: z.string(),
	kind: ActionKind,
	input: z.custom<z.ZodType>((v) => v instanceof z.ZodType),
	output: z.custom<z.ZodType>((v) => v instanceof z.ZodType),
	// ...
});

export const RequestResponseActionSpec = ActionSpec.extend({
	kind: z.literal('request_response').default('request_response'),
	auth: ActionAuth,
	async: z.literal(true).default(true),
});
\`\`\`

### Cell Schemas (zzz)

Every Cell class has a schema built with \`CellJson.extend()\` (see \`ChatJson\`
example in Input vs Output Types above). Cell schema conventions:

- All fields must have \`.default()\` for Cell instantiation from partial JSON
- \`.meta({cell_class_name})\` connects the schema to its Cell class for the
  registry
- Every Cell exports both \`FooJson\` (output, fully validated) and
  \`FooJsonInput\` (input, defaults omittable for constructors and \`set_json()\`)
- The Cell base class is generic over the schema:
  \`abstract class Cell<TSchema extends z.ZodType>\` — validates internally
  with \`this.schema.parse()\`

## Metadata

\`.meta()\` attaches introspectable metadata. \`description\` powers CLI help;
other keys are domain-specific:

\`\`\`typescript
export const DeployArgs = z.strictObject({
	_: z.array(z.string()).max(0).default([]),
	dry: z.boolean().meta({description: 'preview without deploying'}).default(false),
	branch: z.string().meta({
		description: 'deploy branch',
		aliases: ['b'],
	}).default('deploy'),
});
\`\`\`

### Sensitivity Metadata (fuz_app)

\`SchemaFieldMeta\` (from \`@fuzdev/fuz_app/schema_meta.js\`) extends \`.meta()\`
with a \`sensitivity\` key:

\`\`\`typescript
DATABASE_URL: z.string().min(1).meta({
	description: 'Database URL (postgres://, file://, or memory://)',
	sensitivity: 'secret',
}),
PORT: z.coerce.number().default(4040)
	.meta({description: 'HTTP server port'}),
\`\`\`

\`sensitivity: 'secret'\` masks values in logs and API surface snapshots.

## Validation at Boundaries

### safeParse for External Input

Use \`safeParse\` when invalid data is a normal condition and you need to
respond gracefully:

\`\`\`typescript
// fuz_app/http/route_spec.ts — input validation middleware
const result = input_schema.safeParse(body);
if (!result.success) {
	return c.json({error: ERROR_INVALID_REQUEST_BODY, issues: result.error.issues}, 400);
}
c.set('validated_input', result.data);

// zzz — external API responses
const parsed = ApiResponse.safeParse(response);
\`\`\`

Route specs declare input/output schemas for auto-generated validation
middleware. Input validated via \`safeParse\`; output validated in DEV only.

### parse for Fail-Fast Contexts

Use \`parse\` when invalid data means a bug or fatal misconfiguration:

\`\`\`typescript
RoleName.parse(name);                                    // internal assertion
const args = RunApplyArgs.parse(raw_args);               // CLI args
return PackageResource.parse({type: 'package', ...config}); // factory function
const parsed = this.schema.parse(v);                     // Cell field update
\`\`\`

### safeParse with Custom Error Handling

\`safeParse\` + custom throw gives better error context than bare \`parse\`.
\`safeParse\` + return null handles optional data that may be absent or invalid:

\`\`\`typescript
// fuz_app/env/load.ts — env loading: safeParse + custom error with raw values
const result = schema.safeParse(raw);
if (!result.success) {
	throw new EnvValidationError(raw, result.error);
}

// fuz_app/cli/config.ts — optional config file: safeParse + return null
const result = schema.safeParse(parsed);
if (!result.success) {
	runtime.warn(\`Invalid config.json: \${result.error.message}\`);
	return null;
}
\`\`\`

### Formatting Errors

\`\`\`typescript
// Zod 4 built-in — multi-line, human-readable (CLI args, error display)
return {success: false, error: z.prettifyError(parsed.error)};

// zzz/zod_helpers.ts — single-line, compact (inline error messages)
export const format_zod_validation_error = (error: z.ZodError): string =>
	error.issues
		.map((i) => {
			const path = i.path.length > 0 ? \`\${i.path.join('.')}: \` : '';
			return \`\${path}\${i.message}\`;
		})
		.join(', ');
\`\`\`

## Quick Reference

| Convention | Correct | Wrong |
|-----------|---------|-------|
| Object schemas (internal) | \`z.strictObject({...})\` | \`z.object({...})\` |
| Object schemas (external data) | \`z.looseObject({...})\` or \`z.object({...})\` with comment | \`z.strictObject({...})\` |
| Response/error schemas | \`z.looseObject({...})\` — tolerates added fields | \`z.strictObject({...})\` |
| Discriminated union members | \`z.strictObject({type: z.literal('a'), ...})\` | \`z.object({type: z.literal('a'), ...})\` |
| Descriptions | \`.meta({description: '...'})\` | \`.describe('...')\` |
| Schema naming | \`const MyThing = z.strictObject(...)\` | \`const my_thing\`, \`const MyThingSchema\` |
| Type inference (output) | \`type MyThing = z.infer<typeof MyThing>\` | separate name from schema |
| Type inference (input) | \`type MyThingInput = z.input<typeof MyThing>\` | manual partial types |
| IDs and paths | \`z.string().brand('MyId')\` | plain \`z.string()\` |
| HTTP/API input | \`schema.safeParse(data)\` | \`schema.parse(data)\` |
| CLI args/factories | \`schema.parse(data)\` | \`schema.safeParse(data)\` with unnecessary error handling |
| Env loading | \`safeParse\` + custom throw (better error context) | bare \`parse\` (loses raw values) |
| Optional config files | \`safeParse\` + return null | \`parse\` (crashes on missing file) |
| No input/output | \`z.void()\` or \`z.void().optional()\` | \`z.undefined()\`, omitting the field |
| Optional reference | \`Uuid.nullable().default(null)\` | \`Uuid.optional()\` (ambiguous undefined vs absent) |
| Complex embedded types | \`z.custom<MyType>()\` | hand-rolled validation |
| Key-value maps | \`z.record(z.string(), ValueSchema)\` | \`z.strictObject\` with dynamic keys |
`}];export{n as a,e as s};
