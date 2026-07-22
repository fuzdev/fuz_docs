---
description: Rust lints, errors, DI ladder, idioms, CLI patterns
---

# Rust Patterns for the Fuz Ecosystem

**Applies to**: any Rust workspace adopting fuz-stack conventions — the
ecosystem's own (the `fuz`/`fuzd` CLI + daemon and spine crates, the
spine-consumer servers `zzz`/`fuz_forge`, the `zap` convergence CLI, the
`tsv` parser/formatter, the `blake3` WASM bindings) and new or external
workspaces starting from these conventions. All use **Rust edition 2024**,
resolver 2.

**Boundary**: this skill owns _conventions and patterns_ — rules a workspace
adopts, with ecosystem repos cited as exemplars. Each repo's `CLAUDE.md` owns
its _inventory_ (crate lists, commands, env vars, package tables) and is
authoritative for project-specific choices. Every pattern here stands alone;
where a spine crate is named as the canonical implementation, that's the
ecosystem wiring — a spine-free workspace adopts the pattern's shape (zap is
the worked precedent throughout).

Companion references: ./rust-spine.md (spine surface + consumer-server
contracts), ./rust-perf.md (performance), ./rust-dependencies.md (approved
crates), ./twin-impl.md (TS ↔ Rust twins), ./wasm-patterns.md (binding
crates).

## Core Values

- **No backwards compatibility**: Pre-1.0 means breaking changes. Delete old
  code, don't shim.
- **Code quality**: `unsafe_code = "forbid"`, pedantic lints, tests expected.
- **Performance**: If it's slow, it's a bug. See ./rust-perf.md.
- **Copious `// TODO:` comments**: Mark known future work. `todo!()` is
  `warn` workspace-wide — `#[allow(clippy::todo)]` with justification when
  needed.
- Doc comments (`///`) for public API; inline (`//`) for implementation
  notes.

## New Workspace Checklist

Bootstrapping a fuz-stack Rust workspace, in order:

1. `[workspace.package]`: `edition = "2024"`, `version = "0.1.0"`,
   `license = "MIT"`, `publish = false` (until publishing is real);
   `resolver = "2"`.
2. Copy the canonical `[workspace.lints.*]` block (§Lints); every crate takes
   `[lints] workspace = true`. Add a root `clippy.toml` with
   `allow-{unwrap,expect,panic}-in-tests = true`.
3. Copy the canonical `[profile.release]` (§Release Profile). Add derived
   profiles only with a driving need.
4. Crate naming: `{project}_{crate}`; short bare names only for
   frequently-typed binaries (§Project Structure).
5. Errors from day one: `thiserror` library enums, a binary wrapper error,
   `fn main() -> ExitCode` (§Error Handling). Pick the exit-code dialect
   early and test it (§CLI Patterns).
6. Dev automation: spine-consuming workspaces add an `xtask` crate wrapping
   `check-release` (./rust-spine.md §xtask & check-release); binding/library
   repos may use a script runner instead (tsv and blake3 drive builds,
   validation, and publishing through Deno tasks, no xtask).
7. Deps: start from ./rust-dependencies.md; share versions via
   `[workspace.dependencies]`.

## Lints

The canonical workspace lint block:

```toml
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
```

**Workspaces may diverge deliberately** — a domain can earn extra allows
(tsv carries a parser-shaped superset: u32-position cast allows, relaxed
`missing_debug_implementations` for interner-holding types, plus restriction
`unreachable = "warn"`; blake3's workspace also omits
`missing_debug_implementations`). Superset-by-design is not drift; the repo's
`CLAUDE.md` documents it — diff the override against that repo's workspace
block, not the generic one above.

### Crate-level overrides — re-declare the whole block

A crate that needs `unsafe_code` (C-FFI/N-API ABI layers, wit-bindgen
components, PTY wrappers) can't _partially_ override the workspace `forbid`:
Cargo replaces the entire `[lints]` table, so relaxing one lint means
re-declaring **all** the others in the crate's own `[lints]`. Re-paste the
full workspace block and change only what must change.

- Full-re-declare exemplars: `tsv_ffi`, `tsv_napi`, `blake3_component` (the
  last also allows two generated-code false positives).
- The trap is real: `fuz_pty`'s re-declared block silently dropped
  `clone_on_ref_ptr` — exactly the failure mode partial re-declaration
  invites. Diff the override against the workspace block when touching one.
- A binding crate that doesn't actually emit unsafe keeps
  `[lints] workspace = true` and inherits `forbid` — many wasm-bindgen crates
  do.

## Release Profile

```toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

Slower builds (~2x), no symbol names in backtraces — worth it for binary size
and performance. Carried byte-identically across the ecosystem workspaces;
treat it as the default, not a per-repo choice.

Deliberate exceptions show the escape hatch:

- **WASM-first repos** set `opt-level = "s"` as the base (blake3), overridden
  per-build via `RUSTFLAGS` (./wasm-patterns.md).
- **Derived profiles for a driving need**: tsv's `[profile.corpus]`
  (`inherits = "release"`, `panic = "unwind"`) exists because its FFI wraps
  entry points in `catch_unwind` — dead under `panic = "abort"` — for the
  Prettier differential-corpus run; its `[profile.profiling]` keeps
  `debug = true`, `strip = false` for symbolicated profiles.

## Error Handling

Libraries export `thiserror` enums; binaries wrap them via `#[from]` and own
exit:

```rust
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
        eprintln!("hint: {hint}"); // print site owns the `hint:` label
    }
    ExitCode::from(e.exit_code()) // -> u8
}
```

Use `#[source]` to chain causes: `Display` shows only the variant's own
message; the chain surfaces via `e.source()` for structured logging
(`ResponseParse(#[source] serde_json::Error)`). For parsers, carry `position`

- optional context on variants so the renderer can draw a caret pointer
  (tsv's `ParseError`).

### Helper methods

- **`.hint()`** — user-facing fix suggestion. `Option<HintMessage>` when most
  variants lack one, or `&'static str` (`""` = absent) when all have one.
  `HintMessage` (`Static(&'static str) | Owned(String)`) is the shared
  primitive (`fuz_sys::cli`); import it, don't re-declare. Hint strings carry
  _advice only_ — the print site owns the `hint:` label.
- **`.exit_code()`** — `u8` for `ExitCode::from`; match arms over variants.
  Code policy: §CLI Patterns.
- **Classifiers** — small `&self -> bool` methods the caller branches on,
  named for the decision, not the variant: `is_transient` (retry might
  succeed — use this verb everywhere), `is_recoverable` (restart),
  `needs_daemon_start`, `is_security_violation`. Each answers one dispatch
  question by matching variants; a wrapper forwards its inner classifier,
  never re-decides. They land wherever a consumer branches — including
  library errors: `fuz_archive` and `fuz_release` expose
  `is_security_violation()`, consumed downstream to split exit codes.

**Placement**: helpers belong on the binary's top-level error; library errors
stay thin (variants only). Exception: a library with exactly one binary
consumer may carry `exit_code()`/`hint()` itself with the binary delegating —
`zap_core::Error` does this to co-locate exit-code policy with the variants.

**Single-source the hint table; wrappers delegate.** When a wrapper owns a
variant whose source already has a hint, delegate — one wording on every
path. The source returns `Option<HintMessage>` so it can carry an
interpolated `Owned` hint. A static-only leaf that doesn't dep the shared
primitive stays `Option<&'static str>`; the first aggregator that does lifts
it with `.map(HintMessage::Static)`. Don't push a dep onto a pure leaf just
to unify the hint type.

For WASM boundary errors (`JsError`, typed WIT error enums) see
./wasm-patterns.md.

## Async Runtime & Graceful Shutdown

Server/daemon crates use **tokio** + **tokio-util**'s `CancellationToken`:
one token owned at the top, cloned into every task that must react. The
signal → token helper is single-sourced — in the ecosystem that's
`fuz_sys::signal::shutdown_token()` (a spine-free workspace hand-rolls the
same shape once: spawn a task selecting `ctrl_c()` / SIGTERM, cancel the
token):

```rust
let shutdown = fuz_sys::signal::shutdown_token();

let server = Server::new(addr, shutdown.clone(), /* ... */);

tokio::select! {
    res = server.serve() => res,
    () = shutdown.cancelled() => Ok(()),
}
```

axum's `with_graceful_shutdown(shutdown.cancelled())` stops accepting
connections but drains in-flight requests; always bound the drain with a
timeout `select!` — without it a hung handler keeps the process alive
forever (the spine ships this as `fuz_http::serve_with_shutdown` +
`DEFAULT_DRAIN_TIMEOUT`, ./rust-spine.md).

Long-running tasks check the token via `select!`, and every shutdown branch
flushes pending work before returning. The reference shape is a
`Notify`-driven flusher: wakeups debounced behind the most recent event so an
idle daemon doesn't tick, every `select!` arm includes
`shutdown.cancelled()`, and the shutdown arm does a final `flush()`.

`tokio_util::task::TaskTracker` when shutdown must verify "all workers exited
cleanly"; skip it for short-lived or naturally-dropped tasks.

**Don't**: `std::process::exit()` inside async code (bypasses Drop); bare
`tokio::spawn` with no shutdown awareness for anything holding resources;
`tokio::sync::broadcast` as a poor-man's cancellation token.

## Naming Conventions

Natural Rust naming for free functions — **not** the `domain_action` style of
this stack's TypeScript. `fn parse`, `fn create_artifact` — not
`fn artifact_create`.

## Idioms

Style guidance the lint config encodes (`clone_on_ref_ptr`, `panic`,
`unwrap_used` warn). Ecosystem-specific bits called out with examples.

### Prefer enums for closed sets

Fixed variant sets → enum, not `bool` or sentinel string; exhaustiveness makes
every `match` a contract that fires when variants change.

**At a deserialization boundary this is also validation.** A `String` field
for a closed set accepts typos that fail at a late runtime guard — or
silently do the wrong thing. A `#[serde(rename_all = "…")]` enum rejects them
at parse with `unknown variant 'x', expected one of …`:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FirewallPolicy { Allow, Deny, Reject } // "denyy" fails at parse, not at apply
```

Valid values deserialize identically, so existing config files keep working —
the enum only starts rejecting inputs that were always bugs. Even a
single-variant enum earns its keep: it rejects unknown values now, and the
next variant forces every `match` to handle it.

**Leniency is only for genuine extensibility.** Keep a `String` (or a
catch-all variant) _only_ when the value passes through verbatim to an
external system whose set is genuinely open and you don't dispatch on it.

### Make impossible states unrepresentable

The umbrella principle: model so the type system rejects nonsense — don't
lean on a runtime check or a comment.

- **Mutually-exclusive → enum; co-present → struct.**
- **A field only meaningful for some variants belongs inside those
  variants**, not as a sibling `Option` that gets silently ignored elsewhere.
- **Carry the payload on the variant** so "this combination can't happen" is
  a compile fact.

**Worked reference — `zap_types`**: `TargetLocation` (local+host
unrepresentable, de/serializing through a flat wire struct via
`#[serde(try_from/into)]`); payload-on-variant (`strip_components` inside
each tar variant of `ExtractMode` — `TarXz`/`TarGz` — so the no-extract
variant can't carry one; the sudo list inside `UserSudo::Restricted`);
single-variant tagged enums kept on purpose (`BuildSource::Remote`,
`SourceVerify::Minisign`); transparent scalar newtypes validated at the serde
boundary (`AccountName`, `Mode`, `ContentHash` — 64-lowercase-hex pin,
`EnvVarName` — POSIX-identifier, shell-injection-safe map key); and
typed-enum-replaces-bool (`ExternalState` — an enumerable cache-leak-source
model replacing an `external_state: bool` that was "carried but never
consumed"). `fuzi_core` is a second exemplar (`Os`/`Cpu`/`Libc` +
negation-aware `PlatformToken`, `LockfileVersion::from_raw`, an `Integrity`
newtype wrapping `ContentHash`).

**Two anti-patterns reviewers actually hit:**

- **The flattened discriminated union.** A `struct { available: bool, error:
Option<String> }` whose doc-comment says "matches a TS discriminated union"
  but whose type permits the impossible combos. The doc-comment _is_ the
  smell — lift to an enum with payload-on-variant and a hand-written
  `Serialize` for the flat wire shape (zzz's `ProviderStatus`:
  `Available{…} | Unavailable{…, error}`).
- **The `json!({"kind": …})` closed set.** Response bodies built with bare
  `json!({"kind":"truncated", …})` across `match` arms are a discriminated
  union evading the enum rule — model as `#[serde(tag = "kind", rename_all =
"snake_case")]` so each variant carries only its payload. Identical wire
  output (`fuz_forge_wire`'s `BlobBody`: `Text{text} | Binary |
Truncated{size}`).

### Push a unifying newtype through the wire

A newtype introduced to retire primitive drift must reach the
wire/persistence shapes, not just the compute helper — otherwise the `String`
it was meant to retire survives at the boundary. When the wire format is
fixed (a signed manifest), a per-field serde adapter serializes the newtype
to the legacy primitive so existing signatures stay valid:
`fuz_crypto::ContentHash` ships through the release manifest via
`#[serde(with = "fuz_crypto::blake3_hex")]`, keeping the newtype as the
in-memory carrier. zap threads its own `scalar::ContentHash` end-to-end
(schema → lock entries → resolved content) with two provenance constructors —
validating `new` for parsed input, infallible `of_bytes` for computed hashes.
The same shape serializes closed sets to primitive wire values:
`fuz_http::JsonrpcErrorCode` (./rust-spine.md §JSON-RPC envelope).

### Zero-cost / low-cost abstractions

- **Function pointers over trait objects** for statically-known dispatch:
  a spawn config holds `build_command: fn(&Path, Option<&Path>) -> Command`,
  not `Box<dyn Fn(…)>`.
- **Callback resolution over allocating accessors** in hot paths: tsv's
  `SymbolResolver` trait pairs allocating `resolve_symbol(sym) -> String`
  with zero-alloc `with_resolved_symbol(sym, |s| …)`.
- **`Cow`-shaped wrappers** when some returns are constants and others need
  interpolation: `HintMessage` (`Static | Owned`).

### Avoid clone smells

`clone_on_ref_ptr` warns on `arc.clone()` — write `Arc::clone(&arc)` so the
call site signals a refcount bump, not a deep copy. Reach for `Cow<'_, str>`
only when callers genuinely have mixed-ownership data and the borrowed case
is common.

## Dependency Injection

The TS `*Deps` discipline doesn't translate 1:1 — much of what TS solves with
DI (runtime agnosticism, module mocking, deterministic clocks) Rust solves
natively with the crate graph, trait bounds, monomorphization, test crates,
and tokio's mock clock. Treat the pattern as an **escalation ladder**: start
at the floor, climb only when a concrete need requires it.

### Effects at the edges

The ladder's goal is a pure-ish core with effects pushed to the boundary —
most code testable without IO, mocks, or a runtime:

- **Split IO from logic; inject the result, not the source.** A function that
  reads a file _and_ decides on the contents becomes a thin edge doing the
  read + a pure function over the parsed value.
- **Presentation is a returned value, not prints in the library.** The
  library returns a structured result; the binary renders it (human /
  `--json` / `--quiet`). `println!` in library code is an effect like any
  other.
- **Contain async to the IO seam.** One async phase goes behind a trait; the
  rest of the core stays sync under `block_on` / `spawn_blocking`. Coloring a
  whole API async for one bounded phase is a smell — though a CLI doing real
  network/subprocess IO throughout (zap) legitimately runs `#[tokio::main]`.

### Active rungs

**Floor — just import and call.** Pure utilities (fs helpers, canonical JSON,
parsers, validators) don't enter the pattern at all.

**Default — concrete `*Options` struct + direct refs.** State owned by the
app (pool, keyring, audit emitter) passes as refs via a per-call-site
`*Options` struct (or `*RouteState` for route-group-shared state) holding
`Arc<T>` fields:

```rust
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
```

Capabilities + parameters collapse into one struct. **No `*Deps` suffix in
Rust** — `*Options` for per-call bags, `*RouteState` for shared route state.

**Capability traits** — `PasswordHasher`, `Storage`, `BootstrapTokenStore`,
`FactStore`. Pure noun, no suffix. Climb here when polymorphism is real:
testability swap (Argon2id ↔ fast test hasher), multi-impl plug-in, or
inversion of definition (the lower crate declares the need; a higher crate
implements). (A hot-path service that never needs a swap stays a concrete
struct — `Keyring` deliberately has no trait.)

**Boxed closure factories** — between "just a closure" and "capability
trait": a one-shot injection point that must be generic over the consumer's
type gets a boxed-`FnOnce` type alias, not a trait —
`ExtraActionSpecsFactory<App>` / `PreMigrationHook<E>`
(`fuz_actions::consumer_lifecycle`; see rust-spine.md §Server lifecycle).
The caller supplies it once at startup; test binaries hook through it; no
trait ceremony accrues. A trait earns the slot only when the seam has
multiple methods or long-lived polymorphic state.

### Anticipated rungs, resolved differently

Two further rungs were anticipated and never built — the needs they named
were met by lighter shapes:

- **Composite traits per handler tier** (an action-spec dispatcher generic
  over multiple App types) — landed instead as the boxed-`FnOnce` factory
  aliases above plus per-tier borrowed capability-bundle structs
  (`fuz_auth`'s `AuthenticatedActionContext`, `AccountActionContext`).
- **Granular `*Provider` accessor traits** — no function ever needed a
  narrow bound a composite couldn't express.

Both stay unbuilt; revisit only if a genuinely trait-shaped need appears
that a closure or borrowed struct can't express. If one lands: descriptive
name (`*Actions`, `*Runtime`), never `*Deps`.

### Enum dispatch before trait objects

Before reaching for _any_ trait, ask whether the impl set is closed and known
at compile time. If so, an **enum with methods that match on `self`**
dispatches statically, needs no vtable, and stays exhaustively checked. A
trait earns its place only when the impl set is genuinely open or crosses a
crate boundary the lower crate can't name.

Exemplars:

- `fuz_storage::StorageBackend { File, Forge, Ssh }` — the `Storage` trait
  is RPITIT and **never consumed as `dyn`**; the enum is the dispatch. The
  enum wrapper must forward each backend's provided-method overrides (the
  streaming `download_to_file`/`upload_file`) or it silently regresses every
  backend to the buffered default.
- `zzz_server::Provider` and `zap_core::Connection` (local / ssh / mock) —
  async methods matching on `self`, no `#[async_trait]`.
- `zap_core::EventHandler` (`Null` / `Stdout` JSON-lines / `Masking`
  decorator / `Multi` fan-out, + test-only `Capture`) — sync `emit`.
- `zap_types::ResourceKind` — the enum lives in the pure types crate;
  dispatch is parallel **exhaustive matches in free functions** (one in the
  detect pass, one in execute), so adding a kind is a compile error in both.

**The inverse smell: a single-impl `Arc<dyn Trait>` is a deferred enum.**
Until a second impl or a test mock exists, prefer a concrete type or enum.
Promotion is real when the swap case is: `FactStore` began as a single-impl
`dyn` in a consumer and was later lifted into the spine as a documented
capability trait (PG-only / PG+disk / mock).

### Hot/cold dispatch rule

| Path     | Dispatch                                 | Why                                                                                                   |
| -------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Hot**  | concrete `Arc<T>`, `<T: Trait>`, or enum | Per-request HMAC, rate-limit checks; vtable cost measurable vs the op                                 |
| **Cold** | `Arc<dyn Trait>`                         | `Arc<dyn PasswordHasher>` (Argon2), `Arc<dyn FactStore>`; op cost dwarfs vtable, testability earns it |

`Arc<dyn>` also buys _type erasure_ (one field, no generic plumbing) — a
separate axis that sometimes justifies it on a hot path.

### Async traits — RPITIT, with one carve-out

Prefer return-position `impl Future` in traits for anything consumed as a
generic bound or concrete type — monomorphizes, no boxed-future allocation:

```rust
pub trait Storage: Send + Sync {
    fn upload(&self, path: &str, data: &[u8])
        -> impl Future<Output = Result<(), StorageError>> + Send;
}
```

**Carve-out**: traits consumed as `Arc<dyn Trait>` can't use RPITIT (no `dyn`
support yet). Return `BoxFuture<'_, T>` manually rather than reaching for
`#[async_trait]` — one line, explicit, no proc-macro (`PasswordHasher`,
`BootstrapTokenStore`). Migrate uniformly when RPITIT gains `dyn` support.

### Object-safety annotation on the trait def

Every `pub` trait in a shared crate declares its object-safety status as an
item-level `///` doc line, by _consumption pattern_:

- **`**Object-safe**`** — dispatched dynamically anywhere. Shape locked: no
  generic methods, no RPITIT (use `BoxFuture`).
- **`**Not object-safe**`** — generic-bound / concrete-adapter use only; free
  to use RPITIT.

The annotation tells contributors _why_ they can't add a generic method (or
that they can). Private one-off helper traits need no marker.

