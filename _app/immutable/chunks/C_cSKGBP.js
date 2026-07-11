const e={content:"# Fuz stack conventions\n\n> **Pre-alpha**: Conventions are actively evolving. When code or a project's\n> CLAUDE.md conflicts with this skill, the code is ground truth.\n>\n> **À la carte**: Each project adopts only what serves it. Deep imports and\n> the flat namespace make this natural at the package level too.\n\n> **Skip for**: planning/lore-only edits, third-party code review, simple\n> git/shell operations. Repo `CLAUDE.md` is authoritative for\n> project-specific patterns — this skill covers shared conventions across\n> TypeScript, Svelte, and Rust crates.\n\n## Why These Conventions\n\nThe Fuz stack is designed so the full software lifecycle — produce, deploy,\noperate — is accessible to anyone with intent and an AI partner. These\nconventions serve that goal: consistent, self-describing patterns that AI\nagents can learn once and apply everywhere. snake_case aligns TS, Rust, and\nSQL with zero renaming. Zod schemas are the single source of truth for shape,\ntypes, defaults, and validation. The Cell pattern gives every piece of state\nthe same structure. When conventions are this consistent, AI can reliably\nbridge the gap between a person's intent and the stack's implementation.\n\nThe stack composes: `fuz_util → gro + fuz_css → mdz → fuz_ui → fuz_app → apps`,\nwith `fuz_app` the shared backend spine (auth, sessions, DB, SSE) — a chain hop\nfor apps as well as the spine. zzz (the garage) and zap (machine-state\nconvergence) build on the same primitives. Understanding one part transfers to\nunderstanding the others.\n\n## Package Ecosystem\n\n`@fuzdev/*` packages draw from these conventions. Each package's `CLAUDE.md`\nis authoritative for what it actually uses.\n\n| Package        | Description                                                                        |\n| -------------- | ---------------------------------------------------------------------------------- |\n| `fuz_util`     | foundation utilities (zero deps) — hashing, async, schemas, types                  |\n| `gro`          | task runner and toolkit extending SvelteKit (web-dev surface; internals adopting Rust)|\n| `fuz_css`      | CSS framework and design system — apps look good by default                        |\n| `mdz`          | minimal markdown dialect — parser, renderer, Svelte preprocessor                   |\n| `fuz_ui`       | Svelte 5 components — themes, layouts, overlays, auto-docs                         |\n| `fuz_app`      | stack spine — auth, sessions, DB, SSE, route specs, CLI/daemon                     |\n| `fuz_docs`     | experimental AI-generated docs and skills for Fuz                                  |\n| `fuz_template` | a static web app template built with the fuz stack                                 |\n| `fuz_code`     | syntax styling utilities and components for TypeScript, Svelte, Markdown, and more |\n| `fuz_blog`     | blog software from scratch with SvelteKit                                          |\n| `fuz_mastodon` | Mastodon components and helpers for Svelte, SvelteKit, and Fuz                     |\n| `fuz_gitops`   | a tool for managing many repos                                                     |\n| `blake3`       | BLAKE3 hashing compiled to WASM (`@fuzdev/blake3_wasm` + `blake3_wasm_small`)      |\n| `zzz`          | software garage — produce software with AI assistance                              |\n| `zap`          | convergence — deploy and operate infrastructure                                    |\n\n`gro` is a durable web-focused dev tool; its internals progressively adopt Rust (tsv, then `fuz` crates), and it stays complementary to `fuz` and `zap`.\n\n**Dependency flow**: `fuz_util → gro + fuz_css → mdz → fuz_ui → fuz_app → zzz, apps`\n(zap sits beside this chain: its site/authoring surface builds on fuz_ui, and\nits Rust engine is spine-free — it consumes neither fuz_app nor the spine crates)\n\n**Adding deps**: prefer the approved allowlists (./references/npm-dependencies,\n./references/rust-dependencies). Adding or upgrading needs approval; removing\nan unused dep is pre-authorized.\n\n## Coding Conventions\n\n### Naming - snake_case + PascalCase\n\n```typescript\n// Functions and variables - snake_case\n// applies equally to function declarations and arrow function exports\nconst format_bytes = (n: number): string => { ... };\nexport const git_current_branch_name = async (): Promise<GitBranch> => { ... };\nexport function create_context<T>(fallback?: () => T) { ... }\nconst user_data: Record<string, unknown> = {};\n\n// Types, classes, components - PascalCase\ntype PackageJson = {};\nclass DocsLinks {}\n// file: src/lib/DocsLink.svelte\n```\n\n**NOT** camelCase for functions/variables. Intentional divergence:\n\n- **Cross-language alignment** — same identifiers in TS, Rust, and SQL with\n  zero renaming cost (`keyed_hash`, `get_user_sessions`, `git_push`).\n- **Legibility** — underscores as explicit word boundaries:\n  `package_json_load` vs `packageJsonLoad`.\n\n**External APIs keep their native casing.** `.map()`, `addEventListener()`,\n`initSync` — only identifiers you define follow snake_case.\n\n```typescript\n// Constants - SCREAMING_SNAKE_CASE\nconst DEFAULT_TIMEOUT = 5000;\nconst GITOPS_CONFIG_PATH_DEFAULT = 'gitops.config.ts';\n```\n\n### Naming Patterns\n\nTwo forms, chosen by **disambiguation** in the flat namespace:\n\n**Domain-prefix** (`domain_action`) — when the bare action name would be\nambiguous:\n\n```typescript\ngit_push(); // git_* cluster (fuz_util/git.ts)\ngit_fetch(); // \"push\"/\"fetch\" alone are ambiguous\ntime_format(); // time_* cluster (fuz_util/time.ts)\ncontextmenu_open(); // contextmenu_* cluster (fuz_ui)\npackage_json_load(); // package_json_* cluster (gro)\n```\n\n**Action-first** (`action_domain`) — when already self-descriptive:\n\n```typescript\ntruncate(); // standalone (fuz_util/string.ts)\nstrip_start(); // action is the concept (fuz_util/string.ts)\nescape_js_string(); // action with domain qualifier (fuz_util/string.ts)\nshould_exclude_path(); // predicate form (fuz_util/path.ts)\nto_file_path(); // conversion (fuz_util/path.ts)\n```\n\n| Pattern               | Example                | Use Case                        |\n| --------------------- | ---------------------- | ------------------------------- |\n| `domain_action`       | `git_push`             | Disambiguates in flat namespace |\n| `domain_is_adjective` | `module_is_typescript` | Boolean in a domain cluster     |\n| `to_target`           | `to_file_path`         | Conversions                     |\n| `format_target`       | `format_number`        | Formatting                      |\n| `action_domain`       | `escape_js_string`     | Self-descriptive utilities      |\n| `create_domain`       | `create_context`       | Factory functions               |\n\n**Rule of thumb**: domain-prefix when the bare name is ambiguous (`git_push`\nnot `push`); action-first when self-descriptive (`truncate`, `strip_start`).\nFile names often signal which: `git.ts` → `git_*`, `string.ts` → action-first.\n\n**Action verbs**: `parse`, `create`, `get`, `to`, `is`, `has`, `format`,\n`render`, `analyze`, `extract`, `load`, `save`, `escape`, `strip`, `ensure`,\n`validate`, `should`\n\n### Flat Namespace - Fail Fast\n\nAll exported identifiers must have **unique names across all modules**:\n\n- The `svelte-docinfo` analysis detects duplicate export names across modules\n  in the flat namespace\n- Error shows all conflicts with module paths and kinds\n- Resolution: rename one following the domain_action pattern, or add\n  `/** @nodocs */` to exclude from validation\n- **Which side to rename** — rename the side that is _not_ the primary\n  public API. `@nodocs` is the wrong tool when external consumers depend\n  on the hidden symbol (it vanishes from docs and tomes).\n  - Component is primary (class is a state/helper): suffix the class with\n    `State` / `Info`. Example: `DocsLink` interface → `DocsLinkInfo` when\n    it conflicts with `DocsLink.svelte`. Precedent: `ThemeState`,\n    `AuthState`, `SidebarState`.\n  - Class is primary (stateful with methods/lifecycle, consumers\n    instantiate it): suffix the component with `View` / `Pane`. Example:\n    `MusicPlayer` class kept, component renamed to `MusicPlayerView.svelte`.\n\n### File Organization\n\n- **`src/lib/`** — exportable library code: `PascalCase.svelte` components,\n  `*.ts` utilities, `*.svelte.ts` runes/reactive code, `*.gen.ts` generated files\n- **`src/test/`** — tests (NOT co-located), mirroring `lib/` structure\n- **`src/routes/`** — SvelteKit routes (if applicable)\n- **No barrels** — import every module by full path (`@fuzdev/fuz_app/env/load.ts`);\n  package `exports` use wildcards so each module is importable\n- **Subdirectories** — group a domain into `lib/domain/` at 3+ related files;\n  a lone file stays at `lib/` root. Tests mirror the subdir structure.\n\nSee ./references/file-organization for the full tree, domain examples, and\nimport/test-mirroring details.\n\n### Code Style\n\n- **TypeScript**: Strict mode, explicit types\n- **Svelte**: Svelte 5 with runes API ($state, $derived, $effect)\n- **Formatting**: tsv with tabs, 100 char width\n- **Extensions**: Use the real source extension in imports — `.ts` /\n  `.svelte.ts` (not the old `.js`-for-a-`.ts`-file form): `import {foo} from\n  './bar.ts'`. Cross-package `@fuzdev/pkg/foo.ts` resolves via the package's\n  `exports` `.js`/`.ts` mirror; the build rewrites relative `.ts`→`.js` into\n  `dist`. `.svelte` component imports stay `.svelte`. Library code (`src/lib`)\n  imports relative; everything else (`src/routes`, `src/test`) uses the\n  `#lib`/`#routes` package.json subpath imports with the `.ts` extension\n  (`#lib/db/db.ts`). See ./references/path-references §5.\n- **Comments**:\n  - JSDoc (`/** ... */`) = proper sentences with periods\n  - Inline (`//`) = fragments, no capital or period\n- **No backwards compatibility**: Delete unused code, rename directly, no\n  deprecated stubs or shims. Document breaking changes in changesets.\n\n## Gro Commands (Web-Dev Tool)\n\n**IMPORTANT**: Gro is installed globally — always run `gro` directly, never\n`npx gro`.\n\n**Development:**\n\n```bash\ngro test         # run vitest tests\ngro gen          # run code generators (*.gen.ts files)\ngro format       # format with tsv\ngro lint         # run ESLint\ngro typecheck    # run TypeScript type checking\n```\n\n**Production:**\n\n```bash\ngro build        # production build (runs plugin lifecycle)\ngro check        # ALL checks: test + gen --check + format --check + lint + typecheck\ngro publish      # version with Changesets, publish to npm, push to git\ngro deploy       # build and force push to deploy branch\ngro release      # combined publish + deploy workflow\n```\n\n**Utilities:** `gro sync` (gen + update exports), `gro run file.ts` (execute\nTS), `gro changeset` (create changeset). `SKIP_EXAMPLE_TESTS=1 gro test`\nskips slow example tests in repos that support the flag (fuz_css; not\nsvelte-docinfo, whose example tests gate on `npm run build` +\n`npm run setup-examples` instead — see ./references/testing-patterns).\n\n**Key behaviors:** `gro check` is the CI command. `gro gen --check` verifies\nno drift. Tasks are overridable: local `src/lib/foo.task.ts` overrides\n`gro/dist/foo.task.js`; call builtin with `gro gro/foo`.\n\n**Never run `gro dev` or `npm run dev`** — user manages the dev server.\n\n## Code Generation\n\nGen files (`*.gen.ts`) export a `gen` function, discovered by the `.gen.`\npattern in filenames. Naming: `foo.gen.ts` → `foo.ts`, `foo.gen.css.ts` →\n`foo.css`. Return `string`, `{content, filename?, format?}`, `Array`, or\n`null`.\n\nCommon gen pattern: `theme.gen.css.ts` (theme CSS from style variables).\nTwo outputs that used to be gen tasks no longer are: fuz_css utility classes\ncome from the `vite_plugin_fuz_css` Vite plugin (the `virtual:fuz.css` module),\nand library/API metadata comes from the `svelte-docinfo` Vite plugin — so most\nprojects run `gro gen` rarely, if ever.\n\nSee ./references/code-generation for the full API, dependencies, and\nexamples.\n\n## TSDoc/JSDoc Conventions\n\nSee ./references/tsdoc-comments for the full tag guide, documentation\npatterns, and drift-detection guidance.\n\n**Key rules:**\n\n- Main description: complete sentences ending in a period\n- `@param name - description`: hyphen separator; single-sentence: lowercase, no\n  period; multi-sentence: capitalize, end with period\n- `@returns` (not `@return`): same single/multi-sentence rule as `@param`\n- `@module`: complex modules get a module-level doc comment with `@module` at end\n- `@mutates target - description`: document parameter/state mutations\n  (also `` @mutates `target` `` for self-evident mutations)\n- `@nodocs`: exclude from docs and flat namespace validation\n- Wrap identifier references in backticks for auto-linking via `mdz`\n\n**Tag order**: description → `@param` → `@returns` → `@mutates` → `@throws` →\n`@example` → `@deprecated` → `@see` → `@since` → `@default` → `@nodocs`\n\n## Svelte 5 Patterns\n\nSee ./references/svelte-patterns for `$state.raw()`, `$derived.by()`,\nreactive collections (SvelteMap/SvelteSet), schema-driven reactive classes,\nsnippets, effects, attachments, props, event handling, component composition,\nand legacy features to avoid.\n\n### Runes API\n\n`$state.raw()` by default for all reactive state. `$state()` only for\narrays/objects mutated in place (push, splice, index assignment). `$derived`\nfor computed values, `$effect` for side effects.\n\n### Context Pattern\n\nStandardized via `create_context<T>()` from\n`@fuzdev/fuz_ui/context_helpers.ts`. Common contexts: `theme_state_context`\n(theme), `library_context` (package API metadata), `tome_context` (current\ndoc page).\n\n## Documentation System\n\nProjects use **tomes** (not \"stories\") with auto-generated API docs.\n\n**Pipeline**: source files → `svelte-docinfo` Vite plugin →\n`virtual:svelte-docinfo` → `library_json_from_modules()` → `Library` class → Tome\npages + API routes.\n\nSee ./references/documentation-system for setup, the full pipeline, Tome\nsystem, layout architecture, and component reference. TSDoc authoring\nconventions: ./references/tsdoc-comments.\n\n## mdz - Strict Markdown Dialect\n\n`mdz` (`@fuzdev/mdz/mdz.ts`) is the Fuz markdown dialect — a small, unambiguous\ngrammar, **not a CommonMark/GFM superset** (ambiguous input stays literal text).\nfuz_ui renders TSDoc prose through it, injecting `DocsLink` (inline code) and\nfuz_code's `Code` (code blocks) via its rendering seam; backticked identifiers\nthat resolve to API symbols become links.\n\nSupports code, bold/italic/strike (double delimiters only; intraword `_` stays\nliteral so `snake_case` renders verbatim), links, headings, lists, blockquotes,\ncode blocks, tables, horizontal rules, and registered components/elements.\n\n```svelte\n<Mdz content=\"Some **bold** and `code` text.\" />\n```\n\nRegistration and rendering happen through getter contexts in\n`@fuzdev/mdz/mdz_contexts.ts` (`mdz_components_context`, `mdz_elements_context`,\n`mdz_code_context`, `mdz_codeblock_context`). The full per-feature syntax table,\ndialect surface, injection seam, backtick autolinking, and the\n`svelte_preprocess_mdz` build-time preprocessor: ./references/mdz.\n\n### Path references\n\nForms by typography:\n\n- **Navigational paths** — bare, no backticks (`./foo`, `../foo`, `~/dev/foo`)\n  for files referenced by location; mdz auto-linkifies `./`/`../` after whitespace.\n  A bare path is a promise it **resolves on disk** — backtick an illustrative or\n  conceptual path (`` `./build/` ``) as the escape hatch\n- **src/lib module references** — backticked, src/lib-relative with **no** leading\n  `./`, `../`, or redundant `src/lib/` prefix (e.g. \"`auth/account_schema.ts`\");\n  the backticks frame a module identifier, so traversal/prefix contradicts the framing\n- **Cross-repo references** — bare `../other-repo/...` for navigation, or the\n  `@scope/pkg/foo.ts` import specifier for a module's identity; the backticked\n  src/lib form is same-repo only, and TSDoc must not point outside its own repo\n- **Code-shaped non-paths** — backticks for CLI commands (`gro check`),\n  top-level files (`package.json`), and config identifiers (`~/.fuz/`)\n\nSee ./references/path-references for all forms in full, the web-rendered\ncaveat, anti-patterns, and formatter cautions.\n\n## Testing\n\nTests live in `src/test/` (NOT co-located). Use `assert` from vitest —\nchoose methods for TypeScript type narrowing, not semantic precision.\n`assert(x instanceof Error)` narrows the type;\n`expect(x).toBeInstanceOf(Error)` does not. Name custom assertion helpers\n`assert_*` (not `expect_*`).\n\nUse `describe` blocks to organize tests — one or two levels deep is typical.\nUse `test()` (not `it()`).\n\nSplit large suites with dot-separated aspects: `{module}.{aspect}.test.ts`\n(e.g., `csp.core.test.ts`, `csp.security.test.ts`). Database tests use\n`.db.test.ts` suffix to opt into shared PGlite WASM via vitest `projects`\n(see ./references/testing-patterns).\n\nFor parsers and transformers, use fixture-based testing: input files in\n`src/test/fixtures/<feature>/<case>/`, regenerate `expected.json` via\n`gro src/test/fixtures/<feature>/update`. **Never manually edit\n`expected.json`** — always regenerate via task.\n\nSee ./references/testing-patterns for file organization, test helpers,\nshared test factories, mock factories, fixture workflow, database testing,\nenvironment flags, and test structure.\n\n## TODOs\n\nLeave **copious** `// TODO:` comments in code — they're expected and encouraged\nfor visibility into known future work, not debt to hide.\n\nFor multi-session work, create `TODO_*.md` files in the project root with\nstatus, next steps, and decisions. Delete when complete. **Update before ending\na session.**\n\n## Custom Tasks\n\nSee ./references/task-patterns for the Task interface, Zod-based Args,\nTaskContext, error handling, override patterns, and task composition.\n\n## fuz_css\n\nSee ./references/css-patterns for setup, variables, composites, modifiers,\nextraction, and dynamic theming.\n\n**Default styling is the baseline — justify every deviation.** fuz_css styles\nsemantic HTML by default (buttons, inputs, headings, links, lists, code, tables,\n`<aside>`, `<blockquote>`, `<details>`, `<small>`, `<kbd>`, …) via\nlow-specificity `:where()` selectors, and block elements space themselves via\nthe **flow-margin** system — so most content needs zero classes. The most common\nmistake is hand-adding `mb_*`/`gap_*`/`p_*` where flow margin already spaces, or\nre-declaring color/font the element already carries. Before any class or\n`<style>`, ask what specific gap in the defaults it closes — most app files have\nno `<style>` block at all.\n\n```svelte\n<!-- BAD: these classes fight defaults the elements already have -->\n<section>\n	<h2 class=\"mb_md\">{title}</h2>  <!-- headings already carry flow margin -->\n	<p class=\"mb_md\">{body}</p>      <!-- so do paragraphs -->\n</section>\n\n<!-- GOOD: correct vertical rhythm with zero classes -->\n<section>\n	<h2>{title}</h2>\n	<p>{body}</p>\n</section>\n```\n\n**Styling ladder** — stop at the first rung that suffices:\n\n1. Semantic HTML (right element, no class)\n2. Built-in conventions (`.selected`, `.color_a`–`.color_j`, `.inline`, `.unstyled`)\n3. Composite classes (`row`, `column`, `box`, `panel`, `chip`, `ellipsis`)\n4. Token classes (`p_md`, `gap_lg`, `color_a_50`) — spacing tokens are the most-used family\n5. Literal classes (`display:flex`, `width:100%`, `hover:opacity:80%`)\n6. `<style>` block with design tokens\n\nRungs 3–5 are one tier in practice — mix freely (a composite when one exactly\nmatches, else tokens/literals); literal flex classes are common, not a rare last\nresort. The real cut points are semantic-vs-class and classes-vs-`<style>`. Don't\nchurn existing `<style>` blocks into long class strings (4–6 classes is the\ncomfortable ceiling). See css-patterns.md §Default styling is the baseline.\n\n**Class naming**: fuz_css tokens use `snake_case` (`p_md`, `gap_lg`);\ncomponent-local classes use `kebab-case` (`site-header`) — the target convention,\nadopted in zzz and fuz_ui.\n\n### Architecture and classes\n\n- **Three layers** — semantic element defaults (`style.css`), design tokens as\n  CSS custom properties (`theme.css`), and per-project utility classes\n  (`virtual:fuz.css`, only used classes emitted). See css-patterns.md §Style\n  Variables (Design Tokens) and §Utility Classes.\n- **Class families** — token classes (`.p_md`, `.color_a_50`) map to variables,\n  composite classes (`.box`, `.row`; size composites `xs`–`xl` rescale a subtree)\n  are multi-property shortcuts, literal classes (`.display:flex`) are arbitrary\n  `property:value`. Static-extraction comment hints (`// @fuz-classes …`) are\n  rarely needed — see css-patterns.md §Comment hints for the dynamic cases.\n- **Classes vs `<style>`** — utility classes for your own and child elements;\n  `<style>` for hover/focus/responsive; inline `style:` only for runtime dynamic\n  values. Full matrix: css-patterns.md §When to Use Classes vs Styles.\n\n## Dependency Injection\n\n**Small standalone `*Deps` interfaces, composed bottom-up.** Leaf functions\nimport small interfaces directly (not `Pick<Composite>`).\n\n- **Three suffixes** — `*Deps` (capabilities/functions, fresh mock factories per\n  test), `*Options` (data/config values, literal objects), `*Context` (scoped\n  world for a callback/handler). No `*Config` suffix — use `*Options`. `*Deps`\n  names the injected bundle; single-capability service interfaces keep pure-noun\n  names (`Keyring`, `FactStore`).\n- **File shape** — `deps.ts` + `deps_defaults.ts` + test-side `mock_deps.ts`\n  (fuz_css is the cleanest exemplar). fuz_gitops's `*Operations` spelling is\n  legacy, migrating to `*Deps` — never author new `*Operations`.\n- **AppDeps** — stateless capabilities bundle for server code (fuz_app),\n  assembled once at a two-step composition root.\n- **RuntimeDeps** — composable small `*Deps` interfaces for runtime operations\n  (env, fs, commands), with platform-specific factories (Deno, Node, mock).\n  Browser/UI DI is Svelte context, not `*Deps` params.\n- **Design principles** — single `options` object params in L1 domain deps,\n  `Result` returns with typed error kinds (L0 platform shims mirror the\n  platform and throw), plain object mocks (no mocking libs), throwing stubs\n  over silent no-ops, stateless capabilities, runtime agnosticism.\n\nSee ./references/dependency-injection for the full pattern guide, naming\nconventions, consumption patterns, RuntimeDeps, and mock factories.\n\n## Common Utilities\n\n`@fuzdev/fuz_util` provides shared utilities:\n\n- **Result type** — `Result<TValue, TError>` discriminated union for error\n  handling without exceptions. Properties go directly on the result object via\n  intersection: `({ok: true} & TValue) | ({ok: false} & TError)`.\n- **`to_error_message`** — `to_error_message(value, fallback?)` from\n  `@fuzdev/fuz_util/error.ts` normalizes an unknown caught value to a string\n  (`value.message` for `Error`, else `fallback ?? String(value)`)\n- **Logger** — hierarchical logging via `new Logger('module')`, controlled by\n  `PUBLIC_LOG_LEVEL` env var\n- **Timings** — performance measurement via `timings.start('operation')`\n- **DAG execution** — `run_dag()` for concurrent dependency graphs\n- **Async concurrency** — `each_concurrent`, `map_concurrent`,\n  `map_concurrent_settled`, `AsyncSemaphore`, `Deferred`\n- **Type utilities** — `Flavored`/`Branded` nominal typing, `OmitStrict`,\n  `PickUnion`, selective partials\n\nSee ./references/common-utilities for Result patterns, Logger configuration,\nand Timings usage. See ./references/async-patterns for concurrency\nprimitives. See ./references/type-utilities for the full type API.\n\n## Zod Schemas\n\nZod schemas are source of truth for JSON shape, TypeScript type, defaults,\nmetadata, CLI help text, and serialization. Schema changes cascade through the\nstack; treat them as critical review points.\n\n- **`z.strictObject()`** — default for all object schemas. `z.looseObject()`\n  or `z.object()` for external/third-party data with a comment explaining why.\n- **PascalCase naming** — schema and type share the same name, no suffix:\n  `const Foo = z.strictObject({...}); type Foo = z.infer<typeof Foo>;`\n- **`.meta({description: '...'})`** — not `.describe()`. Both work in Zod 4\n  but `.meta()` is the convention and supports additional keys.\n- **`.brand()` for validated nominal types** — `Uuid`, `Datetime`, `DiskfilePath`\n- **`safeParse` at boundaries** — graceful errors for external input.\n  `parse` for internal assertions.\n\nSee ./references/zod-schemas for branded types, transform pipelines,\ndiscriminated unions, route specs, schemas as runtime data, instance schemas\n(zzz Cell), and introspection.\n\n## Rust Crates\n\nThe ecosystem's Rust workspaces (the `fuz`/`fuzd` CLI + daemon, the spine\ncrates consumed by `zzz_server`/`fuz_forge_server`, the `zap` convergence\nengine, the `blake3`/`tsv` bindings) share a distinct set of conventions from\nthe TS/Svelte side. snake_case carries over for cross-language alignment, but\nRust solves with the type system + crate graph what TS solves with `*Deps`\ninjection. These references own *conventions and patterns* — adoptable by any\nRust workspace, including new/external ones, with ecosystem repos as\nexemplars; each repo's `CLAUDE.md` owns its inventory (crates, commands, env\nvars). Five references, loaded on demand:\n\n- **./references/rust-patterns** — the new-workspace checklist, strict\n  lints (`unsafe_code = \"forbid\"`, pedantic + nursery + restriction lints;\n  the crate-override re-declare trap), release profile, `thiserror` error\n  taxonomy + `.hint()`/`.exit_code()` helpers and classifiers, graceful\n  shutdown, the DI escalation ladder\n  (`*Options`/boxed-closure-factories/capability-traits/enum-dispatch-before-`dyn`/RPITIT), the\n  make-impossible-states-unrepresentable idiom (zap_types is the reference),\n  CLI/exit-code patterns, and shared patterns (sandboxed eval, transactional\n  state files, CAS, bounded reads, type state, secret masking).\n- **./references/rust-spine** — the spine crate map, consumer-server\n  contracts (`run_app`, `RunAppOptions`, the `testing_*` sibling binary),\n  the `fuz_http` JSON-RPC envelope, env loading, daemon lifecycle by\n  transport, and `fuz_audit` check-release + crate-layering rules.\n- **./references/rust-perf** — profiling, arenas (`bumpalo` in tsv),\n  lock hygiene, hot-path idioms, the `unsafe` escape hatch, and what's out\n  of scope.\n- **./references/rust-dependencies** — the approved external-crate allowlist\n  and the crate-vs-cargo-feature supply-chain isolation technique.\n- **./references/twin-impl** — the TS ↔ Rust twin-implementation\n  architecture: convergence discipline, identifier-level naming parity, the\n  cross-backend harness, wire crates, and serialization parity rules.\n\nWASM, C-FFI, and N-API binding crates additionally follow\n./references/wasm-patterns. Each Rust repo's `CLAUDE.md` is authoritative\nfor project-specific conventions; these cover the shared patterns across\nworkspaces.\n"},n=[{slug:"async-patterns",title:"Async Patterns",content:`# Async Patterns

Async concurrency utilities in \`@fuzdev/fuz_util/async.ts\` and
\`@fuzdev/fuz_util/dag.ts\` — controlled concurrency for file I/O, network
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

### When to use Deferred

- Coordinating between independent async flows (e.g., DAG node dependencies)
- Bridging callback-based APIs with promise-based code
- Signaling completion from one context to waiters in another

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

**Fail-fast**: On first rejection, stops spawning new workers and rejects;
with \`signal\`, aborts immediately.

### map_concurrent

Like \`each_concurrent\`, collecting results in input order:

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
import {run_dag, type DagNode} from '@fuzdev/fuz_util/dag.ts';

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

\`Sortable\` is from \`@fuzdev/fuz_util/sort.ts\` (topological sort validation).

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

## Quick Reference

| Export                   | Module     | Type      | Purpose                                        |
| ------------------------ | ---------- | --------- | ---------------------------------------------- |
| \`AsyncStatus\`            | \`async.ts\` | Type      | Lifecycle status for async operations          |
| \`wait\`                   | \`async.ts\` | Function  | Promise-based delay                            |
| \`is_promise\`             | \`async.ts\` | Function  | Type guard for Promise/thenable                |
| \`Deferred<T>\`            | \`async.ts\` | Interface | Promise with external resolve/reject           |
| \`create_deferred\`        | \`async.ts\` | Function  | Creates a Deferred                             |
| \`each_concurrent\`        | \`async.ts\` | Function  | Concurrent side effects, fail-fast             |
| \`map_concurrent\`         | \`async.ts\` | Function  | Concurrent map with ordered results, fail-fast |
| \`map_concurrent_settled\` | \`async.ts\` | Function  | Concurrent map, allSettled pattern             |
| \`AsyncSemaphore\`         | \`async.ts\` | Class     | Concurrency limiter with acquire/release       |
| \`run_dag\`                | \`dag.ts\`   | Function  | Concurrent DAG executor                        |
| \`DagNode\`                | \`dag.ts\`   | Interface | Minimum shape for a DAG node                   |
| \`DagOptions\`             | \`dag.ts\`   | Interface | Options for \`run_dag\`                          |
| \`DagResult\`              | \`dag.ts\`   | Interface | Aggregated DAG execution result                |
| \`DagNodeResult\`          | \`dag.ts\`   | Interface | Per-node execution result                      |
`},{slug:"code-generation",title:"Code Generation",content:"# Code Generation\n\nGro's code generation system (`.gen.*` files) in `@fuzdev/gro`.\n\nGen files produce source code at build time. Discovered by the `.gen.`\nfilename pattern, executed by `gro gen`, output committed alongside source.\n`gro gen --check` verifies no drift.\n\n## File Naming\n\nOutput file is produced by dropping the `.gen.` segment:\n\n| Gen file                          | Output file                |\n| --------------------------------- | -------------------------- |\n| `theme.gen.css.ts`                | `theme.css`                |\n| `css_classes_fixture.gen.json.ts` | `css_classes_fixture.json` |\n| `README.gen.md.ts`                | `README.md`                |\n| `auth_attack_surface.gen.json.ts` | `auth_attack_surface.json` |\n\nThe gen source file always has a `.ts` extension (`.gen.ts`, `.gen.css.ts`, …).\nAn optional extension between `.gen.` and `.ts` overrides the output extension.\n\n### Naming rules\n\n- Exactly one `.gen.` segment per filename (duplicates are invalid)\n- At most one extension after `.gen.` (`.gen.css.ts` is valid, `.gen.foo.bar.ts` is not)\n- Output filename cannot equal the gen filename\n\n## Gen Types\n\nA gen file exports a `gen` value — either a function or a config object:\n\n```typescript\ntype Gen = GenFunction | GenConfig;\n```\n\nBoth importable from `@fuzdev/gro` or `@fuzdev/gro/gen.ts`.\n\n### GenFunction (simple form)\n\n```typescript\ntype GenFunction = (ctx: GenContext) => RawGenResult | Promise<RawGenResult>;\n```\n\n```typescript\n// theme.gen.css.ts — simple form\nimport type {Gen} from '@fuzdev/gro';\n\nexport const gen: Gen = ({origin_path}) => {\n	const banner = `/* generated by ${origin_path} */`;\n	return `${banner}\\n:root { --my-var: 1; }\\n`;\n};\n```\n\n### GenConfig (with dependencies)\n\n```typescript\ninterface GenConfig {\n	generate: GenFunction;\n	dependencies?: GenDependencies;\n}\n```\n\n```typescript\n// highlight_priorities.gen.ts — config form with dependencies\nimport type {Gen} from '@fuzdev/gro';\n\nexport const gen: Gen = {\n	generate: ({origin_path}) => {\n		return `// generated by ${origin_path}\\nexport const data = {};\\n`;\n	},\n	dependencies: {files: ['src/lib/theme_highlight.css']},\n};\n```\n\n## GenContext\n\n| Property          | Type                  | Description                                                     |\n| ----------------- | --------------------- | --------------------------------------------------------------- |\n| `origin_id`       | `PathId`              | absolute path of the gen file                                   |\n| `origin_path`     | `string`              | `origin_id` relative to the project root                        |\n| `config`          | `GroConfig`           | the project's Gro configuration                                 |\n| `svelte_config`   | `ParsedSvelteConfig`  | parsed svelte.config.js                                         |\n| `filer`           | `Filer`               | filesystem tracker (file contents, dependency graph)            |\n| `log`             | `Logger`              | scoped logger                                                   |\n| `timings`         | `Timings`             | performance measurement                                         |\n| `invoke_task`     | `InvokeTask`          | invoke other Gro tasks                                          |\n| `changed_file_id` | `PathId \\| undefined` | set during dependency resolution; `undefined` during generation |\n\nMost used: `origin_path` (generated-by banners), `log`, and `filer`\n(reading source files).\n\n## Return Values\n\n```typescript\ntype RawGenResult = string | RawGenFile | null | Array<RawGenResult>;\n```\n\n### String — single file with default name\n\n```typescript\nexport const gen: Gen = () => {\n	return '// generated content\\n';\n};\n// theme.gen.css.ts → writes theme.css\n```\n\n### RawGenFile — single file with options\n\n```typescript\ninterface RawGenFile {\n	content: string;\n	filename?: string; // override output name (can be relative or absolute path)\n	format?: boolean; // run the formatter (default: true)\n}\n```\n\n```typescript\nexport const gen: Gen = () => {\n	return {content: '{\"key\": \"value\"}', filename: 'data.json', format: false};\n};\n```\n\nRelative `filename` resolves from the gen file's directory. Absolute paths\nwrite to that exact location (e.g., `blog.gen.ts` writes `static/blog/feed.xml`).\n\n### null — skip generation\n\n```typescript\nexport const gen: Gen = (ctx) => {\n	if (some_condition) return null; // produce no output\n	return 'content';\n};\n```\n\n### Array — multiple output files\n\nNested arrays are flattened:\n\n```typescript\nexport const gen: Gen = () => {\n	return [\n		{content: 'export const A = 1;', filename: 'a.ts'},\n		{content: 'export const B = 2;', filename: 'b.ts'},\n	];\n};\n```\n\nDuplicate output file IDs within a single gen file are invalid. A single gen\nfile can produce many output files — e.g., `skill_docs.gen.ts` generates a\nmanifest, per-skill data files, and per-page `+page.svelte` routes.\n\n## Dependencies\n\nControl when a gen file re-runs during watch mode. Without `dependencies`, it\nre-runs only when the gen file or its imports change (tracked by filer). Use\n`GenConfig` for broader triggers:\n\n```typescript\ntype GenDependencies = 'all' | GenDependenciesConfig | GenDependenciesResolver;\n```\n\n### 'all' — re-run on any change\n\nFor gen tasks that depend on the entire source tree rather than specific files:\n\n```typescript\nexport const gen: Gen = {\n	generate: async (ctx) => {\n		/* ... */\n	},\n	dependencies: 'all',\n};\n```\n\n### Config — patterns and files\n\n```typescript\nexport const gen: Gen = {\n	generate: ({origin_path}) => {\n		/* ... */\n	},\n	dependencies: {\n		patterns: [/\\.svelte$/, /\\.ts$/],\n		files: ['src/lib/theme_highlight.css'],\n	},\n};\n```\n\n`patterns` are tested against absolute paths. `files` can be relative\n(resolved to absolute) or absolute.\n\n### Function — dynamic resolution\n\nReceives `GenContext` and returns a config, `'all'`, or `null`.\n`changed_file_id` is set on context during dependency resolution:\n\n```typescript\ntype GenDependenciesResolver = (\n	ctx: GenContext,\n) => GenDependenciesConfig | 'all' | null | Promise<GenDependenciesConfig | 'all' | null>;\n```\n\n## CLI Usage\n\n```bash\ngro gen              # run all gen files in src/\ngro gen src/lib/     # run gen files in a specific directory\ngro gen src/lib/foo.gen.ts  # run a specific gen file\ngro gen --check      # verify no drift (used by gro check and CI)\n```\n\n| Arg           | Default           | Description                                      |\n| ------------- | ----------------- | ------------------------------------------------ |\n| `_`           | `['src']`         | input paths (files or directories to scan)       |\n| `--root_dirs` | `[process.cwd()]` | root directories to resolve input paths against  |\n| `--check`     | `false`           | exit nonzero if any generated files have changed |\n\n`gro gen --check` compares generated output against existing files; if any is\nnew or changed, it fails with a message to run `gro gen`. Called by `gro check`\nas part of CI.\n\n## Common Patterns\n\n### CSS generation\n\nfuz_css utility classes are no longer a gen task in most projects — the\n`vite_plugin_fuz_css` Vite plugin scans source files, extracts CSS class usage\nvia AST, and exposes a bundled `virtual:fuz.css` module (with HMR) containing\nonly the classes, base styles, and theme variables actually used. See\n./css-patterns §Project Setup.\n\nThe Gro generator equivalent, `gen_fuz_css()` in a `fuz.gen.css.ts` (accepts\n`GenFuzCssOptions`), still writes a committed `fuz.css` file, but the plugin is\npreferred.\n\n### Theme CSS generation\n\n`fuz_css` uses `theme.gen.css.ts` to generate the full base theme:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro';\n\nimport {default_themes} from './themes.ts';\nimport {render_theme_style} from './theme.ts';\n\nexport const gen: Gen = ({origin_path}) => {\n	const banner = `/* generated by ${origin_path} */`;\n	const theme = default_themes[0]!;\n	const theme_style = render_theme_style(theme, {\n		comments: true,\n		empty_default_theme: false,\n		specificity: 1,\n	});\n	return `${banner}\\n${theme_style}\\n`;\n};\n```\n\n### Library metadata\n\nAPI documentation metadata is no longer produced by a gen task. Instead the\n`svelte-docinfo` Vite plugin analyzes TypeScript and Svelte source files at\nbuild/dev time and exposes the result through `virtual:svelte-docinfo`. Add the\nplugin in `vite.config.ts` and build a `LibraryJson` at runtime with\n`library_json_from_modules` — see ./documentation-system for the full setup.\n\n```typescript\n// vite.config.ts\nimport svelte_docinfo from 'svelte-docinfo/vite.js';\n// ...plugins: [sveltekit(), svelte_docinfo()]\n```\n\nThere is no committed `library.gen.ts`, `library.json`, or `library.ts`.\n\n### Blog feed generation\n\n`fuz_blog` provides `blog.gen.ts` for Atom feeds, feed data, and slug routes:\n\n```typescript\nexport * from '@fuzdev/fuz_blog/blog.gen.ts';\n```\n\nConsumer projects re-export the gen. Returns an array of `feed.xml` (at an\nabsolute path in `static/`), `feed.ts`, and one `+page.svelte` per slug route.\n\n### Fixture generation\n\nTest fixtures can use gen files for snapshot data:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro';\n\nimport {create_tx_app_surface_spec} from './auth_attack_surface_helpers.ts';\n\nexport const gen: Gen = () => {\n	return JSON.stringify(create_tx_app_surface_spec().surface);\n};\n// auth_attack_surface.gen.json.ts → auth_attack_surface.json\n```\n\n### Action codegen (zzz)\n\nGen files can generate TypeScript types from runtime registries. zzz reads\naction specs to produce typed collections, metatypes, and handler interfaces:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro/gen.ts';\n\nimport {all_action_specs} from './action_specs.ts';\n\nexport const gen: Gen = ({origin_path}) => `\n  // generated by ${origin_path}\n  export const ActionMethods = [\n    ${all_action_specs.map((s) => `'${s.method}'`).join(',\\n')}\n  ] as const;\n`;\n```\n\nzzz's real generators delegate the heavy lifting to fuz_app's\n`@fuzdev/fuz_app/actions/action_codegen.ts` helpers (`compose_gen_file`,\n`generate_action_method_enums`, …) over `all_action_specs`.\n\n### Multi-file route generation\n\nA single gen file can generate entire route trees. `skill_docs.gen.ts`\nauto-discovers skills and generates manifests, data files, and `+page.svelte` routes:\n\n```typescript\nimport type {Gen} from '@fuzdev/gro/gen.ts';\n\nexport const gen: Gen = ({origin_path}) => {\n	// ... discover skills, read markdown ...\n	return [\n		{content: manifest_content, filename: 'skills_manifest.ts'},\n		{content: skill_data, filename: join(skill_route_dir, 'skill_data.ts')},\n		{content: page_content, filename: join(skill_route_dir, '+page.svelte')},\n		// ... more files\n	];\n};\n```\n\n## Quick Reference\n\n| Export                  | Type      | Source               | Purpose                                    |\n| ----------------------- | --------- | -------------------- | ------------------------------------------ |\n| `Gen`                   | Type      | `@fuzdev/gro/gen.ts` | GenFunction or GenConfig                   |\n| `GenFunction`           | Type      | `@fuzdev/gro/gen.ts` | `(ctx: GenContext) => RawGenResult`        |\n| `GenConfig`             | Interface | `@fuzdev/gro/gen.ts` | generate + optional dependencies           |\n| `GenContext`            | Interface | `@fuzdev/gro/gen.ts` | context passed to gen functions            |\n| `RawGenResult`          | Type      | `@fuzdev/gro/gen.ts` | string, RawGenFile, null, or nested array  |\n| `RawGenFile`            | Interface | `@fuzdev/gro/gen.ts` | output file with content, filename, format |\n| `GenDependencies`       | Type      | `@fuzdev/gro/gen.ts` | 'all', config object, or resolver function |\n| `GenDependenciesConfig` | Interface | `@fuzdev/gro/gen.ts` | patterns? (RegExp[]) and files? (PathId[]) |\n\n`Gen` and `GenContext` are also re-exported from `@fuzdev/gro` (the package\nindex).\n"},{slug:"common-utilities",title:"Common Utilities",content:"# Common Utilities\n\nShared utilities from `@fuzdev/fuz_util`.\n\n## Result Type\n\n`@fuzdev/fuz_util/result.ts` — `Result<TValue, TError>` discriminated union\nfor error handling without exceptions. Uses intersection:\n`({ok: true} & TValue) | ({ok: false} & TError)`, so properties go directly\non the result object (not nested under `.value`/`.error` wrappers).\n\n```typescript\nimport type {Result} from '@fuzdev/fuz_util/result.ts';\nimport {unwrap} from '@fuzdev/fuz_util/result.ts';\n\nfunction parse_config(text: string): Result<{value: Config}, {message: string}> {\n	try {\n		return {ok: true, value: JSON.parse(text)};\n	} catch (e) {\n		return {ok: false, message: e.message};\n	}\n}\n\n// Usage - discriminated union narrows via .ok\nconst result = parse_config(text);\nif (result.ok) {\n	console.log(result.value);\n} else {\n	console.error(result.message);\n}\n\n// Or unwrap (throws ResultError if not ok — requires {value} convention)\nconst config = unwrap(parse_config(text));\n```\n\n### Helper exports\n\n| Export         | Purpose                                                                    |\n| -------------- | -------------------------------------------------------------------------- |\n| `OK`           | Frozen `{ok: true}` constant for results with no extra data               |\n| `NOT_OK`       | Frozen `{ok: false}` constant for results with no extra data              |\n| `unwrap()`     | Returns `result.value` if ok, throws `ResultError` if not                 |\n| `unwrap_error()`| Returns the type-narrowed `{ok: false} & TError` result, throws if ok    |\n| `ResultError`  | Custom `Error` subclass thrown by `unwrap`, carries `.result` and supports `ErrorOptions` |\n\n`unwrap` signature:\n\n```typescript\nconst unwrap: <TValue extends {value?: unknown}, TError extends {message?: string}>(\n	result: Result<TValue, TError>,\n	message?: string,\n) => TValue['value'];\n```\n\n`unwrap_error` returns the entire failed result (not just a value) — the\nopposite of `unwrap` returning just `.value`.\n\n### Conventions\n\n- Spread data directly on the result: `{ok: true, ...data}` — not\n  `{ok: true, value: {data: ...}}`\n- Use `{value}` when `unwrap()` is expected; `{message}` for errors (used by\n  `ResultError`)\n- Prefer Result over throwing for expected errors (parsing, validation); use\n  exceptions for unexpected errors (programmer mistakes, system failures)\n\n## Logger\n\nHierarchical logging via `@fuzdev/fuz_util/log.ts`:\n\n```typescript\nimport {Logger} from '@fuzdev/fuz_util/log.ts';\n\nconst log = new Logger('my_module');\nlog.info('starting');\nlog.debug('details', {data});\n\n// Child loggers inherit level, colors, and console from parent\nconst child_log = log.child('submodule'); // label: 'my_module:submodule'\nchild_log.info('connected'); // [my_module:submodule] connected\n```\n\n### Constructor\n\n```typescript\nnew Logger(label?: string, options?: LoggerOptions)\n```\n\n| Option    | Type        | Default                     | Purpose                        |\n| --------- | ----------- | --------------------------- | ------------------------------ |\n| `level`   | `LogLevel`  | Inherited or env-detected   | Log level for this instance    |\n| `colors`  | `boolean`   | Inherited or env-detected   | Whether to use ANSI colors     |\n| `console` | `LogConsole` | Inherited or global console | Console interface for output   |\n\n### Log Levels\n\nOverride via `PUBLIC_LOG_LEVEL` env var. Default detection order:\n\n1. `PUBLIC_LOG_LEVEL` env var (if set)\n2. `'off'` when running under Vitest\n3. `'debug'` in development (`DEV` from `esm-env`)\n4. `'info'` in production\n\n| Level   | Value | Purpose                           |\n| ------- | ----- | --------------------------------- |\n| `off`   | 0     | No output                         |\n| `error` | 1     | Errors only                       |\n| `warn`  | 2     | Errors and warnings               |\n| `info`  | 3     | Normal operational messages        |\n| `debug` | 4     | Detailed diagnostic information   |\n\n### Logger Methods\n\n| Method        | Level   | Console method | Use case                          |\n| ------------- | ------- | -------------- | --------------------------------- |\n| `log.error()` | `error` | `console.error`| Failures requiring attention      |\n| `log.warn()`  | `warn`  | `console.warn` | Potential issues                  |\n| `log.info()`  | `info`  | `console.log`  | Normal operations                 |\n| `log.debug()` | `debug` | `console.log`  | Diagnostic details                |\n| `log.raw()`   | (none)  | `console.log`  | Unfiltered, no prefix or level check |\n\nEach method except `raw` checks `this.level` before outputting. Prefixes\ninclude the bracketed label plus a level indicator for error, warn, and debug;\ninfo has no level prefix — just the label.\n\n### Inheritance\n\nNo static state — level, colors, and console are instance properties.\nChildren inherit from parent, so changing a parent's level affects children\nthat haven't set their own override.\n\n```typescript\nconst root = new Logger('app');\nconst child = root.child('db');\n\nroot.level = 'debug';  // child also becomes debug (inherits)\nchild.level = 'warn';  // child overrides, root unaffected\n\nchild.clear_level_override();  // child inherits from root again\nchild.clear_colors_override(); // child inherits colors from root again\nchild.clear_console_override(); // child inherits console from root again\n```\n\nThe `root` getter walks the parent chain to find the root logger, useful for\nsetting global configuration.\n\nColors automatically disabled when `NO_COLOR` or `CLAUDECODE` env vars are set.\n\n### Additional Logger Exports\n\n| Export               | Purpose                                   |\n| -------------------- | ----------------------------------------- |\n| `log_level_to_number`| Converts a `LogLevel` to its numeric value (0-4) |\n| `log_level_parse`    | Validates a log level string, throws on invalid   |\n\n## Timings\n\nPerformance measurement via `@fuzdev/fuz_util/timings.ts`. Tracks multiple\nnamed timing operations; used in Gro's `TaskContext` for task performance.\n\n```typescript\nimport {Timings} from '@fuzdev/fuz_util/timings.ts';\n\nconst timings = new Timings();\n\n// start() returns a stop function\nconst stop = timings.start('operation');\nawait expensive_work();\nconst elapsed_ms = stop(); // returns elapsed milliseconds (does not log)\n\n// Nested timings\nconst stop_outer = timings.start('outer');\nconst stop_inner = timings.start('inner');\nawait inner_work();\nstop_inner();\nawait more_work();\nstop_outer();\n```\n\n### API\n\n| Method/Property | Signature                                  | Purpose                                 |\n| --------------- | ------------------------------------------ | --------------------------------------- |\n| `constructor`   | `new Timings(decimals?: number)`           | Optional decimal precision for rounding |\n| `start()`       | `(key: TimingsKey, decimals?) => () => number` | Start a timing, returns stop function |\n| `get()`         | `(key: TimingsKey) => number`              | Get recorded duration for a key         |\n| `entries()`     | `() => IterableIterator<[TimingsKey, number \\| undefined]>` | Iterate all timings |\n| `merge()`       | `(timings: Timings) => void`               | Merge other timings, summing shared keys |\n\n`TimingsKey` is `string | number`. Duplicate keys are auto-suffixed\n(`operation`, `operation_2`, `operation_3`, etc.).\n\n### Integration with Logger\n\n`print_timings(timings, log)` from `@fuzdev/fuz_util/print.ts` outputs timing\ndata at debug level after task execution. `Timings` itself does not log.\n\n### Stopwatch\n\n`create_stopwatch(decimals?)` — lower-level primitive returning a `Stopwatch`\nfunction that tracks elapsed time from creation. Call with `true` to reset;\ndefault `decimals` is 2.\n\n```typescript\nimport {create_stopwatch, type Stopwatch} from '@fuzdev/fuz_util/timings.ts';\n\nconst elapsed: Stopwatch = create_stopwatch();\nawait work();\nconsole.log(elapsed()); // e.g., 142.37 — ms since creation\nconsole.log(elapsed(true)); // ms since creation, then resets start time\nconsole.log(elapsed()); // ms since reset\n```\n\n## DAG Execution\n\n`@fuzdev/fuz_util/dag.ts` — `run_dag()` executes dependency graphs concurrently\n(nodes declare `depends_on`; independent nodes run in parallel up to\n`max_concurrency`). See ./async-patterns for the full DAG API (`DagOptions`,\n`DagResult`, `DagNode`) and concurrency primitives, and ./type-utilities for\nnominal typing and strict utility types.\n\n## DOM Helpers\n\n`@fuzdev/fuz_util/dom.ts` — browser DOM utilities.\n\n### `swallow`\n\nClaims an event by preventing its default action and stopping propagation:\n\n```typescript\nimport {swallow} from '@fuzdev/fuz_util/dom.ts';\n\nswallow(event);                  // preventDefault + stopImmediatePropagation\nswallow(event, false);           // preventDefault + stopPropagation (non-immediate)\nswallow(event, true, false);     // stopImmediatePropagation only (no preventDefault)\n```\n\nDesign principle: if you `preventDefault`, you're claiming the event — use\n`swallow` to also stop propagation. Parents needing to observe before children\nclaim should use the `capture` phase. See ./svelte-patterns\n§Event Handling for full guidance.\n\n### `handle_target_value`\n\nWraps an input event callback with value extraction and optional swallowing:\n\n```typescript\nimport {handle_target_value} from '@fuzdev/fuz_util/dom.ts';\n\n// Swallows by default (preventDefault + stopImmediatePropagation)\n<input oninput={handle_target_value((value) => { name = value; })} />\n\n// Without swallowing\n<input oninput={handle_target_value((value) => { name = value; }, false)} />\n```\n"},{slug:"css-patterns",title:"CSS Patterns",content:"# CSS Patterns\n\nfuz_css is three parts: **semantic styles** (classless element defaults),\n**style variables** (design tokens as CSS custom properties), and optional\n**utility classes** generated per-project with only the classes you use.\n\n## Default styling is the baseline\n\n**The single most common mistake is styling elements fuz_css already styles.**\nSemantic HTML comes fully dressed — headings are tiered (`h1`–`h6`), form\ncontrols share sizing and focus/hover/disabled states, `<code>`/`<pre>` use the\nmono font, `<aside>` is a callout, and **block elements space themselves\nvertically** via the flow-margin system: `p`, `ul`, `ol`, `menu`, `form`,\n`fieldset`, `table`, `details`, `textarea`, `select`, `label`, `pre`,\n`blockquote`, `aside`, `nav`, `legend` each get\n`margin-bottom: var(--flow_margin, var(--space_lg))` unless `:last-child` or\n`.unstyled`. So a stack of paragraphs, a heading followed by prose, a list under\na heading — all already have correct rhythm with **zero classes**.\n\nBefore adding any class or `<style>`, ask: *what specific gap in the defaults\ndoes this close?* Hand-adding `mb_*`/`gap_*`/`p_*` to elements flow margin\nalready spaces, or re-declaring the color/font an element already carries, is\nchurn that fights the framework. This isn't stylistic — real application code\nbears it out: most fuz app source files have **no `<style>` block at all**\n(zzz's library is ~82% style-free, mdz's ~100%), and where classes appear the\noverwhelming majority are a class or two, not long strings.\n\nReach past the defaults only for genuine layout (flex rows/columns, grids),\nintent color (`color_c` for a destructive button), or component-specific\nbehavior. The flex containers are the main reason to add classes at all —\ninside a `.row`, child flow margins reset to 0 (`.row > *` → `margin: 0`), so\nuse `gap_*` for spacing there.\n\n## The Styling Ladder\n\nWhen you *do* style, work down this ladder and stop at the first rung that\nsuffices:\n\n1. **Semantic HTML** — the right element, no class. Often the whole job.\n2. **Built-in class conventions** — `.selected`, `.disabled`, `.color_a`–\n   `.color_j`, `.inline`, `.unstyled` — state/variant classes the semantic\n   styles already recognize.\n3. **Composite classes** — `box`, `row`, `column`, `panel`, `chip`, `ellipsis`\n   — one class for a whole layout pattern.\n4. **Token classes** — `p_md`, `gap_lg`, `color_a_50` — map to design tokens;\n   never hardcode spacing or color.\n5. **Literal classes** — `display:flex`, `width:100%`, `hover:opacity:80%` —\n   arbitrary `property:value`, including responsive/state modifiers.\n6. **`<style>` block with design tokens** — component-specific layout,\n   animation, complex selectors, theming APIs.\n\n**Rungs 3–5 are one tier in practice, not a strict frequency ranking.** They're\nall utility classes you mix freely on the same element. The ordering is a mild\npreference — reach for a composite when one *exactly* matches (`row` over\n`display:flex align-items:center`), tokens for spacing/color, literals for\none-off layout. Empirically, spacing token classes (`mb_*`, `gap_*`, `p_*`) are\nthe single most-used class family, and **literal flex classes (`display:flex`,\n`flex:1`, `width:100%`) are as common as composites** — heavily used in app\ncode, not a rare last resort. The real cut points on the ladder are between\nrung 1 (semantic, no class) and the rest, and between rungs 1–5 (utility\nclasses) and rung 6 (`<style>` block).\n\nThe same hierarchy applies to text: `<small>` over\n`font-size: var(--font_size_sm)`, `<h2>` over a custom heading style, `<aside>`\nover a hand-built callout.\n\n### Direction matters — don't churn `<style>` into class soup\n\nThe ladder describes how to **author** from scratch, not a mandate to rewrite\n`<style>` blocks as classes. Pushing styling *up* the ladder (a `<div\nclass=\"callout\">` → `<aside>`) is neutral-to-good; pushing it *down* (a working\n`<style>` block → a 12-class string) is usually churn.\n\n- **Class → right semantic element** — good.\n- **Trivially-redundant `<style>` → composite/token** — good only when the\n  block's entire content is one composite's worth: `display: flex;\n  flex-direction: column; gap: var(--space_md)` (→ `column gap_md`),\n  `display: flex; align-items: center; gap: …` (→ `row gap_*`), or a single\n  token-mappable value. Intent must survive the rewrite verbatim.\n- **Non-trivial `<style>` → long class string** — don't. If the block has\n  hover/focus state machines, animations, `@media`, parent-child selectors,\n  pseudo-element content, positioning, or theming-API variables, leave it. A\n  `<style>` block with design tokens reads better than a 12-class string, gets\n  IDE autocomplete, and survives conditional logic without `clsx` gymnastics.\n\n**When in doubt, don't churn an existing `<style>` block** — the author chose it\nbecause the styling exceeded \"simple.\"\n\n## Elements That Come Pre-Styled\n\n| Element                           | What you get without classes                                                             |\n| --------------------------------- | ---------------------------------------------------------------------------------------- |\n| `<h1>`–`<h6>`                     | Serif font, tiered sizes/weights, balanced text wrap, flow margins                       |\n| `<a>`                             | Link color, focus outline, `.selected` state                                             |\n| `<button>`                        | Fill, border, hover/active/focus/disabled/selected states                                |\n| `<button class=\"color_a\">`        | Hue variants `color_a` through `color_j` (intent/status colors)                          |\n| `<input>`/`<textarea>`/`<select>` | Padding, border, focus outline, hover/disabled states; range, checkbox, radio all styled |\n| `<aside>`                         | Left border, tinted background, padding — callout/info box                               |\n| `<blockquote>`                    | Thick left border, padding                                                               |\n| `<code>`                          | Monospace, tinted background, padding; auto-inlines inside `<p>`                         |\n| `<pre>`                           | Monospace, overflow handling                                                             |\n| `<details>`/`<summary>`           | Pointer cursor, hover/active backgrounds                                                 |\n| `<table>`/`<th>`/`<td>`/`<tr>`    | Border-collapse, header alignment, cell padding, row hover                               |\n| `<small>`                         | `font-size: var(--font_size_sm)` — for metadata, secondary text                          |\n| `<kbd>`/`<samp>`                  | Monospace font                                                                           |\n| `<abbr title=\"...\">`              | Dotted underline                                                                         |\n| `<sub>`/`<sup>`                   | Baseline-aware sub/superscript                                                           |\n| `<hr>`                            | Themed double border with vertical spacing                                               |\n| `<img>`/`<svg>`/`<video>` etc.    | `display: block`, `max-width: 100%`, `height: auto`                                      |\n| `<ul>`/`<ol>`/`<menu>`            | Indented padding (`.unstyled` removes bullets and indent)                                |\n| `<label>`                         | Block layout, cursor pointer, `.selected`/`.disabled` states                             |\n| `<label> .title`                  | Bold, small bottom margin — field label inside a `<label>`                               |\n| `<fieldset>`/`<legend>`           | Column flex layout, larger legend text                                                   |\n\nLow-specificity `:where()` selectors carry all of this, so any class or style\noverrides it, regardless of import order.\n\n## Built-In Class Conventions\n\nState/variant classes authored into the semantic styles (`style.css`) — reach\nfor these before any utility class or custom CSS:\n\n| Class                 | Where it applies                                | Effect                                                     |\n| --------------------- | ----------------------------------------------- | ---------------------------------------------------------- |\n| `.selected`           | `button`, `a`, `label`, `.menuitem`             | Filled selected appearance; `button`/`label` also switch to `cursor: default` (links stay interactive) |\n| `.deselectable`       | selected `button`, and the `selectable`/`menuitem` composites | Keeps interactivity on a selected element                  |\n| `.disabled`           | `label`                                          | Muted color, default cursor                                |\n| `.color_a`–`.color_j` | `button`                                        | Hue variants (a=blue, b=green, c=red, etc.)                |\n| `.inline`             | `button`, `input`, `code`, `select`, `textarea` | Inline-block display for use inside paragraph text         |\n| `.unstyled`           | Most elements                                   | Opts out of opinionated styling, keeps normalizations      |\n\nA `<button class=\"color_c selected\">` is already a \"selected destructive\naction\" — no hand-rolled state styling. (Size classes `sm`/`md`/`lg`/etc. read\nlike conventions but are composites that require extraction — see\n[Composite Classes](#composite-classes).)\n\n## Project Setup\n\n### Import Order\n\nImport CSS in `+layout.svelte` (`src/routes`). First import is universal; others\nas needed:\n\n```typescript\nimport 'virtual:fuz.css'; // generated bundled CSS (all projects)\nimport '@fuzdev/fuz_code/theme.css'; // package-specific themes (if any)\nimport '#routes/style.css'; // project-specific global styles (app projects)\n```\n\n`#routes` resolves to `src/routes` in SvelteKit. Library/tool repos (fuz_css,\nfuz_ui, `gro`) often import only `virtual:fuz.css`; application repos\n(fuz_template, fuz_blog, zzz) typically use all three.\n\n### CSS Generation\n\nCSS is generated on demand by the `vite_plugin_fuz_css` Vite plugin and imported\nas the `virtual:fuz.css` module — no committed `fuz.css` file. Ecosystem default\nfor any Vite project:\n\n```typescript\n// vite.config.ts\nimport {vite_plugin_fuz_css} from '@fuzdev/fuz_css/vite_plugin_fuz_css.ts';\nexport default defineConfig({plugins: [vite_plugin_fuz_css()]});\n\n// src/routes/+layout.svelte (or main.ts)\nimport 'virtual:fuz.css';\n```\n\nDeclare the module type once in `src/app.d.ts`:\n\n```typescript\ndeclare module 'virtual:fuz.css' {\n	const css: string;\n	export default css;\n}\n```\n\nThe plugin supports HMR; tree-shaken bundled mode needs no options. fuz_css\nitself passes `{additional_variables: 'all'}` to include all variables for its\ndocs demos.\n\n**Gro generator alternative**: a `src/routes/fuz.gen.css.ts` exporting\n`gen_fuz_css()` writes a committed `fuz.css` genfile (regenerated via `gro\ngen`). Prefer the Vite plugin; reach for this only when a project can't run it.\n\n### Project `style.css`\n\nProject-specific global styles in `src/routes/style.css`: custom element\noverrides, patterns being prototyped before upstreaming to fuz_css, app-specific\nlayout (sidebar widths, nav heights). Keep minimal — most apps have near-empty\n`style.css` files.\n\n## Style Variables (Design Tokens)\n\nDefined in TypeScript, rendered to CSS. 600+ tokens; each can have `light`\nand/or `dark` values.\n\n### Colors\n\n10 hues with semantic roles:\n\n- `a` (primary/blue), `b` (success/green), `c` (error/red), `d`\n  (secondary/purple), `e` (tertiary/yellow)\n- `f` (muted/brown), `g` (decorative/pink), `h` (caution/orange), `i`\n  (info/cyan), `j` (flourish/teal)\n\n**Intensity scale**: 13 stops from `color_a_00` (lightest) → `color_a_50` (base)\n→ `color_a_100` (darkest): `00`, `05`, `10`, `20`, `30`, `40`, `50`, `60`, `70`,\n`80`, `90`, `95`, `100`.\n\n### Color-Scheme Variants\n\n| Prefix      | Behavior                                       | Use case                       |\n| ----------- | ---------------------------------------------- | ------------------------------ |\n| `text_*`    | Opaque, scheme-aware (low=subtle, high=bold)   | Text (alpha hurts performance) |\n| `shade_*`   | Opaque, tinted neutrals (00→100), scheme-aware | Backgrounds, surfaces          |\n| `fg_*`      | Toward contrast (darkens light, lightens dark) | Foreground overlays that stack |\n| `bg_*`      | Toward surface (lightens light, darkens dark)  | Background overlays that stack |\n| `darken_*`  | Always darkens (agnostic, alpha-based)         | Shadows, backdrops             |\n| `lighten_*` | Always lightens (agnostic, alpha-based)        | Highlights                     |\n\n`text_*` and `shade_*` are the everyday opaque, scheme-aware color tokens —\nreach for them first. `fg_*`/`bg_*` overlays use alpha and accumulate when\nnested. Both `shade_*` and `text_*` have `_min`/`_max` for untinted extremes\n(pure black/white). Fixed-appearance `_light`/`_dark` variants exist\n(`shade_40_light`, `color_a_50_dark`) but are rarely needed.\n\n### Sizes\n\n`xs5` → … → `xs` → `sm` → `md` → `lg` → `xl` → `xl2` → … → `xl15` (23 stops for\nspacing). Other families use subsets:\n\n- **Font sizes**: 13 stops (`xs`–`xl9`)\n- **Icon sizes**: 7 stops (`xs`–`xl3`, in px not rem)\n- **Border radii**: 7 stops (`xs3`–`xl`)\n- **Distances**: 5 stops (`xs`–`xl`, px — absolute widths: 200/320/800/1200/1600)\n- **Shadows, line heights**: 5 stops (`xs`–`xl`)\n\n### Additional Variable Families\n\n- **`border_color_*`**, **`outline_color_*`**: alpha-based tinted borders/outlines (00–100)\n- **`shadow_alpha_*`**: shadow opacity scale (00–100)\n- **`border_width_*`**: numbered 1–9 (px)\n- **`duration_*`**: numbered 1–6 (0.08s to 3s)\n- **`hue_*`**: base hue values for each color (`hue_a` through `hue_j`)\n\n### Theme Specificity\n\nBundled mode: `:root` and `:root.dark`. Runtime theme switching (via\n`render_theme_style()`) repeats the selector for higher specificity (default\n`:root:root` / `:root:root.dark`) to survive unpredictable CSS insertion order.\nColors are HSL-based (OKLCH migration planned).\n\n### Cascading Variable Pattern\n\nMany token classes set both a CSS property **and** a cascading custom property,\nso children inherit the value:\n\n- `font_size_lg` → `font-size` + `--font_size`\n- `color_a_50` → `color` + `--text_color`\n- `border_color_30` → `border-color` + `--border_color`\n- `outline_color_a_50` → `outline-color` + `--outline_color` (focus rings key off it)\n- `shadow_color_umbra` → `--shadow_color`\n\nA child of `font_size_lg` can reference `var(--font_size)` for the inherited\nvalue.\n\n## Utility Classes\n\nThree types, generated on-demand:\n\n| Type                  | Example                               | Purpose                      |\n| --------------------- | ------------------------------------- | ---------------------------- |\n| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |\n| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |\n| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |\n\n### Token Classes\n\n- **Spacing**: `p_md`, `px_lg`, `mt_xl`, `gap_sm`, `mx_auto`, `m_0` — by far the\n  most-used family\n- **Text colors**: `text_70`, `text_min`, `color_a_50`\n- **Background colors**: `shade_00`, `bg_10`, `fg_20`, `darken_30`, `bg_a_50`\n- **Typography**: `font_size_lg`, `font_family_mono`, `line_height_md`, `icon_size_sm`\n- **Layout**: `width_md` (space scale), `top_sm`, `inset_md`, and the\n  **distance-scale** sizers `width_atmost_lg`/`width_atleast_sm`/`height_atmost_md`\n  — these emit `width: 100%; max-width: var(--distance_*)` (px caps: 200–1600),\n  distinct from `width_md` which maps to the space scale\n- **Borders**: `border_radius_xs`, `border_width_2`, `border_color_30`\n- **Shadows**: `shadow_md`, `shadow_top_md`, `shadow_inset_xs`, `shadow_alpha_50`,\n  `shadow_color_umbra` (also `_highlight`, `_glow`, `_shroud`)\n- **Hue**: `hue_a` through `hue_j` (sets `--hue`)\n\n### Composite Classes\n\n| Class         | What it does                                                       |\n| ------------- | ------------------------------------------------------------------ |\n| `box`         | Flex column, items centered, justify centered                      |\n| `row`         | Flex row, align-items centered (overrides `box` direction)         |\n| `column`      | Flex column (like `box` but uncentered)                            |\n| `panel`       | Embedded container with tinted background and border-radius        |\n| `pane`        | Floating container with opaque background and shadow               |\n| `ellipsis`    | Block with text truncation (nowrap, overflow hidden, ellipsis)     |\n| `chip`        | Inline label styling (font/padding/bg/radius + `color_X` hues); display comes from the host element |\n| `menuitem`    | Full-width list item with icon, title, and selected state          |\n| `icon_button` | Square button sized to `--input_height` (flex-shrink: 0)           |\n| `selectable`  | Button-like fill with hover/active/selected states                 |\n| `clickable`   | Hover/focus/active scale transform effects (includes state styles) |\n| `plain`       | Transparent border/fill/shadow when not hovered                    |\n| `chevron`     | Small right-pointing arrow via CSS border trick                    |\n| `circular`    | `border-radius: 50%`                                               |\n| `pixelated`   | Crisp pixel-art image rendering                                    |\n| `xs`/`sm`/`md`/`lg`/`xl` | **Size composites** — see below                         |\n\n**Size composites cascade to a subtree.** `xs`/`sm`/`md`/`lg`/`xl` are a\nfive-member family at fixed step offsets from the `md` default. Put one on any\n**container** and it rescales that subtree's `--font_size`, `--input_height`,\n`--icon_size`, padding, **and `--flow_margin`** in lockstep — so a `sm` panel\ngets tighter text, controls, icons, and vertical rhythm together. `md` resets to\ndefault within an already-sized parent. This is the idiomatic way to make a\nwhole region denser or roomier without touching individual elements.\n\n**Gotcha**: composites with rulesets (`clickable`, `selectable`, `menuitem`,\n`plain`, `chip`) already include their state styles — `hover:clickable` is\nredundant. Several composites see near-zero real use (`circular`, `pixelated`,\n`pane`, `chevron`); the load-bearing ones are `row`, `column`, `box`, `panel`,\n`chip`, `menuitem`.\n\n### Literal Classes\n\n`property:value` maps directly to CSS:\n\n```svelte\n<div class=\"display:flex justify-content:center gap:var(--space_md)\">\n```\n\n**Space encoding**: `~` for spaces in multi-value properties:\n\n```svelte\n<div class=\"margin:0~auto padding:var(--space_sm)~var(--space_lg)\">\n<div class=\"width:calc(100%~-~20px)\">  <!-- calc requires ~ around +/- -->\n```\n\nIf you need more than 2–3 `~` characters, use a `<style>` block instead.\n\n## Modifiers\n\nState/responsive/color-scheme styling that inline styles can't do, prefixed onto\na literal class. Each maps 1:1 to a CSS pseudo-class or at-rule (`hover:` →\n`:hover`, `disabled:` → `:disabled`, `print:` → `@media print`, `before:` →\n`::before`), so the full list is inferable; the exhaustive registry lives in\nfuz_css's `modifiers.ts`. The stack-specific parts worth knowing:\n\n```svelte\n<button class=\"hover:opacity:80% focus:outline:2px~solid~var(--color_a_50)\">\n<div class=\"display:none md:display:flex\">          <!-- responsive -->\n<div class=\"box-shadow:var(--shadow_lg) dark:box-shadow:var(--shadow_sm)\">\n<div class='before:content:\"\" before:display:block'> <!-- pseudo needs explicit content -->\n```\n\n- **Responsive breakpoints**: `sm:` (40rem), `md:` (48rem), `lg:` (64rem), `xl:`\n  (80rem), `2xl:` (96rem). Also `max-sm:`…, and arbitrary `min-width(800px):` /\n  `max-width(600px):`.\n- **Ancestor**: `dark:` / `light:` (color scheme).\n- **Order**: `[media]:[ancestor]:[state...]:[pseudo-element]:property:value` —\n  and **multiple states must be alphabetical** (`focus:hover:…`, not\n  `hover:focus:…`), which the parser enforces.\n\n**In practice, modifier classes are rare in real code.** Responsive layout is\noverwhelmingly done with `@media` in component `<style>` blocks, and hover/focus\nstates ride on stateful composites (`clickable`, `selectable`, `menuitem`,\n`plain`) or `<style>`. The modifier system is fully available and correct, but\nconvention favors `<style>` for anything beyond an occasional one-off literal\nstate.\n\n## Class Extraction\n\nClasses are extracted via AST parsing at build time from:\n\n- `class=\"...\"` attributes\n- `class={[...]}` and `class={{...}}` (Svelte 5.16+)\n- `class:name` directives\n- `clsx()`, `cn()`, `cx()`, `classNames()`, `classnames()` calls\n- variables whose names end in `class`/`classes`/`className(s)`/`classList(s)`\n\nCSS variables are additionally caught by a `var(--name)` regex scan (only known\ntheme variables are included; unknown ones silently ignored), which catches\nusage in component props like `size=\"var(--icon_size_xs)\"` that AST extraction\nwould miss.\n\n### Comment hints for the dynamic cases\n\nWhen a class/element/variable is constructed dynamically and the extractor can't\nsee it statically, declare it explicitly:\n\n```typescript\n// @fuz-classes opacity:50% opacity:75% opacity:100%\n// @fuz-elements button input textarea\n// @fuz-variables shade_40 text_50\n```\n\nBehavior: auto-detected-but-unresolvable classes/elements/variables are\n**silently skipped** (they may belong to another framework); an explicit\n`@fuz-*` entry that can't be resolved is an **error** with typo suggestions via\nstring similarity. Outside fuz_css's own docs site, AST extraction handles\nalmost everything and `@fuz-*` hints are rarely needed.\n\n## Dynamic Theming\n\n### Runtime Variable Overrides\n\nUse Svelte's `style:` directive for runtime CSS variable overrides — components\nexpose CSS variables as their theming API, consumers override inline:\n\n```svelte\n<div style:--docs_menu_width={width}>\n<Alert style:--text_color={color}>\n<HueInput style:--hue={value}>\n```\n\n### Color Scheme\n\nDark/light mode is a `dark`/`light` class on the root element. `style.css`\nincludes `:root.dark { color-scheme: dark; }` / `:root.light { color-scheme:\nlight; }`. Persistence and system-preference handling live in fuz_ui's\n`ThemeState` class and `ThemeRoot` component.\n\n### Theme Switching\n\nThree built-in themes (`base`, `low contrast`, `high contrast`); custom themes\nare arrays of `StyleVariable` overrides. Theme CSS is rendered via\n`render_theme_style()` with higher specificity (default `:root:root`) to\noverride bundled theme variables regardless of insertion order.\n\n## Component Styling In Practice\n\nEverything above lands as one principle for component authors: **components\nshould have minimal custom CSS, delegating to fuz_css.** Across fuz_ui's 64\ncomponents, ~29 (45%) have no `<style>` block at all — and fuz_ui is a component\nlibrary, the styling-heaviest code in the ecosystem. Application code skews far\nmore classless (70–100% style-free). Where a `<style>` block exists it's usually\n5–30 lines (median ~16), with a tail up to ~90 for layout-heavy components\n(cards, dialogs, nav bars). Shared traits of well-styled components:\n\n- **No `<style>` block when possible** — styling from semantic HTML + utilities\n- **When `<style>` exists, it's component-specific** — positioning, transitions,\n  responsive breakpoints, complex parent-child selectors\n- **All colors/spacing/typography from design tokens** — never hardcoded\n- **Layout uses composites/utilities** — `box`, `row`, `column`, `panel`,\n  `gap_lg` over manual flex\n- **Stateful styling is conventional** — `class={{selected: …}}` rides on the\n  built-in `.selected` rules\n\n```svelte\n<!-- No <style> needed — semantic HTML + utility classes -->\n<aside class=\"column gap_md\">\n	<h2>{title}</h2>\n	<small class=\"text_50\">{subtitle}</small>\n	<p>{description}</p>\n	<button class=\"color_a\">Confirm</button>\n	<button class={['color_c', {selected: destructive}]}>Delete</button>\n</aside>\n```\n\nfuz_ui's `Details.svelte` and `EcosystemLinks.svelte` are real examples: pure\nsemantic HTML (`<details>`, `<summary>`, `<ul>`, `<a>`, `<p>`) riding on the\ndefault element styling, no `<style>` block.\n\n### Anti-Patterns\n\nEach of these signals a component doing work fuz_css already does:\n\n```svelte\n<!-- BAD: rebuilding what <small>/<aside> already do -->\n<span class=\"subtitle\">{text}</span>          <!-- GOOD: <small class=\"text_70\"> -->\n<div class=\"info-box\">{message}</div>         <!-- GOOD: <aside> -->\n\n<!-- BAD: manual flex in <style> -->\n<div class=\"container\">…</div>                <!-- GOOD: <div class=\"column gap_md\"> -->\n<style>.container { display: flex; flex-direction: column; gap: var(--space_md); }</style>\n\n<!-- BAD: hand-rolled destructive button -->\n<button class={['delete-btn', {active}]}>Delete</button>\n<!-- GOOD: <button class={['color_c', {selected: pending}]}>Delete</button> -->\n\n<!-- BAD: hardcoded pixels -->\n<style>.sidebar { width: 220px; padding-top: 40px; }</style>\n<!-- GOOD: <style>.sidebar { width: var(--sidebar_width); padding-top: var(--space_xl2); }</style> -->\n```\n\nIf multiple components each define their own `.sidebar`/`.header`/`.content`\nwith the same flex/padding, those belong in composites, project `style.css`, or\nutility classes — not repeated per component.\n\n### When Custom CSS IS Justified\n\n- **Complex interactive states** — multi-property hover/active/selected,\n  `color-mix` shadows, parent-child selectors like `.parent:hover .child`\n  (fuz_ui's `Hashlink.svelte` is the canonical parent-hover-reveal example)\n- **Structural behavior** — `flex-direction: column-reverse` for bottom-up\n  scroll, `position: sticky/absolute/fixed` with calculated offsets\n- **Responsive layouts** — `@media` queries for structural changes\n- **Animations/transitions** — `@keyframes`, `transition`\n- **Rendering contexts** — canvas, 3D, custom-layout surfaces\n- **Theming APIs for children** — declaring CSS custom properties consumers\n  override via `style:` (e.g. `Alert.svelte` exposes `--text_color`)\n\nEven justified custom CSS uses design tokens (`var(--space_md)`), not hardcoded\nvalues.\n\n### Project `style.css` for shared app patterns\n\nWhen a pattern recurs across components in one app but isn't general enough for\nfuz_css, put it in the project's `src/routes/style.css` — the right home for\napp-scoped shared classes (button variants, layout columns, scroll shadows).\nMark candidates with `// TODO upstream` if they might belong in fuz_css. Keeps\ncomponent `<style>` blocks focused and avoids premature generalization.\n\n### Class Naming\n\nTwo naming systems coexist:\n\n- **fuz_css design tokens**: `snake_case` — `p_md`, `color_a_50`, `gap_lg`. The\n  global vocabulary.\n- **Component-local classes**: `kebab-case` — `site-header`, `nav-links`,\n  `character-entry`. Distinguishes component-scoped styles from design-system\n  classes at a glance.\n\n```svelte\n<!-- snake_case = fuz_css utility, kebab-case = component-local -->\n<div class=\"column gap_md site-header\">\n	<nav class=\"row gap_sm nav-links\">…</nav>\n</div>\n\n<style>\n	.site-header { position: sticky; top: 0; z-index: 10; }\n	.nav-links { border-bottom: var(--border_width_1) var(--border_style) var(--border_color); }\n</style>\n```\n\nkebab-case for component-local classes is the **target** convention, fully\nadopted in zzz and fuz_ui; the fuz_css and fuz_docs docs sites still lean\n`snake_case` for local classes and haven't been migrated. New code should use\nkebab-case.\n\n## When to Use Classes vs Styles\n\n| Need                                      | Utility class | Style tag       | Inline style   |\n| ----------------------------------------- | ------------- | --------------- | -------------- |\n| Simple layout (`row`, `column`, `gap_*`)  | **Preferred** | Overkill        | No             |\n| Design tokens on own elements (1–4 props) | **Yes**       | OK              | OK             |\n| Non-trivial own-element styling           | OK            | **Preferred**   | No             |\n| Style child components                    | **Yes**       | No              | Limited        |\n| Hover/focus/active state machines         | Limited       | **Preferred**   | No             |\n| `@media` responsive layout                | Limited       | **Preferred**   | No             |\n| Animations, transitions, keyframes        | No            | **Preferred**   | No             |\n| Parent-child / sibling selectors          | No            | **Only option** | No             |\n| Theming API (CSS vars consumers override) | No            | **Yes**         | Yes (override) |\n| Runtime dynamic values                    | No            | No              | **Yes**        |\n\n**One heuristic the table doesn't capture: long class strings are a smell.** 4–6\nclasses is the comfortable upper bound (98%+ of real class attributes are ≤6\ntokens); 8+ (especially several literal `property:value` classes) usually reads\nworse than the equivalent `<style>` block with design tokens, which also gets\nIDE autocomplete and composes with conditional logic without `clsx` gymnastics.\nAnd per §Direction matters, don't churn *existing* `<style>` blocks into class\nstrings.\n"},{slug:"dependency-injection",title:"Dependency Injection",content:"# Dependency Injection\n\nTyped interfaces for side effects, real implementations as defaults, accepted as\nparams, tested with plain object mocks. No `vi.mock` — dependencies flow through\nfunction signatures. The goal is optimal testable TypeScript that is\nruntime-independent (Deno / Node / tests) via simple parameterization, not\nmagic mocks or ambient singletons.\n\n## Convention\n\n**Small standalone `*Deps` interfaces, composed bottom-up.** Replaces\n`Pick<GodType>` narrowing.\n\n### Bottom-up composition\n\nDefine small focused interfaces; leaf functions import them directly. The entry\npoint assembles app-level composites for wiring and threads them down, but leaf\nfunctions never take the composite as a param.\n\n```typescript\n// Small standalone interfaces (fuz_app's runtime layer is the exemplar)\nexport interface EnvDeps {\n	env_get: (name: string) => string | undefined;\n	env_set: (name: string, value: string) => void;\n}\n\nexport interface FsReadDeps {\n	stat: (path: string) => Promise<StatResult | null>;\n	read_text_file: (path: string) => Promise<string>;\n	read_file: (path: string) => Promise<Uint8Array>;\n	read_text_from_offset: (path: string, offset: number) => Promise<ReadTextFromOffsetResult>;\n	readdir: (path: string) => Promise<Array<string>>;\n}\n\nexport interface CommandDeps {\n	run_command: (cmd: string, args: Array<string>, options?: RunCommandOptions) => Promise<CommandResult>;\n}\n\n// Functions declare exactly what they need via intersection\nexport const setup_env_file = async (\n	deps: FsReadDeps & FsWriteDeps & CommandDeps,\n	env_path: string,\n	example_path: string,\n): Promise<void> => {\n	/* ... */\n};\n\n// App-level composite — for the wiring layer only\nexport interface RuntimeDeps\n	extends EnvDeps, FsReadDeps, FsWriteDeps, FsRemoveDeps, FsStreamDeps,\n		CommandDeps, TerminalDeps, ProcessDeps, LogDeps, FetchDeps {\n	env_all: () => Record<string, string>;\n	readonly args: ReadonlyArray<string>;\n	cwd: () => string;\n	run_command_inherit: (cmd: string, args: Array<string>) => Promise<number>;\n}\n```\n\nPlatform factories construct the composite once at the entry point:\n`create_deno_runtime(args)`, `create_node_runtime(args)`,\n`create_mock_runtime(args)` (test implementation with observable state).\nAny object that structurally satisfies the interface works. There is no\nbrowser factory — browser/component-tree DI is Svelte context, a different\nmechanism (see \"Scope\" below).\n\n### Why standalone interfaces beat Pick<GodType>\n\n`Pick<AppRuntime, 'env_get'>` forces every consumer to import the god type.\nSmall standalone interfaces avoid this:\n\n- **Shareable**: any project can import `EnvDeps` without pulling app types\n- **Trivial mocks**: `{env_get: () => 'value', env_set: () => {}}` — no factory needed\n- **Composable**: `FsReadDeps & CommandDeps` for multi-dep functions\n- **Self-documenting**: the interface IS the dependency contract\n\n`Pick<>` on a *small* `*Deps` interface is fine (minimal coupling); the\nanti-pattern is `Pick<GodType>`. A `Pick<>` narrowing reused across many\ncall sites is a named interface waiting to happen — fuz_app's action\nfactories take a standalone `ActionFactoryDeps {log, audit}` interface\n(`auth/deps.ts`) rather than repeating\n`Pick<RouteFactoryDeps, 'log' | 'audit'>` at a dozen sites.\n\n### Bundles vs single capabilities\n\n`*Deps` names the injected **bundle** — a record of capabilities a function\nneeds. The *members* of a bundle are often pure-noun service interfaces or\nclasses (`Keyring`, `Logger`, `AuditEmitter`, `FactStore`), and a standalone\nsingle-capability interface keeps its noun name too — fuz_util's `FactStore`\n(\"interface only — backends live downstream\") is the worked example. Don't\nsuffix a single service interface with `Deps`; the suffix marks the\nparameter-bundle role.\n\n## Parameter Type Suffixes\n\nThree suffixes for single-object parameters, each with distinct test behavior:\n\n| Suffix | What it contains | Test behavior | Rule |\n| ----------- | ---------------------------------- | ------------------------------------------ | ---------------------------------------------------- |\n| `*Deps` | Capabilities (functions, services) | Fresh mock factories per test case | Things you swap for testing or platform abstraction |\n| `*Options` | Data (config values, limits, flags) | Literal objects, constructed once, reused | Static values — no mock factory needed |\n| `*Context` | Scoped world for a callback/handler | Depends on scope (may contain deps + data) | The world available within a bounded scope |\n\n`*Context` examples: a per-request `RouteContext` (`{db, pending_effects, ...}`),\na per-setup-callback `AppServerContext` (`{deps, backend, session_options, ...}`).\nA `*Context` may structurally satisfy a `*Deps` interface — fuz_app's route\nhandlers pass the `RouteContext` directly to `query_*` functions because it\nsatisfies `QueryDeps = {db: Db}`.\n\n**No `*Config` suffix** — `?` on fields already expresses required vs optional;\nall parameter bags use `*Options`. `*Input` is reserved for mutation payloads\n(create/update data).\n\n**Keep the categories separate.** A `*Deps` type that mixes capability fields\nwith config values (thresholds, paths) is blurring two categories that test\ndifferently — split it into a `*Deps` + an `*Options`, or, when the mix is\ndeliberate for a one-function signature, use the ad-hoc deps form below and\nsay so. (Rust collapses these categories into one `*Options` struct on\npurpose; TS holds them apart — that's the language-appropriate shape on each\nside.)\n\n## Naming\n\n| What              | Convention                  | Example                              |\n| ----------------- | --------------------------- | ------------------------------------ |\n| Small interface   | `{Domain}Deps`              | `EnvDeps`, `FsReadDeps`, `CacheDeps` |\n| Capability bundle | `{Scope}Deps`               | `AppDeps`, `RouteFactoryDeps`        |\n| Full composite    | `RuntimeDeps`               | extends all small `*Deps` interfaces |\n| Default impl      | `default_{domain}_deps`     | `default_cache_deps`                 |\n| Mock factory      | `create_mock_{domain}_deps` | `create_mock_cache_deps`             |\n| Stub factory      | `stub_{scope}_deps`         | `stub_app_deps`                      |\n\nFile naming: `deps.ts` (interfaces) + `deps_defaults.ts` (production\ndefaults) + a test-side `mock_deps.ts` — fuz_css is the cleanest exemplar\n(`CacheDeps` / `default_cache_deps` / `create_mock_cache_deps`).\n\n**Legacy `*Operations` naming (fuz_gitops)**: an older spelling of the same\npattern — `GitOperations` / `default_git_operations` / `create_mock_git_ops`,\ngrouped under a `GitopsOperations` composite with an `ops` param. It is being\nmigrated to `*Deps` opportunistically (fuz_css already migrated its\n`CacheOperations` → `CacheDeps`). **Never author new `*Operations` types**;\nwhen touching fuz_gitops's DI surface, follow the existing local naming until\nthe rename lands, and use `*Deps` everywhere else.\n\n## Layer Contracts (L0 platform vs L1 domain)\n\nTwo layers of injected interface, with deliberately different contracts:\n\n**L0 — platform shims** (`FsReadDeps`, `CommandDeps`, ...): mirror the\nplatform. **Positional params, throws on error**, exactly like\n`Deno.readTextFile` / `node:fs`. Stable signatures, trivially implemented by\nany runtime.\n\n**L1 — domain wrappers** (`CacheDeps`, git/npm operations, ...): **single\noptions-object params, uniform `Result` returns with typed errors** — reads,\nwrites, and queries all return `Result<{value: T}, FsError>`; no mixing\n`string | null` reads with `Result` writes. Implementations route thrown\nerrors through `fs_classify_error(error)` from `@fuzdev/fuz_util/fs.ts`,\nwhich maps platform codes (ENOENT/EACCES/EPERM/EEXIST) to a discriminated\n`kind`:\n\n```typescript\ntype FsError =\n	| {kind: 'not_found'; message: string}\n	| {kind: 'permission_denied'; message: string}\n	| {kind: 'already_exists'; message: string}\n	| {kind: 'io_error'; message: string};\n\n// FsJsonError adds {kind: 'invalid_json'} — for read_json-style deps where\n// missing vs corrupt must be distinguishable (e.g. self-healing config loads).\n```\n\nCallers branch on `kind` instead of regex-matching `message`:\n\n```typescript\n// Missing is expected\nif (!r.ok) return null;\n\n// Missing returns a default\nif (!r.ok) {\n	if (r.kind === 'not_found') return [];\n	throw new Error(`readdir failed: ${r.message}`);\n}\n\n// rm -f semantics (tolerate missing)\nif (!r.ok && r.kind !== 'not_found') throw new Error(r.message);\n```\n\nThe uniform shape keeps the contract symmetric with the Rust twin where\n`Result<T, E>` is native. Don't mix the two contracts on one interface, and\ndon't leak platform types (e.g. node's `SpawnOptions`) through an L1 shape.\n\n## Consumption Patterns\n\n**Required first param** — internal/library functions take `deps` as a\nrequired first parameter:\n\n```typescript\nexport const create_account_route_specs = (\n	deps: RouteFactoryDeps,\n	options: AccountRouteOptions,\n): Array<RouteSpec> => { /* ... */ };\n```\n\n**Optional with default** — public API surfaces default to the production\nimplementation:\n\n```typescript\nconst {deps = default_cache_deps} = options;\n```\n\n**Narrow intersection** — utility functions accept exactly the capabilities\nused: `deps: FsReadDeps & FsWriteDeps & CommandDeps & EnvDeps`.\n\n**Ad-hoc per-function deps** — a function with a unique combination defines\nits own interface co-located with it:\n\n```typescript\nexport interface BootstrapAccountDeps {\n	db: Db;\n	token_path: string; // data mixed in deliberately — one-signature convenience\n	read_text_file: (path: string) => Promise<string>;\n	delete_file: (path: string) => Promise<void>;\n	password: Pick<PasswordHashDeps, 'hash_password'>;\n	log: Logger;\n}\n```\n\nUse ad-hoc deps when the combination is unique to one function and sharing\nwould add coupling without reuse.\n\n**Composition root** — capabilities are assembled once, at an explicit wiring\npoint, and flow down. fuz_app's two-step server assembly is the exemplar:\n`create_app_backend(options)` builds the capability bundle (`AppDeps`) and\nreturns it wrapped with lifecycle metadata; `create_app_server({backend, ...})`\nconsumes it. Extension points that must run after assembly register through\ndocumented methods on the capability itself (the audit emitter's\n`add_listener` — same identifier as its Rust twin) rather than copying or\nre-shaping the deps bundle.\n\n## Design Principles\n\n- **Result returns, never throw** in L1 domain interfaces (see Layer\n  Contracts); L0 mirrors the platform and throws.\n- **Stateless capabilities** — deps are stateless functions and service\n  instances; mutable state (e.g. `bootstrap_status: {available: boolean}`)\n  is passed separately, never smuggled into a deps bundle.\n- **Runtime agnosticism** — never import env/fs at module level in code that\n  might run outside one runtime; load via deps params. Direct platform\n  imports are for the platform factory files and explicitly-single-runtime\n  modules only (document the carve-out at the module when you make one).\n- **Logging in shared deps: required, never optional-with-fallback.** A\n  shared library module consumed by multiple apps can't own a `Logger`\n  singleton — the label belongs to the consumer. Keep `LogDeps` required;\n  where a consumer has no logger, its adapter delegates explicitly\n  (`warn: (...args) => console.warn(...args)`). Diagnostic-only `log?`\n  params on leaf helpers (silently absent = no extra diagnostics) are a\n  different, acceptable shape — the rule is about capabilities the function\n  *needs* on some path.\n\n## Testing\n\nPlain objects implementing the interfaces — no `vi.mock()`, no Sinon.\nIndividual `vi.fn()` for call tracking is acceptable. See\n./testing-patterns for general mock structure.\n\n**Mock factory with overrides** — every method implemented with a sensible\ndefault, `Partial<T>` overrides spread last:\n\n```typescript\nexport const create_mock_git_deps = (\n	overrides: Partial<GitDeps> = {},\n): GitDeps => ({\n	current_branch_name: async () => ({ok: true, value: 'main'}),\n	checkout: async () => ({ok: true}),\n	// ... all methods with sensible defaults\n	...overrides,\n});\n```\n\n**In-memory state mock** — state object created separately so tests can seed\nand inspect it:\n\n```typescript\nexport const create_mock_cache_deps = (state: MockFsState): CacheDeps => ({\n	read_text: async ({path}) => {\n		const content = state.files.get(path);\n		return content === undefined\n			? {ok: false, kind: 'not_found', message: `not found: ${path}`}\n			: {ok: true, value: content};\n	},\n	write_text_atomic: async ({path, content}) => { state.files.set(path, content); return {ok: true}; },\n	unlink: async ({path}) => { state.files.delete(path); return {ok: true}; },\n});\n```\n\n**Tracking mock** — records calls for assertions, returned alongside the\ndeps object:\n\n```typescript\nexport const create_tracking_process_deps = (): {\n	deps: ProcessDeps;\n	get_spawned_commands: () => Array<TrackedCommand>;\n} => { /* push into a local array, expose getters */ };\n```\n\n**Stubs — two safety levels** (fuz_app's `testing/stubs.ts` is the exemplar):\n\n- `create_throwing_stub<T>(label)` — Proxy that throws on any access;\n  `stub_app_deps` builds a whole bundle of these. Catches *unexpected*\n  capability use with a descriptive error — prefer this default: a silent\n  no-op mock can mask test-setup mistakes.\n- `create_noop_stub<T>(label)` / `create_stub_app_deps()` — silent no-ops\n  for tests where incidental access is fine.\n\n**Observable runtime mock** — `create_mock_runtime(args)` returns the full\n`RuntimeDeps` with observable state (`mock_env`, `mock_fs`, `exit_calls`,\n`command_calls`, ...); `exit` throws a `MockExitError` instead of\nterminating. Stub factories accept the same narrow `*Deps` contracts\nproduction code uses — never `Pick<GodType>`.\n\n## Traps\n\nFailure modes seen in real code — each with the rule that avoids it:\n\n- **Optional capability with a silent platform fallback.** A\n  `read_file?: (...)` field defaulting to a module-level `node:fs` import\n  quietly couples the module to one runtime and hides the effect from the\n  signature. Either require the dep, or default at an explicit platform\n  factory / entry point — not per-field at module scope.\n- **Category blurring under a `*Deps` name.** Config values\n  (`embedded_threshold`, `disk_root`) mixed with capabilities in one\n  `*Deps` interface, several optional-with-fallback — tests can't tell what\n  needs a mock vs a literal. Split `*Deps` from `*Options`, or use the\n  documented ad-hoc form deliberately.\n- **No seam at the call site.** Functions called *by name* from middleware\n  (`query_account_by_id(...)` imported directly) leave `vi.mock` as the only\n  test seam — this is how module-mocking creeps back in. Where a module's\n  callers need to substitute behavior in tests, thread the function through\n  a deps param. fuz_app documents its remaining bearer-auth query cluster as\n  an explicit carve-out (module mocks with `vi.restoreAllMocks()` hygiene);\n  treat any new instance as a smell, not a precedent.\n- **God-type coupling.** `Pick<Composite, ...>` at leaf functions, or\n  passing the app composite down more than one level. Composites exist for\n  the wiring layer.\n- **Deps spreading.** `{...deps, extra}` at downstream call sites re-shapes\n  the bundle mid-flight. Constructing a purpose-built deps object at a\n  wiring point where multiple sources converge is legitimate; spreading to\n  *extend* someone else's bundle is not. Inline narrowing (`{db}` selected\n  from a bundle) is fine — selection, not extension.\n- **Forcing `*Deps` params across a component tree.** Browser/UI code uses\n  the platform's DI: Svelte context (`create_context`), e.g. fuz_app's\n  `*_rpc_context` adapters. Function-param deps are for plain TS call\n  graphs; context is for component scoping. Both are the pattern done\n  right, in their own domain.\n\n## Scope — where the pattern doesn't apply\n\n- **Floor-tier utility modules**: foundation packages (fuz_util) export\n  bare functions over the platform (`fs.ts`, `process.ts`, `git.ts`) plus\n  the shared contracts (`FsError`, `Result`) that `*Deps` interfaces\n  elsewhere are typed against. They are what default implementations are\n  *made of* — they don't take deps themselves.\n- **Pure libraries** (parsers, renderers, formatters) have no side effects\n  to inject; a rendering/plugin seam (mdz's component injection) is\n  composition, not capability DI.\n- **Narrow duck-typed interfaces** that intentionally match multiple\n  existing objects (svelte-docinfo's `AnalysisLog`, satisfiable by both\n  fuz_util's `Logger` and Vite's logger) are the same spirit without the\n  suffix — fine as-is.\n\n## Rust Analog\n\nThe `*Deps` suffix is **TS-only**. Rust traits *are* capabilities —\nappending `Deps` imports TS shape into a language that doesn't need it.\nRust uses pure-noun capability traits (`PasswordHasher`, `Storage`,\n`SocketRevoker`) and `*Options` structs for per-call parameter bags, with\n`cfg`/features, the crate graph, and enum dispatch covering much of what TS\nsolves with injection. For the full treatment — escalation ladder, hot/cold\ndispatch, enum-dispatch-before-`dyn`, object-safety annotation rules, what\nstays concrete — see ./rust-patterns#dependency-injection.\n\n## Quick Reference\n\n| Flavor              | Exemplar    | Injection style                         |\n| ------------------- | ----------- | --------------------------------------- |\n| Narrow platform deps + `RuntimeDeps` composite | fuz_app `runtime/` | Required first param (narrow interface); composite at entry points |\n| App capability bundle (`AppDeps`, `RouteFactoryDeps`, `QueryDeps`, `ActionFactoryDeps`) | fuz_app server | Required first param; two-step composition root |\n| Focused domain deps (`CacheDeps`) | fuz_css | Optional param with default (`deps = default_cache_deps`) |\n| Grouped legacy `*Operations` | fuz_gitops | Optional param with default (`ops`) — migrating to `*Deps` |\n\n| Principle  | Rule                                                                 |\n| ---------- | -------------------------------------------------------------------- |\n| Suffixes   | `*Deps` capabilities / `*Options` data / `*Context` scoped world; no `*Config` |\n| Errors     | L1: uniform `Result<{value: T}, FsError>`; L0: platform mirror, throws |\n| Parameters | L1: single options object; L0: positional                            |\n| Testing    | Plain objects — no `vi.mock()`; throwing stubs over silent no-ops    |\n| State      | Deps are stateless — mutable refs passed separately                  |\n| Narrowing  | Accept the smallest `*Deps` interface that covers usage              |\n| New code   | `*Deps` naming everywhere — never new `*Operations`                  |\n"},{slug:"documentation-system",title:"Documentation System",content:"# Documentation System\n\nPipeline, Tome system, layout architecture, and project setup for `@fuzdev`\ndocs. For TSDoc/JSDoc authoring conventions, see ./tsdoc-comments.\n\n## Pipeline Overview\n\n```\nsource files → svelte-docinfo plugin → virtual:svelte-docinfo (modules) ┐\n                                                                         ├→ library_json_from_modules() → Library → Tome pages + API routes\npackage.json → vite_plugin_pkg_json  → virtual:pkg.json (pkg_json)       ┘\n```\n\n| Stage             | What                                              | Key details                                                                                                                                                                                                                                                                                         |\n| ----------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| **Analysis**      | `svelte-docinfo`                                  | Standalone package analyzes TS/JS/Svelte modules via the TypeScript compiler API, extracting declarations and TSDoc metadata                                                                                                                                                                        |\n| **Generation**    | `svelte-docinfo/vite.js` + `vite_plugin_pkg_json` | Two Vite plugins run at build/dev time: `svelte-docinfo` exposes the analyzed `modules` as `virtual:svelte-docinfo`; `vite_plugin_pkg_json` (from fuz_ui) curates `package.json` to the publish-safe `PkgJson` and exposes it as `virtual:pkg.json`. No committed generated data (`library.gen.ts`/`library.json`) |\n| **Serialization** | `library_json_from_modules()`                     | From `@fuzdev/fuz_util/library_json.ts`; pairs the curated `pkg_json` (from `virtual:pkg.json`) with the analyzed `modules` (from `virtual:svelte-docinfo`) into the raw `{pkg_json, source_json}` `LibraryJson` (no derived values stored — those are computed by `Library`)                       |\n| **Runtime**       | `Library` class                                   | Wraps `LibraryJson` into `Module` and `Declaration` instances with `$derived` properties, search, and lookup maps                                                                                                                                                                                   |\n| **Rendering**     | Tome pages + API routes                           | Manual tomes + auto-generated API docs. Backticked identifiers in TSDoc auto-link to API docs via the mdz rendering seam — fuz_ui injects `DocsLink` as mdz's inline-code renderer, which resolves the identifier against the `Library` (see ./mdz)                                               |\n\n### Analysis\n\nThe `svelte-docinfo` package owns module analysis end to end: it walks source\nfiles, dispatches per file type (`.ts`/`.js` vs `.svelte`), parses TSDoc/JSDoc\n(`@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`, `@since`,\n`@module`, `@default`, `@nodocs`, `@mutates`), merges re-exports into\n`alsoExportedFrom` (svelte-docinfo's API is camelCase — it targets the broad\nSvelte ecosystem, not fuz conventions), sorts\nmodules, and checks for duplicate names in the flat namespace. It ships a CLI,\na Vite plugin (`svelte-docinfo/vite.js`), and a build-tool-agnostic API. fuz_ui\ndepends on it as a dev dependency — importing its types and a few runtime\nhelpers — while the heavy per-project module analysis runs in each *consumer's*\nbuild via the Vite plugin, not at fuz_ui's runtime.\n\n## Tome System\n\nA **Tome** is a documentation page. Zod schema in `@fuzdev/fuz_ui/tome.ts`:\n\n```typescript\nconst Tome = z.object({\n	slug: z.string(), // URL path segment + lookup key (used in related_tomes)\n	title: z.string().optional(), // display label; falls back to slug when omitted\n	category: z.string(), // grouping in sidebar navigation\n	Component: z.custom<Component<any, any>>(), // the +page.svelte component\n	related_tomes: z.array(z.string()), // cross-links to other tome pages (by slug)\n	related_modules: z.array(z.string()), // links to source modules in API docs\n	related_declarations: z.array(z.string()), // links to specific exports in API docs\n});\n```\n\n### Cross-references\n\n| Field                  | Links to                     | Example value                 |\n| ---------------------- | ---------------------------- | ----------------------------- |\n| `related_tomes`        | Other tome pages             | `['ThemeRoot']`               |\n| `related_modules`      | Source files in `/docs/api/` | `['theme_state.svelte.ts']`   |\n| `related_declarations` | Specific exports in API docs | `['ThemeRoot', 'ThemeState']` |\n\n### Categories\n\nCategories group tomes in sidebar navigation; project-specific:\n\n| Project | Categories                       |\n| ------- | -------------------------------- |\n| fuz_ui  | `guide`, `helpers`, `components` |\n| fuz_css | `guide`, `systems`, `styles`     |\n\n### Registry\n\nEvery project with docs has `src/routes/docs/tomes.ts`:\n\n```typescript\nimport type {Tome} from '@fuzdev/fuz_ui/tome.ts';\nimport introduction from '#routes/docs/introduction/+page.svelte';\nimport api from '#routes/docs/api/+page.svelte';\n\nexport const tomes: Array<Tome> = [\n	{\n		slug: 'introduction',\n		category: 'guide',\n		Component: introduction,\n		related_tomes: ['api'],\n		related_modules: [],\n		related_declarations: [],\n	},\n	// ...\n];\n```\n\n### Helpers\n\nFrom `@fuzdev/fuz_ui/tome.ts`:\n\n- `tome_get_by_slug(slug)` — look up a Tome from `tomes_context` (throws if not found)\n- `tome_to_pathname(tome, docs_path?, hash?)` — generate URL for a tome\n- `tome_to_title(tome)` — display label (its `title`, else its `slug`)\n- `tomes_context` — context holding `() => Map<string, Tome>` (set by `Docs`)\n- `tome_context` — context holding `() => Tome` for the current page (set by `TomeContent`)\n\nFrom `@fuzdev/fuz_ui/docs_helpers.svelte.ts`:\n\n- `docs_slugify(name)` — convert tome name to URL-safe slug (preserves case)\n- `docs_links_context` — context holding `DocsLinks` for section navigation\n- `DOCS_PATH_DEFAULT`, `DOCS_PATH`, `DOCS_API_PATH` — path constants\n\n## Setting Up Docs in a Project\n\nFollowing the pattern in fuz_ui and fuz_css.\n\n### 1. Library analysis (Vite plugins)\n\nAdd the `svelte-docinfo` Vite plugin (exposes the analyzed `modules` as\n`virtual:svelte-docinfo`) and fuz_ui's `vite_plugin_pkg_json` (exposes the\ncurated, publish-safe `package.json` subset as `virtual:pkg.json`) in\n`vite.config.ts`:\n\n```typescript\nimport {defineConfig} from 'vite';\nimport {sveltekit} from '@sveltejs/kit/vite';\nimport svelte_docinfo from 'svelte-docinfo/vite.js';\nimport {vite_plugin_pkg_json} from '@fuzdev/fuz_ui/vite_plugin_pkg_json.ts';\n\nexport default defineConfig({\n	plugins: [sveltekit(), svelte_docinfo(), vite_plugin_pkg_json()],\n});\n```\n\nRegister the ambient types in `src/app.d.ts`:\n\n```typescript\n/// <reference types=\"svelte-docinfo/virtual-svelte-docinfo.js\" />\n\ndeclare module 'virtual:pkg.json' {\n	import type {PkgJson} from '@fuzdev/fuz_util/pkg_json.ts';\n	const pkg_json: PkgJson;\n	export default pkg_json;\n}\n```\n\n`vite_plugin_pkg_json` reads `package.json` at build time and serves only the\npublish-safe `pkg_json_keys` subset, keeping `scripts`, `dependencies`, and\nprivate config out of the client bundle (and avoiding SvelteKit's\n`server.fs.allow` tripping on a cold HMR reload). There is no committed\ngenerated data (`library.gen.ts`, `library.json`) — the plugins produce it at\nruntime; the only committed artifact is the tiny hand-written\n`src/routes/library.ts` glue (§3).\n\n**Footgun**: if a project widens the published `package.json` fields it exposes,\nthe **same `keys` set must reach both** `vite_plugin_pkg_json` and\n`library_json_from_modules()` — a mismatch silently drops fields end-to-end with\nno error. The canonical wiring is a shared `src/routes/pkg_json_keys.ts` const\npassed to both callsites.\n\n### 2. Root layout — site identity only\n\nThe root `src/routes/+layout.svelte` wraps **every** route, so keep it light:\nset only the small `site_context` (icon, glyph, repo url — `glyph`/`repo_url`\nderive from `virtual:pkg.json`). Do **not** build the `Library` here — that\npulls the heavy analyzed `modules` into the root chunk and instantiates\n`Library` on every page, including the landing.\n\n```svelte\n<script lang=\"ts\">\n	import ThemeRoot from '@fuzdev/fuz_ui/ThemeRoot.svelte';\n	import {SiteState, site_context} from '@fuzdev/fuz_ui/site.svelte.ts';\n	import {logo_my_project} from '#lib/logos.ts';\n	import pkg_json from 'virtual:pkg.json';\n	import type {Snippet} from 'svelte';\n\n	const {children}: {children: Snippet} = $props();\n\n	// `glyph` and `repo_url` derive from `pkg_json`; `icon` stays explicit.\n	site_context.set(new SiteState({icon: logo_my_project, pkg_json}));\n<\/script>\n\n<ThemeRoot>{@render children()}</ThemeRoot>\n```\n\n### 3. Library data — a shared module, provided per subtree\n\nBuild the `LibraryJson` once in `src/routes/library.ts`. As a module-level\n`export const` it evaluates lazily on first import and is shared by every\nimporter; because only the docs subtree imports it, the heavy\n`virtual:svelte-docinfo` payload stays out of the root chunk:\n\n```typescript\n// src/routes/library.ts\nimport {library_json_from_modules} from '@fuzdev/fuz_util/library_json.ts';\nimport {modules} from 'virtual:svelte-docinfo';\nimport pkg_json from 'virtual:pkg.json';\n\nexport const library_json = library_json_from_modules(pkg_json, modules);\n```\n\nProvide `library_context` in the docs layout (`src/routes/docs/+layout.svelte`),\nwhich covers all `/docs/*` pages:\n\n```svelte\n<script lang=\"ts\">\n	import type {Snippet} from 'svelte';\n	import Docs from '@fuzdev/fuz_ui/Docs.svelte';\n	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.ts';\n	import {tomes} from '#routes/docs/tomes.ts';\n	import {library_json} from '#routes/library.ts';\n\n	const {children}: {children: Snippet} = $props();\n\n	const library = new Library(library_json);\n	library_context.set(() => library);\n<\/script>\n\n<Docs {tomes}>\n	{@render children()}\n</Docs>\n```\n\n`library_context` holds a getter (`() => Library`) — set it with a closure\nover reactive state as above. `library_context.get()` **throws** when unset,\nand that only surfaces at SSR/prerender (`gro build`) — not in `gro typecheck`\nor `gro test`. So it must be set by a layout that is a common ancestor of\nevery component that reads it (`DeclarationLink`, `ModuleLink`, `TypeLink`,\n`DocsTertiaryNav`, and `Mdz` with an injected `DocsLink`). Components that\ntake a `library` prop (`LibraryDetail`, `ApiIndex`, `ApiModule`) project it\ninto the context for their own subtree, so an aggregator can render a foreign\nlibrary without touching the site-level context. Any consumer **outside**\n`/docs` provides its own from the same `library.ts` — e.g. an `/about` page or\na `/skills` subtree:\n\n```svelte\n<script lang=\"ts\">\n	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.ts';\n	import {library_json} from '#routes/library.ts';\n\n	const library = new Library(library_json);\n	library_context.set(() => library);\n<\/script>\n```\n\nKeep these off the landing page so it never pulls the heavy data. After any\nchange that moves a context provider, verify with `gro build` — a missing\nprovider passes typecheck and tests but fails the prerender.\n\n### 4. Tomes registry\n\n`src/routes/docs/tomes.ts` — see [Registry](#registry) above.\n\n### 5. Individual tome pages\n\nEach tome is a `+page.svelte` in `src/routes/docs/{slug}/`:\n\n```svelte\n<script lang=\"ts\">\n	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';\n	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';\n	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';\n	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';\n\n	const TOME_SLUG = 'MyComponent';\n	const tome = tome_get_by_slug(TOME_SLUG);\n<\/script>\n\n<TomeContent {tome}>\n	<section>\n		<!-- Introduction content -->\n	</section>\n	<TomeSection>\n		<TomeSectionHeader text=\"Usage\" />\n		<!-- Section content with examples -->\n	</TomeSection>\n	<TomeSection>\n		<TomeSectionHeader text=\"Options\" />\n		<!-- Another section -->\n	</TomeSection>\n</TomeContent>\n```\n\n`TomeSectionHeader` auto-detects heading level (h2/h3/h4) from nesting depth.\nSections tracked by IntersectionObserver for the right sidebar TOC.\n\n### 6. API routes\n\n`src/routes/docs/api/+page.svelte` — API overview:\n\n```svelte\n<script lang=\"ts\">\n	import ApiIndex from '@fuzdev/fuz_ui/ApiIndex.svelte';\n<\/script>\n\n<ApiIndex />\n```\n\n`src/routes/docs/api/[...module_path]/+page.svelte` — per-module docs:\n\n```svelte\n<script lang=\"ts\">\n	import ApiModule from '@fuzdev/fuz_ui/ApiModule.svelte';\n\n	const {params} = $props();\n	const module_path = $derived(params.module_path ?? '');\n<\/script>\n\n<ApiModule {module_path} />\n```\n\n## Docs Layout Architecture\n\n`<Docs>` provides a three-column responsive layout:\n\n| Column        | Component          | Content                              |\n| ------------- | ------------------ | ------------------------------------ |\n| Top bar       | `DocsPrimaryNav`   | Breadcrumb, nav dialog toggle        |\n| Left sidebar  | `DocsSecondaryNav` | Tome list grouped by category        |\n| Center        | `main`             | Route content (tome pages, API docs) |\n| Right sidebar | `DocsTertiaryNav`  | Section headers within current page  |\n\nRight sidebar collapses below ~1000px, left below ~800px. Both move into a\ndialog accessible from the top bar's menu button.\n\n### Key contexts\n\nThe four contexts that wire the layout together (full list in [Helpers](#helpers)):\n\n- `library_context` (`() => Library`) — API metadata, set with a getter; provided per docs-consuming subtree (docs layout, `/about`, …), never at the root (see [Setting Up Docs](#setting-up-docs-in-a-project) §3); components with a `library` prop project it for their subtree\n- `tomes_context` (`() => Map<string, Tome>`) — registered tomes (set by `Docs`)\n- `tome_context` (`() => Tome`) — current page's tome (set by `TomeContent`)\n- `docs_links_context` (`DocsLinks`) — fragment tracking for section navigation\n\n### Runtime Classes\n\n`Library` class (`library.svelte.ts`) provides the runtime API documentation\nhierarchy:\n\n- **`Library`** — wraps `LibraryJson`, provides `modules`, `declarations`,\n  `module_by_path`, `declaration_by_name` lookup maps, and\n  `search_declarations(query)` for multi-term search\n- **`Module`** (`module.svelte.ts`) — wraps `ModuleJson`, provides `path`,\n  `declarations`, `url_api`, `module_comment`\n- **`Declaration`** (`declaration.svelte.ts`) — wraps `DeclarationJson`,\n  provides `name`, `kind`, `module_path`, `url_api`, `url_github`\n\n## Component Reference\n\nYou wire up only a handful of these when adopting the docs system — the ones the\nsetup steps import:\n\n| Component                          | Role in setup                                                            |\n| ---------------------------------- | ------------------------------------------------------------------------ |\n| `Docs`                             | Three-column layout wrapper; sets `tomes_context` + `docs_links_context` |\n| `TomeContent`                      | Individual tome page wrapper; sets `tome_context`                        |\n| `TomeSection`                      | Section container with depth tracking and intersection                   |\n| `TomeSectionHeader`                | Section heading with hashlink (auto h2/h3/h4)                            |\n| `ApiIndex`                         | API overview page (search + all modules/declarations)                    |\n| `ApiModule`                        | Per-module API page (`[...module_path]`)                                 |\n| `LibrarySummary` / `LibraryDetail` | Compact metadata card / expanded package info                            |\n\nThe full set (~27 components — the `Docs*` nav internals, `Api*`/`Declaration*`\nlist pieces, `Tome*`/`Module*`/`Type*` links) is fuz_ui inventory; see fuz_ui's\n`CLAUDE.md` for the exhaustive catalog. All are defined in fuz_ui and imported by\nconsumers unchanged (see [Cross-Project Pattern](#cross-project-pattern)).\n\n## Cross-Project Pattern\n\nfuz_ui **defines** all documentation components and the analysis pipeline.\nOther projects **import** them:\n\n```typescript\n// In fuz_ui (defines the components)\nimport Docs from './Docs.svelte';\nimport {library_context} from './library.svelte.ts';\n\n// In fuz_css or any consumer project\nimport Docs from '@fuzdev/fuz_ui/Docs.svelte';\nimport {library_context} from '@fuzdev/fuz_ui/library.svelte.ts';\n```\n\nLayout structure is identical — only tomes, categories, and breadcrumb\nbranding differ. The `svelte-docinfo` Vite plugin and `virtual:svelte-docinfo`\nare the shared analysis engine across projects.\n\n## See Also\n\n- ./mdz — the mdz dialect, the `DocsLink`/`Code` rendering seam,\n  backticked-identifier autolinking, and `svelte_preprocess_mdz` (build-time\n  compilation of static `<Mdz>` content)\n- **`svelte-docinfo`** — the shared module-analysis engine (see [Analysis](#analysis))\n- ./tsdoc-comments — TSDoc/JSDoc authoring conventions, tag reference,\n  mdz auto-linking, and documentation auditing\n"},{slug:"file-organization",title:"File Organization",content:`# File Organization

Source layout, domain subdirectories, full-path imports, and test mirroring for
\`@fuzdev\` TypeScript/Svelte projects.

## Source Tree

\`\`\`
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
\`\`\`

## Domain Subdirectories

When a domain grows beyond a single file, group related modules in a
subdirectory under \`lib/\`. Each file is a distinct concern — no barrel/index
files.

\`\`\`
src/lib/
├── env/              # environment variable handling
│   ├── load.ts       # schema-based env loading + validation
│   ├── resolve.ts    # $$VAR$$ reference resolution
│   ├── dotenv.ts     # .env file parsing
│   └── mask.ts       # secret value display masking
├── auth/             # authentication domain (~80 files)
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
\`\`\`

**When to create a subdirectory**: 3+ closely related files sharing a domain
concept. A single file stays at \`lib/\` root. Don't create subdirectories
preemptively.

## Import by Full Path

**Consumers import individual modules by full path** — the subdirectory is part
of the import path, not hidden behind re-exports. No barrel/\`index.ts\`; package
\`exports\` use wildcard patterns (\`"./*.js"\`) so every module is importable.

\`\`\`typescript
import {load_env} from '@fuzdev/fuz_app/env/load.ts';
import {resolve_env_vars} from '@fuzdev/fuz_app/env/resolve.ts';
import {create_app_backend} from '@fuzdev/fuz_app/server/app_backend.ts';
\`\`\`

## Tests Mirror the Subdirectory Structure

Tests live in \`src/test/\` (NOT co-located) and mirror \`src/lib/\` subdirectories:

\`\`\`
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
\`\`\`

See ./testing-patterns for the full test file layout, naming, and fixtures.
`},{slug:"mdz",title:"mdz — Strict Markdown Dialect",content:"# mdz — Strict Markdown Dialect\n\n`mdz` (`@fuzdev/mdz`) is the ecosystem's markdown dialect: a deliberately\nsmall, unambiguous grammar aimed at devs and AI agents rather than end users.\nAn agent touches it in three places — **rendering TSDoc/JSDoc prose** on docs\nsites (backticked identifiers linkify to API docs), **authoring `<Mdz>`\ncontent** with embedded Svelte components, and **rendering streaming LLM\noutput**. One grammar, two parsers: a synchronous tree parser\n(`mdz_parse(content)` → `Array<MdzNode>`, from `@fuzdev/mdz/mdz.ts`) and an\nincremental streaming parser (`MdzStreamParser`, emits opcodes) for partial\ninput; the sync parser is the normative reference and parity tests bind them.\n\n**It is a dialect, not a CommonMark/GFM superset.** The design axiom is *false\nnegatives over false positives*: ambiguous input stays literal text rather than\nguessing markup. Do not assume a markdown feature works because GFM supports it\n— check the surface below.\n\n## Dialect surface\n\n| Feature                | Syntax                                                                                                    |\n| ---------------------- | -------------------------------------------------------------------------------------------------------- |\n| Inline code            | `` `code` ``                                                                                              |\n| Bold / italic / strike | `**bold**`, `_italic_`, `~~strike~~` — double delimiters only (single `*`, `_`, `~` are literal)          |\n| Links                  | auto-detected URLs, `/internal/path`, `./relative` and `../relative` (autolinked after whitespace), `[text](url)` |\n| Headings               | `# Heading` … `######` at **column 0**; gets a lowercase slugified `id` for fragment links                |\n| Lists                  | `- item` / `1. item` at column 0; indent nests; blank lines contained; items hold block children (paragraphs, nested lists, code blocks, blockquotes, tables) on indented lines — the marker-line remainder is inline-only |\n| Blockquotes            | `> ` per line (**no lazy continuation**); nest with `>>` or `> > `; bare `>` is the in-quote paragraph break; a blank line ends the quote; content is a mini-document |\n| Code blocks            | fenced with optional language hint; an unclosed fence consumes to EOF (or to the end of its blockquote)   |\n| Horizontal rule        | `---` alone on a line                                                                                     |\n| Tables                 | `\\| a \\| b \\|` rows + a `\\| --- \\| :-: \\|` delimiter row (colons set per-column alignment); leading **and** trailing `\\|` required; inline-only cells (`` `code` `` protects pipes; `\\|` is the one escape, a literal pipe); a header/delimiter column mismatch stays a paragraph |\n| Components / elements  | `<Alert>…</Alert>` (component) / `<aside>…</aside>` (HTML element) — **both must be registered**; `<br />` (registered) for a hard break |\n| Paragraphs / breaks    | blank line separates paragraphs; a single newline is a soft break (collapses to a space by default)      |\n\n**Whitespace**: text nodes preserve literal `\\n`, but the default rendering\napplies no `white-space` style, so single newlines collapse to spaces. The\n`whitespace` prop on `Mdz`/`MdzStream`/`MdzPrecompiled` opts into `pre-line`\n(every newline breaks — chat-style input) or `pre-wrap` (spaces/tabs preserved\ntoo).\n\n## Deliberately unsupported (scope notes)\n\nThe strictness is the point — these are omitted on purpose, so don't reach for\nthem:\n\n- **No single-delimiter emphasis** — `*x*`, `_x_` intraword, `~x~` all stay\n  literal. Intraword `_` is literal by design so `snake_case` identifiers render\n  verbatim (a core reason the dialect exists).\n- **No component/element attributes yet** — a registered `<Alert>…</Alert>`\n  renders, but `<Alert status=\"warning\">` does **not** parse: the tag reader\n  allows only whitespace then `>`/`/>` after the name, so an attribute bails the\n  whole tag back to literal text. `MdzComponents` is `Map<string, Component>`\n  with a `// TODO support params`. Author component content, not component props.\n- **No CommonMark/GFM compatibility** — no setext headings, no reference links,\n  no `*`-bullets or `+`-bullets (only `-`), no task lists.\n- **No syntax highlighting, no themed components, no HTML sanitization** — only\n  registered components/elements render; everything else is text. Rich rendering\n  is injected (below), not built in.\n\n## Rendering: plain by default, inject richer\n\nmdz core renders inline code as `<code>` and code blocks as `<pre><code>` —\n**plain elements**. Consumers inject richer renderers through getter-based\ncontexts in `@fuzdev/mdz/mdz_contexts.ts`, set via `MdzRoot` props or directly\nwith `mdz_set_context_with_fallback(context, () => Value)` (prefers the local\nvalue, falls back to the ancestor's — ancestor captured once at init):\n\n- `mdz_code_context` → a `Component<{reference: string}>` for inline `` `code` ``\n- `mdz_codeblock_context` → a `Component<{lang, content}>` for code blocks\n- `mdz_components_context` → the `<Alert>`-style component registry (a `Map`)\n- `mdz_elements_context` → the allowed-HTML-element registry\n- `mdz_base_context` → base path for resolving `./relative` links\n\nThe two code-prop contracts are shaped to match their canonical injections:\n`mdz_code_context`'s `{reference}` matches fuz_ui's `DocsLink`, and\n`mdz_codeblock_context`'s `{lang, content}` matches fuz_code's `Code`, so both\ndrop in directly. **mdz ships no default component registry** — every consumer\nregisters its own; an unregistered tag renders as a visible placeholder, not an\nerror.\n\n## Backticked-identifier autolinking (TSDoc)\n\nThe autolink is the injection seam plus a lookup — there's no special \"link\"\nsyntax. When fuz_ui injects `DocsLink` as `mdz_code_context`, every inline\n`` `code` `` span becomes a `DocsLink` whose `reference` is the span text.\n`DocsLink` resolves it against the `Library` from `library_context`:\n`declaration_by_name.get(reference)`, then `module_by_path.get(reference)` — a\nhit renders a `DeclarationLink`/`ModuleLink`, a miss stays a plain `<code>`.\n**Only real API symbols in the flat namespace resolve**; everything else is an\nordinary code span. This is why backticking identifiers in TSDoc \"just works\" on\ndocs sites and is inert elsewhere. (Separately, `mdz_from_tsdoc` in\n`@fuzdev/mdz/tsdoc_mdz.ts` converts TSDoc `@see`/`{@link}` text into mdz strings\n— a source bridge, not the autolinker.)\n\n## Build-time preprocessor\n\n`svelte_preprocess_mdz` (`@fuzdev/mdz/svelte_preprocess_mdz.ts`) compiles\n**static** `<Mdz content=\"…\">` usages — string literals and statically\nresolvable ternary chains — into pre-rendered `<MdzPrecompiled>` markup at build\ntime, eliminating runtime parsing for known-static doc strings. Truly dynamic\ncontent is left untouched. Its `code_component_import` /\n`codeblock_component_import` (plus `components`/`elements`) options mirror the\nruntime seam, so precompiled and runtime output stay identical. Reach for it\nwhen a project renders many static `<Mdz>` blocks (docs sites); skip it for\npurely dynamic content.\n\n## Sync vs streaming\n\nTwo input regimes over one grammar. The **sync** pipeline (`mdz_parse`,\n`Mdz.svelte`) owns random-access input — anything you hold as a complete string\n(static content, the preprocessor). The **streaming** pipeline\n(`MdzStreamParser`, `MdzStream.svelte` fed by an `MdzStreamState`) owns\nappend-only input arriving in chunks (LLM output). The streaming invariant: no\nimplicit re-parsing — corrections to already-emitted output are bounded, local,\nand reified as opcodes. Use streaming only when you genuinely render partial\ninput as it arrives; otherwise `mdz_parse` is simpler.\n\n## Testing\n\nFixture-based, in `src/test/` (not co-located): `fixtures/mdz/` drives the\nparser (`input.mdz` → `expected.json`), `fixtures/svelte_preprocess_mdz/` drives\nthe preprocessor (`input.svelte`). **Never hand-edit `expected.json`** —\nregenerate via `gro src/test/fixtures/mdz/update` (or the\n`svelte_preprocess_mdz` equivalent). The fixtures are the ground truth for what\nthe dialect parses.\n"},{slug:"npm-dependencies",title:"Approved npm Dependencies",content:"# Approved npm Dependencies\n\nThe canonical allowlist of external npm packages approved for the\nTypeScript/Svelte repos across the ecosystem. Prefer these; reach outside\nthe list only with explicit approval (see [§Adding a dependency](#adding-a-dependency)).\n\n**Scope**: the canonical (non-experimental) TS/Svelte repos — libraries,\napps, sites, and tooling. Different-paradigm or pre-canonical repos carry\ntheir own deps and are out of scope here.\n\n**Source of truth**: each repo's `package.json` (`dependencies`,\n`devDependencies`, `peerDependencies`, `optionalDependencies`). This doc is a\ncurated, hand-maintained reference to the stack-wide third-party deps — not\ngenerated, and deliberately **not exhaustive**: narrowly repo-specific deps (one\napp's domain library, an editor extension's typings, a benchmark-only reference\nimpl) are left out so the list stays focused on what generalizes across the\nstack. Verify it against the repos periodically.\n\nPackages published by the workspace itself — the `@fuzdev` / `@ryanatkn`\nscopes and unscoped siblings like `svelte-docinfo` — are internal, not\nthird-party deps, and never appear here.\n\n## Language & build toolchain\n\n| Package | Purpose |\n| ------- | ------- |\n| `typescript` | TypeScript compiler |\n| `tslib` | TS runtime helpers |\n| `svelte` | Component framework (runes) |\n| `@sveltejs/kit` | Application framework |\n| `@sveltejs/vite-plugin-svelte` | Svelte ↔ Vite integration |\n| `@sveltejs/adapter-static` | Static-site adapter |\n| `@sveltejs/acorn-typescript` | TS-aware acorn parser (Svelte toolchain) |\n| `@sveltejs/package` | Library packaging (`svelte-package`) |\n| `svelte-check` | Svelte / TS diagnostics |\n| `svelte2tsx` | Svelte → TSX for typechecking |\n| `vite` | Build tool / dev server |\n| `vitest` | Test runner |\n| `jsdom` | DOM implementation for tests |\n\n## Lint & format\n\n| Package | Purpose |\n| ------- | ------- |\n| `eslint` | Linter |\n| `eslint-plugin-svelte` | Svelte lint rules |\n| `typescript-eslint` | TypeScript lint integration |\n| `@eslint/js` | ESLint's built-in JS rule presets |\n| `globals` | Global-identifier sets for ESLint configs |\n\n## Release tooling\n\n| Package | Purpose |\n| ------- | ------- |\n| `@changesets/changelog-git` | Git-based changelog generator for changesets |\n| `@changesets/types` | Changesets type definitions |\n\n## Type definitions\n\n| Package | Purpose |\n| ------- | ------- |\n| `@types/node` | Node.js types |\n| `@types/estree` | ESTree AST types |\n| `@types/pg` | `pg` (node-postgres) types |\n| `@types/deno` | Deno global types (consumers run under Deno) |\n| `@types/ws` | `ws` types |\n| `@types/picomatch` | `picomatch` types |\n\n## Core utilities\n\n| Package | Purpose |\n| ------- | ------- |\n| `zod` | Schema validation |\n| `esm-env` | Environment flags (`DEV` / `BROWSER`) |\n| `zimmerframe` | AST walker |\n| `magic-string` | Source-string edits with sourcemaps |\n| `@webref/css` | W3C CSS reference data |\n| `@jridgewell/trace-mapping` | Sourcemap decoding |\n| `dequal` | Deep equality |\n| `fast-deep-equal` | Deep equality (fast path) |\n| `date-fns` | Date utilities |\n\n## Backend & server\n\n| Package | Purpose |\n| ------- | ------- |\n| `pg` | PostgreSQL client |\n| `@electric-sql/pglite` | Embedded Postgres (WASM) |\n| `hono` | HTTP server framework |\n| `@hono/node-server` | Hono Node adapter |\n| `@hono/node-ws` | Hono Node WebSocket adapter |\n| `@node-rs/argon2` | Argon2 password hashing (native) |\n| `ws` | WebSocket implementation |\n\n## Parsing & build internals\n\n| Package | Purpose |\n| ------- | ------- |\n| `esbuild` | Bundler / transform |\n| `oxc-parser` | Fast JS/TS parser |\n| `ts-blank-space` | Type-stripping transform |\n| `es-module-lexer` | ESM import/export lexer |\n| `acorn-jsx` | JSX plugin for acorn |\n| `chokidar` | File watching |\n| `dotenv` | `.env` loader |\n| `picomatch` / `tinyglobby` | Glob matching |\n| `commander` | CLI argument parsing |\n\n## Adding a dependency\n\nNew packages are added deliberately, not incidentally:\n\n- Prefer `node:` built-ins, then this list, before anything new.\n- A new dependency needs explicit approval — name it, its purpose, what it\n  replaces or enables, and its transitive footprint.\n- Removing an unused dependency is pre-authorized — no approval needed. Verify\n  nothing references it, then drop the entry. Removing the last user of a\n  package? Drop it from this list in the same change.\n\n## Dependency classification (peer vs dependency vs dev)\n\nFor a **published library**, which `package.json` field a package lands in is a\ncorrectness decision, not bookkeeping.\n\n- **`peerDependencies`** — a package that must resolve to a **single instance**\n  in the consumer's tree: a framework host (`svelte`, `@sveltejs/kit`) or\n  anything whose instances/types cross the library's API boundary (`zod`\n  schemas, `esm-env` flags). Two copies break `instanceof`, Zod `.brand()`\n  identity, Svelte context keys, and the dev/prod env gate. Required when the\n  public API always reaches it; **optional** (via `peerDependenciesMeta`) when\n  it's an opt-in / à-la-carte path (a preprocessor, a deep-import module many\n  consumers skip). Mirror the version in `devDependencies` so the library's own\n  build/test resolves it. **An optional peer is only safe to leave optional\n  when a *required* peer guarantees it transitively** — `svelte` and\n  `@sveltejs/kit` both depend on `esm-env`, so a lib that requires either can\n  leave `esm-env` optional. A runtime import of a singleton on a path with\n  **no** required framework peer (e.g. `esm-env` in a node-only utility like\n  `fuz_util/log.ts`) must be a **required** peer instead — npm auto-installs\n  required peers, so the consumer never hits a missing-module crash, where an\n  optional one would.\n- **`dependencies`** — published code imports it, but it's a self-contained\n  internal detail never handed across the API boundary (no singleton hazard) —\n  pin a known-good version.\n- **`devDependencies`** — only used by the library's build/test, never shipped\n  in `dist` (the toolchain: `typescript`, `vite`, `eslint`, `svelte-check`, …).\n\nBuild-time helpers that published code imports but a consumer never interacts\nwith (`magic-string`, `zimmerframe` for a Svelte preprocessor) carry no\nsingleton hazard — classify them as **`dependencies`** so the library ships its\nown self-contained copy and never leans on a consumer (or a transitive\nframework dep) to supply them. An **optional peer** is acceptable only when the\nhelper is already guaranteed by a *required* framework peer — e.g. a type-only\n`@types/estree` reached through `svelte`, which depends on it, and is erased at\nbuild anyway. Never a `devDependency`-only import: that breaks any consumer who\nreaches the path. Either `dependencies` or a peer is correct for these; only a\n`devDependency`-only or undeclared import is wrong.\n\n**Apps, sites, and templates are not libraries** — they're leaf deploy targets\nwith no installing consumers, so they classify everything as `dependencies` /\n`devDependencies` and never declare peers.\n\nThe litmus test: *if a consumer ended up with a second copy of this package,\nwould anything break?* Yes → peer (optional if the path is opt-in). No, but\npublished code imports it → dependency. Only the build sees it → devDependency.\n"},{slug:"path-references",title:"Path References in Documentation",content:'# Path References in Documentation\n\nThree forms, each with its own typography. The distinction is whether the target\nis a **navigable file** (bare path) or a **code-tree identifier** (backticked,\nno leading `./`).\n\n## 1. Navigational paths (bare, no backticks)\n\nFor docs, READMEs, external repos, and any reference that points to a file by\nlocation rather than by code identity:\n\n- `./foo` and `../foo` — relative to the file\'s directory; mdz auto-linkifies\n  these when preceded by whitespace\n- `~/dev/foo` — anchored at the workspace root; reads cleanly at any nesting\n  depth\n- `setup/foo` — bare workspace-root anchor (no `~/dev/` prefix); preferred over\n  deep `../../setup/foo` from nested files\n\n> **A bare path is a promise it resolves on disk.** An unbackticked `./`, `../`,\n> or `~/dev/` path is a real, navigable link — it must point at a file or\n> directory that exists, resolved relative to the file it appears in (`~/dev/`\n> from the workspace root). If you mean a path *illustratively* — a conceptual\n> location (`./build/`), an example (`./foo/bar`), an import shown in prose\n> (`import \'./fuz.css\'`) — **wrap it in backticks**; that\'s the escape hatch\n> that says "literal, don\'t follow." Source TSDoc additionally must not point\n> outside its own repo (see §4).\n\n## 2. src/lib module references (backticked, src/lib-relative, no leading `./`)\n\nMarks the target as a code-like identifier — a module name, not a navigable\nfilesystem path.\n\n> **Rule**: a backticked reference to a **same-repo** src/lib module MUST be the\n> bare src/lib-relative form — never `../foo.ts`, never `./foo.ts`, never\n> `src/lib/foo.ts` (the redundant prefix), never `./src/lib/foo.ts`. The\n> backticks frame the token as a module identifier; a `src/lib/` prefix or `./`\n> `../` traversal contradicts that framing. Bare paths are the only place `./`\n> and `../` belong.\n\n> **Backticks are an escape hatch.** This rule applies only to references that\n> resolve to a same-repo module. A backticked path that *isn\'t* one — a\n> cross-repo path, a deliberately-literal example, explanatory prose — is left\n> exactly as written. Don\'t rewrite `` `../some-other-repo/x.ts` `` or a\n> non-module path into the module form; the backticks mean "treat this\n> literally."\n\n- From any file inside src/lib: "`auth/account_schema.ts`" refers to\n  `src/lib/auth/account_schema.ts`. Prefer this over both\n  "`../auth/account_schema.ts`" (backticked with prefix — defeats the identifier\n  framing) and `../auth/account_schema.ts` (bare — reads as filesystem path)\n- From files outside src/lib (root CLAUDE.md, docs/, src/test/): include the\n  `src/lib/` prefix — "`src/lib/auth/CLAUDE.md`". The path-relative-to-src/lib\n  form ("`auth/CLAUDE.md`") is also acceptable from src/test/, but the\n  full-prefix form is unambiguous at any depth\n- Applies to any file under src/lib, including subsystem CLAUDE.mds:\n  "`auth/CLAUDE.md`", "`http/CLAUDE.md`"\n- Section refs follow: "`auth/CLAUDE.md`" §Middleware (backticks wrap the\n  module, `§Heading` follows outside the backticks)\n- Examples (all referring to a same-repo module):\n  - ✅ "`server/upload_route.ts`" — the bare src/lib-relative form\n  - ❌ "`src/lib/server/upload_route.ts`" — redundant `src/lib/` prefix\n  - ❌ "`./src/lib/server/upload_route.ts`" — prefix plus a `./`\n  - ❌ "`../server/upload_route.ts`" — backticked but traversal-relative\n  - ❌ "`./classroom_service.ts`" — backticked but self-relative\n\n## 3. Code-shaped things outside src/lib (backticks for code, not paths)\n\n- CLI commands: `gro check`, `deno task scry`\n- Top-level project files: `package.json`, `gitops.config.ts`, `tsconfig.json`\n- System/config identifiers: `~/.fuz/`, `~/.mg/config.json`\n\n## 4. Cross-repo references\n\nTo point at a file in *another* workspace repo, use a **bare** navigational\npath (form 1) — `../other-repo/src/lib/foo.ts` or `~/dev/other-repo/...`. The\nbackticked module form (form 2) is **same-repo only**: it resolves against the\ncurrent repo\'s module index, so it can\'t name another package\'s module. For a\npublished package\'s module, the import-specifier form is the right code\nreference (`@scope/pkg/foo.ts`); a bare relative path is for navigation.\n\nTwo constraints follow:\n\n- **A bare cross-repo path must resolve to a real file.** It\'s a navigable\n  link; a stale `../old-name/...` left behind after a repo is renamed or moved\n  is a broken reference. Keep these accurate as the workspace changes.\n- **TSDoc must not use `../` to leave the repo.** Source comments render into\n  the published API docs, where the shipped package has no sibling repos — an\n  out-of-repo `../` becomes a dead link. Keep TSDoc references repo-local;\n  attribute external inspiration in prose without a navigable path, or link a\n  URL. (Backticked explanatory paths remain the escape hatch — see §2.)\n\nEach file\'s relative paths assume the reader is in the file\'s parent directory.\nFrom `~/dev/CLAUDE.md`, project paths are `./project/`. From a deeply nested\nfile, prefer a workspace-root-anchored path (`setup/scripts/foo.md`) over deep\n`../../../scripts/foo.md`.\n\n## 5. Import specifiers (code imports, not doc prose)\n\nThe forms above govern paths *written in docs/prose*. Import specifiers in\n**source** use the real source extension (`.ts` / `.svelte.ts` / `.svelte`),\nnever the old `.js`-for-a-`.ts`-file form, and pick the alias by **whether the\nmodule ships**:\n\n- **`src/lib` (ships as `dist`) → relative only** (`./`, `../`):\n  `import {x} from \'./sibling.ts\'` — the build rewrites these to `.js` into\n  `dist`. Aliases break here: both `$lib`/`$routes` (Vite-only) and\n  `#lib`/`#routes` (resolve to `./src/lib/*`, absent from the tarball —\n  `"files": ["dist"]`) give consumers `ERR_MODULE_NOT_FOUND`.\n- **Everything else → `#lib/*` / `#routes/*`** package.json subpath imports\n  (`"imports": {"#lib/*": "./src/lib/*"}`): routes, components, vitest tests, and\n  spawn-outside-Vite entries (Deno/Node servers, benchmarks, `deno` / `bun` /\n  `gro run` scripts) — none of it shipped. One mechanism resolves across Vite,\n  Node, Bun, Deno, and Gro\'s loader, so the alias never depends on which runtime\n  spawns the file. (`$lib`/`$routes` are retired — Vite-only, so a raw `deno run`\n  fails `Import "$lib/…" not a dependency`.)\n- **Cross-package** `@fuzdev/<pkg>/sub.ts` → resolves via the target\'s `exports`\n  `.js`/`.ts` mirror to its `dist`. (Non-mirror packages like `@fuzdev/blake3_wasm`\n  keep `.js`.)\n\n`$app`/`$env` stay (virtual modules, not file paths). `@ryanatkn/eslint-config`\nbans `$lib`/`$routes` everywhere and `#lib`/`#routes` inside `src/lib`; the rule\ncovers type-position imports too (`import(\'#lib/db/db.ts\').Db`). The\n`survey_import_extensions` survey enforces the extension across the ecosystem.\n\n## Web-rendered caveat\n\nIn files published via mdz on a website (this skill renders on fuz_docs), `./foo`\nand `../foo` examples must be backticked to prevent mdz from rendering them as\nbroken `<a>` tags. `~/dev/foo` and bare workspace-root paths (`setup/foo`) are\nsafe bare in web context — mdz doesn\'t auto-linkify those prefixes.\n\n## Anti-patterns\n\nThe linkifier won\'t fire on these, costing tokens and navigability:\n\n- **Mixing the two forms**: backticks + a leading `./` or `../` is the\n  wrong-of-both-worlds case. Pick a form. "`./foo.md`" should be either bare\n  `./foo.md` (navigational) or — for src/lib — "`subsystem/foo.ts`" (module-form,\n  drop the relative prefix).\n- **Backticking a navigable target**: "`~/dev/fuz_util`" reads as a code\n  identifier when it\'s actually a path. Use bare `~/dev/fuz_util`.\n- **Redundant markdown-link syntax** when target equals visible text:\n  `[../README.md](../README.md)` is redundant; bare `../README.md` already\n  auto-links. Same for `[~/dev/foo](~/dev/foo)` — collapse to bare `~/dev/foo`.\n  Reserve `[text](url)` for cases where the visible token _isn\'t_ the path —\n  e.g. a package-name-as-link: `[@fuzdev/fuz_app](../../fuz_app)`.\n\n## Formatter cautions (these have bitten real docs)\n\n- A line wrapping after `+` becomes a sublist. `cell + fact` followed by a formatter\n  wrapping to `+ cell_history` reflows as a bullet. Rephrase\n  (`cell, fact, and cell_history`) or keep the `+` mid-line.\n- Bare `_` in inline prose mixed with backticked identifiers can be parsed as\n  italic delimiters and mangle text — eating spaces and swapping characters.\n  Backtick identifiers like `scope_id` or `cell_*` even when the surrounding\n  sentence isn\'t otherwise code-heavy. When several `_`-bearing identifiers\n  appear in one sentence, restructure as a bullet list so each lands at\n  end-of-line away from prose interactions.\n'},{slug:"rust-dependencies",title:"Approved Rust Dependencies",content:"# Approved Rust Dependencies\n\nThe canonical allowlist of external crates approved for Rust workspaces\nacross the ecosystem. Prefer these; reach outside the list only with\nexplicit approval (see [§Adding a dependency](#adding-a-dependency)).\n\n**Scope**: the canonical (non-experimental) Rust workspaces — CLIs and\ndaemons, the WASM/FFI/N-API bindings, the web servers and their spine crates.\nDifferent-paradigm or pre-canonical repos (games, protocol research) carry\ntheir own deps and are out of scope here. For an external project adopting\nfuz-stack, the list is advisory — a vetted starting set, not a gate; the\napproval *process* below applies only inside the ecosystem workspaces.\n\n**Source of truth**: each repo's root `[workspace.dependencies]`. This doc\nmirrors the **union** of those for human and agent audit; it is not\ngenerated. Any single workspace carries a small subset (zap's direct\nexternal set is ~11 crates; the forge's ~24 — everything else arrives\ntransitively via the spine). Verify against the workspaces periodically.\n\nCrates internal to a workspace (declared with `path = ...`) are not\ndependencies in this sense and never appear here — including cross-repo path\ndeps onto the fuz spine crates.\n\nA few approved crates are pinned at the **member-crate** level rather than in\na root `[workspace.dependencies]`: `js-sys` (optional, feature-gated),\n`wasm-bindgen`, and `talc` (wasm32-only target dep) in `tsv_wasm`, `similar`\nand `tempfile` in `tsv_debug`, `libc` in `zzz_server`. They're real external\ndeps and belong here.\n\n## Serialization & encoding\n\n| Crate | Purpose |\n| ----- | ------- |\n| `serde` | Derive-based serialization framework |\n| `serde_json` | JSON (tsv enables `preserve_order` + `float_roundtrip`) |\n| `postcard` | Compact binary serialization (the fuzd UDS wire) |\n| `hex` | Hex encoding/decoding |\n| `base64` | URL-safe base64 (tokens) |\n\n## Errors & core utilities\n\n| Crate | Purpose |\n| ----- | ------- |\n| `thiserror` | Derive typed error enums |\n| `futures` / `futures-util` | Async combinators, `BoxFuture` |\n| `time` | Date/time |\n| `uuid` | UUIDs |\n| `semver` | Semantic-version parsing |\n| `url` | URL parsing |\n| `tempfile` | Temp files/dirs (`NamedTempFile`) |\n| `smallvec` | Stack-allocated small vectors |\n| `bumpalo` | Arena allocation (`collections` feature) — tsv's core AST strategy; see rust-perf.md §Arena allocation |\n| `string-interner` | String interning |\n| `phf` | Compile-time perfect-hash maps/sets (keyword tables) |\n| `unicode-ident` / `unicode-segmentation` / `unicode-width` | Unicode text handling |\n| `similar` | Text diffing (tsv's debug/compare tooling) |\n\n## Async runtime & networking\n\n| Crate | Purpose |\n| ----- | ------- |\n| `tokio` | Async runtime |\n| `tokio-util` | `CancellationToken`, `TaskTracker` |\n| `axum` | HTTP server (on hyper) |\n| `axum-extra` | axum extras (typed headers, cookies) |\n| `tower` / `tower-http` | Service middleware |\n| `reqwest` | HTTP client |\n| `rustls` | TLS backend for `reqwest` — installs the `ring` crypto provider as the process default (`reqwest` is wired `rustls-no-provider`) |\n\n## Concurrency\n\n| Crate | Purpose |\n| ----- | ------- |\n| `parking_lot` | `Mutex`/`RwLock` for sync-only critical sections (no poisoning). See rust-perf.md §Async lock hygiene for when to use `tokio::sync` or `std::sync` instead. |\n| `lru` | Bounded LRU cache backing the `RateLimiter` — caps tracked keys so a key-enumeration attacker can't grow the map unboundedly (twin of fuz_app's `LruMap`). |\n\n## Database\n\n| Crate | Purpose |\n| ----- | ------- |\n| `tokio-postgres` | Async PostgreSQL client |\n| `deadpool-postgres` | Connection pooling |\n\n## Crypto & auth\n\n| Crate | Purpose |\n| ----- | ------- |\n| `blake3` | Content-addressed hashing, token hashing |\n| `argon2` | Password hashing |\n| `ed25519-dalek` | Ed25519 signing/verification (artifact + release signatures) |\n| `hmac` / `sha2` | HMAC-SHA256 (signed cookies, keyring) |\n| `subtle` | Constant-time comparison |\n| `zeroize` | Secure memory clearing |\n| `getrandom` | OS randomness — the spine standard for new randomness (`fuz_sys::rand`, `fuz_auth`, `fuz_storage`) |\n| `rand` | RNG — pinned `0.8` in `[workspace.dependencies]`, consumed only by `fuz_sign` (the `ed25519-dalek` → `rand_core 0.6` constraint). Prefer `getrandom` for new code. |\n\n## Filesystem & OS\n\n| Crate | Purpose |\n| ----- | ------- |\n| `nix` | POSIX syscalls (advisory `flock`, permissions) |\n| `libc` | Raw libc FFI for syscalls/types beyond `nix` (PTY, signals) |\n| `notify` | Filesystem watching (inotify / FSEvents) |\n| `tar` | tar archives |\n| `flate2` | gzip / deflate |\n\n## CLI\n\n| Crate | Purpose |\n| ----- | ------- |\n| `argh` | Derive arg parser, size-optimized. See rust-patterns.md §CLI Patterns for the parser-tier guidance. |\n\n## Logging\n\n| Crate | Purpose |\n| ----- | ------- |\n| `tracing` | Structured logging |\n| `tracing-subscriber` | Subscriber / formatting layers (consumed via `fuz_sys::logging`, not per-consumer) |\n| `tracing-appender` | Non-blocking file appender |\n\n## WASM, N-API & host\n\n| Crate | Purpose |\n| ----- | ------- |\n| `wasm-bindgen` | JS interop (wasm-pack) |\n| `js-sys` | engine-native `JSON.parse` for the wasm-bindgen parse exports (tsv) |\n| `talc` | WASM global allocator (`tsv_wasm`, wasm32-only target dep) — pure-Rust `no_std` replacement for std's dlmalloc; use the `WasmGrowAndExtend` source (the default claim source fragments a long-lived instance's linear memory). Pulls `lock_api` + `allocator-api2` into the wasm32 graph only |\n| `napi` / `napi-derive` / `napi-build` | N-API bindings — the native Node.js/Bun npm path (`tsv_napi`); `napi-build` is the matching build dep |\n| `wit-bindgen` | Component-model bindings |\n| `wasmtime` / `wasmtime-wasi` | WASM host (tests, benches) |\n\nSee wasm-patterns.md for the binding-layer conventions these support.\n\n## Image processing\n\n| Crate | Purpose |\n| ----- | ------- |\n| `libvips` | Rust bindings to the system **libvips** image library — the same engine `sharp` wraps — for decode/resize/encode (JPEG/PNG/WebP/AVIF), EXIF-orientation baking, metadata stripping, and thumbnailing. For spine-consumer servers with an image-upload pipeline (e.g. `visiones_server`). Dynamically links system libvips: `libvips42` (Debian) at runtime + `libvips-dev` at build time — not a static-musl crate; on a Debian host `zap` installs it via apt. The `unsafe` FFI lives inside the binding — consumer crates keep `unsafe_code = \"forbid\"`. Chosen over the pure-Rust `image`/`ravif`/`image-webp` stack because matching `sharp`'s formats there pulls in `libwebp` + `dav1d` C deps anyway, across more crates and with worse parity. |\n\n## Crate-vs-feature isolation (supply-chain)\n\nWhen a capability must be kept **out of** a binary's dependency graph for\nsecurity or trust reasons, make it a **separate crate, not a cargo feature**.\nCargo unifies features across a `--workspace` build, so a feature-gated\n\"signing\" or \"test-hasher\" path can be silently turned on by an unrelated\ncrate's feature selection. A separate crate can't be: it is either in the\ndependency graph or it is not, and that is auditable.\n\n- `fuz_sign` is a separate crate (not a `fuz_crypto` feature) so signing stays\n  out of the `fuz` consumer graph — `fuz` links verification-only `fuz_crypto`.\n- `fuz_testing` is a separate crate (not a `fuz_auth` feature) so the weakened\n  test Argon2 params can't reach a production binary.\n- Enforcement is the `cargo xtask check-release` dep-graph audit (`fuz_audit`),\n  which fails if any non-`testing_`-prefixed binary transitively links a\n  forbidden crate; workspaces add extra forbids via `AuditRules`. See\n  rust-spine.md §xtask & check-release for the entry points and the\n  built-in layering rules.\n\n## Shared low-level leaves (consolidation candidates)\n\nThe pattern is proven: the sandboxed config-eval harness was extracted from\nzap into the spine's `fuz_eval` — a spine-free leaf (no tokio-server/HTTP/DB\nsurface) consumable even by spine-free repos — and is now shared across\nconsumers, including the JS wrapper ingredients themselves\n(`DETERMINISM_STUBS_JS`, `CONSOLE_TO_STDERR_JS`,\n`build_extract_export_wrapper`). Remaining candidates, still independently\nreimplemented:\n\n- a minimal dotenv (`KEY=VALUE`) parser — three copies today (`zap_core`,\n  plus two inside zzz: the CLI's daemon-env loader and its xtask),\n- an env-isolating subprocess harness with a capped output drain —\n  prototyped in `fuz_forge_server`, promotion deferred until a second\n  consumer,\n- the atomic-write/flock transactional-file dance for spine-free consumers —\n  `fuz_sys::fs::write_atomic` is canonical but zap can't link it and\n  hand-rolls both authority calibrations (rust-patterns.md §Transactional\n  state files),\n- an exponential-backoff retry combinator — no generic one exists;\n  `fuz_sidecar`'s crash-recovery respawn loop is the only backoff\n  implementation, and it's supervision-shaped, not request-retry.\n\nSignal-crate convention: prefer `nix` for syscall wrappers; reserve `libc` for\ntypes/constants `nix` doesn't expose (PTY). Avoid pulling both into one\nworkspace for the same job.\n\n## Feature hygiene\n\n- **`default-features = false` + explicit feature lists** for deps with heavy\n  optional trees — `reqwest`, `nix`, `notify`, `futures-util` all do. Opt into\n  exactly what the workspace uses; don't inherit a crate's default surface.\n- **`multiple_crate_versions = \"allow\"`** (rust-patterns.md §Lints) tolerates\n  *forced* duplicate majors from the dep graph — e.g. `tsv` carries hashbrown\n  0.16 (via `string-interner`) and 0.17 (via `serde_json` → `indexmap`),\n  unresolvable until `string-interner` bumps upstream. Not a license to ignore\n  version drift you control.\n\n## Adding a dependency\n\nNew crates — whether a third-party dependency or a first-party workspace\nmember — are added deliberately, not incidentally:\n\n- Prefer the standard library, then this list, before anything new.\n- A new dependency needs explicit approval — name it, its purpose, what it\n  replaces or enables, and its transitive footprint.\n- Creating a new first-party crate (a new `crates/<name>/` workspace member)\n  likewise needs explicit approval — minting a new crate boundary is a\n  build-graph and release-surface decision. Adding a module, file, or\n  directory inside an existing crate doesn't; the gate is only on the new\n  crate itself.\n- Add it at the workspace level (`[workspace.dependencies]`) so member\n  crates share one version, then record it here.\n- Removing an unused dependency is pre-authorized — no approval needed. Verify\n  nothing references it (including features and build scripts), then drop the\n  entry. Removing the last user of a crate? Drop it from the workspace and\n  this list in the same change.\n"},{slug:"rust-patterns",title:"Rust Patterns for the Fuz Ecosystem",content:`# Rust Patterns for the Fuz Ecosystem

**Applies to**: any Rust workspace adopting fuz-stack conventions — the
ecosystem's own (the \`fuz\`/\`fuzd\` CLI + daemon and spine crates, the
spine-consumer servers \`zzz\`/\`fuz_forge\`, the \`zap\` convergence CLI, the
\`tsv\` parser/formatter, the \`blake3\` WASM bindings) and new or external
workspaces starting from these conventions. All use **Rust edition 2024**,
resolver 2.

**Boundary**: this skill owns *conventions and patterns* — rules a workspace
adopts, with ecosystem repos cited as exemplars. Each repo's \`CLAUDE.md\` owns
its *inventory* (crate lists, commands, env vars, package tables) and is
authoritative for project-specific choices. Every pattern here stands alone;
where a spine crate is named as the canonical implementation, that's the
ecosystem wiring — a spine-free workspace adopts the pattern's shape (zap is
the worked precedent throughout).

Companion references: ./rust-spine (spine surface + consumer-server
contracts), ./rust-perf (performance), ./rust-dependencies (approved
crates), ./twin-impl (TS ↔ Rust twins), ./wasm-patterns (binding
crates).

## Core Values

- **No backwards compatibility**: Pre-1.0 means breaking changes. Delete old
  code, don't shim.
- **Code quality**: \`unsafe_code = "forbid"\`, pedantic lints, tests expected.
- **Performance**: If it's slow, it's a bug. See ./rust-perf.
- **Copious \`// TODO:\` comments**: Mark known future work. \`todo!()\` is
  \`warn\` workspace-wide — \`#[allow(clippy::todo)]\` with justification when
  needed.
- Doc comments (\`///\`) for public API; inline (\`//\`) for implementation
  notes.

## New Workspace Checklist

Bootstrapping a fuz-stack Rust workspace, in order:

1. \`[workspace.package]\`: \`edition = "2024"\`, \`version = "0.1.0"\`,
   \`license = "MIT"\`, \`publish = false\` (until publishing is real);
   \`resolver = "2"\`.
2. Copy the canonical \`[workspace.lints.*]\` block (§Lints); every crate takes
   \`[lints] workspace = true\`. Add a root \`clippy.toml\` with
   \`allow-{unwrap,expect,panic}-in-tests = true\`.
3. Copy the canonical \`[profile.release]\` (§Release Profile). Add derived
   profiles only with a driving need.
4. Crate naming: \`{project}_{crate}\`; short bare names only for
   frequently-typed binaries (§Project Structure).
5. Errors from day one: \`thiserror\` library enums, a binary wrapper error,
   \`fn main() -> ExitCode\` (§Error Handling). Pick the exit-code dialect
   early and test it (§CLI Patterns).
6. Dev automation: spine-consuming workspaces add an \`xtask\` crate wrapping
   \`check-release\` (./rust-spine §xtask & check-release); binding/library
   repos may use a script runner instead (tsv and blake3 drive builds,
   validation, and publishing through Deno tasks, no xtask).
7. Deps: start from ./rust-dependencies; share versions via
   \`[workspace.dependencies]\`.

## Lints

The canonical workspace lint block:

\`\`\`toml
[workspace.lints.rust]
unsafe_code = "forbid"
missing_debug_implementations = "warn"
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

# Pedantic overrides
module_name_repetitions = "allow"
must_use_candidate = "allow"
similar_names = "allow"
too_many_lines = "allow"

# Nursery overrides
significant_drop_tightening = "allow"

# Cargo overrides (private repos)
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

**Workspaces may diverge deliberately** — a domain can earn extra allows
(tsv carries a parser-shaped superset: u32-position cast allows, relaxed
\`missing_debug_implementations\` for interner-holding types, plus restriction
\`unreachable = "warn"\`). Superset-by-design is not drift; the repo's
\`CLAUDE.md\` documents it.

### Crate-level overrides — re-declare the whole block

A crate that needs \`unsafe_code\` (C-FFI/N-API ABI layers, wit-bindgen
components, PTY wrappers) can't *partially* override the workspace \`forbid\`:
Cargo replaces the entire \`[lints]\` table, so relaxing one lint means
re-declaring **all** the others in the crate's own \`[lints]\`. Re-paste the
full workspace block and change only what must change.

- Full-re-declare exemplars: \`tsv_ffi\`, \`tsv_napi\`, \`blake3_component\` (the
  last also allows two generated-code false positives).
- The trap is real: \`fuz_pty\`'s re-declared block silently dropped
  \`clone_on_ref_ptr\` — exactly the failure mode partial re-declaration
  invites. Diff the override against the workspace block when touching one.
- A binding crate that doesn't actually emit unsafe keeps
  \`[lints] workspace = true\` and inherits \`forbid\` — many wasm-bindgen crates
  do.

## Release Profile

\`\`\`toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
\`\`\`

Slower builds (~2x), no symbol names in backtraces — worth it for binary size
and performance. Carried byte-identically across the ecosystem workspaces;
treat it as the default, not a per-repo choice.

Deliberate exceptions show the escape hatch:

- **WASM-first repos** set \`opt-level = "s"\` as the base (blake3), overridden
  per-build via \`RUSTFLAGS\` (./wasm-patterns).
- **Derived profiles for a driving need**: tsv's \`[profile.corpus]\`
  (\`inherits = "release"\`, \`panic = "unwind"\`) exists because its FFI wraps
  entry points in \`catch_unwind\` — dead under \`panic = "abort"\` — for the
  Prettier differential-corpus run; its \`[profile.profiling]\` keeps
  \`debug = true\`, \`strip = false\` for symbolicated profiles.

## Error Handling

Libraries export \`thiserror\` enums; binaries wrap them via \`#[from]\` and own
exit:

\`\`\`rust
// Binary crate — wraps library errors
#[derive(Debug, Error)]
pub enum CliError {
    #[error(transparent)]
    Client(#[from] ClientError),

    #[error(transparent)]
    Artifact(#[from] ArtifactError),
}

// Central error handling — return ExitCode, never std::process::exit
fn main() -> ExitCode {
    let Err(e) = run() else { return ExitCode::SUCCESS };
    eprintln!("error: {e}");
    if let Some(hint) = e.hint() {
        eprintln!("hint: {hint}"); // print site owns the \`hint:\` label
    }
    ExitCode::from(e.exit_code()) // -> u8
}
\`\`\`

Use \`#[source]\` to chain causes: \`Display\` shows only the variant's own
message; the chain surfaces via \`e.source()\` for structured logging
(\`ResponseParse(#[source] serde_json::Error)\`). For parsers, carry \`position\`
+ optional context on variants so the renderer can draw a caret pointer
(tsv's \`ParseError\`).

### Helper methods

- **\`.hint()\`** — user-facing fix suggestion. \`Option<HintMessage>\` when most
  variants lack one, or \`&'static str\` (\`""\` = absent) when all have one.
  \`HintMessage\` (\`Static(&'static str) | Owned(String)\`) is the shared
  primitive (\`fuz_sys::cli\`); import it, don't re-declare. Hint strings carry
  *advice only* — the print site owns the \`hint:\` label.
- **\`.exit_code()\`** — \`u8\` for \`ExitCode::from\`; match arms over variants.
  Code policy: §CLI Patterns.
- **Classifiers** — small \`&self -> bool\` methods the caller branches on,
  named for the decision, not the variant: \`is_transient\` (retry might
  succeed — use this verb everywhere), \`is_recoverable\` (restart),
  \`needs_daemon_start\`, \`is_security_violation\`. Each answers one dispatch
  question by matching variants; a wrapper forwards its inner classifier,
  never re-decides. They land wherever a consumer branches — including
  library errors: \`fuz_archive\` and \`fuz_release\` expose
  \`is_security_violation()\`, consumed downstream to split exit codes.

**Placement**: helpers belong on the binary's top-level error; library errors
stay thin (variants only). Exception: a library with exactly one binary
consumer may carry \`exit_code()\`/\`hint()\` itself with the binary delegating —
\`zap_core::Error\` does this to co-locate exit-code policy with the variants.

**Single-source the hint table; wrappers delegate.** When a wrapper owns a
variant whose source already has a hint, delegate — one wording on every
path. The source returns \`Option<HintMessage>\` so it can carry an
interpolated \`Owned\` hint. A static-only leaf that doesn't dep the shared
primitive stays \`Option<&'static str>\`; the first aggregator that does lifts
it with \`.map(HintMessage::Static)\`. Don't push a dep onto a pure leaf just
to unify the hint type.

For WASM boundary errors (\`JsError\`, typed WIT error enums) see
./wasm-patterns.

## Async Runtime & Graceful Shutdown

Server/daemon crates use **tokio** + **tokio-util**'s \`CancellationToken\`:
one token owned at the top, cloned into every task that must react. The
signal → token helper is single-sourced — in the ecosystem that's
\`fuz_sys::signal::shutdown_token()\` (a spine-free workspace hand-rolls the
same shape once: spawn a task selecting \`ctrl_c()\` / SIGTERM, cancel the
token):

\`\`\`rust
let shutdown = fuz_sys::signal::shutdown_token();

let server = Server::new(addr, shutdown.clone(), /* ... */);

tokio::select! {
    res = server.serve() => res,
    () = shutdown.cancelled() => Ok(()),
}
\`\`\`

axum's \`with_graceful_shutdown(shutdown.cancelled())\` stops accepting
connections but drains in-flight requests; always bound the drain with a
timeout \`select!\` — without it a hung handler keeps the process alive
forever (the spine ships this as \`fuz_http::serve_with_shutdown\` +
\`DEFAULT_DRAIN_TIMEOUT\`, ./rust-spine).

Long-running tasks check the token via \`select!\`, and every shutdown branch
flushes pending work before returning. The reference shape is a
\`Notify\`-driven flusher: wakeups debounced behind the most recent event so an
idle daemon doesn't tick, every \`select!\` arm includes
\`shutdown.cancelled()\`, and the shutdown arm does a final \`flush()\`.

\`tokio_util::task::TaskTracker\` when shutdown must verify "all workers exited
cleanly"; skip it for short-lived or naturally-dropped tasks.

**Don't**: \`std::process::exit()\` inside async code (bypasses Drop); bare
\`tokio::spawn\` with no shutdown awareness for anything holding resources;
\`tokio::sync::broadcast\` as a poor-man's cancellation token.

## Naming Conventions

Natural Rust naming for free functions — **not** the \`domain_action\` style of
this stack's TypeScript. \`fn parse\`, \`fn create_artifact\` — not
\`fn artifact_create\`.

## Idioms

Style guidance the lint config encodes (\`clone_on_ref_ptr\`, \`panic\`,
\`unwrap_used\` warn). Ecosystem-specific bits called out with examples.

### Prefer enums for closed sets

Fixed variant sets → enum, not \`bool\` or sentinel string; exhaustiveness makes
every \`match\` a contract that fires when variants change.

**At a deserialization boundary this is also validation.** A \`String\` field
for a closed set accepts typos that fail at a late runtime guard — or
silently do the wrong thing. A \`#[serde(rename_all = "…")]\` enum rejects them
at parse with \`unknown variant 'x', expected one of …\`:

\`\`\`rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FirewallPolicy { Allow, Deny, Reject } // "denyy" fails at parse, not at apply
\`\`\`

Valid values deserialize identically, so existing config files keep working —
the enum only starts rejecting inputs that were always bugs. Even a
single-variant enum earns its keep: it rejects unknown values now, and the
next variant forces every \`match\` to handle it.

**Leniency is only for genuine extensibility.** Keep a \`String\` (or a
catch-all variant) *only* when the value passes through verbatim to an
external system whose set is genuinely open and you don't dispatch on it.

### Make impossible states unrepresentable

The umbrella principle: model so the type system rejects nonsense — don't
lean on a runtime check or a comment.

- **Mutually-exclusive → enum; co-present → struct.**
- **A field only meaningful for some variants belongs inside those
  variants**, not as a sibling \`Option\` that gets silently ignored elsewhere.
- **Carry the payload on the variant** so "this combination can't happen" is
  a compile fact.

**Worked reference — \`zap_types\`**: \`TargetLocation\` (local+host
unrepresentable, de/serializing through a flat wire struct via
\`#[serde(try_from/into)]\`); payload-on-variant (\`strip_components\` inside
each tar variant of \`ExtractMode\` — \`TarXz\`/\`TarGz\` — so the no-extract
variant can't carry one; the sudo list inside \`UserSudo::Restricted\`);
single-variant tagged enums kept on purpose (\`BuildSource::Remote\`,
\`SourceVerify::Minisign\`); transparent scalar newtypes validated at the serde
boundary (\`AccountName\`, \`Mode\`, \`ContentHash\` — 64-lowercase-hex pin,
\`EnvVarName\` — POSIX-identifier, shell-injection-safe map key); and
typed-enum-replaces-bool (\`ExternalState\` — an enumerable cache-leak-source
model replacing an \`external_state: bool\` that was "carried but never
consumed"). \`fuzi_core\` is a second exemplar (\`Os\`/\`Cpu\`/\`Libc\` +
negation-aware \`PlatformToken\`, \`LockfileVersion::from_raw\`, an \`Integrity\`
newtype wrapping \`ContentHash\`).

**Two anti-patterns reviewers actually hit:**

- **The flattened discriminated union.** A \`struct { available: bool, error:
  Option<String> }\` whose doc-comment says "matches a TS discriminated union"
  but whose type permits the impossible combos. The doc-comment *is* the
  smell — lift to an enum with payload-on-variant and a hand-written
  \`Serialize\` for the flat wire shape (zzz's \`ProviderStatus\`:
  \`Available{…} | Unavailable{…, error}\`).
- **The \`json!({"kind": …})\` closed set.** Response bodies built with bare
  \`json!({"kind":"truncated", …})\` across \`match\` arms are a discriminated
  union evading the enum rule — model as \`#[serde(tag = "kind", rename_all =
  "snake_case")]\` so each variant carries only its payload. Identical wire
  output (\`fuz_forge_wire\`'s \`BlobBody\`: \`Text{text} | Binary |
  Truncated{size}\`).

### Push a unifying newtype through the wire

A newtype introduced to retire primitive drift must reach the
wire/persistence shapes, not just the compute helper — otherwise the \`String\`
it was meant to retire survives at the boundary. When the wire format is
fixed (a signed manifest), a per-field serde adapter serializes the newtype
to the legacy primitive so existing signatures stay valid:
\`fuz_crypto::ContentHash\` ships through the release manifest via
\`#[serde(with = "fuz_crypto::blake3_hex")]\`, keeping the newtype as the
in-memory carrier. zap threads its own \`scalar::ContentHash\` end-to-end
(schema → lock entries → resolved content) with two provenance constructors —
validating \`new\` for parsed input, infallible \`of_bytes\` for computed hashes.
The same shape serializes closed sets to primitive wire values:
\`fuz_http::JsonrpcErrorCode\` (./rust-spine §JSON-RPC envelope).

### Zero-cost / low-cost abstractions

- **Function pointers over trait objects** for statically-known dispatch:
  a spawn config holds \`build_command: fn(&Path, Option<&Path>) -> Command\`,
  not \`Box<dyn Fn(…)>\`.
- **Callback resolution over allocating accessors** in hot paths: tsv's
  \`SymbolResolver\` trait pairs allocating \`resolve_symbol(sym) -> String\`
  with zero-alloc \`with_resolved_symbol(sym, |s| …)\`.
- **\`Cow\`-shaped wrappers** when some returns are constants and others need
  interpolation: \`HintMessage\` (\`Static | Owned\`).

### Avoid clone smells

\`clone_on_ref_ptr\` warns on \`arc.clone()\` — write \`Arc::clone(&arc)\` so the
call site signals a refcount bump, not a deep copy. Reach for \`Cow<'_, str>\`
only when callers genuinely have mixed-ownership data and the borrowed case
is common.

## Dependency Injection

The TS \`*Deps\` discipline doesn't translate 1:1 — much of what TS solves with
DI (runtime agnosticism, module mocking, deterministic clocks) Rust solves
natively with the crate graph, trait bounds, monomorphization, test crates,
and tokio's mock clock. Treat the pattern as an **escalation ladder**: start
at the floor, climb only when a concrete need requires it.

### Effects at the edges

The ladder's goal is a pure-ish core with effects pushed to the boundary —
most code testable without IO, mocks, or a runtime:

- **Split IO from logic; inject the result, not the source.** A function that
  reads a file *and* decides on the contents becomes a thin edge doing the
  read + a pure function over the parsed value.
- **Presentation is a returned value, not prints in the library.** The
  library returns a structured result; the binary renders it (human /
  \`--json\` / \`--quiet\`). \`println!\` in library code is an effect like any
  other.
- **Contain async to the IO seam.** One async phase goes behind a trait; the
  rest of the core stays sync under \`block_on\` / \`spawn_blocking\`. Coloring a
  whole API async for one bounded phase is a smell — though a CLI doing real
  network/subprocess IO throughout (zap) legitimately runs \`#[tokio::main]\`.

### Active rungs

**Floor — just import and call.** Pure utilities (fs helpers, canonical JSON,
parsers, validators) don't enter the pattern at all.

**Default — concrete \`*Options\` struct + direct refs.** State owned by the
app (pool, keyring, audit emitter) passes as refs via a per-call-site
\`*Options\` struct (or \`*RouteState\` for route-group-shared state) holding
\`Arc<T>\` fields:

\`\`\`rust
pub struct SignupOptions {
    // Capabilities (swappable):
    pub pool: Pool,
    pub password_hasher: Arc<dyn PasswordHasher>,
    pub audit: Arc<AuditEmitter>,
    pub signup_ip_rate_limiter: Option<Arc<RateLimiter>>,
    // Parameters (fixed):
    pub signup_fail_floor_ms: u64,
    pub signup_fail_jitter_ms: u64,
}
\`\`\`

Capabilities + parameters collapse into one struct. **No \`*Deps\` suffix in
Rust** — \`*Options\` for per-call bags, \`*RouteState\` for shared route state.

**Capability traits** — \`PasswordHasher\`, \`Storage\`, \`BootstrapTokenStore\`,
\`FactStore\`. Pure noun, no suffix. Climb here when polymorphism is real:
testability swap (Argon2id ↔ fast test hasher), multi-impl plug-in, or
inversion of definition (the lower crate declares the need; a higher crate
implements). (A hot-path service that never needs a swap stays a concrete
struct — \`Keyring\` deliberately has no trait.)

**Boxed closure factories** — between "just a closure" and "capability
trait": a one-shot injection point that must be generic over the consumer's
type gets a boxed-\`FnOnce\` type alias, not a trait —
\`ExtraActionSpecsFactory<App>\` / \`PreMigrationHook<E>\`
(\`fuz_actions::consumer_lifecycle\`; see rust-spine.md §Server lifecycle).
The caller supplies it once at startup; test binaries hook through it; no
trait ceremony accrues. A trait earns the slot only when the seam has
multiple methods or long-lived polymorphic state.

### Anticipated rungs, resolved differently

Two further rungs were anticipated and never built — the needs they named
were met by lighter shapes:

- **Composite traits per handler tier** (an action-spec dispatcher generic
  over multiple App types) — landed instead as the boxed-\`FnOnce\` factory
  aliases above plus per-tier borrowed capability-bundle structs
  (\`fuz_auth\`'s \`AuthenticatedActionContext\`, \`AccountActionContext\`).
- **Granular \`*Provider\` accessor traits** — no function ever needed a
  narrow bound a composite couldn't express.

Both stay unbuilt; revisit only if a genuinely trait-shaped need appears
that a closure or borrowed struct can't express. If one lands: descriptive
name (\`*Actions\`, \`*Runtime\`), never \`*Deps\`.

### Enum dispatch before trait objects

Before reaching for *any* trait, ask whether the impl set is closed and known
at compile time. If so, an **enum with methods that match on \`self\`**
dispatches statically, needs no vtable, and stays exhaustively checked. A
trait earns its place only when the impl set is genuinely open or crosses a
crate boundary the lower crate can't name.

Exemplars:

- \`fuz_storage::StorageBackend { File, Forge, Ssh }\` — the \`Storage\` trait
  is RPITIT and **never consumed as \`dyn\`**; the enum is the dispatch. The
  enum wrapper must forward each backend's provided-method overrides (the
  streaming \`download_to_file\`/\`upload_file\`) or it silently regresses every
  backend to the buffered default.
- \`zzz_server::Provider\` and \`zap_core::Connection\` (local / ssh / mock) —
  async methods matching on \`self\`, no \`#[async_trait]\`.
- \`zap_core::EventHandler\` (\`Null\` / \`Stdout\` JSON-lines / \`Masking\`
  decorator / \`Multi\` fan-out, + test-only \`Capture\`) — sync \`emit\`.
- \`zap_types::ResourceKind\` — the enum lives in the pure types crate;
  dispatch is parallel **exhaustive matches in free functions** (one in the
  detect pass, one in execute), so adding a kind is a compile error in both.

**The inverse smell: a single-impl \`Arc<dyn Trait>\` is a deferred enum.**
Until a second impl or a test mock exists, prefer a concrete type or enum.
Promotion is real when the swap case is: \`FactStore\` began as a single-impl
\`dyn\` in a consumer and was later lifted into the spine as a documented
capability trait (PG-only / PG+disk / mock).

### Hot/cold dispatch rule

| Path     | Dispatch                                    | Why                                                    |
| -------- | ------------------------------------------- | ------------------------------------------------------ |
| **Hot**  | concrete \`Arc<T>\`, \`<T: Trait>\`, or enum    | Per-request HMAC, rate-limit checks; vtable cost measurable vs the op |
| **Cold** | \`Arc<dyn Trait>\`                            | \`Arc<dyn PasswordHasher>\` (Argon2), \`Arc<dyn FactStore>\`; op cost dwarfs vtable, testability earns it |

\`Arc<dyn>\` also buys *type erasure* (one field, no generic plumbing) — a
separate axis that sometimes justifies it on a hot path.

### Async traits — RPITIT, with one carve-out

Prefer return-position \`impl Future\` in traits for anything consumed as a
generic bound or concrete type — monomorphizes, no boxed-future allocation:

\`\`\`rust
pub trait Storage: Send + Sync {
    fn upload(&self, path: &str, data: &[u8])
        -> impl Future<Output = Result<(), StorageError>> + Send;
}
\`\`\`

**Carve-out**: traits consumed as \`Arc<dyn Trait>\` can't use RPITIT (no \`dyn\`
support yet). Return \`BoxFuture<'_, T>\` manually rather than reaching for
\`#[async_trait]\` — one line, explicit, no proc-macro (\`PasswordHasher\`,
\`BootstrapTokenStore\`). Migrate uniformly when RPITIT gains \`dyn\` support.

### Object-safety annotation on the trait def

Every \`pub\` trait in a shared crate declares its object-safety status as an
item-level \`///\` doc line, by *consumption pattern*:

- **\`**Object-safe**\`** — dispatched dynamically anywhere. Shape locked: no
  generic methods, no RPITIT (use \`BoxFuture\`).
- **\`**Not object-safe**\`** — generic-bound / concrete-adapter use only; free
  to use RPITIT.

The annotation tells contributors *why* they can't add a generic method (or
that they can). Private one-off helper traits need no marker.

### Test injection — concrete impls in a separate crate

Test-only crates ship alternate impls satisfying the production traits — no
\`cfg(test)\` shadows, no runtime branches. The concrete shape is **two
binaries over one \`run_app\` entry point** (production + \`testing_*\` sibling);
see ./rust-spine. A release-time dep-graph audit proves the test impls
can't reach a shipped binary (./rust-dependencies §Crate-vs-feature
isolation).

### Borrowed context, owned providers

Per-request contexts borrow (\`ActionContext<'a>\` holding \`&dyn Fn(&str,
&Value)\` notify, \`&CancellationToken\`, request id); the App struct owns the
underlying \`Arc<T>\`s. The notify seam stays \`&dyn Fn\`, not \`Arc<dyn Fn>\`, on
hot paths — zero alloc. When a handler needs a \`'static\` sender the borrowed
seam can't provide (streaming past the request), see ./rust-spine
§Consumer wiring idioms.

### What stays concrete

tokio, tracing, \`std::fs\`, \`std::env\`, \`std::time\` — concrete by default.
Abstract only when a concrete reuse case appears:

- **Clock**: \`#[tokio::test(start_paused = true)]\` + \`tokio::time::advance\`
  already gives deterministic control; a \`Clock\` trait would wrap what tokio
  abstracts. Skip it.
- **Filesystem**: prefer a domain-scoped trait (\`BootstrapTokenStore\` with
  \`read_token\`/\`delete_token\`) over a general \`Fs\` — narrow seams compose,
  wide ones accumulate methods.
- **Logger / env**: abstract only when production noise blocks log-shape
  assertions or a subsystem needs per-call env override.

## Project Structure

\`\`\`
project/
├── Cargo.toml          # Workspace: shared deps, lints, profile
├── crates/
│   ├── {proj}_*/       # Feature crates ({proj}_core, {proj}_types, …)
│   ├── {proj}_cli/     # Binary (or just {proj}/ — see below)
│   ├── {proj}_{wasm,ffi,napi}/  # Binding crates
│   └── xtask/          # Dev automation (where present)
├── tests/              # Integration tests (where applicable)
└── docs/               # Architecture docs
\`\`\`

Crate naming: \`{project}_{crate}\` (\`fuz_sys\`, \`tsv_lang\`,
\`blake3_wasm_core\`). Exceptions: frequently-typed binaries get short bare
names — fuz's CLI is \`fuz\` (not \`fuz_cli\`), its daemon \`fuzd\`; a crate may
stay \`{proj}_cli\` while its \`[[bin]]\` name is bare (tsv).

Common crate kinds: a foundation crate with minimal deps holding shared
types (\`{proj}_types\`, \`{proj}_lang\`); feature crates with a \`lib.rs\` public
API; interface/binding crates (CLI, C-FFI, N-API, WASM); an xtask crate. A
pure IO-free types crate at the bottom of the graph (zap_types, fuzi_core's
type layer) is the cheapest place to enforce the §Idioms modeling rules.

## Build Configuration

- **build.rs** earns its place for: git-version embedding
  (\`cargo::rustc-env=…_GIT_INFO={hash}\`), compile-time validation of embedded
  data (public keys), and target-triple embedding.
- **xtask** owns dev automation: an \`install\`-style command (build → install
  to the app home → restart daemon), the \`check-release\` audit (spine
  workspaces — ./rust-spine), and publisher-only operations (signing,
  publishing) kept out of shipped binaries. The \`[alias] xtask = "run
  --package xtask --"\` lives in \`.cargo/config.toml\`.
- **Config vs secrets, by source**: a checked-in \`.cargo/config.toml\` \`[env]\`
  holds *only non-secret dev overrides* — anything checked in is silently
  inherited by every \`cargo run\`. Generated, gitignored files (mode 0600) for
  dev env; systemd/secrets infra for prod. Where the transport allows,
  prefer OS-level peer auth over tokens entirely — \`fuzd\` authenticates its
  UDS via \`SO_PEERCRED\` (same-uid), so there is no daemon token to manage.

## Testing

\`cargo test --workspace\`; unit tests in \`#[cfg(test)] mod tests\`, integration
tests in \`tests/\` where applicable. Three testing shapes recur:

- **Parsers/formatters** (tsv): snapshot fixtures (\`tests/fixtures/…\` with
  input files + generated \`expected.json\`, created by a fixture tool, never
  hand-edited) plus a **differential oracle** — corpus comparison against the
  reference implementation (Prettier), built with the unwind profile so
  panics surface as data — plus per-runtime binding tests.
- **Binding crates** (blake3): correctness asserted from the *consumer
  language* against shared test vectors (TS for WASM, a Wasmtime compare
  binary for the component); zero Rust unit tests by design, \`cargo test\` as
  a compile gate. Legitimate — the boundary is where the bugs are.
- **Twin servers** (zzz, fuz_forge): the integration harness is the TS
  cross-backend suite launching the \`testing_*\` binary — see ./twin-impl.

## CLI Patterns

Arg parsing tracks binary size. Three tiers:

| Use case | Parser | +bytes vs \`println!("hello")\` |
|----------|--------|-------------------------------|
| Backend daemons, a few flags | manual \`std::env::args\` | +5 KB |
| User-facing CLIs with subcommands | **argh** | +16 KB |
| Needs env-var binding, shell completions, or \`wrap_help\` | clap (\`derive\`) | +340 KB |

argh is schema-driven (\`#[derive(FromArgs)]\`) — same mental model as
fuz_util's \`args_parse\` (Zod). Where a CLI exists in both TS and Rust, align
flag names and aliases (\`--port\` / \`-p\`). Manual daemons \`match\` on the first
arg and return \`Result\` to the \`main() -> ExitCode\` wrapper — no
\`std::process::exit\` in the async body, no \`args[1]\` panic. Shared input
modes: file path, \`--content <string>\`, \`--stdin\`.

### Exit codes

A small, *stable* contract — treat it as a versioned API: settle it pre-1.0,
assert each category → code in a test, document the table in the crate doc.
Mechanism: \`fn main() -> ExitCode\` + \`exit_code(&self) -> u8\`. **Key codes to
the caller's remediation, not to error type** — there are more error types
than useful codes.

- **Default dialect** (human/script-facing — zap is the canonical impl): \`0\`
  success; \`2\` = the caller must change something local before re-running
  (bad args, config, credentials — "don't retry as-is"); \`1\` = everything
  else (server error, transient failure, local IO — "a retry may help, or
  it's out of the caller's hands"). Don't mint codes for categories nothing
  branches on. A tool whose *success* has grades returns them too (zap: \`0\`
  converged, \`2\` dry-run drift, \`1\` wetrun failure).
- **Agent tier** (automation-primary CLIs whose consumers branch on
  category): \`sysexits.h\` codes **plus** a stable snake_case \`error.kind\` in
  \`--json\`. \`fuzi\` is the reference; \`fuz\` adopts the same taxonomy for its
  operationally-distinct artifact failures (lock held → \`75\`, disk full →
  \`73\`, integrity → \`65\`). Two dialects max — pick by audience.
- **Extend via a structured \`kind\`, not new exit integers.** A code is coarse;
  when a consumer needs finer signal, add \`error.kind\` to \`--json\` — strictly
  more expressive.
- **argh gotcha**: \`argh::from_env()\` hard-exits \`1\` on a parse error — the
  commonest usage error — violating "usage = 2". zap implements the fix:
  parse with \`T::from_args(&[cmd], &args)\` and map the \`EarlyExit\` (\`Ok\` →
  stdout, exit 0; \`Err\` → stderr, exit 2). Adopt that shape wherever the
  usage-code contract matters; several binaries still use \`from_env()\` and
  carry the wrong usage code.

### Flags

- **Dry-run posture is intentional per tool**: convergence/deploy tools
  default to dry-run with opt-in execute (\`zap --wetrun\`); build/prune tools
  default to execute with opt-in \`--dry-run\` (fuz).
- The env-file flag is hyphenated \`--env-file\` (argh's default rendering).
- **Env overlay without \`set_var\`**: zap parses \`--env-file\` into a
  process-wide \`OnceLock<HashMap>\` overlay consulted before \`std::env\` — no
  env mutation, so it works under \`unsafe_code = "forbid"\` (\`set_var\` is
  unsafe in edition 2024).

## Patterns

### Sandboxed one-shot eval

Executable config (a TS builder run under \`deno\`) evaluates through a shared
harness — \`fuz_eval::eval_module(&EvalRequest)\`: \`deno run --no-prompt\` with
**no** net/env/write, a caller-chosen \`ReadScope\` (\`Scoped(dir)\` or
\`Unrestricted\`), a wall-clock timeout + kill, and the wrapper piped over
stdin (no temp file). Don't re-roll the spawn.

Policy belongs to the caller. zap passes \`ReadScope::Unrestricted\` under a
first-party trust model (configs must resolve imports from anywhere up the
dependency tree) — the walls that remain are net/env/write. Its wrapper also
enforces **determinism by construction**: \`Date.now\` / \`Math.random\` /
\`performance.now\` / \`crypto.randomUUID\` / no-arg \`new Date()\` are stubbed to
throw, and \`console.log/info/debug\` reroute to stderr so stdout stays pure
JSON — the evaluated plan must be a content-addressed fact.

The wrapper *ingredients* are shared exports of \`fuz_eval\` — the
determinism stubs (\`DETERMINISM_STUBS_JS\`), the console redirect
(\`CONSOLE_TO_STDERR_JS\`), and \`build_extract_export_wrapper(name, stubs)\`
for the common "eval a module, extract one named export as JSON" shape
(injection-safe: the export name is JSON-encoded into bracket notation).
A simple consumer composes these instead of re-deriving them; a rich
wrapper (zap's builder) composes the constants directly. The boundary
principle behind the stubs: anything the evaluated code needs from the
world should be a **declared, inert input** the trusted parent resolves
and records — an injected live capability is an undeclared input no cache
key can capture.

### Sidecar controller

The pattern for a long-running subprocess multiplexing many concurrent
requests: a spawn config of function pointers (statically-known runtimes),
JSON-lines framing over stdin/stdout, an mpsc command channel into a
serializer task that owns stdin, per-request \`oneshot\` responses parked in a
map keyed by request id, and the script embedded via \`include_str!\` + written
to a \`NamedTempFile\` at spawn. Skip it for one-shot invocations (plain
\`tokio::process::Command\`) or pure in-process work.

**Currently dormant** — \`fuz_sidecar\` is feature-gated off with no live
consumer (tsv replaced the Deno sidecar's parsing role). The controller and
its crash-recovery respawn loop (exponential backoff, capped) remain the
reference if a runtime-hosting workload returns.

### Security

- **Constant-time token comparison** via \`subtle::ConstantTimeEq\`.
- **TOCTOU-safe file operations**: open with \`O_NOFOLLOW\`, check permissions
  on the fd, not the path.
- **Secure file permissions**: \`0o600\` files, \`0o700\` directories — and
  deliberately *not* for non-secret state (a daemon-info file readable by
  tooling is \`0o644\` on purpose; state the choice).
- **Supply-chain isolation** is a crate-graph property, not a code pattern —
  see ./rust-dependencies §Crate-vs-feature isolation.

### Transactional state files

State that several invocations mutate (a lock ledger, an intent file) needs
serialization and atomicity:

- **Advisory file locking** (\`nix::fcntl::Flock\`) serializes concurrent
  writers across processes — acquire before read-modify-write.
- **Atomic temp + rename**: a reader never sees a half-written file; a crash
  mid-write leaves the old version intact.

The ecosystem implementation is \`fuz_sys::fs::write_atomic\` (write
\`.<name>.tmp.<pid>\` → \`sync_all\` → rename → **fsync the parent dir**); it
replaced ~five hand-rolled copies — use it, don't re-roll. **Calibrate the
durability by authority**: the parent-dir fsync is required for
*authoritative, non-regenerable* state (lock ledgers, credentials) and
deliberately waived for content-addressed bodies (a torn write is caught by
re-hashing) and ephemeral regenerable run-state. State the choice when you
skip it. zap — spine-free — hand-rolls both calibrations correctly: flock +
full fsync dance for its authoritative lock file, temp + rename only for its
regenerable detection cache ("the cache holds no authority").

For the lock itself: \`flock\` locks the *inode*, so lock a stable sidecar path
and **never unlink on release** (truncate-but-keep-dirent) — else two
acquirers hold different inodes. (zap's lock currently locks the pre-rename
inode with a \`TODO\` — known wart, not a competing convention.)

### Content-addressed storage with size-based routing

The shape of a blob store keyed by content hash (ecosystem impl:
\`fuz_fact\`, consumed by fuz_forge; serving is the separately-authz'd
\`fuz_fact_serving\`):

- Blobs below an embed threshold (1 MiB) live inline in the database row —
  one round trip, transactional with their metadata.
- Larger blobs go to sharded disk paths (\`<2-hex>/<62-hex>\` of the hash) via
  atomic temp + rename; the row stores a \`file:<shard>/<rest>\` pointer.
- **Verify-on-read applies to the buffered \`get\`** (re-hash, mismatch →
  treated as absent). The streaming serve path deliberately does *not*
  re-hash — it trusts write-time \`sync_all\` on hash-named files.
- Idempotent writes: content-addressed names + \`INSERT … ON CONFLICT (hash)
  DO NOTHING\` make a re-store a no-op.

### Bounded reads / size guards

Never read an untrusted-size input unbounded:

- **Files**: preflight the reported size, then read with a \`+1\` cap so a file
  that grew between \`stat\` and read is rejected rather than silently
  truncated — \`take(MAX + 1)\`, \`len > MAX\` is an error.
- **Streams** (HTTP bodies, subprocess output): enforce a byte counter
  mid-stream and abort on overrun — \`Content-Length\` is a hint, not a bound.
  Unlink partial output on overrun. fuz_forge's upload pipeline layers the
  guards: Content-Length preflight + mid-stream counter + statvfs free-space
  check (\`507 storage_full\`) + a concurrency semaphore + an orphan-temp
  sweep.
- **Centralize the ceilings**: one private constant behind named public
  aliases (\`fuz_sys::limits\`: \`ARTIFACT_CEILING_BYTES\` feeding
  \`MAX_TRANSFER_SIZE\`, \`MAX_FILE_SIZE\`, …) — call sites keep
  intent-revealing names, the value has one home. Add new caps there, not
  per-crate.

### Type state (compile-time state machines)

When a value progresses through states, encode the state in the type so
calling a method in the wrong phase is a compile error. A **correctness**
pattern, not a performance one.

The in-codebase shape is the **consuming transition**, not \`PhantomData<S>\`:
zap's \`SecretRegistry::freeze(mut self) -> Result<SecretMasker>\` makes "mask
before the registry is frozen" unrepresentable by moving the value into the
next type — and the transition is fallible, doubling as validation (it
rejects a registered value that would corrupt cascading replacement). Reach
for \`PhantomData<S>\` only when one value must thread several states through a
generic API. Skip type state when states are data-driven (runtime enum), only
one transition exists, or the API must stay ergonomic for casual callers.

### Secret masking pipeline

Masking happens at the **consumption** boundary, not emission: execution
stays masking-unaware; the batch report is masked once at render, and the
live event stream is masked by a decorator wrapping the sink
(\`EventHandler::Masking\`). The registry registers each secret's literal,
URL-encoded, and JSON-escaped variants and replaces longest-first; \`freeze\`
is the type-state gate above.

### Logging

**Servers**: \`tracing\`; subscriber setup is single-sourced in a shared helper
(\`fuz_sys::logging::init_non_blocking_stdout\`, behind the \`logging\` feature)
— consumers dep \`tracing\` only, not \`tracing-subscriber\`.

**CLIs / daemons**: \`eprintln!\` — simple, no framework. Batched request
logging for performance; \`--json\` for machine-readable output.
`},{slug:"rust-perf",title:"Rust Performance Patterns",content:'# Rust Performance Patterns\n\n**Applies to**: Rust workspaces across the ecosystem. Companion to\n./rust-patterns — that one covers shape, this one covers speed. Generic Rust\nperf hygiene (`with_capacity`, `swap_remove`, iterator fusion, bounds-check\nelision via iterators/`assert!`, `#[inline]` mechanics) is assumed known and not\nrestated; this is the stack-specific layer.\n\nWorth stating once: allocate on purpose, not by reflex — a deliberate allocation\n(terminating a pipeline, decoupling lifetimes, batching repeated work) is often\nthe right design, not a smell to optimize away.\n\n## Stack constraints\n\n- **`unsafe_code = "forbid"` at the workspace.** A crate can override to\n  `"allow"` case-by-case (FFI/binding crates already do — ./rust-patterns\n  §Lints); performance can justify the same, conservatively — see §Unsafe escape\n  hatch. Never per-function in an otherwise-safe crate.\n- **Stable Rust.** No `#![feature(...)]`, no nightly toolchains.\n- **tokio runtime.** Thread-per-core runtimes (`glommio`, `monoio`) are out of\n  scope — see §Out of scope.\n\n## Measure first\n\nAlways profile/bench with `--release` (debug runs with different hot paths).\ntsv keeps a `[profile.profiling]` (`inherits = "release"`, `debug = true`,\n`strip = false`) for symbolicated profiles. Curated tools:\n\n| Profiler            | Surface                                  | When                                            |\n| ------------------- | ---------------------------------------- | ----------------------------------------------- |\n| `samply`            | CPU sampling, flamegraphs                | default on Linux; "where\'s wall-clock going?"   |\n| `tokio-console`     | Live task states, busy/idle, polls       | async stalls, tasks that never yield, starvation |\n| `cargo-instruments` | macOS Instruments                        | allocations on Apple HW                         |\n| Cachegrind          | Instruction counts, I-cache, branch miss | verifying inline/cold heuristics                |\n\n| Bench         | Metric             | Notes                                                            |\n| ------------- | ------------------ | ---------------------------------------------------------------- |\n| Criterion     | Wall-clock + stats | default; CI regression integrations                              |\n| Divan         | Wall-clock + stats | lighter macros, native multithreaded benches                     |\n| Iai-Callgrind | Instruction counts | deterministic, no OS jitter; ideal for CI/micro (weaker non-x86) |\n\n## Arena allocation (`bumpalo`) — in use in tsv\n\ntsv\'s core allocation strategy: every parser is\n`parse<\'arena>(source: &str, arena: &\'arena Bump) -> Result<Ast<\'arena>>` —\nthe **caller owns the `Bump`**, ASTs borrow it, and formatting takes a\nseparate doc arena. Conventions proven there:\n\n- **Per-thread reusable arenas for binding hot loops** (`tsv_arena`):\n  `with_ast_arena` / `with_doc_arena` hold one `thread_local!`\n  `RefCell<Bump>` per thread and `reset()` at the **start** of each call, so\n  the high-water chunk is retained and per-call malloc/free amortizes to\n  zero. Soundness contract: the callback must fully consume arena-borrowed\n  work into an owned return before the next reset. Non-reentrant (the\n  `RefCell` borrow spans the callback) — a nested parse inside formatting\n  uses a local `Bump`. Recovers cleanly after `catch_unwind` (the FFI path\n  relies on this). Under WASM the thread-local is effectively a module\n  static.\n- **Trap**: `bumpalo` collections don\'t run `Drop` for contents — arenas hold\n  POD (`Copy`, `&\'arena str`). For types with destructors use `typed-arena`\n  (not currently used anywhere). Never round-trip global-heap collections\n  (`String`/`Vec`) through `into_bump_slice` — leaks.\n- One arena per phase (AST vs doc IR), dropped/reset at phase end.\n\n`bumpalo` stays safe-API-only, so `unsafe_code = "forbid"` holds.\n\n## Async lock hygiene\n\n**Never hold a sync lock (`parking_lot`/`std`) across `.await`** — the guard\nblocks the executor thread; if the holder yields mid-section the runtime can\ndeadlock or starve. Drop the guard before the await, or use `tokio::sync::*`\nwhich suspends cleanly. Pick per critical section:\n\n- `parking_lot` — default for sync-only sections (no poisoning, smaller, faster).\n- `tokio::sync::{Mutex, RwLock}` — sections that themselves `.await`.\n- `std::sync::*` — only when you need poisoning semantics.\n\n**DashMap** for hot shared maps: `Arc<RwLock<HashMap>>` serializes all readers\nunder any contended write and bounces the lock\'s cache line across cores;\nDashMap shards internally. Reach for it when profiling shows contention on one\nmap — not the default.\n\n## Stack-specific perf notes\n\nBeyond generic hygiene:\n\n- **`get_unchecked` is off-limits in workspace-default crates.** If a bench\n  proves a bounds check is the bottleneck *and* iterator/`assert!`-hoist\n  rewrites can\'t elide it, isolate the hot kernel in a crate that overrides\n  `unsafe_code = "allow"` (§Unsafe escape hatch).\n- **Cross-crate inlining is free here**: the release profile\'s `lto = true` +\n  `codegen-units = 1` (./rust-patterns §Release Profile) inlines across crates\n  without per-fn `#[inline]`. Reserve `#[cold]` + `#[inline(never)]` for rare\n  error/panic formatters to keep the hot I-cache dense.\n- **Box the error, keep `Ok` pointer-sized**: tsv\'s lexer returns\n  `Result<_, Box<ParseError>>` so the hot `next_token` Ok path stays small; a\n  `From<Box<ParseError>>` unboxes at the parser boundary. Apply when the error\n  type is fat and the fallible call is hot.\n- **Don\'t round-trip a closed set through serde on a hot path**: zzz\'s\n  `ProviderName::parse(&str)` matches literals directly instead of allocating\n  a `Value::String` per request, with `as_str`/`Display`/serde-rename\n  single-sourced from one match.\n- **Compact span/token types**: tsv\'s `Span { start: u32, end: u32 }` (`Copy`)\n  halves span memory vs `usize` pairs and caps files at 4 GiB — pair the cap\n  with an explicit `FileTooLarge` guard.\n- **False sharing**: pad per-thread/per-shard hot atomics to a cache line\n  (`#[repr(align(64))]`) when multiple cores write adjacent counters —\n  otherwise one write invalidates the line on every core (5–10× on what look\n  like independent increments).\n\n## Open questions / not-yet-used\n\nNone of these are in any workspace crate today; noted tersely so the choice is\nin-context if the workload arrives.\n\n- **Zero-copy archives (`rkyv`)** — candidate for content-addressed bodies and\n  snapshot manifests read repeatedly without mutation (the on-disk bytes *are*\n  the in-memory layout, no parse); not for mutation-heavy or read-once paths.\n  Wire surfaces (HTTP/SSE/JSON-RPC) stay on `serde_json`. Pair untrusted reads\n  with `bytecheck`; treat the archived schema as a wire format (a field rename =\n  re-archive every file). Don\'t derive both archived and `serde` shapes on one\n  type — pick one per type so the canonical representation is unambiguous.\n- **Global allocator (jemalloc/mimalloc)** — for long-running daemons whose RSS\n  climbs under glibc fragmentation (`zzz_server`), not CLIs. jemalloc: stable RSS\n  under chaotic load + good profiling; mimalloc: best throughput/CPU but RSS can\n  spike in bursts. Bench per service. Gotcha: a C dep calling raw `malloc` (LMDB)\n  bypasses the Rust allocator — use mimalloc symbol-override or `LD_PRELOAD`.\n- **SIMD on stable** — `target-cpu=native` / `target-feature` via `RUSTFLAGS`\n  drives LLVM auto-vectorization (no source changes); crate `simd` features gate\n  `std::arch` paths (blake3\'s `wasm32_simd`, ./wasm-patterns). Don\'t ship\n  AVX-512 to general consumers — it crashes instantly on older CPUs. `std::simd`\n  is nightly, out of scope.\n\n## Unsafe escape hatch\n\nA crate may override `unsafe_code = "allow"` for performance, conservatively:\n\n- **Isolate** in a dedicated crate / tightly-scoped module, never per-function.\n- **Document** every `unsafe { ... }` with a `// SAFETY:` invariant comment.\n- **Bench-justify** — a regression test shows the unsafe path wins meaningfully,\n  not "I think this is faster."\n- **Reversible** — keep a safe fallback in the same crate.\n\nCleared this bar elsewhere: `get_unchecked` in proven-safe inner loops,\n`std::arch` SIMD for a specific target. Has *not*: dodging `clone()`, "the\ncompiler should be able to prove this," speed claims without measurements.\n\n## Out of scope\n\nHonest notes to prevent cargo-culting:\n\n- **Thread-per-core** (`glommio`/`monoio`): Linux/io_uring-bound, abandon tokio\n  — a major architectural break for one service, trade-offs rarely favor it.\n- **SoA layouts** (`soapy`/`soa_derive`): niche to bulk numeric pipelines; reach\n  for it only if profiling shows cache-line waste on a homogeneous workload.\n- **`multiversion`** runtime CPU-feature dispatch: single-target builds suffice.\n- **Left-right** (`evmap`): 2× memory, eventual consistency, writers blocked on\n  slow readers — niche to read:write ratios of orders of magnitude, after\n  `DashMap`/`RwLock` have been profiled as the bottleneck.\n- **Hand-rolled lock-free** (`crossbeam-epoch`): reach for `DashMap`,\n  `tokio::sync`, `crossbeam::queue` before writing your own stack/queue/skiplist.\n'},{slug:"rust-spine",title:"Rust Spine & Consumer Servers",content:"# Rust Spine & Consumer Servers\n\n**Applies to**: the fuz workspace's spine crates and the servers that consume\nthem — `zzz_server`, `fuz_forge_server`, and the test-only\n`testing_spine_stub`. The spine is the Rust twin of `fuz_app`'s TS backend\n(auth, db, http, realtime, actions); the twin relationship itself is\n./twin-impl. Consumers take the spine as **path deps to a sibling checkout\nof the fuz repo** — not git URLs, not vendoring.\n\nShared shape/idiom conventions live in ./rust-patterns; this covers the\nspine surface and the consumer contracts.\n\n## Spine layers\n\nThe crates a consumer server actually names, by layer (the fuz workspace's\nfull ~35-crate inventory is its own repo's concern):\n\n- **System leaves** — `fuz_sys` (OS/system: fs, file_lock, secure_file, pid,\n  env, limits, cli; `logging`/`signal`/`tls` features), `fuz_home` (the\n  `~/.fuz` layer), `fuz_crypto` (Ed25519 verify, `ContentHash`, canonical\n  JSON), `fuz_eval` (sandboxed one-shot Deno eval). HTTP/DB-free by enforced\n  rule, so anything can link them.\n- **HTTP spine** — `fuz_http` (JSON-RPC envelope, IP/origin, lifecycle),\n  `fuz_db` (pool + migrations), `fuz_auth` (keyring, sessions,\n  `PasswordHasher`, bootstrap, audit), `fuz_actions` (action dispatch +\n  `consumer_lifecycle`), `fuz_realtime` (WS/SSE connection registries),\n  `fuz_cell` / `fuz_cell_actions` (cell storage / verbs), `fuz_fact` /\n  `fuz_fact_serving` (content-addressed byte store / authz'd reads),\n  `fuz_storage` (File/Forge/Ssh backends).\n- **Tooling** — `fuz_audit` (dep-graph audit), `fuz_testing` (test-only\n  impls, e.g. `TestingArgon2idHasher` — never shippable).\n\nThe `fuz_fact`/`fuz_cell` storage-vs-serving splits and the\n`fuz_sys`/`fuz_home` leaf split are enforced by layering rules\n(§xtask & check-release), not just convention.\n\n## Server lifecycle — `run_app`\n\nEach consumer server exposes `pub async fn run_app(options: RunAppOptions)`\n— one entry point that both the production `main.rs` and the sibling\n`testing_*_server` binary call, differing only in injected options. The test\nbinary (`testing_zzzd`, `testing_fuzfd`) wires\n`fuz_testing::TestingArgon2idHasher` (weak, fast params) and registers\n`_testing_*` actions; it is what the TS cross-backend suite launches, and the\n`testing_` name prefix + `check-release` keep it unshippable.\n\nShared swap points:\n\n- `password_hasher: Arc<dyn PasswordHasher>` — Argon2id vs the test hasher\n- `extra_action_specs_factory` — the test binary registers `_testing_*`\n  actions without `fuz_testing` entering the production dep graph\n- `pre_migration_hook` — test-only DB setup\n\nThe `run_app` *body* is consumer-specific (domain App, migration set,\naction-spec composition) and is not a shared helper. The boxed-closure\nshapes — `ExtraActionSpecsFactory<App>`, `PreMigrationHook<E>`, and the\n`ExtraActionSpecsRuntime` POD (`password_hasher` / `keyring` /\n`daemon_token_state` / `session_cookie_name`, all `fuz_auth` types) — live in\n`fuz_actions::consumer_lifecycle`, generic over `App` and `E` so\n`fuz_testing` never enters the spine. (They belong in `fuz_actions`, not\n`fuz_http::lifecycle`: `fuz_http` deps no spine crate, so it can't name\n`fuz_auth` types.) Each consumer instantiates with a one-line concrete alias\n— `pub type ExtraActionSpecsFactory =\nfuz_actions::ExtraActionSpecsFactory<handlers::App>;` — its own type\ndefinition, not a re-export shim.\n\n`RunAppOptions` shares a bind/drain vocabulary — `default_addr: SocketAddr`\n(strictly more expressive than a bare port; loopback-only consumers default\n`127.0.0.1:<port>` and override only the port) + `drain_timeout: Duration`,\npassed `fuz_http::DEFAULT_DRAIN_TIMEOUT` (10 s) rather than a per-crate\nconst. Remaining fields are legitimately per-consumer (zzz adds\n`force_test_actions` and `disable_login_rate_limit`; the forge has neither) —\ndon't force one struct across consumers. Bind env-var *names* are also\nper-consumer (`PORT`/`HOST` for the forge, `ZZZ_PORT` for zzz).\n\nThe daemon-token keeper wiring (`BootstrapKeeperResolved` adapter + boot-time\n`query_keeper_account_id`) is spine-owned in `fuz_auth` — don't re-implement\nper consumer.\n\n## JSON-RPC envelope — `fuz_http` owns it\n\n`fuz_http` owns the error constructors (`invalid_params(detail, reason)`,\n`internal_error`, `internal_error_with_source`, `not_found`, `conflict`,\n`forbidden`, `validation_error`, `rate_limited`) and the typed-params helper\n`parse_params<T: DeserializeOwned>`. Consumers import these, never\nre-declare — the wire envelope is what the cross-backend parity tests assert\nbyte-for-byte, and a local copy drifts. Prefer typed `#[derive(Deserialize)]`\ninput structs + `parse_params` over per-field\n`params.get().and_then(Value::as_str)` chains (adoption is uneven — treat the\nchains as migration debt, not a competing style).\n\n`JsonrpcErrorCode` is a `#[repr(i32)]` enum with a hand-written `Serialize`\nemitting the bare `i32` the wire requires — not scattered `pub const … :\ni32`. Because `JsonrpcError.code` is the enum, `error_code_to_http_status` is\nan *exhaustive* match: a new code is a compile error there, not a silent 500.\nThe TS twin is `fuz_app`'s `jsonrpc_errors`; consumers referencing a code use\nthe enum (`JsonrpcErrorCode::NotFound as i64`), never a magic number.\n\n## Env loading\n\n- **Injectable seam**: load through `from_vars(get: impl Fn(&str) ->\n  Option<String>)` so tests inject a map instead of mutating process env —\n  `fuz_forge_server`'s env struct is the exemplar, including a test that\n  actively *rejects retired var names*. Route all env reads through the seam;\n  audit for stray `std::env::var` in router code (both consumers still have\n  a few — migration debt).\n- **Fail loud, not just fail closed**: security-consequential misconfig\n  refuses to boot, never warn-and-continue — an empty `FUZ_ALLOWED_ORIGINS`\n  (empty allowlist = allow-all; the shared check is\n  `fuz_http::require_non_empty_origins`), a *malformed* trusted-proxy list\n  (unset defaults to loopback — that's fine), missing/weak cookie keys, and a\n  failed `ActionRegistry::compile()` (an empty-registry fallback would\n  silently answer `method_not_found` to everything).\n- **Booleans** go through `fuz_sys::env::parse_stringbool` (the\n  `z.stringbool()`-shaped closed set; unknown values error so a typo can't\n  silently flip a feature).\n- **Secret-shaped env names** carry the `SECRET_*` prefix — one contract\n  across TS (`fuz_app` `BaseServerEnv`) and Rust.\n\n## Consumer wiring idioms\n\n- **`OnceLock` breaks the App ↔ registry capture cycle**: action-spec\n  builders capture `Arc<App>` into handler closures, so the compiled registry\n  can't exist until the App does — it lives in `App.action_registry:\n  OnceLock<Arc<ActionRegistry>>`, `set()` after construction.\n- **`ActionContext<'a>` is the borrowed per-request seam**: `notify: &dyn\n  Fn(&str, &Value)`, `connection_id: Option<…>` (set on WS, `None` on HTTP),\n  `signal: &CancellationToken` (threaded into providers), `request_id`.\n- **Streaming needs an owned sender**: the borrowed `notify` can't be\n  captured into a `'static` closure, so zzz's provider streaming builds a\n  per-request `ProgressSender = Box<dyn Fn(Value) + Send + Sync>` — only when\n  the request carries a progress token *and* arrived over WS — wrapping\n  chunks with `fuz_http::notification(…)` and routing through\n  `Arc<fuz_realtime::ConnectionRegistry>::send_to(conn_id, …)`. HTTP requests\n  get `None` → non-streaming.\n- **Migration namespaces compose**: substrate DDL lives in the owning spine\n  crate (`fuz_auth::AUTH_MIGRATIONS`, `fuz_cell::CELL_MIGRATIONS`,\n  `fuz_fact::FACT_MIGRATIONS`); the consumer composes them with its own\n  namespace via `fuz_db::run_migrations`, ordering for FKs (auth first). A\n  consumer's own namespace should be small — the forge's is a single\n  token-policy table.\n- **Loopback-gated internal routes**: `/internal/*` callbacks check the\n  `ConnectInfo<SocketAddr>` peer is loopback *and* a per-resource secret —\n  X-Forwarded-For can't fake the peer address.\n- **Server boot errors carry the CLI exit-code policy**: a `StartupError`\n  with `exit_code()` mapping `Config → 2`, everything else `→ 1` — the\n  remediation-keyed dialect from ./rust-patterns §CLI Patterns applied to\n  a server binary.\n- **Subprocess harness**: `SpawnOptions` + `spawn_collect`/`spawn_streaming`\n  with an env-isolating spawn and a capped output drain lives in\n  `fuz_forge_server` (deliberately local until a second consumer needs it —\n  the promotion candidate is a spine-free leaf crate).\n\n## Daemon lifecycle — two layers\n\n1. **Server-side graceful shutdown is shared.** The signal →\n   `CancellationToken` half is `fuz_sys::signal::shutdown_token()` (behind\n   the `signal` feature); `fuz_http::lifecycle` re-exports it and adds\n   `serve_with_shutdown` for the axum consumers. `fuzd` (UDS, no axum) calls\n   `fuz_sys::signal` directly. This split is why `fuz_sys` (home-agnostic OS\n   leaf) and `fuz_home` (the `~/.fuz` layer) are separate crates: the HTTP\n   spine shares the primitive without inheriting fuz's home conventions.\n2. **Client-side CLI lifecycle splits by transport.**\n   - `fuzd`'s UDS lifecycle lives in `fuz_daemon`: v2 `daemon.json`\n     (`socket_path`, no port), `Hello`-based health over `fuz_client`,\n     `DaemonState { Running(info) | Stopped | Stale(info) }` with a single\n     `get_daemon_state()` resolver.\n   - zzz's HTTP lifecycle is deliberately **local to zzz's CLI**: a\n     port-based `DaemonInfo { version, pid, port, started, app_version }`\n     (schema shared with `fuz_app` TS) + a reqwest `/health` probe + a\n     `Wedged(info)` arm for \"pid alive, `/health` silent\". It reuses the\n     `fuz_sys` primitives (`fuz_sys::{is_pid_alive, send_signal,\n     rfc3339_now}`, `fuz_sys::fs::write_atomic`) but **not** `fuz_home` —\n     the `fuz_home` daemon helpers model the UDS schema, which doesn't fit\n     HTTP/port. `daemon.json` here is world-readable `0o644` on purpose (no\n     secrets in it).\n   - Model liveness as the `DaemonState` enum + one resolver — not scattered\n     `pid_alive`/`healthy` boolean pairs handled differently per command.\n     Don't build a transport-generic lifecycle crate for a single HTTP\n     consumer; extract only when a second HTTP CLI daemon-manager appears.\n   - The HTTP lifecycle must never enter the `fuz`/`fuzd` dependency graph\n     (`reqwest`; `check-release` already forbids `fuz_daemon`/`fuz_client`\n     from `fuz`).\n\n## xtask & check-release\n\nEvery spine-consuming workspace's `xtask` wraps the shared dep-graph audit;\ndon't hand-roll it:\n\n- `fuz_audit::xtask_main()` — a complete single-subcommand xtask (the forge's\n  3-line `main`).\n- `fuz_audit::run_check_release_cli()` — for workspaces with their own\n  subcommand router (zzz, zap).\n- `run_check_release_cli_with_rules(&AuditRules)` — the rules-taking entry\n  point. `AuditRules` is one POD: `extra_forbidden: &[&str]` (the fuz\n  workspace adds `fuz_sign` so its `fuz` binary can never sign) +\n  `per_binary: &[PerBinaryForbid]` (`fuz`/`fuzd` must not link `fuzi_*`).\n  Only the fuz workspace passes rules; the no-arg consumers stay insulated.\n- Exit codes are three-way sysexits: clean → 0, policy violation → 65,\n  tooling failure → 69/70.\n\n`BUILTIN_CRATE_LAYERING` — per-crate *library* layering applied\nunconditionally in every workspace (absent subjects are skipped; the OK\noutput lists subjects actually checked so a renamed crate is visible, not\nskipped green). Each rule says a library must not transitively\n(runtime-)depend on a forbidden set. The four today:\n\n| Subject | Must not reach | Invariant |\n| ------- | -------------- | --------- |\n| `fuz_fact` | `axum`, `fuz_http`, `fuz_cell`, `fuz_auth`, `fuz_actions` | bytes escape only through the authz'd `fuz_fact_serving` |\n| `fuz_cell` | `fuz_actions` | storage/authz half can't reach the verb layer |\n| `fuz_sys` | `axum`, `fuz_http` | the OS leaf stays HTTP-free |\n| `fuz_home` | `axum`, `fuz_db`, `fuz_http` | the `~/.fuz` layer stays HTTP/DB-free |\n\nThe `fuz_cell` rule is deliberately narrower than `fuz_fact`'s — it\nlegitimately reaches `axum`/`fuz_http` transitively via `fuz_auth`, and the\nBFS runs over the runtime graph, so a rule must account for what a subject's\nlegitimate deps already pull. Grow the table one rule per real, load-bearing\ninvariant — no speculative rules.\n\nThe `[package.metadata.fuz_audit] dev_only = true` stanza on each xtask crate\nis the one piece of config that can't be workspace-inherited. Why the\nforbidden capabilities are separate crates rather than cargo features:\n./rust-dependencies §Crate-vs-feature isolation.\n"},{slug:"svelte-patterns",title:"Svelte 5 Patterns",content:`# Svelte 5 Patterns

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

### \`$state.raw()\` vs \`$state()\` — opt into mutation reactivity, raw otherwise

**Principle: be explicit about when you're opting into mutation reactivity.**
For primitives the two are equivalent (one extra \`typeof\` check on set). For
objects and arrays, \`$state()\` proxies the value so in-place mutations trigger
updates; \`$state.raw()\` stores the value directly and only tracks reassignment.

**Use \`$state()\`** for in-place mutation reactivity:

- Arrays you \`push\`, \`splice\`, \`pop\`, \`sort\`, or index-assign
- Objects with individual property mutations
- \`bind:value={obj.field}\` — binding writes to a property on the object, which
  needs deep proxy reactivity (binding to a primitive \`let\` works either way,
  since the binding reassigns the variable)

**Use \`$state.raw()\`** for everything else — primitives, values replaced
wholesale (filter/spread/reassignment), API responses, data passed to APIs
that compare object identity, anything where property-level reactivity isn't
wanted.

This is a fuz-stack stylistic preference, not a technical requirement, and
diverges from Svelte's official guidance — which defaults to \`$state()\` and
treats \`$state.raw\` as a perf opt-out for large values that are only ever
reassigned (API responses and similar). The benefit is explicit intent —
reading a state class tells you which fields are designed to mutate in place.
The cost is friction with idiomatic-Svelte reviewers and AI assistants that
default to \`$state()\`.

\`structuredClone\`, \`JSON.stringify\`, and \`postMessage\` all walk through
\`$state()\` proxies cleanly — proxy traps return the target's own keys.
\`JSON.stringify\` also calls \`toJSON()\` through the proxy.

\`\`\`typescript
// $state.raw() — values replaced wholesale or never reassigned
let name = $state.raw(''); // primitive
let api_response = $state.raw<ApiResponse | null>(null); // replaced wholesale
let selections: ReadonlyArray<Item> = $state.raw([]); // array replaced wholesale

// $state() — opt-in for in-place mutation
let items = $state<string[]>([]);
items.push('new'); // triggers reactivity
let form_data = $state({name: '', email: ''});
form_data.name = 'Alice'; // triggers reactivity via proxy

// const objects with property writes need $state()
const config = $state({iterations: 5, warmup: 2});
// bind:value={config.iterations} writes a property; $state.raw() here silently
// breaks (const can't be reassigned, raw doesn't track property writes)
\`\`\`

**Watch for \`const\` objects:** A \`const\` object declared with \`$state.raw()\`
can't trigger reactivity at all — it can't be reassigned and property mutations
aren't tracked. If its properties are mutated (directly or via \`bind:\`), use
\`$state()\`.

**Check consumer files, not just the declaring file.** A class field may be
mutated in place by external code — e.g., a component importing a state class
and calling \`thing.items.splice(i, 1)\`. Grep all of \`src/\` for mutation
patterns on the field name before deciding.

### The \`$state.raw()!\` Non-null Assertion Pattern

Class properties initialized by a constructor or \`init()\` use \`$state.raw()!\`:

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

### \`$state.snapshot()\`

Deep-cloned plain copy of a reactive value. Per Svelte's source: recurses
into plain objects and arrays; for class instances with \`toJSON()\`, calls
it and clones the result; otherwise falls through to \`structuredClone\`
(which strips class prototypes).

\`\`\`typescript
// cell.svelte.ts - encode_property uses snapshot for serialization
encode_property(value: unknown, _key: string): unknown {
	return $state.snapshot(value);
}
\`\`\`

Use it when handing a \`$state()\` proxy structure to code that does
reference-identity checks on members and would otherwise see proxy
identities. \`$state.raw()\` values holding plain data don't need it at all;
for serialization, \`JSON.stringify\` and \`structuredClone\` walk proxies on
their own.

**Observed quirk** (Svelte 5.56 + vite-plugin-svelte): \`const r = $state.snapshot(x)\` is
silently elided to \`const r = x\` somewhere downstream of Svelte's
\`compileModule\` (whose output is correct). \`return $state.snapshot(x)\` and
inline expression use work correctly. zzz Cell's \`encode_property\` is the
direct-return form, so \`to_json()\` is unaffected. If \`const r =
$state.snapshot(x)\` seems to lose snapshot semantics, this is the cause.

## Derived Values

Use \`$derived\` to compute from state — never \`$effect\` with assignment.
Deriveds are writable (assign to override, but the expression re-evaluates on
dependency change). Derived objects/arrays are not deeply reactive.

### \`$derived\` vs \`$derived.by()\`

\`$derived\` takes an expression (not a function); \`$derived.by()\` takes a
function for loops, conditionals, or multi-step logic.

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

Always mark \`$derived\` class properties \`readonly\` unless you explicitly need
reassignment (which Svelte 5 does allow):

\`\`\`typescript
// From Library class (fuz_ui/library.svelte.ts)
export class Library {
	readonly library_json: LibraryJson = $state.raw()!;

	readonly pkg_json = $derived(this.library_json.pkg_json);
	readonly source_json = $derived(this.library_json.source_json);
	// \`LibraryJson\` stores only the raw \`pkg_json\`/\`source_json\` pair — these
	// derive from \`pkg_json\`, not from extra \`LibraryJson\` fields.
	readonly name = $derived(this.pkg_json.name);
	readonly repo_url = $derived(repo_url_parse(this.pkg_json.repository)!);
	readonly modules = $derived(
		this.source_json.modules
			? this.source_json.modules.map((module_json) => new Module(this, module_json))
			: [],
	);
	readonly module_by_path = $derived(new Map(this.modules.map((m) => [m.path, m])));
}
\`\`\`

\`\`\`typescript
// From Thread class (zzz/thread.svelte.ts) - return \`| undefined\`, never throw
// from a $derived that templates read (a throw render-crashes every consumer);
// guard at the callsites instead.
readonly model: Model | undefined = $derived.by(() =>
	this.app.models.find_by_name(this.model_name),
);

// From ContextmenuState - $derived for simple, $derived.by for multi-step
// (this older class predates the readonly convention; new code should add it)
can_collapse = $derived(this.selections.length > 1);

can_expand = $derived.by(() => {
	const selected = this.selections.at(-1);
	return !!selected?.is_menu && selected.items.length > 0;
});
\`\`\`

**Field-initializer order gotcha (plain classes).** Class field initializers run
_before_ the constructor body, so a \`$derived\` whose expression reads a field the
constructor assigns (common in plain \`.svelte.ts\` classes — \`app\`, \`name\`, …)
trips TS2729 _"used before initialization"_:

\`\`\`typescript
export class ProviderCapability {
	readonly app: Frontend;
	readonly name: ProviderName;
	// Don't do this — \`this.app\`/\`this.name\` are read in a field initializer,
	// which runs before the constructor body assigns them (TS2729).
	readonly status = $derived(this.app.lookup_provider_status(this.name));
	constructor(o: {app: Frontend; name: ProviderName}) {
		this.app = o.app;
		this.name = o.name;
	}
}
\`\`\`

Wrap the read in \`$derived.by(() => …)\`: TS's init-order check doesn't descend
into the closure, and the read is lazy at runtime regardless.

\`\`\`typescript
// closure defers the read past construction
readonly status = $derived.by(() => this.app.lookup_provider_status(this.name));
\`\`\`

Cells don't hit this — \`app\` comes from the base \`Cell\` constructor (runs before
subclass fields), and schema fields use \`$state.raw()!\` (counts as initialized in
declaration order). It bites only plain classes that read constructor-assigned
fields in a \`$derived\`.

### Derived from Props

Treat props as though they will change — use \`$derived\` for values depending
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
	docs_links = $derived.by(() => {
		const children_map: Map<string | undefined, Array<DocsLinkInfo>> = new Map();
		for (const link of this.links.values()) {
			// ... build tree from SvelteMap entries
		}
		return result;
	});
}
\`\`\`

Standard \`Map\`/\`Set\` are not tracked by Svelte's reactivity.

For entity collections consumed by different lookups, maintain **multiple
\`SvelteMap\` indexes** over the data (by id, plus one or more secondary keys),
rebuilding or updating them as the source changes. Deriveds then do \`.get()\`
lookups instead of array scans.

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

Advanced version with a \`Cell\` base class that automates JSON hydration from
Zod schemas. Same rune conventions (\`$state.raw()!\` by default, \`$state()!\`
for in-place mutations, \`readonly $derived\` for computed values). See
./zod-schemas for the full pattern.

## Context Patterns

### Creating Context

\`create_context<T>()\` from \`@fuzdev/fuz_ui/context_helpers.ts\`. Two overloads:
without a fallback, \`get()\` throws if unset and \`get_maybe()\` returns \`undefined\`;
with a fallback, \`get()\` uses it and the \`set()\` value is optional:

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
	import {frontend_context} from './frontend.svelte.ts';

	const {app, children}: {app: Frontend; children: Snippet} = $props();
	frontend_context.set(app);
<\/script>

{@render children()}
\`\`\`

\`\`\`svelte
<!-- Consumer components get the context -->
<script>
	import {frontend_context} from './frontend.svelte.ts';
	const app = frontend_context.get();
<\/script>
\`\`\`

### Getter Function Context Pattern

Some contexts wrap values in \`() => T\` so the context reference stays stable
while the value can change:

\`\`\`typescript
// Type is () => ThemeState, not ThemeState
export const theme_state_context = create_context<() => ThemeState>();

// Setting with a getter that closes over reactive state
theme_state_context.set(() => theme_state);

// Consuming: call .get() at init (it uses Svelte's getContext), then read
// the getter lazily so the value stays reactive
const get_theme_state = theme_state_context.get();
const theme_state = $derived(get_theme_state());
\`\`\`

The getter must be read **lazily** — calling it once at init
(\`const theme_state = get_theme_state();\` without \`$derived\`) captures a
snapshot and loses reactivity, defeating the pattern's purpose. Besides the
script-level \`$derived\` above, two other lazy forms appear in real consumers:

\`\`\`svelte
<!-- template-inline (MdzNodeView.svelte) -->
{@const mdz_base = get_mdz_base?.()}
\`\`\`

\`\`\`typescript
// prop default, re-evaluated while the prop is undefined (ColorSchemeInput.svelte)
const {value = get_theme_state()} = $props();
\`\`\`

Used when the context value might be reassigned (e.g., \`theme_state\` is a
prop). \`library_context\` is a getter context (\`() => Library\`) for the same
reason — components with a \`library\` prop (\`LibraryDetail\`, \`ApiIndex\`,
\`ApiModule\`) project the prop into it for their subtree via
\`library_context.set(() => library)\`. Direct value contexts like
\`frontend_context\` and \`site_context\` are for values stable for the context's
lifetime.

For an inventory of contexts in fuz_ui and zzz, grep for \`create_context<\`.

## Snippet Patterns

Svelte 5 replaces slots with snippets (\`{#snippet}\`, \`{@render}\`).

### The \`children\` Snippet

The implicit \`children\` replaces the default slot. Typed \`Snippet\` (or
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

Children can be parameterized — \`Dialog\` passes a \`DialogContext\` object back to
the consumer (\`DialogContext\` from \`@fuzdev/fuz_ui/dialog.ts\` is
\`{close: (e?: Event) => void; register_surface: (el) => () => void}\`):

\`\`\`svelte
<!-- Dialog.svelte -->
<script lang="ts">
	const {
		children,
	}: {
		children: Snippet<[dialog: DialogContext]>;
	} = $props();
<\/script>

{@render children(context)}
\`\`\`

Consumers reach \`close\` via \`dialog.close\`; \`register_surface\` marks
click-outside-safe regions. \`ThemeRoot\` uses the same parameterized-children
pattern with multiple values:
\`Snippet<[theme_state: ThemeState, style: string | null, theme_style_html: string | null]>\`.

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

A snippet prop can take parameters (\`Snippet<[T]>\`). Illustrative generic list
renderer — fuz_ui's real \`generics=\` user is \`Contextmenu.svelte\`:

\`\`\`svelte
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

### Default Snippet Content and String/Snippet Unions

For optional snippets, fall back with \`{#if snippet} {@render snippet()} {:else} ... {/if}\`.
For props accepting a string or a snippet (e.g. \`icon?: string | Snippet\`),
branch on \`typeof\` at render. fuz_ui's \`Card\` and \`Alert\` use this; \`Alert\` further
parameterizes with \`Snippet<[icon: string]>\` to pass the resolved icon back.

## Effect Patterns

Effects are an escape hatch — avoid when possible. Prefer:

- \`$derived\` / \`$derived.by()\` for computing from state
- \`{@attach}\` for syncing with external libraries or DOM
- Event handlers / function bindings for responding to user interaction
- \`$inspect\` / \`$inspect.trace()\` for debugging (not \`$effect\` + \`console.log\`)
- \`createSubscriber\` from \`svelte/reactivity\` for observing external sources

Don't wrap effect contents in \`if (browser) {...}\` — effects don't run on the
server. Avoid updating \`$state\` inside effects.

### Effect Cleanup

Return a cleanup function for subscriptions or timers (runs before the next
effect and on destroy):

\`\`\`typescript
$effect(() => {
	const interval = setInterval(() => {
		tick_count++;
	}, 1000);
	return () => clearInterval(interval);
});
\`\`\`

For window/document listeners, prefer \`<svelte:window onkeydown={...}>\` and
\`<svelte:document>\` over \`$effect\` + \`addEventListener\`. For element-scoped
listeners, prefer \`{@attach}\` (with \`on()\` from \`svelte/events\` inside).

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

From \`@fuzdev/fuz_ui/rune_helpers.svelte.ts\` — passes call count to the
effect, useful for skipping the initial run:

\`\`\`typescript
import {effect_with_count} from '@fuzdev/fuz_ui/rune_helpers.svelte.ts';

// Skip the first run (count === 1), save on subsequent changes
effect_with_count((count) => {
	const v = theme_state.color_scheme;
	if (count === 1) return; // skip initial
	save_color_scheme(v);
});
\`\`\`

### \`untrack()\`

Read values without creating dependencies — config reads that shouldn't
trigger re-runs, stable references, or breaking infinite loops in
bidirectional syncing:

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

## Attachment Patterns

Svelte 5 attachments (\`{@attach}\`) replace actions (\`use:\`). Attachments live
in \`*.svelte.ts\` files and use \`Attachment\` from \`svelte/attachments\`.

### Attachment API

An attachment is \`(element) => cleanup | void\`. fuz_ui uses a **factory
pattern** — export a function that accepts config and returns the \`Attachment\`:

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
	import {autofocus} from '@fuzdev/fuz_ui/autofocus.svelte.ts';
<\/script>

<!-- Basic usage -->
<input {@attach autofocus()} />

<!-- With options -->
<input {@attach autofocus({preventScroll: true})} />
\`\`\`

#### \`intersect\` -- IntersectionObserver

Wraps IntersectionObserver with a **lazy function pattern** — reactive
callbacks update without recreating the observer:

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
	import {intersect} from '@fuzdev/fuz_ui/intersect.svelte.ts';
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
	(
		params: ContextmenuParams | Array<ContextmenuParams> | null | undefined,
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
	scroll_y: number = $state.raw(0);
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

| Pattern                       | When to use                               | Example       |
| ----------------------------- | ----------------------------------------- | ------------- |
| **Simple factory**            | Fire-once, no ongoing observation         | \`autofocus\`   |
| **Lazy function** (\`() => p\`) | Reactive callbacks without observer churn | \`intersect\`   |
| **Direct params**             | Static config cached for later retrieval  | \`contextmenu\` |
| **Class method**              | Attachment shares state with a class      | \`Scrollable\`  |

### Writing a New Attachment

1. Create \`src/lib/my_attachment.svelte.ts\`
2. Export a factory returning \`Attachment<HTMLElement | SVGElement>\`
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

Intersect \`SvelteHTMLElements\` from \`svelte/elements\` with custom props:

\`\`\`svelte
<script lang="ts">
	import type {Snippet} from 'svelte';
	import type {SvelteHTMLElements} from 'svelte/elements';

	const {
		align = 'left',
		icon,
		children,
		...rest
	}: SvelteHTMLElements['div'] &
		SvelteHTMLElements['a'] & {
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
<input oninput={(e) => (value = e.currentTarget.value)} />

<!-- Conditional event handlers (pass undefined to remove) -->
<svelte:window onkeydown={active ? on_window_keydown : undefined} />
\`\`\`

### Programmatic Event Listeners

\`on()\` from \`svelte/events\` for programmatic listeners in attachments,
\`.svelte.ts\` files, and plain \`.ts\` modules. It preserves correct ordering
relative to declarative handlers that use event delegation, and returns a
cleanup function. Always prefer \`on()\` over \`addEventListener\`, even in
non-component code:

\`\`\`typescript
import {on} from 'svelte/events';

// Inside an attachment or module
const cleanup = on(element, 'scroll', onscroll);
return () => cleanup();

// With options (e.g., passive: false for wheel events)
const cleanup = on(element, 'wheel', onwheel, {passive: false});
\`\`\`

### \`swallow\` — Claiming Events

\`swallow()\` from \`@fuzdev/fuz_util/dom.ts\` combines \`preventDefault()\` and
\`stopImmediatePropagation()\` (or \`stopPropagation()\` with \`immediate: false\`).

**Design principle: handling an event = claiming it.** Calling \`preventDefault\`
already says "I own this event's default behavior"; \`swallow\` extends that to
"and no one else should react to it either." Use it whenever you would call
\`preventDefault\`. If a parent needs to observe events before children claim
them, use the \`capture\` phase explicitly — don't rely on implicit bubbling.

\`\`\`typescript
import {swallow} from '@fuzdev/fuz_util/dom.ts';

// swallow(event, immediate?, preventDefault?)
swallow(e); // preventDefault + stopImmediatePropagation (default)
swallow(e, false); // preventDefault + stopPropagation (non-immediate)
swallow(e, true, false); // stopImmediatePropagation only (no preventDefault)
\`\`\`

For handlers that only need \`stopPropagation\` without \`preventDefault\` (e.g.,
preventing game input from seeing keystrokes in a chat input), use
\`e.stopPropagation()\` directly.

\`\`\`svelte
<!-- Claiming an event in a handler -->
<script lang="ts">
	import {swallow} from '@fuzdev/fuz_util/dom.ts';

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

const cleanup_wheel = on(
	canvas,
	'wheel',
	(e) => {
		handle_zoom(e);
		swallow(e);
	},
	{passive: false},
);
\`\`\`

## Component Composition

### Module Script Block

Use \`<script lang="ts" module>\` for component-level exports (contexts, types):

\`\`\`svelte
<!-- TomeSection.svelte -->
<script lang="ts" module>
	import {create_context} from './context_helpers.ts';

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

## Runes in .svelte.ts Files

\`.svelte.ts\` files use runes (\`$state\`, \`$derived\`, \`$effect\`) outside
components. Prefer **classes** over module-level state — export a class,
instantiate once at the appropriate root, share it via context.

### Avoid Module-Level Runes for Shared State

Don't declare \`$state\` variables at module scope and expose them through
getter/setter objects. A module-level rune is a hidden global: it can't be
reset per test, per realm, or per session; it ties state lifetime to the
module rather than a component; and a second instance is impossible if you
later need one.

\`\`\`typescript
// Anti-pattern: module-level runes exposed through a singleton
let show_map = $state.raw(false);
let show_sidebar = $state.raw(true);

export const world_ui = {
	get show_map() {
		return show_map;
	},
	set show_map(v: boolean) {
		show_map = v;
	},
	get show_sidebar() {
		return show_sidebar;
	},
	set show_sidebar(v: boolean) {
		show_sidebar = v;
	},
};
\`\`\`

Use a class + context instead — the class owns its state, and a root
component sets it once:

\`\`\`typescript
// world_ui_state.svelte.ts
import {create_context} from '@fuzdev/fuz_ui/context_helpers.ts';

export const world_ui_context = create_context<WorldUiState>();

export class WorldUiState {
	show_map: boolean = $state.raw(false);
	show_sidebar: boolean = $state.raw(true);
}
\`\`\`

\`\`\`svelte
<!-- +layout.svelte or similar root component -->
<script>
	import {WorldUiState, world_ui_context} from '#lib/world_ui_state.svelte.ts';
	world_ui_context.set(new WorldUiState());
<\/script>
\`\`\`

\`\`\`svelte
<!-- any descendant component -->
<script>
	import {world_ui_context} from '#lib/world_ui_state.svelte.ts';
	const world_ui = world_ui_context.get();
<\/script>
\`\`\`

**When module-level runes are fine:** inside a factory function body (see
below) — the state is scoped to the returned object, not the module.

### Factory Functions with Getter/Setter Proxies

\`\`\`typescript
// api_search.svelte.ts
export const create_api_search = (library: Library): ApiSearchState => {
	let query = $state.raw(''); // raw — primitive replaced wholesale (the default)

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
		// spread before sort — \`items\` may be the shared source array
		return [...items].sort((a, b) => a.name.localeCompare(b.name));
	});

	return {
		get query() {
			return query;
		},
		set query(v: string) {
			query = v;
		},
		modules: {
			get all() {
				return all_modules;
			},
			get filtered() {
				return filtered_modules;
			},
		},
		declarations: {
			get all() {
				return all_declarations;
			},
			get filtered() {
				return filtered_declarations;
			},
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

### Plain Classes for Imperative Loops

Canvas2D/WebGPU renderers, \`requestAnimationFrame\` loops, and long-lived
pointer listeners are the inverse case: use a **plain class with no runes**,
mounted by a thin \`.svelte\` wrapper. Private fields (e.g. \`#hovered_id\`,
\`#cursor_x\`) stay non-reactive on purpose — mutating them from an rAF tick
must not schedule reruns. The wrapper binds dimensions, forwards reactive
sources via getter-backed options, and calls \`destroy()\` on unmount. Runes
live in the wrapper, never in the loop.

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

Prefer keyed each blocks — Svelte surgically inserts or removes items
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

**Goal: minimal \`<style>\` blocks.** Components delegate styling to fuz_css
utility classes and design tokens; many well-designed components have no
\`<style>\` block at all. See \`css-patterns.md\` §Default styling is the baseline
and §Component Styling In Practice for the full rationale, anti-patterns, and
examples.

When a \`<style>\` block is needed, keep it focused on component-specific
layout logic (positioning, complex pseudo-states, responsive breakpoints),
with all values referencing design tokens, not hardcoded pixels or colors.

**Class naming**: fuz_css utilities use \`snake_case\` (\`p_md\`, \`gap_lg\`);
component-local classes use \`kebab-case\` (\`site-header\`, \`nav-links\`) to
distinguish them visually.

### JS Variables in CSS

Use \`style:\` directive to pass JS values as CSS custom properties:

\`\`\`svelte
<div style:--columns={columns}>...</div>

<style>
	div {
		grid-template-columns: repeat(var(--columns), 1fr);
	}
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
	h1 {
		color: var(--color);
	}
</style>
\`\`\`

\`\`\`svelte
<!-- :global override (last resort) -->
<div>
	<Child />
</div>

<style>
	div :global {
		h1 {
			color: red;
		}
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

| Instead of                      | Use                                           |
| ------------------------------- | --------------------------------------------- |
| \`let count = 0\` (implicit)      | \`let count = $state(0)\`                       |
| \`$:\` assignments/statements     | \`$derived\` / \`$effect\`                        |
| \`export let\`                    | \`$props()\`                                    |
| \`on:click={...}\`                | \`onclick={...}\`                               |
| \`<slot>\`                        | \`{#snippet}\` / \`{@render}\`                    |
| \`<svelte:component this={C}>\`   | \`<C />\` (dynamic component directly)          |
| \`<svelte:self>\`                 | \`import Self from './Self.svelte'\` + \`<Self>\` |
| \`use:action\`                    | \`{@attach}\`                                   |
| \`class:active\`                  | \`class={['base', active && 'active']}\`        |
| Stores (\`writable\`, \`readable\`) | Classes with \`$state\` fields                  |

## Quick Reference

The decision-fraught choices, summarized:

- **\`$state.raw()\` vs \`$state()\`** — \`$state.raw()\` for primitives and values
  replaced wholesale; \`$state()\` when you want in-place mutation (\`push\`,
  property writes, \`bind:\` on object properties) to trigger reactivity.
- **\`$derived\` vs \`$derived.by()\`** — \`$derived\` takes an expression;
  \`$derived.by()\` takes a function for loops/conditionals/multi-step logic.
  Mark class-level deriveds \`readonly\`.
- **\`{@attach}\` vs \`$effect\`** — attachments for element behavior (replaces
  \`use:action\`); effects for everything else, but reach for \`$derived\`,
  \`<svelte:window>\`, or event handlers first.
- **\`create_context<T>()\` vs raw \`setContext\`/\`getContext\`** — fuz_ui's
  \`create_context\` provides the throw-on-missing \`get()\` plus \`get_maybe()\`,
  with optional fallback factory.
`},{slug:"task-patterns",title:"Task Patterns",content:"# Task Patterns\n\nGro's task system for project automation in `@fuzdev/gro`. Tasks are TypeScript\nmodules with a `.task.ts` suffix exporting a `task` object with a `run` function.\n\n## Task Interface\n\n```typescript\ninterface Task<\n  TArgs = Args,\n  TArgsSchema extends z.ZodType<Args, Args> = z.ZodType<Args, Args>,\n  TReturn = unknown,\n> {\n  run: (ctx: TaskContext<TArgs>) => TReturn | Promise<TReturn>;\n  summary?: string;\n  Args?: TArgsSchema;\n}\n```\n\n- `run` — entry point, receives `TaskContext`\n- `summary` — shown in `gro` task listing and `--help`\n- `Args` — optional Zod schema for CLI arg parsing and validation (see ./zod-schemas)\n\n`TArgsSchema` and `TReturn` are rarely customized — tasks are either\n`Task` (default args) or `Task<Args>` (custom Zod-inferred `Args` type).\n\n### Basic task example\n\n```typescript\n// src/lib/greet.task.ts\nimport type {Task} from '@fuzdev/gro';\n\nexport const task: Task = {\n  summary: 'greet the user',\n  run: async ({log}) => {\n    log.info('hello!');\n  },\n};\n```\n\nRun with `gro greet` or `gro src/lib/greet`.\n\n### Task with args\n\nBoth the Zod schema (value) and inferred type share the name `Args`:\n\n```typescript\n// src/lib/greet.task.ts\nimport type {Task} from '@fuzdev/gro';\nimport {z} from 'zod';\n\nexport const Args = z.strictObject({\n  name: z.string().meta({description: 'who to greet'}).default('world'),\n});\nexport type Args = z.infer<typeof Args>;\n\nexport const task: Task<Args> = {\n  summary: 'greet someone by name',\n  Args,\n  run: async ({args, log}) => {\n    log.info(`hello, ${args.name}!`);\n  },\n};\n```\n\nRun with `gro greet --name Claude`. `gro greet --help` shows help auto-generated\nfrom the Zod schema.\n\n## TaskContext\n\n```typescript\ninterface TaskContext<TArgs = object> {\n  args: TArgs;\n  config: GroConfig;\n  svelte_config: ParsedSvelteConfig;\n  filer: Filer;\n  log: Logger;\n  timings: Timings;\n  invoke_task: InvokeTask;\n}\n```\n\n| Field           | Type                | Purpose                                         |\n| --------------- | ------------------- | ----------------------------------------------- |\n| `args`          | `TArgs`             | Parsed CLI arguments (validated by Zod if set)   |\n| `config`        | `GroConfig`         | Gro configuration (plugins, task_root_dirs, etc) |\n| `svelte_config` | `ParsedSvelteConfig`| Parsed SvelteKit config (aliases, paths)         |\n| `filer`         | `Filer`             | Filesystem tracker (watches files in dev mode)   |\n| `log`           | `Logger`            | Logger instance scoped to the task               |\n| `timings`       | `Timings`           | Performance measurement (start/stop timers)      |\n| `invoke_task`   | `InvokeTask`        | Call other tasks programmatically                |\n\n### invoke_task\n\n```typescript\ntype InvokeTask = (task_name: string, args?: Args, config?: GroConfig) => Promise<void>;\n```\n\nOmitting `config` passes the current config. Respects the override system:\n`invoke_task('test')` runs the user's override if one exists.\n\n```typescript\nexport const task: Task = {\n  run: async ({invoke_task}) => {\n    await invoke_task('typecheck');\n    await invoke_task('test');\n    await invoke_task('gen', {check: true});\n    await invoke_task('format', {check: true});\n    await invoke_task('lint');\n  },\n};\n```\n\nThis is the core pattern used by `check.task.ts` (which adds conditional\nexecution via `--no-*` flags).\n\n## Args Pattern\n\n### Conventions\n\n- Export both Zod schema and inferred type as `Args` at module level\n- Use `z.strictObject()` (not `z.object()`)\n- `.meta({description: '...'})` for CLI help text\n- `.default(...)` for defaults — required fields without defaults must be passed via CLI\n- `/** @nodocs */` to exclude from docs generation\n\n### Positional arguments\n\n`_` key for positional arguments (array of strings):\n\n```typescript\nexport const Args = z.strictObject({\n  _: z.array(z.string()).meta({description: 'file patterns to filter'}).default(['.test.']),\n  dir: z.string().meta({description: 'working directory'}).default('src/'),\n});\nexport type Args = z.infer<typeof Args>;\n```\n\nRun with: `gro test foo bar --dir src/lib/` (positional `foo`, `bar` go to `_`).\n\n### Boolean dual flags\n\n`--no-*` dual flags for opt-out behavior:\n\n```typescript\nexport const Args = z.strictObject({\n  typecheck: z.boolean().meta({description: 'dual of no-typecheck'}).default(true),\n  'no-typecheck': z.boolean().meta({description: 'opt out of typechecking'}).default(false),\n  test: z.boolean().meta({description: 'dual of no-test'}).default(true),\n  'no-test': z.boolean().meta({description: 'opt out of running tests'}).default(false),\n});\n```\n\n`gro check --no-test` disables testing. `--help` hides the positive flags\nwhen a `no-*` dual exists, showing only the `no-*` entry.\n\n## Error Handling\n\n### TaskError\n\nKnown failure with clean message (no stack trace). Use when the message is\nsufficient for the user to fix the problem:\n\n```typescript\nimport {TaskError} from '@fuzdev/gro';\n\nthrow new TaskError('Missing required config file: gro.config.ts');\n```\n\n### SilentError\n\nExit with non-zero code when the error is already logged. Primarily\ninternal to `invoke_task.ts`:\n\n```typescript\nimport {SilentError} from '@fuzdev/gro/task.ts';\n\nlog.error('Detailed error information...');\nthrow new SilentError();\n```\n\n### When to use which\n\n| Error type    | Stack trace | Gro logs message | Use when                          |\n| ------------- | ----------- | ---------------- | --------------------------------- |\n| Regular Error | Yes         | Yes              | Unexpected failures               |\n| `TaskError`   | No          | Yes              | Known failures with clear message |\n| `SilentError` | No          | No               | Already logged the error yourself |\n\n## Task Discovery\n\nSource task files use the `.task.ts` suffix; the `.task.js` form is only gro's\ncompiled builtins under `gro/dist/`, which the task loader also discovers. Gro\nsearches `task_root_dirs` in order (default: `src/lib/`, `./`, `gro/dist/`):\n\n```\nsrc/lib/greet.task.ts      -> gro greet\nsrc/lib/deploy.task.ts     -> gro deploy\nsrc/lib/db/migrate.task.ts -> gro db/migrate\n```\n\n`gro` with no task name or `gro some/dir` lists all tasks without executing.\n\n## Task Override Pattern\n\nLocal tasks override Gro builtins with the same name:\n\n- `src/lib/test.task.ts` overrides Gro's builtin `test` task\n- Run the builtin explicitly: `gro gro/test`\n\nThe common pattern wraps the builtin:\n\n```typescript\nimport type {Task} from '@fuzdev/gro';\n\nexport const task: Task = {\n  summary: 'run tests with custom setup',\n  run: async ({invoke_task, args}) => {\n    // custom setup\n    await invoke_task('gro/test', args); // call the builtin\n    // custom teardown\n  },\n};\n```\n\n## Task Composition\n\n**`invoke_task` (recommended):** Respects overrides, provides logging context,\nauto-forwards CLI args from `--` sections:\n\n```typescript\nawait invoke_task('build', {sync: false, gen: false});\n```\n\n**Direct import:** Bypasses override resolution, tighter coupling:\n\n```typescript\nimport {task as test_task} from './test.task.ts';\nawait test_task.run(ctx);\n```\n\n### Args forwarding\n\nCLI args forward to composed tasks via `--` separators:\n\n```bash\ngro check -- gro test --coverage\n```\n\nForwards `--coverage` to `test` when `check` invokes it. Multiple `--`\nsections can target different sub-tasks.\n\n## Quick Reference\n\n| Export        | Type      | Import from           | Purpose                                        |\n| ------------- | --------- | --------------------- | ---------------------------------------------- |\n| `Task`        | Interface | `@fuzdev/gro`         | Task definition (run, summary, Args)           |\n| `TaskContext` | Interface | `@fuzdev/gro`         | Context passed to task.run                     |\n| `TaskError`   | Class     | `@fuzdev/gro`         | Known failure (no stack trace)                 |\n| `SilentError` | Class     | `@fuzdev/gro/task.ts` | Exit silently (error already logged)           |\n| `InvokeTask`  | Type      | `@fuzdev/gro/task.ts` | `(task_name, args?, config?) => Promise<void>` |\n"},{slug:"testing-patterns",title:"Testing Patterns",content:`# Testing Patterns

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
- [Serde Boundary Conformance](#serde-boundary-conformance) (Rust ↔ hand-written TS: round-trip + coverage guard)
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

Tests live in \`src/test/\` (not co-located), mirroring \`src/lib/\`
subdirectories (e.g., \`src/lib/auth/\` -> \`src/test/auth/\`).

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
methods unless the replacement improves failure diagnostics without losing
narrowing.

\`\`\`typescript
import {test, assert} from 'vitest';

assert.ok(value); // narrows away null/undefined — the standard guard
assert.strictEqual(a, b);
assert.deepStrictEqual(a, b);
\`\`\`

Strengthen assertions when the value is **known**: \`assert.strictEqual\` for
exact expected values, \`assert.include\`/\`assert.notInclude\` for array
membership (shows actual contents on failure). Leave \`assert.ok\` for guards
where the goal is narrowing, not value checking.

**Why \`assert\` over \`expect\`:** \`assert\` methods narrow types for TypeScript;
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
Array.from({length: 100}, (_, i) => src(\`source\${i}.fuz.dev\`));
\`\`\`

Real third-party domains (\`fonts.googleapis.com\`, \`js.stripe.com\`,
\`cdnjs.cloudflare.com\`) are fine when the test specifically documents
integration with that vendor.

### Async Rejection Testing

For async functions that should reject, use \`assert_rejects\` from
\`@fuzdev/fuz_util/testing.ts\`. It places \`assert.fail\` outside the catch
block so the test's own assertion errors aren't accidentally caught:

\`\`\`typescript
import {assert_rejects} from '@fuzdev/fuz_util/testing.ts';

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

Any test using a \`Db\` instance uses the \`.db.test.ts\` suffix, with \`.db\`
immediately before \`.test.ts\` — e.g., \`foo.integration.db.test.ts\`.

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

fuz_app's \`testing/db.ts\` provides
\`create_describe_db(factories, truncate_tables)\`. Consumer projects create a
\`db_fixture.ts\`:

\`\`\`typescript
// src/test/db_fixture.ts
import type {Db} from '#lib/db/db.ts';
import {run_migrations} from '#lib/db/migrate.ts';
import {auth_migration_ns} from '#lib/auth/migrations.ts';
import {
	create_pglite_factory,
	create_pg_factory,
	create_describe_db,
	auth_integration_truncate_tables,
	log_db_factory_status,
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
import {describe, assert, test} from 'vitest';
import {query_create_account} from '#lib/auth/account_queries.ts';
import {describe_db} from '../db_fixture.ts';

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
\`#lib/testing/app_server.ts\` for a full Hono app with middleware, routes, and
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
(\`DROP SCHEMA public CASCADE\`) instead of paying the cold-start cost.

## Test Helpers

### Shared Helpers (\`@fuzdev/fuz_util/testing.ts\`)

Cross-repo test assertions live in \`@fuzdev/fuz_util/testing.ts\`. Depends
only on vitest — safe for fuz_util's zero-runtime-deps constraint.

\`\`\`typescript
import {assert_rejects, create_mock_logger} from '@fuzdev/fuz_util/testing.ts';

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
modules exporting \`create_shared_*_tests()\`; test files become thin wrappers:

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
import {create_shared_core_tests} from './contextmenu_test_core.ts';
import ContextmenuRoot from '#lib/ContextmenuRoot.svelte';

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

\`fuz_ui\` uses this for contextmenu components with 8 factory modules
(\`contextmenu_test_{core,rendering,keyboard,nested,positioning,scoped,edge_cases,link_entries}.ts\`).

## Fixture-Based Testing

For parsers, analyzers, and transformers. Used in fuz_ui (tsdoc, ts, svelte),
\`@fuzdev/mdz\` (mdz, svelte_preprocess_mdz), and other static-analysis tooling.

### Directory Structure

Each fixture is a subdirectory with an input and a generated \`expected.json\`:

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
import {mdz_parse} from '#lib/mdz.ts';
import {run_update_task} from '../../test_helpers.ts';

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

DI via small \`*Deps\` interfaces (fuz_gitops still spells them
\`*Operations\` — legacy naming, migrating). Functions accept a deps parameter
with a default; tests inject controlled implementations.
See ./dependency-injection for the full pattern.

**fuz_gitops operations pattern (legacy \`*Operations\` naming):**

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
import {stub_app_deps} from '#lib/testing/stubs.ts';
import {create_mock_runtime} from '#lib/runtime/mock.ts';

const deps = stub_app_deps; // throwing stubs for auth deps
const runtime = create_mock_runtime(); // MockRuntime for CLI tests
\`\`\`

### vi.mock() Usage

Legacy escape hatch, not a pattern — it exists where code predates the DI
convention (gro's build/deploy/cache tests are the big cluster) or where a
call site has no injectable seam (fuz_app's bearer-auth middleware calls
\`query_*\` functions by name; its tests module-mock them as a documented
carve-out). Treat any *new* \`vi.mock\` as a signal to add a deps seam
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

| Flag                 | Repo    | Purpose                                      |
| -------------------- | ------- | -------------------------------------------- |
| \`SKIP_EXAMPLE_TESTS\` | fuz_css | Skip slow Vite plugin integration tests      |
| \`TEST_DATABASE_URL\`  | fuz_app | Enable PostgreSQL tests (PGlite always runs) |

## Test Structure

### Basic Test Pattern

\`\`\`typescript
import {describe, test, assert} from 'vitest';
import {query_create_account} from '#lib/auth/account_queries.ts';

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
| \`describe_audit_completeness_tests\`         | varies | End-to-end audit emit → persist → query         |
| \`describe_bootstrap_success_tests\`          | 3      | Bootstrap success path (empty DB, real flow)    |
| \`describe_rate_limiting_tests\`              | 3      | IP, per-account, bearer rate limiting           |
| \`describe_round_trip_validation\`            | varies | Schema-driven positive-path validation          |
| \`describe_rpc_round_trip_tests\`             | varies | RPC schema-driven positive-path validation      |
| \`describe_data_exposure_tests\`              | 6      | Schema-level + runtime field blocklists         |
| \`describe_standard_adversarial_headers\`     | 7      | Header injection cases                          |
| \`describe_rpc_attack_surface_tests\`         | 3      | RPC adversarial auth/envelope/params            |
| \`describe_standard_tests\`                   | 8      | Bundle: 8 DB-backed suites, relevant-config silent-skip gates |

Live in \`fuz_app/src/lib/testing/\` (library exports, not test files). Accept
configuration via \`session_options\`, \`create_route_specs\`, and \`rpc_endpoints\`.
The \`describe_standard_tests\` bundle reads a top-level \`bootstrap?:
BootstrapServerOptions\` (\`{mode: 'disabled' | 'surface_only' | 'live'}\`) that
gates the bootstrap-success suite (\`bootstrap.mode === 'live'\`) and flows to
the surface + live app.

### WebSocket Round-Trip Tests

WebSocket JSON-RPC endpoints are tested in-process via
\`@fuzdev/fuz_app/testing/ws_round_trip.ts\` — no HTTP server, no Deno. The
harness drives the real \`register_action_ws\` dispatcher and
\`BackendWebsocketTransport\` against \`MockWsClient\` connections, so per-action
auth, input validation, \`ctx.notify\`, and broadcast fan-out all run through
real code paths.

Convention (used in zzz):

1. **All round-trip helpers live in fuz_app**
   (\`@fuzdev/fuz_app/testing/ws_round_trip.ts\`):
   - \`create_ws_test_harness({specs, handlers, ...})\` → \`{transport,
     connect}\`. \`connect(identity?)\` is async, resolving after
     \`on_socket_open\` completes. Passes through \`register_action_ws\`
     options (\`on_socket_open\`, \`on_socket_close\`, \`extend_context\`,
     \`transport\`, \`log\`); share a \`BackendWebsocketTransport\` via the
     \`transport\` option to test cross-harness broadcast fan-out.
   - \`MockWsClient.request<R>(id, method, params, timeout?)\` — the
     default for request/response. Returns \`result\` on success; throws
     \`rpc #id failed: [code] message data=...\` on error frames.
   - \`client.send(message)\` + \`client.wait_for(predicate)\` — raw
     primitives for asserting on an error frame directly (e.g. \`-32602\`
     + zod issues) or when the request never resolves (\`ctx.signal\`
     abort tests).
   - Predicates: \`is_notification(method)\`, \`is_response_for(id)\`, and
     \`is_notification_with<P>(method, (params) => boolean)\` — a type
     guard narrowing \`wait_for\` / \`messages.filter\` results without an
     explicit \`<T>\` at the call site.
   - Wire-frame types for narrowing: \`JsonrpcNotificationFrame<P>\`,
     \`JsonrpcSuccessResponseFrame<R>\`, \`JsonrpcErrorResponseFrame<D>\`.
   - \`build_broadcast_api<TApi>({harness, specs})\` — wires peer +
     transport + typed broadcast API, mirroring real backend assembly.
   - \`keeper_identity()\` — default identity for keeper-authed connections.

2. **Repo-local \`ws_test_harness.ts\` is only for project-specific
   setup** — not a re-implementation of the above. Repos with memoized
   per-worker state (pglite + schema + seed) can add one; zzz has
   none, importing directly from
   \`@fuzdev/fuz_app/testing/ws_round_trip.ts\`.

3. **Split test files by aspect** (see _Test File Naming_ above):
   - \`ws.integration.dispatch.test.ts\` — request/response, \`ctx.notify\`,
     per-action auth, input validation, \`ctx.signal\`, concurrent requests
   - \`ws.integration.broadcast.test.ts\` — \`create_broadcast_api\`
     fan-out, close-removes-from-transport

4. **DB-backed WS tests** use the \`.db.test.ts\` suffix and memoize the
   harness per worker, since \`isolate: false\` + \`fileParallelism: false\`
   would otherwise double-init module-level state. Non-DB WS tests (zzz)
   build a fresh harness per test — setup is cheap and each test can
   supply its own ad-hoc specs + handlers.

## Serde Boundary Conformance

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
absent — the same skip discipline as the DB/Deno-gated tests above.

Gotchas: if the evaluator stubs nondeterministic globals (clock/RNG) to throw,
the fixture must use pure literals only. Gate the round-trip test on the
evaluator runtime being present (skip-with-notice), matching the repo's
Deno-gating posture.

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
| Hand-written TS + round-trip      | Honest against a Rust serde boundary without codegen (no schemars/ts-rs) |
| Typed kitchen-sink fixture        | \`import type\`'d → typecheck-gated AND real-parser-gated from one source |
| Coverage guard over \`*::ALL\`      | Assert the fixture exercises every Rust variant                    |
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
export const create_session = (deps: QueryDeps, account_id: AccountId): Session => {/* ... */};

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
line when it surfaces *what would surprise a reader*: specific tables/columns,
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
  + signature already tell the story.
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

Multi-paragraph descriptions are *earned* by security or invariant
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
- Capitalization and trailing periods follow normal English. Both fragment-style (\`@param foo - the value to clamp\`) and sentence-style (\`@param foo - The value to clamp.\`) are accepted; pick one per file. Acronyms (CSS, HTML, URL) and proper names (Zod, Fisher-Yates) stay capitalized regardless.

\`\`\`typescript
/**
 * Parses a semantic version string.
 * @param version_string - version to parse (format: "major.minor.patch")
 * @param allow_prerelease - allow versions with prerelease suffixes like "1.0.0-alpha"
 */
\`\`\`

Multi-sentence descriptions read as sentences and wrap with continuation
indentation — see the \`exclude_dev\` example under
[Name algorithms](#name-algorithms-and-explain-rationale).

### \`@returns\`

Use \`@returns\` (not \`@return\`). Same capitalization rules as \`@param\`.

\`\`\`typescript
/**
 * Gets the current time.
 * @returns the current \`Date\` in milliseconds since epoch
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

Give the reader a clear mental model of how to use the API:

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

\`\`\`svelte
/**
 * Index 0 is under 1 is under 2 — the topmost dialog is last in the array.
 * @default 0
 */
index?: number;
\`\`\`

See [Svelte components](#svelte-components) for a full \`$props()\` block.

### \`@nodocs\` (non-standard)

Excludes from docs generation and flat namespace validation. Implemented by
\`svelte-docinfo\` — a tagged declaration is dropped from the analysis output
and skipped by duplicate checking. Use for build-system internals (Gro
\`Args\`/\`task\`, generated \`gen\` exports) or to resolve flat-namespace
collisions.

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
See [SKILL.md §Flat Namespace](../#flat-namespace-fail-fast) for which side to rename.

### \`@mutates\` (non-standard)

Documents mutations to parameters or external state. Supported by fuz_ui's
\`tsdoc_helpers.ts\`.

**Preferred form**: \`@mutates target - description\`. The description is
the value-add — it tells the reader *what* changes and, when non-obvious,
*why or when*. Without it the tag duplicates the function name and
signature.

A bare backtick form (\`\` @mutates \`target\` \`\`, no description) parses but
is discouraged: if the mutation needs no description, the tag adds little
too. When you write \`@mutates\`, make the description carry weight.

Same capitalization rules as \`@param\`. Document mutations visible outside
the function; internal locals, closure state, and pull-based lazy caches
that consumers don't observe are out of scope.

#### When \`@mutates this\` is warranted on class methods

Stateful classes mutate by design — that's the point. Tagging *every*
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

Ranking when the tag *is* warranted: \`@mutates this.specific_field -
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
11. \`@nodocs\`

\`@mutates\` goes after \`@returns\` (or after \`@param\` if no return).

## Inter-linking with mdz

Backtick-wrapped identifiers auto-link to API docs. Unmatched references
fall through to plain \`<code>\`.

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

**Never reference outside the repo from TSDoc.** Source comments render into
the published API docs, where the shipped package stands alone — a bare \`../\`
path to another repo (or an absolute workspace path) becomes a dead link. Keep TSDoc
references repo-local. Attribute external inspiration in prose without a
navigable path, or link a full URL; a backticked literal stays an escape hatch
(see [Path references](./path-references) §2). Cross-repo *code* references
use the import-specifier form (\`@scope/pkg/foo.ts\`), not a relative path.


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

**Pipeline stages** — combine the numbered-steps form
([Document workflows](#document-workflows-with-numbered-steps)) with a \`@see\`
cluster in a single \`@module\` comment.

### Functions

\`\`\`\`typescript
// src/lib/async.ts — from fuz_util
/**
 * Maps over items with controlled concurrency, preserving input order.
 *
 * @param concurrency - maximum number of concurrent operations
 * @param signal - optional \`AbortSignal\` to cancel processing
 * @returns array of results in same order as input
 * @throws Error if \`concurrency < 1\`
 *
 * @example
 * \`\`\`ts
 * const results = await map_concurrent(
 *   file_paths,
 *   5, // max 5 concurrent reads
 *   async (path) => readFile(path, 'utf8'),
 * );
 * \`\`\`
 */
export const map_concurrent = async <T, R>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T, index: number) => Promise<R> | R,
	signal?: AbortSignal,
): Promise<Array<R>> => {
	// ...
};
\`\`\`\`

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
	 * Pre-resolved absolute file paths of modules this file imports (opt-in).
	 * When supplied, the session treats this as authoritative and skips its
	 * own lex+resolve pass. Only include resolved local imports — node_modules
	 * paths are filtered out at storage time by \`isSource\` either way.
	 */
	dependencies?: ReadonlyArray<string>;
	// Reverse edges (\`dependents\`) are not a caller input — computed
	// internally by \`computeDependents\` from forward edges of the owned set.
}
\`\`\`\`

### Svelte components

Document props inline in the \`$props()\` type annotation. For obvious props
with no default, a comment is optional — focus on behavior, constraints,
and non-obvious defaults.

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

## Drift — Correctness Over Coverage

**A wrong doc comment is worse than a missing one**: it looks authoritative,
so readers trust it and propagate the mistake. Coverage (presence) is the
easy axis; correctness (currency) is the failure mode that actually matters.
When refactoring a public API — changing signatures, adding fields to return
types, tightening error semantics, or renaming constants — re-read the TSDoc
on every touched symbol before shipping.

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
- **The CLI is not a twin.** A CLI is a *client* of the server, not a second
  spine implementation — two CLIs prove nothing about the wire. A CLI has two
  coherent states: **shipping** (compiled; a single-file binary is the point)
  or **retired** (deleted). No "run-directly TS CLI reference" middle state.

## Naming parity

Shared spine concepts — types, fields, error-reason literals, the named steps
of a shared algorithm — carry **parallel identifiers** across both spines,
modulo each language's case convention (\`post_commit_effects\` ↔
\`PostCommitEffects\`). A cross-impl name mismatch for the *same* concept is a
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
  headers. Consumers inherit shared *conformance principals* (credential
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
- **Env contract tests** that actively *reject retired variable names* — the
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
a version *value* differs while the parity test asserts the shape).

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
`},{slug:"type-utilities",title:"Type Utilities",content:`# Type Utilities

TypeScript type helpers in \`@fuzdev/fuz_util/types.ts\` — nominal typing,
stricter standard utilities, and selective partial types.

## Nominal Typing

TypeScript uses structural typing — two types with the same shape are
interchangeable. Nominal typing adds invisible brands to distinguish them.

### Flavored (loose)

\`Flavored<TValue, TName>\` adds an optional invisible brand. Unflavored base
types are assignable without casting, but different flavors are incompatible.
Primary nominal typing approach:

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

Real uses in fuz_util:

\`\`\`typescript
// fuz_util/path.ts
export type PathId = Flavored<string, 'PathId'>;

// fuz_util/git.ts
export type GitOrigin = Flavored<string, 'GitOrigin'>;
export type GitBranch = Flavored<string, 'GitBranch'>;

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

Exported but unused in the ecosystem: in practice, use \`Flavored\` for
compile-time nominal typing and Zod \`.brand()\` for runtime-validated types.

### Choosing between them

| Type     | Base assignable? | Safety | Use when                           |
| -------- | ---------------- | ------ | ---------------------------------- |
| Flavored | Yes (no cast)    | Loose  | IDs, paths, ergonomic APIs         |
| Branded  | No (cast needed) | Strict | Validated data, security-sensitive |

### Zod \`.brand()\` — runtime-validated nominal types

For types needing runtime validation, use Zod \`.brand()\` (distinct from
fuz_util's \`Branded\`):

\`\`\`typescript
// fuz_util/id.ts
export const Uuid = z.uuid().brand('Uuid');
export type Uuid = z.infer<typeof Uuid>;

// fuz_util/datetime.ts
export const Datetime = z.iso.datetime().brand('Datetime');
export type Datetime = z.infer<typeof Datetime>;

// zzz/diskfile_types.ts
export const DiskfilePath = z
  .string()
  .refine((p) => is_path_absolute(p), {message: 'path must be absolute'})
  .brand('DiskfilePath');
export type DiskfilePath = z.infer<typeof DiskfilePath>;
\`\`\`

\`Flavored\`/\`Branded\` are compile-time only (no runtime check); Zod \`.brand()\`
brands a schema that _also_ validates — \`Uuid\` rejects non-UUID strings at parse
time — so reach for \`.brand()\` when the value crosses a runtime boundary. (zzz
re-imports fuz_util's \`Uuid\` rather than defining its own.)

See ./zod-schemas for full Zod schema conventions including branded types.

## Strict Utility Types

### OmitStrict

Stricter \`Omit\` — \`K\` must be an actual key of \`T\`:

\`\`\`typescript
type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
\`\`\`

Standard \`Omit\` accepts any string for \`K\` (typos compile silently);
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

**Applies to**: \`blake3\` (WASM hashing) and \`tsv\` (parser/formatter bindings —
WASM, C-FFI, and N-API). The fuz workspace does not currently use WASM.

**Publishing stance**: npm gets **both** native (N-API) and WASM builds. The
C-FFI \`cdylib\` additionally serves Deno FFI and Python.

## Two Build Targets

| Approach       | Tool           | Consumer            | Use case                        |
| -------------- | -------------- | -------------------- | ------------------------------- |
| wasm-bindgen   | \`wasm-pack\`    | JS runtimes          | Ship Rust to Deno/Node/browsers |
| Component model | \`cargo-component\` | Wasmtime / plugins | Sandboxed execution, composition |

**wasm-bindgen**: generates glue code, handles memory management, produces
\`.wasm\` + \`.js\` ready to import. **Component model**: capability-controlled
execution — components declare imports/exports via WIT interfaces.

When to use which: npm publishing → wasm-bindgen; benchmarking across
runtimes → both; plugin systems (speculative) → component model.

## WIT Interface Design

\`\`\`wit
package fuzdev:blake3@0.0.1;

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

- Package naming \`<namespace>:<name>@<version>\` — use the \`fuzdev\` namespace.
- WIT **requires** kebab-case; binding generators convert per language.
- **One-shot functions** for stateless ops; **resources** for stateful
  streaming (\`hasher\` holds state across \`update\`/\`finalize\`).
- **\`result<T, E>\` with typed error enums** (not strings); minimal enums —
  one variant per distinct failure mode.
- **Worlds declare capabilities** — \`export hashing\` with no imports = pure
  computation, no ambient access.

## Component Implementation (wit-bindgen)

From \`blake3_component\`:

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
    // derive_key: same shape
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

    fn update(&self, data: Vec<u8>) {
        self.inner.borrow_mut().update(&data);
    }

    fn finalize(&self) -> Vec<u8> {
        self.inner.borrow().finalize().as_bytes().to_vec()
    }
    // new_derive_key / finalize_and_reset / reset: same RefCell shape
}
\`\`\`

Key patterns: \`wit_bindgen::generate!\` at compile time from WIT; unit struct
+ \`export!\`; **\`RefCell\` for resource state** (resources receive \`&self\`);
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
# clippy tables — see rust-patterns.md §Lints; overriding only unsafe_code
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

Pin \`wasmtime\`/\`wasmtime-wasi\` at the same major (currently 45) and enable
the \`component-model\` feature on \`wasmtime\` — the \`bindgen!\`/component APIs
don't compile without it.

\`\`\`rust
use wasmtime_wasi::{ResourceTable, WasiCtx, WasiCtxBuilder, WasiCtxView, WasiView};

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

// Resource lifecycle: host owns the handle, guest owns memory —
// drop explicitly to free guest memory
let hasher = hashing.hasher().call_constructor(&mut store)?;
hashing.hasher().call_update(&mut store, hasher, chunk)?;
let result = hashing.hasher().call_finalize(&mut store, hasher)?;
hasher.resource_drop(&mut store)?;
\`\`\`

## wasm-bindgen Patterns

### Crate architecture (blake3)

Shared core crate with thin wrappers — the SIMD split is genuinely two
crates (contrast tsv, where the split is a feature axis within one crate):

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
was dropped. Parsers are arena-based (rust-perf.md §Arena allocation): the
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

tsv_wasm runs wasm-opt with explicit feature flags — without them wasm-opt
fails on Rust 2024's bulk-memory ops:

\`\`\`toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = ['-O3', '--enable-bulk-memory', '--enable-nontrapping-float-to-int']
\`\`\`

### TypeScript entry points

Re-export from wasm-pack's \`pkg/\` output and add stream functions:

\`\`\`typescript
import { Blake3Hasher, derive_key, hash, keyed_hash } from './pkg/deno/blake3_wasm.js';
export { Blake3Hasher, derive_key, hash, keyed_hash };

import { make_stream_functions } from './stream.ts';
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(
    Blake3Hasher,
);
\`\`\`

Node entry uses synchronous initialization (\`readFileSync\` + \`initSync\`).
The generated packages bridge wasm-bindgen's camelCase to the ecosystem
convention: \`initSync\` is re-exported as \`init_sync\`.

### npm package structure

\`scripts/patch_npm_package.ts\` generates: \`index.js\` (Node auto-init),
\`browser.js\` (async \`init()\`, exports guarded with \`_check()\`), \`stream.js\`,
\`index.d.ts\`. Package exports map \`.\` → \`{ types, node, default }\`
conditions plus a \`./package.json\` self-reference.

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

| Crate      | Technology   | Target               | Error type           |
| ---------- | ------------ | -------------------- | -------------------- |
| \`tsv_wasm\` | wasm-bindgen | Deno, browsers, Node | \`Result<T, JsError>\` |
| \`tsv_napi\` | N-API        | Node.js, Bun (native npm path) | N-API errors |
| \`tsv_ffi\`  | C ABI        | Deno FFI, Python     | JSON error objects   |

All three share the \`tsv_arena\` per-thread arenas. \`tsv_ffi\` and \`tsv_napi\`
override \`unsafe_code = "allow"\` and re-declare the full workspace lint block
(rust-patterns.md §Lints). \`tsv_ffi\` uses raw pointers with
\`tsv_free(ptr, len)\` for memory management and wraps every entry point in
\`panic::catch_unwind\`, rendering payloads as \`{"error": "panic: …"}\` — which
requires the \`panic = "unwind"\` corpus profile to be effective
(rust-patterns.md §Release Profile).

## Package naming: \`_wasm\` suffix

WASM artifacts carry a \`_wasm\` suffix everywhere they could be confused with a
native build; native artifacts stay bare. The suffix is part of the published
identity — npm package, crate name, and the generated \`*_wasm_bg.wasm\` all
agree.

| Project | WASM packages | Native |
| ------- | ------------- | ------ |
| blake3 | \`@fuzdev/blake3_wasm\` (SIMD), \`@fuzdev/blake3_wasm_small\` (no SIMD) | none |
| tsv | \`@fuzdev/tsv_wasm\` (parse + format + \`tsv\` CLI), \`@fuzdev/tsv_format_wasm\`, \`@fuzdev/tsv_parse_wasm\` | \`tsv\` CLI binary, \`tsv_ffi\` \`.so\`, \`tsv_napi\` \`.node\` |

- **The three tsv WASM packages come from one crate.** \`tsv_wasm\` has
  \`format\`/\`parse\` cargo features (default = both); the subset packages are
  \`--no-default-features --features format|parse\` builds. \`parse\` pulls the
  language crates' \`convert\` feature (the AST→JSON layer) + \`js-sys\`. The
  umbrella \`@fuzdev/tsv_wasm\` is the flagship (it ships the JS \`tsv\` CLI).
- **Native stays bare, and "tsv" is deliberately overloaded**: the native CLI
  binary (\`tsv_cli\` crate), the C-FFI lib, and the JS CLI inside
  \`@fuzdev/tsv_wasm\` are all invoked as \`tsv\` — same tool, per-runtime
  delivery.
- **Drop redundant kind labels.** Where artifacts are already grouped by kind,
  don't repeat \`(wasm)\` / \`(native)\` in the row name — the \`_wasm\` suffix (or
  its absence) carries it.

## Two Packages, Not Two Profiles (blake3)

blake3 ships two npm packages from different crates. Both are size-optimized
end-to-end (\`opt-level=s\` + wasm-opt \`-Os\`); the only differentiator is SIMD:

| Package                     | Crate              | RUSTFLAGS                                   | wasm-opt              | Size   |
| --------------------------- | ------------------ | ------------------------------------------- | --------------------- | ------ |
| \`@fuzdev/blake3_wasm\`       | \`blake3_wasm\`      | \`-C opt-level=s -C target-feature=+simd128\` | \`-Os --enable-simd …\` | ~45 KB |
| \`@fuzdev/blake3_wasm_small\` | \`blake3_wasm_small\`| \`-C opt-level=s\`                            | \`-Os …\`               | ~32 KB |

SIMD build: ~2.6x faster at large inputs (Deno/Node), slower on Bun (WASM
SIMD regression) — use the small build for Bun and bundle-size-sensitive
contexts. A size regression test pins the byte counts. The wasmtime component
is the exception — \`opt-level=3\`, since the host can absorb bytes for speed.

\`\`\`toml
# blake3_wasm (SIMD)
[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Os", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core", features = ["simd"] }
\`\`\`

blake3_wasm_small is the same minus \`--enable-simd\` and without the \`simd\`
feature. Rust 2024 enables bulk memory for \`wasm32-unknown-unknown\`, so
wasm-opt needs \`--enable-bulk-memory\` (and friends) or it fails.
\`--strip-producers\` removes compiler metadata.

### Build commands

\`\`\`bash
RUSTFLAGS='-C opt-level=s -C target-feature=+simd128' \\
    wasm-pack build crates/blake3_wasm --scope fuzdev --target deno --release --out-dir pkg/deno

RUSTFLAGS='-C opt-level=s' \\
    wasm-pack build crates/blake3_wasm_small --scope fuzdev --target deno --release --out-dir pkg/deno
\`\`\`

**Why RUSTFLAGS**: \`wasm-pack\` doesn't support \`--profile\` (conflicts with
\`--release\`), so RUSTFLAGS overrides at the compiler level. The base
\`[profile.release]\` keeps \`opt-level = "s"\` plus the canonical
lto/codegen-units/panic/strip block.

The build pipeline runs the two packages in parallel; deno and web targets
run sequentially within each (shared cargo intermediate artifacts).

## Testing

blake3 keeps **zero Rust unit tests by design**: correctness is asserted in
TypeScript (WASM vs native test vectors) and via a Wasmtime compare binary
for the component; \`cargo test --workspace\` serves as a compile gate. tsv's
binding tests run per runtime (Deno, N-API, npm) plus in-crate FFI/N-API
round-trip tests — see rust-patterns.md §Testing.

## Cross-References

| Resource                         | Link                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Blake3 WASM bindings             | [fuzdev/blake3](https://github.com/fuzdev/blake3)                               |
| Component model spec — WIT       | [WebAssembly/component-model WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md) |
| Component model spec — Explainer | [WebAssembly/component-model Explainer](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md) |
| Rust patterns                    | ./rust-patterns                                                              |
| Rust performance (arenas)        | ./rust-perf                                                                  |
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

| Layer | Module | Capabilities |
|---|---|---|
| Foundation | \`@fuzdev/fuz_util/zod.ts\` | Schema introspection — extract descriptions, defaults, aliases, types, properties; unwrap wrappers (\`zod_get_innermost_type\`, \`zod_unwrap_to_object\`); object-field helpers (\`zod_get_schema_keys\`, \`zod_get_field_schema\`, \`zod_maybe_get_field_schema\`); check optional/nullable/default; format values for display |
| Foundation | \`@fuzdev/fuz_util/id.ts\`, \`@fuzdev/fuz_util/datetime.ts\` | \`Uuid\`, \`Datetime\` branded types and factories (\`create_uuid\`, \`get_datetime_now\`, \`UuidWithDefault\`, \`DatetimeNow\`) |
| Cell helpers | \`@fuzdev/zzz/zod_helpers.ts\` | Path-transform schemas (\`PathWithTrailingSlash\`, \`PathWithoutTrailingSlash\`, \`PathWithLeadingSlash\`) |
| CLI | \`@fuzdev/fuz_app/cli/args.ts\`, \`help.ts\` | Schema-validated CLI arg parsing; schema-driven help text generation |
| HTTP | \`@fuzdev/fuz_app/http/schema_helpers.ts\` | \`schema_to_surface()\` exports JSON Schema via \`z.toJSONSchema()\` for snapshot-testable API surfaces; \`instanceof\` checks for schema type detection |
| Testing | \`@fuzdev/fuz_app/testing/schema_generators.ts\` | Schema-driven test data generation — valid bodies, adversarial inputs |

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
	selected_thread_id: Uuid.nullable().default(null),
}).meta({cell_class_name: 'Chat'});
export type ChatJson = z.infer<typeof ChatJson>;       // all fields present
export type ChatJsonInput = z.input<typeof ChatJson>;   // defaults omittable

// a schema extending a base + literal discriminant, exporting an input type
export const PackageResource = ResourceBase.extend({
	type: z.literal('package'),
	from: PackageMapping,
	check: z.string().optional(),
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
export const package_resource = (
	config: Omit<PackageResourceInput, 'type'>,
): PackageResource => {
	return PackageResource.parse({type: 'package', ...config});
};

// usage — type-safe, defaults applied, discriminant injected
const pkg = package_resource({id: 'nginx', name: 'nginx', from: {apt: 'nginx'}});
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
	.refine((p) => is_path_absolute(p), {message: 'path must be absolute'})
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
has_xml_tag: PartJsonBase.shape.has_xml_tag.default(true),

// or validate a single value against one field's schema
PartJsonBase.shape.has_xml_tag.parse(value);
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
	z.strictObject({name: z.string(), available: z.literal(true), checked_at: z.number()}),
	z.strictObject({
		name: z.string(),
		available: z.literal(false),
		error: z.string(),
		checked_at: z.number(),
	}),
]);
export type ProviderStatus = z.infer<typeof ProviderStatus>;
\`\`\`

### Plain Unions

Use \`z.union()\` when there's no single discriminant field, or when mixing shapes
with literals:

\`\`\`typescript
// zzz/jsonrpc.ts — multiple message shapes
export const JsonrpcMessage = z.union([
	JsonrpcRequest, JsonrpcNotification, JsonrpcResponse, JsonrpcErrorMessage,
]);

// mixed literals + an object shape
export const Sort = z.union([
	z.literal('asc'),
	z.literal('desc'),
	z.strictObject({by: z.string(), dir: z.enum(['asc', 'desc'])}),
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
	auth: RouteAuth.nullable(), // four-axis {account, actor, roles?, credential_types?}
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
