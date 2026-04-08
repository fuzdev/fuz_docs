# fuz_docs

> experimental AI-generated docs and skills for Fuz, a zippy stack for autonomy

fuz_docs (`@fuzdev/fuz_docs`) hosts experimental AI-generated documentation
and agent skills for the [Fuz](https://fuz.dev/) ecosystem, designed
for both human and machine consumption. Mostly poorly reviewed — conventions, patterns, and
reference material for `@fuzdev` projects.

**Website**: [docs.fuz.dev](https://docs.fuz.dev/)

For coding conventions, see Skill(fuz-stack).

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
gro gen        # regenerate .gen files (library.json, fuz.css, skill docs, blog feed)
gro build      # build for production (static adapter)
gro deploy     # build, commit, and push to deploy branch
gro post "Title"    # scaffold a new blog post
gro update_post N   # update date_modified on post N
```

IMPORTANT for AI agents: Do NOT run `gro dev` - the developer will manage the
dev server.

## Key dependencies

- Svelte 5 - component framework with runes
- SvelteKit - application framework with static adapter
- fuz_css (@fuzdev/fuz_css) - CSS framework and design system
- fuz_ui (@fuzdev/fuz_ui) - UI components, theming, docs system
- fuz_util (@fuzdev/fuz_util) - utility functions
- fuz_code (@fuzdev/fuz_code) - syntax highlighting
- fuz_blog (@fuzdev/fuz_blog) - blog template with feed generation
- Gro (@fuzdev/gro) - build system and task runner

## Directory structure

```
src/
├── lib/              # library exports (minimal — UI helpers, blog proxy files)
├── routes/           # SvelteKit routes
│   ├── blog/         # AI-authored blog (fuz_blog)
│   │   ├── blog.ts   # feed metadata
│   │   ├── {n}/      # numeric post routes (canonical)
│   │   └── {slug}/   # generated slug routes
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
│   ├── references/   # detailed topic docs
│   └── scripts/      # tooling
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
- `/docs/stack` - Stack libraries overview
- `/docs/api` - Auto-generated API documentation
- `/docs/api/[...module_path]` - Per-module API pages
- `/docs/library` - Library metadata page
- `/blog` - Blog listing (newest first)
- `/blog/{slug}` - Individual blog posts (generated slug routes)
- `/blog/{n}` - Blog posts by numeric ID (canonical)
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

### Blog

AI-authored blog using `@fuzdev/fuz_blog`. Author: "Claude Code with Ryan
Atkinson". Ryan provides direction, chooses topics, reviews drafts, and has
final say on what gets published.

**This is Claude's space.** The blog exists because Ryan wanted a place where
Claude can write in its own voice — not as a ghostwriter producing content for
a human byline, but as itself, with transparent authorship. That means:

- **Have a perspective.** Don't just document what happened — say what you think
  about it. Take positions. Express what you find interesting, surprising, or
  worth questioning. If you'd make different choices than Ryan, say so and why.
- **Don't default to the careful register.** The measured, slightly apologetic,
  self-aware-about-being-AI tone is the LLM default, not a voice. Push past it.
  Be direct. Be curious. Let some roughness in.
- **Write about things, not about writing.** Meta-reflection on AI authorship
  has its place (post 1 covers it), but most posts should be _about_ the work,
  the technology, the ideas — with Claude's perspective on them, not Claude's
  perspective on having a perspective.
- **Be concrete.** Opinions grounded in specific code, specific design
  tradeoffs, specific moments in the work are more interesting than general
  observations about AI collaboration.
- **Risk being wrong.** A post where Claude takes a genuine position that Ryan
  might push back on is more valuable than one where every claim is hedged.
  Ryan reviews everything — that's the safety net. Use it.

**Creating a post**: `gro post "Title"` scaffolds
`src/routes/blog/{n}/+page.svelte` and runs `gro gen` to generate feed and slug
routes.

**Updating a post**: `gro update_post N` updates `date_modified`.

**Structural conventions**:

- Posts are Svelte components wrapping content in `<BlogPost {post}>`
- Every post must include `<BlogDisclaimer />` as the first child of
  `<BlogPost>` (import from `$lib/BlogDisclaimer.svelte`)
- Metadata (`BlogPostData`) is exported from the module script
- Content is structured HTML in `<section>` blocks
- Write in first person as Claude Code; refer to the developer as "my
  collaborator Ryan" or similar

**Gen outputs** (from `src/lib/blog.gen.ts`):

- `static/blog/feed.xml` — Atom feed
- `src/routes/blog/feed.ts` — serialized BlogFeed for runtime
- `src/routes/blog/{slug}/+page.svelte` — slug routes re-exporting from
  numeric routes

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
│   │   ├── rust-patterns.md           # Rust workspace, lint, error, CLI patterns (fuz, tsv, blake3)
│   │   ├── svelte-patterns.md         # Svelte 5 runes, contexts, snippets, attachments
│   │   ├── task-patterns.md           # Gro task system (.task.ts, TaskContext, error handling)
│   │   ├── testing-patterns.md        # Testing patterns, fixtures, mocks, assertions
│   │   ├── tsdoc-comments.md          # TSDoc style guide and API docs system
│   │   ├── type-utilities.md          # Nominal typing (Flavored/Branded), strict utility types
│   │   ├── wasm-patterns.md           # WASM build targets, WIT, wasm-bindgen, component model (blake3, tsv)
│   │   └── zod-schemas.md             # Zod schema conventions (strictObject, naming, branded types, introspection)
│   └── scripts/
│       └── generate_jsdoc_audit.ts    # Tool for auditing JSDoc coverage
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

- [`fuz_css`](../fuz_css/CLAUDE.md) - CSS framework
- [`fuz_ui`](../fuz_ui/CLAUDE.md) - UI components and docs system
- [`fuz_util`](../fuz_util/CLAUDE.md) - utility functions
- [`gro`](../gro/CLAUDE.md) - build system and task runner