### Test injection — concrete impls in a separate crate

Test-only crates ship alternate impls satisfying the production traits — no
`cfg(test)` shadows, no runtime branches. The concrete shape is **two
binaries over one `run_app` entry point** (production + `testing_*` sibling);
see ./rust-spine.md. A release-time dep-graph audit proves the test impls
can't reach a shipped binary (./rust-dependencies.md §Crate-vs-feature
isolation).

### Borrowed context, owned providers

Per-request contexts borrow (`ActionContext<'a>` holding `&dyn Fn(&str,
&Value)` notify, `&CancellationToken`, request id); the App struct owns the
underlying `Arc<T>`s. The notify seam stays `&dyn Fn`, not `Arc<dyn Fn>`, on
hot paths — zero alloc. When a handler needs a `'static` sender the borrowed
seam can't provide (streaming past the request), see ./rust-spine.md
§Consumer wiring idioms.

### What stays concrete

tokio, tracing, `std::fs`, `std::env`, `std::time` — concrete by default.
Abstract only when a concrete reuse case appears:

- **Clock**: `#[tokio::test(start_paused = true)]` + `tokio::time::advance`
  already gives deterministic control; a `Clock` trait would wrap what tokio
  abstracts. Skip it.
- **Filesystem**: prefer a domain-scoped trait (`BootstrapTokenStore` with
  `read_token`/`delete_token`) over a general `Fs` — narrow seams compose,
  wide ones accumulate methods.
