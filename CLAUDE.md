# fuz_docs

> experimental AI-generated docs and skills for Fuz, a zippy stack for human agency

fuz_docs (`@fuzdev/fuz_docs`) hosts experimental AI-generated documentation
and agent skills for the [Fuz](https://fuz.dev/) ecosystem, designed
for both human and machine consumption. Mostly poorly reviewed — conventions, patterns, and
reference material for `@fuzdev` projects.

**Website**: [docs.fuz.dev](https://docs.fuz.dev/)

For coding conventions, see Skill(fuz-stack).

## Committing

`git add` and `git commit` are denied by `.claude/settings.local.json` in
this repo — make the edits and stop, the user commits.

## Scope

fuz_docs is an **experimental AI-generated docs site and skills repo**:

- Static documentation site at docs.fuz.dev
- AI agent skills for AI-assisted development
- Coding convention references for the Fuz ecosystem
- Auto-generated API documentation

Content is mostly poorly reviewed — it's an actively evolving dumping
ground, not polished documentation. Some content is plain slop.

### What fuz_docs does NOT include

- Library code (use fuz_util, fuz_css, fuz_ui)
- Build tooling (use Gro)
- Component implementations (use fuz_ui)

## Gro commands

```bash
gro check      # typecheck, test, lint, format check (run before committing)
gro typecheck  # typecheck only (faster iteration)
gro test       # run tests with vitest
gro gen        # regenerate .gen files (skill docs)
gro build      # build for production (static adapter)
gro deploy     # build, commit, and push to deploy branch
```

IMPORTANT for AI agents: Do NOT run `gro dev` - the developer will manage the
dev server.

## Key dependencies

- Svelte 5 - component framework with runes
- SvelteKit - application framework with static adapter
- fuz_css (@fuzdev/fuz_css) - semantic-first CSS framework and design system
- fuz_ui (@fuzdev/fuz_ui) - UI components, theming, docs system
- fuz_util (@fuzdev/fuz_util) - utility functions
- fuz_code (@fuzdev/fuz_code) - syntax highlighting
- Gro (@fuzdev/gro) - build system and task runner

## Directory structure

```
src/
├── lib/              # library exports (minimal — UI helpers)
├── routes/           # SvelteKit routes
│   ├── docs/         # tome-based documentation
│   │   ├── api/      # auto-generated API docs
│   │   ├── introduction/ # ecosystem introduction
│   │   ├── fuz-stack/ # fuz stack conventions overview
│   │   ├── grimoire/ # grimoire pattern overview
│   │   ├── stack/    # stack libraries overview
│   │   └── library/  # library metadata
│   ├── skills/       # browsable skill docs rendered with mdz (auto-discovered)
│   │   ├── fuz-stack/ # generated from skills/fuz-stack/
│   │   └── grimoire/  # generated from skills/grimoire/
│   ├── tools/        # interactive tools (BLAKE3 hashing)
│   └── about/        # ecosystem links
skills/
├── fuz-stack/        # AI agent skill — coding conventions
│   ├── SKILL.md      # main skill file
│   └── references/   # detailed topic docs
└── grimoire/         # AI agent skill — grimoire pattern
    └── SKILL.md      # lore, quests, and skills
```

## SvelteKit app

Static docs site at docs.fuz.dev. Uses `@sveltejs/adapter-static` with
prerendering. Includes fuz_ui's tome-based documentation system and
auto-generated API docs.

### Routes

- `/` - Landing page with description, theme controls, ProjectLinks
- `/about` - Library detail, ecosystem links
- `/docs` - Tome-based documentation index
- `/docs/introduction` - Ecosystem introduction
- `/docs/fuz-stack` - Fuz stack conventions overview (links to skill docs)
- `/docs/grimoire` - Grimoire pattern overview
- `/docs/stack` - Stack libraries overview with an interactive, zoomable dependency map
- `/docs/api` - Auto-generated API documentation
- `/docs/api/[...module_path]` - Per-module API pages
- `/docs/library` - Library metadata page
- `/skills` - Skills index (auto-populated from manifest)
- `/skills/{skill}` - Browsable skill docs (generated, rendered with mdz)
- `/skills/{skill}/{slug}` - Per-reference skill doc pages (generated)
- `/tools` - Tools index
- `/tools/hash` - BLAKE3 hashing tool

Deploy with `gro deploy` (builds and pushes to deploy branch).

### Skill docs generation

A single `skill_docs.gen.ts` at `src/routes/skills/` auto-discovers all skills
from `skills/` and generates browsable route pages rendered with mdz. Produces
`skills_manifest.ts` (lightweight metadata for nav/index), per-skill
`skill_data.ts` (content strings), and `+page.svelte` route files. Adding a
skill: create `skills/{name}/SKILL.md`, optionally add `references/`, run
`gro gen`. See `src/routes/skills/CLAUDE.md` for the full pattern.

## Claude Code Skills

Each skill lives in `skills/<skill-name>/` following the
[Agent Skills](https://agentskills.io/) format ([spec](https://github.com/anthropics/skills)).

| Skill       | Path                | Purpose                                                                        |
| ----------- | ------------------- | ------------------------------------------------------------------------------ |
| `fuz-stack` | `skills/fuz-stack/` | Coding conventions and patterns for `@fuzdev` TypeScript and Svelte 5 projects |
| `grimoire`  | `skills/grimoire/`  | Grimoire pattern: lore, quests, and skills for cross-repo coordination         |

### Skill structure

```
skills/
├── fuz-stack/
│   ├── SKILL.md                       # Main skill file (YAML frontmatter + instructions)
│   ├── references/                    # Detailed documentation loaded as needed
│   │   ├── async-patterns.md          # Concurrency utilities (semaphore, deferred, concurrent map/each)
│   │   ├── code-generation.md         # Gro gen system (.gen.* files, dependencies, common patterns)
│   │   ├── common-utilities.md        # Result type, Logger, Timings, DAG execution, async overview
│   │   ├── css-patterns.md            # fuz_css styling conventions and utility classes
│   │   ├── dependency-injection.md    # Operations interfaces, BackendDeps, TxRuntime, mock factories
│   │   ├── documentation-system.md    # Docs pipeline, Tome system, layout architecture, project setup
│   │   ├── file-organization.md       # src/ tree, domain subdirectories, full-path imports, test mirroring
│   │   ├── mdz.md                     # mdz dialect: grammar surface, component/element registration, rendering seam, autolink, preprocessor
│   │   ├── path-references.md         # Path typography in docs (navigational vs src/lib module vs code-shaped)
│   │   ├── npm-dependencies.md        # Approved external npm package allowlist for TS/Svelte repos
│   │   ├── rust-dependencies.md       # Approved external crate allowlist for Rust workspaces
│   │   ├── rust-patterns.md           # Rust lints, errors, DI ladder, idioms, CLI patterns (fuz, zap, tsv, blake3)
│   │   ├── rust-perf.md               # Rust perf: profiling, arenas, locks, hot-path idioms, SIMD, false sharing
│   │   ├── rust-spine.md              # Spine crate map, consumer servers (run_app), env, daemon lifecycle, check-release
│   │   ├── svelte-patterns.md         # Svelte 5 runes, contexts, snippets, attachments
│   │   ├── task-patterns.md           # Gro task system (.task.ts, TaskContext, error handling)
│   │   ├── testing-patterns.md        # Testing patterns, fixtures, mocks, assertions
│   │   ├── tsdoc-comments.md          # TSDoc style guide and API docs system
│   │   ├── twin-impl.md               # TS ↔ Rust twin implementations: convergence, naming parity, wire crates
│   │   ├── type-utilities.md          # Nominal typing (Flavored/Branded), strict utility types
│   │   ├── wasm-patterns.md           # WASM/N-API build targets, WIT, wasm-bindgen, component model (blake3, tsv)
│   │   └── zod-schemas.md             # Zod schema conventions (strictObject, naming, branded types, introspection)
└── grimoire/
    └── SKILL.md                       # Grimoire pattern (lore, quests, skills)
```

## Project standards

- TypeScript strict mode
- Svelte 5 with runes API
- Prettier with tabs, 100 char width
- Node >= 22.15
- Private package (not published to npm)

## Related projects

- [`fuz_css`](../fuz_css/CLAUDE.md) - semantic-first CSS framework
- [`fuz_ui`](../fuz_ui/CLAUDE.md) - UI components and docs system
- [`fuz_util`](../fuz_util/CLAUDE.md) - utility functions
- [`gro`](../gro/CLAUDE.md) - build system and task runner
