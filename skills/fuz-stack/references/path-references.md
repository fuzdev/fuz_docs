---
description: Path typography — navigational vs src/lib module vs code-shaped
---

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

> **A bare path is a promise it resolves on disk.** An unbackticked `./`, `../`,
> or `~/dev/` path is a real, navigable link — it must point at a file or
> directory that exists, resolved relative to the file it appears in (`~/dev/`
> from the workspace root). If you mean a path *illustratively* — a conceptual
> location (`./build/`), an example (`./foo/bar`), an import shown in prose
> (`import './fuz.css'`) — **wrap it in backticks**; that's the escape hatch
> that says "literal, don't follow." Source TSDoc additionally must not point
> outside its own repo (see §4).

## 2. src/lib module references (backticked, src/lib-relative, no leading `./`)

Marks the target as a code-like identifier — a module name, not a navigable
filesystem path.

> **Rule**: a backticked reference to a **same-repo** src/lib module MUST be the
> bare src/lib-relative form — never `../foo.ts`, never `./foo.ts`, never
> `src/lib/foo.ts` (the redundant prefix), never `./src/lib/foo.ts`. The
> backticks frame the token as a module identifier; a `src/lib/` prefix or `./`
> `../` traversal contradicts that framing. Bare paths are the only place `./`
> and `../` belong.

> **Backticks are an escape hatch.** This rule applies only to references that
> resolve to a same-repo module. A backticked path that *isn't* one — a
> cross-repo path, a deliberately-literal example, explanatory prose — is left
> exactly as written. Don't rewrite `` `../some-other-repo/x.ts` `` or a
> non-module path into the module form; the backticks mean "treat this
> literally."

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
- Examples (all referring to a same-repo module):
  - ✅ "`server/upload_route.ts`" — the bare src/lib-relative form
  - ❌ "`src/lib/server/upload_route.ts`" — redundant `src/lib/` prefix
  - ❌ "`./src/lib/server/upload_route.ts`" — prefix plus a `./`
  - ❌ "`../server/upload_route.ts`" — backticked but traversal-relative
  - ❌ "`./classroom_service.ts`" — backticked but self-relative

## 3. Code-shaped things outside src/lib (backticks for code, not paths)

- CLI commands: `gro check`, `deno task scry`
- Top-level project files: `package.json`, `gitops.config.ts`, `tsconfig.json`
- System/config identifiers: `~/.fuz/`, `~/.mg/config.json`

## 4. Cross-repo references

To point at a file in *another* workspace repo, use a **bare** navigational
path (form 1) — `../other-repo/src/lib/foo.ts` or `~/dev/other-repo/...`. The
backticked module form (form 2) is **same-repo only**: it resolves against the
current repo's module index, so it can't name another package's module. For a
published package's module, the import-specifier form is the right code
reference (`@scope/pkg/foo.ts`); a bare relative path is for navigation.

Two constraints follow:

- **A bare cross-repo path must resolve to a real file.** It's a navigable
  link; a stale `../old-name/...` left behind after a repo is renamed or moved
  is a broken reference. Keep these accurate as the workspace changes.
- **TSDoc must not use `../` to leave the repo.** Source comments render into
  the published API docs, where the shipped package has no sibling repos — an
  out-of-repo `../` becomes a dead link. Keep TSDoc references repo-local;
  attribute external inspiration in prose without a navigable path, or link a
  URL. (Backticked explanatory paths remain the escape hatch — see §2.)

Each file's relative paths assume the reader is in the file's parent directory.
From `~/dev/CLAUDE.md`, project paths are `./project/`. From a deeply nested
file, prefer a workspace-root-anchored path (`setup/scripts/foo.md`) over deep
`../../../scripts/foo.md`.

## 5. Import specifiers (code imports, not doc prose)

The forms above govern paths *written in docs/prose*. Import specifiers in
**source** use the real source extension (`.ts` / `.svelte.ts` / `.svelte`),
never the old `.js`-for-a-`.ts`-file form, and pick the alias by **whether the
module ships**:

- **`src/lib` (ships as `dist`) → relative only** (`./`, `../`):
  `import {x} from './sibling.ts'` — the build rewrites these to `.js` into
  `dist`. Aliases break here: both `$lib`/`$routes` (Vite-only) and
  `#lib`/`#routes` (resolve to `./src/lib/*`, absent from the tarball —
  `"files": ["dist"]`) give consumers `ERR_MODULE_NOT_FOUND`.
- **Everything else → `#lib/*` / `#routes/*`** package.json subpath imports
  (`"imports": {"#lib/*": "./src/lib/*"}`): routes, components, vitest tests, and
  spawn-outside-Vite entries (Deno/Node servers, benchmarks, `deno` / `bun` /
  `gro run` scripts) — none of it shipped. One mechanism resolves across Vite,
  Node, Bun, Deno, and Gro's loader, so the alias never depends on which runtime
  spawns the file. (`$lib`/`$routes` are retired — Vite-only, so a raw `deno run`
  fails `Import "$lib/…" not a dependency`.)
- **Cross-package** `@fuzdev/<pkg>/sub.ts` → resolves via the target's `exports`
  `.js`/`.ts` mirror to its `dist`. (Non-mirror packages like `@fuzdev/blake3_wasm`
  keep `.js`.)

`$app`/`$env` stay (virtual modules, not file paths). `@ryanatkn/eslint-config`
warns on all four aliases (`$lib`/`$routes`/`#lib`/`#routes`) inside `src/lib`
— library code imports relative; the rule covers type-position imports too
(`import('#lib/db/db.ts').Db`). Outside `src/lib`, `$lib` remains widespread in
existing code while the `#lib` migration is in progress.

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

## Formatter cautions (these have bitten real docs)

- A line wrapping after `+` becomes a sublist. `cell + fact` followed by a formatter
  wrapping to `+ cell_history` reflows as a bullet. Rephrase
  (`cell, fact, and cell_history`) or keep the `+` mid-line.
- Bare `_` in inline prose mixed with backticked identifiers can be parsed as
  italic delimiters and mangle text — eating spaces and swapping characters.
  Backtick identifiers like `scope_id` or `cell_*` even when the surrounding
  sentence isn't otherwise code-heavy. When several `_`-bearing identifiers
  appear in one sentence, restructure as a bullet list so each lands at
  end-of-line away from prose interactions.