- **Logger / env**: abstract only when production noise blocks log-shape
  assertions or a subsystem needs per-call env override.

## Project Structure

```
project/
├── Cargo.toml          # Workspace: shared deps, lints, profile
├── crates/
│   ├── {proj}_*/       # Feature crates ({proj}_core, {proj}_types, …)
│   ├── {proj}_cli/     # Binary (or just {proj}/ — see below)
│   ├── {proj}_{wasm,ffi,napi}/  # Binding crates
│   └── xtask/          # Dev automation (where present)
├── tests/              # Integration tests (where applicable)
└── docs/               # Architecture docs
```

Crate naming: `{project}_{crate}` (`fuz_sys`, `tsv_lang`,
`blake3_wasm_core`). Exceptions: frequently-typed binaries get short bare
names — fuz's CLI is `fuz` (not `fuz_cli`), its daemon `fuzd`; a crate may
stay `{proj}_cli` while its `[[bin]]` name is bare (tsv).

Common crate kinds: a foundation crate with minimal deps holding shared
types (`{proj}_types`, `{proj}_lang`); feature crates with a `lib.rs` public
API; interface/binding crates (CLI, C-FFI, N-API, WASM); an xtask crate. A
pure IO-free types crate at the bottom of the graph (zap_types, fuzi_core's
type layer) is the cheapest place to enforce the §Idioms modeling rules.

