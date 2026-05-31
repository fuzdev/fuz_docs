# Path References in Documentation

Three forms, each with its own typography. The distinction is whether the target
is a **navigable file** (bare path) or a **code-tree identifier** (backticked,
no leading `./`).

## 1. Navigational paths (bare, no backticks)

For docs, READMEs, external repos, and any reference that points to a file by
location rather than by code identity:

- `./foo` and `../foo` — relative to the file's directory; mdz auto-linkifies
  these when preceded by whitespace
- `~/dev/foo` — anchored at the workspace root; reads cleanly at any nesting
  depth
- `setup/foo` — bare workspace-root anchor (no `~/dev/` prefix); preferred over
  deep `../../setup/foo` from nested files

## 2. src/lib module references (backticked, src/lib-relative, no leading `./`)

Marks the target as a code-like identifier — a module name, not a navigable
filesystem path.

> **Rule**: when a path inside src/lib is wrapped in backticks, it MUST be
> src/lib-relative — never `../foo.ts`, never `./foo.ts`, never `src/lib/foo.ts`
> from a file already inside src/lib. The backticks frame the token as a module
> identifier; relative traversal contradicts that framing. Bare paths are the
> only place `./` and `../` belong.

- From any file inside src/lib: "`auth/account_schema.ts`" refers to
  `src/lib/auth/account_schema.ts`. Prefer this over both
  "`../auth/account_schema.ts`" (backticked with prefix — defeats the identifier
  framing) and `../auth/account_schema.ts` (bare — reads as filesystem path)
- From files outside src/lib (root CLAUDE.md, docs/, src/test/): include the
  `src/lib/` prefix — "`src/lib/auth/CLAUDE.md`". The path-relative-to-src/lib
  form ("`auth/CLAUDE.md`") is also acceptable from src/test/, but the
  full-prefix form is unambiguous at any depth
- Applies to any file under src/lib, including subsystem CLAUDE.mds:
  "`auth/CLAUDE.md`", "`http/CLAUDE.md`"
- Section refs follow: "`auth/CLAUDE.md`" §Middleware (backticks wrap the
  module, `§Heading` follows outside the backticks)
- Examples:
  - ✅ "`server/upload_route.ts`" — from `src/lib/server/CLAUDE.md`
  - ✅ "`fuz_app/db/fact_store.ts`" — from `src/lib/fuz_util/CLAUDE.md`
  - ❌ "`../fuz_app/db/fact_store.ts`" — backticked but traversal-relative
  - ❌ "`./classroom_service.ts`" — backticked but self-relative

## 3. Code-shaped things outside src/lib (backticks for code, not paths)

- CLI commands: `gro check`, `deno task scry`
- Top-level project files: `package.json`, `gitops.config.ts`, `tsconfig.json`
- System/config identifiers: `~/.fuz/`, `~/.mg/config.json`

Each file's relative paths assume the reader is in the file's parent directory.
From `~/dev/CLAUDE.md`, project paths are `./project/`. From a deeply nested
file, prefer a workspace-root-anchored path (`setup/scripts/foo.md`) over deep
`../../../scripts/foo.md`.

## Web-rendered caveat

In files published via mdz on a website (this skill renders on fuz_docs), `./foo`
and `../foo` examples must be backticked to prevent mdz from rendering them as
broken `<a>` tags. `~/dev/foo` and bare workspace-root paths (`setup/foo`) are
safe bare in web context — mdz doesn't auto-linkify those prefixes.

## Anti-patterns

The linkifier won't fire on these, costing tokens and navigability:

- **Mixing the two forms**: backticks + a leading `./` or `../` is the
  wrong-of-both-worlds case. Pick a form. "`./foo.md`" should be either bare
  `./foo.md` (navigational) or — for src/lib — "`subsystem/foo.ts`" (module-form,
  drop the relative prefix).
- **Backticking a navigable target**: "`~/dev/fuz_util`" reads as a code
  identifier when it's actually a path. Use bare `~/dev/fuz_util`.
- **Redundant markdown-link syntax** when target equals visible text:
  `[../README.md](../README.md)` is redundant; bare `../README.md` already
  auto-links. Same for `[~/dev/foo](~/dev/foo)` — collapse to bare `~/dev/foo`.
  Reserve `[text](url)` for cases where the visible token _isn't_ the path —
  e.g. a package-name-as-link: `[@fuzdev/fuz_app](../../fuz_app)`.

## Formatter cautions (Prettier in particular — these have bitten real docs)

- A line wrapping after `+` becomes a sublist. `cell + fact` followed by Prettier
  wrapping to `+ cell_history` reflows as a bullet. Rephrase
  (`cell, fact, and cell_history`) or keep the `+` mid-line.
- Bare `_` in inline prose mixed with backticked identifiers can be parsed as
  italic delimiters and mangle text — eating spaces and swapping characters.
  Backtick identifiers like `scope_id` or `cell_*` even when the surrounding
  sentence isn't otherwise code-heavy. When several `_`-bearing identifiers
  appear in one sentence, restructure as a bullet list so each lands at
  end-of-line away from prose interactions.
