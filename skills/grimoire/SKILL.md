---
name: grimoire
description: Navigate and maintain a grimoire — a markdown meta-repo that coordinates work across multiple sibling repositories. Covers the three primitives: skills (agent knowledge files), lore (per-repo planning projections), and quests (cross-repo goals). Use when orienting work across repos, reading project planning context, checking TODOs before working on a project, updating planning docs after completing work, creating or updating lore entries, drafting new quests, deciding whether to create a quest vs a lore TODO, pruning stale decisions from lore entries, or understanding grimoire conventions and structure.
license: MIT
metadata:
  author: ryanatkn
  version: 0.1.0
---

# Grimoire

A grimoire is a self-observing meta-repo that spans all of a developer's
projects. It holds working understanding — developed through building, maintained
in concert between the person and their docs. These are living documents,
constantly being evolved as projects change, goals shift, and understanding
deepens. No deployable code, just structured markdown: CLAUDE.md files encode
context that agents load, and skills are knowledge modules.

**Why it exists**: Units of work often cut across repos. The grimoire gives those
units a home — in quests (goals) and lore (context) — without polluting
implementation repos with planning artifacts. It's also agent-knowledge
infrastructure: the structured context that lets AI agents orient across an
entire ecosystem of projects without needing prior session memory.

**Designed for experimentation**: A grimoire is a place to play with patterns —
try new ways of organizing work, see what improves quality and enjoyment, drop
what doesn't stick. The conventions described here emerged this way and will
keep evolving. Don't treat the current structure as fixed; treat it as the
current best guess, subject to revision when something better is discovered.

**Layer position**: The grimoire sits between implementation (repos) and published
(docs, tomes), as the layer where understanding about projects lives. Lore is
the grimoire's view of repos — projection, not duplication. Content graduates
upward; understanding flows back down as lore.

**Structure**: A grimoire directory typically lives alongside the repos it
coordinates, with three core primitives — skills, lore, quests — and supporting layers.

## Three Primitives

### Skills (`skills/`)