## Build Configuration

- **build.rs** earns its place for: git-version embedding
  (`cargo::rustc-env=…_GIT_INFO={hash}`), compile-time validation of embedded
  data (public keys), and target-triple embedding.
- **xtask** owns dev automation: an `install`-style command (build → install
  to the app home → restart daemon), the `check-release` audit (spine
  workspaces — ./rust-spine.md), and publisher-only operations (signing,
  publishing) kept out of shipped binaries. The `[alias] xtask = "run
--package xtask --"` lives in `.cargo/config.toml`.
- **Config vs secrets, by source**: a checked-in `.cargo/config.toml` `[env]`
  holds _only non-secret dev overrides_ — anything checked in is silently
  inherited by every `cargo run`. Generated, gitignored files (mode 0600) for
  dev env; systemd/secrets infra for prod. Where the transport allows,
  prefer OS-level peer auth over tokens entirely — `fuzd` authenticates its
  UDS via `SO_PEERCRED` (same-uid), so there is no daemon token to manage.

## Testing

`cargo test --workspace`; unit tests in `#[cfg(test)] mod tests`, integration
tests in `tests/` where applicable. Three testing shapes recur:

- **Parsers/formatters** (tsv): snapshot fixtures (`tests/fixtures/…` with
  input files + generated `expected.json`, created by a fixture tool, never
  hand-edited) plus a **differential oracle** — corpus comparison against the
  reference implementation (Prettier), built with the unwind profile so
  panics surface as data — plus per-runtime binding tests.
