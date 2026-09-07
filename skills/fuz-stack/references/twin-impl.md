---
description: TS ↔ Rust twin implementations — convergence, naming parity, wire crates
---

# Twin Implementations (TS ↔ Rust)

**Twin-impl spine**: the same backend spine — auth, db, http, realtime,
actions — ships in two implementations, TypeScript in `fuz_app` and Rust in the
spine crates (./rust-spine.md), held observably equivalent on the wire.
Consumers pick one or both — a user-facing capability, not just a dev practice.

**Twin-impl convergence**: whichever implementation lands the better shape —
security, correctness, abstraction, forensic detail — becomes canonical and
the other ports to converge. Bidirectional.

fuz_forge is the canonical twin consumer: its TS (Hono) and Rust (`fuzfd`,
axum) servers are co-maintained at full wire parity.

## Roles

- **Reference impl = run, not compiled.** The TS server is never shipped; it
  runs directly (`deno run`) as the parity twin for tests, benches, and local
  dev. The Rust binary is the production deploy; compiling a never-shipped TS
  server is dead weight.
- **The CLI is not a twin.** A CLI is a _client_ of the server — two CLIs prove
  nothing about the wire. A CLI is either **shipping** (compiled single-file
  binary) or **retired** (deleted); no "run-directly TS CLI reference" middle
  state.

## Naming parity

Shared spine concepts — types, fields, error-reason literals, named steps of a
shared algorithm — carry **parallel identifiers** modulo case convention
(`post_commit_effects` ↔ `PostCommitEffects`). A cross-impl mismatch for the
_same_ concept is a convergence defect, closed like a bug; when one side
renames, the other follows. Two subtleties: **distinct concepts keep distinct
names on both sides** (if TS has eager `pending_effects` and deferred
`post_commit_effects`, Rust carrying only the deferred one must not call it
`PendingEffects`); and parity is at the **identifier** level, not the file
level — module names may differ where scope differs. Identifier parity lets an
agent learn a concept once and find it in either spine; snake_case alignment
makes it cheap.

## Enforcement

- **The cross-backend harness** (`fuz_app`) drives both backends with the same
  requests and asserts responses **byte-for-byte** — status, body, headers.
  Consumers inherit shared _conformance principals_ (credential type × context
  combinations — daemon-token-with-Origin, invalid-token variants) so a new
  upstream auth edge case tests every consumer.
- **`testing_spine_stub`** is the domain-free third consumer exercising the
  Rust spine without any business logic, so spine parity is tested
  independently of zzz/fuz_forge.
- **Strict-schema parsing of read bodies** — parsing every populated read-RPC
  response with the strict TS Zod schema catches missing/extra/renamed fields
  wholesale.
- **Schema parity** — DB introspection compared across backends, zero excluded
  tables as the target.
- **Env contract tests that _reject retired variable names_** — env handling is
  hand-written on both sides, so this is the strongest anti-drift guard.
- **Where the harness can't reach**, Rust unit serialization tests
  (`serde_json::to_value(dto) == json!(…)`) stand in.

**Twins silently diverge on paths tested on one backend only** — especially
auth/error negatives (401 anti-enumeration, malformed input, browser-context
guards). Two hand-written stacks agree on the happy path and drift on the
edges; port single-backend tests to cross tests. A live behavior difference is
either converged or documented as intentional (a version _value_ differs while
the parity test asserts the shape).

**Scope the burden**: parity is self-policing where the substrate bottoms out
in shared upstream code (`fuz_app`, the spine crates). A consumer's real
parity surface is only what it hand-writes twice — RPC handlers, domain
parsing, auth glue, env loading, subprocess use. Keep that small.

## The wire crate

Hand-written wire shapes both Rust client and server need — input validators
(slug/segment grammars), typed output DTOs — live in a dedicated `*_wire`
crate (`fuz_forge_wire`): pure logic, no spine dep. Boundaries:

