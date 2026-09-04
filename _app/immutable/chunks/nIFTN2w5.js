const e={content:"# Fuz stack conventions\n\n> **Pre-alpha**: Conventions are actively evolving. When code or a project's\n> CLAUDE.md conflicts with this skill, the code is ground truth.\n>\n> **À la carte**: Each project adopts only what serves it. Deep imports and\n> the flat namespace make this natural at the package level too.\n\n> **Skip for**: planning/lore-only edits, third-party code review, simple\n> git/shell operations. Repo `CLAUDE.md` is authoritative for\n> project-specific patterns — this skill covers shared conventions across\n> TypeScript, Svelte, and Rust crates.\n\n## Why These Conventions\n\nThe Fuz stack is designed so the full software lifecycle — produce, deploy,\noperate — is accessible to anyone with intent and an AI partner. These\nconventions serve that goal: consistent, self-describing patterns that AI\nagents can learn once and apply everywhere. snake_case aligns TS, Rust, and\nSQL with zero renaming. Zod schemas are the single source of truth for shape,\ntypes, defaults, and validation. The Cell pattern gives every piece of state\nthe same structure. When conventions are this consistent, AI can reliably\nbridge the gap between a person's intent and the stack's implementation.\n\nThe stack composes bottom-up (see Dependency flow below), with `fuz_app` the\nshared backend spine (auth, sessions, DB, SSE). zzz (the garage) and zap\n(machine-state convergence) build on the same primitives. Understanding one\npart transfers to understanding the others.\n\n## Package Ecosystem\n\n`@fuzdev/*` packages draw from these conventions. Each package's `CLAUDE.md`\nis authoritative for what it actually uses.\n\n| Package        | Description                                                                            |\n| -------------- | -------------------------------------------------------------------------------------- |\n| `fuz_util`     | foundation utilities (zero deps) — hashing, async, schemas, types                      |\n| `gro`          | task runner and toolkit extending SvelteKit (web-dev surface; internals adopting Rust) |\n| `fuz_css`      | semantic-first CSS framework and design system — apps look good by default             |\n| `mdz`          | minimal markdown dialect — parser, renderer, Svelte preprocessor                       |\n| `fuz_ui`       | Svelte 5 components — themes, layouts, overlays, auto-docs                             |\n| `fuz_app`      | stack spine — auth, sessions, DB, SSE, route specs, CLI/daemon                         |\n| `fuz_docs`     | experimental AI-generated docs and skills for Fuz                                      |\n| `fuz_template` | a web app template with TypeScript + SvelteKit + optional Rust for the fuz-stack       |\n| `fuz_code`     | syntax styling utilities and components for TypeScript, Svelte, Markdown, and more     |\n| `fuz_blog`     | blog software from scratch with SvelteKit                                              |\n| `fuz_mastodon` | Mastodon components and helpers for Svelte, SvelteKit, and Fuz                         |\n| `fuz_gitops`   | a tool for managing many repos                                                         |\n| `blake3`       | BLAKE3 hashing compiled to WASM (`@fuzdev/blake3_wasm` + `blake3_wasm_small`)          |\n| `zzz`          | software garage — produce software with AI assistance                                  |\n| `zap`          | convergence — deploy and operate infrastructure                                        |\n\n**Dependency flow**: `fuz_util → gro + fuz_css → mdz → fuz_ui → fuz_app → zzz, apps`\n(zap sits beside this chain: its site/authoring surface builds on fuz_ui, and\nits Rust engine is spine-free — it consumes neither fuz_app nor the spine crates)\n\n**Adding deps**: prefer the approved allowlists (./references/npm-dependencies,\n./references/rust-dependencies). Adding or upgrading needs approval; removing\nan unused dep is pre-authorized.\n\n## Coding Conventions\n\n### Naming - snake_case + PascalCase\n\n```typescript\n// Functions and variables - snake_case\n// applies equally to function declarations and arrow function exports\nconst format_bytes = (n: number): string => { ... };\nexport const git_current_branch_name = async (): Promise<GitBranch> => { ... };\nexport function create_context<T>(fallback?: () => T) { ... }\nconst user_data: Record<string, unknown> = {};\n\n// Types, classes, components - PascalCase\ntype PackageJson = {};\nclass DocsLinks {}\n// file: src/lib/DocsLink.svelte\n```\n\n**NOT** camelCase for functions/variables. Intentional divergence:\n\n- **Cross-language alignment** — same identifiers in TS, Rust, and SQL with\n  zero renaming cost (`keyed_hash`, `get_user_sessions`, `git_push`).\n- **Legibility** — underscores as explicit word boundaries:\n  `package_json_load` vs `packageJsonLoad`.\n\n**External APIs keep their native casing.** `.map()`, `addEventListener()`,\n`initSync` — only identifiers you define follow snake_case.\n\n```typescript\n// Constants - SCREAMING_SNAKE_CASE\nconst DEFAULT_TIMEOUT = 5000;\nconst GITOPS_CONFIG_PATH_DEFAULT = 'gitops.config.ts';\n```\n\n### Naming Patterns\n\nTwo forms, chosen by **disambiguation** in the flat namespace:\n\n**Domain-prefix** (`domain_action`) — when the bare action name would be\nambiguous:\n\n```typescript\ngit_push(); // git_* cluster (fuz_util/git.ts)\ngit_fetch(); // \"push\"/\"fetch\" alone are ambiguous\ntime_format(); // time_* cluster (fuz_util/time.ts)\ncontextmenu_open(); // contextmenu_* cluster (fuz_ui)\npackage_json_load(); // package_json_* cluster (gro)\n```\n\n**Action-first** (`action_domain`) — when already self-descriptive:\n\n```typescript\ntruncate(); // standalone (fuz_util/string.ts)\nstrip_start(); // action is the concept (fuz_util/string.ts)\nescape_js_string(); // action with domain qualifier (fuz_util/string.ts)\nshould_exclude_path(); // predicate form (fuz_util/path.ts)\nto_file_path(); // conversion (fuz_util/path.ts)\n```\n\n| Pattern               | Example                  | Use Case                        |\n| --------------------- | ------------------------ | ------------------------------- |\n| `domain_action`       | `git_push`               | Disambiguates in flat namespace |\n| `domain_is_adjective` | `git_workspace_is_clean` | Boolean in a domain cluster     |\n| `to_target`           | `to_file_path`           | Conversions                     |\n| `format_target`       | `format_number`          | Formatting                      |\n| `action_domain`       | `escape_js_string`       | Self-descriptive utilities      |\n| `create_domain`       | `create_context`         | Factory functions               |\n\n**Rule of thumb**: domain-prefix when the bare name is ambiguous (`git_push`\nnot `push`); action-first when self-descriptive (`truncate`, `strip_start`).\nFile names often signal which: `git.ts` → `git_*`, `string.ts` → action-first.\n\n**Action verbs**: `parse`, `create`, `get`, `to`, `is`, `has`, `format`,\n`render`, `analyze`, `extract`, `load`, `save`, `escape`, `strip`, `ensure`,\n`validate`, `should`\n\n### Flat Namespace - Fail Fast\n\nAll exported identifiers must have **unique names across all modules**:\n\n- The `svelte-docinfo` analysis detects duplicate export names across modules\n  in the flat namespace\n- Error shows all conflicts with module paths and kinds\n- Resolution: rename one following the domain_action pattern, or add\n  `/** @nodocs */` to exclude from validation\n- **Which side to rename** — rename the side that is _not_ the primary\n  public API. `@nodocs` is the wrong tool when external consumers depend\n  on the hidden symbol (it vanishes from docs and tomes).\n  - Component is primary (class is a state/helper): suffix the class with\n    `State` / `Info`. Example: `DocsLink` interface → `DocsLinkInfo` when\n    it conflicts with `DocsLink.svelte`. Precedent: `ThemeState`,\n    `AuthState`, `SidebarState`.\n  - Class is primary (stateful with methods/lifecycle, consumers\n    instantiate it): suffix the component with `View` / `Pane`. Precedent:\n    zzz's Cell classes keep their names (`Chat`, `Turn`) and their\n    components take `View` (`ChatView.svelte`, `TurnView.svelte`); mdz's\n    `MdzNodeView.svelte` renders the `MdzNode` type.\n\n### File Organization\n\n- **`src/lib/`** — exportable library code: `PascalCase.svelte` components,\n  `*.ts` utilities, `*.svelte.ts` runes/reactive code, `*.gen.ts` generated files\n- **`src/test/`** — tests (NOT co-located), mirroring `lib/` structure\n- **`src/routes/`** — SvelteKit routes (if applicable)\n- **No barrels** — import every module by full path (`@fuzdev/fuz_app/env/load.ts`);\n  package `exports` use wildcards so each module is importable\n- **Subdirectories** — group a domain into `lib/domain/` at 3+ related files;\n  a lone file stays at `lib/` root. Tests mirror the subdir structure.\n\nSee ./references/file-organization for the full tree, domain examples, and\nimport/test-mirroring details.\n\n### Code Style\n\n- **TypeScript**: Strict mode, explicit types\n- **Svelte**: Svelte 5 with runes API ($state, $derived, $effect)\n- **Formatting**: tsv with tabs, 100 char width\n- **Extensions**: use the real source extension in imports — `.ts` /\n  `.svelte.ts`, not the old `.js`-for-a-`.ts`-file form. See\n  ./references/path-references §5 for the full rules:\n  - Relative: `import {foo} from './bar.ts'`; `.svelte` component imports\n    stay `.svelte`.\n  - Cross-package: `@fuzdev/pkg/foo.ts` resolves via the package's `exports`\n    `.js`/`.ts` mirror; the build rewrites relative `.ts`→`.js` into `dist`.\n  - Aliases: library code (`src/lib`) imports relative; everything else\n    (`src/routes`, `src/test`) uses the `#lib`/`#routes` package.json subpath\n    imports with the `.ts` extension (`#lib/db/db.ts`).\n- **Comments**:\n  - JSDoc (`/** ... */`) = proper sentences with periods\n  - Inline (`//`) = fragments, no capital or period\n- **No backwards compatibility**: Delete unused code, rename directly, no\n  deprecated stubs or shims. Document breaking changes in changesets.\n\n## Gro Commands (Web-Dev Tool)\n\n**IMPORTANT**: Gro is installed globally — always run `gro` directly, never\n`npx gro`.\n\n**Development:**\n\n```bash\ngro test         # run vitest tests\ngro gen          # run code generators (*.gen.ts files)\ngro format       # format with tsv\ngro lint         # run ESLint\ngro typecheck    # run TypeScript type checking\n```\n\n**Production:**\n\n```bash\ngro build        # production build (runs plugin lifecycle)\ngro check        # ALL checks: test + gen --check + format --check + lint + typecheck\ngro publish      # version with Changesets, publish to npm, push to git\ngro deploy       # build and force push to deploy branch\ngro release      # combined publish + deploy workflow\n```\n\n**Utilities:** `gro sync` (gen + update exports), `gro run file.ts` (execute\nTS), `gro changeset` (create changeset). `SKIP_EXAMPLE_TESTS=1 gro test`\nskips slow example tests in repos that support the flag (see\n./references/testing-patterns).\n\n**Key behaviors:** `gro check` is the CI command. `gro gen --check` verifies\nno drift. Tasks are overridable: local `src/lib/foo.task.ts` overrides\n`gro/dist/foo.task.js`; call builtin with `gro gro/foo`.\n\n**Custom tasks**: see ./references/task-patterns for the Task interface,\nZod-based Args, TaskContext, error handling, override patterns, and task\ncomposition.\n\n**Never run `gro dev` or `npm run dev`** — user manages the dev server.\n\n## Code Generation\n\nGen files (`*.gen.ts`) export a `gen` function, discovered by the `.gen.`\npattern in filenames. Naming: `foo.gen.ts` → `foo.ts`, `foo.gen.css.ts` →\n`foo.css`. Return `string`, `{content, filename?, format?}`, `Array`, or\n`null`.\n\nCommon gen pattern: `theme.gen.css.ts` (theme CSS from style variables).\nTwo outputs that used to be gen tasks no longer are: fuz_css utility classes\ncome from the `vite_plugin_fuz_css` Vite plugin (the `virtual:fuz.css` module),\nand library/API metadata comes from the `svelte-docinfo` Vite plugin — so most\nprojects run `gro gen` rarely, if ever.\n\nSee ./references/code-generation for the full API, dependencies, and\nexamples.\n\n## TSDoc/JSDoc Conventions\n\nSee ./references/tsdoc-comments for the full tag guide, documentation\npatterns, and drift-detection guidance.\n\n**Key rules:**\n\n- Main description: complete sentences ending in a period\n- `@param name - description`: hyphen separator; single-sentence: lowercase, no\n  period; multi-sentence: capitalize, end with period\n- `@returns` (not `@return`): same single/multi-sentence rule as `@param`\n- `@module`: complex modules get a module-level doc comment with `@module` at end\n- `@mutates target - description`: document parameter/state mutations. The\n  description carries the tag — name the columns, cascades, or side channels a\n  reader wouldn't guess. When the method name already says it, omit the tag\n  rather than writing a bare `` @mutates `target` ``\n- `@internal`: marks a symbol as not-stable API — stays fully documented\n  (consumers can badge or filter); use `@nodocs` to remove from docs entirely\n- `@nodocs`: exclude from docs and flat namespace validation\n- Wrap identifier references in backticks for auto-linking via `mdz`\n\n**Tag order**: description → `@param` → `@returns` → `@mutates` → `@throws` →\n`@example` → `@deprecated` → `@see` → `@since` → `@default` → `@internal` →\n`@nodocs`\n\n## Documentation System\n\nProjects use **tomes** (not \"stories\") with auto-generated API docs.\n\n**Pipeline**: source files → `svelte-docinfo` Vite plugin →\n`virtual:svelte-docinfo` → `library_json_from_modules()` → `Library` class → Tome\npages + API routes.\n\nSee ./references/documentation-system for setup, the full pipeline, Tome\nsystem, layout architecture, and component reference. TSDoc authoring\nconventions: ./references/tsdoc-comments.\n\n## mdz - Strict Markdown Dialect\n\n`mdz` (`@fuzdev/mdz/mdz.ts`) is the Fuz markdown dialect — a small, unambiguous\ngrammar, **not a CommonMark/GFM superset** (ambiguous input stays literal text).\nfuz_ui renders TSDoc prose through it, injecting `DocsLink` (inline code) and\nfuz_code's `Code` (code blocks) via its rendering seam; backticked identifiers\nthat resolve to API symbols become links.\n\nSupports code, bold/italic/strike (`**`/`~~` doubled, italic single `_` at word\nboundaries; intraword `_` stays literal so `snake_case` renders verbatim),\nlinks, headings, lists, blockquotes,\ncode blocks, tables, horizontal rules, and registered components/elements.\n\n```svelte\n<Mdz content=\"Some **bold** and `code` text.\" />\n```\n\nRegistration and rendering happen through getter contexts in\n`@fuzdev/mdz/mdz_contexts.ts` (`mdz_components_context`, `mdz_elements_context`,\n`mdz_code_context`, `mdz_codeblock_context`). The full per-feature syntax table,\ndialect surface, injection seam, backtick autolinking, and the\n`svelte_preprocess_mdz` build-time preprocessor: ./references/mdz.\n\n## Path References in Docs\n\nForms by typography (mdz auto-linkifies bare `./`/`../` paths in rendered\ndocs, so the typography carries meaning):\n\n- **Navigational paths** — bare, no backticks (`./foo`, `../foo`, `~/dev/foo`)\n  for files referenced by location; mdz auto-linkifies `./`/`../` after whitespace.\n  A bare path is a promise it **resolves on disk** — backtick an illustrative or\n  conceptual path (`` `./build/` ``) as the escape hatch\n- **src/lib module references** — backticked, src/lib-relative with **no** leading\n  `./`, `../`, or redundant `src/lib/` prefix (e.g. \"`auth/account_schema.ts`\");\n  the backticks frame a module identifier, so traversal/prefix contradicts the framing\n- **Cross-repo references** — bare `../other-repo/...` for navigation, or the\n  `@scope/pkg/foo.ts` import specifier for a module's identity; the backticked\n  src/lib form is same-repo only, and TSDoc must not point outside its own repo\n- **Code-shaped non-paths** — backticks for CLI commands (`gro check`),\n  top-level files (`package.json`), and config identifiers (`~/.fuz/`)\n\nSee ./references/path-references for all forms in full, the web-rendered\ncaveat, anti-patterns, and formatter cautions.\n\n## Svelte 5 Patterns\n\nSee ./references/svelte-patterns for `$derived.by()`, reactive collections\n(SvelteMap/SvelteSet), schema-driven reactive classes, snippets, keyed each\nblocks, effects, attachments, props, event handling, component composition,\ndebugging reactivity, and legacy features to avoid.\n\n### Runes API\n\n`$state()` for all reactive state — it proxies objects and arrays so in-place\nmutation (push, splice, property writes, `bind:` on object properties) triggers\nupdates. `$state.raw()` is a performance opt-out for large wholesale-replaced\nvalues, not a default. `$derived` for computed values, `$effect` for side\neffects.\n\n### Context Pattern\n\nStandardized via `create_context<T>()` from\n`@fuzdev/fuz_ui/context_helpers.ts`. Common contexts: `theme_state_context`\n(theme), `library_context` (package API metadata), `tome_context` (current\ndoc page).\n\n## fuz_css\n\nSee ./references/css-patterns for setup, variables, composites, modifiers,\nextraction, and dynamic theming.\n\n**Default styling is the baseline — justify every deviation.** fuz_css styles\nsemantic HTML by default (buttons, inputs, headings, links, lists, code, tables,\n`<aside>`, `<blockquote>`, `<details>`, `<small>`, `<kbd>`, …) via\nlow-specificity `:where()` selectors, and block elements space themselves via\nthe **flow-margin** system — so most content needs zero classes. The most common\nmistake is hand-adding `mb_*`/`gap_*`/`p_*` where flow margin already spaces, or\nre-declaring color/font the element already carries. Before any class or\n`<style>`, ask what specific gap in the defaults it closes — most app files have\nno `<style>` block at all.\n\n```svelte\n<!-- BAD: these classes fight defaults the elements already have -->\n<section>\n	<h2 class=\"mb_md\">{title}</h2>\n	<!-- headings already carry flow margin -->\n	<p class=\"mb_md\">{body}</p>\n	<!-- so do paragraphs -->\n</section>\n\n<!-- GOOD: correct vertical rhythm with zero classes -->\n<section>\n	<h2>{title}</h2>\n	<p>{body}</p>\n</section>\n```\n\n**Styling ladder** — stop at the first rung that suffices:\n\n1. Semantic HTML (right element, no class)\n2. Built-in conventions (`.selected`, `.palette_a`–`.palette_j`, `.inline`, `.unstyled`)\n3. Composite classes (`row`, `column`, `box`, `panel`, `chip`, `ellipsis`)\n4. Token classes (`p_md`, `gap_lg`, `color_a_50`) — spacing tokens are the most-used family\n5. Literal classes (`display:flex`, `width:100%`, `hover:opacity:80%`)\n6. `<style>` block with design tokens\n\nRungs 3–5 are one tier in practice — mix freely; the real cut points are\nsemantic-vs-class and classes-vs-`<style>`. Don't churn existing `<style>`\nblocks into long class strings. See ./references/css-patterns §The Styling\nLadder.\n\n**Class naming**: fuz_css tokens use `snake_case` (`p_md`, `gap_lg`);\ncomponent-local classes use `kebab-case` (`site-header`) — the target convention,\nadopted in zzz and fuz_ui.\n\nArchitecture — the three layers (semantic defaults, design tokens, utility\nclasses), the class families, and the classes-vs-`<style>` matrix: see\n./references/css-patterns §Style Variables (Design Tokens), §Utility\nClasses, and §When to Use Classes vs Styles.\n\n## Dependency Injection\n\n**Small standalone `*Deps` interfaces, composed bottom-up.** Leaf functions\nimport small interfaces directly (not `Pick<Composite>`).\n\n- **Three suffixes** — `*Deps` (capabilities/functions, fresh mock factories per\n  test), `*Options` (data/config values, literal objects), `*Context` (scoped\n  world for a callback/handler). No `*Config` suffix — use `*Options`. `*Deps`\n  names the injected bundle; single-capability service interfaces keep pure-noun\n  names (`Keyring`, `FactStore`).\n- **File shape** — `deps.ts` + `deps_defaults.ts` + test-side `mock_deps.ts`\n  (fuz_css is the cleanest exemplar). fuz_gitops's `*Operations` spelling is\n  legacy, migrating to `*Deps` — never author new `*Operations`.\n- **AppDeps** — stateless capabilities bundle for server code (fuz_app),\n  assembled once at a two-step composition root.\n- **RuntimeDeps** — composable small `*Deps` interfaces for runtime operations\n  (env, fs, commands), with platform-specific factories (Deno, Node, mock).\n  Browser/UI DI is Svelte context, not `*Deps` params.\n- **Design principles** — single `options` object params in L1 domain deps,\n  `Result` returns with typed error kinds (L0 platform shims mirror the\n  platform and throw), plain object mocks (no mocking libs), throwing stubs\n  over silent no-ops, stateless capabilities, runtime agnosticism.\n\nSee ./references/dependency-injection for the full pattern guide, naming\nconventions, consumption patterns, RuntimeDeps, and mock factories.\n\n## Common Utilities\n\n`@fuzdev/fuz_util` provides shared utilities:\n\n- **Result type** — `Result<TValue, TError>` discriminated union for error\n  handling without exceptions. Properties go directly on the result object via\n  intersection: `({ok: true} & TValue) | ({ok: false} & TError)`.\n- **`to_error_message`** — `to_error_message(value, fallback?)` from\n  `@fuzdev/fuz_util/error.ts` normalizes an unknown caught value to a string\n  (`value.message` for `Error`, else `fallback ?? String(value)`)\n- **Logger** — hierarchical logging via `new Logger('module')`, controlled by\n  `PUBLIC_LOG_LEVEL` env var\n- **Timings** — performance measurement via `timings.start('operation')`\n- **DAG execution** — `run_dag()` for concurrent dependency graphs\n- **Async concurrency** — `each_concurrent`, `map_concurrent`,\n  `map_concurrent_settled`, `AsyncSemaphore`, `Deferred`\n- **Type utilities** — `Flavored`/`Branded` nominal typing, `OmitStrict`,\n  `PickUnion`, selective partials\n\nSee ./references/common-utilities for Result patterns, Logger configuration,\nand Timings usage. See ./references/async-patterns for concurrency\nprimitives. See ./references/type-utilities for the full type API.\n\n## Zod Schemas\n\nZod schemas are source of truth for JSON shape, TypeScript type, defaults,\nmetadata, CLI help text, and serialization. Schema changes cascade through the\nstack; treat them as critical review points.\n\n- **`z.strictObject()`** — default for all object schemas. `z.looseObject()`\n  or `z.object()` for external/third-party data, client-consumed\n  response/error schemas, and protocol shapes the other side may extend —\n  with a comment explaining why.\n- **PascalCase naming** — schema and type share the same name, no suffix:\n  `const Foo = z.strictObject({...}); type Foo = z.infer<typeof Foo>;`\n- **`.meta({description: '...'})`** — not `.describe()`. Both work in Zod 4\n  but `.meta()` is the convention and supports additional keys.\n- **`.brand()` for validated nominal types** — `Uuid`, `Datetime`, `DiskfilePath`\n- **`safeParse` at boundaries** — graceful errors for external input.\n  `parse` for internal assertions.\n\nSee ./references/zod-schemas for branded types, transform pipelines,\ndiscriminated unions, route specs, schemas as runtime data, instance schemas\n(zzz Cell), and introspection.\n\n## Query Modules (DB)\n\nOne query module per table (`query_<table>_<verb>`, `deps: QueryDeps` first,\n`assert_row` on `INSERT … RETURNING`). Every read projects through the\ntable's exported `*_COLUMNS` const — never `SELECT *` — rendered at the\nsite via `columns_sql` / `qualify_columns` / `omit_columns`, and each const\nis drift-guarded against the live schema (`assert_columns_match_live`).\nThe Rust twin uses the same identifiers with positional decode in const\norder. See ./references/db-patterns.\n\n## Testing\n\nTests live in `src/test/` (NOT co-located). Use `assert` from vitest —\nchoose methods for TypeScript type narrowing, not semantic precision.\n`assert(x instanceof Error)` narrows the type;\n`expect(x).toBeInstanceOf(Error)` does not. Name custom assertion helpers\n`assert_*` (not `expect_*`).\n\nUse `describe` blocks to organize tests — one or two levels deep is typical.\nUse `test()` (not `it()`).\n\nSplit large suites with dot-separated aspects: `{module}.{aspect}.test.ts`\n(e.g., `csp.base.test.ts`, `csp.security.test.ts`). Database tests use\n`.db.test.ts` suffix to opt into shared PGlite WASM via vitest `projects`\n(see ./references/testing-patterns).\n\nFor parsers and transformers, use fixture-based testing: input files in\n`src/test/fixtures/<feature>/<case>/`, regenerate `expected.json` via\n`gro src/test/fixtures/<feature>/update`. **Never manually edit\n`expected.json`** — always regenerate via task.\n\nSee ./references/testing-patterns for file organization, test helpers,\nshared test factories, mock factories, fixture workflow, database testing,\nenvironment flags, and test structure.\n\n## TODOs\n\nLeave **copious** `// TODO:` comments in code — they're expected and encouraged\nfor visibility into known future work, not debt to hide.\n\nFor multi-session work, create `TODO_*.md` files in the project root with\nstatus, next steps, and decisions. Delete when complete. **Update before ending\na session.**\n\n## Rust Crates\n\nThe ecosystem's Rust workspaces (the `fuz`/`fuzd` CLI + daemon, the spine\ncrates consumed by `zzz_server`/`fuz_forge_server`, the `zap` convergence\nengine, the `blake3`/`tsv` bindings) share a distinct set of conventions from\nthe TS/Svelte side. snake_case carries over for cross-language alignment, but\nRust solves with the type system + crate graph what TS solves with `*Deps`\ninjection. These references own _conventions and patterns_ — adoptable by any\nRust workspace, including new/external ones, with ecosystem repos as\nexemplars; each repo's `CLAUDE.md` owns its inventory (crates, commands, env\nvars). Six references, loaded on demand:\n\n- **./references/rust-patterns** — the new-workspace checklist, strict\n  lints (`unsafe_code = \"forbid\"`, pedantic + nursery + restriction lints;\n  the crate-override re-declare trap), release profile, `thiserror` error\n  taxonomy + `.hint()`/`.exit_code()` helpers and classifiers, graceful\n  shutdown, the DI escalation ladder\n  (`*Options`/boxed-closure-factories/capability-traits/enum-dispatch-before-`dyn`/RPITIT), the\n  make-impossible-states-unrepresentable idiom (zap_types is the reference),\n  CLI/exit-code patterns, and shared patterns (sandboxed eval, transactional\n  state files, CAS, bounded reads, type state, secret masking).\n- **./references/db-patterns** — query-module shape, the per-table\n  `*_COLUMNS` const + `fuz_db::qualify_columns` projection, positional\n  decode with compile-time name→index (`fuz_db::col!`), and the\n  `tests/columns.rs` drift guard (TS twin in the same doc).\n- **./references/rust-spine** — the spine crate map, consumer-server\n  contracts (`run_app`, `RunAppOptions`, the `testing_*` sibling binary),\n  the `fuz_http` JSON-RPC envelope, env loading, daemon lifecycle by\n  transport, and `fuz_audit` check-release + crate-layering rules.\n- **./references/rust-perf** — profiling, arenas (`bumpalo` in tsv),\n  lock hygiene, hot-path idioms, the `unsafe` escape hatch, and what's out\n  of scope.\n- **./references/rust-dependencies** — the approved external-crate allowlist\n  and the crate-vs-cargo-feature supply-chain isolation technique.\n- **./references/twin-impl** — the TS ↔ Rust twin-implementation\n  architecture: convergence discipline, identifier-level naming parity, the\n  cross-backend harness, wire crates, serialization parity rules, and tool\n  twins (fuz_template's molt).\n\nWASM, C-FFI, and N-API binding crates additionally follow\n./references/wasm-patterns. Each Rust repo's `CLAUDE.md` is authoritative\nfor project-specific conventions; these cover the shared patterns across\nworkspaces.\n"},n=[{slug:"async-patterns",title:"Async Patterns",content:`# Async Patterns

Async concurrency utilities in \`@fuzdev/fuz_util/async.ts\` and
\`@fuzdev/fuz_util/dag.ts\` — controlled concurrency for file I/O, network
requests, task execution, and DAG scheduling.

## AsyncStatus

Lifecycle type for tracking async operations in UI:

\`\`\`typescript
type AsyncStatus = 'initial' | 'pending' | 'success' | 'failure';
\`\`\`

## Deferred Pattern

Separates promise creation from resolution — external control over when and
how a promise resolves. Create with \`create_deferred()\`:

\`\`\`typescript
interface Deferred<T> {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: any) => void;
}
\`\`\`

\`\`\`typescript
const deferred = create_deferred<string>();

// Pass the promise to a consumer
some_async_consumer(deferred.promise);

// Resolve later from the producer
deferred.resolve('done');
\`\`\`

Used internally by \`run_dag()\` and \`throttle\`.

## Concurrent Operations

Three functions for bounded concurrency over iterables. All require
\`concurrency >= 1\`, accept an optional \`AbortSignal\`, and pass both item and
index to \`fn\` (which may return synchronously).

### Choosing the right function

| Function                 | Returns results | Fail behavior           | Use when               |
| ------------------------ | --------------- | ----------------------- | ---------------------- |
| \`each_concurrent\`        | No              | Fail-fast               | Side effects only      |
| \`map_concurrent\`         | Yes (ordered)   | Fail-fast               | Transform + collect    |
| \`map_concurrent_settled\` | Yes (settled)   | Collects all (no throw) | Best-effort collection |

**Fail-fast** (\`each_concurrent\`, \`map_concurrent\`): on first rejection,
stops spawning new workers and rejects — partial results are lost; with
\`signal\`, aborts immediately.

\`\`\`typescript
const results = await map_concurrent(
	file_paths,
	5, // max 5 concurrent reads
	async (path) => readFile(path, 'utf8')
);
// results[i] corresponds to file_paths[i]
\`\`\`

**Settled** (\`map_concurrent_settled\`): follows \`Promise.allSettled\` — the
outer promise never rejects. On abort it resolves with partial results:
completed items keep their real settlements, in-flight items reject with the
abort reason, and items never pulled from the iterator are absent from the
results array.

All three cap in-flight work at \`concurrency\`, spawning the next item as each
settles. Empty iterables resolve immediately.

## AsyncSemaphore

Class-based concurrency limiter — more flexible than concurrent map/each:

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

Used by \`run_dag()\` to bound node execution concurrency.

## DAG Execution

\`run_dag()\` in \`@fuzdev/fuz_util/dag.ts\` executes dependency-graph nodes
concurrently. Nodes declare dependencies via \`depends_on\`; independent nodes
run in parallel up to \`max_concurrency\`. Uses \`AsyncSemaphore\` for concurrency
and \`Deferred\` for dependency signaling.

\`\`\`typescript
import { run_dag, type DagNode } from '@fuzdev/fuz_util/dag.ts';

interface BuildStep extends DagNode {
	command: string;
}

const result = await run_dag<BuildStep>({
	nodes,
	execute: async (node) => {
		await run_command(node.command);
	},
	max_concurrency: 4,
	stop_on_failure: true // default
});

if (!result.success) {
	console.error(result.error); // e.g., "2 node(s) failed"
}
\`\`\`

\`DagNode\` is \`{id, depends_on?}\` extending \`Sortable\`
(\`@fuzdev/fuz_util/sort.ts\`, topological-sort validation). \`DagOptions\` adds
\`on_error\`/\`on_skip\`/\`should_skip\` hooks, \`max_concurrency\` (default
\`Infinity\`), \`stop_on_failure\` (default \`true\`), and \`skip_validation\`;
\`DagResult\` aggregates per-node results with counts and \`duration_ms\`.
Failed dependency nodes cascade — dependents are skipped with reason
\`'dependency failed'\`.

Also in \`async.ts\`: \`wait\` (promise delay), \`is_promise\` (thenable guard).
`},{slug:"code-generation",title:"Code Generation",content:"# Code Generation\n\nGro's code generation system (`.gen.*` files) in `@fuzdev/gro`.\n\nGen files produce source code at build time. Discovered by the `.gen.`\nfilename pattern, executed by `gro gen`, output committed alongside source.\n`gro gen --check` verifies no drift.\n\n## File Naming\n\nOutput file is produced by dropping the `.gen.` segment:\n\n| Gen file                          | Output file                |\n| --------------------------------- | -------------------------- |\n| `theme.gen.css.ts`                | `theme.css`                |\n| `css_classes_fixture.gen.json.ts` | `css_classes_fixture.json` |\n| `README.gen.md.ts`                | `README.md`                |\n\nThe gen source file always has a `.ts` extension (`.gen.ts`, `.gen.css.ts`, …).\nAn optional extension between `.gen.` and `.ts` overrides the output extension.\n\n### Naming rules\n\n- Exactly one `.gen.` segment per filename (duplicates are invalid)\n- At most one extension after `.gen.` (`.gen.css.ts` is valid, `.gen.foo.bar.ts` is not)\n- Output filename cannot equal the gen filename\n\n## Gen Types\n\nA gen file exports a `gen` value — either a function or a config object:\n\n```typescript\ntype Gen = GenFunction | GenConfig;\n```\n\nBoth importable from `@fuzdev/gro` or `@fuzdev/gro/gen.ts`.\n\n### GenFunction (simple form)\n\n```typescript\ntype GenFunction = (ctx: GenContext) => RawGenResult | Promise<RawGenResult>;\n```\n\n```typescript\n// theme.gen.css.ts — simple form\nimport type { Gen } from '@fuzdev/gro';\n\nexport const gen: Gen = ({ origin_path }) => {\n	const banner = `/* generated by ${origin_path} */`;\n	return `${banner}\\n:root { --my-var: 1; }\\n`;\n};\n```\n\n### GenConfig (with dependencies)\n\n```typescript\ninterface GenConfig {\n	generate: GenFunction;\n	dependencies?: GenDependencies;\n}\n```\n\n```typescript\n// highlight_priorities.gen.ts — config form with dependencies\nimport type { Gen } from '@fuzdev/gro';\n\nexport const gen: Gen = {\n	generate: ({ origin_path }) => {\n		return `// generated by ${origin_path}\\nexport const data = {};\\n`;\n	},\n	dependencies: { files: ['src/lib/theme_highlight.css'] }\n};\n```\n\n## GenContext\n\n| Property          | Type                  | Description                                                     |\n| ----------------- | --------------------- | --------------------------------------------------------------- |\n| `origin_id`       | `PathId`              | absolute path of the gen file                                   |\n| `origin_path`     | `string`              | `origin_id` relative to the project root                        |\n| `config`          | `GroConfig`           | the project's Gro configuration                                 |\n| `svelte_config`   | `Promise<ParsedSvelteConfig>` | parsed svelte.config.js (lazy — resolved on first access)  |\n| `filer`           | `Filer`               | filesystem tracker (file contents, dependency graph)            |\n| `log`             | `Logger`              | scoped logger                                                   |\n| `timings`         | `Timings`             | performance measurement                                         |\n| `invoke_task`     | `InvokeTask`          | invoke other Gro tasks                                          |\n| `changed_file_id` | `PathId \\| undefined` | set during dependency resolution; `undefined` during generation |\n\nMost used: `origin_path` (generated-by banners), `log`, and `filer`\n(reading source files).\n\n## Return Values\n\n```typescript\ntype RawGenResult = string | RawGenFile | null | Array<RawGenResult>;\n```\n\n### String — single file with default name\n\n```typescript\nexport const gen: Gen = () => {\n	return '// generated content\\n';\n};\n// theme.gen.css.ts → writes theme.css\n```\n\n### RawGenFile — single file with options\n\n```typescript\ninterface RawGenFile {\n	content: string;\n	filename?: string; // override output name (can be relative or absolute path)\n	format?: boolean; // run the formatter (default: true)\n}\n```\n\n```typescript\nexport const gen: Gen = () => {\n	return { content: '{\"key\": \"value\"}', filename: 'data.json', format: false };\n};\n```\n\nRelative `filename` resolves from the gen file's directory. Absolute paths\nwrite to that exact location (e.g., `blog.gen.ts` writes `static/blog/feed.xml`).\n\n### null — skip generation\n\n```typescript\nexport const gen: Gen = (ctx) => {\n	if (some_condition) return null; // produce no output\n	return 'content';\n};\n```\n\n### Array — multiple output files\n\nNested arrays are flattened:\n\n```typescript\nexport const gen: Gen = () => {\n	return [\n		{ content: 'export const A = 1;', filename: 'a.ts' },\n		{ content: 'export const B = 2;', filename: 'b.ts' }\n	];\n};\n```\n\nDuplicate output file IDs within a single gen file are invalid. A single gen\nfile can produce many output files — e.g., `skill_docs.gen.ts` generates a\nmanifest, per-skill data files, and per-page `+page.svelte` routes.\n\n## Dependencies\n\nControl when a gen file re-runs during watch mode. Without `dependencies`, it\nre-runs only when the gen file or its imports change (tracked by filer). Use\n`GenConfig` for broader triggers:\n\n```typescript\ntype GenDependencies = 'all' | GenDependenciesConfig | GenDependenciesResolver;\n```\n\n### 'all' — re-run on any change\n\nFor gen tasks that depend on the entire source tree rather than specific files:\n\n```typescript\nexport const gen: Gen = {\n	generate: async (ctx) => {\n		/* ... */\n	},\n	dependencies: 'all'\n};\n```\n\n### Config — patterns and files\n\n```typescript\nexport const gen: Gen = {\n	generate: ({ origin_path }) => {\n		/* ... */\n	},\n	dependencies: {\n		patterns: [/\\.svelte$/, /\\.ts$/],\n		files: ['src/lib/theme_highlight.css']\n	}\n};\n```\n\n`patterns` are tested against absolute paths. `files` can be relative\n(resolved to absolute) or absolute.\n\n### Function — dynamic resolution\n\nReceives `GenContext` and returns a config, `'all'`, or `null`.\n`changed_file_id` is set on context during dependency resolution:\n\n```typescript\ntype GenDependenciesResolver = (\n	ctx: GenContext\n) => GenDependenciesConfig | 'all' | null | Promise<GenDependenciesConfig | 'all' | null>;\n```\n\n## CLI Usage\n\n```bash\ngro gen              # run all gen files in src/\ngro gen src/lib/     # run gen files in a specific directory\ngro gen src/lib/foo.gen.ts  # run a specific gen file\ngro gen --check      # verify no drift (used by gro check and CI)\n```\n\nPositional args default to `['src']`; `--root_dirs` (default `[process.cwd()]`)\nresolves them. `gro gen --check` compares generated output against existing\nfiles and fails if any is new or changed — called by `gro check` as part of CI.\n\n## Common Patterns\n\n### CSS generation\n\nfuz_css utility classes are no longer a gen task in most projects — the\n`vite_plugin_fuz_css` Vite plugin scans source files, extracts CSS class usage\nvia AST, and exposes a bundled `virtual:fuz.css` module (with HMR) containing\nonly the classes, base styles, and theme variables actually used. See\n./css-patterns §Project Setup.\n\nThe Gro generator equivalent, `gen_fuz_css()` in a `fuz.gen.css.ts` (accepts\n`GenFuzCssOptions`), still writes a committed `fuz.css` file, but the plugin is\npreferred.\n\n### Theme CSS generation\n\n`fuz_css` uses `theme.gen.css.ts` to generate the full base theme:\n\n```typescript\nimport type { Gen } from '@fuzdev/gro';\n\nimport { default_themes } from './themes.ts';\nimport { render_theme_style } from './theme.ts';\n\nexport const gen: Gen = ({ origin_path }) => {\n	const banner = `/* generated by ${origin_path} -- DO NOT EDIT DIRECTLY! */`;\n	const theme = default_themes[0]!;\n	// the default theme's variables are the system's defaults, so they render\n	// into the base layer; runtime theme overrides beat them from fuz.theme\n	const theme_style = render_theme_style(theme, {\n		comments: true,\n		empty_default_theme: false,\n		layer: 'fuz.base'\n	});\n	return `${banner}\\n${theme_style}\\n`;\n};\n```\n\n### Library metadata\n\nAPI documentation metadata is no longer produced by a gen task. Instead the\n`svelte-docinfo` Vite plugin analyzes TypeScript and Svelte source files at\nbuild/dev time and exposes the result through `virtual:svelte-docinfo`. Add the\nplugin in `vite.config.ts` and build a `LibraryJson` at runtime with\n`library_json_from_modules` — see ./documentation-system for the full setup.\n\n```typescript\n// vite.config.ts\nimport svelte_docinfo from 'svelte-docinfo/vite.js';\n// ...plugins: [sveltekit(), svelte_docinfo()]\n```\n\nThere is no committed `library.gen.ts` or `library.json`; the only committed\nartifact is a small `src/routes/library.ts` that adapts the virtual module\n(see ./documentation-system).\n\n### Blog feed generation\n\n`fuz_blog` provides `blog.gen.ts` for Atom feeds, feed data, and slug routes:\n\n```typescript\nexport * from '@fuzdev/fuz_blog/blog.gen.ts';\n```\n\nConsumer projects re-export the gen. Returns an array of `feed.xml` (at an\nabsolute path in `static/`), `feed.ts`, and one `+page.svelte` per slug route.\n\n### Fixture generation\n\nTest fixtures can use gen files for snapshot data — fuz_css generates a JSON\nfixture of its class definitions this way:\n\n```typescript\nimport type { Gen } from '@fuzdev/gro';\n\nimport { css_class_definitions } from '$lib/css_class_definitions.ts';\n\nexport const gen: Gen = {\n	dependencies: 'all',\n	generate: () => {\n		return JSON.stringify(css_class_definitions);\n	}\n};\n// css_classes_fixture.gen.json.ts → css_classes_fixture.json\n```\n\n### Action codegen (zzz)\n\nGen files can generate TypeScript types from runtime registries. zzz reads\naction specs to produce typed collections, metatypes, and handler interfaces:\n\n```typescript\nimport type { Gen } from '@fuzdev/gro/gen.ts';\n\nimport { all_action_specs } from './action_specs.ts';\n\nexport const gen: Gen = ({ origin_path }) => `\n	// generated by ${origin_path}\n	export const ActionMethods = [\n		${all_action_specs.map((s) => `'${s.method}'`).join(',\\n')}\n	] as const;\n`;\n```\n\nzzz's real generators delegate the heavy lifting to fuz_app's\n`@fuzdev/fuz_app/actions/action_codegen.ts` helpers (`compose_gen_file`,\n`generate_action_method_enums`, …) over `all_action_specs`.\n\n### Multi-file route generation\n\nA single gen file can generate entire route trees. `skill_docs.gen.ts`\nauto-discovers skills and generates manifests, data files, and `+page.svelte` routes:\n\n```typescript\nimport type { Gen } from '@fuzdev/gro/gen.ts';\n\nexport const gen: Gen = ({ origin_path }) => {\n	// ... discover skills, read markdown ...\n	return [\n		{ content: manifest_content, filename: 'skills_manifest.ts' },\n		{ content: skill_data, filename: join(skill_route_dir, 'skill_data.ts') },\n		{ content: page_content, filename: join(skill_route_dir, '+page.svelte') }\n		// ... more files\n	];\n};\n```\n\nAll gen types import from `@fuzdev/gro/gen.ts`; `Gen` and `GenContext` are\nalso re-exported from `@fuzdev/gro` (the package index).\n"},{slug:"common-utilities",title:"Common Utilities",content:"# Common Utilities\n\nShared utilities from `@fuzdev/fuz_util`.\n\n## Result Type\n\n`@fuzdev/fuz_util/result.ts` — `Result<TValue, TError>` discriminated union\nfor error handling without exceptions. Uses intersection:\n`({ok: true} & TValue) | ({ok: false} & TError)`, so properties go directly\non the result object (not nested under `.value`/`.error` wrappers).\n\n```typescript\nimport type { Result } from '@fuzdev/fuz_util/result.ts';\nimport { unwrap } from '@fuzdev/fuz_util/result.ts';\n\nfunction parse_config(text: string): Result<{ value: Config }, { message: string }> {\n	try {\n		return { ok: true, value: JSON.parse(text) };\n	} catch (e) {\n		return { ok: false, message: e.message };\n	}\n}\n\n// Usage - discriminated union narrows via .ok\nconst result = parse_config(text);\nif (result.ok) {\n	console.log(result.value);\n} else {\n	console.error(result.message);\n}\n\n// Or unwrap (throws ResultError if not ok — requires {value} convention)\nconst config = unwrap(parse_config(text));\n```\n\n### Helper exports\n\n| Export           | Purpose                                                                                   |\n| ---------------- | ----------------------------------------------------------------------------------------- |\n| `OK`             | Frozen `{ok: true}` constant for results with no extra data                               |\n| `NOT_OK`         | Frozen `{ok: false}` constant for results with no extra data                              |\n| `unwrap()`       | Returns `result.value` if ok, throws `ResultError` if not                                 |\n| `unwrap_error()` | Returns the type-narrowed `{ok: false} & TError` result, throws if ok                     |\n| `ResultError`    | Custom `Error` subclass thrown by `unwrap`, carries `.result` and supports `ErrorOptions` |\n\n`unwrap_error` returns the entire failed result (not just a value) — the\nopposite of `unwrap` returning just `.value`.\n\n### Conventions\n\n- Spread data directly on the result: `{ok: true, ...data}` — not\n  `{ok: true, value: {data: ...}}`\n- Use `{value}` when `unwrap()` is expected; `{message}` for errors (used by\n  `ResultError`)\n- Prefer Result over throwing for expected errors (parsing, validation); use\n  exceptions for unexpected errors (programmer mistakes, system failures)\n\n## Error Helpers\n\n`@fuzdev/fuz_util/error.ts`:\n\n- **`to_error_message(value, fallback?)`** — normalizes an unknown caught\n  value to a string (`value.message` for `Error`, else\n  `fallback ?? String(value)`). The standard `catch (err)` normalizer.\n- **`unreachable(value: never)`** — exhaustive-match guard; throws\n  `UnreachableError`. Because `throw` isn't an expression, `unreachable(x)`\n  also works where an expression is required (ternaries, Svelte markup).\n- **`UnreachableError`** — the class `unreachable` throws; catchable\n  separately when a default case must be distinguishable.\n\n## Logger\n\nHierarchical logging via `@fuzdev/fuz_util/log.ts`:\n\n```typescript\nimport { Logger } from '@fuzdev/fuz_util/log.ts';\n\nconst log = new Logger('my_module');\nlog.info('starting');\nlog.debug('details', { data });\n\n// Child loggers inherit level, colors, and console from parent\nconst child_log = log.child('submodule'); // label: 'my_module:submodule'\nchild_log.info('connected'); // [my_module:submodule] connected\n```\n\n### Log Levels\n\nOverride via `PUBLIC_LOG_LEVEL` env var. Default detection order:\n\n1. `PUBLIC_LOG_LEVEL` env var (if set)\n2. `'off'` when running under Vitest\n3. `'debug'` in development (`DEV` from `esm-env`)\n4. `'info'` in production\n\nLevels ascending: `off` (0), `error` (1), `warn` (2), `info` (3), `debug` (4).\n\n### Inheritance\n\nNo static state — level, colors, and console are instance properties.\nChildren inherit from parent, so changing a parent's level affects children\nthat haven't set their own override.\n\n```typescript\nconst root = new Logger('app');\nconst child = root.child('db');\n\nroot.level = 'debug'; // child also becomes debug (inherits)\nchild.level = 'warn'; // child overrides, root unaffected\n\nchild.clear_level_override(); // child inherits from root again\nchild.clear_colors_override(); // child inherits colors from root again\nchild.clear_console_override(); // child inherits console from root again\n```\n\nThe `root` getter walks the parent chain to find the root logger, useful for\nsetting global configuration.\n\nColors automatically disabled when `NO_COLOR` or `CLAUDECODE` env vars are set.\n\n## Timings\n\nPerformance measurement via `@fuzdev/fuz_util/timings.ts`. Tracks multiple\nnamed timing operations; used in Gro's `TaskContext` for task performance.\n\n```typescript\nimport { Timings } from '@fuzdev/fuz_util/timings.ts';\n\nconst timings = new Timings();\n\n// start() returns a stop function\nconst stop = timings.start('operation');\nawait expensive_work();\nconst elapsed_ms = stop(); // returns elapsed milliseconds (does not log)\n\n// Nested timings\nconst stop_outer = timings.start('outer');\nconst stop_inner = timings.start('inner');\nawait inner_work();\nstop_inner();\nawait more_work();\nstop_outer();\n```\n\nDuplicate keys are auto-suffixed (`operation`, `operation_2`, …). `Timings`\nitself does not log — `print_timings(timings, log)` from\n`@fuzdev/fuz_util/print.ts` outputs the data at debug level.\n`create_stopwatch(decimals?)` is the lower-level single-timer primitive\n(call the returned function for elapsed ms; pass `true` to reset).\n\n## DAG Execution\n\n`@fuzdev/fuz_util/dag.ts` — `run_dag()` executes dependency graphs concurrently\n(nodes declare `depends_on`; independent nodes run in parallel up to\n`max_concurrency`). See ./async-patterns for the full DAG API (`DagOptions`,\n`DagResult`, `DagNode`) and concurrency primitives, and ./type-utilities for\nnominal typing and strict utility types.\n\n## DOM Helpers\n\n`@fuzdev/fuz_util/dom.ts` — browser DOM utilities.\n\n### `swallow`\n\nClaims an event by preventing its default action and stopping propagation —\n`swallow(event, immediate?, preventDefault?)`. The design principle (handling\nan event = claiming it) and usage guidance: ./svelte-patterns §Event\nHandling.\n\n### `handle_target_value`\n\nWraps an input event callback with value extraction and optional swallowing:\n\n```typescript\nimport {handle_target_value} from '@fuzdev/fuz_util/dom.ts';\n\n// Swallows by default (preventDefault + stopImmediatePropagation)\n<input oninput={handle_target_value((value) => { name = value; })} />\n\n// Without swallowing\n<input oninput={handle_target_value((value) => { name = value; }, false)} />\n```\n"},{slug:"css-patterns",title:"CSS Patterns",content:"# CSS Patterns\n\nfuz_css is three parts: **semantic styles** (classless element defaults),\n**style variables** (design tokens as CSS custom properties), and optional\n**utility classes** generated per-project with only the classes you use.\n\n## Default styling is the baseline\n\n**The single most common mistake is styling elements fuz_css already styles.**\nSemantic HTML comes fully dressed — headings are tiered (`h1`–`h6`), form\ncontrols share sizing and focus/hover/disabled states, `<code>`/`<pre>` use the\nmono font, `<aside>` is a callout, and **block elements space themselves\nvertically** via the flow-margin system: `p`, `ul`, `ol`, `menu`, `form`,\n`fieldset`, `table`, `details`, `textarea`, `select`, `label`, `pre`,\n`blockquote`, `aside`, `nav`, `legend` each get\n`margin-bottom: var(--flow_margin, var(--space_lg))` unless `:last-child` or\n`.unstyled`. So a stack of paragraphs, a heading followed by prose, a list under\na heading — all already have correct rhythm with **zero classes**.\n\nBefore adding any class or `<style>`, ask: _what specific gap in the defaults\ndoes this close?_ Hand-adding `mb_*`/`gap_*`/`p_*` to elements flow margin\nalready spaces, or re-declaring the color/font an element already carries, is\nchurn that fights the framework. This isn't stylistic — most fuz app source\nfiles have **no `<style>` block at all**, and where classes appear the\noverwhelming majority are a class or two, not long strings (empirical counts:\n§Component Styling In Practice).\n\nReach past the defaults only for genuine layout (flex rows/columns, grids),\nintent color (`palette_c` for a destructive button), or component-specific\nbehavior. The flex containers are the main reason to add classes at all —\ninside a `.row`, child flow margins reset to 0 (`.row > *` → `margin: 0`), so\nuse `gap_*` for spacing there.\n\n## The Styling Ladder\n\nWhen you _do_ style, work down this ladder and stop at the first rung that\nsuffices:\n\n1. **Semantic HTML** — the right element, no class. Often the whole job.\n2. **Built-in class conventions** — `.selected`, `.disabled`, `.palette_a`–\n   `.palette_j`, `.inline`, `.unstyled` — state/variant classes the semantic\n   styles already recognize.\n3. **Composite classes** — `box`, `row`, `column`, `panel`, `chip`, `ellipsis`\n   — one class for a whole layout pattern.\n4. **Token classes** — `p_md`, `gap_lg`, `color_a_50` — map to design tokens;\n   never hardcode spacing or color.\n5. **Literal classes** — `display:flex`, `width:100%`, `hover:opacity:80%` —\n   arbitrary `property:value`, including responsive/state modifiers.\n6. **`<style>` block with design tokens** — component-specific layout,\n   animation, complex selectors, theming APIs.\n\n**Rungs 3–5 are one tier in practice, not a strict frequency ranking.** They're\nall utility classes you mix freely on the same element. The ordering is a mild\npreference — reach for a composite when one _exactly_ matches (`row` over\n`display:flex align-items:center`), tokens for spacing/color, literals for\none-off layout. Empirically, spacing token classes (`mb_*`, `gap_*`, `p_*`) are\nthe single most-used class family, and **literal flex classes (`display:flex`,\n`flex:1`, `width:100%`) are as common as composites** — heavily used in app\ncode, not a rare last resort. The real cut points on the ladder are between\nrung 1 (semantic, no class) and the rest, and between rungs 1–5 (utility\nclasses) and rung 6 (`<style>` block).\n\nThe same hierarchy applies to text: `<small>` over\n`font-size: var(--font_size_sm)`, `<h2>` over a custom heading style, `<aside>`\nover a hand-built callout.\n\n### Direction matters — don't churn `<style>` into class soup\n\nThe ladder describes how to **author** from scratch, not a mandate to rewrite\n`<style>` blocks as classes. Pushing styling _up_ the ladder (a `<div\nclass=\"callout\">` → `<aside>`) is neutral-to-good; pushing it _down_ (a working\n`<style>` block → a 12-class string) is usually churn.\n\n- **Class → right semantic element** — good.\n- **Trivially-redundant `<style>` → composite/token** — good only when the\n  block's entire content is one composite's worth: `display: flex;\nflex-direction: column; gap: var(--space_md)` (→ `column gap_md`),\n  `display: flex; align-items: center; gap: …` (→ `row gap_*`), or a single\n  token-mappable value. Intent must survive the rewrite verbatim.\n- **Non-trivial `<style>` → long class string** — don't. If the block has\n  hover/focus state machines, animations, `@media`, parent-child selectors,\n  pseudo-element content, positioning, or theming-API variables, leave it. A\n  `<style>` block with design tokens reads better than a 12-class string, gets\n  IDE autocomplete, and survives conditional logic without `clsx` gymnastics.\n\n**When in doubt, don't churn an existing `<style>` block** — the author chose it\nbecause the styling exceeded \"simple.\"\n\n## Elements That Come Pre-Styled\n\n| Element                           | What you get without classes                                                             |\n| --------------------------------- | ---------------------------------------------------------------------------------------- |\n| `<h1>`–`<h6>`                     | Serif font, tiered sizes/weights, balanced text wrap, flow margins                       |\n| `<a>`                             | Link color, focus outline, `.selected` state                                             |\n| `<button>`                        | Fill, border, hover/active/focus/disabled/selected states                                |\n| `<button class=\"palette_a\">`      | Hue variants `palette_a` through `palette_j` (intent/status colors)                      |\n| `<input>`/`<textarea>`/`<select>` | Padding, border, focus outline, hover/disabled states; range, checkbox, radio all styled |\n| `<aside>`                         | Left border, tinted background, padding — callout/info box                               |\n| `<blockquote>`                    | Thick left border, padding                                                               |\n| `<code>`                          | Monospace, tinted background, padding; auto-inlines inside `<p>`                         |\n| `<pre>`                           | Monospace, overflow handling                                                             |\n| `<details>`/`<summary>`           | Pointer cursor, hover/active backgrounds                                                 |\n| `<table>`/`<th>`/`<td>`/`<tr>`    | Border-collapse, header alignment, cell padding, row hover                               |\n| `<small>`                         | `font-size: var(--font_size_sm)` — for metadata, secondary text                          |\n| `<kbd>`/`<samp>`                  | Monospace font                                                                           |\n| `<abbr title=\"...\">`              | Dotted underline                                                                         |\n| `<sub>`/`<sup>`                   | Baseline-aware sub/superscript                                                           |\n| `<hr>`                            | Themed double border with vertical spacing                                               |\n| `<img>`/`<svg>`/`<video>` etc.    | `display: block`, `max-width: 100%`, `height: auto`                                      |\n| `<ul>`/`<ol>`/`<menu>`            | Indented padding (`.unstyled` removes bullets and indent)                                |\n| `<label>`                         | Block layout, cursor pointer, `.selected`/`.disabled` states                             |\n| `<label> .title`                  | Bold, small bottom margin — field label inside a `<label>`                               |\n| `<fieldset>`/`<legend>`           | Column flex layout, larger legend text                                                   |\n\nLow-specificity `:where()` selectors carry all of this, so any class or style\noverrides it, regardless of import order.\n\n## Built-In Class Conventions\n\nState/variant classes authored into the semantic styles (`style.css`) — reach\nfor these before any utility class or custom CSS:\n\n| Class                     | Where it applies                                              | Effect                                                                                                 |\n| ------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |\n| `.selected`               | `button`, `a`, `label`, `.menuitem`                           | Filled selected appearance; `button`/`label` also switch to `cursor: default` (links stay interactive) |\n| `.deselectable`           | selected `button`, and the `selectable`/`menuitem` composites | Keeps interactivity on a selected element                                                              |\n| `.disabled`               | `label`                                                       | Muted color, default cursor                                                                            |\n| `.palette_a`–`.palette_j` | `button`                                                      | Palette variants (a=blue·accent, c=red·negative, etc.)                                                 |\n| `.inline`                 | `button`, `input`, `code`, `select`, `textarea`               | Inline-block display for use inside paragraph text                                                     |\n| `.unstyled`               | Most elements                                                 | Opts out of opinionated styling, keeps normalizations                                                  |\n\nA `<button class=\"palette_c selected\">` is already a \"selected destructive\naction\" — no hand-rolled state styling. (Size classes `sm`/`md`/`lg`/etc. read\nlike conventions but are composites that require extraction — see\n[Composite Classes](#composite-classes).)\n\n## Project Setup\n\n### Import Order\n\nImport CSS in `+layout.svelte` (`src/routes`). First import is universal; others\nas needed:\n\n```typescript\nimport 'virtual:fuz.css'; // generated bundled CSS (all projects)\nimport '@fuzdev/fuz_code/theme.css'; // package-specific themes (if any)\nimport './style.css'; // project-specific global styles (app projects)\n```\n\nThe layout already lives in `src/routes`, so the project `style.css` import\nis relative. Library/tool repos (fuz_css, fuz_ui, `gro`) omit the project\n`style.css`; application repos (fuz_template, fuz_blog, zzz) use all three.\n\n### CSS Generation\n\nCSS is generated on demand by the `vite_plugin_fuz_css` Vite plugin and imported\nas the `virtual:fuz.css` module — no committed `fuz.css` file. Ecosystem default\nfor any Vite project:\n\n```typescript\n// vite.config.ts\nimport { vite_plugin_fuz_css } from '@fuzdev/fuz_css/vite_plugin_fuz_css.ts';\nexport default defineConfig({ plugins: [vite_plugin_fuz_css()] });\n\n// src/routes/+layout.svelte (or main.ts)\nimport 'virtual:fuz.css';\n```\n\nDeclare the module type once in `src/app.d.ts`:\n\n```typescript\ndeclare module 'virtual:fuz.css' {\n	const css: string;\n	export default css;\n}\n```\n\nThe plugin supports HMR; tree-shaken bundled mode needs no options (a\ndev-only `prescan` option eagerly scans sources at server start so the first\nserved CSS is complete). fuz_css itself passes `additional_elements: 'all'`,\n`additional_variables: 'all'`, and a computed `additional_classes` list for\nits docs demos.\n\n**Gro generator alternative**: a `src/routes/fuz.gen.css.ts` exporting\n`gen_fuz_css()` writes a committed `fuz.css` genfile (regenerated via `gro\ngen`). Prefer the Vite plugin; reach for this only when a project can't run it.\n\n### Project `style.css`\n\nProject-specific global styles in `src/routes/style.css`: custom element\noverrides, patterns being prototyped before upstreaming to fuz_css, app-specific\nlayout (sidebar widths, nav heights). Keep minimal — most apps have near-empty\n`style.css` files.\n\n## Style Variables (Design Tokens)\n\nDefined in TypeScript, rendered to CSS. ~560 tokens; each can have `light`\nand/or `dark` values.\n\n### Colors\n\n10 palette hues, glossed by color name plus default intent binding:\n\n- `a` (blue · accent), `b` (green · positive), `c` (red · negative), `d`\n  (purple), `e` (yellow)\n- `f` (brown · neutral), `g` (pink), `h` (orange · caution), `i`\n  (cyan · info), `j` (teal)\n\nSemantic intent knobs alias meaning over the letters — `--hue_accent`,\n`--hue_positive`, `--hue_negative`, `--hue_caution`, `--hue_info`, plus\n`--hue_neutral`/`--neutral_chroma` for every surface/text/border tint. Each\nintent derives a full 13-stop scale (`--accent_00`–`--accent_100`) with\ntext/background token classes (`positive_50`, `bg_caution_10`) — prefer\nintent tokens over palette letters when the color carries meaning. Caveat:\nintent naming covers text/background token classes only — the button/chip\nvariant rung stays `.palette_a`–`.palette_j` (there is no `.negative` button\nclass), and the neutral has no `neutral_00`–`neutral_100` family (its scales\nare `shade_*`/`text_*`).\n\n**Intensity scale**: 13 stops, scheme-adaptive: `00`, `05`, `10`, `20`,\n`30`, `40`, `50`, `60`, `70`, `80`, `90`, `95`, `100`. Variables are\n`--palette_a_00` (nearest the background) → `--palette_a_50` (base) →\n`--palette_a_100` (highest contrast); the matching token classes are\n`color_a_00`–`color_a_100` — property-first, the letter implies the palette.\n\n### Color-Scheme Variants\n\n| Prefix      | Behavior                                       | Use case                       |\n| ----------- | ---------------------------------------------- | ------------------------------ |\n| `text_*`    | Opaque, scheme-aware (low=subtle, high=bold)   | Text (alpha hurts performance) |\n| `shade_*`   | Opaque, tinted neutrals (00→100), scheme-aware | Backgrounds, surfaces          |\n| `fg_*`      | Toward contrast (darkens light, lightens dark) | Foreground overlays that stack |\n| `bg_*`      | Toward surface (lightens light, darkens dark)  | Background overlays that stack |\n| `darken_*`  | Always darkens (agnostic, alpha-based)         | Shadows, backdrops             |\n| `lighten_*` | Always lightens (agnostic, alpha-based)        | Highlights                     |\n\nThese are **variable** families. `text_*`, `shade_*`, `darken_*`, and\n`lighten_*` also exist as classes, but `fg_*`/`bg_*` have no bare token\nclasses — the `bg_` class prefix means the *opaque* backgrounds (`bg_a_50`,\n`bg_positive_50`), so reach the adaptive overlays via literals\n(`background-color:var(--fg_10)`). `text_*` and `shade_*` are the everyday\nopaque, scheme-aware tokens — reach for them first; `fg_*`/`bg_*` overlays\nuse alpha and accumulate when nested. Both `shade_*` and `text_*` have\n`_min`/`_max` for untinted extremes (pure black/white). For a color that\ndoesn't adapt to the scheme, write the literal value or define one custom\nproperty (the old `_light`/`_dark` absolute variants were removed).\n\n### Sizes\n\n`xs5` → … → `xs` → `sm` → `md` → `lg` → `xl` → `xl2` → … → `xl15` (23 stops for\nspacing). Other families use subsets:\n\n- **Font sizes**: 13 stops (`xs`–`xl9`)\n- **Icon sizes**: 7 stops (`xs`–`xl3`, in px not rem)\n- **Border radii**: 7 stops (`xs3`–`xl`)\n- **Distances**: 5 stops (`xs`–`xl`, px — absolute widths: 200/320/800/1200/1600)\n- **Shadows, line heights**: 5 stops (`xs`–`xl`)\n\n### Additional Variable Families\n\n- **`border_color_*`**: alpha-based tinted borders (00–100). `outline_color_*`\n  is a class family over the opaque shade scale — there is no\n  `--outline_color_NN` variable family\n- **`shadow_alpha_*`**: shadow opacity scale (00–100)\n- **`border_width_*`**: numbered 1–9 (px)\n- **`duration_*`**: numbered 1–6 (0.08s to 3s)\n- **`hue_*`**: base hue values for each color (`hue_a` through `hue_j`)\n\n### Cascade Layers\n\nAll shipped CSS is layered: `fuz.base` (default variables + element styles) <\n`fuz.preferences` (OS user-preference mappings — `prefers-reduced-motion`\nzeroing durations, `prefers-contrast: more` bending lightness curves) <\n`fuz.theme` (theme overrides, where `render_theme_style()` renders) <\n`fuz.utilities` (generated classes). Consumers' unlayered styles beat\neverything. Colors are derived OKLCH (curve knobs → ramp stops → color stops,\ncomputed in pure CSS).\n\n### Cascading Variable Pattern\n\nMany token classes set both a CSS property **and** a cascading custom property,\nso children inherit the value:\n\n- `font_size_lg` → `font-size` + `--font_size`\n- `color_a_50` → `color` + `--text_color`\n- `border_color_30` → `border-color` + `--border_color`\n- `outline_a_50` → `outline-color` + `--outline_color` (focus rings key off it)\n- `shadow_color_umbra` → `--shadow_color`\n\nA child of `font_size_lg` can reference `var(--font_size)` for the inherited\nvalue.\n\n## Utility Classes\n\nThree types, generated on-demand:\n\n| Type                  | Example                               | Purpose                      |\n| --------------------- | ------------------------------------- | ---------------------------- |\n| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |\n| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |\n| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |\n\n### Token Classes\n\n- **Spacing**: `p_md`, `px_lg`, `mt_xl`, `gap_sm`, `mx_auto`, `m_0` — by far the\n  most-used family\n- **Text colors**: `text_70`, `text_min`, `color_a_50`\n- **Background colors**: `shade_00`, `darken_30`, `bg_a_50` (opaque `bg_`\n  prefix — the adaptive `--fg_*`/`--bg_*` overlays are variables-only:\n  `background-color:var(--fg_10)`)\n- **Typography**: `font_size_lg`, `font_family_mono`, `line_height_md`, `icon_size_sm`\n- **Layout**: `width_md` (space scale), `top_sm`, `inset_md`, and the\n  **distance-scale** sizers `width_atmost_lg`/`width_atleast_sm`/`height_atmost_md`\n  — these emit `width: 100%; max-width: var(--distance_*)` (px caps: 200–1600),\n  distinct from `width_md` which maps to the space scale\n- **Borders**: `border_radius_xs`, `border_width_2`, `border_color_30`\n- **Shadows**: `shadow_md`, `shadow_top_md`, `shadow_inset_xs`, `shadow_alpha_50`,\n  `shadow_color_umbra` (also `_highlight`, `_glow`, `_shroud`)\n- **Hue**: `hue_a` through `hue_j` (sets `--hue`; currently an unconsumed\n  consumer hook — nothing in shipped CSS reads `--hue` yet)\n\n### Composite Classes\n\n| Class                    | What it does                                                                                          |\n| ------------------------ | ----------------------------------------------------------------------------------------------------- |\n| `box`                    | Flex column, items centered, justify centered                                                         |\n| `row`                    | Flex row, align-items centered (overrides `box` direction)                                            |\n| `column`                 | Flex column (like `box` but uncentered)                                                               |\n| `panel`                  | Embedded container with tinted background and border-radius                                           |\n| `pane`                   | Floating container with opaque background and shadow                                                  |\n| `ellipsis`               | Block with text truncation (nowrap, overflow hidden, ellipsis)                                        |\n| `chip`                   | Inline label styling (font/padding/bg/radius + `palette_X` hues); display comes from the host element |\n| `menuitem`               | Full-width list item with icon, title, and selected state                                             |\n| `icon_button`            | Square button sized to `--input_height` (flex-shrink: 0)                                              |\n| `selectable`             | Button-like fill with hover/active/selected states                                                    |\n| `clickable`              | Hover/focus/active scale transform effects (includes state styles)                                    |\n| `plain`                  | Transparent border/fill/shadow when not hovered                                                       |\n| `chevron`                | Small right-pointing arrow via CSS border trick                                                       |\n| `circular`               | `border-radius: 50%`                                                                                  |\n| `pixelated`              | Crisp pixel-art image rendering                                                                       |\n| `xs`/`sm`/`md`/`lg`/`xl` | **Size composites** — see below                                                                       |\n\n**Size composites cascade to a subtree.** `xs`/`sm`/`md`/`lg`/`xl` are a\nfive-member family at fixed step offsets from the `md` default. Put one on any\n**container** and it rescales that subtree's `--font_size`, `--input_height`,\n`--icon_size`, padding, **and `--flow_margin`** in lockstep — so a `sm` panel\ngets tighter controls, chips, icons, and vertical rhythm together (headings\nand prose keep their font sizes — each `hN` re-sets `--font_size` on itself\nand body text never reads it). `md` resets to\ndefault within an already-sized parent. This is the idiomatic way to make a\nwhole region denser or roomier without touching individual elements.\n\n**Gotcha**: composites with rulesets (`clickable`, `selectable`, `menuitem`,\n`plain`, `chip`) already include their state styles — `hover:clickable` is\nredundant. Several composites see near-zero real use (`circular`, `pixelated`,\n`pane`, `chevron`); the load-bearing ones are `row`, `column`, `box`, `panel`,\n`chip`, `menuitem`.\n\n### Literal Classes\n\n`property:value` maps directly to CSS:\n\n```svelte\n<div class=\"display:flex justify-content:center gap:var(--space_md)\">\n```\n\n**Space encoding**: `~` for spaces in multi-value properties:\n\n```svelte\n<div class=\"margin:0~auto padding:var(--space_sm)~var(--space_lg)\">\n<div class=\"width:calc(100%~-~20px)\">  <!-- calc requires ~ around +/- -->\n```\n\nIf you need more than 2–3 `~` characters, use a `<style>` block instead.\n\nCustom-property literals work too — `--flow_margin:0`, `--button_shadow:none`\n— the general escape hatch onto any theme/base variable hook without a token\nclass.\n\n## Modifiers\n\nState/responsive/color-scheme styling that inline styles can't do, prefixed onto\na literal class. Each maps 1:1 to a CSS pseudo-class or at-rule (`hover:` →\n`:hover`, `disabled:` → `:disabled`, `print:` → `@media print`, `before:` →\n`::before`), so the full list is inferable; the exhaustive registry lives in\nfuz_css's `modifiers.ts`. The stack-specific parts worth knowing:\n\n```svelte\n<button class=\"hover:opacity:80% focus:outline:2px~solid~var(--palette_a_50)\">\n<div class=\"display:none md:display:flex\">          <!-- responsive -->\n<div class=\"box-shadow:var(--shadow_lg) dark:box-shadow:var(--shadow_sm)\">\n<div class='before:content:\"\" before:display:block'> <!-- pseudo needs explicit content -->\n```\n\n- **Responsive breakpoints**: `sm:` (40rem), `md:` (48rem), `lg:` (64rem), `xl:`\n  (80rem), `2xl:` (96rem). Also `max-sm:`…, and arbitrary `min-width(800px):` /\n  `max-width(600px):`.\n- **Ancestor**: `dark:` / `light:` (color scheme).\n- **Order**: `[media]:[ancestor]:[state...]:[pseudo-element]:property:value` —\n  and **multiple states must be alphabetical** (`focus:hover:…`, not\n  `hover:focus:…`), which the parser enforces.\n\n**In practice, modifier classes are rare in real code.** Responsive layout is\noverwhelmingly done with `@media` in component `<style>` blocks, and hover/focus\nstates ride on stateful composites (`clickable`, `selectable`, `menuitem`,\n`plain`) or `<style>`. The modifier system is fully available and correct, but\nconvention favors `<style>` for anything beyond an occasional one-off literal\nstate.\n\n## Class Extraction\n\nClasses are extracted via AST parsing at build time from:\n\n- `class=\"...\"` attributes\n- `class={[...]}` and `class={{...}}` (Svelte 5.16+)\n- `class:name` directives\n- `clsx()`, `cn()`, `cx()`, `classNames()`, `classnames()` calls\n- variables whose names end in `class`/`classes`/`className(s)`/`classList(s)`\n\nCSS variables are additionally caught by a `var(--name)` regex scan (only known\ntheme variables are included; unknown ones silently ignored), which catches\nusage in component props like `size=\"var(--icon_size_xs)\"` that AST extraction\nwould miss.\n\n### Comment hints for the dynamic cases\n\nWhen a class/element/variable is constructed dynamically and the extractor can't\nsee it statically, declare it explicitly:\n\n```typescript\n// @fuz-classes opacity:50% opacity:75% opacity:100%\n// @fuz-elements button input textarea\n// @fuz-variables shade_40 text_50\n```\n\nBehavior: auto-detected-but-unresolvable classes/elements/variables are\n**silently skipped** (they may belong to another framework); an explicit\n`@fuz-*` entry that can't be resolved is an **error** with typo suggestions via\nstring similarity. Outside fuz_css's own docs site, AST extraction handles\nalmost everything and `@fuz-*` hints are rarely needed.\n\n## Dynamic Theming\n\n### Runtime Variable Overrides\n\nComponents expose CSS variables as their theming API. On DOM elements, use\nSvelte's `style:` directive; on components, the custom-property shorthand —\n`style:` is invalid on component tags:\n\n```svelte\n<div style:--docs_menu_width={width}>\n<PendingAnimation --font_size=\"var(--font_size_xl5)\" />\n```\n\n### Color Scheme\n\nDark/light mode is a `dark`/`light` class on the root element. `style.css`\nincludes `:root.dark { color-scheme: dark; }` / `:root.light { color-scheme:\nlight; }`. Persistence and system-preference handling live in fuz_ui's\n`ThemeState` class and `ThemeRoot` component.\n\n### Theme Switching\n\nOne registered theme (`base`); low/high contrast are `contrast_modifiers`\ncomposed over any theme via `compose_themes`, and shipped-but-unregistered\nexemplars (`necromancer`, `sunset_ember`, `brutalish`, `terminalien` — some\ndark-only via `scheme`) show the range. Custom themes are arrays of\n`StyleVariable` overrides. Theme CSS is rendered via `render_theme_style()`\ninto the `fuz.theme` cascade layer, which beats `fuz.base` by layer order —\noverriding bundled theme variables regardless of insertion order or\nspecificity. The generators also take a build-time `theme` option that bakes\na theme into the bundled CSS with no JS shipped; the runtime `ThemeRoot` path\ncomposes on top (runtime wins by layer order).\n\n## Component Styling In Practice\n\nEverything above lands as one principle for component authors: **components\nshould have minimal custom CSS, delegating to fuz_css.** Across fuz_ui's 67\ncomponents, 28 (~42%) have no `<style>` block at all — and fuz_ui is a component\nlibrary, the styling-heaviest code in the ecosystem. Application code skews far\nmore classless (zzz's library ~82% style-free, mdz's 100%). Where a `<style>`\nblock exists it's usually\n5–30 lines (median ~16), with a tail up to ~90 for layout-heavy components\n(cards, dialogs, nav bars). Shared traits of well-styled components:\n\n- **No `<style>` block when possible** — styling from semantic HTML + utilities\n- **When `<style>` exists, it's component-specific** — positioning, transitions,\n  responsive breakpoints, complex parent-child selectors\n- **All colors/spacing/typography from design tokens** — never hardcoded\n- **Layout uses composites/utilities** — `box`, `row`, `column`, `panel`,\n  `gap_lg` over manual flex\n- **Stateful styling is conventional** — `class={{selected: …}}` rides on the\n  built-in `.selected` rules\n\n```svelte\n<!-- No <style> needed — semantic HTML + utility classes -->\n<aside class=\"column gap_md\">\n	<h2>{title}</h2>\n	<small class=\"text_50\">{subtitle}</small>\n	<p>{description}</p>\n	<button class=\"palette_a\">Confirm</button>\n	<button class={['palette_c', { selected: destructive }]}>Delete</button>\n</aside>\n```\n\nfuz_ui's `Details.svelte` and `EcosystemLinks.svelte` are real examples: pure\nsemantic HTML (`<details>`, `<summary>`, `<ul>`, `<a>`, `<p>`) riding on the\ndefault element styling, no `<style>` block.\n\n### Anti-Patterns\n\nEach of these signals a component doing work fuz_css already does:\n\n```svelte\n<!-- BAD: rebuilding what <small>/<aside> already do -->\n<span class=\"subtitle\">{text}</span>          <!-- GOOD: <small class=\"text_70\"> -->\n<div class=\"info-box\">{message}</div>         <!-- GOOD: <aside> -->\n\n<!-- BAD: manual flex in <style> -->\n<div class=\"container\">…</div>                <!-- GOOD: <div class=\"column gap_md\"> -->\n<style>.container { display: flex; flex-direction: column; gap: var(--space_md); }</style>\n\n<!-- BAD: hand-rolled destructive button -->\n<button class={['delete-btn', {active}]}>Delete</button>\n<!-- GOOD: <button class={['palette_c', {selected: pending}]}>Delete</button> -->\n\n<!-- BAD: hardcoded pixels -->\n<style>.sidebar { width: 220px; padding-top: 40px; }</style>\n<!-- GOOD: <style>.sidebar { width: var(--sidebar_width); padding-top: var(--space_xl2); }</style> -->\n```\n\nIf multiple components each define their own `.sidebar`/`.header`/`.content`\nwith the same flex/padding, those belong in composites, project `style.css`, or\nutility classes — not repeated per component.\n\n### When Custom CSS IS Justified\n\n- **Complex interactive states** — multi-property hover/active/selected,\n  `color-mix` shadows, parent-child selectors like `.parent:hover .child`\n  (fuz_ui's `Hashlink.svelte` is the canonical parent-hover-reveal example)\n- **Structural behavior** — `flex-direction: column-reverse` for bottom-up\n  scroll, `position: sticky/absolute/fixed` with calculated offsets\n- **Responsive layouts** — `@media` queries for structural changes\n- **Animations/transitions** — `@keyframes`, `transition`\n- **Rendering contexts** — canvas, 3D, custom-layout surfaces\n- **Theming APIs for children** — declaring CSS custom properties consumers\n  override via `style:` on elements or `--prop={v}` on the component\n  (e.g. `Alert.svelte` exposes `--text_color`)\n\nEven justified custom CSS uses design tokens (`var(--space_md)`), not hardcoded\nvalues.\n\n### Project `style.css` for shared app patterns\n\nWhen a pattern recurs across components in one app but isn't general enough for\nfuz_css, put it in the project's `src/routes/style.css` — the right home for\napp-scoped shared classes (button variants, layout columns, scroll shadows).\nMark candidates with `// TODO upstream` if they might belong in fuz_css. Keeps\ncomponent `<style>` blocks focused and avoids premature generalization.\n\n### Class Naming\n\nTwo naming systems coexist:\n\n- **fuz_css design tokens**: `snake_case` — `p_md`, `color_a_50`, `gap_lg`. The\n  global vocabulary.\n- **Component-local classes**: `kebab-case` — `site-header`, `nav-links`,\n  `character-entry`. Distinguishes component-scoped styles from design-system\n  classes at a glance.\n\n```svelte\n<!-- snake_case = fuz_css utility, kebab-case = component-local -->\n<div class=\"column gap_md site-header\">\n	<nav class=\"row gap_sm nav-links\">…</nav>\n</div>\n\n<style>\n	.site-header {\n		position: sticky;\n		top: 0;\n		z-index: 10;\n	}\n	.nav-links {\n		border-bottom: var(--border_width_1) var(--border_style) var(--border_color);\n	}\n</style>\n```\n\nkebab-case for component-local classes is the **target** convention, fully\nadopted in zzz and fuz_ui; the fuz_css and fuz_docs docs sites still lean\n`snake_case` for local classes and haven't been migrated. New code should use\nkebab-case.\n\n## When to Use Classes vs Styles\n\n| Need                                      | Utility class | Style tag       | Inline style   |\n| ----------------------------------------- | ------------- | --------------- | -------------- |\n| Simple layout (`row`, `column`, `gap_*`)  | **Preferred** | Overkill        | No             |\n| Design tokens on own elements (1–4 props) | **Yes**       | OK              | OK             |\n| Non-trivial own-element styling           | OK            | **Preferred**   | No             |\n| Style child components                    | **Yes**       | No              | Limited        |\n| Hover/focus/active state machines         | Limited       | **Preferred**   | No             |\n| `@media` responsive layout                | Limited       | **Preferred**   | No             |\n| Animations, transitions, keyframes        | No            | **Preferred**   | No             |\n| Parent-child / sibling selectors          | No            | **Only option** | No             |\n| Theming API (CSS vars consumers override) | No            | **Yes**         | Yes (override) |\n| Runtime dynamic values                    | No            | No              | **Yes**        |\n\n**One heuristic the table doesn't capture: long class strings are a smell.** 4–6\nclasses is the comfortable upper bound (98%+ of real class attributes are ≤6\ntokens); 8+ (especially several literal `property:value` classes) usually reads\nworse than the equivalent `<style>` block with design tokens, which also gets\nIDE autocomplete and composes with conditional logic without `clsx` gymnastics.\nAnd per §Direction matters, don't churn _existing_ `<style>` blocks into class\nstrings.\n"},{slug:"db-patterns",title:"Database Query Patterns",content:`# Database Query Patterns

**Applies to**: any module that reads or writes Postgres rows — \`fuz_app\`'s
\`auth/*_queries.ts\` / \`db/*_queries.ts\`, the spine crates' \`*_queries.rs\`
(\`fuz_auth\`, \`fuz_cell\`, …), and a consumer's own tables on either spine.
Hand-written SQL by design: no query builder, no ORM — the strings stay
planner-visible, pglet-compatible, and readable across the TS ↔ Rust twin
(./twin-impl).

## Query module shape

One module per table. Every function is \`query_<table>_<verb>\`, takes
\`deps: QueryDeps\` (\`{db}\`) first, has no audit side effects, and returns the
affected row (or \`null\` / \`None\` for not-found) from mutations.

\`\`\`ts
export const query_invite_delete_unclaimed = async (
	deps: QueryDeps,
	id: Uuid
): Promise<Invite | null> => {
	const row = await deps.db.query_one<Invite>(
		\`DELETE FROM invite WHERE id = $1 AND claimed_at IS NULL
		 RETURNING \${columns_sql(INVITE_COLUMNS)}\`,
		[id]
	);
	return row ?? null;
};
\`\`\`

- **Values are parameterized, never interpolated.** Only column references,
  \`$N::type\` placeholders, and projection consts are template-inserted.
  Dynamic identifiers (a table name in a DDL/TRUNCATE) pass through
  \`assert_valid_sql_identifier\` first.
- **\`INSERT … RETURNING\` rows pass through \`assert_row(row, context)\`** —
  a missing row on an insert is a bug, not a not-found.
- **Unique violations surface as the Postgres \`23505\`** (\`is_pg_unique_violation\`);
  the handler, not the query, translates it to a wire error.
- **Transactions are the caller's** — a query takes whatever \`db\` it is
  handed (pool or transaction client) and never opens its own.

Rust mirrors this: \`query_<table>_<verb><C: GenericClient + ?Sized>(client: &C, …)\`,
\`Result<Row, CrateError>\` / \`Result<Option<Row>, …>\`, the driver error
wrapped in the crate's \`thiserror\` variant.

## Named-column projections

Every read — \`SELECT\` and \`RETURNING\` — projects through the table's
exported column const. Never \`SELECT *\`.

\`\`\`ts
/** The full \`invite\` column set … keep in sync with \`Invite\` and the DDL. */
export const INVITE_COLUMNS = [
	'id',
	'email',
	'username',
	'claimed_by',
	'claimed_at',
	'created_at',
	'created_by'
] as const;
\`\`\`

Why: \`SELECT *\` silently omits a dropped column, the hydrated row reads it
as \`undefined\`, and a \`deleted_at === null\` filter then rejects every row —
a silent total outage instead of an error. A named projection turns the
same drift into a loud Postgres \`column "…" does not exist\` at the first
read. It also keeps a leftover column from riding a strict wire schema.

The const is a column-name array; SQL text is rendered **at the read site**
from \`db/sql_columns.ts\`:

| Helper                             | Use                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| \`columns_sql(COLS)\`                | single-table reads + \`RETURNING\` → \`a, b, c\`                                                                                                  |
| \`qualify_columns(COLS, 'i')\`       | reads that alias the table (JOINs) → \`i.a, i.b, i.c\`                                                                                          |
| \`omit_columns(COLS, 'token_hash')\` | a client-safe subset — throws on an unknown name so a typo can't keep the secret column on the wire (\`as const\` makes it a compile error too) |
| \`iso8601_timestamp_expr(COLS, ['created_at'])\` | the \`expr\` override projecting the named timestamp columns through \`iso8601_timestamp_column\`; curried by alias, throws on a name outside \`COLS\` |

Derived columns that aren't table columns (a correlated \`COUNT(*) AS
grant_count\`) are **appended as expressions** next to the rendered const,
never added to it — the const must be exactly the table's column set so
the drift guard below can compare it to the schema.

Don't spell a second column list anywhere: not a module-level "qualified
copy", not a per-site subset. Derive from the one const so one guard
covers every projection.

## The drift guard (both directions)

The projection makes a _dropped_ column fail loud. A column _added_ to the
DDL but not to the const would silently vanish from every read — so each
const is asserted against the live \`public\` schema in the module's
\`.db.test.ts\`:

\`\`\`ts
describe_db('InviteQueries', (get_db) => {
	test('INVITE_COLUMNS names every live \`invite\` column', async () => {
		await assert_columns_match_live(get_db(), 'invite', INVITE_COLUMNS);
	});
});
\`\`\`

\`assert_columns_match_live\` (from \`testing/db.ts\`) reads
\`information_schema\` via \`query_public_columns\` and \`deepEqual\`s the sorted
const — a live DB is the only truth for the migration chain's end state
(the base DDL string isn't, once migrations append \`ALTER TABLE\`s). The
\`/ready\` deploy gate covers the same drift at deploy time by column
presence; this guard covers it at development time, per table, in both
directions.

A consumer adding its own tables follows the identical shape: one const,
render at the site, one guard test — no registration step.

## Rust twin

Same discipline, same identifiers, one extra rule.

\`\`\`rust
/// The \`cell_grant\` table's columns, in projection order.
pub const CELL_GRANT_COLUMNS: [&str; 8] = [
    "id", "cell_id", "level", "actor_id", "role", "scope_id", "granted_by", "created_at",
];

fn grant_columns(alias: &str) -> String {
    qualify_columns(
        &CELL_GRANT_COLUMNS,
        alias,
        iso8601_timestamp_expr(&CELL_GRANT_COLUMNS, &["created_at"], alias),
    )
}

fn decode_grant_row(row: &tokio_postgres::Row) -> Result<CellGrantRow, CellError> {
    Ok(CellGrantRow {
        id: row.get(col!(CELL_GRANT_COLUMNS, "id")),
        cell_id: row.get(col!(CELL_GRANT_COLUMNS, "cell_id")),
        // … each index resolved by name at compile time …
    })
}
\`\`\`

- \`fuz_db::qualify_columns(&COLS, alias, expr)\` renders the const qualified
  by \`alias\` (always qualified — one const serves single-table reads and
  aliased JOINs; pass the table name for a bare-table read or \`RETURNING\`),
  with \`expr\` overriding individual columns for the \`::text\` casts and the
  \`iso8601_timestamp_column\` projection the wire shape needs.
  \`fuz_db::omit_columns(&COLS, &["token_hash"])\` narrows a const for a
  client-safe or payload-free read — derived, so the base const's guard
  still covers it, and it panics on an unknown name so a typo can't keep
  the column it meant to hide.
- **Timestamps project through one call, not a hand-written \`match\`** —
  \`fuz_db::iso8601_timestamp_expr(&COLS, &["created_at"], alias)\` builds the
  \`expr\` override for every timestamp the wire shape needs, and panics on a
  name outside \`COLS\` (the same hazard \`omit_columns\` guards: a misspelled
  timestamp would silently ship a raw Postgres timestamp). The TS twin is
  \`iso8601_timestamp_expr(COLS, ['created_at'])\`, curried by alias because TS
  reads rows by name. A projection that *also* overrides a non-timestamp
  column keeps its \`match\` and falls through — bind the closure to a local
  outside the \`match\`: the returned closure borrows the \`&["…"]\` slice
  literal, and a temporary built inside an arm dies at the end of that arm:

  \`\`\`rust
  let timestamps = iso8601_timestamp_expr(&CELL_COLUMNS, &["created_at"], alias);
  qualify_columns(&CELL_COLUMNS, alias, |col| match col {
      "data" => Some(format!("{alias}.data::text")),
      _ => timestamps(col),
  })
  \`\`\`
- **Decode is positional on the wire, name-checked at compile time** —
  through **one decoder per row shape**, each index resolved by
  \`fuz_db::col!\` against the const:
  \`row.get(col!(CELL_GRANT_COLUMNS, "level"))\`. The macro is
  \`const { column_index(&COLS, "level") }\` sugar — zero runtime cost, a
  name the const doesn't carry is a compile error, and the decoder follows
  the const however it's edited (insert / reorder / append freely; the
  guard compares sets, not order). A newly added column is simply unread
  until its struct field lands. A CTE / JOIN read appends its extra
  expressions after the const's columns and indexes them from
  \`COLS.len()\`, which also follows. Never write a bare integer index
  against a const-driven projection.
- **Derived (narrowed) projections** — a client-safe listing that omits
  \`token_hash\`, a metadata read that skips the payload — are *literal*
  consts the decoder \`col!\`s into, pinned to their derivation by a unit
  test: \`assert_eq!(API_TOKEN_CLIENT_COLUMNS.to_vec(),
  omit_columns(&API_TOKEN_COLUMNS, &["token_hash"]))\`. The base const's
  drift guard covers them through the pin.
- **Purpose rows.** Rust reads deliberately narrow rows the TS twin
  doesn't (\`AccountRow\` is an identity pair, not the table). Give each
  such shape its own private \`const <SHAPE>_COLUMNS\` + decoder next to
  the table const, decode via \`col!\`, and unit-check it as a subset with
  \`fuz_db::columns_not_in(&SHAPE, &TABLE)\` — the rule is *one list per
  shape*, never a column list typed at a call site. Scalar reads
  (\`RETURNING id\`, \`SELECT EXISTS(…)\`) and single-site join shapes whose
  projection is spelled inline next to their decoder stay literal.
- The drift guard is a crate integration test, \`tests/columns.rs\`, over
  \`fuz_db::query_ready_columns\` — \`#[ignore]\`-gated like the crate's other
  Postgres tests: every live table in the chains the fixture runs is a
  const or a reasoned exemption, and each const names exactly its live
  columns. Each spine crate exports a \`fuz_db::ColumnProjections\` set per
  migration chain (\`AUTH_COLUMN_PROJECTIONS\`, \`CELL_COLUMN_PROJECTIONS\`,
  \`CELL_HISTORY_COLUMN_PROJECTIONS\`, \`FACT_COLUMN_PROJECTIONS\`; \`fuz_db\`'s
  \`DB_COLUMN_PROJECTIONS\` covers \`schema_version\`), and the test composes
  the sets for the chains it migrates plus its own tables:
  \`column_projection_mismatches_merged(&live, &[DB_COLUMN_PROJECTIONS,
  AUTH_COLUMN_PROJECTIONS, …, OWN])\`. Never copy a spine chain's
  table→const list into a consumer — compose the exported set, so a spine
  table addition reaches every registry through one edit.
- Identifiers match the TS side exactly (\`CELL_GRANT_COLUMNS\`,
  \`qualify_columns\`, \`omit_columns\`) per ./twin-impl — the const is
  the same array on both spines, so column order can be diffed by eye.

## Anti-patterns

- \`SELECT *\` / \`RETURNING *\` on any table read, "mapper-fed" or not — the
  mapper narrows the wire, not the read.
- A second column list (a qualified copy, a \`SELECT id, name\` typed at one
  site) — it drifts independently of the guarded const.
- Folding a derived expression into the const.
- Hand-editing a projection to "fix" a failing drift test — the test is
  telling you the DDL and the const disagree; decide which is right.

## Related

- ./testing-patterns — \`describe_db\`, database factories, \`.db.test.ts\`.
- ./rust-spine — the spine crate map the Rust query modules live in.
- ./twin-impl — identifier parity and convergence between the two spines.
`},{slug:"dependency-injection",title:"Dependency Injection",content:`# Dependency Injection

Typed interfaces for side effects, real implementations as defaults, accepted as
params, tested with plain object mocks. No \`vi.mock\` — dependencies flow through
function signatures. The goal is optimal testable TypeScript that is
runtime-independent (Deno / Node / tests) via simple parameterization, not
magic mocks or ambient singletons.

## Convention

**Small standalone \`*Deps\` interfaces, composed bottom-up.** Replaces
\`Pick<GodType>\` narrowing.

### Bottom-up composition

Define small focused interfaces; leaf functions import them directly. The entry
point assembles app-level composites for wiring and threads them down, but leaf
functions never take the composite as a param.

\`\`\`typescript
// Small standalone interfaces (fuz_app's runtime layer is the exemplar)
export interface EnvDeps {
	env_get: (name: string) => string | undefined;
	env_set: (name: string, value: string) => void;
}

export interface FsReadDeps {
	stat: (path: string) => Promise<StatResult | null>;
	read_text_file: (path: string) => Promise<string>;
	read_file: (path: string) => Promise<Uint8Array>;
	read_text_from_offset: (path: string, offset: number) => Promise<ReadTextFromOffsetResult>;
	readdir: (path: string) => Promise<Array<string>>;
}

export interface CommandDeps {
	run_command: (
		cmd: string,
		args: Array<string>,
		options?: RunCommandOptions
	) => Promise<CommandResult>;
}

// Functions declare exactly what they need via intersection
export const setup_env_file = async (
	deps: FsReadDeps & FsWriteDeps & CommandDeps,
	env_path: string,
	example_path: string
): Promise<void> => {
	/* ... */
};

// App-level composite — for the wiring layer only
export interface RuntimeDeps
	extends
		EnvDeps,
		FsReadDeps,
		FsWriteDeps,
		FsRemoveDeps,
		FsStreamDeps,
		CommandDeps,
		TerminalDeps,
		ProcessDeps,
		LogDeps,
		FetchDeps {
	env_all: () => Record<string, string>;
	readonly args: ReadonlyArray<string>;
	cwd: () => string;
	run_command_inherit: (cmd: string, args: Array<string>) => Promise<number>;
}
\`\`\`

Platform factories construct the composite once at the entry point:
\`create_deno_runtime(args)\`, \`create_node_runtime(args)\`,
\`create_mock_runtime(args)\` (test implementation with observable state).
Any object that structurally satisfies the interface works. There is no
browser factory — browser/component-tree DI is Svelte context, a different
mechanism (see "Scope" below).

### Why standalone interfaces beat Pick<GodType>

\`Pick<AppRuntime, 'env_get'>\` forces every consumer to import the god type.
Small standalone interfaces avoid this:

- **Shareable**: any project can import \`EnvDeps\` without pulling app types
- **Trivial mocks**: \`{env_get: () => 'value', env_set: () => {}}\` — no factory needed
- **Composable**: \`FsReadDeps & CommandDeps\` for multi-dep functions
- **Self-documenting**: the interface IS the dependency contract

\`Pick<>\` on a _small_ \`*Deps\` interface is fine (minimal coupling); the
anti-pattern is \`Pick<GodType>\`. A \`Pick<>\` narrowing reused across many
call sites is a named interface waiting to happen — fuz_app's action
factories take a standalone \`ActionFactoryDeps {log, audit}\` interface
(\`auth/deps.ts\`) rather than repeating
\`Pick<RouteFactoryDeps, 'log' | 'audit'>\` at a dozen sites.

### Bundles vs single capabilities

\`*Deps\` names the injected **bundle** — a record of capabilities a function
needs. The _members_ of a bundle are often pure-noun service interfaces or
classes (\`Keyring\`, \`Logger\`, \`AuditEmitter\`, \`FactStore\`), and a standalone
single-capability interface keeps its noun name too — fuz_util's \`FactStore\`
("interface only — backends live downstream") is the worked example. Don't
suffix a single service interface with \`Deps\`; the suffix marks the
parameter-bundle role.

## Parameter Type Suffixes

Three suffixes for single-object parameters, each with distinct test behavior:

| Suffix     | What it contains                    | Test behavior                              | Rule                                                |
| ---------- | ----------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| \`*Deps\`    | Capabilities (functions, services)  | Fresh mock factories per test case         | Things you swap for testing or platform abstraction |
| \`*Options\` | Data (config values, limits, flags) | Literal objects, constructed once, reused  | Static values — no mock factory needed              |
| \`*Context\` | Scoped world for a callback/handler | Depends on scope (may contain deps + data) | The world available within a bounded scope          |

\`*Context\` examples: a per-request \`RouteContext\` (\`{db, pending_effects, ...}\`),
a per-setup-callback \`AppServerContext\` (\`{deps, backend, session_options, ...}\`).
A \`*Context\` may structurally satisfy a \`*Deps\` interface — fuz_app's route
handlers pass the \`RouteContext\` directly to \`query_*\` functions because it
satisfies \`QueryDeps = {db: Db}\`.

**No \`*Config\` suffix** — \`?\` on fields already expresses required vs optional;
all parameter bags use \`*Options\`. \`*Input\` is reserved for mutation payloads
(create/update data).

**Keep the categories separate.** A \`*Deps\` type that mixes capability fields
with config values (thresholds, paths) is blurring two categories that test
differently — split it into a \`*Deps\` + an \`*Options\`, or, when the mix is
deliberate for a one-function signature, use the ad-hoc deps form below and
say so. (Rust collapses these categories into one \`*Options\` struct on
purpose; TS holds them apart — that's the language-appropriate shape on each
side.)

## Naming

| What              | Convention                  | Example                              |
| ----------------- | --------------------------- | ------------------------------------ |
| Small interface   | \`{Domain}Deps\`              | \`EnvDeps\`, \`FsReadDeps\`, \`CacheDeps\` |
| Capability bundle | \`{Scope}Deps\`               | \`AppDeps\`, \`RouteFactoryDeps\`        |
| Full composite    | \`RuntimeDeps\`               | extends all small \`*Deps\` interfaces |
| Default impl      | \`default_{domain}_deps\`     | \`default_cache_deps\`                 |
| Mock factory      | \`create_mock_{domain}_deps\` | \`create_mock_cache_deps\`             |
| Stub factory      | \`stub_{scope}_deps\`         | \`stub_app_deps\`                      |

File naming: \`deps.ts\` (interfaces) + \`deps_defaults.ts\` (production
defaults) + a test-side mock module (fuz_css keeps it at
\`src/test/fixtures/mock_deps.ts\`) — fuz_css is the cleanest exemplar
(\`CacheDeps\` / \`default_cache_deps\` / \`create_mock_cache_deps\`).

**Legacy \`*Operations\` naming (fuz_gitops)**: an older spelling of the same
pattern — \`GitOperations\` / \`default_git_operations\` / \`create_mock_git_ops\`,
grouped under a \`GitopsOperations\` composite with an \`ops\` param. It is being
migrated to \`*Deps\` opportunistically (fuz_css already migrated its
\`CacheOperations\` → \`CacheDeps\`). **Never author new \`*Operations\` types**;
when touching fuz_gitops's DI surface, follow the existing local naming until
the rename lands, and use \`*Deps\` everywhere else.

## Layer Contracts (L0 platform vs L1 domain)

Two layers of injected interface, with deliberately different contracts:

**L0 — platform shims** (\`FsReadDeps\`, \`CommandDeps\`, ...): mirror the
platform. **Positional params, throws on error**, exactly like
\`Deno.readTextFile\` / \`node:fs\`. Stable signatures, trivially implemented by
any runtime.

**L1 — domain wrappers** (\`CacheDeps\`, git/npm operations, ...): **single
options-object params, uniform \`Result\` returns with typed errors** — reads,
writes, and queries all return \`Result<{value: T}, FsError>\`; no mixing
\`string | null\` reads with \`Result\` writes. Implementations route thrown
errors through \`fs_classify_error(error)\` from \`@fuzdev/fuz_util/fs.ts\`,
which maps platform codes (ENOENT/EACCES/EPERM/EEXIST) to a discriminated
\`kind\`:

\`\`\`typescript
type FsError =
	| { kind: 'not_found'; message: string }
	| { kind: 'permission_denied'; message: string }
	| { kind: 'already_exists'; message: string }
	| { kind: 'io_error'; message: string };

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

// rm -f semantics (tolerate missing)
if (!r.ok && r.kind !== 'not_found') throw new Error(r.message);
\`\`\`

The uniform shape keeps the contract symmetric with the Rust twin where
\`Result<T, E>\` is native. Don't mix the two contracts on one interface, and
don't leak platform types (e.g. node's \`SpawnOptions\`) through an L1 shape.

## Consumption Patterns

**Required first param** — internal/library functions take \`deps\` as a
required first parameter:

\`\`\`typescript
export const create_account_route_specs = (
	deps: RouteFactoryDeps,
	options: AccountRouteOptions
): Array<RouteSpec> => {
	/* ... */
};
\`\`\`

**Optional with default** — public API surfaces default to the production
implementation:

\`\`\`typescript
const { deps = default_cache_deps } = options;
\`\`\`

**Narrow intersection** — utility functions accept exactly the capabilities
used: \`deps: FsReadDeps & FsWriteDeps & CommandDeps & EnvDeps\`.

**Ad-hoc per-function deps** — a function with a unique combination defines
its own interface co-located with it:

\`\`\`typescript
export interface BootstrapAccountDeps {
	db: Db;
	token_path: string; // data mixed in deliberately — one-signature convenience
	read_text_file: (path: string) => Promise<string>;
	delete_file: (path: string) => Promise<void>;
	password: Pick<PasswordHashDeps, 'hash_password'>;
	log: Logger;
}
\`\`\`

Use ad-hoc deps when the combination is unique to one function and sharing
would add coupling without reuse.

**Composition root** — capabilities are assembled once, at an explicit wiring
point, and flow down. fuz_app's two-step server assembly is the exemplar:
\`create_app_backend(options)\` builds the capability bundle (\`AppDeps\`) and
returns it wrapped with lifecycle metadata; \`create_app_server({backend, ...})\`
consumes it. Extension points that must run after assembly register through
documented methods on the capability itself (the audit emitter's
\`add_listener\` — same identifier as its Rust twin) rather than copying or
re-shaping the deps bundle.

## Design Principles

- **Result returns, never throw** in L1 domain interfaces (see Layer
  Contracts); L0 mirrors the platform and throws.
- **Stateless capabilities** — deps are stateless functions and service
  instances; mutable state (e.g. \`bootstrap_status: {available: boolean}\`)
  is passed separately, never smuggled into a deps bundle.
- **Runtime agnosticism** — never import env/fs at module level in code that
  might run outside one runtime; load via deps params. Direct platform
  imports are for the platform factory files and explicitly-single-runtime
  modules only (document the carve-out at the module when you make one).
- **Logging in shared deps: required, never optional-with-fallback.** A
  shared library module consumed by multiple apps can't own a \`Logger\`
  singleton — the label belongs to the consumer. Keep \`LogDeps\` required;
  where a consumer has no logger, its adapter delegates explicitly
  (\`warn: (...args) => console.warn(...args)\`). Diagnostic-only \`log?\`
  params on leaf helpers (silently absent = no extra diagnostics) are a
  different, acceptable shape — the rule is about capabilities the function
  _needs_ on some path.

## Testing

Plain objects implementing the interfaces — no \`vi.mock()\`, no Sinon.
Individual \`vi.fn()\` for call tracking is acceptable. See
./testing-patterns for general mock structure.

**Mock factory with overrides** — every method implemented with a sensible
default, \`Partial<T>\` overrides spread last:

\`\`\`typescript
export const create_mock_git_deps = (overrides: Partial<GitDeps> = {}): GitDeps => ({
	current_branch_name: async () => ({ ok: true, value: 'main' }),
	checkout: async () => ({ ok: true }),
	// ... all methods with sensible defaults
	...overrides
});
\`\`\`

**In-memory state mock** — state object created separately so tests can seed
and inspect it:

\`\`\`typescript
export const create_mock_cache_deps = (state: MockFsState): CacheDeps => ({
	read_text: async ({ path }) => {
		const content = state.files.get(path);
		return content === undefined
			? { ok: false, kind: 'not_found', message: \`not found: \${path}\` }
			: { ok: true, value: content };
	},
	write_text_atomic: async ({ path, content }) => {
		state.files.set(path, content);
		return { ok: true };
	},
	unlink: async ({ path }) => {
		state.files.delete(path);
		return { ok: true };
	}
});
\`\`\`

**Tracking mock** — records calls for assertions, returned alongside the
deps object:

\`\`\`typescript
export const create_tracking_process_deps = (): {
	deps: ProcessDeps;
	get_spawned_commands: () => Array<TrackedCommand>;
} => {
	/* push into a local array, expose getters */
};
\`\`\`

**Stubs — two safety levels** (fuz_app's \`testing/stubs.ts\` is the exemplar):

- \`create_throwing_stub<T>(label)\` — Proxy that throws on any access;
  \`stub_app_deps\` builds a whole bundle of these. Catches _unexpected_
  capability use with a descriptive error — prefer this default: a silent
  no-op mock can mask test-setup mistakes.
- \`create_noop_stub<T>(label)\` / \`create_stub_app_deps()\` — silent no-ops
  for tests where incidental access is fine.

**Observable runtime mock** — \`create_mock_runtime(args)\` returns the full
\`RuntimeDeps\` with observable state (\`mock_env\`, \`mock_fs\`, \`exit_calls\`,
\`command_calls\`, ...); \`exit\` throws a \`MockExitError\` instead of
terminating. Stub factories accept the same narrow \`*Deps\` contracts
production code uses — never \`Pick<GodType>\`.

## Traps

Failure modes seen in real code — each with the rule that avoids it:

- **Optional capability with a silent platform fallback.** A
  \`read_file?: (...)\` field defaulting to a module-level \`node:fs\` import
  quietly couples the module to one runtime and hides the effect from the
  signature. Either require the dep, or default at an explicit platform
  factory / entry point — not per-field at module scope.
- **Category blurring under a \`*Deps\` name.** Config values
  (\`embedded_threshold\`, \`disk_root\`) mixed with capabilities in one
  \`*Deps\` interface, several optional-with-fallback — tests can't tell what
  needs a mock vs a literal. Split \`*Deps\` from \`*Options\`, or use the
  documented ad-hoc form deliberately.
- **No seam at the call site.** Functions called _by name_ from middleware
  (\`query_account_by_id(...)\` imported directly) leave \`vi.mock\` as the only
  test seam — this is how module-mocking creeps back in. Where a module's
  callers need to substitute behavior in tests, thread the function through
  a deps param. fuz_app documents its remaining auth \`query_*\` module-mock
  cluster (bearer auth plus several other middleware tests) as an explicit
  carve-out with \`vi.restoreAllMocks()\` hygiene; treat any new instance as a
  smell, not a precedent.
- **God-type coupling.** \`Pick<Composite, ...>\` at leaf functions, or
  passing the app composite down more than one level. Composites exist for
  the wiring layer.
- **Deps spreading.** \`{...deps, extra}\` at downstream call sites re-shapes
  the bundle mid-flight. Constructing a purpose-built deps object at a
  wiring point where multiple sources converge is legitimate; spreading to
  _extend_ someone else's bundle is not. Inline narrowing (\`{db}\` selected
  from a bundle) is fine — selection, not extension.
- **Forcing \`*Deps\` params across a component tree.** Browser/UI code uses
  the platform's DI: Svelte context (\`create_context\`), e.g. fuz_app's
  \`*_rpc_context\` adapters. Function-param deps are for plain TS call
  graphs; context is for component scoping. Both are the pattern done
  right, in their own domain.

## Scope — where the pattern doesn't apply

- **Floor-tier utility modules**: foundation packages (fuz_util) export
  bare functions over the platform (\`fs.ts\`, \`process.ts\`, \`git.ts\`) plus
  the shared contracts (\`FsError\`, \`Result\`) that \`*Deps\` interfaces
  elsewhere are typed against. They are what default implementations are
  _made of_ — they don't take deps themselves.
- **Pure libraries** (parsers, renderers, formatters) have no side effects
  to inject; a rendering/plugin seam (mdz's component injection) is
  composition, not capability DI.
- **Narrow duck-typed interfaces** that intentionally match multiple
  existing objects (svelte-docinfo's \`AnalysisLog\`, satisfiable by both
  fuz_util's \`Logger\` and Vite's logger) are the same spirit without the
  suffix — fine as-is.

## Rust Analog

The \`*Deps\` suffix is **TS-only**. Rust traits _are_ capabilities —
appending \`Deps\` imports TS shape into a language that doesn't need it.
Rust uses pure-noun capability traits (\`PasswordHasher\`, \`Storage\`,
\`SocketRevoker\`) and \`*Options\` structs for per-call parameter bags, with
\`cfg\`/features, the crate graph, and enum dispatch covering much of what TS
solves with injection. For the full treatment — escalation ladder, hot/cold
dispatch, enum-dispatch-before-\`dyn\`, object-safety annotation rules, what
stays concrete — see ./rust-patterns#dependency-injection.

## Quick Reference

| Flavor                                                                                  | Exemplar           | Injection style                                                    |
| --------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| Narrow platform deps + \`RuntimeDeps\` composite                                          | fuz_app \`runtime/\` | Required first param (narrow interface); composite at entry points |
| App capability bundle (\`AppDeps\`, \`RouteFactoryDeps\`, \`QueryDeps\`, \`ActionFactoryDeps\`) | fuz_app server     | Required first param; two-step composition root                    |
| Focused domain deps (\`CacheDeps\`)                                                       | fuz_css            | Optional param with default (\`deps = default_cache_deps\`)          |
| Grouped legacy \`*Operations\`                                                            | fuz_gitops         | Optional param with default (\`ops\`) — migrating to \`*Deps\`         |

| Principle  | Rule                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| Suffixes   | \`*Deps\` capabilities / \`*Options\` data / \`*Context\` scoped world; no \`*Config\` |
| Errors     | L1: uniform \`Result<{value: T}, FsError>\`; L0: platform mirror, throws         |
| Parameters | L1: single options object; L0: positional                                      |
| Testing    | Plain objects — no \`vi.mock()\`; throwing stubs over silent no-ops              |
| State      | Deps are stateless — mutable refs passed separately                            |
| Narrowing  | Accept the smallest \`*Deps\` interface that covers usage                        |
| New code   | \`*Deps\` naming everywhere — never new \`*Operations\`                            |
`},{slug:"documentation-system",title:"Documentation System",content:"# Documentation System\n\nPipeline, Tome system, layout architecture, and project setup for `@fuzdev`\ndocs. For TSDoc/JSDoc authoring conventions, see ./tsdoc-comments.\n\n## Pipeline Overview\n\n```\nsource files → svelte-docinfo plugin → virtual:svelte-docinfo (modules) ┐\n                                                                         ├→ library_json_from_modules() → Library → Tome pages + API routes\npackage.json → vite_plugin_pkg_json  → virtual:pkg.json (pkg_json)       ┘\n```\n\n| Stage             | What                                              | Key details                                                                                                                                                                                                                                                                                                        |\n| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |\n| **Analysis**      | `svelte-docinfo`                                  | Standalone package analyzes TS/JS/Svelte modules via the TypeScript compiler API, extracting declarations and TSDoc metadata                                                                                                                                                                                       |\n| **Generation**    | `svelte-docinfo/vite.js` + `vite_plugin_pkg_json` | Two Vite plugins run at build/dev time: `svelte-docinfo` exposes the analyzed `modules` as `virtual:svelte-docinfo`; `vite_plugin_pkg_json` (from fuz_ui) curates `package.json` to the publish-safe `PkgJson` and exposes it as `virtual:pkg.json`. No committed generated data (`library.gen.ts`/`library.json`) |\n| **Serialization** | `library_json_from_modules()`                     | From `@fuzdev/fuz_util/library_json.ts`; pairs the curated `pkg_json` (from `virtual:pkg.json`) with the analyzed `modules` (from `virtual:svelte-docinfo`) into the raw `{pkg_json, source_json}` `LibraryJson` (no derived values stored — those are computed by `Library`)                                      |\n| **Runtime**       | `Library` class                                   | Wraps `LibraryJson` into `Module` and `Declaration` instances with `$derived` properties, search, and lookup maps                                                                                                                                                                                                  |\n| **Rendering**     | Tome pages + API routes                           | Manual tomes + auto-generated API docs. Backticked identifiers in TSDoc auto-link to API docs via the mdz rendering seam — fuz_ui injects `DocsLink` as mdz's inline-code renderer, which resolves the identifier against the `Library` (see ./mdz)                                                             |\n\n### Analysis\n\nThe `svelte-docinfo` package owns module analysis end to end: it walks source\nfiles, dispatches per file type (`.ts`/`.js` vs `.svelte`), parses TSDoc/JSDoc\n(`@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`, `@since`,\n`@module`, `@default`, `@nodocs`, `@mutates`), merges re-exports into\n`alsoExportedFrom` (svelte-docinfo's API is camelCase — it targets the broad\nSvelte ecosystem, not fuz conventions), sorts\nmodules, and checks for duplicate names in the flat namespace. Besides\n`modules`, `virtual:svelte-docinfo` also exports `diagnostics`\n(author-facing tag problems like `misplaced_tag` and `unknown_param`) — no\nrepo consumes it yet, but it's the answer to \"did my tags land?\". It ships a\nCLI, a Vite plugin (`svelte-docinfo/vite.js`), and a build-tool-agnostic API.\nfuz_ui depends on it as a dev dependency — importing its types and a few runtime\nhelpers — while the heavy per-project module analysis runs in each _consumer's_\nbuild via the Vite plugin, not at fuz_ui's runtime.\n\n## Tome System\n\nA **Tome** is a documentation page. Zod schema in `@fuzdev/fuz_ui/tome.ts`:\n\n```typescript\nconst Tome = z.object({\n	slug: z.string(), // URL path segment + lookup key (used in related_tomes)\n	title: z.string().optional(), // display label; falls back to slug when omitted\n	category: z.string(), // grouping in sidebar navigation\n	Component: z.custom<Component<any, any>>(), // the +page.svelte component\n	related_tomes: z.array(z.string()), // cross-links to other tome pages (by slug)\n	related_modules: z.array(z.string()), // links to source modules in API docs\n	related_declarations: z.array(z.string()) // links to specific exports in API docs\n});\n```\n\n### Cross-references\n\n| Field                  | Links to                     | Example value                 |\n| ---------------------- | ---------------------------- | ----------------------------- |\n| `related_tomes`        | Other tome pages             | `['ThemeRoot']`               |\n| `related_modules`      | Source files in `/docs/api/` | `['theme_state.svelte.ts']`   |\n| `related_declarations` | Specific exports in API docs | `['ThemeRoot', 'ThemeState']` |\n\n### Categories\n\nCategories group tomes in sidebar navigation; project-specific:\n\n| Project | Categories                       |\n| ------- | -------------------------------- |\n| fuz_ui  | `guide`, `helpers`, `components` |\n| fuz_css | `guide`, `systems`, `styles`     |\n\n### Registry\n\nEvery project with docs has `src/routes/docs/tomes.ts` (examples here use the\n`#routes`/`#lib` subpath aliases — the target convention, but only fuz_app\ndeclares them today; the reference implementations fuz_ui and fuz_css still\nuse `$lib`/`$routes`. A new repo must declare `#lib/*`/`#routes/*` in\n`package.json` `imports`, or adapt to its existing aliases):\n\n```typescript\nimport type { Tome } from '@fuzdev/fuz_ui/tome.ts';\nimport introduction from '#routes/docs/introduction/+page.svelte';\nimport api from '#routes/docs/api/+page.svelte';\n\nexport const tomes: Array<Tome> = [\n	{\n		slug: 'introduction',\n		category: 'guide',\n		Component: introduction,\n		related_tomes: ['api'],\n		related_modules: [],\n		related_declarations: []\n	}\n	// ...\n];\n```\n\n### Helpers\n\nFrom `@fuzdev/fuz_ui/tome.ts`:\n\n- `tome_get_by_slug(slug)` — look up a Tome from `tomes_context` (throws if not found)\n- `tome_to_pathname(tome, docs_path?, hash?)` — generate URL for a tome\n- `tome_to_title(tome)` — display label (its `title`, else its `slug`)\n- `tomes_context` — context holding `() => Map<string, Tome>` (set by `Docs`)\n- `tome_context` — context holding `() => Tome` for the current page (set by `TomeContent`)\n\nFrom `@fuzdev/fuz_ui/docs_helpers.svelte.ts`:\n\n- `docs_slugify(name)` — convert tome name to URL-safe slug (preserves case)\n- `docs_links_context` — context holding `DocsLinks` for section navigation\n- `DOCS_PATH_DEFAULT`, `DOCS_PATH`, `DOCS_API_PATH` — path constants\n\n## Setting Up Docs in a Project\n\nFollowing the pattern in fuz_ui and fuz_css.\n\n### 1. Library analysis (Vite plugins)\n\nAdd the `svelte-docinfo` Vite plugin (exposes the analyzed `modules` as\n`virtual:svelte-docinfo`) and fuz_ui's `vite_plugin_pkg_json` (exposes the\ncurated, publish-safe `package.json` subset as `virtual:pkg.json`) in\n`vite.config.ts`:\n\n```typescript\nimport { defineConfig } from 'vite';\nimport { sveltekit } from '@sveltejs/kit/vite';\nimport svelte_docinfo from 'svelte-docinfo/vite.js';\nimport { vite_plugin_pkg_json } from '@fuzdev/fuz_ui/vite_plugin_pkg_json.ts';\n\nexport default defineConfig({\n	plugins: [sveltekit(), svelte_docinfo(), vite_plugin_pkg_json()]\n});\n```\n\nRegister the ambient types in `src/app.d.ts`:\n\n```typescript\n/// <reference types=\"svelte-docinfo/virtual-svelte-docinfo.js\" />\n\ndeclare module 'virtual:pkg.json' {\n	import type { PkgJson } from '@fuzdev/fuz_util/pkg_json.ts';\n	const pkg_json: PkgJson;\n	export default pkg_json;\n}\n```\n\n`vite_plugin_pkg_json` reads `package.json` at build time and serves only the\npublish-safe `pkg_json_keys` subset, keeping `scripts`, `dependencies`, and\nprivate config out of the client bundle (and avoiding SvelteKit's\n`server.fs.allow` tripping on a cold HMR reload). There is no committed\ngenerated data (`library.gen.ts`, `library.json`) — the plugins produce it at\nruntime; the only committed artifact is the tiny hand-written\n`src/routes/library.ts` glue (§3).\n\n**Footgun**: if a project widens the published `package.json` fields it exposes,\nthe **same `keys` set must reach both** `vite_plugin_pkg_json` and\n`library_json_from_modules()` — a mismatch silently drops fields end-to-end with\nno error. When widening, wire a shared const (e.g. a `src/routes/pkg_json_keys.ts`)\npassed to both callsites; no repo widens today, so the default keys need no wiring.\n\n### 2. Root layout — site identity only\n\nThe root `src/routes/+layout.svelte` wraps **every** route, so keep it light:\nset only the small `site_context` (icon, glyph, repo url — `glyph`/`repo_url`\nderive from `virtual:pkg.json`). Do **not** build the `Library` here — that\npulls the heavy analyzed `modules` into the root chunk and instantiates\n`Library` on every page, including the landing.\n\n```svelte\n<script lang=\"ts\">\n	import ThemeRoot from '@fuzdev/fuz_ui/ThemeRoot.svelte';\n	import { SiteState, site_context } from '@fuzdev/fuz_ui/site.svelte.ts';\n	import { logo_my_project } from '#lib/logos.ts';\n	import pkg_json from 'virtual:pkg.json';\n	import type { Snippet } from 'svelte';\n\n	const { children }: { children: Snippet } = $props();\n\n	// `glyph` and `repo_url` derive from `pkg_json`; `icon` stays explicit.\n	site_context.set(new SiteState({ icon: logo_my_project, pkg_json }));\n<\/script>\n\n<ThemeRoot>{@render children()}</ThemeRoot>\n```\n\n### 3. Library data — a shared module, provided per subtree\n\nBuild the `LibraryJson` once in `src/routes/library.ts`. As a module-level\n`export const` it evaluates lazily on first import and is shared by every\nimporter; because only the docs subtree imports it, the heavy\n`virtual:svelte-docinfo` payload stays out of the root chunk:\n\n```typescript\n// src/routes/library.ts\nimport { library_json_from_modules } from '@fuzdev/fuz_util/library_json.ts';\nimport { modules } from 'virtual:svelte-docinfo';\nimport pkg_json from 'virtual:pkg.json';\n\nexport const library_json = library_json_from_modules(pkg_json, modules);\n```\n\nProvide `library_context` in the docs layout (`src/routes/docs/+layout.svelte`),\nwhich covers all `/docs/*` pages:\n\n```svelte\n<script lang=\"ts\">\n	import type { Snippet } from 'svelte';\n	import Docs from '@fuzdev/fuz_ui/Docs.svelte';\n	import { Library, library_context } from '@fuzdev/fuz_ui/library.svelte.ts';\n	import { tomes } from '#routes/docs/tomes.ts';\n	import { library_json } from '#routes/library.ts';\n\n	const { children }: { children: Snippet } = $props();\n\n	const library = new Library(library_json);\n	library_context.set(() => library);\n<\/script>\n\n<Docs {tomes}>\n	{@render children()}\n</Docs>\n```\n\n`library_context` holds a getter (`() => Library`) — set it with a closure\nover reactive state as above. `library_context.get()` **throws** when unset,\nand that only surfaces at SSR/prerender (`gro build`) — not in `gro typecheck`\nor `gro test`. So it must be set by a layout that is a common ancestor of\nevery component that reads it (`DeclarationLink`, `ModuleLink`, `TypeLink`,\n`DocsTertiaryNav`, and `Mdz` with an injected `DocsLink`). Components that\ntake a `library` prop project it into the context for their own subtree —\n`LibraryDetail` sets it directly; `ApiIndex`/`ApiModule` resolve\nprop-or-ancestor via `set_library_context_with_fallback` — so an aggregator\ncan render a foreign library without touching the site-level context. Any consumer **outside**\n`/docs` provides its own from the same `library.ts` — e.g. an `/about` page or\na `/skills` subtree:\n\n```svelte\n<script lang=\"ts\">\n	import { Library, library_context } from '@fuzdev/fuz_ui/library.svelte.ts';\n	import { library_json } from '#routes/library.ts';\n\n	const library = new Library(library_json);\n	library_context.set(() => library);\n<\/script>\n```\n\nKeep these off the landing page so it never pulls the heavy data. After any\nchange that moves a context provider, verify with `gro build` — a missing\nprovider passes typecheck and tests but fails the prerender.\n\n### 4. Tomes registry\n\n`src/routes/docs/tomes.ts` — see [Registry](#registry) above.\n\n### 5. Individual tome pages\n\nEach tome is a `+page.svelte` in `src/routes/docs/{slug}/`:\n\n```svelte\n<script lang=\"ts\">\n	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';\n	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';\n	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';\n	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';\n\n	const TOME_SLUG = 'MyComponent';\n	const tome = tome_get_by_slug(TOME_SLUG);\n<\/script>\n\n<TomeContent {tome}>\n	<section>\n		<!-- Introduction content -->\n	</section>\n	<TomeSection>\n		<TomeSectionHeader text=\"Usage\" />\n		<!-- Section content with examples -->\n	</TomeSection>\n	<TomeSection>\n		<TomeSectionHeader text=\"Options\" />\n		<!-- Another section -->\n	</TomeSection>\n</TomeContent>\n```\n\n`TomeSectionHeader` auto-detects heading level (h2/h3/h4) from nesting depth.\nSections tracked by IntersectionObserver for the right sidebar TOC.\n\n### 6. API routes\n\n`src/routes/docs/api/+page.svelte` — API overview:\n\n```svelte\n<script lang=\"ts\">\n	import ApiIndex from '@fuzdev/fuz_ui/ApiIndex.svelte';\n<\/script>\n\n<ApiIndex />\n```\n\n`src/routes/docs/api/[...module_path]/+page.svelte` — per-module docs:\n\n```svelte\n<script lang=\"ts\">\n	import ApiModule from '@fuzdev/fuz_ui/ApiModule.svelte';\n\n	const { params } = $props();\n	const module_path = $derived(params.module_path ?? '');\n<\/script>\n\n<ApiModule {module_path} />\n```\n\n## Docs Layout Architecture\n\n`<Docs>` provides a three-column responsive layout:\n\n| Column        | Component          | Content                              |\n| ------------- | ------------------ | ------------------------------------ |\n| Top bar       | `DocsPrimaryNav`   | Breadcrumb, nav dialog toggle        |\n| Left sidebar  | `DocsSecondaryNav` | Tome list grouped by category        |\n| Center        | `main`             | Route content (tome pages, API docs) |\n| Right sidebar | `DocsTertiaryNav`  | Section headers within current page  |\n\nRight sidebar collapses below ~1000px, left below ~800px. Both move into a\ndialog accessible from the top bar's menu button.\n\n### Key contexts\n\nThe four contexts that wire the layout together (full list in [Helpers](#helpers)):\n\n- `library_context` (`() => Library`) — API metadata, set with a getter; provided per docs-consuming subtree (docs layout, `/about`, …), never at the root (see [Setting Up Docs](#setting-up-docs-in-a-project) §3); components with a `library` prop project it for their subtree\n- `tomes_context` (`() => Map<string, Tome>`) — registered tomes (set by `Docs`)\n- `tome_context` (`() => Tome`) — current page's tome (set by `TomeContent`)\n- `docs_links_context` (`DocsLinks`) — fragment tracking for section navigation\n\n### Runtime Classes\n\n`Library` class (`library.svelte.ts`) provides the runtime API documentation\nhierarchy:\n\n- **`Library`** — wraps `LibraryJson`, provides `modules`, `declarations`,\n  `module_by_path`, `declaration_by_name` lookup maps, and\n  `search_declarations(query)` for multi-term search\n- **`Module`** (`module.svelte.ts`) — wraps `ModuleJson`, provides `path`,\n  `declarations`, `url_api`, `module_comment`\n- **`Declaration`** (`declaration.svelte.ts`) — wraps `DeclarationJson`,\n  provides `name`, `kind`, `module_path`, `url_api`, `url_github`\n\n## Component Reference\n\nYou wire up only a handful of these when adopting the docs system — the ones the\nsetup steps import:\n\n| Component                          | Role in setup                                                            |\n| ---------------------------------- | ------------------------------------------------------------------------ |\n| `Docs`                             | Three-column layout wrapper; sets `tomes_context` + `docs_links_context` |\n| `TomeContent`                      | Individual tome page wrapper; sets `tome_context`                        |\n| `TomeSection`                      | Section container with depth tracking and intersection                   |\n| `TomeSectionHeader`                | Section heading with hashlink (auto h2/h3/h4)                            |\n| `ApiIndex`                         | API overview page (search + all modules/declarations)                    |\n| `ApiModule`                        | Per-module API page (`[...module_path]`)                                 |\n| `LibrarySummary` / `LibraryDetail` | Compact metadata card / expanded package info                            |\n\nThe full set (~27 components — the `Docs*` nav internals, `Api*`/`Declaration*`\nlist pieces, `Tome*`/`Module*`/`Type*` links) is fuz_ui inventory; see fuz_ui's\n`CLAUDE.md` for the exhaustive catalog. All are defined in fuz_ui and imported by\nconsumers unchanged (see [Cross-Project Pattern](#cross-project-pattern)).\n\n## Cross-Project Pattern\n\nfuz_ui **defines** all documentation components and the analysis pipeline;\nother projects import them unchanged from `@fuzdev/fuz_ui/*`. Layout structure\nis identical — only tomes, categories, and breadcrumb branding differ. The\n`svelte-docinfo` Vite plugin and `virtual:svelte-docinfo` are the shared\nanalysis engine across projects.\n\n## See Also\n\n- ./mdz — the mdz dialect, the `DocsLink`/`Code` rendering seam,\n  backticked-identifier autolinking, and `svelte_preprocess_mdz` (build-time\n  compilation of static `<Mdz>` content)\n- **`svelte-docinfo`** — the shared module-analysis engine (see [Analysis](#analysis))\n- ./tsdoc-comments — TSDoc/JSDoc authoring conventions, tag reference,\n  mdz auto-linking, and documentation auditing\n"},{slug:"file-organization",title:"File Organization",content:`# File Organization

The core rules live in SKILL.md §File Organization: \`src/lib/\` exportable
code + \`src/test/\` (not co-located) + \`src/routes/\`; no barrels; wildcard
package \`exports\`; tests mirror \`lib/\` subdirectories. This reference adds
the worked example.

## Domain Subdirectories

When a domain grows beyond a single file, group related modules in a
subdirectory under \`lib/\`. Each file is a distinct concern — no barrel/index
files. fuz_app's \`lib/\` shows the shape:

\`\`\`
src/lib/
├── env/              # environment variable handling
│   ├── load.ts       # schema-based env loading + validation
│   ├── resolve.ts    # $$VAR$$ reference resolution
│   ├── dotenv.ts     # .env file parsing
│   └── mask.ts       # secret value display masking
├── auth/             # authentication domain (the largest — dozens of files)
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
├── actions/          # action spec system
├── realtime/         # SSE and pub/sub
├── testing/          # test utilities (shared across consumers)
└── ui/               # frontend components and state
\`\`\`

**When to create a subdirectory**: 3+ closely related files sharing a domain
concept. A single file stays at \`lib/\` root. Don't create subdirectories
preemptively.

**Consumers import individual modules by full path** — the subdirectory is
part of the import path (\`@fuzdev/fuz_app/env/load.ts\`), never hidden behind
re-exports. Tests mirror the structure: \`src/lib/auth/keyring.ts\` →
\`src/test/auth/keyring.test.ts\` (see ./testing-patterns).
`},{slug:"mdz",title:"mdz — Strict Markdown Dialect",content:'# mdz — Strict Markdown Dialect\n\n`mdz` (`@fuzdev/mdz`) is the ecosystem\'s markdown dialect: a deliberately\nsmall, unambiguous grammar aimed at devs and AI agents rather than end users.\nAn agent touches it in three places — **rendering TSDoc/JSDoc prose** on docs\nsites (backticked identifiers linkify to API docs), **authoring `<Mdz>`\ncontent** with embedded Svelte components, and **rendering streaming LLM\noutput**. One grammar, two parsers: a synchronous tree parser\n(`mdz_parse(content)` → `Array<MdzNode>`, from `@fuzdev/mdz/mdz.ts`) and an\nincremental streaming parser (`MdzStreamParser`, emits opcodes) for partial\ninput; the sync parser is the normative reference and parity tests bind them.\n\n**It is a dialect, not a CommonMark/GFM superset.** The design axiom is _false\nnegatives over false positives_: ambiguous input stays literal text rather than\nguessing markup. Do not assume a markdown feature works because GFM supports it\n— check the surface below.\n\n## Dialect surface\n\n| Feature                | Syntax                                                                                                                                                                                                                                                                                                                                                     |\n| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| Inline code            | `` `code` ``                                                                                                                                                                                                                                                                                                                                               |\n| Bold / italic / strike | `**bold**`, `_italic_`, `~~strike~~` — `**`/`~~` doubled; italic is single `_` at word boundaries (single `*`/`~` and intraword `_` are literal)                                                                                                                                                                                                           |\n| Links                  | auto-detected URLs, `/internal/path`, `./relative` and `../relative` (autolinked after whitespace), `[text](url)`                                                                                                                                                                                                                                          |\n| Headings               | `# Heading` … `######` at **column 0**; gets a lowercase slugified `id` for fragment links                                                                                                                                                                                                                                                                 |\n| Lists                  | `- item` / `1. item` at column 0; indent nests; blank lines contained; items hold block children (paragraphs, nested lists, code blocks, blockquotes, tables) on indented lines — the marker-line remainder is inline-only                                                                                                                                 |\n| Blockquotes            | `> ` per line (**no lazy continuation**); nest with `>>` or `> > `; bare `>` is the in-quote paragraph break; a blank line ends the quote; content is a mini-document                                                                                                                                                                                      |\n| Code blocks            | fenced with optional language hint; an unclosed fence consumes to EOF (or to the end of its blockquote)                                                                                                                                                                                                                                                    |\n| Horizontal rule        | `---` alone on a line                                                                                                                                                                                                                                                                                                                                      |\n| Tables                 | `\\| a \\| b \\|` rows + a `\\| --- \\| :-: \\|` delimiter row (colons set per-column alignment); leading **and** trailing `\\|` required; inline-only cells (`` `code` `` protects pipes; `\\|` is the one escape, a literal pipe); a header/delimiter column mismatch stays a paragraph                                                                          |\n| Components / elements  | `<Alert status="error">…</Alert>` (component) / `<aside class="box">…</aside>` (HTML element) — **both must be registered**; `<br />` (registered) for a hard break. Attributes are quoted strings (`"`/`\'`) or bare booleans (`<input disabled />`); **elements** filter to a closed inert allowlist, **components** pass all attributes through as props |\n| Paragraphs / breaks    | blank line separates paragraphs; a single newline is a soft break (collapses to a space by default)                                                                                                                                                                                                                                                        |\n\n**Whitespace**: text nodes preserve literal `\\n`, but the default rendering\napplies no `white-space` style, so single newlines collapse to spaces. The\n`whitespace` prop on `Mdz`/`MdzStream`/`MdzPrecompiled` accepts any\n`MdzWhitespace` value (`normal`/`nowrap`/`pre`/`pre-wrap`/`pre-line`/\n`break-spaces`) — most commonly `pre-line` (every newline breaks —\nchat-style input) or `pre-wrap` (spaces/tabs preserved too).\n\n## Deliberately unsupported (scope notes)\n\nThe strictness is the point — these are omitted on purpose, so don\'t reach for\nthem:\n\n- **No single-delimiter emphasis** — `*x*`, `_x_` intraword, `~x~` all stay\n  literal. Intraword `_` is literal by design so `snake_case` identifiers render\n  verbatim (a core reason the dialect exists).\n- **Attribute values: strings + bare booleans only** — `<Alert status="warning">`\n  and `<input disabled />` parse (attributes **are** supported); empty values\n  (`title=""`) are valid, a `>` inside a quoted value is content, values have\n  no escape sequences, and attribute order is preserved. Malformed forms bail\n  the **whole tag** back to literal text: unquoted values (`a=b`), brace\n  values (`a={5}` — reserved for a future literal form, not evaluated),\n  spaces around `=`, a duplicate name, a newline or tab inside the open tag,\n  a missing space between attributes (`x="1"y="2"`), an unterminated quote, a\n  dangling `=`, or a name not starting with an ASCII letter (names are\n  `letter (letter|digit|-|_)*`, the tag-name charset). Directives /\n  namespaced / spread / `{shorthand}` can never parse (`:` and `{` aren\'t\n  attribute-name/value chars). Enforcement runs at render **and** build time\n  through one shared helper (`mdz_filter_element_attributes`, used by\n  `MdzNodeView`, `MdzStreamNodeView`, and `mdz_to_svelte`, so the\n  preprocessor applies the identical allowlist): **elements** filter to a\n  closed inert allowlist (`class`, `title`, `lang`, `dir`, `role`,\n  `aria-{label,hidden,describedby,labelledby}`) — anything else is silently\n  dropped in prod and DEV-warned by name, with the element still rendering;\n  **components** pass all attributes through as props (registering a\n  component is the trust decision) — the registry type is unchanged, props\n  pass through untyped (`string | true`).\n- **No CommonMark/GFM compatibility** — no setext headings, no reference links,\n  no `*`-bullets or `+`-bullets (only `-`), no task lists.\n- **No syntax highlighting, no themed components, no HTML sanitization** — only\n  registered components/elements render; everything else is text. Rich rendering\n  is injected (below), not built in.\n\n## Rendering: plain by default, inject richer\n\nmdz core renders inline code as `<code>` and code blocks as `<pre><code>` —\n**plain elements**. Consumers inject richer renderers through getter-based\ncontexts in `@fuzdev/mdz/mdz_contexts.ts`, set via `MdzRoot` props or directly\nwith `mdz_set_context_with_fallback(context, () => Value)` (prefers the local\nvalue, falls back to the ancestor\'s — ancestor captured once at init):\n\n- `mdz_code_context` → a `Component<{reference: string}>` for inline `` `code` ``\n- `mdz_codeblock_context` → a `Component<{lang, content}>` for code blocks\n- `mdz_components_context` → the `<Alert>`-style component registry (a `Map`)\n- `mdz_elements_context` → the allowed-HTML-element registry\n- `mdz_base_context` → base path for resolving `./relative` links\n\nThe two code-prop contracts are shaped to match their canonical injections:\n`mdz_code_context`\'s `{reference}` matches fuz_ui\'s `DocsLink`, and\n`mdz_codeblock_context`\'s `{lang, content}` matches fuz_code\'s `Code`, so both\ndrop in directly. **mdz ships no default component registry** — every consumer\nregisters its own; an unregistered tag renders as a visible placeholder, not an\nerror.\n\n## Backticked-identifier autolinking (TSDoc)\n\nThe autolink is the injection seam plus a lookup — there\'s no special "link"\nsyntax. When fuz_ui injects `DocsLink` as `mdz_code_context`, every inline\n`` `code` `` span becomes a `DocsLink` whose `reference` is the span text.\n`DocsLink` resolves it against the `Library` from `library_context`:\n`declaration_by_name.get(reference)`, then `module_by_path.get(reference)` — a\nhit renders a `DeclarationLink`/`ModuleLink`, a miss stays a plain `<code>`.\n**Only real API symbols in the flat namespace resolve**; everything else is an\nordinary code span. This is why backticking identifiers in TSDoc "just works" on\ndocs sites and is inert elsewhere. (Separately, `mdz_from_tsdoc` in\n`@fuzdev/mdz/tsdoc_mdz.ts` converts TSDoc `@see`/`{@link}` text into mdz strings\n— a source bridge, not the autolinker.)\n\n## Build-time preprocessor\n\n`svelte_preprocess_mdz` (`@fuzdev/mdz/svelte_preprocess_mdz.ts`) compiles\n**static** `<Mdz content="…">` usages — string literals and statically\nresolvable ternary chains — into pre-rendered `<MdzPrecompiled>` markup at build\ntime, eliminating runtime parsing for known-static doc strings. Truly dynamic\ncontent is left untouched. Its `code_component_import` /\n`codeblock_component_import` (plus `components`/`elements`) options mirror the\nruntime seam, so precompiled and runtime output stay identical. Reach for it\nwhen a project renders many static `<Mdz>` blocks (docs sites); skip it for\npurely dynamic content.\n\n## Sync vs streaming\n\nTwo input regimes over one grammar. The **sync** pipeline (`mdz_parse`,\n`Mdz.svelte`) owns random-access input — anything you hold as a complete string\n(static content, the preprocessor). The **streaming** pipeline\n(`MdzStreamParser`, `MdzStream.svelte` fed by an `MdzStreamState`) owns\nappend-only input arriving in chunks (LLM output). The streaming invariant: no\nimplicit re-parsing — corrections to already-emitted output are bounded, local,\nand reified as opcodes. Use streaming only when you genuinely render partial\ninput as it arrives; otherwise `mdz_parse` is simpler.\n\n## Testing\n\nFixture-based (`fixtures/mdz/`, `fixtures/svelte_preprocess_mdz/`) — the\nfixtures are the ground truth for what the dialect parses; regenerate via\n`gro src/test/fixtures/mdz/update`, never hand-edit `expected.json`\n(full workflow: ./testing-patterns §Fixture-Based Testing).\n'},{slug:"npm-dependencies",title:"Approved npm Dependencies",content:"# Approved npm Dependencies\n\nThe canonical allowlist of external npm packages approved for the\nTypeScript/Svelte repos across the ecosystem. Prefer these; reach outside\nthe list only with explicit approval (see [§Adding a dependency](#adding-a-dependency)).\n\n**Scope**: the canonical (non-experimental) TS/Svelte repos — libraries,\napps, sites, and tooling. Different-paradigm or pre-canonical repos carry\ntheir own deps and are out of scope here.\n\n**Source of truth**: each repo's `package.json` (`dependencies`,\n`devDependencies`, `peerDependencies`, `optionalDependencies`). This doc is a\ncurated, hand-maintained reference to the stack-wide third-party deps — not\ngenerated, and deliberately **not exhaustive**: narrowly repo-specific deps (one\napp's domain library, an editor extension's typings, a benchmark-only reference\nimpl) are left out so the list stays focused on what generalizes across the\nstack. Verify it against the repos periodically.\n\nPackages published by the workspace itself — the `@fuzdev` / `@ryanatkn`\nscopes and unscoped siblings like `svelte-docinfo` — are internal, not\nthird-party deps, and never appear here.\n\n## Language & build toolchain\n\n| Package                        | Purpose                                  |\n| ------------------------------ | ---------------------------------------- |\n| `typescript`                   | TypeScript compiler                      |\n| `tslib`                        | TS runtime helpers                       |\n| `svelte`                       | Component framework (runes)              |\n| `@sveltejs/kit`                | Application framework                    |\n| `@sveltejs/vite-plugin-svelte` | Svelte ↔ Vite integration                |\n| `@sveltejs/adapter-static`     | Static-site adapter                      |\n| `@sveltejs/acorn-typescript`   | TS-aware acorn parser (Svelte toolchain) |\n| `@sveltejs/package`            | Library packaging (`svelte-package`)     |\n| `svelte-check`                 | Svelte / TS diagnostics                  |\n| `svelte2tsx`                   | Svelte → TSX for typechecking            |\n| `vite`                         | Build tool / dev server                  |\n| `vitest`                       | Test runner                              |\n| `jsdom`                        | DOM implementation for tests             |\n\n## Lint & format\n\n| Package                | Purpose                                                                                       |\n| ---------------------- | --------------------------------------------------------------------------------------------- |\n| `eslint`               | Linter                                                                                        |\n| `eslint-plugin-svelte` | Svelte lint rules                                                                             |\n| `typescript-eslint`    | TypeScript lint integration                                                                   |\n| `@eslint/js`           | ESLint's built-in JS rule presets (used only inside the shared eslint-config package)         |\n| `globals`              | Global-identifier sets for ESLint configs (used only inside the shared eslint-config package) |\n\n**Being retired**: `prettier` + `prettier-plugin-svelte` remain in many\nrepos' devDependencies but are mid-removal as tsv (`gro format`) takes over —\ndon't add them to new repos; removing a repo's last usage is pre-authorized\ncleanup.\n\n## Release tooling\n\n| Package                     | Purpose                                      |\n| --------------------------- | -------------------------------------------- |\n| `@changesets/changelog-git` | Git-based changelog generator for changesets |\n| `@changesets/types`         | Changesets type definitions                  |\n\n## Type definitions\n\n| Package            | Purpose                    |\n| ------------------ | -------------------------- |\n| `@types/node`      | Node.js types              |\n| `@types/deno`      | Deno runtime types         |\n| `@types/estree`    | ESTree AST types           |\n| `@types/pg`        | `pg` (node-postgres) types |\n| `@types/ws`        | `ws` types                 |\n| `@types/picomatch` | `picomatch` types          |\n\n## Core utilities\n\n| Package                     | Purpose                               |\n| --------------------------- | ------------------------------------- |\n| `zod`                       | Schema validation                     |\n| `esm-env`                   | Environment flags (`DEV` / `BROWSER`) |\n| `zimmerframe`               | AST walker                            |\n| `magic-string`              | Source-string edits with sourcemaps   |\n| `@webref/css`               | W3C CSS reference data                |\n| `@jridgewell/trace-mapping` | Sourcemap decoding                    |\n| `date-fns`                  | Date utilities                        |\n\n(`dequal` and `fast-deep-equal` appear only as benchmark baselines in\nfuz_util — not stack utilities; don't add them to app code.)\n\n## Backend & server\n\n| Package                | Purpose                          |\n| ---------------------- | -------------------------------- |\n| `pg`                   | PostgreSQL client                |\n| `@electric-sql/pglite` | Embedded Postgres (WASM)         |\n| `hono`                 | HTTP server framework            |\n| `@hono/node-server`    | Hono Node adapter                |\n| `@hono/node-ws`        | Hono Node WebSocket adapter      |\n| `@node-rs/argon2`      | Argon2 password hashing (native) |\n| `ws`                   | WebSocket implementation         |\n\n## Parsing & build internals\n\n| Package                    | Purpose                  |\n| -------------------------- | ------------------------ |\n| `esbuild`                  | Bundler / transform      |\n| `oxc-parser`               | Fast JS/TS parser        |\n| `ts-blank-space`           | Type-stripping transform |\n| `es-module-lexer`          | ESM import/export lexer  |\n| `acorn-jsx`                | JSX plugin for acorn     |\n| `chokidar`                 | File watching            |\n| `dotenv`                   | `.env` loader            |\n| `picomatch` / `tinyglobby` | Glob matching            |\n| `commander`                | CLI argument parsing     |\n\n## Adding a dependency\n\nNew packages are added deliberately, not incidentally:\n\n- Prefer `node:` built-ins, then this list, before anything new.\n- A new dependency needs explicit approval — name it, its purpose, what it\n  replaces or enables, and its transitive footprint.\n- Removing an unused dependency is pre-authorized — no approval needed. Verify\n  nothing references it, then drop the entry. Removing the last user of a\n  package? Drop it from this list in the same change.\n\n## Dependency classification (peer vs dependency vs dev)\n\nFor a **published library**, which `package.json` field a package lands in is a\ncorrectness decision, not bookkeeping.\n\n- **`peerDependencies`** — a package that must resolve to a **single instance**\n  in the consumer's tree: a framework host (`svelte`, `@sveltejs/kit`) or\n  anything whose instances/types cross the library's API boundary (`zod`\n  schemas, `esm-env` flags). Two copies break `instanceof`, Zod `.brand()`\n  identity, Svelte context keys, and the dev/prod env gate. Required when the\n  public API always reaches it; **optional** (via `peerDependenciesMeta`) when\n  it's an opt-in / à-la-carte path (a preprocessor, a deep-import module many\n  consumers skip). Mirror the version in `devDependencies` so the library's own\n  build/test resolves it. **An optional peer is only safe to leave optional\n  when a _required_ peer guarantees it transitively** — `svelte` and\n  `@sveltejs/kit` both depend on `esm-env`, so a lib that requires either can\n  leave `esm-env` optional. A runtime import of a singleton on a path with\n  **no** required framework peer (e.g. `esm-env` in a node-only utility like\n  `fuz_util/log.ts`) must be a **required** peer instead — npm auto-installs\n  required peers, so the consumer never hits a missing-module crash, where an\n  optional one would.\n- **`dependencies`** — published code imports it, but it's a self-contained\n  internal detail never handed across the API boundary (no singleton hazard) —\n  pin a known-good version.\n- **`devDependencies`** — only used by the library's build/test, never shipped\n  in `dist` (the toolchain: `typescript`, `vite`, `eslint`, `svelte-check`, …).\n\nBuild-time helpers that published code imports but a consumer never interacts\nwith (`magic-string`, `zimmerframe` for a Svelte preprocessor) carry no\nsingleton hazard — classify them as **`dependencies`** so the library ships its\nown self-contained copy and never leans on a consumer (or a transitive\nframework dep) to supply them. An **optional peer** is acceptable only when the\nhelper is already guaranteed by a _required_ framework peer — e.g. a type-only\n`@types/estree` reached through `svelte`, which depends on it, and is erased at\nbuild anyway. Never a `devDependency`-only import: that breaks any consumer who\nreaches the path. Either `dependencies` or a peer is correct for these; only a\n`devDependency`-only or undeclared import is wrong.\n\n**Apps, sites, and templates are not libraries** — they're leaf deploy targets\nwith no installing consumers, so they classify everything as `dependencies` /\n`devDependencies` and never declare peers.\n\nThe litmus test: _if a consumer ended up with a second copy of this package,\nwould anything break?_ Yes → peer (optional if the path is opt-in). No, but\npublished code imports it → dependency. Only the build sees it → devDependency.\n"},{slug:"path-references",title:"Path References in Documentation",content:'# Path References in Documentation\n\nThree forms, each with its own typography. The distinction is whether the target\nis a **navigable file** (bare path) or a **code-tree identifier** (backticked,\nno leading `./`).\n\n## 1. Navigational paths (bare, no backticks)\n\nFor docs, READMEs, external repos, and any reference that points to a file by\nlocation rather than by code identity:\n\n- `./foo` and `../foo` — relative to the file\'s directory; mdz auto-linkifies\n  these when preceded by whitespace\n- `~/dev/foo` — anchored at the workspace root; reads cleanly at any nesting\n  depth\n- `setup/foo` — bare workspace-root anchor (no `~/dev/` prefix); preferred over\n  deep `../../setup/foo` from nested files\n\n> **Don\'t attach a possessive to a bare path.** mdz\'s autolink treats `\'` as a\n> valid path character, so `./foo.md\'s` links to a 404 href ending in `\'s`.\n> Reword ("all live in `./foo.md`") or backtick the path.\n\n> **A bare path is a promise it resolves on disk.** An unbackticked `./`, `../`,\n> or `~/dev/` path is a real, navigable link — it must point at a file or\n> directory that exists, resolved relative to the file it appears in (`~/dev/`\n> from the workspace root). If you mean a path _illustratively_ — a conceptual\n> location (`./build/`), an example (`./foo/bar`), an import shown in prose\n> (`import \'./fuz.css\'`) — **wrap it in backticks**; that\'s the escape hatch\n> that says "literal, don\'t follow." Source TSDoc additionally must not point\n> outside its own repo (see §4).\n\n## 2. src/lib module references (backticked, src/lib-relative, no leading `./`)\n\nMarks the target as a code-like identifier — a module name, not a navigable\nfilesystem path.\n\n> **Rule**: a backticked reference to a **same-repo** src/lib module MUST be the\n> bare src/lib-relative form — never `../foo.ts`, never `./foo.ts`, never\n> `src/lib/foo.ts` (the redundant prefix), never `./src/lib/foo.ts`. The\n> backticks frame the token as a module identifier; a `src/lib/` prefix or `./`\n> `../` traversal contradicts that framing. Bare paths are the only place `./`\n> and `../` belong.\n\n> **Backticks are an escape hatch.** This rule applies only to references that\n> resolve to a same-repo module. A backticked path that _isn\'t_ one — a\n> cross-repo path, a deliberately-literal example, explanatory prose — is left\n> exactly as written. Don\'t rewrite `` `../some-other-repo/x.ts` `` or a\n> non-module path into the module form; the backticks mean "treat this\n> literally."\n\n- From any file inside src/lib: "`auth/account_schema.ts`" refers to\n  `src/lib/auth/account_schema.ts`. Prefer this over both\n  "`../auth/account_schema.ts`" (backticked with prefix — defeats the identifier\n  framing) and `../auth/account_schema.ts` (bare — reads as filesystem path)\n- From files outside src/lib (root CLAUDE.md, docs/, src/test/): include the\n  `src/lib/` prefix — "`src/lib/auth/CLAUDE.md`". The path-relative-to-src/lib\n  form ("`auth/CLAUDE.md`") is also acceptable from src/test/, but the\n  full-prefix form is unambiguous at any depth\n- Applies to any file under src/lib, including subsystem CLAUDE.mds:\n  "`auth/CLAUDE.md`", "`http/CLAUDE.md`"\n- Section refs follow: "`auth/CLAUDE.md`" §Middleware (backticks wrap the\n  module, `§Heading` follows outside the backticks)\n- Examples (all referring to a same-repo module):\n  - ✅ "`server/upload_route.ts`" — the bare src/lib-relative form\n  - ❌ "`src/lib/server/upload_route.ts`" — redundant `src/lib/` prefix\n  - ❌ "`./src/lib/server/upload_route.ts`" — prefix plus a `./`\n  - ❌ "`../server/upload_route.ts`" — backticked but traversal-relative\n  - ❌ "`./classroom_service.ts`" — backticked but self-relative\n\n## 3. Code-shaped things outside src/lib (backticks for code, not paths)\n\n- CLI commands: `gro check`, `deno task scry`\n- Top-level project files: `package.json`, `gitops.config.ts`, `tsconfig.json`\n- System/config identifiers: `~/.fuz/`, `~/.mg/config.json`\n\n## 4. Cross-repo references\n\nTo point at a file in _another_ workspace repo, use a **bare** navigational\npath (form 1) — `../other-repo/src/lib/foo.ts` or `~/dev/other-repo/...`. The\nbackticked module form (form 2) is **same-repo only**: it resolves against the\ncurrent repo\'s module index, so it can\'t name another package\'s module. For a\npublished package\'s module, the import-specifier form is the right code\nreference (`@scope/pkg/foo.ts`); a bare relative path is for navigation.\n\nTwo constraints follow:\n\n- **A bare cross-repo path must resolve to a real file.** It\'s a navigable\n  link; a stale `../old-name/...` left behind after a repo is renamed or moved\n  is a broken reference. Keep these accurate as the workspace changes.\n- **TSDoc must not use `../` to leave the repo.** Source comments render into\n  the published API docs, where the shipped package has no sibling repos — an\n  out-of-repo `../` becomes a dead link. Keep TSDoc references repo-local;\n  attribute external inspiration in prose without a navigable path, or link a\n  URL. (Backticked explanatory paths remain the escape hatch — see §2.)\n\nEach file\'s relative paths assume the reader is in the file\'s parent directory.\nFrom `~/dev/CLAUDE.md`, project paths are `./project/`. From a deeply nested\nfile, prefer a workspace-root-anchored path (`setup/scripts/foo.md`) over deep\n`../../../scripts/foo.md`.\n\n## 5. Import specifiers (code imports, not doc prose)\n\nThe forms above govern paths _written in docs/prose_. Import specifiers in\n**source** use the real source extension (`.ts` / `.svelte.ts` / `.svelte`),\nnever the old `.js`-for-a-`.ts`-file form, and pick the alias by **whether the\nmodule ships**:\n\n- **`src/lib` (ships as `dist`) → relative only** (`./`, `../`):\n  `import {x} from \'./sibling.ts\'` — the build rewrites these to `.js` into\n  `dist`. Aliases break here: both `$lib`/`$routes` (Vite-only) and\n  `#lib`/`#routes` (resolve to `./src/lib/*`, absent from the tarball —\n  `"files": ["dist"]`) give consumers `ERR_MODULE_NOT_FOUND`.\n- **Everything else → `#lib/*` / `#routes/*`** package.json subpath imports\n  (`"imports": {"#lib/*": "./src/lib/*"}`): routes, components, vitest tests, and\n  spawn-outside-Vite entries (Deno/Node servers, benchmarks, `deno` / `bun` /\n  `gro run` scripts) — none of it shipped. One mechanism resolves across Vite,\n  Node, Bun, Deno, and Gro\'s loader, so the alias never depends on which runtime\n  spawns the file. (`$lib`/`$routes` are retired — Vite-only, so a raw `deno run`\n  fails `Import "$lib/…" not a dependency`.)\n- **Cross-package** `@fuzdev/<pkg>/sub.ts` → resolves via the target\'s `exports`\n  `.js`/`.ts` mirror to its `dist`. (Packages without subpath exports, like\n  `@fuzdev/blake3_wasm`, are imported by bare package name only.)\n\n`$app`/`$env` stay (virtual modules, not file paths). `@ryanatkn/eslint-config`\nwarns on all four aliases (`$lib`/`$routes`/`#lib`/`#routes`) inside `src/lib`\n— library code imports relative. The rule covers `import`/`export`\ndeclarations including `import type`, but **not** inline `import(\'#lib/…\')`\ntype positions (base `no-restricted-imports` doesn\'t visit `TSImportType`) —\ncatch those in review. Outside `src/lib`, `$lib` remains widespread in\nexisting code while the `#lib` migration is in progress.\n\n## Web-rendered caveat\n\nIn files published via mdz on a website (this skill renders on fuz_docs),\nnon-`.md` `./foo` and `../foo` examples must be backticked to prevent mdz from\nrendering them as broken `<a>` tags. Bare relative `.md` links are fine —\nfuz_docs\' `skill_docs.gen.ts` rewrites them to routes outside code spans.\n`~/dev/foo` and bare workspace-root paths (`setup/foo`) are safe bare in web\ncontext — mdz doesn\'t auto-linkify those prefixes.\n\n## Anti-patterns\n\nThe linkifier won\'t fire on these, costing tokens and navigability:\n\n- **Mixing the two forms**: backticks + a leading `./` or `../` is the\n  wrong-of-both-worlds case. Pick a form. "`./foo.md`" should be either bare\n  (`./foo.md`, navigational) or — for src/lib — "`subsystem/foo.ts`"\n  (module-form, drop the relative prefix).\n- **Backticking a navigable target**: "`~/dev/fuz_util`" reads as a code\n  identifier when it\'s actually a path. Use bare `~/dev/fuz_util`.\n- **Redundant markdown-link syntax** when target equals visible text:\n  `[../README.md](../README.md)` is redundant; bare `../README.md` already\n  auto-links. Same for `[~/dev/foo](~/dev/foo)` — collapse to bare `~/dev/foo`.\n  Reserve `[text](url)` for cases where the visible token _isn\'t_ the path —\n  e.g. a package-name-as-link: `[@fuzdev/fuz_app](../../fuz_app)`.\n\n## Formatter cautions (these have bitten real docs)\n\n- A line wrapping after `+` becomes a sublist. `cell + fact` followed by a formatter\n  wrapping to `+ cell_history` reflows as a bullet. Rephrase\n  (`cell, fact, and cell_history`) or keep the `+` mid-line.\n- Bare `_` in inline prose mixed with backticked identifiers can be parsed as\n  italic delimiters and mangle text — eating spaces and swapping characters.\n  Backtick identifiers like `scope_id` or `cell_*` even when the surrounding\n  sentence isn\'t otherwise code-heavy. When several `_`-bearing identifiers\n  appear in one sentence, restructure as a bullet list so each lands at\n  end-of-line away from prose interactions.\n'},{slug:"rust-dependencies",title:"Approved Rust Dependencies",content:"# Approved Rust Dependencies\n\nThe canonical allowlist of external crates approved for Rust workspaces\nacross the ecosystem. Prefer these; reach outside the list only with\nexplicit approval (see [§Adding a dependency](#adding-a-dependency)).\n\n**Scope**: the canonical (non-experimental) Rust workspaces — CLIs and\ndaemons, the WASM/FFI/N-API bindings, the web servers and their spine crates.\nDifferent-paradigm or pre-canonical repos (games, protocol research) carry\ntheir own deps and are out of scope here. For an external project adopting\nfuz-stack, the list is advisory — a vetted starting set, not a gate; the\napproval _process_ below applies only inside the ecosystem workspaces.\n\n**Source of truth**: each repo's root `[workspace.dependencies]`. This doc\nmirrors the **union** of those for human and agent audit; it is not\ngenerated. Any single workspace carries a small subset (zap's direct\nexternal set is ~11 crates; the forge's ~24 — everything else arrives\ntransitively via the spine). Verify against the workspaces periodically.\n\nCrates internal to a workspace (declared with `path = ...`) are not\ndependencies in this sense and never appear here — including cross-repo path\ndeps onto the fuz spine crates.\n\nA few approved crates are pinned at the **member-crate** level rather than in\na root `[workspace.dependencies]`: `js-sys` (optional, feature-gated),\n`wasm-bindgen`, and `talc` (wasm32-only target dep) in `tsv_wasm`, `similar`\nand `tempfile` in `tsv_debug`, `libc` in `zzz_server` (also a workspace dep\nin the fuz workspace), and `http-body-util` as a dev-dependency of\n`fuz_http`. They're real external deps and belong here.\n\n## Serialization & encoding\n\n| Crate        | Purpose                                                 |\n| ------------ | ------------------------------------------------------- |\n| `serde`      | Derive-based serialization framework                    |\n| `serde_json` | JSON (tsv enables `preserve_order` + `float_roundtrip`) |\n| `postcard`   | Compact binary serialization (the fuzd UDS wire)        |\n| `hex`        | Hex encoding/decoding                                   |\n| `base64`     | URL-safe base64 (tokens)                                |\n\n## Errors & core utilities\n\n| Crate                                                      | Purpose                                                                                                |\n| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |\n| `thiserror`                                                | Derive typed error enums                                                                               |\n| `futures` / `futures-util`                                 | Async combinators, `BoxFuture`                                                                         |\n| `time`                                                     | Date/time                                                                                              |\n| `uuid`                                                     | UUIDs                                                                                                  |\n| `semver`                                                   | Semantic-version parsing                                                                               |\n| `url`                                                      | URL parsing                                                                                            |\n| `tempfile`                                                 | Temp files/dirs (`NamedTempFile`)                                                                      |\n| `smallvec`                                                 | Stack-allocated small vectors                                                                          |\n| `bytes`                                                    | Cheaply-cloneable byte buffers (Postgres wire params in `fuz_db`)                                      |\n| `bumpalo`                                                  | Arena allocation (`collections` feature) — tsv's core AST strategy; see ./rust-perf §Arena allocation |\n| `phf`                                                      | Compile-time perfect-hash maps/sets (keyword tables)                                                   |\n| `unicode-ident` / `unicode-segmentation` / `unicode-width` | Unicode text handling                                                                                  |\n| `similar`                                                  | Text diffing (tsv's debug/compare tooling)                                                             |\n\n## Async runtime & networking\n\n| Crate                  | Purpose                                                                                                                          |\n| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |\n| `tokio`                | Async runtime                                                                                                                    |\n| `tokio-util`           | `CancellationToken`, `TaskTracker`                                                                                               |\n| `axum`                 | HTTP server (on hyper)                                                                                                           |\n| `axum-extra`           | axum extras (typed headers, cookies)                                                                                             |\n| `tower` / `tower-http` | Service middleware                                                                                                               |\n| `reqwest`              | HTTP client                                                                                                                      |\n| `rustls`               | TLS backend for `reqwest` — installs the `ring` crypto provider as the process default (`reqwest` is wired `rustls-no-provider`) |\n\n## Concurrency\n\n| Crate         | Purpose                                                                                                                                                     |\n| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| `parking_lot` | `Mutex`/`RwLock` for sync-only critical sections (no poisoning). See ./rust-perf §Async lock hygiene for when to use `tokio::sync` or `std::sync` instead. |\n| `lru`         | Bounded LRU cache backing the `RateLimiter` — caps tracked keys so a key-enumeration attacker can't grow the map unboundedly (twin of fuz_app's `LruMap`).  |\n\n## Database\n\n| Crate               | Purpose                 |\n| ------------------- | ----------------------- |\n| `tokio-postgres`    | Async PostgreSQL client |\n| `deadpool-postgres` | Connection pooling      |\n\n## Crypto & auth\n\n| Crate           | Purpose                                                                                                                                                            |\n| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |\n| `blake3`        | Content-addressed hashing, token hashing                                                                                                                           |\n| `argon2`        | Password hashing                                                                                                                                                   |\n| `ed25519-dalek` | Ed25519 signing/verification (artifact + release signatures)                                                                                                       |\n| `hmac` / `sha2` | HMAC-SHA256 (signed cookies, keyring)                                                                                                                              |\n| `subtle`        | Constant-time comparison                                                                                                                                           |\n| `zeroize`       | Secure memory clearing                                                                                                                                             |\n| `getrandom`     | OS randomness — the spine standard for new randomness (`fuz_sys::rand`, `fuz_auth`, `fuz_storage`)                                                                 |\n| `rand`          | RNG — pinned `0.8` in `[workspace.dependencies]`, consumed only by `fuz_sign` (the `ed25519-dalek` → `rand_core 0.6` constraint). Prefer `getrandom` for new code. |\n\n## Filesystem & OS\n\n| Crate    | Purpose                                                     |\n| -------- | ----------------------------------------------------------- |\n| `nix`    | POSIX syscalls (advisory `flock`, permissions)              |\n| `libc`   | Raw libc FFI for syscalls/types beyond `nix` (PTY, signals) |\n| `notify` | Filesystem watching (inotify / FSEvents)                    |\n| `tar`    | tar archives                                                |\n| `flate2` | gzip / deflate                                              |\n\n## CLI\n\n| Crate  | Purpose                                                                                             |\n| ------ | --------------------------------------------------------------------------------------------------- |\n| `argh` | Derive arg parser, size-optimized. See ./rust-patterns §CLI Patterns for the parser-tier guidance. |\n\n## Logging\n\n| Crate                | Purpose                                                                            |\n| -------------------- | ---------------------------------------------------------------------------------- |\n| `tracing`            | Structured logging                                                                 |\n| `tracing-subscriber` | Subscriber / formatting layers (consumed via `fuz_sys::logging`, not per-consumer) |\n| `tracing-appender`   | Non-blocking file appender                                                         |\n\n## WASM, N-API & host\n\n| Crate                                 | Purpose                                                                                                                                                                                                                                                                                       |\n| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| `wasm-bindgen`                        | JS interop (wasm-pack)                                                                                                                                                                                                                                                                        |\n| `js-sys`                              | engine-native `JSON.parse` for the wasm-bindgen parse exports (tsv)                                                                                                                                                                                                                           |\n| `talc`                                | WASM global allocator (`tsv_wasm`, wasm32-only target dep) — pure-Rust `no_std` replacement for std's dlmalloc; use the `WasmGrowAndExtend` source (the default claim source fragments a long-lived instance's linear memory). Pulls `lock_api` + `allocator-api2` into the wasm32 graph only |\n| `napi` / `napi-derive` / `napi-build` | N-API bindings — the native Node.js/Bun npm path (`tsv_napi`); `napi-build` is the matching build dep                                                                                                                                                                                         |\n| `wit-bindgen`                         | Component-model bindings                                                                                                                                                                                                                                                                      |\n| `wasmtime` / `wasmtime-wasi`          | WASM host (tests, benches)                                                                                                                                                                                                                                                                    |\n\nSee ./wasm-patterns for the binding-layer conventions these support.\n\n## Image processing\n\n**`libvips`** — Rust bindings to the system **libvips** image library (the\nsame engine `sharp` wraps) for decode/resize/encode (JPEG/PNG/WebP/AVIF),\nEXIF-orientation baking, metadata stripping, and thumbnailing. For\nspine-consumer servers with an image-upload pipeline (e.g. `visiones_server`).\n\n- Dynamically links system libvips: `libvips42t64` (Debian 13) at runtime +\n  `libvips-dev` at build time — not a static-musl crate; on a Debian host\n  `zap` installs it via apt.\n- The `unsafe` FFI lives inside the binding — consumer crates keep\n  `unsafe_code = \"forbid\"`.\n- Chosen over the pure-Rust `image`/`ravif`/`image-webp` stack because\n  matching `sharp`'s formats there pulls in `libwebp` + `dav1d` C deps\n  anyway, across more crates and with worse parity.\n\n## Crate-vs-feature isolation (supply-chain)\n\nWhen a capability must be kept **out of** a binary's dependency graph for\nsecurity or trust reasons, make it a **separate crate, not a cargo feature**.\nCargo unifies features across a `--workspace` build, so a feature-gated\n\"signing\" or \"test-hasher\" path can be silently turned on by an unrelated\ncrate's feature selection. A separate crate can't be: it is either in the\ndependency graph or it is not, and that is auditable.\n\n- `fuz_sign` is a separate crate (not a `fuz_crypto` feature) so signing stays\n  out of the `fuz` consumer graph — `fuz` links verification-only `fuz_crypto`.\n- `fuz_testing` is a separate crate (not a `fuz_auth` feature) so the weakened\n  test Argon2 params can't reach a production binary.\n- Enforcement is the `cargo xtask check-release` dep-graph audit (`fuz_audit`),\n  which fails if any non-`testing_`-prefixed binary transitively links a\n  forbidden crate; workspaces add extra forbids via `AuditRules`. See\n  ./rust-spine §xtask & check-release for the entry points and the\n  built-in layering rules.\n\n## Shared low-level leaves\n\n**When a utility gets reimplemented a third time, extract it as a spine-free\nleaf** — no tokio-server/HTTP/DB surface, so spine-free repos can link it too.\n`fuz_eval` (the sandboxed config-eval harness, lifted out of zap) is the proven\ncase, now shared down to its JS wrapper ingredients.\n\nKnown-duplicated, not yet extracted: a minimal dotenv (`KEY=VALUE`) parser\n(three copies), an env-isolating subprocess harness with a capped output drain\n(one, awaiting a second consumer), the atomic-write/flock dance for consumers\nthat can't link `fuz_sys::fs::write_atomic` (./rust-patterns §Transactional\nstate files), and an exponential-backoff retry combinator (none generic today —\nthe only backoff is supervision-shaped, not request-retry).\n\nSignal-crate convention: prefer `nix` for syscall wrappers; reserve `libc` for\ntypes/constants `nix` doesn't expose (PTY). Avoid pulling both into one\nworkspace for the same job.\n\n## Feature hygiene\n\n- **`default-features = false` + explicit feature lists** for deps with heavy\n  optional trees — `reqwest`, `nix`, `notify`, `futures-util` all do. Opt into\n  exactly what the workspace uses; don't inherit a crate's default surface.\n- **`multiple_crate_versions = \"allow\"`** (./rust-patterns §Lints) tolerates\n  _forced_ duplicate majors from the dep graph — transitive constraints two\n  upstream crates disagree on, unresolvable until one bumps. Not a license to\n  ignore version drift you control.\n\n## Adding a dependency\n\nNew crates — whether a third-party dependency or a first-party workspace\nmember — are added deliberately, not incidentally:\n\n- Prefer the standard library, then this list, before anything new.\n- A new dependency needs explicit approval — name it, its purpose, what it\n  replaces or enables, and its transitive footprint.\n- Creating a new first-party crate (a new `crates/<name>/` workspace member)\n  likewise needs explicit approval — minting a new crate boundary is a\n  build-graph and release-surface decision. Adding a module, file, or\n  directory inside an existing crate doesn't; the gate is only on the new\n  crate itself.\n- Add it at the workspace level (`[workspace.dependencies]`) so member\n  crates share one version, then record it here.\n- Removing an unused dependency is pre-authorized — no approval needed. Verify\n  nothing references it (including features and build scripts), then drop the\n  entry. Removing the last user of a crate? Drop it from the workspace and\n  this list in the same change.\n"},{slug:"rust-patterns",title:"Rust Patterns for the Fuz Ecosystem",content:'# Rust Patterns for the Fuz Ecosystem\n\n**Applies to**: any Rust workspace adopting fuz-stack conventions — the\necosystem\'s own (the `fuz`/`fuzd` CLI + daemon and spine crates, the\nspine-consumer servers `zzz`/`fuz_forge`, the `zap` convergence CLI, the\n`tsv` parser/formatter, the `blake3` WASM bindings) and new or external\nworkspaces starting from these conventions. All use **Rust edition 2024**,\nresolver 2.\n\n**Boundary**: this skill owns _conventions and patterns_ — rules a workspace\nadopts, with ecosystem repos cited as exemplars. Each repo\'s `CLAUDE.md` owns\nits _inventory_ (crate lists, commands, env vars, package tables) and is\nauthoritative for project-specific choices. Every pattern here stands alone;\nwhere a spine crate is named as the canonical implementation, that\'s the\necosystem wiring — a spine-free workspace adopts the pattern\'s shape (zap is\nthe worked precedent throughout).\n\nCompanion references: ./rust-spine (spine surface + consumer-server\ncontracts), ./rust-perf (performance), ./rust-dependencies (approved\ncrates), ./twin-impl (TS ↔ Rust twins), ./wasm-patterns (binding\ncrates).\n\n## Core Values\n\n- **No backwards compatibility**: Pre-1.0 means breaking changes. Delete old\n  code, don\'t shim.\n- **Code quality**: `unsafe_code = "forbid"`, pedantic lints, tests expected.\n- **Performance**: If it\'s slow, it\'s a bug. See ./rust-perf.\n- **Copious `// TODO:` comments**: Mark known future work. `todo!()` is\n  `warn` workspace-wide — `#[allow(clippy::todo)]` with justification when\n  needed.\n- Doc comments (`///`) for public API; inline (`//`) for implementation\n  notes.\n\n## New Workspace Checklist\n\nBootstrapping a fuz-stack Rust workspace, in order:\n\n1. `[workspace.package]`: `edition = "2024"`, `version = "0.1.0"`,\n   `license = "MIT"`, `publish = false` (until publishing is real);\n   `resolver = "2"`.\n2. Copy the canonical `[workspace.lints.*]` block (§Lints); every crate takes\n   `[lints] workspace = true`. Add a root `clippy.toml` with\n   `allow-{unwrap,expect,panic}-in-tests = true`.\n3. Copy the canonical `[profile.release]` (§Release Profile). Add derived\n   profiles only with a driving need.\n4. Crate naming: `{project}_{crate}`; short bare names only for\n   frequently-typed binaries (§Project Structure).\n5. Errors from day one: `thiserror` library enums, a binary wrapper error,\n   `fn main() -> ExitCode` (§Error Handling). Pick the exit-code dialect\n   early and test it (§CLI Patterns).\n6. Dev automation: spine-consuming workspaces add an `xtask` crate wrapping\n   `check-release` (./rust-spine §xtask & check-release); binding/library\n   repos may use a script runner instead (tsv and blake3 drive builds,\n   validation, and publishing through Deno tasks, no xtask).\n7. Deps: start from ./rust-dependencies; share versions via\n   `[workspace.dependencies]`.\n\n## Lints\n\nThe canonical workspace lint block:\n\n```toml\n[workspace.lints.rust]\nunsafe_code = "forbid"\nmissing_debug_implementations = "warn"\ntrivial_casts = "warn"\ntrivial_numeric_casts = "warn"\nunused_lifetimes = "warn"\nunused_qualifications = "warn"\n\n[workspace.lints.clippy]\n# Enable lint groups (priority -1 so individual lints can override)\nall = { level = "warn", priority = -1 }\npedantic = { level = "warn", priority = -1 }\nnursery = { level = "warn", priority = -1 }\ncargo = { level = "warn", priority = -1 }\n\n# Pedantic overrides\nmodule_name_repetitions = "allow"\nmust_use_candidate = "allow"\nsimilar_names = "allow"\ntoo_many_lines = "allow"\n\n# Nursery overrides\nsignificant_drop_tightening = "allow"\n\n# Cargo overrides (private repos)\ncargo_common_metadata = "allow"\nmultiple_crate_versions = "allow"\n\n# Restriction lints (panic points need explicit #[allow] with justification)\nclone_on_ref_ptr = "warn"\ndbg_macro = "warn"\nexpect_used = "warn"\npanic = "warn"\ntodo = "warn"\nunwrap_used = "warn"\n```\n\n**Workspaces may diverge deliberately** — a domain can earn extra allows\n(tsv carries a large parser-shaped superset — ~35 extra clippy allows plus\nrestriction `unreachable = "warn"`; blake3\'s workspace omits\n`missing_debug_implementations`). Superset-by-design is not drift; the repo\'s\n`CLAUDE.md` documents it — diff the override against that repo\'s workspace\nblock, not the generic one above. Two extras worth adopting: a\n`[workspace.lints.rustdoc]` block denying `broken_intra_doc_links` (plus\n`invalid_html_tags`/`bare_urls`/`redundant_explicit_links`) — a doc link is\nthe only machine-checkable claim a doc comment makes, and re-declared\ncrate-level lint blocks must re-carry it too — and a `rust-toolchain.toml`\npin, since floating stable breaks on new nursery lints. tsv and fuz_forge both\ncarry the rustdoc block; `private_intra_doc_links` stays at its default warn\nwhere module headers deliberately link private members.\n\n#### Running the doc-link gate\n\n```bash\ncargo doc --no-deps --workspace --document-private-items\n```\n\nThree things about this gate are easy to get wrong, and all three have bitten:\n\n- **rustdoc lints fire under `cargo doc` alone** — never under `cargo build`,\n  `cargo test`, or `cargo clippy`. A workspace that runs only those three has\n  the lint configured and ungated.\n- **The pass condition is the exit code, not a warning grep.** Under `deny` an\n  unresolved link is an `error:`, so a check like\n  `grep -c \'^warning: unresolved link\'` returns `0` on a *broken* doc exactly as\n  it does on a clean one. Gate on the command\'s exit status.\n- **`--document-private-items` is part of the gate, not a nicety.** Rustdoc\n  resolves links only inside the items it documents, so without the flag the\n  reach is each crate\'s public surface (plus whatever a `pub use` pulls into it)\n  and every doc comment on a private or `pub(crate)` item goes unchecked. The\n  silence hides real breakage: a link like ``[`crate::a::b`]`` whose `b` is a\n  **private module** is *unresolvable* — an error under the `deny`, not a\n  `private_intra_doc_links` warning — and the plain run never reads the comment\n  to say so. The flag costs nothing in noise: both forms emit the same warnings.\n\nA companion trap from clippy\'s nursery: `doc_link_code` rejects the natural\n`` [`Arc`]`<`[`T`]`>` `` spelling for a generic-shaped intra-doc link. Use\nclippy\'s own suggested fix — wrap the whole thing in `<code>` — so both halves\nlink inside one code span.\n\n### Crate-level overrides — re-declare the whole block\n\nA crate that needs `unsafe_code` (C-FFI/N-API ABI layers, wit-bindgen\ncomponents, PTY wrappers) can\'t _partially_ override the workspace `forbid`:\nCargo replaces the entire `[lints]` table, so relaxing one lint means\nre-declaring **all** the others in the crate\'s own `[lints]`. Re-paste the\nfull workspace block and change only what must change.\n\n- Full-re-declare exemplars: `tsv_ffi`, `tsv_napi`, `blake3_component` (the\n  last also allows two generated-code false positives).\n- The trap is real: `fuz_pty`\'s re-declared block silently dropped\n  `clone_on_ref_ptr` — exactly the failure mode partial re-declaration\n  invites. Diff the override against the workspace block when touching one.\n- A binding crate that doesn\'t actually emit unsafe keeps\n  `[lints] workspace = true` and inherits `forbid` — many wasm-bindgen crates\n  do.\n\n## Release Profile\n\n```toml\n[profile.release]\nlto = true\ncodegen-units = 1\npanic = "abort"\nstrip = true\n```\n\nSlower builds (~2x), no symbol names in backtraces — worth it for binary size\nand performance. Carried byte-identically across the ecosystem workspaces;\ntreat it as the default, not a per-repo choice.\n\nDeliberate exceptions show the escape hatch:\n\n- **WASM-first repos** set `opt-level = "s"` as the base (blake3), overridden\n  per-build via `RUSTFLAGS` (./wasm-patterns).\n- **Derived profiles for a driving need**: tsv\'s `[profile.corpus]`\n  (`inherits = "release"`, `panic = "unwind"`, plus `lto = false` /\n  `codegen-units = 16` for iteration speed) exists because `catch_unwind` is\n  dead under `panic = "abort"` — it powers the Prettier differential-corpus\n  run. Its `[profile.napi]` (`inherits = "release"`, `panic = "unwind"`)\n  exists because `#[napi(catch_unwind)]` is inert under abort and a panic\n  would kill the *host* process (dev server, editor). `[profile.profiling]`\n  keeps `debug = true`, `strip = false` for symbolicated profiles.\n\n## Error Handling\n\nLibraries export `thiserror` enums; binaries wrap them via `#[from]` and own\nexit:\n\n```rust\n// Binary crate — wraps library errors\n#[derive(Debug, Error)]\npub enum CliError {\n    #[error(transparent)]\n    Client(#[from] ClientError),\n\n    #[error(transparent)]\n    Artifact(#[from] ArtifactError),\n}\n\n// Central error handling — return ExitCode, never std::process::exit\nfn main() -> ExitCode {\n    let Err(e) = run() else { return ExitCode::SUCCESS };\n    eprintln!("error: {e}");\n    if let Some(hint) = e.hint() {\n        eprintln!("hint: {hint}"); // print site owns the `hint:` label\n    }\n    ExitCode::from(e.exit_code()) // -> u8\n}\n```\n\nUse `#[source]` to chain causes: `Display` shows only the variant\'s own\nmessage; the chain surfaces via `e.source()` for structured logging\n(`ResponseParse(#[source] serde_json::Error)`). For parsers, carry `position`\n\n- optional context on variants so the renderer can draw a caret pointer\n  (tsv\'s `ParseError`).\n\n### Helper methods\n\n- **`.hint()`** — user-facing fix suggestion. `Option<HintMessage>` when most\n  variants lack one, or `&\'static str` (`""` = absent) when all have one.\n  `HintMessage` (`Static(&\'static str) | Owned(String)`) is the shared\n  primitive (`fuz_sys::cli`); import it, don\'t re-declare. Hint strings carry\n  _advice only_ — the print site owns the `hint:` label.\n- **`.exit_code()`** — `u8` for `ExitCode::from`; match arms over variants.\n  Code policy: §CLI Patterns.\n- **Classifiers** — small `&self -> bool` methods the caller branches on,\n  named for the decision, not the variant: `is_transient` (retry might\n  succeed — use this verb everywhere), `is_recoverable` (restart),\n  `needs_daemon_start`, `is_security_violation`. Each answers one dispatch\n  question by matching variants; a wrapper forwards its inner classifier,\n  never re-decides. They land wherever a consumer branches — including\n  library errors: `fuz_archive` and `fuz_release` expose\n  `is_security_violation()`, consumed downstream to split exit codes.\n\n**Placement**: helpers belong on the binary\'s top-level error; library errors\nstay thin (variants only). Exception: a library with exactly one binary\nconsumer may carry `exit_code()`/`hint()` itself with the binary delegating —\n`zap_core::Error` does this to co-locate exit-code policy with the variants.\n\n**Single-source the hint table; wrappers delegate.** When a wrapper owns a\nvariant whose source already has a hint, delegate — one wording on every\npath. The source returns `Option<HintMessage>` so it can carry an\ninterpolated `Owned` hint. A static-only leaf that doesn\'t dep the shared\nprimitive stays `Option<&\'static str>`; the first aggregator that does lifts\nit with `.map(HintMessage::Static)`. Don\'t push a dep onto a pure leaf just\nto unify the hint type.\n\nFor WASM boundary errors (`JsError`, typed WIT error enums) see\n./wasm-patterns.\n\n## Async Runtime & Graceful Shutdown\n\nServer/daemon crates use **tokio** + **tokio-util**\'s `CancellationToken`:\none token owned at the top, cloned into every task that must react. The\nsignal → token helper is single-sourced — in the ecosystem that\'s\n`fuz_sys::signal::shutdown_token()` (a spine-free workspace hand-rolls the\nsame shape once: spawn a task selecting `ctrl_c()` / SIGTERM, cancel the\ntoken):\n\n```rust\nlet shutdown = fuz_sys::signal::shutdown_token();\n\nlet server = Server::new(addr, shutdown.clone(), /* ... */);\n\ntokio::select! {\n    res = server.serve() => res,\n    () = shutdown.cancelled() => Ok(()),\n}\n```\n\naxum\'s `with_graceful_shutdown(shutdown.cancelled())` stops accepting\nconnections but drains in-flight requests; always bound the drain with a\ntimeout `select!` — without it a hung handler keeps the process alive\nforever (the spine ships this as `fuz_http::serve_with_shutdown` +\n`DEFAULT_DRAIN_TIMEOUT`, ./rust-spine).\n\nLong-running tasks check the token via `select!`, and every shutdown branch\nflushes pending work before returning. The reference shape is a\n`Notify`-driven flusher: wakeups debounced behind the most recent event so an\nidle daemon doesn\'t tick, every `select!` arm includes\n`shutdown.cancelled()`, and the shutdown arm does a final `flush()`.\n\n`tokio_util::task::TaskTracker` when shutdown must verify "all workers exited\ncleanly"; skip it for short-lived or naturally-dropped tasks.\n\n**Don\'t**: `std::process::exit()` inside async code (bypasses Drop); bare\n`tokio::spawn` with no shutdown awareness for anything holding resources;\n`tokio::sync::broadcast` as a poor-man\'s cancellation token.\n\n## Naming Conventions\n\nNatural Rust naming for free functions — **not** the `domain_action` style of\nthis stack\'s TypeScript. `fn parse`, `fn create_artifact` — not\n`fn artifact_create`.\n\n## Idioms\n\nStyle guidance the lint config encodes (`clone_on_ref_ptr`, `panic`,\n`unwrap_used` warn). Ecosystem-specific bits called out with examples.\n\n### Prefer enums for closed sets\n\nFixed variant sets → enum, not `bool` or sentinel string; exhaustiveness makes\nevery `match` a contract that fires when variants change.\n\n**At a deserialization boundary this is also validation.** A `String` field\nfor a closed set accepts typos that fail at a late runtime guard — or\nsilently do the wrong thing. A `#[serde(rename_all = "…")]` enum rejects them\nat parse with `unknown variant \'x\', expected one of …`:\n\n```rust\n#[derive(Serialize, Deserialize)]\n#[serde(rename_all = "snake_case")]\npub enum FirewallPolicy { Allow, Deny, Reject } // "denyy" fails at parse, not at apply\n```\n\nValid values deserialize identically, so existing config files keep working —\nthe enum only starts rejecting inputs that were always bugs. Even a\nsingle-variant enum earns its keep: it rejects unknown values now, and the\nnext variant forces every `match` to handle it.\n\n**Leniency is only for genuine extensibility.** Keep a `String` (or a\ncatch-all variant) _only_ when the value passes through verbatim to an\nexternal system whose set is genuinely open and you don\'t dispatch on it.\n\n### Make impossible states unrepresentable\n\nThe umbrella principle: model so the type system rejects nonsense — don\'t\nlean on a runtime check or a comment.\n\n- **Mutually-exclusive → enum; co-present → struct.**\n- **A field only meaningful for some variants belongs inside those\n  variants**, not as a sibling `Option` that gets silently ignored elsewhere.\n- **Carry the payload on the variant** so "this combination can\'t happen" is\n  a compile fact.\n\n**Worked reference — `zap_types`**: `TargetLocation` (local+host\nunrepresentable, de/serializing through a flat wire struct via\n`#[serde(try_from/into)]`); payload-on-variant (`strip_components` inside\neach tar variant of `ExtractMode` — `TarXz`/`TarGz` — so the no-extract\nvariant can\'t carry one; the sudo list inside `UserSudo::Restricted`);\nsingle-variant tagged enums kept on purpose (`BuildSource::Remote`,\n`SourceVerify::Minisign`); transparent scalar newtypes validated at the serde\nboundary (`AccountName`, `Mode`, `ContentHash` — 64-lowercase-hex pin,\n`EnvVarName` — POSIX-identifier, shell-injection-safe map key); and\ntyped-enum-replaces-bool (`ExternalState` — an enumerable cache-leak-source\nmodel replacing an `external_state: bool` that was "carried but never\nconsumed"). `fuzi_core` is a second exemplar (`Os`/`Cpu`/`Libc` +\nnegation-aware `PlatformToken`, `LockfileVersion::from_raw`, an `Integrity`\nnewtype wrapping `ContentHash`).\n\n**Two anti-patterns reviewers actually hit:**\n\n- **The flattened discriminated union.** A `struct { available: bool, error:\nOption<String> }` whose doc-comment says "matches a TS discriminated union"\n  but whose type permits the impossible combos. The doc-comment _is_ the\n  smell — lift to an enum with payload-on-variant and a hand-written\n  `Serialize` for the flat wire shape (zzz\'s `ProviderStatus`:\n  `Available{…} | Unavailable{…, error}`).\n- **The `json!({"kind": …})` closed set.** Response bodies built with bare\n  `json!({"kind":"truncated", …})` across `match` arms are a discriminated\n  union evading the enum rule — model as `#[serde(tag = "kind", rename_all =\n"snake_case")]` so each variant carries only its payload. Identical wire\n  output (`fuz_forge_wire`\'s `BlobBody`: `Text{text} | Binary |\nTruncated{size}`).\n\n### Push a unifying newtype through the wire\n\nA newtype introduced to retire primitive drift must reach the\nwire/persistence shapes, not just the compute helper — otherwise the `String`\nit was meant to retire survives at the boundary. When the wire format is\nfixed (a signed manifest), a per-field serde adapter serializes the newtype\nto the legacy primitive so existing signatures stay valid:\n`fuz_crypto::ContentHash` ships through the release manifest via\n`#[serde(with = "fuz_crypto::blake3_hex")]`, keeping the newtype as the\nin-memory carrier. zap threads its own `scalar::ContentHash` end-to-end\n(schema → lock entries → resolved content) with two provenance constructors —\nvalidating `new` for parsed input, infallible `of_bytes` for computed hashes.\nThe same shape serializes closed sets to primitive wire values:\n`fuz_http::JsonrpcErrorCode` (./rust-spine §JSON-RPC envelope).\n\n### Zero-cost / low-cost abstractions\n\n- **Function pointers over trait objects** for statically-known dispatch:\n  a spawn config holds `build_command: fn(&Path, Option<&Path>) -> Command`,\n  not `Box<dyn Fn(…)>`.\n- **`Cow`-shaped wrappers** when some returns are constants and others need\n  interpolation: `HintMessage` (`Static | Owned`).\n\n### Avoid clone smells\n\n`clone_on_ref_ptr` warns on `arc.clone()` — write `Arc::clone(&arc)` so the\ncall site signals a refcount bump, not a deep copy. Reach for `Cow<\'_, str>`\nonly when callers genuinely have mixed-ownership data and the borrowed case\nis common.\n\n## Dependency Injection\n\nThe TS `*Deps` discipline doesn\'t translate 1:1 — much of what TS solves with\nDI (runtime agnosticism, module mocking, deterministic clocks) Rust solves\nnatively with the crate graph, trait bounds, monomorphization, test crates,\nand tokio\'s mock clock. Treat the pattern as an **escalation ladder**: start\nat the floor, climb only when a concrete need requires it.\n\n### Effects at the edges\n\nThe ladder\'s goal is a pure-ish core with effects pushed to the boundary —\nmost code testable without IO, mocks, or a runtime:\n\n- **Split IO from logic; inject the result, not the source.** A function that\n  reads a file _and_ decides on the contents becomes a thin edge doing the\n  read + a pure function over the parsed value.\n- **Presentation is a returned value, not prints in the library.** The\n  library returns a structured result; the binary renders it (human /\n  `--json` / `--quiet`). `println!` in library code is an effect like any\n  other.\n- **Contain async to the IO seam.** One async phase goes behind a trait; the\n  rest of the core stays sync under `block_on` / `spawn_blocking`. Coloring a\n  whole API async for one bounded phase is a smell — though a CLI doing real\n  network/subprocess IO throughout (zap) legitimately runs `#[tokio::main]`.\n\n### Active rungs\n\n**Floor — just import and call.** Pure utilities (fs helpers, canonical JSON,\nparsers, validators) don\'t enter the pattern at all.\n\n**Default — concrete `*Options` struct + direct refs.** State owned by the\napp (pool, keyring, audit emitter) passes as refs via a per-call-site\n`*Options` struct (or `*RouteState` for route-group-shared state) holding\n`Arc<T>` fields:\n\n```rust\npub struct SignupOptions {\n    // Capabilities (swappable):\n    pub pool: Pool,\n    pub password_hasher: Arc<dyn PasswordHasher>,\n    pub audit: Arc<AuditEmitter>,\n    pub signup_ip_rate_limiter: Option<Arc<RateLimiter>>,\n    // Parameters (fixed):\n    pub signup_fail_floor_ms: u64,\n    pub signup_fail_jitter_ms: u64,\n}\n```\n\nCapabilities + parameters collapse into one struct. **No `*Deps` suffix in\nRust** — `*Options` for per-call bags, `*RouteState` for shared route state.\n\n**Capability traits** — `PasswordHasher`, `Storage`, `BootstrapTokenStore`,\n`FactStore`. Pure noun, no suffix. Climb here when polymorphism is real:\ntestability swap (Argon2id ↔ fast test hasher), multi-impl plug-in, or\ninversion of definition (the lower crate declares the need; a higher crate\nimplements). (A hot-path service that never needs a swap stays a concrete\nstruct — `Keyring` deliberately has no trait.)\n\n**Boxed closure factories** — between "just a closure" and "capability\ntrait": a one-shot injection point that must be generic over the consumer\'s\ntype gets a boxed-`FnOnce` type alias, not a trait —\n`ExtraActionSpecsFactory<App>` / `PreMigrationHook<E>`\n(`fuz_actions::consumer_lifecycle`; see ./rust-spine §Server lifecycle).\nThe caller supplies it once at startup; test binaries hook through it; no\ntrait ceremony accrues. A trait earns the slot only when the seam has\nmultiple methods or long-lived polymorphic state.\n\n### Anticipated rungs, resolved differently\n\nTwo further rungs were anticipated and never built — the needs they named\nwere met by lighter shapes:\n\n- **Composite traits per handler tier** (an action-spec dispatcher generic\n  over multiple App types) — landed instead as the boxed-`FnOnce` factory\n  aliases above plus per-tier borrowed capability-bundle structs\n  (`fuz_auth`\'s `AuthenticatedActionContext`, `AccountActionContext`).\n- **Granular `*Provider` accessor traits** — no function ever needed a\n  narrow bound a composite couldn\'t express.\n\nBoth stay unbuilt; revisit only if a genuinely trait-shaped need appears\nthat a closure or borrowed struct can\'t express. If one lands: descriptive\nname (`*Actions`, `*Runtime`), never `*Deps`.\n\n### Enum dispatch before trait objects\n\nBefore reaching for _any_ trait, ask whether the impl set is closed and known\nat compile time. If so, an **enum with methods that match on `self`**\ndispatches statically, needs no vtable, and stays exhaustively checked. A\ntrait earns its place only when the impl set is genuinely open or crosses a\ncrate boundary the lower crate can\'t name.\n\nExemplars:\n\n- `fuz_storage::StorageBackend { File, Forge, Ssh }` — the `Storage` trait\n  is RPITIT and **never consumed as `dyn`**; the enum is the dispatch. The\n  enum wrapper must forward each backend\'s provided-method overrides (the\n  streaming `download_to_file`/`upload_file`) or it silently regresses every\n  backend to the buffered default.\n- `zzz_server::Provider` and `zap_core::Connection` (local / ssh / mock) —\n  async methods matching on `self`, no `#[async_trait]`.\n- `zap_core::EventHandler` (`Null` / `Stdout` JSON-lines / `Masking`\n  decorator / `Multi` fan-out, + test-only `Capture`) — sync `emit`.\n- `zap_types::ResourceKind` — the enum lives in the pure types crate;\n  dispatch is parallel **exhaustive matches in free functions** (one in the\n  detect pass, one in execute), so adding a kind is a compile error in both.\n\n**The inverse smell: a single-impl `Arc<dyn Trait>` is a deferred enum.**\nUntil a second impl or a test mock exists, prefer a concrete type or enum.\nPromotion is real when the swap case is: `FactStore` began as a single-impl\n`dyn` in a consumer and was later lifted into the spine as a documented\ncapability trait (PG-only / PG+disk / mock).\n\n### Hot/cold dispatch rule\n\n| Path     | Dispatch                                 | Why                                                                                                   |\n| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |\n| **Hot**  | concrete `Arc<T>`, `<T: Trait>`, or enum | Per-request HMAC, rate-limit checks; vtable cost measurable vs the op                                 |\n| **Cold** | `Arc<dyn Trait>`                         | `Arc<dyn PasswordHasher>` (Argon2), `Arc<dyn FactStore>`; op cost dwarfs vtable, testability earns it |\n\n`Arc<dyn>` also buys _type erasure_ (one field, no generic plumbing) — a\nseparate axis that sometimes justifies it on a hot path.\n\n### Async traits — RPITIT, with one carve-out\n\nPrefer return-position `impl Future` in traits for anything consumed as a\ngeneric bound or concrete type — monomorphizes, no boxed-future allocation:\n\n```rust\npub trait Storage: Send + Sync {\n    fn upload(&self, path: &str, data: &[u8])\n        -> impl Future<Output = Result<(), StorageError>> + Send;\n}\n```\n\n**Carve-out**: traits consumed as `Arc<dyn Trait>` can\'t use RPITIT (no `dyn`\nsupport yet). Return `BoxFuture<\'_, T>` manually rather than reaching for\n`#[async_trait]` — one line, explicit, no proc-macro (`PasswordHasher`,\n`BootstrapTokenStore`). Migrate uniformly when RPITIT gains `dyn` support.\n\n### Object-safety annotation on the trait def\n\nEvery `pub` trait in a shared crate declares its object-safety status as an\nitem-level `///` doc line, by _consumption pattern_:\n\n- **`**Object-safe**`** — dispatched dynamically anywhere. Shape locked: no\n  generic methods, no RPITIT (use `BoxFuture`).\n- **`**Not object-safe**`** — generic-bound / concrete-adapter use only; free\n  to use RPITIT.\n\nThe annotation tells contributors _why_ they can\'t add a generic method (or\nthat they can). Private one-off helper traits need no marker.\n\n### Test injection — concrete impls in a separate crate\n\nTest-only crates ship alternate impls satisfying the production traits — no\n`cfg(test)` shadows, no runtime branches. The concrete shape is **two\nbinaries over one `run_app` entry point** (production + `testing_*` sibling);\nsee ./rust-spine. A release-time dep-graph audit proves the test impls\ncan\'t reach a shipped binary (./rust-dependencies §Crate-vs-feature\nisolation).\n\n### Borrowed context, owned providers\n\nPer-request contexts borrow (`ActionContext<\'a>` holding `&dyn Fn(&str,\n&Value)` notify, `&CancellationToken`, request id); the App struct owns the\nunderlying `Arc<T>`s. The notify seam stays `&dyn Fn`, not `Arc<dyn Fn>`, on\nhot paths — zero alloc. When a handler needs a `\'static` sender the borrowed\nseam can\'t provide (streaming past the request), see ./rust-spine\n§Consumer wiring idioms.\n\n### What stays concrete\n\ntokio, tracing, `std::fs`, `std::env`, `std::time` — concrete by default.\nAbstract only when a concrete reuse case appears:\n\n- **Clock**: `#[tokio::test(start_paused = true)]` + `tokio::time::advance`\n  already gives deterministic control; a `Clock` trait would wrap what tokio\n  abstracts. Skip it.\n- **Filesystem**: prefer a domain-scoped trait (`BootstrapTokenStore` with\n  `read_token`/`delete_token`) over a general `Fs` — narrow seams compose,\n  wide ones accumulate methods.\n- **Logger / env**: abstract only when production noise blocks log-shape\n  assertions or a subsystem needs per-call env override.\n\n## Project Structure\n\n```\nproject/\n├── Cargo.toml          # Workspace: shared deps, lints, profile\n├── crates/\n│   ├── {proj}_*/       # Feature crates ({proj}_core, {proj}_types, …)\n│   ├── {proj}_cli/     # Binary (or just {proj}/ — see below)\n│   ├── {proj}_{wasm,ffi,napi}/  # Binding crates\n│   └── xtask/          # Dev automation (where present)\n├── tests/              # Integration tests (where applicable)\n└── docs/               # Architecture docs\n```\n\nCrate naming: `{project}_{crate}` (`fuz_sys`, `tsv_lang`,\n`blake3_wasm_core`). Exceptions: frequently-typed binaries get short bare\nnames — fuz\'s CLI is `fuz` (not `fuz_cli`), its daemon `fuzd`; a crate may\nstay `{proj}_cli` while its `[[bin]]` name is bare (tsv).\n\nCommon crate kinds: a foundation crate with minimal deps holding shared\ntypes (`{proj}_types`, `{proj}_lang`); feature crates with a `lib.rs` public\nAPI; interface/binding crates (CLI, C-FFI, N-API, WASM); an xtask crate. A\npure IO-free types crate at the bottom of the graph (zap_types, fuzi_core\'s\ntype layer) is the cheapest place to enforce the §Idioms modeling rules.\n\n## Build Configuration\n\n- **build.rs** earns its place for: git-version embedding\n  (`cargo::rustc-env=…_GIT_INFO={hash}`), compile-time validation of embedded\n  data (public keys), and target-triple embedding.\n- **xtask** owns dev automation: an `install`-style command (build → install\n  to the app home → restart daemon), the `check-release` audit (spine\n  workspaces — ./rust-spine), and publisher-only operations (signing,\n  publishing) kept out of shipped binaries. The `[alias] xtask = "run\n--package xtask --"` lives in `.cargo/config.toml`.\n- **Config vs secrets, by source**: a checked-in `.cargo/config.toml` `[env]`\n  holds _only non-secret dev overrides_ — anything checked in is silently\n  inherited by every `cargo run`. Generated, gitignored files (mode 0600) for\n  dev env; systemd/secrets infra for prod. Where the transport allows,\n  prefer OS-level peer auth over tokens entirely — `fuzd` authenticates its\n  UDS via `SO_PEERCRED` (same-uid), so there is no daemon token to manage.\n\n## Testing\n\n`cargo test --workspace`; unit tests in `#[cfg(test)] mod tests`, integration\ntests in `tests/` where applicable. Three testing shapes recur:\n\n- **Parsers/formatters** (tsv): snapshot fixtures (`tests/fixtures/…` with\n  input files + generated `expected.json`, created by a fixture tool, never\n  hand-edited) plus a **differential oracle** — corpus comparison against the\n  reference implementation (Prettier), built with the unwind profile so\n  panics surface as data — plus per-runtime binding tests.\n- **Binding crates** (blake3): correctness asserted from the _consumer\n  language_ against shared test vectors (TS for WASM, a Wasmtime compare\n  binary for the component); zero Rust unit tests by design, `cargo test` as\n  a compile gate. Legitimate — the boundary is where the bugs are.\n- **Twin servers** (zzz, fuz_forge): the integration harness is the TS\n  cross-backend suite launching the `testing_*` binary — see ./twin-impl.\n\n## CLI Patterns\n\nArg parsing tracks binary size. Three tiers:\n\n| Use case                                                 | Parser                  | +bytes vs `println!("hello")` |\n| -------------------------------------------------------- | ----------------------- | ----------------------------- |\n| Backend daemons, a few flags                             | manual `std::env::args` | +5 KB                         |\n| User-facing CLIs with subcommands                        | **argh**                | +16 KB                        |\n| Needs env-var binding, shell completions, or `wrap_help` | clap (`derive`)         | +340 KB                       |\n\nargh is schema-driven (`#[derive(FromArgs)]`) — same mental model as\nfuz_util\'s `args_parse` (Zod). Where a CLI exists in both TS and Rust, align\nflag names and aliases (`--port` / `-p`). Manual daemons `match` on the first\narg and return `Result` to the `main() -> ExitCode` wrapper — no\n`std::process::exit` in the async body, no `args[1]` panic. Shared input\nmodes: file path, `--content <string>`, `--stdin`.\n\n### Exit codes\n\nA small, _stable_ contract — treat it as a versioned API: settle it pre-1.0,\nassert each category → code in a test, document the table in the crate doc.\nMechanism: `fn main() -> ExitCode` + `exit_code(&self) -> u8`. **Key codes to\nthe caller\'s remediation, not to error type** — there are more error types\nthan useful codes.\n\n- **Default dialect** (human/script-facing — zap is the canonical impl): `0`\n  success; `2` = the caller must change something local before re-running\n  (bad args, config, credentials — "don\'t retry as-is"); `1` = everything\n  else (server error, transient failure, local IO — "a retry may help, or\n  it\'s out of the caller\'s hands"). Don\'t mint codes for categories nothing\n  branches on. A tool whose _success_ has grades returns them too (zap: `0`\n  converged, `2` dry-run drift, `1` wetrun failure).\n- **Agent tier** (automation-primary CLIs whose consumers branch on\n  category): `sysexits.h` codes **plus** a stable snake_case `error.kind` in\n  `--json`. `fuzi` is the reference; `fuz` adopts the same taxonomy for its\n  operationally-distinct artifact failures (lock held → `75`, disk full →\n  `73`, integrity → `65`). Two dialects max — pick by audience.\n- **Extend via a structured `kind`, not new exit integers.** A code is coarse;\n  when a consumer needs finer signal, add `error.kind` to `--json` — strictly\n  more expressive. Status signals are the carve-out: a reserved code for a\n  non-failure the caller branches on (fuz\'s `10` = update available) is a\n  distinct category from error codes, minted deliberately.\n- **argh gotcha**: `argh::from_env()` hard-exits `1` on a parse error — the\n  commonest usage error — violating "usage = 2". zap implements the fix:\n  parse with `T::from_args(&[cmd], &args)` and map the `EarlyExit` (`Ok` →\n  stdout, exit 0; `Err` → stderr, exit 2). Adopt that shape wherever the\n  usage-code contract matters; several binaries still use `from_env()` and\n  carry the wrong usage code.\n\n### Flags\n\n- **Dry-run posture is intentional per tool**: convergence/deploy tools\n  default to dry-run with opt-in execute (`zap --wetrun`); build/prune tools\n  default to execute with opt-in `--dry-run` (fuz).\n- The env-file flag is hyphenated `--env-file` (argh\'s default rendering).\n- **Env overlay without `set_var`**: zap parses `--env-file` into a\n  process-wide `OnceLock<HashMap>` overlay consulted before `std::env` — no\n  env mutation, so it works under `unsafe_code = "forbid"` (`set_var` is\n  unsafe in edition 2024).\n\n## Patterns\n\n### Sandboxed one-shot eval\n\nExecutable config (a TS builder run under `deno`) evaluates through a shared\nharness — `fuz_eval::eval_module(&EvalRequest)`: `deno run --no-prompt` with\n**no** net/env/write, a caller-chosen `ReadScope` (`Scoped(dir)` or\n`Unrestricted`), a wall-clock timeout + kill, and the wrapper piped over\nstdin (no temp file). Don\'t re-roll the spawn.\n\nPolicy belongs to the caller. zap passes `ReadScope::Unrestricted` under a\nfirst-party trust model (configs must resolve imports from anywhere up the\ndependency tree) — the walls that remain are net/env/write. Its wrapper also\nenforces **determinism by construction**: `Date.now` / `Math.random` /\n`performance.now` / `crypto.randomUUID` / no-arg `new Date()` are stubbed to\nthrow, and `console.log/info/debug` reroute to stderr so stdout stays pure\nJSON — the evaluated plan must be a content-addressed fact.\n\nThe wrapper _ingredients_ are shared exports of `fuz_eval` — the\ndeterminism stubs (`DETERMINISM_STUBS_JS`), the console redirect\n(`CONSOLE_TO_STDERR_JS`), and `build_extract_export_wrapper(name, stubs)`\nfor the common "eval a module, extract one named export as JSON" shape\n(injection-safe: the export name is JSON-encoded into bracket notation).\nA simple consumer composes these instead of re-deriving them; a rich\nwrapper (zap\'s builder) composes the constants directly. The boundary\nprinciple behind the stubs: anything the evaluated code needs from the\nworld should be a **declared, inert input** the trusted parent resolves\nand records — an injected live capability is an undeclared input no cache\nkey can capture.\n\n### Sidecar controller\n\nFor a long-running subprocess multiplexing many concurrent requests: a spawn\nconfig of function pointers (statically-known runtimes), JSON-lines framing\nover stdin/stdout, an mpsc command channel into a serializer task that owns\nstdin, per-request `oneshot` responses parked in a map keyed by request id, and\nthe script embedded via `include_str!`. Skip it for one-shot invocations (plain\n`tokio::process::Command`) or pure in-process work. The pool + dispatch ship\nin `fuzd` (`fuz_sidecar` is a non-optional dep; the `sidecar.*` actions are\nlive); what\'s dormant is the runtime factories — `fuz_deno`/`fuz_python` sit\nbehind a default-off `sidecar` feature, so the default build runs an empty\npool. Also a live example of optional-dep-crate isolation\n(./rust-dependencies §Crate-vs-feature isolation).\n\n### Security\n\n- **Constant-time token comparison** via `subtle::ConstantTimeEq`.\n- **TOCTOU-safe file operations**: open with `O_NOFOLLOW`, check permissions\n  on the fd, not the path.\n- **Secure file permissions**: `0o600` files, `0o700` directories — and\n  deliberately _not_ for non-secret state (a daemon-info file readable by\n  tooling is `0o644` on purpose; state the choice).\n- **Supply-chain isolation** is a crate-graph property, not a code pattern —\n  see ./rust-dependencies §Crate-vs-feature isolation.\n\n### Transactional state files\n\nState that several invocations mutate (a lock ledger, an intent file) needs\nserialization and atomicity:\n\n- **Advisory file locking** (`nix::fcntl::Flock`) serializes concurrent\n  writers across processes — acquire before read-modify-write.\n- **Atomic temp + rename**: a reader never sees a half-written file; a crash\n  mid-write leaves the old version intact.\n\nThe ecosystem implementation is `fuz_sys::fs::write_atomic` (write\n`.<name>.tmp.<pid>` → `sync_all` → rename → **fsync the parent dir**); it\nreplaced ~five hand-rolled copies — use it, don\'t re-roll. **Calibrate the\ndurability by authority**: the parent-dir fsync is required for\n_authoritative, non-regenerable_ state (lock ledgers, credentials) and\ndeliberately waived for content-addressed bodies (a torn write is caught by\nre-hashing) and ephemeral regenerable run-state. State the choice when you\nskip it. zap — spine-free — hand-rolls both calibrations correctly: flock +\nfull fsync dance for its authoritative lock file, temp + rename only for its\nregenerable detection cache ("the cache holds no authority").\n\nFor the lock itself: `flock` locks the _inode_, so lock a stable sidecar path\nand **never unlink on release** (truncate-but-keep-dirent) — else two\nacquirers hold different inodes. (zap\'s lock currently locks the pre-rename\ninode with a `TODO` — known wart, not a competing convention.)\n\n### Content-addressed storage with size-based routing\n\nThe shape of a blob store keyed by content hash (ecosystem impl:\n`fuz_fact`, consumed by fuz_forge; serving is the separately-authz\'d\n`fuz_fact_serving`):\n\n- Blobs below an embed threshold (1 MiB) live inline in the database row —\n  one round trip, transactional with their metadata.\n- Larger blobs go to sharded disk paths (`<2-hex>/<62-hex>` of the hash) via\n  atomic temp + rename; the row stores a `file:<shard>/<rest>` pointer.\n- **Verify-on-read applies to the buffered `get`** (re-hash, mismatch →\n  treated as absent). The streaming serve path deliberately does _not_\n  re-hash — it trusts write-time `sync_all` on hash-named files.\n- Idempotent writes: content-addressed names + `INSERT … ON CONFLICT (hash)\nDO NOTHING` make a re-store a no-op.\n\n### Bounded reads / size guards\n\nNever read an untrusted-size input unbounded:\n\n- **Files**: preflight the reported size, then read with a `+1` cap so a file\n  that grew between `stat` and read is rejected rather than silently\n  truncated — `take(MAX + 1)`, `len > MAX` is an error.\n- **Streams** (HTTP bodies, subprocess output): enforce a byte counter\n  mid-stream and abort on overrun — `Content-Length` is a hint, not a bound.\n  Unlink partial output on overrun. fuz_forge\'s upload pipeline layers the\n  guards: Content-Length preflight + mid-stream counter + statvfs free-space\n  check (`507 storage_full`) + a concurrency semaphore + an orphan-temp\n  sweep.\n- **Centralize the ceilings**: one private constant behind named public\n  aliases (`fuz_sys::limits`: `ARTIFACT_CEILING_BYTES` feeding\n  `MAX_TRANSFER_SIZE`, `MAX_FILE_SIZE`, …) — call sites keep\n  intent-revealing names, the value has one home. Add new caps there, not\n  per-crate.\n\n### Type state (compile-time state machines)\n\nWhen a value progresses through states, encode the state in the type so\ncalling a method in the wrong phase is a compile error. A **correctness**\npattern, not a performance one.\n\nThe in-codebase shape is the **consuming transition**, not `PhantomData<S>`:\nzap\'s `SecretRegistry::freeze(mut self) -> Result<SecretMasker>` makes "mask\nbefore the registry is frozen" unrepresentable by moving the value into the\nnext type — and the transition is fallible, doubling as validation (it\nrejects a registered value that would corrupt cascading replacement). Reach\nfor `PhantomData<S>` only when one value must thread several states through a\ngeneric API. Skip type state when states are data-driven (runtime enum), only\none transition exists, or the API must stay ergonomic for casual callers.\n\n### Secret masking pipeline\n\nMasking happens at the **consumption** boundary, not emission: execution\nstays masking-unaware; the batch report is masked once at render, and the\nlive event stream is masked by a decorator wrapping the sink\n(`EventHandler::Masking`). The registry registers each secret\'s literal,\nURL-encoded, and JSON-escaped variants and replaces longest-first; `freeze`\nis the type-state gate above.\n\n### Logging\n\n**Servers**: `tracing`; subscriber setup is single-sourced in a shared helper\n(`fuz_sys::logging::init_non_blocking_stdout`, behind the `logging` feature)\n— consumers dep `tracing` only, not `tracing-subscriber`.\n\n**CLIs / daemons**: `eprintln!` — simple, no framework. Batched request\nlogging for performance; `--json` for machine-readable output.\n'},{slug:"rust-perf",title:"Rust Performance Patterns",content:"# Rust Performance Patterns\n\n**Applies to**: Rust workspaces across the ecosystem. Companion to\n./rust-patterns — that one covers shape, this one covers speed. Generic Rust\nperf hygiene (`with_capacity`, `swap_remove`, iterator fusion, bounds-check\nelision via iterators/`assert!`, `#[inline]` mechanics) is assumed known and not\nrestated; this is the stack-specific layer.\n\nWorth stating once: allocate on purpose, not by reflex — a deliberate allocation\n(terminating a pipeline, decoupling lifetimes, batching repeated work) is often\nthe right design, not a smell to optimize away.\n\n## Stack constraints\n\n- **`unsafe_code = \"forbid\"` at the workspace.** A crate can override to\n  `\"allow\"` case-by-case (FFI/binding crates already do — ./rust-patterns\n  §Lints); performance can justify the same, conservatively — see §Unsafe escape\n  hatch. Never per-function in an otherwise-safe crate.\n- **Stable Rust.** No `#![feature(...)]`, no nightly toolchains.\n- **tokio runtime.** Thread-per-core runtimes (`glommio`, `monoio`) are out of\n  scope — see §Out of scope.\n\n## Measure first\n\nAlways profile/bench with `--release` (debug runs with different hot paths).\ntsv keeps a `[profile.profiling]` (`inherits = \"release\"`, `debug = true`,\n`strip = false`) for symbolicated profiles. Curated tools:\n\n| Profiler            | Surface                                  | When                                             |\n| ------------------- | ---------------------------------------- | ------------------------------------------------ |\n| `samply`            | CPU sampling, flamegraphs                | default on Linux; \"where's wall-clock going?\"    |\n| `tokio-console`     | Live task states, busy/idle, polls       | async stalls, tasks that never yield, starvation |\n| `cargo-instruments` | macOS Instruments                        | allocations on Apple HW                          |\n| Cachegrind          | Instruction counts, I-cache, branch miss | verifying inline/cold heuristics                 |\n\nNo Rust bench framework is adopted — no workspace has `[[bench]]` targets.\nBenches are driven from the consumer language (tsv: JS/Deno harnesses in\n`benches/js`; blake3: Deno/Node), measuring the shipped boundary rather than\nan in-crate microcosm; tsv's in-Rust measurement surface is `tsv_debug`'s\naudit harness plus the `parse_internal_*` exports over\n`std::hint::black_box`. If an in-crate microbench ever earns its place,\nCriterion/Divan/Iai-Callgrind go through the dependency-approval gate first.\n\n## Arena allocation (`bumpalo`) — in use in tsv\n\ntsv's core allocation strategy: every parser is\n`parse<'arena>(source: &str, arena: &'arena Bump) -> Result<Ast<'arena>>` —\nthe **caller owns the `Bump`**, ASTs borrow it, and formatting takes a\nseparate doc arena. Conventions proven there:\n\n- **Per-thread parked arenas for binding hot loops** (`tsv_arena`):\n  `with_ast_arena` / `with_doc_arena` park one arena per thread in a\n  `Cell<Option<T>>` slot — each call **takes** the arena out, resets it at\n  the start, and parks it back after, so the high-water chunk is retained\n  and per-call malloc/free amortizes to zero. Re-entrant with\n  fresh-fallback: a nested call finds the slot empty and pays one fresh\n  allocation instead of panicking (a nested parse inside formatting still\n  prefers a local `Bump`). `with_doc_arena` parks a boxed doc arena and is\n  gated behind the `format` feature. Soundness contract: the callback must\n  fully consume arena-borrowed work into an owned return before the next\n  reset. Recovers cleanly after `catch_unwind` (the FFI path relies on\n  this). Under WASM the thread-local is effectively a module static.\n- **Trap**: `bumpalo` collections don't run `Drop` for contents — arenas hold\n  POD (`Copy`, `&'arena str`). For types with destructors use `typed-arena`\n  (not currently used anywhere). Never round-trip global-heap collections\n  (`String`/`Vec`) through `into_bump_slice` — leaks.\n- One arena per phase (AST vs doc IR), dropped/reset at phase end.\n\n`bumpalo` stays safe-API-only, so `unsafe_code = \"forbid\"` holds.\n\n## Async lock hygiene\n\n**Never hold a sync lock (`parking_lot`/`std`) across `.await`** — the guard\nblocks the executor thread; if the holder yields mid-section the runtime can\ndeadlock or starve. Drop the guard before the await, or use `tokio::sync::*`\nwhich suspends cleanly. Pick per critical section:\n\n- `parking_lot` — default for sync-only sections (no poisoning, smaller, faster).\n- `tokio::sync::{Mutex, RwLock}` — sections that themselves `.await`.\n- `std::sync::*` — only when you need poisoning semantics.\n\n**DashMap** for hot shared maps: `Arc<RwLock<HashMap>>` serializes all readers\nunder any contended write and bounces the lock's cache line across cores;\nDashMap shards internally. Reach for it when profiling shows contention on one\nmap — not the default. Note it's in no workspace today and not on the\n./rust-dependencies allowlist, so adopting it goes through the\ndependency-approval gate first.\n\n## Stack-specific perf notes\n\nBeyond generic hygiene:\n\n- **`get_unchecked` is off-limits in workspace-default crates.** If a bench\n  proves a bounds check is the bottleneck _and_ iterator/`assert!`-hoist\n  rewrites can't elide it, isolate the hot kernel in a crate that overrides\n  `unsafe_code = \"allow\"` (§Unsafe escape hatch).\n- **Cross-crate inlining is free here**: the release profile's `lto = true` +\n  `codegen-units = 1` (./rust-patterns §Release Profile) inlines across crates\n  without per-fn `#[inline]`. Reserve `#[cold]` + `#[inline(never)]` for rare\n  error/panic formatters to keep the hot I-cache dense.\n- **Newtype over a boxed payload — never `Box<Error>` at call sites**: tsv's\n  `ParseError` is `struct ParseError(Box<ParseErrorKind>)` — pointer-sized,\n  enum private, so no signature anywhere mentions a `Box`. The win is\n  `Result` sizing (`Result<T, E>` is sized by `max(T, E)`; the payload enum\n  is 96 B, so an inline error moves 96 bytes through memory on every hot\n  `Ok` path) plus code size (measured −7.0% native `.text`, −16.7% on the\n  parse WASM bundle). Do **not** re-box at a call site\n  (`Result<T, Box<ParseError>>`) — that's a double indirection, measured to\n  buy nothing over the newtype.\n- **Don't round-trip a closed set through serde on a hot path**: zzz's\n  `ProviderName::parse(&str)` matches literals directly instead of allocating\n  a `Value::String` per request, with `as_str`/`Display`/serde-rename\n  single-sourced from one match.\n- **Compact span/token types**: tsv's `Span { start: u32, end: u32 }` (`Copy`)\n  halves span memory vs `usize` pairs and caps files at 4 GiB — pair the cap\n  with an explicit `FileTooLarge` guard.\n- **False sharing**: pad per-thread/per-shard hot atomics to a cache line\n  (`#[repr(align(64))]`) when multiple cores write adjacent counters —\n  otherwise one write invalidates the line on every core (5–10× on what look\n  like independent increments).\n\n## Open questions / not-yet-used\n\nUnused in every workspace today; noted so the choice is in-context if the\nworkload arrives. All three need approval before adoption\n(./rust-dependencies).\n\n- **Zero-copy archives (`rkyv`)** — for bytes read repeatedly without mutation\n  (content-addressed bodies, snapshot manifests), not mutation-heavy or\n  read-once paths; wire surfaces stay on `serde_json`. Treat the archived\n  schema as a wire format (a field rename = re-archive every file), pair\n  untrusted reads with `bytecheck`, and don't derive both archived and `serde`\n  shapes on one type.\n- **Global allocator (jemalloc/mimalloc)** — for long-running daemons whose RSS\n  climbs under glibc fragmentation, not CLIs. Bench per service. Gotcha: a C\n  dep calling raw `malloc` bypasses the Rust allocator.\n- **SIMD on stable** — `target-feature` via `RUSTFLAGS` drives LLVM\n  auto-vectorization with no source changes; crate `simd` features gate\n  `std::arch` paths (./wasm-patterns). Don't ship AVX-512 to general\n  consumers — it crashes instantly on older CPUs. `std::simd` is nightly, out\n  of scope.\n\n## Unsafe escape hatch\n\nA crate may override `unsafe_code = \"allow\"` for performance, conservatively:\n\n- **Isolate** in a dedicated crate / tightly-scoped module, never per-function.\n- **Document** every `unsafe { ... }` with a `// SAFETY:` invariant comment.\n- **Bench-justify** — a regression test shows the unsafe path wins meaningfully,\n  not \"I think this is faster.\"\n- **Reversible** — keep a safe fallback in the same crate.\n\nCleared this bar elsewhere: `get_unchecked` in proven-safe inner loops,\n`std::arch` SIMD for a specific target. Has _not_: dodging `clone()`, \"the\ncompiler should be able to prove this,\" speed claims without measurements.\n\n## Out of scope\n\nHonest notes to prevent cargo-culting:\n\n- **Thread-per-core** (`glommio`/`monoio`): Linux/io_uring-bound, abandon tokio\n  — a major architectural break for one service, trade-offs rarely favor it.\n- **SoA layouts** (`soapy`/`soa_derive`): niche to bulk numeric pipelines; reach\n  for it only if profiling shows cache-line waste on a homogeneous workload.\n- **`multiversion`** runtime CPU-feature dispatch: single-target builds suffice.\n- **Left-right** (`evmap`): 2× memory, eventual consistency, writers blocked on\n  slow readers — niche to read:write ratios of orders of magnitude, after\n  `DashMap`/`RwLock` have been profiled as the bottleneck.\n- **Hand-rolled lock-free** (`crossbeam-epoch`): reach for `DashMap`,\n  `tokio::sync`, `crossbeam::queue` before writing your own stack/queue/skiplist.\n"},{slug:"rust-spine",title:"Rust Spine & Consumer Servers",content:"# Rust Spine & Consumer Servers\n\n**Applies to**: the fuz workspace's spine crates and the servers that consume\nthem — `zzz_server`, `fuz_forge_server`, and the test-only\n`testing_spine_stub`. The spine is the Rust twin of `fuz_app`'s TS backend\n(auth, db, http, realtime, actions); the twin relationship itself is\n./twin-impl. Consumers take the spine as **path deps to a sibling checkout\nof the fuz repo** — not git URLs, not vendoring.\n\nShared shape/idiom conventions live in ./rust-patterns; this covers the\nspine surface and the consumer contracts.\n\n## Spine layers\n\nThe crates a consumer server actually names, by layer (the fuz workspace's\nfull ~35-crate inventory is its own repo's concern):\n\n- **System leaves** — `fuz_sys` (OS/system: fs, file_lock, secure_file, pid,\n  env, limits, cli; `logging`/`signal`/`tls` features), `fuz_home` (the\n  `~/.fuz` layer), `fuz_crypto` (Ed25519 verify, `ContentHash`, canonical\n  JSON), `fuz_eval` (sandboxed one-shot Deno eval). HTTP/DB-free by enforced\n  rule, so anything can link them.\n- **HTTP spine** — `fuz_http` (JSON-RPC envelope, IP/origin, lifecycle),\n  `fuz_db` (pool + migrations), `fuz_auth` (keyring, sessions,\n  `PasswordHasher`, bootstrap, audit), `fuz_actions` (action dispatch +\n  `consumer_lifecycle`), `fuz_realtime` (WS/SSE connection registries),\n  `fuz_cell` / `fuz_cell_actions` (cell storage / verbs), `fuz_fact` /\n  `fuz_fact_serving` (content-addressed byte store / authz'd reads),\n  `fuz_storage` (File/Forge/Ssh backends).\n- **Tooling** — `fuz_audit` (dep-graph audit), `fuz_testing` (test-only\n  impls, e.g. `TestingArgon2idHasher` — never shippable).\n\nConsumers also directly name `fuz_db_admin`, `fuz_release`, and `fuz_sign`\n(the forge) and `fuz_pty` (zzz).\n\nThe `fuz_fact`/`fuz_cell` storage-vs-serving splits and the\n`fuz_sys`/`fuz_home` leaf split are enforced by layering rules\n(§xtask & check-release), not just convention.\n\n## Server lifecycle — `run_app`\n\nEach consumer server exposes `pub async fn run_app(options: RunAppOptions)`\n— one entry point that both the production `main.rs` and the sibling\n`testing_*_server` binary call, differing only in injected options. The test\nbinary (`testing_zzzd`, `testing_fuzfd`) wires\n`fuz_testing::TestingArgon2idHasher` (weak, fast params) and registers\n`_testing_*` actions; it is what the TS cross-backend suite launches, and the\n`testing_` name prefix + `check-release` keep it unshippable.\n\nShared swap points:\n\n- `password_hasher: Arc<dyn PasswordHasher>` — Argon2id vs the test hasher\n- `extra_action_specs_factory` — the test binary registers `_testing_*`\n  actions without `fuz_testing` entering the production dep graph\n- `pre_migration_hook` — test-only DB setup\n- `daemon_token_state` — production `None` in both consumers; the producer is\n  confined to `fuz_testing` by the dep graph\n\nThe `run_app` _body_ is consumer-specific (domain App, migration set,\naction-spec composition) and is not a shared helper. The boxed-closure\nshapes — `ExtraActionSpecsFactory<App>`, `PreMigrationHook<E>`, and the\n`ExtraActionSpecsRuntime` POD (`password_hasher` / `keyring` /\n`daemon_token_state` / `session_cookie_name`, all `fuz_auth` types) — live in\n`fuz_actions::consumer_lifecycle`, generic over `App` and `E` so\n`fuz_testing` never enters the spine. (They belong in `fuz_actions`, not\n`fuz_http::lifecycle`: `fuz_http` deps no spine crate, so it can't name\n`fuz_auth` types.) Each consumer instantiates with a one-line concrete alias\n— `pub type ExtraActionSpecsFactory =\nfuz_actions::ExtraActionSpecsFactory<handlers::App>;` — its own type\ndefinition, not a re-export shim.\n\n`RunAppOptions` shares a bind/drain vocabulary — `default_addr: SocketAddr`\n(strictly more expressive than a bare port; loopback-only consumers default\n`127.0.0.1:<port>` and override only the port) + `drain_timeout: Duration`,\npassed `fuz_http::DEFAULT_DRAIN_TIMEOUT` (10 s) rather than a per-crate\nconst, plus `rate_limiters: fuz_auth::RateLimiterMode` (below). Remaining\nfields are legitimately per-consumer (zzz adds `force_test_actions`; the forge\nhas none of its own) — don't force one struct across consumers. Bind env-var\n_names_ are also per-consumer (`PORT`/`HOST` for the forge, `ZZZ_PORT` for\nzzz).\n\n**Every spine rate limiter is built through `RateLimiterMode`** —\n`mode.limiter(fuz_auth::DEFAULT_LOGIN_IP_RATE_LIMIT)`, never\n`Some(Arc::new(RateLimiter::new(…)))` followed by a conditional null. The\nproduction `main.rs` passes `Enforced`; the `testing_*` binary passes\n`DisabledForTesting`, the twin of `fuz_app`'s testing wiring nulling the same\nset (a cross-process suite's failed-login cases would otherwise exhaust the\nmonotone per-IP budget and refuse every later login). Building through the\nmode is what keeps a newly wired surface from staying enforced while the rest\nof the process is disabled, and any process that nulls a limiter prints a\nstartup banner — the same fail-loud shape as\n`TestingArgon2idHasher`'s. Consumer-owned limiters that aren't spine surfaces\n(visiones's upload burst/daily caps) stay live in both modes.\n\nThe daemon-token keeper wiring (`BootstrapKeeperResolved` adapter + boot-time\n`query_keeper_account_id`) is spine-owned in `fuz_auth` — don't re-implement\nper consumer.\n\n## JSON-RPC envelope — `fuz_http` owns it\n\n`fuz_http` owns the error constructors (`invalid_params(detail, reason)`,\n`internal_error`, `internal_error_with_source`, `not_found`, `conflict`,\n`forbidden`, `validation_error`, `rate_limited`) and the typed-params helper\n`parse_params<T: DeserializeOwned>`. Consumers import these, never\nre-declare — the wire envelope is what the cross-backend parity tests assert\nbyte-for-byte, and a local copy drifts. Prefer typed `#[derive(Deserialize)]`\ninput structs + `parse_params` over per-field\n`params.get().and_then(Value::as_str)` chains (adoption is uneven — treat the\nchains as migration debt, not a competing style).\n\n`JsonrpcErrorCode` is a `#[repr(i32)]` enum with a hand-written `Serialize`\nemitting the bare `i32` the wire requires — not scattered `pub const … :\ni32`. Because `JsonrpcError.code` is the enum, `error_code_to_http_status` is\nan _exhaustive_ match: a new code is a compile error there, not a silent 500.\nThe TS twin is `fuz_app`'s `jsonrpc_errors`; consumers referencing a code use\nthe enum (`JsonrpcErrorCode::NotFound as i64`), never a magic number.\n\n## Env loading\n\n- **Injectable seam**: load through `from_vars(get: impl Fn(&str) ->\nOption<String>)` so tests inject a map instead of mutating process env —\n  `fuz_forge_server`'s env struct is the exemplar, including a test that\n  actively _rejects retired var names_. Route all env reads through the seam;\n  audit for stray `std::env::var` in router code (both consumers still have\n  a few — migration debt).\n- **Fail loud, not just fail closed**: security-consequential misconfig\n  refuses to boot, never warn-and-continue — an empty `FUZ_ALLOWED_ORIGINS`\n  (empty allowlist = allow-all; the shared check is\n  `fuz_http::require_non_empty_origins`), a _malformed_ trusted-proxy list\n  (unset defaults to loopback — that's fine), missing/weak cookie keys, and a\n  failed `ActionRegistry::compile()` (an empty-registry fallback would\n  silently answer `method_not_found` to everything).\n- **Booleans** go through `fuz_sys::env::parse_stringbool` (the\n  `z.stringbool()`-shaped closed set; unknown values error so a typo can't\n  silently flip a feature).\n- **Secret-shaped env names** carry the `SECRET_*` prefix — one contract\n  across TS (`fuz_app` `BaseServerEnv`) and Rust.\n\n## Consumer wiring idioms\n\n- **`OnceLock` breaks the App ↔ registry capture cycle**: action-spec\n  builders capture `Arc<App>` into handler closures, so the compiled registry\n  can't exist until the App does — it lives in `App.action_registry:\nOnceLock<Arc<ActionRegistry>>`, `set()` after construction.\n- **`ActionContext<'a>` is the borrowed per-request seam** — notably:\n  `notify: &dyn Fn(&str, &Value)`, `connection_id: Option<…>` (set on WS,\n  `None` on HTTP), `signal: &fuz_realtime::SignalToken` (an alias of\n  `CancellationToken`, threaded into providers), `request_id`; it also\n  carries `db`, `auth`, `audit`, `log`, `client_ip`, `credential_type`, and\n  `post_commit_effects`.\n- **Streaming needs an owned sender**: the borrowed `notify` can't be\n  captured into a `'static` closure, so zzz's provider streaming builds a\n  per-request `ProgressSender = Box<dyn Fn(Value) + Send + Sync>` — only when\n  the request carries a progress token _and_ arrived over WS — wrapping\n  chunks with `fuz_http::notification(…)` and routing through\n  `Arc<fuz_realtime::ConnectionRegistry>::send_to(conn_id, …)`. HTTP requests\n  get `None` → non-streaming.\n- **Migration namespaces compose**: substrate DDL lives in the owning spine\n  crate (`fuz_auth::AUTH_MIGRATIONS`, `fuz_cell::CELL_MIGRATIONS`,\n  `fuz_fact::FACT_MIGRATIONS`); the consumer composes them with its own\n  namespace via `fuz_db::run_migrations`, ordering for FKs (auth first). A\n  consumer's own namespace should be small — the forge's is a single\n  token-policy table.\n- **Loopback-gated internal routes**: `/internal/*` callbacks check the\n  `ConnectInfo<SocketAddr>` peer is loopback _and_ a per-resource secret —\n  X-Forwarded-For can't fake the peer address.\n- **Server boot errors carry the CLI exit-code policy**: a `StartupError`\n  with `exit_code()` mapping `Config → 2`, everything else `→ 1` — the\n  remediation-keyed dialect from ./rust-patterns §CLI Patterns applied to\n  a server binary.\n- **Subprocess harness**: `SpawnOptions` + `spawn_collect`/`spawn_streaming`\n  with an env-isolating spawn and a capped output drain lives in\n  `fuz_forge_server` (deliberately local until a second consumer needs it —\n  the promotion candidate is a spine-free leaf crate).\n\n## Daemon lifecycle — two layers\n\n1. **Server-side graceful shutdown is shared.** The signal →\n   `CancellationToken` half is `fuz_sys::signal::shutdown_token()` (behind\n   the `signal` feature); `fuz_http::lifecycle` re-exports it and adds\n   `serve_with_shutdown` for the axum consumers. `fuzd` (UDS, no axum) calls\n   `fuz_sys::signal` directly. This split is why `fuz_sys` (home-agnostic OS\n   leaf) and `fuz_home` (the `~/.fuz` layer) are separate crates: the HTTP\n   spine shares the primitive without inheriting fuz's home conventions.\n2. **Client-side CLI lifecycle splits by transport.**\n   - `fuzd`'s UDS lifecycle lives in `fuz_daemon`: v2 `daemon.json`\n     (`socket_path`, no port), `Hello`-based health over `fuz_client`,\n     `DaemonState { Running(info) | Stopped | Stale(info) }` with a single\n     `get_daemon_state()` resolver.\n   - zzz's HTTP lifecycle is deliberately **local to zzz's CLI**: a\n     port-based `DaemonInfo { version, pid, port, started, app_version }`\n     (schema shared with `fuz_app` TS) + a reqwest `/health` probe + a\n     `Wedged(info)` arm for \"pid alive, `/health` silent\". It reuses the\n     `fuz_sys` primitives (`fuz_sys::{is_pid_alive, send_signal,\nrfc3339_now}`, `fuz_sys::fs::write_atomic`) but **not** `fuz_home` —\n     the `fuz_home` daemon helpers model the UDS schema, which doesn't fit\n     HTTP/port. `daemon.json` here is world-readable `0o644` on purpose (no\n     secrets in it).\n   - Model liveness as the `DaemonState` enum + one resolver — not scattered\n     `pid_alive`/`healthy` boolean pairs handled differently per command.\n     Don't build a transport-generic lifecycle crate for a single HTTP\n     consumer; extract only when a second HTTP CLI daemon-manager appears.\n   - The HTTP lifecycle (and `reqwest` with it) must never enter the\n     `fuz`/`fuzd` dependency graph. This is a convention, not an enforced\n     `check-release` rule — `fuz` legitimately links `fuz_daemon`/`fuz_client`\n     for its own UDS lifecycle; the line is against the HTTP/port variant.\n\n## xtask & check-release\n\nEvery spine-consuming workspace's `xtask` wraps the shared dep-graph audit;\ndon't hand-roll it:\n\n- `fuz_audit::xtask_main()` — a complete single-subcommand xtask (the forge's\n  3-line `main`).\n- `fuz_audit::run_check_release_cli()` — for workspaces with their own\n  subcommand router (zzz, zap).\n- `run_check_release_cli_with_rules(&AuditRules)` — the rules-taking entry\n  point. `AuditRules` is one POD: `extra_forbidden: &[&str]` (the fuz\n  workspace adds `fuz_sign` so its `fuz` binary can never sign) +\n  `per_binary: &[PerBinaryForbid]` (`fuz`/`fuzd` must not link `fuzi_*`).\n  Only the fuz workspace passes rules; the no-arg consumers stay insulated.\n- Exit codes are three-way sysexits: clean → 0, policy violation → 65,\n  tooling failure → 69/70.\n\n`BUILTIN_CRATE_LAYERING` — per-crate _library_ layering applied\nunconditionally in every workspace (absent subjects are skipped; the OK\noutput lists subjects actually checked so a renamed crate is visible, not\nskipped green). Each rule says a library must not transitively\n(runtime-)depend on a forbidden set. The four today:\n\n| Subject    | Must not reach                                            | Invariant                                                |\n| ---------- | --------------------------------------------------------- | -------------------------------------------------------- |\n| `fuz_fact` | `axum`, `fuz_http`, `fuz_cell`, `fuz_auth`, `fuz_actions` | bytes escape only through the authz'd `fuz_fact_serving` |\n| `fuz_cell` | `fuz_actions`                                             | storage/authz half can't reach the verb layer            |\n| `fuz_sys`  | `axum`, `fuz_http`                                        | the OS leaf stays HTTP-free                              |\n| `fuz_home` | `axum`, `fuz_db`, `fuz_http`                              | the `~/.fuz` layer stays HTTP/DB-free                    |\n\nThe `fuz_cell` rule is deliberately narrower than `fuz_fact`'s — it\nlegitimately reaches `axum`/`fuz_http` transitively via `fuz_auth`, and the\nBFS runs over the runtime graph, so a rule must account for what a subject's\nlegitimate deps already pull. Grow the table one rule per real, load-bearing\ninvariant — no speculative rules.\n\nThe `[package.metadata.fuz_audit] dev_only = true` stanza on each xtask crate\nis the one piece of config that can't be workspace-inherited. Why the\nforbidden capabilities are separate crates rather than cargo features:\n./rust-dependencies §Crate-vs-feature isolation.\n"},{slug:"svelte-patterns",title:"Svelte 5 Patterns",content:"# Svelte 5 Patterns\n\nSvelte 5 runes and patterns used across the Fuz ecosystem — the stack's\ndeltas over Svelte's own docs, not a runes tutorial. Always runes mode; no\nlegacy syntax (`$:`, `export let`, `on:click`, slots, stores — replaced by\nclasses with `$state` fields — `use:` actions,\n`<svelte:component this={...}>` — components are dynamic by default — or\n`<svelte:self>` — import the component and reference it by name). Await\nexpressions in components (`experimental.async`, Svelte 5.36+) are not\nenabled in any stack repo — don't reach for them.\n\n## State Runes\n\n### `$state()` vs `$state.raw()`\n\nOnly make a variable reactive when something reads it reactively — an\n`$effect`, `$derived`, or template expression. Everything else is a normal\nvariable.\n\nReactive state is `$state()`, including objects and arrays mutated in place.\n`$state.raw()` is a performance opt-out: the deep proxy has overhead, so use\n`raw` for large objects/arrays that are only ever reassigned wholesale, never\nmutated — API responses are the classic case. Mutating a `raw` value silently\ndoes nothing (no proxy, no update), so `raw` also makes the\nreplace-don't-mutate contract explicit — but pick it by update pattern and\nsize, not taste. For primitives the two behave identically; use `$state()`.\n\n> Migration note: the stack's earlier house style was `raw`-by-default, so\n> existing fields across fuz_ui, fuz_app, and zzz are still `$state.raw()`.\n> Write new code with `$state()`; migrate opportunistically when touching old\n> fields (checking nothing depends on the raw non-reactivity).\n\n`structuredClone`, `JSON.stringify`, and `postMessage` all walk through\n`$state()` proxies cleanly — proxy traps return the target's own keys.\n`JSON.stringify` also calls `toJSON()` through the proxy.\n\n### The `$state()!` Non-null Assertion Pattern\n\nClass properties initialized by a constructor or `init()` use `$state()!`:\n\n```typescript\nexport class ThemeState {\n	theme: Theme = $state()!;\n	color_scheme: ColorScheme = $state()!;\n\n	constructor(options?: ThemeStateOptions) {\n		this.theme = options?.theme ?? default_themes[0]!;\n		this.color_scheme = options?.color_scheme ?? 'auto';\n	}\n}\n```\n\nUsed across fuz_ui state classes and zzz Cell subclasses (older code spells\nit `$state.raw()!` — see the migration note above).\n\n### `$state.snapshot()`\n\nDeep-cloned plain copy of a reactive value (zzz Cell's `encode_property`\nreturns `$state.snapshot(value)` for serialization). Use it when handing a\n`$state()` proxy structure to code that does reference-identity checks on\nmembers; for serialization it's usually unnecessary — `JSON.stringify` and\n`structuredClone` walk proxies on their own.\n\n**Observed quirk** (Svelte 5.56 + vite-plugin-svelte, unfiled):\n`const r = $state.snapshot(x)` is silently elided to `const r = x` downstream\nof `compileModule`; `return $state.snapshot(x)` and inline expression use\nwork correctly.\n\n## Derived Values\n\nUse `$derived` to compute from state — never `$effect` with assignment —\nwith `$derived.by(() => ...)` for multi-step logic. Deriveds are writable\n(assign to override; the expression re-evaluates on dependency change).\nDerived objects/arrays are not deeply reactive — in the rare case you need\nthat, create `$state` inside `$derived.by`.\n\n### `$derived` in Classes\n\nAlways mark `$derived` class properties `readonly` unless you explicitly need\nreassignment (which Svelte 5 does allow).\n\n**Immutable data-wrapper classes use getters + memoization, not `$derived`.**\nfuz_ui's `Library`/`Module`/`Declaration` were rewritten from\n`readonly x = $derived(…)` fields to plain getters with `#field ??=` caches:\n\n```typescript\n// From Library class (fuz_ui/library.svelte.ts)\nexport class Library {\n	readonly library_json: LibraryJson;\n	#repo_url: RepoUrl | undefined;\n	get repo_url(): RepoUrl {\n		return (this.#repo_url ??= repo_url_parse(this.pkg_json.repository)!);\n	}\n}\n```\n\nThe reason is SSR: Svelte's server runtime only memoizes a `$derived` created\nduring a render, so a `Library` constructed at module scope — the normal shape\nfor a docs site — rebuilds its whole `Module`/`Declaration` tree on every\nproperty read during prerender. Rule: for an immutable tree constructed at\nmodule scope, plain getters + private-field caches; reactivity moves to the\ninstance level (swap the `Library`, don't mutate one). `$derived` class fields\nare for instances whose dependencies actually change, as below.\n\n```typescript\n// From Thread class (zzz/thread.svelte.ts) - return `| undefined`, never throw\n// from a $derived that templates read (a throw render-crashes every consumer);\n// guard at the callsites instead.\nreadonly model: Model | undefined = $derived.by(() =>\n	this.app.models.find_by_name(this.model_name),\n);\n\n// From ContextmenuState - $derived for simple, $derived.by for multi-step\n// (this older class predates the readonly convention; new code should add it)\ncan_collapse = $derived(this.selections.length > 1);\n\ncan_expand = $derived.by(() => {\n	const selected = this.selections.at(-1);\n	return !!selected?.is_menu && selected.items.length > 0;\n});\n```\n\n**Field-initializer order gotcha (plain classes).** Class field initializers run\n_before_ the constructor body, so a `$derived` whose expression reads a field the\nconstructor assigns (common in plain `.svelte.ts` classes — `app`, `name`, …)\ntrips TS2729 _\"used before initialization\"_:\n\n```typescript\nexport class ProviderCapability {\n	readonly app: Frontend;\n	readonly name: ProviderName;\n	// Don't do this — `this.app`/`this.name` are read in a field initializer,\n	// which runs before the constructor body assigns them (TS2729).\n	readonly status = $derived(this.app.lookup_provider_status(this.name));\n	constructor(o: { app: Frontend; name: ProviderName }) {\n		this.app = o.app;\n		this.name = o.name;\n	}\n}\n```\n\nWrap the read in `$derived.by(() => …)`: TS's init-order check doesn't descend\ninto the closure, and the read is lazy at runtime regardless.\n\n```typescript\n// closure defers the read past construction\nreadonly status = $derived.by(() => this.app.lookup_provider_status(this.name));\n```\n\nCells don't hit this — `app` comes from the base `Cell` constructor (runs before\nsubclass fields), and schema fields use `$state()!` (counts as initialized in\ndeclaration order). It bites only plain classes that read constructor-assigned\nfields in a `$derived`.\n\n## Reactive Collections\n\n### `SvelteMap` and `SvelteSet`\n\nFrom `svelte/reactivity` — mutation-tracked Map/Set (standard `Map`/`Set`\nare not tracked). `$derived.by` over a `SvelteMap` recomputes on mutation —\nfuz_ui's `DocsLinks` (`links: SvelteMap`, `fragments_onscreen: SvelteSet`)\nis the exemplar.\n\nFor entity collections consumed by different lookups, maintain **multiple\n`SvelteMap` indexes** over the data — the worked implementation is zzz's\n`IndexedCollection` (`indexed_collection.svelte.ts`): `by_id: SvelteMap`\nplus `single_index(key)` / `multi_index(key)` secondary indexes, with\n`values` derived from `by_id`. Deriveds then do `.get()` lookups instead of\narray scans.\n\n## Schema-Driven Reactive Classes\n\nA serializable reactive class pairs three names — `Foo`, `FooJson` (the\nserialized shape), and `FooOptions` (usually `Partial<FooJson>`) — with\n`toJSON(): FooJson` closing the loop. fuz_ui's `ThemeState` (the `$state()!`\nexample above) is the simple exemplar; its `ThemeStateJson` is a plain\ninterface. zzz's Cell pattern upgrades the shape to a Zod schema and\nautomates JSON hydration in a `Cell` base class — same rune conventions\n(`$state()!` for schema fields, `readonly $derived` for computed values).\nSee ./zod-schemas for the full pattern.\n\n## Context Patterns\n\n### Creating Context\n\n`create_context<T>()` from `@fuzdev/fuz_ui/context_helpers.ts` — the stack's\nstandard; it predates Svelte's own `createContext` and serves the same\ntype-safety role over raw `setContext`/`getContext`, so don't \"upgrade\" it.\nTwo overloads:\nwithout a fallback, `get()` throws if unset and `get_maybe()` returns `undefined`;\nwith a fallback, `get()` uses it and the `set()` value is optional:\n\n```typescript\n// Without fallback -- get() throws if unset, get_maybe() returns undefined\nexport function create_context<T>(): {\n	get: (error_message?: string) => T;\n	get_maybe: () => T | undefined;\n	set: (value: T) => T;\n};\n\n// With fallback -- get() uses fallback if unset, set() value is optional\nexport function create_context<T>(fallback: () => T): {\n	get: () => T;\n	set: (value?: T) => T;\n};\n```\n\n### Using Context\n\n```typescript\n// Define in a shared module; a provider component calls .set(app) at init,\n// consumers call .get() at init\nexport const frontend_context = create_context<Frontend>();\nexport const section_depth_context = create_context(() => 0);\n```\n\n### Getter Function Context Pattern\n\nSome contexts wrap values in `() => T` so the context reference stays stable\nwhile the value can change:\n\n```typescript\n// Type is () => ThemeState, not ThemeState\nexport const theme_state_context = create_context<() => ThemeState>();\n\n// Setting with a getter that closes over reactive state\ntheme_state_context.set(() => theme_state);\n\n// Consuming: call .get() at init (it uses Svelte's getContext), then read\n// the getter lazily so the value stays reactive\nconst get_theme_state = theme_state_context.get();\nconst theme_state = $derived(get_theme_state());\n```\n\nThe getter must be read **lazily** — calling it once at init\n(`const theme_state = get_theme_state();` without `$derived`) captures a\nsnapshot and loses reactivity, defeating the pattern's purpose. Besides the\nscript-level `$derived` above, two other lazy forms appear in real consumers:\n\n```svelte\n<!-- template-inline (MdzNodeView.svelte) — the getter is called inside {@const} -->\n{@const link = mdz_classify_link(node.reference, node.link_type, get_mdz_base?.())}\n```\n\n```typescript\n// prop default, re-evaluated while the prop is undefined (ColorSchemeInput.svelte)\nconst { value = get_theme_state() } = $props();\n```\n\nUsed when the context value might be reassigned (e.g., `theme_state` is a\nprop). `library_context` is a getter context (`() => Library`) for the same\nreason. Components with an optional `library` prop resolve prop-or-ancestor\nvia `set_library_context_with_fallback(() => library_prop, 'ApiIndex')`\n(fuz_ui's `library.svelte.ts`) — it prefers the prop, falls back to the\nancestor context, and throws a component-named error when neither exists;\n`LibraryDetail` does a plain `library_context.set(() => library)`. Direct\nvalue contexts like `frontend_context` and `site_context` are for values\nstable for the context's lifetime.\n\nFor an inventory of contexts in fuz_ui and zzz, grep for `create_context<`.\n\n## Snippet Patterns\n\nSnippets declared at a component's top level (not inside elements or blocks)\ncan be referenced from `<script>`; one that doesn't touch component state can\nalso be referenced from `<script module>` and exported for use by other\ncomponents.\n\n### Children with Parameters\n\nChildren can be parameterized — `Dialog` passes a `DialogContext` object back to\nthe consumer (`DialogContext` from `@fuzdev/fuz_ui/dialog.ts` is\n`{close: (e?: Event) => void; register_surface: (el) => () => void}`):\n\n```svelte\n<!-- Dialog.svelte -->\n<script lang=\"ts\">\n	const {\n		children\n	}: {\n		children: Snippet<[dialog: DialogContext]>;\n	} = $props();\n<\/script>\n\n{@render children(context)}\n```\n\nConsumers reach `close` via `dialog.close`; `register_surface` marks\nclick-outside-safe regions. `ThemeRoot` uses the same parameterized-children\npattern with multiple values:\n`Snippet<[theme_state: ThemeState, style: string | null, theme_style_html: string | null]>`.\n\n### Snippets with Parameters\n\nA snippet prop can take parameters (`Snippet<[T]>`), and `generics` on the\n`<script>` tag can make them generic over component data. fuz_ui's only real\n`generics=` use is `Contextmenu.svelte`'s tag-name generic\n(`generics=\"T extends string = 'span'\"`) — the generic-list-renderer shape\n(`items: T[]` + `item: Snippet<[T]>`) has no ecosystem precedent yet.\n\n### Default Snippet Content and String/Snippet Unions\n\nFor optional snippets, fall back with `{#if snippet} {@render snippet()} {:else} ... {/if}`.\nFor props accepting a string or a snippet (e.g. `icon?: string | Snippet`),\nbranch on `typeof` at render. fuz_ui's `Card` and `Alert` use this; `Alert` further\nparameterizes with `Snippet<[icon: string]>` to pass the resolved icon back.\n\n## Each Blocks\n\nPrefer keyed each blocks — `{#each items as item (item.id)}` — so Svelte\ninserts/removes items surgically instead of rewriting existing items' DOM.\nThe key must uniquely identify the item; never use the index. Don't\ndestructure the item when something mutates it\n(`bind:value={item.count}` needs the object reference).\n\n## Effect Patterns\n\nEffects are an escape hatch — avoid when possible. Prefer:\n\n- `$derived` / `$derived.by()` for computing from state\n- `{@attach}` for syncing with external libraries or DOM\n- Event handlers for responding to user interaction, or function bindings\n  (`bind:value={get, set}`) to validate/transform a bound value\n- `$inspect` for logging values while debugging (dev-only, reruns on change)\n- `createSubscriber` from `svelte/reactivity` for observing something\n  external to Svelte\n- `untrack()` from `svelte` for reads that shouldn't create a dependency\n  (config reads, breaking bidirectional-sync loops)\n\nDon't wrap effect contents in `if (browser) {...}` — effects don't run on the\nserver. Avoid updating `$state` inside effects.\n\n### Debugging Reactivity\n\n`$inspect.trace(label)` as the first line of an `$effect` or `$derived.by`\n(or any function they call) traces its dependencies and reports which one\ntriggered a rerun — the first tool when something updates too often or not\nat all.\n\n### Effect Cleanup\n\nFor window/document listeners, prefer `<svelte:window onkeydown={...}>` and\n`<svelte:document>` over `$effect` + `addEventListener`. For element-scoped\nlisteners, prefer `{@attach}` (with `on()` from `svelte/events` inside).\n\n### `$effect.pre()`\n\nRuns before DOM updates. Used for dev-mode validation and scroll management:\n\n```typescript\n// Dev-mode validation (GithubLink.svelte)\nif (DEV) {\n	$effect.pre(() => {\n		if (!path && !href_prop) {\n			throw new Error('GithubLink requires either `path` or `href` prop');\n		}\n	});\n}\n```\n\n### `effect_with_count()`\n\nFrom `@fuzdev/fuz_ui/rune_helpers.svelte.ts` —\n`effect_with_count(fn: (count: number) => void, initial = 0)` passes a call\ncount to the effect, useful for skipping the initial run:\n\n```typescript\nimport { effect_with_count } from '@fuzdev/fuz_ui/rune_helpers.svelte.ts';\n\n// Skip the first run (count === 1), save on subsequent changes\neffect_with_count((count) => {\n	const v = theme_state.color_scheme;\n	if (count === 1) return; // skip initial\n	save_color_scheme(v);\n});\n```\n\n## Attachment Patterns\n\nSvelte 5 attachments (`{@attach}`) replace actions (`use:`). Attachments live\nin `*.svelte.ts` files and use `Attachment` from `svelte/attachments`.\n\n### Attachment API\n\nAn attachment is `(element) => cleanup | void`. fuz_ui uses a **factory\npattern** — export a function that accepts config and returns the `Attachment`:\n\n```typescript\nimport type { Attachment } from 'svelte/attachments';\n\nexport const my_attachment =\n	(options?: MyOptions): Attachment<HTMLElement | SVGElement> =>\n	(el) => {\n		// setup\n		return () => {\n			// cleanup (optional)\n		};\n	};\n```\n\nUsage: `{@attach my_attachment()}` or `{@attach my_attachment({...options})}`\n\n### fuz_ui Attachments\n\nThe three factory shapes, one per row of the table below:\n\n- **`autofocus(options?)`** — simple factory, fire-once. Solves the HTML\n  `autofocus` attribute not firing when an element mounts from a reactive\n  `{#if}` in an SPA. `<input {@attach autofocus()} />`\n- **`intersect(get_params)`** — takes a **lazy function**\n  (`() => IntersectParamsOrCallback | null | undefined`), not params directly.\n  It runs `$effect` internally so reactive callbacks update without recreating\n  the IntersectionObserver, which rebuilds only when the options themselves\n  change (deep equality). Accepts a bare callback or a full params object\n  (`onintersect`, `ondisconnect`, `count`, `options`).\n- **`contextmenu_attachment(params)`** — direct params, no lazy function.\n  Caches menu params on the element's dataset, returns cleanup that removes the\n  entry.\n\nReach for the lazy form whenever the attachment builds an expensive observer\nout of reactive values; direct params are for static config read back later.\n\n### Class Method Attachments (zzz)\n\nAn attachment can be a class property sharing reactive state with the instance.\n**Attachments run in an effect context**, so one that reads reactive state\nreruns when that state changes — which is the whole reason to reach for this\nshape:\n\n```typescript\n// scrollable.svelte.ts (simplified — see source for flex-direction handling)\nexport class Scrollable {\n	scroll_y: number = $state(0);\n	readonly scrolled: boolean = $derived(this.scroll_y > this.threshold);\n\n	container: Attachment = (element) => {\n		const onscroll = () => {\n			this.scroll_y = element.scrollTop;\n		};\n		const cleanup = on(element, 'scroll', onscroll);\n		onscroll(); // sync the initial value — the event won't fire on mount\n		return cleanup;\n	};\n\n	// reruns whenever `this.scrolled` flips\n	target: Attachment = (element) => {\n		element.classList.toggle(this.target_class, this.scrolled);\n		return () => element.classList.remove(this.target_class);\n	};\n}\n```\n\n```svelte\n<div {@attach scrollable.container} {@attach scrollable.target}>\n```\n\n### Choosing a Pattern\n\n| Pattern                       | When to use                               | Example       |\n| ----------------------------- | ----------------------------------------- | ------------- |\n| **Simple factory**            | Fire-once, no ongoing observation         | `autofocus`   |\n| **Lazy function** (`() => p`) | Reactive callbacks without observer churn | `intersect`   |\n| **Direct params**             | Static config cached for later retrieval  | `contextmenu` |\n| **Class method**              | Attachment shares state with a class      | `Scrollable`  |\n\n## Props Patterns\n\nTreat props as though they will change: a value computed from a prop uses\n`$derived`, not a one-time assignment at init.\n\n```typescript\nconst { type } = $props();\nlet color = $derived(type === 'danger' ? 'red' : 'green'); // updates with `type`\n// not: let color = type === 'danger' ? ... — frozen at first render\n```\n\n### Bindable Props\n\nUse `let` (not `const`) when destructuring `$bindable()` props:\n\n```typescript\nlet { value = $bindable(180) }: { value?: number } = $props();\n```\n\n### Rest Props with SvelteHTMLElements\n\nIntersect `SvelteHTMLElements` from `svelte/elements` with custom props:\n\n```svelte\n<script lang=\"ts\">\n	import type { Snippet } from 'svelte';\n	import type { SvelteHTMLElements } from 'svelte/elements';\n\n	const {\n		icon,\n		children,\n		...rest\n	}: SvelteHTMLElements['div'] & {\n		icon?: string | Snippet;\n		children: Snippet;\n	} = $props();\n<\/script>\n\n<div {...rest} class=\"card {rest.class}\">\n	{@render children()}\n</div>\n```\n\nUse `SvelteHTMLElements['div']` (not `HTMLAttributes<HTMLDivElement>`) for\nsingle-root components. When the root tag varies by props (`Card` renders\n`<a>` or `<div>`), don't intersect both element types onto one bag — type the\nshared rest props as the common denominator (`HTMLAttributes<HTMLElement>`)\nand take branch-specific attrs as separate props\n(`a_attrs?: SvelteHTMLElements['a']`). `Card`, `Alert`, and `Details` all use\nthis `*_attrs` shape.\n\n### `$props.id()`\n\nSSR-safe unique id per component instance — use it for `id`/`for` pairs and\nSVG `<defs>` references instead of hand-rolled counters or `crypto` ids.\nPrecedent: fuz_ui's `Sparkline` (gradient id) and `ProjectActivityChart`.\n\n## Event Handling\n\nStandard DOM event syntax; conditional handlers pass `undefined` to remove\n(`<svelte:window onkeydown={active ? on_window_keydown : undefined} />`).\n\n### Programmatic Event Listeners\n\n`on()` from `svelte/events` for programmatic listeners in attachments,\n`.svelte.ts` files, and plain `.ts` modules. It preserves correct ordering\nrelative to declarative handlers that use event delegation, and returns a\ncleanup function. Always prefer `on()` over `addEventListener`, even in\nnon-component code:\n\n```typescript\nimport { on } from 'svelte/events';\n\n// Inside an attachment or module\nconst cleanup = on(element, 'scroll', onscroll);\nreturn () => cleanup();\n\n// With options (e.g., passive: false for wheel events)\nconst cleanup = on(element, 'wheel', onwheel, { passive: false });\n```\n\n### `swallow` — Claiming Events\n\n`swallow()` from `@fuzdev/fuz_util/dom.ts` combines `preventDefault()` and\n`stopImmediatePropagation()` (or `stopPropagation()` with `immediate: false`).\n\n**Design principle: handling an event = claiming it.** Calling `preventDefault`\nalready says \"I own this event's default behavior\"; `swallow` extends that to\n\"and no one else should react to it either.\" Use it whenever you would call\n`preventDefault`. If a parent needs to observe events before children claim\nthem, use the `capture` phase explicitly — don't rely on implicit bubbling.\n\n```typescript\nimport { swallow } from '@fuzdev/fuz_util/dom.ts';\n\n// swallow(event, immediate?, preventDefault?)\nswallow(e); // preventDefault + stopImmediatePropagation (default)\nswallow(e, false); // preventDefault + stopPropagation (non-immediate)\nswallow(e, true, false); // stopImmediatePropagation only (no preventDefault)\n```\n\nFor handlers that only need `stopPropagation` without `preventDefault` (e.g.,\npreventing game input from seeing keystrokes in a chat input), use\n`e.stopPropagation()` directly.\n\n## Component Composition\n\n### Module Script Block\n\nUse `<script lang=\"ts\" module>` for component-level exports (contexts, types):\n\n```svelte\n<!-- TomeSection.svelte -->\n<script lang=\"ts\" module>\n	import { create_context } from './context_helpers.ts';\n\n	export type RegisterSectionHeader = (get_fragment: () => string) => string | undefined;\n	export const register_section_header_context = create_context<RegisterSectionHeader>();\n	export const section_depth_context = create_context(() => 0);\n	export const section_id_context = create_context<string | undefined>();\n<\/script>\n\n<script lang=\"ts\">\n	// instance script\n<\/script>\n```\n\n## Runes in .svelte.ts Files\n\n`.svelte.ts` files use runes (`$state`, `$derived`, `$effect`) outside\ncomponents. Prefer **classes** over module-level state — export a class,\ninstantiate once at the appropriate root, share it via context.\n\n### Avoid Module-Level Runes for Shared State\n\nDon't declare `$state` variables at module scope and expose them through\ngetter/setter objects. A module-level rune is a hidden global: it can't be\nreset per test, per realm, or per session; it ties state lifetime to the\nmodule rather than a component; a second instance is impossible if you later\nneed one; and during SSR it leaks between requests — one user's state can\nbleed into another's render.\n\nUse a class + context instead — the class owns its state, a root component\nsets it once (`world_ui_context.set(new WorldUiState())` in a layout), and\ndescendants `get()` it:\n\n```typescript\n// illustrative sketch\nimport { create_context } from '@fuzdev/fuz_ui/context_helpers.ts';\n\nexport const world_ui_context = create_context<WorldUiState>();\n\nexport class WorldUiState {\n	show_map: boolean = $state(false);\n	show_sidebar: boolean = $state(true);\n}\n```\n\nReal precedent: fuz_app's `SidebarState` (`ui/sidebar_state.svelte.ts`) —\nsame shape plus an options-injected `enabled` getter override, provisioned\nby `AppShell.svelte` via the getter context `sidebar_state_context`.\n\nThe same goes for factory functions that close over `$state` and return\ngetter/setter proxy objects (`create_foo()` returning\n`{get query() {...}, set query(v) {...}}`) — a common community pattern the\nstack doesn't use. A class expresses the same reactivity with a named type\nand no per-field accessor boilerplate; treat any existing factory of this\nshape as legacy and rewrite it as a class when touching it.\n\n### Reactive State Classes\n\nThe most common pattern for shared state:\n\n```typescript\n// dimensions.svelte.ts\nexport class Dimensions {\n	width: number = $state(0);\n	height: number = $state(0);\n}\n```\n\nFor derived-heavy state, pair writable `$state` fields with `readonly`\nderiveds — fuz_ui's `ApiSearchState` (`api_search.svelte.ts`) is the worked\nexample: a writable `query` plus `readonly` filtered/sorted `$derived.by`\nfields.\n\n### Plain Classes for Imperative Loops\n\nCanvas2D/WebGPU renderers, `requestAnimationFrame` loops, and long-lived\npointer listeners are the inverse case: use a **plain class with no runes**,\nmounted by a thin `.svelte` wrapper. Private fields (e.g. `#hovered_id`,\n`#cursor_x`) stay non-reactive on purpose — mutating them from an rAF tick\nmust not schedule reruns. The wrapper binds dimensions, forwards reactive\nsources via getter-backed options, and calls `destroy()` on unmount. Runes\nlive in the wrapper, never in the loop.\n\n## CSS in Components\n\n**Goal: minimal `<style>` blocks.** Components delegate styling to fuz_css\nutility classes and design tokens; many well-designed components have no\n`<style>` block at all. When one is needed, keep it focused on\ncomponent-specific layout logic (positioning, complex pseudo-states,\nresponsive breakpoints), with all values referencing design tokens. Full\nrationale, class naming, anti-patterns, and examples: ./css-patterns\n§Default styling is the baseline and §Component Styling In Practice.\n\nUse clsx-style arrays and objects in `class` attributes instead of the\n`class:` directive:\n\n```svelte\n<!-- Do this -->\n<div class={['card', active && 'active', size]}></div>\n\n<!-- Not this -->\n<div class=\"card\" class:active class:size></div>\n```\n\nTheming and child-styling mechanics (`style:` on elements, `--prop={v}` on\ncomponents, `:global` as last resort): ./css-patterns §Dynamic Theming.\n"},{slug:"task-patterns",title:"Task Patterns",content:`# Task Patterns

Gro's task system for project automation in \`@fuzdev/gro\`. Tasks are TypeScript
modules with a \`.task.ts\` suffix exporting a \`task\` object with a \`run\` function.

## Task Interface

\`\`\`typescript
interface Task<
	TArgs = Args,
	TArgsSchema extends z.ZodType<Args, Args> = z.ZodType<Args, Args>,
	TReturn = unknown
> {
	run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;
	summary?: string;
	Args?: TArgsSchema;
}
\`\`\`

- \`run\` — entry point, receives \`TaskContext\`
- \`summary\` — shown in \`gro\` task listing and \`--help\`
- \`Args\` — optional Zod schema for CLI arg parsing and validation (see ./zod-schemas)

\`TArgsSchema\` and \`TReturn\` are rarely customized — tasks are either
\`Task\` (default args) or \`Task<Args>\` (custom Zod-inferred \`Args\` type).

### Basic task example

\`\`\`typescript
// src/lib/greet.task.ts
import type { Task } from '@fuzdev/gro';

export const task: Task = {
	summary: 'greet the user',
	run: async ({ log }) => {
		log.info('hello!');
	}
};
\`\`\`

Run with \`gro greet\` or \`gro src/lib/greet\`.

### Task with args

Both the Zod schema (value) and inferred type share the name \`Args\`:

\`\`\`typescript
// src/lib/greet.task.ts
import type { Task } from '@fuzdev/gro';
import { z } from 'zod';

export const Args = z.strictObject({
	name: z.string().meta({ description: 'who to greet' }).default('world')
});
export type Args = z.infer<typeof Args>;

export const task: Task<Args> = {
	summary: 'greet someone by name',
	Args,
	run: async ({ args, log }) => {
		log.info(\`hello, \${args.name}!\`);
	}
};
\`\`\`

Run with \`gro greet --name Claude\`. \`gro greet --help\` shows help auto-generated
from the Zod schema.

## TaskContext

\`\`\`typescript
interface TaskContext<TArgs = object> {
	args: TArgs;
	config: GroConfig;
	svelte_config: Promise<ParsedSvelteConfig>;
	filer: Filer;
	log: Logger;
	timings: Timings;
	invoke_task: InvokeTask;
}
\`\`\`

\`svelte_config\` is lazy — a promise resolved on first access, so tasks that
never touch it don't pay to read the SvelteKit config. \`filer\` tracks the
filesystem (watches in dev mode); \`log\` and \`timings\` are scoped to the task.

### invoke_task

\`\`\`typescript
type InvokeTask = (task_name: string, args?: Args, config?: GroConfig) => Promise<void>;
\`\`\`

Omitting \`config\` passes the current config. Respects the override system:
\`invoke_task('test')\` runs the user's override if one exists.

\`\`\`typescript
export const task: Task = {
	run: async ({ invoke_task }) => {
		await invoke_task('typecheck');
		await invoke_task('test');
		await invoke_task('gen', { check: true });
		await invoke_task('format', { check: true });
		await invoke_task('lint');
	}
};
\`\`\`

This is the core pattern used by \`check.task.ts\` (which adds conditional
execution via \`--no-*\` flags).

## Args Pattern

### Conventions

- Export both Zod schema and inferred type as \`Args\` at module level
- Use \`z.strictObject()\` (not \`z.object()\`)
- \`.meta({description: '...'})\` for CLI help text
- \`.default(...)\` for defaults — required fields without defaults must be passed via CLI
- \`/** @nodocs */\` to exclude from docs generation

### Positional arguments

\`_\` key for positional arguments (array of strings):

\`\`\`typescript
export const Args = z.strictObject({
	_: z.array(z.string()).meta({ description: 'file patterns to filter' }).default(['.test.']),
	dir: z.string().meta({ description: 'working directory' }).default('src/')
});
export type Args = z.infer<typeof Args>;
\`\`\`

Run with: \`gro test foo bar --dir src/lib/\` (positional \`foo\`, \`bar\` go to \`_\`).

### Boolean dual flags

\`--no-*\` dual flags for opt-out behavior:

\`\`\`typescript
export const Args = z.strictObject({
	typecheck: z.boolean().meta({ description: 'dual of no-typecheck' }).default(true),
	'no-typecheck': z.boolean().meta({ description: 'opt out of typechecking' }).default(false),
	test: z.boolean().meta({ description: 'dual of no-test' }).default(true),
	'no-test': z.boolean().meta({ description: 'opt out of running tests' }).default(false)
});
\`\`\`

\`gro check --no-test\` disables testing. \`--help\` hides the positive flags
when a \`no-*\` dual exists, showing only the \`no-*\` entry.

## Error Handling

### TaskError

Known failure with clean message (no stack trace). Use when the message is
sufficient for the user to fix the problem:

\`\`\`typescript
import { TaskError } from '@fuzdev/gro';

throw new TaskError('Missing required config file: gro.config.ts');
\`\`\`

### SilentError

Exit with non-zero code when the error is already logged. Primarily
internal to \`invoke_task.ts\`:

\`\`\`typescript
import { SilentError } from '@fuzdev/gro/task.ts';

log.error('Detailed error information...');
throw new SilentError();
\`\`\`

### When to use which

| Error type    | Stack trace | Gro logs message | Use when                          |
| ------------- | ----------- | ---------------- | --------------------------------- |
| Regular Error | Yes         | Yes              | Unexpected failures               |
| \`TaskError\`   | No          | Yes              | Known failures with clear message |
| \`SilentError\` | No          | No               | Already logged the error yourself |

## Task Discovery

Source task files use the \`.task.ts\` suffix; the \`.task.js\` form is only gro's
compiled builtins under \`gro/dist/\`, which the task loader also discovers. Gro
searches \`task_root_dirs\` in order (default: \`src/lib/\`, \`./\`, \`gro/dist/\`):

\`\`\`
src/lib/greet.task.ts      -> gro greet
src/lib/deploy.task.ts     -> gro deploy
src/lib/db/migrate.task.ts -> gro db/migrate
\`\`\`

\`gro\` with no task name or \`gro some/dir\` lists all tasks without executing.

## Task Override Pattern

Local tasks override Gro builtins with the same name:

- \`src/lib/test.task.ts\` overrides Gro's builtin \`test\` task
- Run the builtin explicitly: \`gro gro/test\`

The common pattern wraps the builtin:

\`\`\`typescript
import type { Task } from '@fuzdev/gro';

export const task: Task = {
	summary: 'run tests with custom setup',
	run: async ({ invoke_task, args }) => {
		// custom setup
		await invoke_task('gro/test', args); // call the builtin
		// custom teardown
	}
};
\`\`\`

## Task Composition

**\`invoke_task\` (recommended):** Respects overrides, provides logging context,
auto-forwards CLI args from \`--\` sections:

\`\`\`typescript
await invoke_task('build', { sync: false, gen: false });
\`\`\`

**Direct import:** Bypasses override resolution, tighter coupling:

\`\`\`typescript
import { task as test_task } from './test.task.ts';
await test_task.run(ctx);
\`\`\`

### Args forwarding

CLI args forward to composed tasks via \`--\` separators:

\`\`\`bash
gro check -- gro test --coverage
\`\`\`

Forwards \`--coverage\` to \`test\` when \`check\` invokes it. Multiple \`--\`
sections can target different sub-tasks.

Import sources: \`Task\`, \`TaskContext\`, and \`TaskError\` from \`@fuzdev/gro\`;
\`SilentError\` and \`InvokeTask\` from \`@fuzdev/gro/task.ts\`.
`},{slug:"testing-patterns",title:"Testing Patterns",content:`# Testing Patterns

Testing conventions for the Fuz stack: vitest usage, fixtures, mocks, helpers.

## Contents

- [File Organization](#file-organization) (naming, subdirectories, assertions, async rejection, jsdom)
- [Database Testing](#database-testing) (PGlite, vitest projects, describe_db)
- [Test Helpers](#test-helpers)
- [Shared Test Factories](#shared-test-factories)
- [Fixture-Based Testing](#fixture-based-testing)
- [Mock Patterns](#mock-patterns)
- [Environment Flags](#environment-flags)
- [Test Structure](#test-structure) (organization, parameterized)
- [Serde Boundary Conformance](#serde-boundary-conformance) (Rust ↔ hand-written TS: round-trip + coverage guard)

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

Tests live in \`src/test/\` (not co-located), mirroring \`src/lib/\`
subdirectories (e.g., \`src/lib/auth/\` -> \`src/test/auth/\`).

### Test File Naming

Split large suites with dot-separated aspects:

| Pattern                            | Example                                       |
| ---------------------------------- | --------------------------------------------- |
| \`{module}.test.ts\`                 | \`mdz.test.ts\`, \`ts_helpers.test.ts\`           |
| \`{module}.{aspect}.test.ts\`        | \`csp.base.test.ts\`, \`csp.security.test.ts\`    |
| \`{module}.svelte.{aspect}.test.ts\` | \`contextmenu_state.svelte.activation.test.ts\` |
| \`{module}.fixtures.test.ts\`        | \`svelte_preprocess_mdz.fixtures.test.ts\`      |
| \`{module}.db.test.ts\`              | \`account_queries.db.test.ts\`                  |
| \`{module}.integration.db.test.ts\`  | \`invite_signup.integration.db.test.ts\`        |

Module name matches source file. \`.svelte.\` preserves the source extension.

### Assertions

Use \`assert\` from vitest. Choose methods for TypeScript type narrowing, not
semantic precision. \`assert.ok\` is the standard guard for narrowing
\`T | undefined\` to \`T\` — don't replace it with \`assert.isDefined\` (which
narrows to \`NonNullable<T>\`, also removing the need for \`!\`) or other methods
unless the replacement improves failure diagnostics without losing narrowing.

\`\`\`typescript
import { test, assert } from 'vitest';

assert.ok(value); // narrows away null/undefined — the standard guard
assert.strictEqual(a, b);
assert.deepStrictEqual(a, b);
\`\`\`

Strengthen assertions when the value is **known**: \`assert.strictEqual\` for
exact expected values, \`assert.include\`/\`assert.notInclude\` for array
membership (shows actual contents on failure). Leave \`assert.ok\` for guards
where the goal is narrowing, not value checking.

**Why \`assert\` over \`expect\`:** \`assert(x instanceof Error)\` narrows \`x\` for
TypeScript; \`expect(x).toBeInstanceOf(Error)\` doesn't, so member access after
it is a type error.

Name custom assertion helpers \`assert_*\`, not \`expect_*\` — e.g.
\`assert_css_contains()\`.

For throw assertions, use \`assert.throws()\` with an Error constructor, string,
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

### Test Placeholder Domains

When tests need stand-in domain names (allowlists, URL parsing, CSP sources,
etc.), use \`*.fuz.dev\` subdomains rather than \`example.com\`, RFC-2606 reserved
TLDs, or arbitrary strings. This keeps fixtures consistent across the ecosystem
and signals that the domain is owned/controllable.

\`\`\`typescript
// Anonymous placeholders — letters for "any domain"
const A = src('a.fuz.dev');
const B = src('b.fuz.dev');

// Scenario placeholders — pick a meaningful subdomain
const cdn = src('cdn.fuz.dev');
const api = src('https://api.fuz.dev/');
const untrusted = src('untrusted-cdn.fuz.dev');

// Generated placeholders
Array.from({ length: 100 }, (_, i) => src(\`source\${i}.fuz.dev\`));
\`\`\`

Real third-party domains (\`fonts.googleapis.com\`, \`js.stripe.com\`,
\`cdnjs.cloudflare.com\`) are fine when the test specifically documents
integration with that vendor.

### Async Rejection Testing

For async functions that should reject, use \`assert_rejects\` from
\`@fuzdev/fuz_util/testing.ts\`. It places \`assert.fail\` outside the catch
block so the test's own assertion errors aren't accidentally caught:

\`\`\`typescript
import { assert_rejects } from '@fuzdev/fuz_util/testing.ts';

// Simple — just check the error pattern
await assert_rejects(
	() => local_repo_load({ local_repo_path, git_ops, npm_ops }),
	/Failed to pull.*unstaged changes/
);

// Pattern is optional — returns the Error for further assertions
const err = await assert_rejects(() =>
	local_repos_load({ local_repo_paths: paths, git_ops, npm_ops })
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
import { vi } from 'vitest';

class ResizeObserverMock {
	observe = vi.fn();
	unobserve = vi.fn();
	disconnect = vi.fn();
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);
\`\`\`

## Database Testing

fuz_app owns the database testing infrastructure (\`testing/db.ts\`); fuz_app
and zzz both run the vitest projects split below (zzz's config is committed
with the same \`unit\`/\`db\` shape and cross-backend gating).

### The \`.db.test.ts\` Convention

Any test using a \`Db\` instance uses the \`.db.test.ts\` suffix, with \`.db\`
immediately before \`.test.ts\` — e.g., \`foo.integration.db.test.ts\`.

Vitest \`projects\` runs all DB tests in a single worker (\`isolate: false\` +
\`fileParallelism: false\`), sharing one PGlite WASM instance (~500-700ms
cold start saved per file). Non-DB tests stay fully parallel.

### Vitest Projects Configuration

The core pattern, adapted from fuz_app's \`vite.config.ts\` (simplified — the
real file adds more plugins and the cross-backend projects below):

\`\`\`typescript
import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

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
					exclude: ['src/test/**/*.db.test.ts', 'src/test/**/*.cross.test.ts'],
					maxWorkers: max_threads,
					sequence: { groupOrder: 1 }
				}
			},
			{
				extends: true,
				test: {
					name: 'db',
					include: ['src/test/**/*.db.test.ts'],
					isolate: false,
					fileParallelism: false,
					sequence: { groupOrder: 2 }
				}
			}
		]
	}
});
\`\`\`

fuz_app additionally gates a \`cross_backend_*\` project family behind
\`FUZ_TEST_CROSS_BACKEND=1\` — per-runtime projects (\`rust_spine_stub\`,
\`ts_node\`, \`ts_deno\`, \`ts_bun\`) running \`src/test/cross_backend/*.cross.test.ts\`,
plus dedicated \`parity\` and \`security\` projects with their own global setups.

Because \`isolate: false\` shares module state, avoid \`vi.mock()\` in
\`.db.test.ts\` files. If needed, pair with \`vi.restoreAllMocks()\` (not
\`vi.clearAllMocks()\`) in \`afterEach\`.

### describe_db Pattern

fuz_app's \`testing/db.ts\` provides
\`create_describe_db(factories, truncate_tables)\`. Consumer projects create a
\`db_fixture.ts\`:

\`\`\`typescript
// src/test/db_fixture.ts (adapted from fuz_app's, which also wires
// pglet + pglet-wasm factories from local test modules)
import type { Db } from '#lib/db/db.ts';
import { run_migrations } from '#lib/db/migrate.ts';
import { auth_migration_ns } from '#lib/auth/migrations.ts';
import {
	create_pglite_factory,
	create_pg_factory,
	create_describe_db,
	auth_integration_truncate_tables,
	log_db_factory_status
} from '#lib/testing/db.ts';

const init_schema = async (db: Db): Promise<void> => {
	await run_migrations(db, [auth_migration_ns]);
};

export const pglite_factory = create_pglite_factory(init_schema);
export const pg_factory = create_pg_factory(init_schema, process.env.TEST_DATABASE_URL);
export const db_factories = [pglite_factory, pg_factory];

log_db_factory_status(db_factories);

export const describe_db = create_describe_db(db_factories, auth_integration_truncate_tables);
\`\`\`

Test files import and use as a wrapper:

\`\`\`typescript
// src/test/auth/account_queries.db.test.ts
import { describe, assert, test } from 'vitest';
import { query_create_account } from '#lib/auth/account_queries.ts';
import { describe_db } from '../db_fixture.ts';

describe_db('account queries', (get_db) => {
	test('create returns an account with generated uuid', async () => {
		const db = get_db();
		const deps = { db };
		const account = await query_create_account(deps, {
			username: 'alice',
			password_hash: 'hash123'
		});
		assert.ok(account.id);
		assert.strictEqual(account.username, 'alice');
	});
});
\`\`\`

### Integration Tests

Named \`.integration.db.test.ts\`. Use \`create_test_app()\` from
\`#lib/testing/app_server.ts\` for a full Hono app with middleware, routes, and
database:

\`\`\`typescript
const { app, create_session_headers, create_bearer_headers, create_account, cleanup } =
	await create_test_app({
		session_options: create_session_config('test_session'),
		create_route_specs: (ctx) => my_routes(ctx)
	});
\`\`\`

### PGlite WASM Caching

\`create_pglite_factory\` instances in the same worker share a single PGlite
WASM instance via module-level cache. Subsequent calls reset the schema
(\`DROP SCHEMA public CASCADE\`) instead of paying the cold-start cost.

## Test Helpers

### Shared Helpers (\`@fuzdev/fuz_util/testing.ts\`)

Cross-repo test assertions live in \`@fuzdev/fuz_util/testing.ts\`. Depends
only on vitest — safe for fuz_util's zero-runtime-deps constraint.

\`\`\`typescript
import { assert_rejects, create_mock_logger } from '@fuzdev/fuz_util/testing.ts';

// Async rejection — pattern is optional, returns Error
const err = await assert_rejects(() => do_thing(), /expected pattern/);

// Mock logger — vi.fn() methods + tracking arrays
const log = create_mock_logger();
do_thing(log);
assert.deepEqual(log.info_calls, ['expected message']);
\`\`\`

For \`Result\` assertions, \`assert.ok(result.ok)\` narrows the union directly.
The general discriminated-union form is \`assert_property(obj, key, value)\`
(also in \`@fuzdev/fuz_util/testing.ts\`) — \`assert_property(r, 'ok', true)\`,
or any discriminator (\`kind\`, \`type\`). Its \`const V\` type param is
load-bearing: without it \`Extract\` collapses to the full union and the
narrowing silently vanishes — keep the signature intact if you copy it.

### Repo-Local Helpers

Most repos also have a \`test_helpers.ts\` for domain-specific factories
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

mdz's \`test_helpers.ts\` also provides generic fixture infrastructure
(\`load_fixtures_generic\`, \`run_update_task\`) used by its fixture categories
(see Fixture-Based Testing below).

### Domain-Specific Helpers

Helpers for one domain go in \`{domain}_test_helpers.ts\` beside the tests
(\`csp_test_helpers.ts\`, \`build_cache_test_helpers.ts\`, …). Helpers for one
fixture category go **inside** that fixture directory
(\`fixtures/mdz/mdz_test_helpers.ts\`), not at \`src/test/\` root.

(svelte-docinfo keeps its \`ts\`/\`tsdoc\`/\`svelte\` fixture helpers in its own
\`src/test/test-helpers.ts\` — a pre-existing-style repo with camelCase
identifiers, not the canonical shape.)

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
\`\`\`

## Shared Test Factories

When multiple components share behavior (e.g., \`ContextmenuRoot\` and
\`ContextmenuRootForSafariCompatibility\`), extract test logic into factory
modules exporting \`create_shared_*_tests()\`; test files become thin wrappers:

\`\`\`typescript
// src/test/contextmenu_test_core.ts — factory module (NOT a test file)
export const create_shared_core_tests = (
	Component: any,
	component_name: string,
	options: SharedTestOptions = {}
): void => {
	describe(\`\${component_name} - Core Functionality\`, () => {
		// shared tests here
	});
};
\`\`\`

\`\`\`typescript
// src/test/ContextmenuRoot.core.test.ts — thin wrapper
// @vitest-environment jsdom
import { vi } from 'vitest';
import { create_shared_core_tests } from './contextmenu_test_core.ts';
import ContextmenuRoot from '#lib/ContextmenuRoot.svelte';

vi.stubGlobal('ResizeObserver', ResizeObserverMock);
create_shared_core_tests(ContextmenuRoot, 'ContextmenuRoot');
\`\`\`

\`\`\`typescript
// src/test/ContextmenuRootForSafariCompatibility.core.test.ts — same tests, different component
create_shared_core_tests(
	ContextmenuRootForSafariCompatibility,
	'ContextmenuRootForSafariCompatibility',
	{ requires_longpress: true }
);
\`\`\`

\`fuz_ui\` uses this for contextmenu components with 8 factory modules
(\`contextmenu_test_{core,rendering,keyboard,nested,positioning,scoped,edge_cases,link_entries}.ts\`).

## Fixture-Based Testing

For parsers, analyzers, and transformers. Used in mdz (\`mdz\`,
\`svelte_preprocess_mdz\` features) and svelte-docinfo (\`ts\`, \`tsdoc\`, \`svelte\`
features), and other static-analysis tooling.

### Directory Structure

Each fixture is a subdirectory with an input and a generated \`expected.json\`
(mdz's layout — svelte-docinfo nests further by sub-kind, e.g.
\`ts/declarations/class/\`):

\`\`\`
src/test/fixtures/
├── mdz/
│   ├── bold_simple/
│   │   ├── input.mdz           # test input
│   │   └── expected.json       # generated expected output
│   ├── heading/
│   │   ├── input.mdz
│   │   └── expected.json
│   ├── mdz_test_helpers.ts     # fixture-specific helpers
│   └── update.task.ts          # regeneration for this feature
└── svelte_preprocess_mdz/
    ├── bold_double_quoted/
    │   ├── input.svelte
    │   └── expected.json
    ├── svelte_preprocess_mdz_test_helpers.ts
    └── update.task.ts
\`\`\`

### Update Tasks

Each feature's \`update.task.ts\` uses \`run_update_task\` from the repo's
\`test_helpers.ts\` — it diffs against the existing \`expected.json\` and only
writes on change:

\`\`\`typescript
// src/test/fixtures/mdz/update.task.ts — from mdz
import type { Task } from '@fuzdev/gro';
import { join } from 'node:path';
import { mdz_parse } from '$lib/mdz.ts';
import { run_update_task } from '../../test_helpers.ts';

export const task: Task = {
	summary: 'generate expected.json files for mdz fixtures',
	run: async ({ log }) => {
		await run_update_task(
			{
				fixtures_dir: join(import.meta.dirname),
				input_extension: '.mdz',
				process: (input) => mdz_parse(input)
			},
			log
		);
	}
};
\`\`\`

Run one feature: \`gro src/test/fixtures/mdz/update\`. A repo with several
features can add a parent task that fans out — svelte-docinfo's
\`src/test/fixtures/update.task.ts\` calls \`invoke_task\` on its \`tsdoc\`, \`ts\`,
and \`svelte\` children (its \`svelte\` child is bespoke: it builds one shared TS
program across all fixtures before analyzing each, since Svelte type analysis
needs a shared checker).

### Fixture Test Pattern

\`\`\`typescript
// src/test/svelte_preprocess_mdz.fixtures.test.ts — from mdz
import { test, assert, describe, beforeAll } from 'vitest';
import {
	load_fixtures,
	run_preprocess,
	DEFAULT_TEST_OPTIONS,
	type PreprocessMdzFixture
} from './fixtures/svelte_preprocess_mdz/svelte_preprocess_mdz_test_helpers.ts';

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
				\`\${fixture.name}.svelte\`
			);
			assert.equal(result, fixture.expected.code, \`Fixture "\${fixture.name}" failed\`);
		}
	});
});
\`\`\`

**CRITICAL:** Never manually create or edit \`expected.json\`. Only create input
files and run the update task.

### Fixture Testing in fuz_gitops

Different fixture pattern: git repositories generated from fixture data files
defining repos with dependencies, changesets, and expected outcomes.

- \`src/test/fixtures/repo_fixtures/*.ts\` — source of truth for test repo definitions
- \`src/test/fixtures/generate_repos.ts\` — idempotent repo generation logic
- \`src/test/fixtures/configs/*.config.ts\` — isolated gitops config per fixture
- \`src/test/fixtures/check.test.ts\` — validates command output against expectations
- \`src/test/fixtures/mock_operations.ts\` — configurable DI mocks (not vi.fn())

10 scenarios cover publishing, cascades, cycles, private packages, major
bumps, peer deps, and isolation. Repos are auto-generated on first test run;
regenerate with \`gro src/test/fixtures/generate_repos\`.

## Mock Patterns

### Dependency Injection (Preferred)

Functions accept a deps parameter; tests inject plain-object implementations —
no mocking library. The interfaces, factory naming, stub tiers, and the
tracking/in-memory/throwing mock shapes all live in ./dependency-injection;
this section covers only what's specific to writing the tests.

fuz_gitops injects mock operations via DI nearly everywhere — its one
\`vi.mock()\` exception is \`npm_registry.test.ts\`, which module-mocks fuz_util's
\`spawn_out\`/\`wait\` because that module shells out to npm with no DI seam.

### vi.mock() Usage

Legacy escape hatch, not a pattern — it exists where code predates the DI
convention (gro's build/deploy/cache tests are the big cluster) or where a
call site has no injectable seam. fuz_app module-mocks its auth \`query_*\`
cluster from several middleware tests (bearer auth, daemon token, rate
limiter, audit log, request context); the bearer-auth subset is factored into
\`testing/middleware.ts\` as table-driven \`describe_bearer_auth_cases\` /
\`create_bearer_auth_test_app\` helpers — a documented carve-out. Treat any
_new_ \`vi.mock\` as a signal to add a deps seam
instead. Avoid entirely in \`.db.test.ts\` where \`isolate: false\` shares
module state. When unavoidable:

- gro: \`vi.clearAllMocks()\` in \`beforeEach\`, \`vi.resetAllMocks()\` in \`afterEach\`
- \`.db.test.ts\`: use \`vi.restoreAllMocks()\` in \`afterEach\` —
  module-level mocks leak with \`isolate: false\`

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

| Flag                              | Repo    | Purpose                                           |
| --------------------------------- | ------- | ------------------------------------------------- |
| \`SKIP_EXAMPLE_TESTS\`              | fuz_css | Skip slow Vite plugin integration tests           |
| \`TEST_DATABASE_URL\`               | fuz_app      | Enable PostgreSQL tests (PGlite always runs) |
| \`FUZ_TEST_CROSS_BACKEND\`          | fuz_app, zzz | Enable the \`cross_backend_*\` vitest projects |
| \`FUZ_TESTING_RUST_SPINE_STUB_BIN\` | fuz_app | Path to the Rust spine stub binary for cross runs |

## Test Structure

### Test Organization

Organize tests with \`describe\` blocks. One level is common; two levels
(feature → scenario) is typical for larger modules. Use \`test()\`, not \`it()\`.

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

Use labeled tuple types for self-documenting test tables:

\`\`\`typescript
const duration_cases: Array<[label: string, input: number, expected: string]> = [
	['zero', 0, '0s'],
	['seconds', 1000, '1s'],
	['minutes', 60000, '1m'],
	['hours', 3600000, '1h'],
	['mixed', 3661000, '1h 1m 1s']
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
	['creates if missing', null, 'KEY', 'KEY="new"']
];

test.each(cases)('%s', async (_label, initial, key, expected) => {
	const fs = create_mock_fs(initial !== null ? { '.env': initial } : {});
	await update(key, 'new', fs);
	assert.strictEqual(fs.get_file('.env'), expected);
});
\`\`\`

Tests with dynamic expected values or extra assertions should stay standalone.

### Composable Test Suites (fuz_app)

fuz_app ships \`describe_*\` suite factories in \`src/lib/testing/\` (library
exports, not test files) that a consumer calls to inherit whole categories of
coverage — attack surface, integration, admin, audit completeness, rate
limiting, round-trip validation, data exposure — plus a \`describe_standard_tests\`
bundle. They take configuration (\`session_options\`, \`create_route_specs\`,
\`rpc_endpoints\`, \`bootstrap\`) and silently skip groups whose config is absent.
The suite roster and each one's options are fuz_app inventory — see its
\`src/lib/testing/CLAUDE.md\`.

### WebSocket Round-Trip Tests

WebSocket JSON-RPC endpoints are tested **in-process** — no HTTP server, no
Deno. The harness drives the real dispatcher and backend transport against
client connections, so per-action auth, input validation, \`ctx.notify\`, and
broadcast fan-out all run through real code paths. Test files follow the usual
\`{module}.{aspect}.test.ts\` naming.

The one convention that isn't API detail: **DB-backed WS tests** use the
\`.db.test.ts\` suffix and ride the same shared-PGlite factory as other DB
tests. Non-DB WS tests build a fresh harness per test — setup is cheap and
each test can supply its own ad-hoc action specs.

## Serde Boundary Conformance

Rust ↔ hand-written TS serde boundaries are guarded with a round-trip +
coverage-guard pattern rather than codegen — the full treatment lives in
./twin-impl §Serde boundary conformance.
`},{slug:"tsdoc-comments",title:"TSDoc Comment Style Guide",content:`# TSDoc Comment Style Guide

JSDoc/TSDoc conventions for \`@fuzdev\` packages.

## Overview

Doc comments flow through a three-stage pipeline:

1. **\`svelte-docinfo\` analysis** — extracts JSDoc/TSDoc from the TypeScript AST
   into per-declaration metadata
2. **\`svelte-docinfo\` Vite plugin** — exposes module/declaration metadata
   through the \`virtual:svelte-docinfo\` module at build/dev time
3. **\`mdz\`** renders docs with auto-linking — backticked identifiers become
   clickable API-doc links

**Write standard JSDoc with the tags below, wrap identifier references in
backticks, and the system handles the rest.**

## Writing Good Documentation

### Prioritize "why" over "what"

Don't restate the function name. Explain why this exists, what problem it
solves, and its role in the system — what depends on it, what it enables.

\`\`\`typescript
// Weak — restates the function name and types
/** Creates a new session. */
export const create_session = (deps: QueryDeps, account_id: AccountId): Session => {
	/* ... */
};

// Strong — explains purpose and rationale
/**
 * Predicts the next version by analyzing all changesets in a repo.
 *
 * Critical for dry-run mode accuracy — allows simulating publishes without
 * actually running \`gro publish\` which consumes changesets.
 *
 * @returns predicted version and bump type, or null if no changesets
 */
\`\`\`

### Conciseness — anti-patterns

A wrong or filler comment costs more than it adds. Four patterns recur
in real audits.

**1. Helper-contract \`@throws\` at every callsite.** When a function
delegates a failure to an internal helper or external engine, document
the contract on the helper — not on every caller.

\`\`\`typescript
// Weak — same internal invariant repeated on every create_* query
/** @throws Error if the INSERT does not return a row (failed \`assert_row\` invariant) */

// Weak — generic driver error true of every SQL call
/** @throws Error propagated from the underlying driver on syntax errors, constraint violations, or connection failures */

// Strong — contract lives on the helper
// (in assert_row.ts)
/** @throws Error if \`row\` is undefined */
\`\`\`

**2. \`@mutates X - <verb that mirrors the function name>\`.** A tag that
adds no scope beyond the name + description is filler. A \`@mutates\` earns its
line when it surfaces _what would surprise a reader_: specific tables/columns,
cross-table cascades, fire-and-forget effects, context keys consumed by
downstream middleware, counter or rate-limiter state.

\`\`\`typescript
// Weak — set_session_cookie already says it
/**
 * Set the session cookie on a response.
 * @mutates \`c\` - writes the \`Set-Cookie\` header
 */

// Useful — names columns / scopes / cross-table cascade / non-obvious side channel
/** @mutates \`app_settings\` row - sets \`open_signup\`, \`updated_at\`, \`updated_by\` */
/** @mutates \`permit_offer\` siblings - stamps \`superseded_at\` on every other pending offer for the tuple */
/** @mutates Hono context - sets REQUEST_CONTEXT_KEY, CREDENTIAL_TYPE_KEY, AUTH_API_TOKEN_ID_KEY */
/** @mutates drift counters - bumps \`audit_unknown_event_type_failures\` on mismatch */
\`\`\`

**3. Duplicate sentence — \`@returns\` + prose saying the same thing.**

\`\`\`typescript
// Weak — two sentences, one fact
/**
 * @returns cleanup function that deactivates and hides the sidebar
 *
 * The returned disposer hides and disables on cleanup.
 */
\`\`\`

Pick one phrasing.

**4. Verbose prose / useless detail.** Filler that pads without signal.
Recurring shapes:

- **Filler \`@param X - the X\`** — description adds nothing beyond the
  parameter name and type. Drop the line; the signature is enough. A
  qualifier ("the X to <verb>", a format hint, an edge-case note) is
  usually worth keeping.
- **Step-by-step narration of self-evident behavior** — the function name
  and signature already tell the story.
- **Hedging filler** — "simply", "just", "essentially", "basically", and
  "should never happen" almost always indicate filler. Cut the sentence
  or rewrite without the hedge.
- **Marketing "useful for" bullet lists** that repeat the main
  description in different words.

\`\`\`typescript
// Weak — every line restates the parameter name + type
/**
 * @param specs - route specs to register
 * @param method - HTTP method
 * @param path - request path
 * @returns matching route spec, or \`undefined\`
 */

// Strong — keep \`@param\`/\`@returns\` only when they add a qualifier
//   beyond the signature (constraint, format, edge-case behavior)
/**
 * @param path - request path (exact or with concrete param values)
 */
\`\`\`

### Voice

\`@mutates\` and \`@throws\` are terse fragments — \`@mutates <target> -
<verb> <scope>\`, not full sentences. Backticks on every
table/column/symbol/constant name are house style.

Multi-paragraph descriptions are _earned_ by security or invariant
rationale (TOCTOU, fail-closed, sibling-supersede, ordering, init order);
long prose without that payoff is the pattern to flag.

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

Name the algorithm so readers can look it up; note rationale for
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

### CLAUDE.md is a map; TSDoc is the detail

When a symbol has non-obvious semantics — wire shape, invariants, ordering
constraints, failure modes — the explanation belongs on the symbol's TSDoc
(or its return type's), not in downstream CLAUDE.md or architecture docs.
mdz renders TSDoc through the \`virtual:svelte-docinfo\` pipeline, so the detail
stays one hop from the code and moves when the code moves.

CLAUDE.md entries should read as one-line pointers: symbol name plus a
short hook. Three sentences about what a function returns or how it
interacts with sibling symbols belong in source TSDoc. The failure mode is
drift: CLAUDE.md prose goes stale living far from the code it describes,
while TSDoc on the same symbol stays current because it's visible during
the edit.

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
- Wrap type/identifier references in backticks
- Must be in source parameter order
- Single-sentence descriptions are lowercase fragments with no trailing
  period — the house style (\`@param foo - the value to clamp\`); multi-sentence
  descriptions read as sentences: capitalized, with periods. Acronyms (CSS,
  HTML, URL) and proper names (Zod, Fisher-Yates) stay capitalized
  regardless. A legacy sentence-style file may stay internally consistent
  until touched.

\`\`\`typescript
/**
 * Parses a semantic version string.
 * @param version_string - version to parse (format: "major.minor.patch")
 * @param allow_prerelease - allow versions with prerelease suffixes like "1.0.0-alpha"
 */
\`\`\`

\`@param options.field - description\` documents a sub-property (collected into
per-path property descriptions keyed by parameter name). Because matching is
by parameter name, destructured params (\`fn({a, b}: T)\` — TS names the
parameter \`__0\`) can't be documented — name the parameter if it needs docs.

Multi-sentence descriptions read as sentences and wrap with continuation
indentation — see the \`exclude_dev\` example under
[Name algorithms](#name-algorithms-and-explain-rationale).

### \`@returns\`

Use \`@returns\` (not \`@return\`). Same capitalization rules as \`@param\`.

\`\`\`typescript
/**
 * Gets the current time.
 * @returns milliseconds since the Unix epoch
 */
\`\`\`

For async functions, describe what the \`Promise\` resolves to, not the \`Promise\` itself.

### \`@throws\`

Preferred: \`@throws ErrorType description\` — error type as first word, description follows. Pick a class even if it's just \`Error\`.

\`\`\`typescript
/**
 * @throws Error if task with given name doesn't exist
 * @throws TaskError if production cycles detected
 */
\`\`\`

The bare form (\`@throws description\`) and curly-brace form (\`@throws {ErrorType} description\`) also parse but are not preferred.

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
 * mdz_from_tsdoc('{@link https://fuz.dev|API Docs}')
 * // → '[API Docs](https://fuz.dev)'
 *
 * mdz_from_tsdoc('{@link SomeType}')
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

- Show the most common use case first — additional \`@example\` tags for variants
- Use \`// =>\` or \`// →\` comments to show return values inline; a bare call
  with no visible input/output (\`process_data(input);\`) teaches nothing
- Constants and simple predicates don't need examples unless usage is
  non-obvious

### \`@deprecated\`

Include migration guidance with backtick-linked replacement. Rarely used —
the "no backwards compatibility" policy means deprecated code is usually
deleted.

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
// src/lib/actions/action_spec.ts — from fuz_app
/**
 * Action spec types — the canonical source of truth for action contracts.
 *
 * Action specs define method, kind, auth, side effects, and input/output
 * schemas. Bridge functions in \`actions/action_bridge.ts\` derive \`RouteSpec\`
 * and \`EventSpec\` from them.
 *
 * @see \`actions/action_rpc.ts\` for the JSON-RPC dispatcher
 * @see \`actions/register_action_ws.ts\` for the WebSocket dispatcher
 *
 * @module
 */
\`\`\`

Note the nested modules use the full lib-relative path
(\`actions/action_rpc.ts\`, not \`action_rpc.ts\`).

**Identifiers** — wrap in backticks (not \`{@link}\`):

\`\`\`typescript
/** @see \`each_concurrent\` for the side-effect variant that skips result collection */
/** @see \`format_number\` in \`maths.ts\` for the underlying implementation. */
\`\`\`

### \`@since\`

Supported by the parser but not currently used (\`@since 1.5.0\`). Use when
versioning matters.

### \`@default\`

Documents default values for interface fields and component props — place it
on the field's doc comment:

\`\`\`ts
/**
 * How the content is aligned in the viewport. \`center\` vertically centers it;
 * \`top\` aligns it to the top and grows downward.
 * @default 'center'
 */
align?: DialogAlign;
\`\`\`

See [Svelte components](#svelte-components) for a full \`$props()\` block.

### \`@internal\`

Marks a symbol as not stable public API (standard TSDoc semantics). A
marker, not an exclusion — \`svelte-docinfo\` extracts it as \`internalMessage\`
and the declaration stays fully documented, so consumers *can* render a badge
or filter (no fuz_ui surface does yet). Trailing prose is kept as the field's
value: say who uses the symbol or why it's internal.

\`\`\`typescript
/**
 * Shared host decoration for \`createAnalysisProgram\`.
 *
 * @internal Used by \`analyzeCore\` and the test harnesses — not stable API.
 */
\`\`\`

Use for power-user-importable internals that should stay documented (deep
extractor modules, orchestration seams). To remove a symbol from docs
entirely, use \`@nodocs\` instead.

### \`@nodocs\` (non-standard)

Excludes from docs generation and flat namespace validation. Implemented by
\`svelte-docinfo\` — a tagged declaration is dropped from the analysis output
and skipped by duplicate checking. The dominant use is exported-but-internal
plumbing forced by the no-barrels convention (cross-module parser internals —
mdz tags ~160 exports this way); also build-system internals (Gro
\`Args\`/\`task\`, generated \`gen\` exports) and flat-namespace collisions.

\`\`\`typescript
/** @nodocs */
export const Args = z.object({...});

/** @nodocs */
export const task: Task<typeof Args> = {...};
\`\`\`

**Never \`@nodocs\` a symbol that external consumers import and use directly.**
If it's part of the public API, rename one side of the collision instead —
hiding the primary surface from the flat namespace also hides it from
generated docs and tomes, silently breaking downstream documentation.
See SKILL.md §Flat Namespace - Fail Fast for which side to rename.

### \`@mutates\` (non-standard)

Documents mutations to parameters or external state. Parsed by
svelte-docinfo's TSDoc parser and surfaced in fuz_ui's API docs.

**Form**: \`@mutates target - description\` — everything before the first
\` - \` is the target: a parameter name, a compound path (\`this.field\`), or a
multi-word reference (\`\` \`permit_offer\` siblings \`\`). Backticks in the
target are stripped by the parser, so renderers apply their own code
styling. The description is the value-add — it tells the reader _what_
changes and, when non-obvious, _why or when_.

A bare form with no description (\`\` @mutates \`target\` \`\`) parses to an
empty description but is discouraged: if the mutation needs no description,
the tag adds little too. When you write \`@mutates\`, make the description
carry weight.

Same capitalization rules as \`@param\`. Document mutations visible outside
the function; internal locals, closure state, and pull-based lazy caches
that consumers don't observe are out of scope.

#### When \`@mutates this\` is warranted on class methods

Stateful classes mutate by design — that's the point. Tagging _every_
state-changing method (\`add\`, \`remove\`, \`clear\`, \`set\`, \`release\`,
\`acquire\`, …) is noise: the method name already names the mutation.

\`@mutates this[.field] - description\` earns its line on a class method
**when the mutation isn't obvious from the method name**. Recurring shapes:

- **Cross-field invalidation** — clearing one field also resets caches or
  derived state. Example: \`Logger.clear_colors_override\` resets the
  override AND invalidates four cached prefix strings.
- **Cross-resource side effects** — the method registers/unregisters
  external listeners, file watchers, timers, or process handlers beyond
  mutating local state. Example: \`attach_error_handler\` sets
  \`#error_handler\` AND subscribes to \`process.uncaughtException\`.
- **Implicit tracking** — the method name describes one action but the
  class also records it for lifecycle/cleanup. Example:
  \`ProcessRegistry.spawn\` is named after spawning, but also adds the
  child to \`this.processes\` for later \`despawn_all\`.
- **Surprising mutation on a query-shaped name** — the method looks like
  a getter or pure query but mutates. Example: \`LruMap.get\` reorders the
  recency list.

A method whose name fully communicates the mutation (\`set foo\`,
\`clear_console_override\`, \`Counter.increment\`, \`LruMap.delete\`) does NOT
need the tag.

Ranking when the tag _is_ warranted: \`@mutates this.specific_field -
description\` (best, names the field) > \`@mutates this - description\`
(generic but at least carries reasoning) > \`\` @mutates \`this\` \`\` (bare,
discouraged) > omit (correct when the name says it all).

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
 * @param specs - middleware specs to apply
 * @mutates app - registers each spec's middleware on the app
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
11. \`@internal\`
12. \`@nodocs\`

\`@mutates\` goes after \`@returns\` (or after \`@param\` if no return).

### Where a tag has no effect

Placements the parser silently discards (svelte-docinfo emits a
\`misplaced_tag\` diagnostic, but no consumer imports \`diagnostics\` today):

- Symbol-scope tags (\`@example\`, \`@deprecated\`, \`@internal\`, \`@since\`,
  \`@see\`, \`@throws\`, \`@mutates\`, \`@default\`, \`@nodocs\`) on a **non-primary
  overload signature** — put them on the primary signature.
- \`@nodocs\` inside a \`@module\` comment — it has no module-level meaning; use
  the analyzer's \`exclude\` patterns to skip a whole module.
- \`@default\` on a top-level function — it applies only to variables,
  interface members, and component props.
- \`@defaultValue\`/\`@defaultvalue\` and \`@return\` parse as synonyms but are not
  house style — write \`@default\` and \`@returns\`.

## Inter-linking with mdz

Backtick-wrapped identifiers auto-link to API docs. Unmatched references
fall through to plain \`<code>\`.

Autolinking applies where fuz_ui renders through \`<Mdz>\`: main descriptions,
\`@param\` descriptions, \`@returns\`, \`@example\`, and \`@see\`. \`@throws\` and
\`@mutates\` descriptions render as plain text on the API pages — backticks
there display literally.

### Always link

**Wrap every mention of an exported identifier, module filename, or type name
in backticks.**

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

- exported function names: "\`tsdoc_parse\`", "\`shuffle\`"
- type and interface names: "\`ModuleJson\`", "\`SourceFileInfo\`"
- class names: "\`Library\`", "\`Declaration\`"
- module paths: "\`module_helpers.ts\`", "\`actions/composables.ts\`",
  "\`DocsLink.svelte\`" — see [Module path format](#module-path-format)
- tag names in prose: "\`@param\`", "\`@returns\`"
- enum and constant names

### Module path format

Module references must use the **canonical path** that \`Library.module_by_path\`
indexes — the \`src/lib/\`-relative path with the source extension. Anything
else falls through to plain \`<code>\` and the auto-link silently breaks.

\`\`\`typescript
// GOOD — lib-relative path with source extension
/** @see \`actions/action_rpc.ts\` for the JSON-RPC dispatcher */
/** Wraps \`LibraryJson\`. @see \`module.svelte.ts\` for the \`Module\` class */

// BAD — relative \`./\` prefix doesn't match canonical paths
/** Dispatch through \`action_rpc\` from \`./action_rpc.js\` here */

// BAD — \`.js\` runtime extension doesn't match the indexed \`.ts\` source path
/** @see \`action_rpc.js\` for the JSON-RPC dispatcher */

// BAD — bare filename of a nested module ambiguous and won't resolve
/** @see \`action_rpc.ts\` */ // breaks if the file is at actions/action_rpc.ts

// BAD — redundant \`src/lib/\` prefix; collapse to the bare lib-relative form
/** @see \`src/lib/actions/action_rpc.ts\` */ // should be \`actions/action_rpc.ts\`
\`\`\`

Top-level files (e.g., \`src/lib/tome.ts\`) match by bare filename
("\`tome.ts\`"). Nested files (e.g., \`src/lib/actions/action_rpc.ts\`)
require the full sub-path ("\`actions/action_rpc.ts\`"). When in doubt,
include the directory — the longer form always works.

**Never reference outside the repo from TSDoc** — source comments render into
published API docs where the shipped package stands alone, so an out-of-repo
path is a dead link. Full rules and escape hatches: ./path-references §4.

The canonical format is documented on \`Module.path\` in \`module.svelte.ts\`
(fuz_ui).

### Internal paths

Paths starting with \`/\` after whitespace auto-link as internal navigation.

**Gotcha — API route lists**: \`/word\` patterns auto-link, including HTTP
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

References are case-sensitive. "\`library\`" will NOT match \`Library\`.

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
 * Supports the common JSDoc/TSDoc doc tags:
 * \`@param\`, \`@returns\`, \`@throws\`, \`@example\`, \`@deprecated\`, \`@internal\`,
 * \`@see\`, \`@since\`, \`@default\`, \`@nodocs\`.
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

**Pipeline stages** — combine the numbered-steps form
([Document workflows](#document-workflows-with-numbered-steps)) with a \`@see\`
cluster in a single \`@module\` comment.

### Svelte components

Document props inline in the \`$props()\` type annotation. For obvious props
with no default, a comment is optional — focus on behavior, constraints,
and non-obvious defaults.

\`\`\`svelte
<script lang="ts">
	// from fuz_ui Dialog.svelte (abridged)
	const {
		show = true,
		align = 'center',
		dismissable = true,
		content_selector = '.pane',
		onbeforeclose,
		children,
		...rest
	}: Omit<SvelteHTMLElements['dialog'], 'children' | 'onclose'> & {
		/**
		 * Whether the dialog is shown. When the \`<dialog>\` mounts it opens via
		 * \`showModal()\`; when it unmounts it closes.
		 * @default true
		 */
		show?: boolean;
		/**
		 * How the content is aligned in the viewport. \`center\` vertically centers
		 * it; \`top\` aligns it to the top and grows downward, which avoids jank
		 * when the content's height changes.
		 * @default 'center'
		 */
		align?: DialogAlign;
		/**
		 * Whether clicking outside the content (see \`content_selector\`) closes
		 * the dialog. \`Escape\` closes it regardless of this.
		 * @default true
		 */
		dismissable?: boolean;
		/**
		 * Fallback selector for a content surface you render in \`children\`
		 * yourself (rather than via \`DialogContent\`, which self-registers).
		 * @default '.pane'
		 */
		content_selector?: string;
		/**
		 * Called before a user-initiated close (\`Escape\`, click-outside, or
		 * \`close\`). Return \`false\` to veto and keep the dialog open.
		 */
		onbeforeclose?: () => boolean | void;
		/**
		 * Rendered inside the dialog overlay. Receives the \`DialogContext\` (e.g.
		 * \`{close}\`); pair with \`DialogContent\` or render your own surface.
		 */
		children: Snippet<[dialog: DialogContext]>;
	} = $props();
<\/script>
\`\`\`

### Type aliases

\`\`\`typescript
/**
 * Analyzer type for source files.
 *
 * - \`'typescript'\` - TypeScript/JS files analyzed via TypeScript Compiler API
 * - \`'svelte'\` - Svelte components analyzed via svelte2tsx + TypeScript Compiler API
 * - \`'css'\` - CSS files
 * - \`'json'\` - JSON files
 */
export type AnalyzerType = 'typescript' | 'svelte' | 'css' | 'json';
\`\`\`

## Drift — Correctness Over Coverage

**A wrong doc comment is worse than a missing one** — it looks authoritative,
so readers trust it and propagate the mistake. When refactoring a public API,
re-read the TSDoc on every touched symbol before shipping.

Common drift patterns to watch for:

- **\`@throws\` vs return shape** — function declares \`@throws\` but the body
  returns \`null\`/\`undefined\` on the same failure path (or vice versa). The
  highest-value contradiction because callers branch on it
- **Signature changed** — \`@param\` list no longer matches parameter order, or
  names refer to renamed arguments
- **Return shape widened** — new fields on a returned type go undocumented on
  the function that produces them
- **Error semantics tightened** — a thrown error class was replaced or a
  distinct \`error.data.reason\` was added, but \`@throws\` still names the old one
- **Cross-refs rotted** — \`@see some_helper.ts\` points at a file that was
  moved, merged, or deleted
`},{slug:"twin-impl",title:"Twin Implementations (TS ↔ Rust)",content:`# Twin Implementations (TS ↔ Rust)

**Twin-impl spine** names the architecture: the same backend spine — auth,
db, http, realtime, actions — ships in two implementations, TypeScript in
\`fuz_app\` and Rust in the fuz spine crates (./rust-spine), held observably
equivalent on the wire. Consumers pick one or both. This is a user-facing
capability, not just a development practice: a project can ignore Rust,
ignore TS, or run both for robustness and measurement.

**Twin-impl convergence** names the discipline: whichever implementation
lands the better shape — security, correctness, abstraction design, forensic
detail — becomes the canonical reference, and the other ports to converge.
Bidirectional: TS decisions flow to Rust, Rust improvements flow back.

fuz_forge is the canonical twin consumer: its TS (Hono) server and Rust
(\`fuzfd\`, axum) server are co-maintained at full wire parity.

## Roles

- **Reference impl = run, not compiled.** The TS server is never
  shipped/deployed; it runs directly (\`deno run\`) as the parity twin for
  tests, benches, and local dev. The Rust binary is the production deploy.
  Compiling a never-shipped TS server is dead weight.
- **The CLI is not a twin.** A CLI is a _client_ of the server, not a second
  spine implementation — two CLIs prove nothing about the wire. A CLI has two
  coherent states: **shipping** (compiled; a single-file binary is the point)
  or **retired** (deleted). No "run-directly TS CLI reference" middle state.

## Naming parity

Shared spine concepts — types, fields, error-reason literals, the named steps
of a shared algorithm — carry **parallel identifiers** across both spines,
modulo each language's case convention (\`post_commit_effects\` ↔
\`PostCommitEffects\`). A cross-impl name mismatch for the _same_ concept is a
convergence defect, tracked and closed like a bug; when one side renames, the
other follows. Two subtleties:

- **Distinct concepts keep distinct names on both sides.** If TS has an eager
  \`pending_effects\` queue and a deferred \`post_commit_effects\` queue, the
  Rust side that carries only the deferred one must not name it
  \`PendingEffects\` — same-name-same-concept cuts both ways.
- **Parity is at the identifier level, not the file level.** Module/file
  names may differ where a module's scope genuinely differs.

Identifier parity is what lets an agent learn a concept once and find it in
either spine — snake_case alignment across TS/Rust/SQL is what makes it
cheap.

## Enforcement

- **The cross-backend harness** (in \`fuz_app\`) drives both backends with the
  same requests and asserts responses **byte-for-byte** — status, body,
  headers. Consumers inherit shared _conformance principals_ (credential
  type × context combinations, e.g. daemon-token-with-Origin, invalid-token
  variants) so a new auth edge case added upstream tests every consumer.
- **\`testing_spine_stub\`** is the domain-free third consumer: it exercises
  the Rust spine surface without any consumer's business logic, so
  spine-level parity is tested independently of zzz/fuz_forge.
- **Strict-schema parsing of read bodies**: the strongest cheap assertion is
  parsing every populated read-RPC response with the strict TS Zod schema —
  it catches missing/extra/renamed fields wholesale.
- **Schema parity**: DB schema introspection compared across backends with
  zero excluded tables as the target.
- **Env contract tests** that actively _reject retired variable names_ — the
  strongest anti-drift guard, since env handling is hand-written on both
  sides.
- **When the cross harness can't reach a path**, Rust unit serialization
  tests (\`serde_json::to_value(dto) == json!(…)\`) stand in as the parity
  guard.

**Where twins silently diverge**: paths tested on one backend only —
especially auth/error negatives (401 anti-enumeration, malformed input,
browser-context guards). Two hand-written stacks agree on the happy path and
drift on the edges; port single-backend tests to cross tests. A live behavior
difference is either converged or explicitly documented as intentional (e.g.
a version _value_ differs while the parity test asserts the shape).

## Scoping the parity burden

Parity is largely self-policing where the substrate bottoms out in **shared
upstream code** — \`fuz_app\` on TS, the spine crates on Rust. A consumer's
real parity surface is only what it hand-writes twice: RPC handlers, domain
parsing, auth glue, env loading, subprocess use. Keep that surface small and
the twins stay cheap.

## The wire crate

Hand-written wire shapes that both the Rust client and Rust server need —
input validators (slug/segment grammars) and typed output DTOs — live in a
dedicated \`*_wire\` crate (\`fuz_forge_wire\`), single-sourced instead of
implemented per binary. Pure logic, no spine dep. Boundaries:

- **Stack-wide constants stay spine-canonical.** JSON-RPC error codes belong
  to \`fuz_http::JsonrpcErrorCode\` (TS twin: \`fuz_app\`'s \`jsonrpc_errors\`),
  not copied into a consumer's wire crate. A consumer references the enum,
  never a magic number.
- **Serialization parity rules for DTO twins**: no \`skip_serializing_if\` — a
  nullable field emits \`null\` like the TS side; \`#[serde(rename = "ref")]\` /
  \`"type"\` for keyword fields; discriminated unions as
  \`#[serde(tag = "kind", rename_all = "snake_case")]\` enums; DTOs carry the
  **full** field set (never a client's duck-typed subset); field declaration
  order matches the wire; booleans are real \`bool\` fields.

## Structure mirroring

- **Module boundaries mirror the twin's seams.** If TS keeps git subprocess
  and record-parsing in \`git/read.ts\` + \`git/parse.ts\`, the Rust side splits
  the same way — byte-format contracts (\`%H%x00…\` format strings, RS/NUL
  framing) become diffable module-to-module instead of buried in a
  monolith.
- **Canonicalize internal identifiers on the cleaner idiom** (often the Rust
  name; the TS reference tends wordier). Wire- and schema-visible forms must
  already match — internal renames are cleanup, not correctness.

## Utility twins

The same discipline at micro scale — a Rust utility mirroring a TS one keeps
the twin's semantics and (case-adjusted) name: \`fuz_sys::env::parse_stringbool\`
↔ \`z.stringbool()\`, the \`DaemonInfo\` daemon-file schema shared between zzz's
Rust CLI and \`fuz_app\` TS, the \`lru\`-backed \`RateLimiter\` twinning
\`fuz_app\`'s \`LruMap\`. When porting a utility across the language boundary,
find its twin first; diverging semantics under a shared name is the same
defect class as a name mismatch.

## Serde boundary conformance

_Rust ↔ hand-written TS — round-trip + coverage guard, no codegen dependency._

When a Rust crate owns a serde JSON boundary (\`#[serde(deny_unknown_fields)]\`)
that a hand-written TypeScript layer authors against — e.g. a typed config
builder whose calls serialize to JSON that the Rust engine parses — keep the TS
types **hand-written** (best ergonomics, no codegen dependency) and guard them
against drift with a round-trip test, not \`schemars\`/\`ts-rs\`.

Why not codegen: a generated schema/types layer is a _second_ encoding of the
boundary that can itself drift from serde's tagging/rename. A round-trip test
validates against the **real serde parser** — the code that runs in production —
so it tests reality, not a model. Reserve codegen for when you need field-level
coverage enforcement or a published JSON Schema for external consumers.

**Two-layer guard** (used in zap's TS config library):

1. **Round-trip conformance.** One typed "kitchen-sink" fixture exercising every
   type/field/variant, \`import type\`'d against the TS types and \`export
default\`ing a builder function. One source, gated twice:
   - \`gro typecheck\` includes it → catches **types-too-strict** (a valid shape
     the TS types wrongly reject).
   - A Rust integration test evaluates it and parses the emitted JSON with the
     real config type → catches **types-too-loose / false-green** (a shape TS
     accepts that serde rejects).

   The \`import type\` is erased at runtime, so the evaluator needs no module
   resolution — the same file is both typechecked and executed.

2. **Coverage guard.** Iterate the Rust canonical variant list (e.g. a
   \`ResourceType::ALL\` const) and assert the fixture exercises **every** variant:
   \`for v in ALL { assert!(seen.contains(&v), "kitchen-sink missing {v}") }\`.
   This catches a whole type/variant added in Rust but absent from the TS surface
   — which the round-trip alone can't see. Pair with a loud floor
   (\`assert!(items.len() >= N)\`) so a vanished fixture fails instead of silently
   passing.

Optionally add a thin **e2e smoke** through the shipped path (built binary → real
parse → exit code), skipping cleanly when the runtime (e.g. Deno) or binary is
absent — the same skip discipline as DB/Deno-gated tests
(./testing-patterns §Environment Flags).

Gotchas: if the evaluator stubs nondeterministic globals (clock/RNG) to throw,
the fixture must use pure literals only. Gate the round-trip test on the
evaluator runtime being present (skip-with-notice), matching the repo's
Deno-gating posture.

## Tool twins: molt

fuz_template's ejector ships as symmetric twins — \`src/lib/molt.ts\`
(\`npm run molt\`) and the \`molt\` crate (\`cargo molt\`) — at full behavior
parity: same flags, same wizard, same plan, byte-identical output trees.
Unlike the spine there is no reference/production asymmetry: both are
shipping paths, chosen by which toolchain the user has (the TS twin exists
so ejecting never requires installing Rust; the Rust twin dogfoods the
ecosystem's CLI conventions). Its parity mechanics differ instructively
from the wire twins:

- **Parity is enforced against the tree, not across the twins.** The parity
  surface is filesystem effects, not a wire. Each side embeds its own copy
  of the exact-content anchors and self-verifies against the working tree
  (\`cargo test\` / \`gro test\`, both in CI) — an anchored template edit breaks
  both checks at the same commit, so cross-twin drift surfaces without a
  cross-backend harness. What can be single-sourced is: the output templates
  live once in \`crates/molt/templates/\` (compiled into the Rust binary via
  \`include_str!\`, read at runtime by the TS twin).
- **Mutual deletion bounds the burden.** Each twin's plan deletes both
  implementations (crate, TS module, tests, npm script entry) — self-deleting
  tooling leaves zero post-eject parity surface.
- **Identifier parity end to end** (\`build_plan\`/\`verify\`/\`apply\`/
  \`apply_gate\`/\`FEATURES\`…), with the TS module's sections mirroring the
  crate's module seams, so each concept's twin is greppable by name.
`},{slug:"type-utilities",title:"Type Utilities",content:"# Type Utilities\n\nTypeScript type helpers in `@fuzdev/fuz_util/types.ts` — which to reach for\nand the conventions around them; full signatures live in the source and on\nthe generated API docs.\n\n## Nominal Typing\n\n### Flavored (loose) — the primary approach\n\n`Flavored<TValue, TName>` adds an _optional_ invisible brand: unflavored base\nvalues assign without casting, but different flavors are incompatible.\n\n```typescript\ntype Email = Flavored<string, 'Email'>;\ntype Address = Flavored<string, 'Address'>;\n\nconst email1: Email = 'foo@bar.com'; // ok — plain string assigns\nconst email2: Email = 'foo' as Address; // error — Address !== Email\n```\n\nReal uses: `PathId` (`path.ts`), `GitOrigin`/`GitBranch` (`git.ts`), the\ncolor channel types (`Hue`, `Saturation`, `Red`, …, `colors.ts`), `Url`\n(`url.ts` — paired with a Zod schema of the same name), `BlogPostId`\n(fuz_blog), `InputPath` (gro), `ReorderableId` (zzz).\n\n### Branded (strict) — exported but unused\n\n`Branded<TValue, TName>` requires a cast from the base type. Nothing in the\necosystem uses it: in practice, use `Flavored` for compile-time-only nominal\ntyping, and Zod `.brand()` when the value crosses a runtime boundary and\nshould also validate (`Uuid`, `Datetime` — see ./zod-schemas §Branded\nTypes).\n\n## Strict & Distributive Utilities\n\n- **`OmitStrict<T, K extends keyof T>`** — `Omit` that rejects non-keys\n  (standard `Omit` accepts any string, so typos compile silently). Widely\n  used in fuz_ui, fuz_app, zzz.\n- **`PickUnion<T, K>` / `KeyofUnion<T>`** — `Pick`/`keyof` that distribute\n  over unions (the standard ones don't).\n\n## Class & Element Helpers\n\n- **`Assignable<T, K>`** — removes `readonly`; zzz uses it for\n  self-referential init:\n  `(this as Assignable<typeof this, 'app'>).app = this;`\n- **`ClassConstructor<TInstance>`** — constructor type; zzz's Cell registry\n  is `Map<string, ClassConstructor<Cell>>`.\n- **`ArrayElement<T>`** — element type of a readonly array.\n\n## Exported but currently unused\n\n`PartialExcept`, `PartialOnly`, `PartialValues`, and `NotNull` have no\nreferences outside `types.ts`; `Defined` has one (fuz_ui's `csp.ts`). Don't\nmodel new code on them — reach for an inline mapped type until a recurring\nneed appears.\n"},{slug:"wasm-patterns",title:"WASM Patterns for the Fuz Ecosystem",content:`# WASM Patterns for the Fuz Ecosystem

**Applies to**: \`blake3\` (WASM hashing) and \`tsv\` (parser/formatter bindings —
WASM, C-FFI, and N-API). The fuz workspace does not currently use WASM.

**Publishing stance**: npm gets **both** native (N-API) and WASM builds. The
C-FFI \`cdylib\` additionally serves Deno FFI and Python.

## Two Build Targets

| Approach        | Tool              | Consumer           | Use case                         |
| --------------- | ----------------- | ------------------ | -------------------------------- |
| wasm-bindgen    | \`wasm-pack\`       | JS runtimes        | Ship Rust to Deno/Node/browsers  |
| Component model | \`cargo-component\` | Wasmtime / plugins | Sandboxed execution, composition |

**wasm-bindgen**: generates glue code, handles memory management, produces
\`.wasm\` + \`.js\` ready to import. **Component model**: capability-controlled
execution — components declare imports/exports via WIT interfaces.

When to use which: npm publishing → wasm-bindgen; benchmarking across
runtimes → both; plugin systems (speculative) → component model.

## WIT Interface Design

Abridged from blake3's \`wit/\` (the full interface adds derive-key and more
resource methods):

\`\`\`wit
package fuzdev:blake3@0.0.1;

interface hashing {
    enum hash-error { invalid-key-length }

    hash: func(data: list<u8>) -> list<u8>;
    keyed-hash: func(key: list<u8>, data: list<u8>) -> result<list<u8>, hash-error>;

    resource hasher {
        constructor();
        new-keyed: static func(key: list<u8>) -> result<hasher, hash-error>;
        update: func(data: list<u8>);
        finalize: func() -> list<u8>;
    }
}

world blake3 {
    export hashing;
}
\`\`\`

- Package naming \`<namespace>:<name>@<version>\` — use the \`fuzdev\` namespace.
- WIT **requires** kebab-case; binding generators convert per language.
- **One-shot functions** for stateless ops; **resources** for stateful
  streaming (\`hasher\` holds state across \`update\`/\`finalize\`).
- **\`result<T, E>\` with typed error enums** (not strings); minimal enums —
  one variant per distinct failure mode.
- **Worlds declare capabilities** — \`export hashing\` with no imports = pure
  computation, no ambient access.

## Component Implementation (wit-bindgen)

Abridged from \`blake3_component\` (see the crate for the full impl):

\`\`\`rust
use std::cell::RefCell;
use exports::fuzdev::blake3::hashing;

wit_bindgen::generate!({ path: "../../wit", world: "blake3" });

struct Component;
export!(Component);

impl hashing::Guest for Component {
    type Hasher = HasherResource;

    fn keyed_hash(key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(blake3::keyed_hash(&key, &data).as_bytes().to_vec())
    }
    // hash / derive_key: same shape
}

struct HasherResource {
    inner: RefCell<blake3::Hasher>,
}

impl hashing::GuestHasher for HasherResource {
    fn update(&self, data: Vec<u8>) {
        self.inner.borrow_mut().update(&data);
    }
    // constructor / static factories / finalize: same RefCell shape;
    // factories return hashing::Hasher::new(HasherResource { … })
}
\`\`\`

Key patterns: \`wit_bindgen::generate!\` at compile time from WIT; unit struct

- \`export!\`; **\`RefCell\` for resource state** (resources receive \`&self\`);
  static factories return \`hashing::Hasher\` wrapping the resource struct.

### Cargo.toml for component crates

\`\`\`toml
[lib]
crate-type = ["cdylib"]

[dependencies]
blake3 = { workspace = true, features = ["wasm32_simd"] }
wit-bindgen.workspace = true

# Cannot use \`lints.workspace = true\`: wit-bindgen generates #[export_name]
# and unsafe ABI stubs. Re-declare the ENTIRE workspace lint block (rust and
# clippy tables — see ./rust-patterns.md §Lints; overriding only unsafe_code
# silently drops the restriction-lint floor), changing only:
[lints.rust]
unsafe_code = "allow"
# ... full re-declared [lints.rust] + [lints.clippy] block here ...
# blake3_component additionally allows same_length_and_capacity + use_self
# (false positives from generated code).

[package.metadata.component]
package = "fuzdev:blake3"

[package.metadata.component.target]
world = "blake3"
path = "../../wit"
\`\`\`

\`[package.metadata.component.target]\` is a sub-table — \`world\` and \`path\` go
under \`target\`, not directly under \`component\`.

Build (requires \`cargo-component\` and the \`wasm32-wasip1\` target; no
wasm-opt pass for the component):

\`\`\`bash
RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128' \\
    cargo component build -p blake3_component --release
\`\`\`

## Host-Side Embedding (wasmtime)

Only blake3's bench/compare binaries embed a component host; read
\`blake3_bench_wasmtime\` for the working setup. The gotchas:

- Pin \`wasmtime\`/\`wasmtime-wasi\` at the same major (currently 45) and enable
  the \`component-model\` feature on \`wasmtime\` — the \`bindgen!\`/component APIs
  don't compile without it.
- \`wasmtime::component::bindgen!\` mirrors the guest-side macro; the host state
  struct holds \`WasiCtx\` + \`ResourceTable\` and implements \`WasiView\`.
- Enable \`wasm_component_model\` on the engine \`Config\` and add WASI to the
  linker via \`wasmtime_wasi::p2::add_to_linker_sync\`.
- **Resource lifecycle**: the host owns the handle, the guest owns the memory —
  call \`resource_drop\` explicitly or the guest instance leaks.

## wasm-bindgen Patterns

### Crate architecture (blake3)

Shared core crate with thin wrappers — the SIMD split is genuinely two
crates (contrast tsv, where the split is a feature axis within one crate):

| Crate               | Type            | Purpose                                   |
| ------------------- | --------------- | ----------------------------------------- |
| \`blake3_wasm_core\`  | \`rlib\`          | Shared wasm-bindgen exports + TS types    |
| \`blake3_wasm\`       | \`cdylib + rlib\` | SIMD build (enables \`blake3/wasm32_simd\`) |
| \`blake3_wasm_small\` | \`cdylib + rlib\` | Size-optimized build (no SIMD)            |

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
    pub fn update(&mut self, data: &[u8]) { self.inner.update(data); }
    pub fn finalize(&self) -> Vec<u8> { self.inner.finalize().as_bytes().to_vec() }
    // new_derive_key / finalize_and_reset / reset
}
\`\`\`

Differences from the component model: \`&[u8]\` and \`&mut self\` (wasm-bindgen
handles borrowing, no \`RefCell\`); \`JsError\` string messages, not typed enums;
\`free()\` and \`Symbol.dispose\` generated automatically.

### tsv wasm-bindgen patterns

Complex return types (ASTs) cross the boundary as a single JSON string,
parsed with the engine's native \`JSON.parse\` via \`js-sys\` — building the JS
object graph node-by-node with \`serde-wasm-bindgen\` was measurably slower and
was dropped. Parsers are arena-based (./rust-perf §Arena allocation): the
binding runs inside \`with_ast_arena\` / \`with_doc_arena\` so per-call
allocation amortizes to zero.

\`\`\`rust
// lang_bindings! macro-generates four exports per language:
//   parse_<lang>, parse_<lang>_json, parse_internal_<lang>, format_<lang>
// The extern type names the matching interface in the bundled tsv_ast.d.ts,
// so wasm-pack declares the return as the typed AST (e.g. \`SvelteRoot\`).
#[wasm_bindgen]
pub fn parse_svelte(source: &str) -> Result<SvelteRoot, JsError> {
    let json = parse_svelte_json(source)?;
    let js_value = js_sys::JSON::parse(&json)
        .map_err(|_| err("internal error: AST serialized to invalid JSON"))?;
    Ok(js_value.unchecked_into::<SvelteRoot>())
}

#[wasm_bindgen]
pub fn parse_svelte_json(source: &str) -> Result<String, JsError> {
    with_ast_arena(|arena| {
        let ast = tsv_svelte::parse(source, arena).map_err(err)?;
        Ok(tsv_svelte::convert_ast_json_string(&ast, source))
    })
}
\`\`\`

\`parse_*_json\` returns the wire string directly for consumers that forward it
without materializing a JS object. \`parse_internal_*\` benchmarks skip
serialization via \`std::hint::black_box\`. Goal-aware exports
(\`parse_typescript_json_with_goal\`, \`format_typescript_with_goal\`) sit
outside the macro.

**wasm-opt needs every non-baseline feature enabled by name** or it rejects the
instructions: \`--enable-bulk-memory\` and \`--enable-nontrapping-float-to-int\`
are required for any Rust 2024 output, and each \`-Ctarget-feature\` in
\`.cargo/config.toml\` needs its matching \`--enable-*\` (\`+simd128\` →
\`--enable-simd\`, \`+multivalue\` → \`--enable-multivalue\`). Set them in
\`[package.metadata.wasm-pack.profile.release] wasm-opt = [...]\`.

### TypeScript entry points

A hand-written TS entry re-exports wasm-pack's \`pkg/\` output and layers on the
stream helpers. Per-runtime entries differ in init strategy — Node uses
synchronous init (\`readFileSync\` + \`initSync\`), browsers async \`init()\` with
exports guarded against uninitialized WASM. The generated packages bridge
wasm-bindgen's camelCase to the ecosystem convention: \`initSync\` is re-exported
as \`init_sync\`.

### Streaming, disposal, consumer API

- Stream helpers batch at 16 KB to reduce WASM boundary crossings:
  \`await hash_stream(file.stream())\` etc., built via
  \`make_stream_functions(Blake3Hasher)\`; the browser entry passes a \`_check\`
  guard against uninitialized WASM.
- \`using hasher = new Blake3Hasher();\` — wasm-bindgen generates
  \`Symbol.dispose\`, so \`free()\` runs at scope exit. Shared
  \`Blake3HasherInstance\` / \`Blake3HasherConstructor\` interfaces type the
  class across entries.
- \`@fuzdev/fuz_util/hash_blake3.ts\` is the ecosystem consumer:
  \`export const blake3_ready = init();\` (eager init — resolves immediately
  under sync init, awaited in browsers) and
  \`hash_blake3(data: Uint8Array | BufferSource | string): string\` returning
  64-char hex (validated by the \`Blake3Hash\` Zod schema).

### deno compile compatibility

wasm-bindgen's deno target loads WASM via \`fetch()\`, incompatible with
\`deno compile\`. The build pipeline patches the generated JS to use
\`Deno.readFileSync\` and creates a \`_bg.js\` stub for module resolution.

## Multiple Binding Crates (tsv pattern)

A library targeting several runtimes keeps one binding crate per technology,
all exporting identical macro-generated signatures (\`parse\` /
\`parse_internal\` / \`format\` per language), so consumers choose by runtime:

| Crate      | Technology   | Target                         | Error type           |
| ---------- | ------------ | ------------------------------ | -------------------- |
| \`tsv_wasm\` | wasm-bindgen | Deno, browsers, Node           | \`Result<T, JsError>\` |
| \`tsv_napi\` | N-API        | Node.js, Bun (native npm path) | N-API errors         |
| \`tsv_ffi\`  | C ABI        | Deno FFI, Python               | JSON error objects   |

All three share the \`tsv_arena\` per-thread arenas. \`tsv_ffi\` and \`tsv_napi\`
override \`unsafe_code = "allow"\` and re-declare the full workspace lint block
(./rust-patterns §Lints). \`tsv_ffi\` uses raw pointers with
\`tsv_free(ptr, len)\` for memory management and wraps every entry point in
\`panic::catch_unwind\`, rendering payloads as \`{"error": "panic: …"}\` —
effective only under a \`panic = "unwind"\` profile: \`[profile.corpus]\` covers
the differential/fuzz runs and \`[profile.napi]\` covers the shipped N-API
artifact; a plain-release build aborts, where the wrapper is inert
(./rust-patterns §Release Profile).

## Package naming: \`_wasm\` suffix

WASM artifacts carry a \`_wasm\` suffix everywhere they could be confused with a
native build; native artifacts stay bare. The suffix is part of the published
identity — npm package, crate name, and the generated \`*_wasm_bg.wasm\` all
agree.

| Project | WASM packages                                                                                        | Native                                                |
| ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| blake3  | \`@fuzdev/blake3_wasm\` (SIMD), \`@fuzdev/blake3_wasm_small\` (no SIMD)                                  | none                                                  |
| tsv     | \`@fuzdev/tsv_wasm\` (parse + format + \`tsv\` CLI), \`@fuzdev/tsv_format_wasm\`, \`@fuzdev/tsv_parse_wasm\` | \`tsv\` CLI binary, \`tsv_ffi\` \`.so\`, \`tsv_napi\` \`.node\` |

- **The three tsv WASM packages come from one crate.** \`tsv_wasm\` has
  \`format\`/\`parse\` cargo features (default = both); the subset packages are
  \`--no-default-features --features format|parse\` builds. \`parse\` pulls the
  language crates' \`convert\` feature (the AST→JSON layer); both features
  pull \`js-sys\` (one shared options-bag reader so the two families can't
  drift — ~0.2% on the format-only package). The umbrella \`@fuzdev/tsv_wasm\`
  is the flagship (it ships the JS \`tsv\` CLI).
- **Native stays bare, and "tsv" is deliberately overloaded**: the native CLI
  binary (\`tsv_cli\` crate), the C-FFI lib, and the JS CLI inside
  \`@fuzdev/tsv_wasm\` are all invoked as \`tsv\` — same tool, per-runtime
  delivery.
- **Drop redundant kind labels.** Where artifacts are already grouped by kind,
  don't repeat \`(wasm)\` / \`(native)\` in the row name — the \`_wasm\` suffix (or
  its absence) carries it.

## Two Packages, Not Two Profiles (blake3)

When two builds differ only in codegen flags, **ship two packages from two
thin crates over one shared core, not two cargo profiles**. blake3's SIMD and
no-SIMD packages are the worked case: both size-optimized end-to-end
(\`opt-level=s\` + wasm-opt \`-Os\`), differing only in \`+simd128\` and the core's
\`simd\` feature. A size regression test pins the byte counts.

**Why not profiles**: \`wasm-pack\` doesn't support \`--profile\` (it conflicts
with \`--release\`), so per-build codegen differences have to ride on \`RUSTFLAGS\`
at the invocation — which makes the crate, not the profile, the natural unit.

Pick by measurement, not by default: blake3's SIMD build is ~2.6x faster at
large inputs on Deno/Node but *slower* on Bun (a WASM SIMD regression), so the
small build is right for Bun and bundle-size-sensitive contexts. The wasmtime
component is the exception to size-optimization — \`opt-level=3\`, since a host
can absorb bytes for speed.

## Testing

blake3 keeps **zero Rust unit tests by design**: correctness is asserted in
TypeScript (WASM vs native test vectors) and via a Wasmtime compare binary
for the component; \`cargo test --workspace\` serves as a compile gate. tsv's
binding tests run per runtime (Deno, N-API, npm) plus in-crate FFI/N-API
round-trip tests — see ./rust-patterns §Testing.

## Cross-References

| Resource                         | Link                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Blake3 WASM bindings             | [fuzdev/blake3](https://github.com/fuzdev/blake3)                                                                         |
| Component model spec — WIT       | [WebAssembly/component-model WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)             |
| Component model spec — Explainer | [WebAssembly/component-model Explainer](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md) |
| Rust patterns                    | ./rust-patterns                                                                                                        |
| Rust performance (arenas)        | ./rust-perf                                                                                                            |
`},{slug:"zod-schemas",title:"Zod Schemas",content:`# Zod Schemas

Zod schema conventions for \`@fuzdev\` TypeScript/Svelte projects.

## Schema-First Design

Zod schemas are source of truth for JSON shape, TypeScript type (\`z.infer\`),
defaults, metadata, CLI help text, and serialization.

- **\`.meta({description})\`** — introspectable metadata for CLI help and runtime
  reflection
- **Runtime-inspectable** — walkable (\`zod_to_schema_properties\`), exportable as
  JSON Schema (\`z.toJSONSchema\`)
- **JSON-native** — branded strings for timestamps (\`Datetime\`), IDs (\`Uuid\`),
  paths (\`FilePath\`) eliminate serialization friction
- **Composition cascades** — \`.extend()\` for hierarchies, \`.brand()\` for domain
  safety, \`.default()\` for partial construction

### Schema helpers by layer

| Layer        | Module                                                   | Capabilities                                                                                                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation   | \`@fuzdev/fuz_util/zod.ts\`                                | Schema introspection — extract descriptions, defaults, aliases, types, properties; unwrap wrappers (\`zod_get_innermost_type\`, \`zod_unwrap_to_object\`); object-field helpers (\`zod_get_schema_keys\`, \`zod_get_field_schema\`, \`zod_maybe_get_field_schema\`); check optional/nullable/default; format values for display |
| Foundation   | \`@fuzdev/fuz_util/id.ts\`, \`@fuzdev/fuz_util/datetime.ts\` | \`Uuid\`, \`Datetime\` branded types and factories (\`create_uuid\`, \`get_datetime_now\`, \`UuidWithDefault\`, \`DatetimeNow\`)                                                                                                                                                                                                  |
| Cell helpers | \`@fuzdev/zzz/zod_helpers.ts\`                             | Path-transform schemas (\`PathWithTrailingSlash\`, \`PathWithoutTrailingSlash\`, \`PathWithLeadingSlash\`)                                                                                                                                                                                                                  |
| CLI          | \`@fuzdev/fuz_app/cli/args.ts\`, \`help.ts\`                 | Schema-validated CLI arg parsing; schema-driven help text generation                                                                                                                                                                                                                                                  |
| HTTP         | \`@fuzdev/fuz_app/http/schema_helpers.ts\`                 | \`schema_to_surface()\` exports JSON Schema via \`z.toJSONSchema()\` for snapshot-testable API surfaces; \`instanceof\` checks for schema type detection                                                                                                                                                                    |
| Testing      | \`@fuzdev/fuz_app/testing/schema_generators.ts\`           | Schema-driven test data generation — valid bodies, adversarial inputs                                                                                                                                                                                                                                                 |

## Core Conventions

1. **\`z.strictObject()\`** — default for all object schemas, including inside
   \`z.discriminatedUnion()\` and \`z.union()\`. Rejects unknown keys.
   **Exceptions**: external data (\`z.looseObject()\` or \`z.object()\` with a
   comment explaining why); response/error schemas consumed by clients
   (\`z.looseObject()\` — add fields without breaking consumers); protocol schemas
   where the other side may add fields per spec (e.g., JSON-RPC messages).
2. **PascalCase naming** — schema and inferred type share the same name.
3. **\`.meta({description: '...'})\`** — not \`.describe()\`. \`.meta()\` supports
   additional keys (\`aliases\`, \`sensitivity\`).
4. **\`safeParse\` for external input, \`parse\` for fail-fast** — full guidance
   (external input, internal assertions/CLI args, custom-throw for error
   context, return-null for optional config) in §Validation at Boundaries.

### The Canonical Pattern

\`\`\`typescript
import { z } from 'zod';

export const MyThing = z.strictObject({
	name: z.string().min(1),
	count: z.number().int().default(0),
	kind: z.enum(['a', 'b'])
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
types. \`z.infer<>\` gives the output (post-parse) type; \`z.input<>\` gives the
pre-parse type — what callers provide before defaults are applied.

Export \`z.input<>\` when callers construct partial instances via \`.parse()\`; skip
it when the schema is only consumed internally (env loading, action spec
\`satisfies\`).

This is a **systematic pattern** in zzz:

\`\`\`typescript
// zzz — every Cell schema exports both types
export const ChatJson = CellJson.extend({
	name: z.string().default(''),
	thread_ids: z.array(Uuid).default(() => []),
	selected_thread_id: Uuid.nullable().default(null)
	// … more fields elided
}).meta({ cell_class_name: 'Chat' });
export type ChatJson = z.infer<typeof ChatJson>; // all fields present
export type ChatJsonInput = z.input<typeof ChatJson>; // defaults omittable

// a schema extending a base + literal discriminant, exporting an input type
export const PackageResource = ResourceBase.extend({
	type: z.literal('package'),
	from: PackageMapping,
	check: z.string().optional()
});
export type PackageResource = z.infer<typeof PackageResource>;
export type PackageResourceInput = z.input<typeof PackageResource>;
\`\`\`

Use \`z.input<>\` for: constructor/factory parameters (Cell instantiation,
resource builders), config file shapes (before defaults applied), form inputs
and partial data from storage.

Use \`z.infer<>\` (the default) for: runtime data after parsing, function return
types, validated state.

### Factory Functions with Input Types

A systematic factory pattern: accept \`z.input<>\` without the discriminant
field, parse to get validated output:

\`\`\`typescript
export const package_resource = (config: Omit<PackageResourceInput, 'type'>): PackageResource => {
	return PackageResource.parse({ type: 'package', ...config });
};

// usage — type-safe, defaults applied, discriminant injected
const pkg = package_resource({ id: 'nginx', name: 'nginx', from: { apt: 'nginx' } });
\`\`\`

\`parse\` applies defaults and validates; \`Omit<Input, 'type'>\` lets callers skip
the discriminant.

## Branded Types

Nominal typing for primitives — a \`Uuid\` is not interchangeable with \`string\`
at the type level:

\`\`\`typescript
// fuz_util/id.ts — Zod 4 built-in validators + brand
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

// fuz_util/datetime.ts
export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// zzz/diskfile_types.ts — refine + brand for domain validation
export const DiskfilePath = z
	.string()
	.refine((p) => is_path_absolute(p), { message: 'path must be absolute' })
	.brand('DiskfilePath');
export type DiskfilePath = z.infer<typeof DiskfilePath>;

// simple string + brand (generic syntax, no runtime format check)
export const ResourceId = z.string().min(1).brand<'ResourceId'>();
export type ResourceId = z.infer<typeof ResourceId>;

export const FilePath = z.string().min(1).brand<'FilePath'>();
export type FilePath = z.infer<typeof FilePath>;
\`\`\`

Use branded types for values that should not be accidentally swapped. Dynamic
defaults use factory functions (\`Uuid.default(create_uuid)\`,
\`Datetime.default(get_datetime_now)\`). For TypeScript-only nominal typing without
runtime validation, see \`Flavored\` in ./type-utilities.

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
before: PreviousState.nullable().catch(null),  // tolerate older stored shapes
\`\`\`

## Field-Level Validation

Use \`.shape\` to validate individual fields without parsing the whole object:

\`\`\`typescript
// zzz/part.svelte.ts — reuse a base field's validator via \`.shape\`
// (here a subtype overrides the inherited default)
has_xml_tag: (PartJsonBase.shape.has_xml_tag.default(true),
	// or validate a single value against one field's schema
	PartJsonBase.shape.has_xml_tag.parse(value));
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

Where this stack reaches for them:

\`\`\`typescript
z.uuid() / z.iso.datetime()  // paired with .brand('Uuid') / .brand('Datetime')
z.coerce.number()            // string-to-number coercion (env vars)
z.toJSONSchema(schema)       // API surface snapshots
z.prettifyError(error)       // format ZodError for display (CLI args)
z.record(K, V)               // key-value maps (env vars, resource maps)
\`\`\`

- \`z.null()\` vs \`z.void()\` — \`z.null()\` for HTTP input (JSON \`null\`, e.g.
  \`input: z.null()\` for no request body in route specs); \`z.void()\` /
  \`z.void().optional()\` for action specs with no input or output value
- \`z.custom<T>(check?)\` — embeds complex types without full Zod validation;
  use sparingly (e.g., \`z.custom<z.ZodType>(...)\` in fuz_app action specs)
- \`z.instanceof(MyClass)\` — runtime class instance check; used in zzz so
  action specs can reference Cell instances as typed values

## Schema Introspection

When inspecting schema types at runtime, prefer \`instanceof\` checks and the
public \`.def\` property:

\`\`\`typescript
// instanceof — type detection without internal APIs
schema instanceof z.ZodNull;
schema instanceof z.ZodObject;
schema instanceof z.ZodArray;

// .def — public getter for the type definition (same as _zod.def)
const def = schema.def;
def.type; // 'string', 'object', 'null', etc.

// WRONG: ._zod.def — internal API, same value but not public
schema._zod.def; // works but prefer schema.def
\`\`\`

See \`@fuzdev/fuz_util/zod.ts\` for unwrapping utilities (\`zod_unwrap_def\`,
\`zod_get_base_type\`, \`zod_to_subschema\`, \`zod_get_innermost_type\`,
\`zod_unwrap_to_object\`) that handle wrappers like
optional, nullable, default, transform, and pipe; and object-field helpers
(\`zod_get_schema_keys\`, \`zod_get_field_schema\`, \`zod_maybe_get_field_schema\`).

## Unions and Enums

### Discriminated Unions

Use \`z.discriminatedUnion()\` when a type field determines the shape; members use
\`z.strictObject()\`:

\`\`\`typescript
// zzz/provider_types.ts — discriminate on \`available\`; members use strictObject
export const ProviderStatus = z.discriminatedUnion('available', [
	z.strictObject({ name: z.string(), available: z.literal(true), checked_at: z.number() }),
	z.strictObject({
		name: z.string(),
		available: z.literal(false),
		error: z.string(),
		checked_at: z.number()
	})
]);
export type ProviderStatus = z.infer<typeof ProviderStatus>;
\`\`\`

### Plain Unions

Use \`z.union()\` when there's no single discriminant field, or when mixing shapes
with literals:

\`\`\`typescript
// fuz_app http/jsonrpc.ts — multiple message shapes
export const JsonrpcMessage = z.union([
	JsonrpcRequest,
	JsonrpcNotification,
	JsonrpcResponse,
	JsonrpcErrorResponse
]);

// mixed literals + an object shape
export const Sort = z.union([
	z.literal('asc'),
	z.literal('desc'),
	z.strictObject({ by: z.string(), dir: z.enum(['asc', 'desc']) })
]);

// union with a literal \`false\` for opt-out
const sudo = z.union([z.enum(['nopasswd', 'password']), z.literal(false)]).optional();
\`\`\`

Prefer \`z.discriminatedUnion()\` when possible — it gives better error messages.

### Enums

\`\`\`typescript
export const ActionKind = z.enum(['request_response', 'remote_notification', 'local_call']);
export type ActionKind = z.infer<typeof ActionKind>;
\`\`\`

For extensible enums, use a factory that merges builtins with app-defined
entries and validates at construction time:

\`\`\`typescript
// fuz_app auth/role_schema.ts — builtin + app-defined roles
const { Role, role_specs } = create_role_schema(
	[{ name: 'teacher', description: '…', grant_paths: ['admin'] }], // ReadonlyArray<RoleSpec>
	{ credential_types, scope_kinds, grant_paths } // optional registries for cross-axis validation
);
// Role: z.ZodType<string> for I/O boundaries; role_specs: ReadonlyMap<string, RoleSpec>
\`\`\`

Construction throws on misconfiguration (invalid/duplicate names, builtin
collisions, unregistered cross-axis entries) — fail at server init, not at
request time.

## Schema Extension

\`.extend()\` adds or overrides fields, preserving strict mode:

\`\`\`typescript
// fuz_app/actions/action_spec.ts
export const ActionSpec = z.strictObject({
	method: z.string(),
	kind: ActionKind,
	input: z.custom<z.ZodType>((v) => v instanceof z.ZodType),
	output: z.custom<z.ZodType>((v) => v instanceof z.ZodType)
	// ...
});

export const RequestResponseActionSpec = ActionSpec.extend({
	kind: z.literal('request_response').default('request_response'),
	auth: RouteAuth, // four-axis {account, actor, roles?, credential_types?}
	async: z.literal(true).default(true)
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
  \`abstract class Cell<TSchema extends z.ZodType = z.ZodType>\` — validates
  internally with \`this.schema.parse()\`

## Metadata

\`.meta()\` attaches introspectable metadata. \`description\` powers CLI help;
other keys are domain-specific:

\`\`\`typescript
export const DeployArgs = z.strictObject({
	_: z.array(z.string()).max(0).default([]),
	dry: z.boolean().meta({ description: 'preview without deploying' }).default(false),
	branch: z
		.string()
		.meta({
			description: 'deploy branch',
			aliases: ['b']
		})
		.default('deploy')
});
\`\`\`

### Sensitivity Metadata (fuz_app)

\`SchemaFieldMeta\` (from \`@fuzdev/fuz_app/schema_meta.ts\`) extends \`.meta()\` with
a \`sensitivity\` key:

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

Use \`safeParse\` when invalid data is a normal condition needing a graceful
response:

\`\`\`typescript
// fuz_app/http/route_spec.ts — input validation middleware
const result = input_schema.safeParse(body);
if (!result.success) {
	// dev_only strips issue details from production responses (info leak)
	return c.json({ error: ERROR_INVALID_REQUEST_BODY, issues: dev_only(result.error.issues) }, 400);
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
RoleName.parse(name); // internal assertion
const args = RunApplyArgs.parse(raw_args); // CLI args
return PackageResource.parse({ type: 'package', ...config }); // factory function
const parsed = this.schema.parse(v); // Cell field update
\`\`\`

### safeParse with Custom Error Handling

\`safeParse\` + custom throw gives better error context than bare \`parse\`;
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

Prefer Zod 4's built-ins over hand-rolled formatters:

\`\`\`typescript
z.prettifyError(parsed.error); // multi-line, human-readable (CLI args, error display)
z.treeifyError(parsed.error); // nested structure mirroring the schema
z.flattenError(parsed.error); // {formErrors, fieldErrors} — flat, for forms
\`\`\`

## Quick Reference

| Convention                     | Correct                                                  | Wrong                                                    |
| ------------------------------ | -------------------------------------------------------- | -------------------------------------------------------- |
| Object schemas (internal)      | \`z.strictObject({...})\`                                  | \`z.object({...})\`                                        |
| Object schemas (external data) | \`z.looseObject({...})\` or \`z.object({...})\` with comment | \`z.strictObject({...})\`                                  |
| Response/error schemas         | \`z.looseObject({...})\` — tolerates added fields          | \`z.strictObject({...})\`                                  |
| Discriminated union members    | \`z.strictObject({type: z.literal('a'), ...})\`            | \`z.object({type: z.literal('a'), ...})\`                  |
| Descriptions                   | \`.meta({description: '...'})\`                            | \`.describe('...')\`                                       |
| Schema naming                  | \`const MyThing = z.strictObject(...)\`                    | \`const my_thing\`, \`const MyThingSchema\`                  |
| Type inference (output)        | \`type MyThing = z.infer<typeof MyThing>\`                 | separate name from schema                                |
| Type inference (input)         | \`type MyThingInput = z.input<typeof MyThing>\`            | manual partial types                                     |
| IDs and paths                  | \`z.string().brand('MyId')\`                               | plain \`z.string()\`                                       |
| HTTP/API input                 | \`schema.safeParse(data)\`                                 | \`schema.parse(data)\`                                     |
| CLI args/factories             | \`schema.parse(data)\`                                     | \`schema.safeParse(data)\` with unnecessary error handling |
| Env loading                    | \`safeParse\` + custom throw (better error context)        | bare \`parse\` (loses raw values)                          |
| Optional config files          | \`safeParse\` + return null                                | \`parse\` (crashes on missing file)                        |
| No input/output                | \`z.void()\` or \`z.void().optional()\`                      | \`z.undefined()\`, omitting the field                      |
| Optional reference             | \`Uuid.nullable().default(null)\`                          | \`Uuid.optional()\` (ambiguous undefined vs absent)        |
| Complex embedded types         | \`z.custom<MyType>()\`                                     | hand-rolled validation                                   |
| Key-value maps                 | \`z.record(z.string(), ValueSchema)\`                      | \`z.strictObject\` with dynamic keys                       |
`}];export{n as a,e as s};