- **Binding crates** (blake3): correctness asserted from the _consumer
  language_ against shared test vectors (TS for WASM, a Wasmtime compare
  binary for the component); zero Rust unit tests by design, `cargo test` as
  a compile gate. Legitimate — the boundary is where the bugs are.
- **Twin servers** (zzz, fuz_forge): the integration harness is the TS
  cross-backend suite launching the `testing_*` binary — see ./twin-impl.md.

## CLI Patterns

Arg parsing tracks binary size. Three tiers:

| Use case                                                 | Parser                  | +bytes vs `println!("hello")` |
| -------------------------------------------------------- | ----------------------- | ----------------------------- |
| Backend daemons, a few flags                             | manual `std::env::args` | +5 KB                         |
| User-facing CLIs with subcommands                        | **argh**                | +16 KB                        |
| Needs env-var binding, shell completions, or `wrap_help` | clap (`derive`)         | +340 KB                       |

argh is schema-driven (`#[derive(FromArgs)]`) — same mental model as
fuz_util's `args_parse` (Zod). Where a CLI exists in both TS and Rust, align
flag names and aliases (`--port` / `-p`). Manual daemons `match` on the first
arg and return `Result` to the `main() -> ExitCode` wrapper — no
`std::process::exit` in the async body, no `args[1]` panic. Shared input
modes: file path, `--content <string>`, `--stdin`.

### Exit codes

A small, _stable_ contract — treat it as a versioned API: settle it pre-1.0,
assert each category → code in a test, document the table in the crate doc.
Mechanism: `fn main() -> ExitCode` + `exit_code(&self) -> u8`. **Key codes to
the caller's remediation, not to error type** — there are more error types
than useful codes.

