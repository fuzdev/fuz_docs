---
description: Approved external npm package allowlist for TS/Svelte repos
---

# Approved npm Dependencies

The canonical allowlist of external npm packages approved for the
TypeScript/Svelte repos across the ecosystem. Prefer these; reach outside
the list only with explicit approval (see [§Adding a dependency](#adding-a-dependency)).

**Scope**: the canonical (non-experimental) TS/Svelte repos — libraries,
apps, sites, and tooling. Different-paradigm or pre-canonical repos carry
their own deps and are out of scope here.

**Source of truth**: each repo's `package.json` (`dependencies`,
`devDependencies`, `peerDependencies`, `optionalDependencies`). This doc is a
curated, hand-maintained reference to the stack-wide third-party deps — not
generated, and deliberately **not exhaustive**: narrowly repo-specific deps (one
app's domain library, an editor extension's typings, a benchmark-only reference
impl) are left out so the list stays focused on what generalizes across the
stack. Verify it against the repos periodically.

Packages published by the workspace itself — the `@fuzdev` / `@ryanatkn`
scopes and unscoped siblings like `svelte-docinfo` — are internal, not
third-party deps, and never appear here.

## Language & build toolchain

| Package | Purpose |
| ------- | ------- |
| `typescript` | TypeScript compiler |
| `tslib` | TS runtime helpers |
| `svelte` | Component framework (runes) |
| `@sveltejs/kit` | Application framework |
| `@sveltejs/vite-plugin-svelte` | Svelte ↔ Vite integration |
| `@sveltejs/adapter-static` | Static-site adapter |
| `@sveltejs/acorn-typescript` | TS-aware acorn parser (Svelte toolchain) |
| `@sveltejs/package` | Library packaging (`svelte-package`) |
| `svelte-check` | Svelte / TS diagnostics |
| `svelte2tsx` | Svelte → TSX for typechecking |
| `vite` | Build tool / dev server |
| `vitest` | Test runner |
| `jsdom` | DOM implementation for tests |

## Lint & format

| Package | Purpose |
| ------- | ------- |
| `eslint` | Linter |
| `eslint-plugin-svelte` | Svelte lint rules |
| `typescript-eslint` | TypeScript lint integration |
| `@eslint/js` | ESLint's built-in JS rule presets |
| `globals` | Global-identifier sets for ESLint configs |

## Release tooling

| Package | Purpose |
| ------- | ------- |
| `@changesets/changelog-git` | Git-based changelog generator for changesets |
| `@changesets/types` | Changesets type definitions |

## Type definitions

| Package | Purpose |
| ------- | ------- |
| `@types/node` | Node.js types |
| `@types/estree` | ESTree AST types |
| `@types/pg` | `pg` (node-postgres) types |
| `@types/deno` | Deno global types (consumers run under Deno) |
| `@types/ws` | `ws` types |
| `@types/picomatch` | `picomatch` types |

## Core utilities

| Package | Purpose |
| ------- | ------- |
| `zod` | Schema validation |
| `esm-env` | Environment flags (`DEV` / `BROWSER`) |
| `zimmerframe` | AST walker |
| `magic-string` | Source-string edits with sourcemaps |
| `@webref/css` | W3C CSS reference data |
| `@jridgewell/trace-mapping` | Sourcemap decoding |
| `dequal` | Deep equality |
| `fast-deep-equal` | Deep equality (fast path) |
| `date-fns` | Date utilities |

## Backend & server

| Package | Purpose |
| ------- | ------- |
| `pg` | PostgreSQL client |
| `@electric-sql/pglite` | Embedded Postgres (WASM) |
| `hono` | HTTP server framework |
| `@hono/node-server` | Hono Node adapter |
| `@hono/node-ws` | Hono Node WebSocket adapter |
| `@node-rs/argon2` | Argon2 password hashing (native) |
| `ws` | WebSocket implementation |

## Parsing & build internals

| Package | Purpose |
| ------- | ------- |
| `esbuild` | Bundler / transform |
| `oxc-parser` | Fast JS/TS parser |
| `ts-blank-space` | Type-stripping transform |
| `es-module-lexer` | ESM import/export lexer |
| `acorn-jsx` | JSX plugin for acorn |
| `chokidar` | File watching |
| `dotenv` | `.env` loader |
| `picomatch` / `tinyglobby` | Glob matching |
| `commander` | CLI argument parsing |

## Adding a dependency

New packages are added deliberately, not incidentally:

- Prefer `node:` built-ins, then this list, before anything new.
- A new dependency needs explicit approval — name it, its purpose, what it
  replaces or enables, and its transitive footprint.
- Removing an unused dependency is pre-authorized — no approval needed. Verify
  nothing references it, then drop the entry. Removing the last user of a
  package? Drop it from this list in the same change.

## Dependency classification (peer vs dependency vs dev)

For a **published library**, which `package.json` field a package lands in is a
correctness decision, not bookkeeping.

- **`peerDependencies`** — a package that must resolve to a **single instance**
  in the consumer's tree: a framework host (`svelte`, `@sveltejs/kit`) or
  anything whose instances/types cross the library's API boundary (`zod`
  schemas, `esm-env` flags). Two copies break `instanceof`, Zod `.brand()`
  identity, Svelte context keys, and the dev/prod env gate. Required when the
  public API always reaches it; **optional** (via `peerDependenciesMeta`) when
  it's an opt-in / à-la-carte path (a preprocessor, a deep-import module many
  consumers skip). Mirror the version in `devDependencies` so the library's own
  build/test resolves it. **An optional peer is only safe to leave optional
  when a *required* peer guarantees it transitively** — `svelte` and
  `@sveltejs/kit` both depend on `esm-env`, so a lib that requires either can
  leave `esm-env` optional. A runtime import of a singleton on a path with
  **no** required framework peer (e.g. `esm-env` in a node-only utility like
  `fuz_util/log.ts`) must be a **required** peer instead — npm auto-installs
  required peers, so the consumer never hits a missing-module crash, where an
  optional one would.
- **`dependencies`** — published code imports it, but it's a self-contained
  internal detail never handed across the API boundary (no singleton hazard) —
  pin a known-good version.
- **`devDependencies`** — only used by the library's build/test, never shipped
  in `dist` (the toolchain: `typescript`, `vite`, `eslint`, `svelte-check`, …).

Build-time helpers that published code imports but a consumer never interacts
with (`magic-string`, `zimmerframe` for a Svelte preprocessor) carry no
singleton hazard — classify them as **`dependencies`** so the library ships its
own self-contained copy and never leans on a consumer (or a transitive
framework dep) to supply them. An **optional peer** is acceptable only when the
helper is already guaranteed by a *required* framework peer — e.g. a type-only
`@types/estree` reached through `svelte`, which depends on it, and is erased at
build anyway. Never a `devDependency`-only import: that breaks any consumer who
reaches the path. Either `dependencies` or a peer is correct for these; only a
`devDependency`-only or undeclared import is wrong.

**Apps, sites, and templates are not libraries** — they're leaf deploy targets
with no installing consumers, so they classify everything as `dependencies` /
`devDependencies` and never declare peers.

The litmus test: *if a consumer ended up with a second copy of this package,
would anything break?* Yes → peer (optional if the path is opt-in). No, but
published code imports it → dependency. Only the build sees it → devDependency.
