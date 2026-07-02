# Twin Implementations (TS ↔ Rust)

**Twin-impl spine** names the architecture: the same backend spine — auth,
db, http, realtime, actions — ships in two implementations, TypeScript in
`fuz_app` and Rust in the fuz spine crates (./rust-spine.md), held observably
equivalent on the wire. Consumers pick one or both. This is a user-facing
capability, not just a development practice: a project can ignore Rust,
ignore TS, or run both for robustness and measurement.

**Twin-impl convergence** names the discipline: whichever implementation
lands the better shape — security, correctness, abstraction design, forensic
detail — becomes the canonical reference, and the other ports to converge.
Bidirectional: TS decisions flow to Rust, Rust improvements flow back.

fuz_forge is the canonical twin consumer: its TS (Hono) server and Rust
(`fuzfd`, axum) server are co-maintained at full wire parity.

## Roles

- **Reference impl = run, not compiled.** The TS server is never
  shipped/deployed; it runs directly (`deno run`) as the parity twin for
  tests, benches, and local dev. The Rust binary is the production deploy.
  Compiling a never-shipped TS server is dead weight.
- **The CLI is not a twin.** A CLI is a *client* of the server, not a second
  spine implementation — two CLIs prove nothing about the wire. A CLI has two
  coherent states: **shipping** (compiled; a single-file binary is the point)
  or **retired** (deleted). No "run-directly TS CLI reference" middle state.

## Naming parity

Shared spine concepts — types, fields, error-reason literals, the named steps
of a shared algorithm — carry **parallel identifiers** across both spines,
modulo each language's case convention (`post_commit_effects` ↔
`PostCommitEffects`). A cross-impl name mismatch for the *same* concept is a
convergence defect, tracked and closed like a bug; when one side renames, the
other follows. Two subtleties:

- **Distinct concepts keep distinct names on both sides.** If TS has an eager
  `pending_effects` queue and a deferred `post_commit_effects` queue, the
  Rust side that carries only the deferred one must not name it
  `PendingEffects` — same-name-same-concept cuts both ways.
- **Parity is at the identifier level, not the file level.** Module/file
  names may differ where a module's scope genuinely differs.

Identifier parity is what lets an agent learn a concept once and find it in
either spine — snake_case alignment across TS/Rust/SQL is what makes it
cheap.

## Enforcement

- **The cross-backend harness** (in `fuz_app`) drives both backends with the
  same requests and asserts responses **byte-for-byte** — status, body,
  headers. Consumers inherit shared *conformance principals* (credential
  type × context combinations, e.g. daemon-token-with-Origin, invalid-token
  variants) so a new auth edge case added upstream tests every consumer.
- **`testing_spine_stub`** is the domain-free third consumer: it exercises
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
  tests (`serde_json::to_value(dto) == json!(…)`) stand in as the parity
  guard.

**Where twins silently diverge**: paths tested on one backend only —
especially auth/error negatives (401 anti-enumeration, malformed input,
browser-context guards). Two hand-written stacks agree on the happy path and
drift on the edges; port single-backend tests to cross tests. A live behavior
difference is either converged or explicitly documented as intentional (e.g.
a version *value* differs while the parity test asserts the shape).

## Scoping the parity burden

Parity is largely self-policing where the substrate bottoms out in **shared
upstream code** — `fuz_app` on TS, the spine crates on Rust. A consumer's
real parity surface is only what it hand-writes twice: RPC handlers, domain
parsing, auth glue, env loading, subprocess use. Keep that surface small and
the twins stay cheap.

## The wire crate

Hand-written wire shapes that both the Rust client and Rust server need —
input validators (slug/segment grammars) and typed output DTOs — live in a
dedicated `*_wire` crate (`fuz_forge_wire`), single-sourced instead of
implemented per binary. Pure logic, no spine dep. Boundaries:

- **Stack-wide constants stay spine-canonical.** JSON-RPC error codes belong
  to `fuz_http::JsonrpcErrorCode` (TS twin: `fuz_app`'s `jsonrpc_errors`),
  not copied into a consumer's wire crate. A consumer references the enum,
  never a magic number.
- **Serialization parity rules for DTO twins**: no `skip_serializing_if` — a
  nullable field emits `null` like the TS side; `#[serde(rename = "ref")]` /
  `"type"` for keyword fields; discriminated unions as
  `#[serde(tag = "kind", rename_all = "snake_case")]` enums; DTOs carry the
  **full** field set (never a client's duck-typed subset); field declaration
  order matches the wire; booleans are real `bool` fields.

## Structure mirroring

- **Module boundaries mirror the twin's seams.** If TS keeps git subprocess
  and record-parsing in `git/read.ts` + `git/parse.ts`, the Rust side splits
  the same way — byte-format contracts (`%H%x00…` format strings, RS/NUL
  framing) become diffable module-to-module instead of buried in a
  monolith.
- **Canonicalize internal identifiers on the cleaner idiom** (often the Rust
  name; the TS reference tends wordier). Wire- and schema-visible forms must
  already match — internal renames are cleanup, not correctness.

## Utility twins

The same discipline at micro scale — a Rust utility mirroring a TS one keeps
the twin's semantics and (case-adjusted) name: `fuz_sys::env::parse_stringbool`
↔ `z.stringbool()`, the `DaemonInfo` daemon-file schema shared between zzz's
Rust CLI and `fuz_app` TS, the `lru`-backed `RateLimiter` twinning
`fuz_app`'s `LruMap`. When porting a utility across the language boundary,
find its twin first; diverging semantics under a shared name is the same
defect class as a name mismatch.