- **Default dialect** (human/script-facing — zap is the canonical impl): `0`
  success; `2` = the caller must change something local before re-running
  (bad args, config, credentials — "don't retry as-is"); `1` = everything
  else (server error, transient failure, local IO — "a retry may help, or
  it's out of the caller's hands"). Don't mint codes for categories nothing
  branches on. A tool whose _success_ has grades returns them too (zap: `0`
  converged, `2` dry-run drift, `1` wetrun failure).
- **Agent tier** (automation-primary CLIs whose consumers branch on
  category): `sysexits.h` codes **plus** a stable snake_case `error.kind` in
  `--json`. `fuzi` is the reference; `fuz` adopts the same taxonomy for its
  operationally-distinct artifact failures (lock held → `75`, disk full →
  `73`, integrity → `65`). Two dialects max — pick by audience.
- **Extend via a structured `kind`, not new exit integers.** A code is coarse;
  when a consumer needs finer signal, add `error.kind` to `--json` — strictly
  more expressive.
- **argh gotcha**: `argh::from_env()` hard-exits `1` on a parse error — the
  commonest usage error — violating "usage = 2". zap implements the fix:
  parse with `T::from_args(&[cmd], &args)` and map the `EarlyExit` (`Ok` →
  stdout, exit 0; `Err` → stderr, exit 2). Adopt that shape wherever the
  usage-code contract matters; several binaries still use `from_env()` and
  carry the wrong usage code.

### Flags

- **Dry-run posture is intentional per tool**: convergence/deploy tools
  default to dry-run with opt-in execute (`zap --wetrun`); build/prune tools
  default to execute with opt-in `--dry-run` (fuz).
- The env-file flag is hyphenated `--env-file` (argh's default rendering).
- **Env overlay without `set_var`**: zap parses `--env-file` into a
  process-wide `OnceLock<HashMap>` overlay consulted before `std::env` — no
  env mutation, so it works under `unsafe_code = "forbid"` (`set_var` is
  unsafe in edition 2024).

## Patterns

### Sandboxed one-shot eval

Executable config (a TS builder run under `deno`) evaluates through a shared
harness — `fuz_eval::eval_module(&EvalRequest)`: `deno run --no-prompt` with
**no** net/env/write, a caller-chosen `ReadScope` (`Scoped(dir)` or
`Unrestricted`), a wall-clock timeout + kill, and the wrapper piped over
stdin (no temp file). Don't re-roll the spawn.

Policy belongs to the caller. zap passes `ReadScope::Unrestricted` under a
first-party trust model (configs must resolve imports from anywhere up the
dependency tree) — the walls that remain are net/env/write. Its wrapper also
enforces **determinism by construction**: `Date.now` / `Math.random` /
`performance.now` / `crypto.randomUUID` / no-arg `new Date()` are stubbed to
throw, and `console.log/info/debug` reroute to stderr so stdout stays pure
JSON — the evaluated plan must be a content-addressed fact.

The wrapper _ingredients_ are shared exports of `fuz_eval` — the
determinism stubs (`DETERMINISM_STUBS_JS`), the console redirect
(`CONSOLE_TO_STDERR_JS`), and `build_extract_export_wrapper(name, stubs)`
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
serializer task that owns stdin, per-request `oneshot` responses parked in a
map keyed by request id, and the script embedded via `include_str!` + written
to a `NamedTempFile` at spawn. Skip it for one-shot invocations (plain
`tokio::process::Command`) or pure in-process work.

**Currently dormant** — the sidecar _runtimes_ (`fuz_deno`/`fuz_python`
factories, behind `fuzd`'s off-by-default `sidecar` feature) are gated off, so
the shipped daemon wires no runtime into the pool; `fuz_sidecar` itself always
links into `fuzd`/`fuzd_server` for the empty pool and dispatch (tsv replaced
the Deno sidecar's parsing role). The controller and its crash-recovery
respawn loop (exponential backoff, capped) remain the reference if a
runtime-hosting workload returns.

### Security

- **Constant-time token comparison** via `subtle::ConstantTimeEq`.
- **TOCTOU-safe file operations**: open with `O_NOFOLLOW`, check permissions
  on the fd, not the path.
- **Secure file permissions**: `0o600` files, `0o700` directories — and
  deliberately _not_ for non-secret state (a daemon-info file readable by
  tooling is `0o644` on purpose; state the choice).
- **Supply-chain isolation** is a crate-graph property, not a code pattern —
  see ./rust-dependencies.md §Crate-vs-feature isolation.

### Transactional state files

State that several invocations mutate (a lock ledger, an intent file) needs
serialization and atomicity:

- **Advisory file locking** (`nix::fcntl::Flock`) serializes concurrent
  writers across processes — acquire before read-modify-write.
- **Atomic temp + rename**: a reader never sees a half-written file; a crash
  mid-write leaves the old version intact.

The ecosystem implementation is `fuz_sys::fs::write_atomic` (write
`.<name>.tmp.<pid>` → `sync_all` → rename → **fsync the parent dir**); it
replaced ~five hand-rolled copies — use it, don't re-roll. **Calibrate the
durability by authority**: the parent-dir fsync is required for
_authoritative, non-regenerable_ state (lock ledgers, credentials) and
deliberately waived for content-addressed bodies (a torn write is caught by
re-hashing) and ephemeral regenerable run-state. State the choice when you
skip it. zap — spine-free — hand-rolls both calibrations correctly: flock +
full fsync dance for its authoritative lock file, temp + rename only for its
regenerable detection cache ("the cache holds no authority").

For the lock itself: `flock` locks the _inode_, so lock a stable sidecar path
and **never unlink on release** (truncate-but-keep-dirent) — else two
acquirers hold different inodes. (zap's lock currently locks the pre-rename
inode with a `TODO` — known wart, not a competing convention.)

### Content-addressed storage with size-based routing

The shape of a blob store keyed by content hash (ecosystem impl:
`fuz_fact`, consumed by fuz_forge; serving is the separately-authz'd
`fuz_fact_serving`):

- Blobs below an embed threshold (1 MiB) live inline in the database row —
  one round trip, transactional with their metadata.
- Larger blobs go to sharded disk paths (`<2-hex>/<62-hex>` of the hash) via
  atomic temp + rename; the row stores a `file:<shard>/<rest>` pointer.
- **Verify-on-read applies to the buffered `get`** (re-hash, mismatch →
  treated as absent). The streaming serve path deliberately does _not_
  re-hash — it trusts write-time `sync_all` on hash-named files.
- Idempotent writes: content-addressed names + `INSERT … ON CONFLICT (hash)
DO NOTHING` make a re-store a no-op.

### Bounded reads / size guards

Never read an untrusted-size input unbounded:

- **Files**: preflight the reported size, then read with a `+1` cap so a file
  that grew between `stat` and read is rejected rather than silently
  truncated — `take(MAX + 1)`, `len > MAX` is an error.
- **Streams** (HTTP bodies, subprocess output): enforce a byte counter
  mid-stream and abort on overrun — `Content-Length` is a hint, not a bound.
  Unlink partial output on overrun. fuz_forge's upload pipeline layers the
  guards: Content-Length preflight + mid-stream counter + statvfs free-space
  check (`507 storage_full`) + a concurrency semaphore + an orphan-temp
  sweep.
- **Centralize the ceilings**: one private constant behind named public
  aliases (`fuz_sys::limits`: `ARTIFACT_CEILING_BYTES` feeding
  `MAX_TRANSFER_SIZE`, `MAX_FILE_SIZE`, …) — call sites keep
  intent-revealing names, the value has one home. Add new caps there, not
  per-crate.

### Type state (compile-time state machines)

When a value progresses through states, encode the state in the type so
calling a method in the wrong phase is a compile error. A **correctness**
pattern, not a performance one.

The in-codebase shape is the **consuming transition**, not `PhantomData<S>`:
zap's `SecretRegistry::freeze(mut self) -> Result<SecretMasker>` makes "mask
before the registry is frozen" unrepresentable by moving the value into the
next type — and the transition is fallible, doubling as validation (it
rejects a registered value that would corrupt cascading replacement). Reach
for `PhantomData<S>` only when one value must thread several states through a
generic API. Skip type state when states are data-driven (runtime enum), only
one transition exists, or the API must stay ergonomic for casual callers.

### Secret masking pipeline

Masking happens at the **consumption** boundary, not emission: execution
stays masking-unaware; the batch report is masked once at render, and the
live event stream is masked by a decorator wrapping the sink
(`EventHandler::Masking`). The registry registers each secret's literal,
URL-encoded, and JSON-escaped variants and replaces longest-first; `freeze`
is the type-state gate above.

### Logging

**Servers**: `tracing`; subscriber setup is single-sourced in a shared helper
(`fuz_sys::logging::init_non_blocking_stdout`, behind the `logging` feature)
— consumers dep `tracing` only, not `tracing-subscriber`.

**CLIs / daemons**: `eprintln!` — simple, no framework. Batched request
logging for performance; `--json` for machine-readable output.