- **Stack-wide constants stay spine-canonical.** JSON-RPC error codes belong to
  `fuz_http::JsonrpcErrorCode` (TS: `fuz_app`'s `jsonrpc_errors`), referenced
  by enum, never copied or spelled as magic numbers.
- **DTO serialization parity**: no `skip_serializing_if` (nullable fields emit
  `null` like TS); `#[serde(rename = "ref")]`/`"type"` for keyword fields;
  discriminated unions as `#[serde(tag = "kind", rename_all = "snake_case")]`;
  DTOs carry the **full** field set (never a client's duck-typed subset); field
  order matches the wire; booleans are real `bool`.

## Structure mirroring

Module boundaries mirror the twin's seams — if TS splits git subprocess and
record-parsing into `git/read.ts` + `git/parse.ts`, Rust splits the same way,
so byte-format contracts (`%H%x00…` format strings, RS/NUL framing) are
diffable module-to-module. Canonicalize internal identifiers on the cleaner
idiom (often the Rust name; TS tends wordier) — wire- and schema-visible forms
must already match, so internal renames are cleanup.

**Utility twins** follow the same discipline at micro scale —
`fuz_sys::env::parse_stringbool` ↔ `z.stringbool()`, the `DaemonInfo` schema
shared between zzz's Rust CLI and `fuz_app`, the `lru`-backed `RateLimiter`
twinning `fuz_app`'s `LruMap`. When porting a utility, find its twin first;
diverging semantics under a shared name is the same defect class as a name
mismatch.

## Serde boundary conformance

When a Rust crate owns a serde JSON boundary (`#[serde(deny_unknown_fields)]`)
that hand-written TypeScript authors against (a typed config builder whose
output the Rust engine parses), keep the TS types **hand-written** and guard
them with a round-trip test, not `schemars`/`ts-rs`. Codegen is a _second_
encoding of the boundary that can itself drift from serde's tagging/rename; a
round-trip validates against the **real serde parser**. Reserve codegen for
field-level coverage enforcement or a published JSON Schema.

Two-layer guard (zap's TS config library):

1. **Round-trip conformance.** One typed "kitchen-sink" fixture exercising
   every type/field/variant, `import type`'d against the TS types and
   `export default`ing a builder. Gated twice: `gro typecheck` catches
   **types-too-strict** (a valid shape TS rejects); a Rust integration test
   evaluates it and parses the emitted JSON with the real config type,
   catching **types-too-loose** (TS accepts, serde rejects). `import type` is
   erased at runtime, so the evaluator needs no module resolution.
2. **Coverage guard.** Iterate the Rust canonical variant list
   (`ResourceType::ALL`) and assert the fixture exercises **every** variant —
   catches a variant added in Rust but absent from TS, which round-trip alone
   can't see. Pair with a loud floor (`assert!(items.len() >= N)`) so a vanished
   fixture fails instead of passing.

Optionally a thin e2e smoke through the shipped binary. Both it and the
round-trip test skip-with-notice when their runtime or binary is absent, the
same discipline as DB/Deno-gated tests (./testing-patterns.md §Environment
Flags). Gotcha: an evaluator that stubs clock/RNG to throw requires
pure-literal fixtures.

## Tool twins: molt

fuz_template's ejector ships as symmetric twins — `src/lib/molt.ts` (`npm run molt`) and the `molt` crate (`cargo molt`) — at full behavior parity: same
flags, wizard, plan, byte-identical output trees. No reference/production
asymmetry: both ship, chosen by which toolchain the user has (TS so ejecting
never requires Rust; Rust to dogfood the CLI conventions). Its mechanics differ
instructively:

- **Parity is enforced against the tree, not across the twins.** Each side
  embeds its own exact-content anchors and self-verifies against the working
  tree (`cargo test` / `gro test`, both in CI) — an anchored template edit
  breaks both at the same commit, no cross-backend harness needed. Templates
  are single-sourced in `crates/molt/templates/` (`include_str!` in Rust, read
  at runtime by TS).
- **Mutual deletion bounds the burden.** Each twin's plan deletes both
  implementations (crate, TS module, tests, npm script) — zero post-eject
  parity surface.
- **Identifier parity end to end** (`build_plan`/`verify`/`apply`/`apply_gate`/
  `FEATURES`), TS sections mirroring the crate's module seams.