[Agent skills](https://agentskills.io/) that teach agents how to work in this
ecosystem. Each skill has a `SKILL.md` with YAML frontmatter plus optional
`references/`, `scripts/`, and `assets/` subdirs following the
[Agent Skills spec](https://github.com/anthropics/skills).

Skills may live in the grimoire itself or in a dedicated docs/skills repo. Skills
can have lore entries when they need planning context.

### Lore (`lore/`)

Per-repo planning projections. Each lore entry is the grimoire's view of a sibling
repo: design decisions, tracked TODOs, cross-cutting concerns. Not a copy of the
repo — a **projection** with planning context that doesn't belong in the
implementation itself.

**Standard pair**: Most lore directories have both `CLAUDE.md` and `TODO.md`.
Separating them keeps CLAUDE.md focused on understanding while TODO.md stays
action-oriented. TODO.md should reference any related quests.

**TODO.md content**: TODO docs are forward-looking — a mix of task tracking and
design exploration in any state of progress or speculativeness. Some are tight
checklists, some are extended design explorations, some are vision docs. The
`TODO_` prefix signals "active thinking about the future" rather than strictly
"things to do."

**TODO.md structure** — common sections, all optional:

- `## Active` / `## Planned` / `## Queued` — work items, usually checkboxes
- `## Deferred` — parked ideas, may link to split files
- `## Shipped` — completed milestones (brief, dated)
- `## Active Docs` — table of contents linking split `TODO_*.md` files (appears
  when splits exist)

Item formatting:

- `- [ ] **Bold title** — description` for scannable task items
- `- [x] **Title** — (2026-03-11) what was done` for completed items with dates
- Quest links inline: `- [ ] Item ([quest](../../quests/quest-name.md))`
- Sub-bullets for decision branches or design considerations under an item

**TODO.md and quests** — ownership boundary: Quests own cross-repo coordination;
lore TODOs own repo-local understanding. The two reference each other but don't
duplicate content.

- Lore TODO items that relate to a quest include a link:
  `- [ ] DA-0: blake3 hashing ([quest](../../quests/da/da-0_blake3-foundation.md))`
- Quests may reference lore docs for design context:
  `Design in [fuz_app security](../lore/fuz_app/security.md)`
- When a quest completes and is deleted, any remaining repo-local items naturally
  stay in the lore TODO — they were never duplicated into the quest.
- If work starts as a TODO item and later needs cross-repo coordination, it
  graduates to a quest. The TODO item then becomes a link to the quest rather
  than a standalone task.

**DECISIONS.md**: A dedicated file for decisions with reasoning — the _why_,
not a changelog. Created lazily — for simple cases, an inline `## Decisions`
section in CLAUDE.md is sufficient. When decisions accumulate beyond a few
entries, graduate them to a standalone `DECISIONS.md`.

```md
### Chose X over Y (2026-02-20)

Brief reasoning. What made X better, what was wrong with Y.
```

Include what was rejected only when non-obvious. Prune aggressively — delete
when the reasoning is obvious from the code, or when the decision is so old
it's just "how things are." Decisions are temporary scaffolding, not permanent
records.

**Lore CLAUDE.md is not repo CLAUDE.md.** A repo's CLAUDE.md has implementation
context — how to build, test, deploy, file structure, API docs. A lore CLAUDE.md
has planning context — why the project exists in the ecosystem, what was decided,
how it relates to other projects, what's next. If the repo already says it
clearly, don't restate it in lore.

**Lore CLAUDE.md content** — what belongs:

- Ecosystem role and cross-repo relationships
- Decisions and their reasoning (why, not what)
- Links to related lore entries and quests
- Planning context that doesn't fit in the repo itself

**Lore CLAUDE.md content** — what does NOT belong:

- Build commands, file structure, API surface (that's the repo's CLAUDE.md)
- Restating what the repo already says clearly
- Metrics or status that will go stale (put in TODO.md)

**Lore CLAUDE.md structure** — a predictable shape agents can follow:

```md
# project_name

> One-line summary.

**Repo**: `path/to/project` | **Status**: active / planning / dormant

Brief planning context — ecosystem role, why it matters, key relationships.

## Decisions

Short entries with reasoning. Delete when obvious from code.

## Lore Docs

Table linking TODO.md and any other lore files.

## See Also

Links to related lore, quests, upstream/downstream projects.
```

Not every section is needed — a light entry might just have the header, summary,
a sentence of context, and a lore docs table. Use bare `./path` and `../path`
syntax (no backticks) for navigational file references — mdz auto-linkifies
these. See the fuz-stack skill's "Path references in documentation" section
for the full convention.

**Weight ranges**:

- Light: `TODO.md` alone, or `CLAUDE.md` + `TODO.md`
- Medium: The standard pair + `DECISIONS.md`, planning docs, or design files
- Heavy: Full specs, design directories, roadmaps

A lore entry can start as a single `TODO.md` and grow — adding `CLAUDE.md` when
context or decisions accumulate, then `TODO_*.md` files when the scratchpad
expands into distinct topics.

**Splitting into TODO_\*.md files**: Split when a topic outgrows its section in
the main TODO.md — typically when a design exploration, feature direction, or
work area needs its own narrative. Split files are named by topic:
`TODO_AUTH.md`, `TODO_PERF.md`, `TODO_RELEASE.md`, `TODO_UNIFIED_CSS_GENERATION.md`.

When to split:

- **Domain complexity** — separate concerns deserve separate docs (auth vs API
  vs consumer ergonomics)
- **Design depth** — a feature direction grows into an extended exploration with
  rationale, decision tables, code examples
- **Work type** — investigations, performance baselines, and release checklists
  serve different readers

What happens to the main TODO.md:

- For small projects: no splits needed, TODO.md is the whole picture
- As splits appear: TODO.md keeps general/active items and adds an `## Active
  Docs` section linking split files with one-line descriptions
- For heavily-split projects: TODO.md may become primarily a routing index —
  shipped milestones, a few active items, and the Active Docs table of contents

Split files are self-contained. Each has its own narrative structure appropriate
to its content — a release checklist looks different from a design exploration.
All split files should be listed in the lore CLAUDE.md's Lore Docs table with
a brief purpose description.

**Naming**: `lore/{subject}/` — usually matching a repo directory name, but lore
can also project non-repo subjects: organizations (`lore/fuzdev/`), skills
(`lore/fuz-stack/`), long-term visions (`lore/fuz_os/`), or any subject that
needs planning context tracked across sessions.

### Quests (`quests/`)

Cross-repo goals with lifecycle tracking. A quest is needed when work spans 2+
repos or when a significant goal has multiple phases. Single-repo work stays in
`lore/{project}/TODO.md`.

**Quest file format**:

```md
- **Status**: open | active | blocked | done
- **Repos**: which repos this touches
- **Depends**: quest IDs that must complete first
- **Blocks**: quest IDs waiting on this one
- **Urgency**: low | mid | high
- **Effort**: S | M | L
- **Uncertainty**: low | mid | high
- **Impact**: low | mid | high

## Goal

What success looks like.

## Tasks

- [ ] Concrete work items as checkboxes

## Notes

Decision log, observations, blockers.
```

**Naming**:

- Quest groups: short lowercase prefix dir (`da/`, `ss/`) + `CLAUDE.md` overview
- Numbered quests within a group: `<prefix>-<n>_<slug>.md`
- Standalone quests: descriptive slug at top level

**`quests/CLAUDE.md`** holds the quest index and conventions.

**Done quests**: When a quest reaches `done`, synthesize what was learned into the
relevant lore — not just recording decisions, but updating how the lore thinks
about the domain. Refine patterns and design ethos, not just append a summary.
Add a brief entry to `quests/HISTORY.md` (repos, what was done, key choices),
then delete the quest file, update cross-references, and remove it from the
index. Full details live in git history; HISTORY.md is the lightweight summary.

## Supporting Layers

Beyond the three primitives, a grimoire may include additional content layers:

### Writing (`writing/`)

Philosophy, vision, and frameworks that inform all projects — not scoped to any
single repo. Where lore projects a specific repo and quests track specific goals,
writing captures the broader _why_: conceptual foundations, design philosophies,
ecosystem synthesis.

**When to use writing/ vs lore/**: If the content projects a single repo's
planning context, it's lore. If it articulates ideas that span the whole
ecosystem or connect to broader frameworks, it's writing. Example: "how the auth
system works" is lore; "why autonomy matters for software design" is writing.

Writing docs may reference each other and link to lore entries, but lore entries
should not depend on writing docs for implementation context.

A grimoire may also include `scripts/` for experimental linting — checking index
sync, dead links, stale files — `scries/` for persisting findings across runs,
and `surveys/` for cross-repo observations (read-only stats and pattern audits
across the repos a grimoire coordinates). These are still taking shape and
aren't prescribed here.

## Work Loop

The grimoire runs an implicit program across agent sessions. Each session
executes this loop:

**On session start** (load context):

1. **Check lore** — `lore/{project}/` — CLAUDE.md for planning context, TODO.md
   for active work
2. **Check quests** — `quests/CLAUDE.md` for active cross-repo goals touching
   this project
3. **Read the repo's CLAUDE.md** — implementation-specific context

**On work complete** (update state):

4. **Update lore** — update `lore/{project}/TODO.md` for work items, CLAUDE.md
   for planning-layer changes (new decisions, changed relationships)
5. **Update quests** — check tasks off, change status if done or blocked
6. **Check graduation** — should content advance to the next lifecycle stage?

## Grimoire Health

A healthy grimoire actively minimizes cruft. The goal is dense, quality
information — not volume. Agents read this on every session; noise wastes
context and degrades judgment.

**Accumulate through distillation**: [Lore](#lore-lore) is the richest layer —
it grows over time as crystallized understanding accumulates from the cycle. Let
creative bursts live as TODO docs in lore; expect noise there. The ongoing work is distilling
what's learned into lasting knowledge and removing what's resolved or superseded.
History and resolved decisions belong in commit logs, not in markdown.

**What belongs here**: Cross-repo context, the _why_ behind decisions, future
intent. If content duplicates what an implementation repo already says clearly,
delete it from lore.

**Living and approximate**: A grimoire is actively evolved — always trying to
catch up to reality and pave future paths — but never fully accurate. It's
trying to capture dimensions of a person's entire body of work, and that's too
large for any document to represent faithfully. Living means maintained, not
correct. When current state matters, read the actual repo. Past a certain
threshold of staleness, a doc misleads more than it helps — stale context is
worse than no context.

**Rewrite, don't just prune**: The lifecycle handles content that graduates
forward. The harder problem is conceptual staleness —
content written under an understanding that has since shifted. A decision whose
tradeoffs no longer apply, a TODO that assumes yesterday's architecture. Old
files aren't inherently stale; a [lore](#lore-lore) doc untouched for months
can still be accurate. But content whose framing no longer matches reality is
actively misleading — and a timestamp check won't catch it. Every time you read
a lore doc, ask whether its model still holds. Delete what's dead, rewrite
what's drifted.

## Creating Grimoire Artifacts

### New lore entry

Create `lore/{project}/TODO.md` as a starting point. Add `CLAUDE.md` when
context or decisions accumulate beyond TODO tracking — use the lore CLAUDE.md
structure described earlier. Focus on planning context: ecosystem
role, relationships, decisions. Don't summarize the repo's own CLAUDE.md.

Most active projects end up with both files — the pair keeps planning context
(CLAUDE.md) and action items (TODO.md) separated. When a TODO.md grows
unwieldy, split topics into `TODO_*.md` files (e.g., `TODO_PERF.md`,
`TODO_RELEASE.md`). Add design subdirs as the project demands.

### New quest

1. Decide: standalone or part of a group?
2. Standalone: create `quests/{slug}.md` with the standard fields above
3. Quest group: create `quests/{prefix}/CLAUDE.md` overview + numbered files
4. Add the quest to the index in `quests/CLAUDE.md`

### New skill

1. Create `skills/{name}/SKILL.md` with YAML frontmatter
2. Add `references/` for detailed docs, `scripts/` for executables if needed
3. Optionally add a lore entry: `lore/{skill-name}/CLAUDE.md`

## Worktrees

Git worktrees provide isolation for parallel grimoire work. When a quest modifies
state in both implementation repos and the grimoire, both can get worktrees — the
isolation boundary matches the unit of work.

**When to use**: Parallel quest work (two agents, two quests, no conflicts),
significant lore restructures that should be reviewed before landing, or
experimental planning changes.

**Convention**: Use Claude Code's worktree support or `git worktree add` directly.
A quest branch in the grimoire parallels the quest branches in implementation
repos.

## Key Concepts

**Taste**: The grimoire encodes a developer's (or team's) taste — which patterns
are valued, which tradeoffs are preferred, what "good" looks like. Taste is what
makes a grimoire _yours_ rather than generic documentation. It can't be
mechanically extracted from code. This is what makes shared grimoires hard
(taste must be negotiated, not just merged) and what makes grimoires powerful
(agents can apply taste fluidly rather than following rigid rules).

**Growth trajectory**: A grimoire starts small — one CLAUDE.md, a couple
`lore/{project}/TODO.md` files. Quests appear when work first spans multiple
repos. Writing appears when ideas emerge that don't project any single repo.
Don't build structure speculatively — let it emerge from genuine need.

**Transparency as constraint**: Making the full scope visible — via indexes,
structure diagrams — creates accountability. File sprawl becomes obvious when every
file must be listed. The index isn't documentation; it's a mirror that pressures
the grimoire to stay lean.

**Private or shared**: A grimoire can be personal (spanning private and public
repos in ways too detailed for public consumption) or collaborative (a team
sharing taste and evolving it together). Either way, the synthesis step —
`published → lore` — needs coherent taste. Groups can share that taste; it
doesn't require a single author.

## Common Pitfalls

- **Always update the quest index** — when creating a new quest, add it to `quests/CLAUDE.md`. The index is the only discovery mechanism.
- **Don't create a quest for single-repo work** — use `lore/{project}/TODO.md` instead. Quests span 2+ repos or have significant multi-phase scope.
- **Don't copy repo CLAUDE.md into lore** — lore CLAUDE.md holds planning context (why, decisions, relationships), not implementation context (how to build, test, deploy). If the repo already says it, don't restate it.
- **Don't let blocked quests sit indefinitely** — if a quest has been blocked for more than a month, either update its dependencies, break it into smaller pieces, or close it.
- **Prune decisions aggressively** — delete decision entries when the reasoning is obvious from the code or the decision is old enough to just be "how things are."
