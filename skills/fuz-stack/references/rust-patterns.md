# Rust Patterns for the Fuz Ecosystem

**Applies to**: Rust workspaces across the ecosystem — CLIs and daemons
(`fuz`, `fuzd`, `zap`), WASM bindings (`blake3`), and web servers with
their spine crates (`zzz_server`, `fuz_forge_server`). All use **Rust
edition 2024**, resolver 2.

Each project's `CLAUDE.md` is authoritative for project-specific conventions;
this covers shared patterns.

## Core Values

- **No backwards compatibility**: Pre-1.0 means breaking changes. Delete old
  code, don't shim.
- **Code quality**: `unsafe_code = "forbid"`, pedantic lints, tests expected.
  See §Lints.
- **Performance**: If it's slow, it's a bug. See ./rust-perf.md.
- **Copious `// TODO:` comments**: Mark known future work. `todo!()` is
  `warn` workspace-wide — use `#[allow(clippy::todo)]` with justification
  when needed.

## Lints

Strict lint configuration in `Cargo.toml`:

```toml
[workspace.lints.rust]
unsafe_code = "forbid"
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

# Common pedantic allows
module_name_repetitions = "allow"
must_use_candidate = "allow"
similar_names = "allow"
too_many_lines = "allow"

# Nursery overrides
significant_drop_tightening = "allow"

# Cargo allows (private repos)
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

### Project-specific lint differences

- `missing_debug_implementations`: "warn" in `fuz` and `zzz`; "allow" in
  `tsv` (public types hold `Chars`, `RefCell<Interner>`, etc.); not set
  in `blake3`.
- **Crate-level overrides**: a crate that needs `unsafe_code` (a C-FFI ABI
  layer, a wit-bindgen component, a PTY/syscall wrapper — `tsv_ffi`,
  `blake3_component`, `fuz_pty`)
  can't *partially* override the workspace `forbid`. Cargo replaces the
  whole `[lints]` table, so relaxing one lint means **re-declaring all the
  others** in the crate's own `[lints]`. The trap: a crate that overrides
  only `unsafe_code = "allow"` silently drops the restriction-lint floor
  (`unwrap_used`, `panic`, `expect_used`) for itself. Re-paste the full
  workspace block and change only what must change. A binding crate that
  doesn't actually emit unsafe should instead keep `[lints] workspace =
  true` and inherit `forbid` — many wit-bindgen/wasm-bindgen crates do.
  `blake3_component` additionally allows `same_length_and_capacity` and
  `use_self` (false positives from generated code).

Each crate opts in with `[lints] workspace = true`.

## Release Profile

```toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

Slower builds (~2x), no symbol names in backtraces — worth it for binary size
and performance.

The ecosystem's canonical workspaces (`fuz`, `zzz`, `zap`, `fuz_forge`) carry
this `[profile.release]` block **byte-identically**, including `panic = "abort"`
— along with identical `[workspace.lints.*]` (modulo `missing_debug_implementations`,
above), edition 2024, version `0.1.0`, `MIT`, `publish = false`. Treat these as
hard ecosystem conventions, not per-repo choices.

**blake3 exception**: `opt-level = "s"` for smaller WASM. Individual builds
override via `RUSTFLAGS`.

## Error Handling

### Typed errors with `thiserror`

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MyError {
    #[error("file not found: {0}")]
    FileNotFound(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),
}
```

### Binary vs library pattern (fuz)

Libraries export typed errors. Binaries wrap them with top-level error for
display and exit codes:

```rust
// Library crate - typed errors
pub async fn call_tool(name: &str) -> Result<Value, ClientError> { ... }

// Binary crate - wraps library errors via #[from]
#[derive(Debug, Error)]
pub enum CliError {
    #[error(transparent)]
    Client(#[from] ClientError),

    #[error(transparent)]
    Artifact(#[from] ArtifactError),
}

// Central error handling — return ExitCode, never std::process::exit (see §CLI Patterns)
fn main() -> ExitCode {
    let Err(e) = run() else { return ExitCode::SUCCESS };
    eprintln!("error: {e}");
    if let Some(hint) = e.hint() {
        eprintln!("hint: {hint}"); // print site owns the `hint:` label
    }
    ExitCode::from(e.exit_code()) // -> u8
}
```

### Helper methods (fuz)

```rust
impl CliError {
    pub fn hint(&self) -> Option<HintMessage> { ... }  // User-facing fix suggestion
    pub fn exit_code(&self) -> u8 { ... }              // For ExitCode::from (see §CLI Patterns)
}

impl ClientError {
    pub fn hint(&self) -> &'static str { ... }         // User-facing fix suggestion
    pub fn is_transient(&self) -> bool { ... }         // Retry might succeed
}

impl SidecarError {
    pub fn is_recoverable(&self) -> bool { ... }       // Should trigger restart
}
```

**Conventions** (observed across fuz crates):

- **Helpers belong on the binary's top-level error**, not on every library
  error. `fuz_client::ClientError` exposes `.hint()` because the message is
  user-actionable. Library-level error types (parser errors, IO errors, etc.)
  stay thin — variants only, no `.hint()` / `.exit_code()` — and the binary
  wrapper adds the helpers when it composes them.
- `.hint()` returns `Option<HintMessage>` when most variants lack a hint
  (`CliError`), or `&'static str` (`""` = absent) when all do (`ClientError`).
  See §CLI flag & error conventions for `HintMessage`.
- `.exit_code()` returns `u8` (for `ExitCode::from`); reserve 1 for generic
  failure, 2+ for category-specific (auth/token). Match arms over variants.
- `.is_transient()` / `.is_recoverable()` belong to a family of small
  `&self -> bool` (or `-> Option<_>`) **classifiers** the caller branches on —
  each answers one dispatch question by matching variants, no side effects.
  Name them for the decision, not the variant: `is_transient` = "retry might
  succeed" (use this verb everywhere), `is_recoverable` = restart,
  `needs_daemon_start` = auto-start then retry, `is_tool_error` = tool-level vs
  infrastructure, `is_security_violation` = the auth path. A wrapper error
  forwards its inner classifier, never re-decides.
- Use `#[source]` on `thiserror` variants to chain causes; the `Display` impl
  shows only the variant's own message, while the source chain surfaces via
  `e.source()` for structured logging. Real example from `fuz_client`:

```rust
#[derive(Debug, Error)]
pub enum ClientError {
    #[error("failed to parse RPC result: {context}")]
    ResultParse {
        context: &'static str,
        #[source]
        source: serde_json::Error,
    },

    #[error("failed to parse response")]
    ResponseParse(#[source] reqwest::Error),
}
```

### WASM boundary errors (blake3)

No `thiserror`. Use `JsError` directly for wasm-bindgen:

```rust
pub fn keyed_hash(key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsError> {
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
    Ok(blake3::keyed_hash(&key, data).as_bytes().to_vec())
}
```

For component model errors, see ./wasm-patterns.md.

## Async Runtime & Graceful Shutdown

Server/daemon crates use **tokio** with **tokio-util**'s `CancellationToken`
for shutdown coordination. The HTTP-server half is centralized in the spine
(`fuz_http::lifecycle` — `shutdown_token` + `serve_with_shutdown`), consumed by
`zzz_server` and `fuz_forge_server`; the UDS daemon `fuzd` keeps its own
signal handler (it can't link `fuz_http`/axum). The shape is consistent across
all three.

### Shutdown token threading

A single `CancellationToken` owned at the top level, cloned into every task
or component that needs to know about shutdown:

```rust
// fuzd/src/main.rs
let shutdown = CancellationToken::new();

// Spawn signal handler — flips the token on SIGINT/SIGTERM
let signal_token = shutdown.clone();
tokio::spawn(async move {
    use tokio::signal::unix::{signal, SignalKind};
    let mut sigterm = signal(SignalKind::terminate()).expect("install SIGTERM");
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = sigterm.recv() => {}
    }
    signal_token.cancel();
});

// Pass into the server, which threads it into request handlers
let server = Server::new(addr, shutdown.clone(), /* ... */);

tokio::select! {
    res = server.serve() => res,
    () = shutdown.cancelled() => Ok(()),
}
```

### axum's `with_graceful_shutdown`

axum integrates with `CancellationToken` directly: the server stops accepting
new connections when the token fires, but lets in-flight requests finish:

```rust
// fuz_http/src/lifecycle.rs — serve_with_shutdown (the shared spine harness)
let serve = axum::serve(listener, app).with_graceful_shutdown(async move {
    shutdown.cancelled().await;
});

// Drain timeout: bound how long we wait for in-flight requests
tokio::select! {
    res = serve => res?,
    () = tokio::time::sleep(DRAIN_TIMEOUT) => {
        tracing::warn!("drain timeout exceeded; forcing shutdown");
    }
}
```

Drain timeout is essential — without it, a hung handler keeps the process
alive indefinitely.

### Per-task `select!` for cooperative cancellation

Long-running tasks (log flusher, background workers) check the shutdown
token via `tokio::select!`. The `fuzd_server` log flusher uses `Notify` for
event-driven wakeups rather than a fixed interval — flushes are debounced
behind the most recent log call, so an idle daemon doesn't tick uselessly:

```rust
// fuzd_server/src/logging.rs — notify-driven flush task (spawn_flush_task)
loop {
    tokio::select! {
        () = logger.notify.notified() => {}
        () = shutdown.cancelled() => {
            logger.flush();  // final flush before exit
            return;
        }
    }
    // ... debounce/throttle inner loop, also selects on shutdown ...
    logger.flush();
}
```

The two takeaways: every `select!` arm includes `shutdown.cancelled()`, and
every shutdown branch flushes pending work before returning.

### When to use `TaskTracker`

`tokio_util::task::TaskTracker` waits on a known set of spawned tasks to
finish. Use it when shutdown needs to verify "all worker tasks exited cleanly"
before the process exits. Skip it when the task is short-lived or owned by an
`Arc`-shared component that drops naturally.

### Don't use

- `std::process::exit()` from inside async code — bypasses Drop, leaks
  file descriptors, skips graceful shutdown.
- Bare `tokio::spawn` with no shutdown awareness for anything that holds
  resources (sockets, child processes, file handles).
- `tokio::sync::broadcast` as a poor-man's cancellation token. Use
  `CancellationToken` — it's purpose-built and composes via `.clone()`.

## Naming Conventions

Use natural Rust naming for free functions — **not** the domain-first
`domain_action` style of this stack's TypeScript (see SKILL.md). `fn parse`,
`fn create_artifact` — not `fn artifact_create`.

## Idioms

Style guidance the lint config encodes (`clone_on_ref_ptr`, `panic`,
`unwrap_used` warn). Ecosystem-specific bits are called out with examples.

### Prefer enums for closed sets

Fixed variant sets → enum, not `bool` or sentinel string; exhaustiveness makes
every `match` a contract that fires when variants change.

**At a deserialization boundary this is also validation.** A `String` field for a
closed set (`method`, `policy`) accepts typos and bogus values, which then fail at a
late runtime guard — or worse, silently do the wrong thing. A `#[serde(rename_all =
"...")]` enum rejects them at parse with `unknown variant 'x', expected one of ...`:

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FirewallPolicy { Allow, Deny, Reject } // `"denyy"` fails at parse, not at apply
```

Valid values deserialize identically, so **existing config files keep working
unchanged** — the enum only starts rejecting inputs that were always bugs. (Code that
compared the field against string literals does have to switch to matching.) Even a
single-variant enum earns its keep: it rejects unknown values at parse, and the next
variant forces every `match` to handle it.

**Leniency is only for genuine extensibility.** Keep a `String` (or add a catch-all
variant) *only* when the value is passed through verbatim to an external system whose
set is genuinely open or evolving and you don't dispatch on it. For a set your own code
defines, or a stable external contract, "parse anything" buys nothing and costs safety.

### Make impossible states unrepresentable

The umbrella principle behind enums-for-closed-sets: model so the type system rejects
nonsense — don't lean on a runtime check or a comment.

- **Mutually-exclusive → enum; co-present → struct.** If exactly one of several states
  holds, an enum says so; if several can hold at once, a struct of `Option`s is right.
- **A field that's only meaningful for some variants belongs inside that variant**, not
  as a sibling `Option` the type permits when it's meaningless. A tar `strip_components`
  belongs in the tar variant of an extract-mode enum — so the no-extract variant cannot
  carry one — rather than a `strip_components: Option<u32>` beside the mode that gets
  silently ignored for non-tar.
- **Carry the payload on the variant**, so "this combination can't happen" is a compile
  fact, not a convention the constructor has to remember.

**Worked reference**: `zap_types` is the ecosystem's gold standard — `TargetLocation`
(an enum that makes local+host unrepresentable, de/serializing through a flat wire
struct via `try_from`/`into`), payload-on-variant (`strip_components` inside the tar
`ExtractMode` variant; the sudo list inside `UserSudo::Restricted`), single-variant
tagged enums kept as enums on purpose (`BuildSource::Remote`, `SourceVerify::Minisign`
— reject typos now, force the `match` when a second variant lands), transparent
newtypes for closed *formats* validated at the serde boundary (`scalar::AccountName`,
`Mode`), and typed-enum-replaces-bool (`ExternalState` instead of `external_state: bool`).
`fuzi_core` is a second exemplar (`Os`/`Cpu`/`Libc` + negation-aware `PlatformToken`,
`RefuseReason`/`EntryDisposition`/`ResolvedKind`, `LockfileVersion::from_raw`, an
`Integrity` newtype wrapping `ContentHash` rather than a bare `String`).

**Two anti-patterns reviewers actually hit:**

- **The flattened discriminated union.** A `struct { available: bool, error:
  Option<String> }` whose doc-comment says "matches a TS discriminated union
  `{available:true} | {available:false, error}`" but whose type permits both
  impossible combos, held out only by private constructors. That doc-comment *is* the
  smell — lift to an enum with the payload on the variant and a custom `Serialize` for
  the flat wire shape. (zzz's `ProviderStatus` is the enum form:
  `Available{…} | Unavailable{…, error}` + a hand-written `Serialize`.)
- **The `json!({"kind": …})` closed set.** A response body built with bare
  `json!({"kind":"truncated", …})` / `{"kind":"binary"}` / `{"kind":"text", …}` across
  several `match` arms is a discriminated union evading the enum rule — model it as a
  `#[serde(tag = "kind", rename_all = "snake_case")]` enum so each variant carries only
  its own payload (`size` on truncated, `text` on text, none on binary). The wire
  output is identical. (The forge's `BlobBody`
  — `Truncated{size} | Binary | Text{text}` — is the enum form, alongside the
  same crate's `UploadStatus`.)

### Zero-cost / low-cost abstractions

Three patterns recur across the ecosystem:

**Function pointers over trait objects** for statically-known dispatch.
`fuz_sidecar::SpawnConfig` holds `build_command: fn(&Path, Option<&Path>)
-> Command` instead of `Box<dyn Fn(...)>` — no allocation, inlinable.

**Callback resolution over allocating accessors** in hot paths. For interned
data or pooled resources, expose both an allocating accessor for one-off
lookups and a callback form for tight loops — tsv's string interner does this:

```rust
let owned: String = interner.resolve_symbol(sym);        // allocates
interner.with_resolved_symbol(sym, |s| out.push_str(s)); // zero-alloc
```

**`Cow`-shaped wrappers** when some returns are pure constants and others need
interpolation. `HintMessage` (`Static | Owned`) keeps the constant case
allocation-free — same idea as `Cow<'static, str>`, named for API clarity.

### Avoid clone smells

The `clone_on_ref_ptr` lint warns on `arc.clone()` — workspace policy is
`Arc::clone(&arc)`, so the call site signals a refcount bump, not a deep copy.
Reach for `Cow<'_, str>` only when callers genuinely have mixed-ownership data
and the borrowed case is common — otherwise the cleverness isn't worth it.

## Dependency Injection

The TS `*Deps` discipline doesn't translate 1:1 — much of what TS solves
with DI (runtime agnosticism, module mocking, capability bundles in
signatures, deterministic clocks) Rust solves natively with the crate
graph, trait bounds, monomorphization, test crates, and tokio's mock
clock. Treat the pattern as an **escalation ladder**: start at the
floor, climb a rung only when a concrete need requires it.

### Effects at the edges

The ladder's goal is a **pure-ish core with effects pushed to the boundary** —
most code testable without IO, mocks, or a runtime. The structural habits, above
the question of *which rung*:

- **Split IO from logic; inject the result, not the source.** A function that
  reads a file (or probes the host) *and* decides on the contents becomes a thin
  edge that does the read + a pure function over the parsed value — the decision
  carries the subtle logic and is the part worth testing. The pure half takes the
  value as a param; one edge function does the probe.
- **Presentation is a returned value, not prints in the library.** The
  success-side mirror of §"Binary vs library pattern": a library function returns
  a structured result; the binary renders it (human / `--json` / `--quiet`).
  `println!` in library code is an effect like any other — keep it out.
- **Contain async to the IO seam.** When one phase does network/async IO, put it
  behind a trait and keep the rest of the core sync, driven under `block_on` /
  `spawn_blocking`. Coloring a whole API async for one bounded phase is a smell —
  a one-shot CLI rarely needs `#[tokio::main]`.

### Active rungs

**Floor — just import and call.** Pure utilities (crash-safe fs helpers,
canonical JSON, parsers, validators, formatters, stateless helpers) don't
enter the pattern at all. Rust's modules + `use` + monomorphization are the
DI for these cases; reaching for a trait or accessor adds ceremony with no win.

**Default — concrete `*Options` struct + direct refs.** When a function
operates on state owned by the app (keyring, pool, audit emitter), pass
that state as a ref via a per-call-site `*Options` struct (or `*RouteState`
for route-group-shared state) holding `Arc<T>` fields:

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

async fn signup_handler(
    deps: &SignupOptions,
    client_ip: Option<String>,
    input: SignupInput,
) -> Result<SignupSuccess, AuthError> { /* ... */ }
```

Capabilities + parameters collapse into one struct — Rust idiom; the TS
three-category split (capabilities / options / runtime state) stays a
useful *mental* model but doesn't shape the type. **No `*Deps` suffix in
Rust** — that's the TS convention; Rust uses `*Options` for per-call
bags and `*RouteState` for route-group shared state.

**Capability traits** — `PasswordHasher`, `Storage`, `SocketRevoker`,
`Keyring`, `BootstrapTokenStore`. Pure noun, no suffix. Climb to this
rung when polymorphism is real: testability swap (production Argon2id ↔
test fast hasher), multi-impl plug-in (file + object storage backends),
or inversion of definition (the lower crate declares the need; a higher
crate implements).

### Deferred rungs

Two further rungs stay **unbuilt** until concrete evidence forces them.
Speculative trait scaffolding accumulates inertia — easier to add when
a real signature names what it needs.

**Composite traits per handler tier** — when an action-spec dispatcher
in a spine crate must be generic over multiple App types
(`zzz_server::App`, `fuz_forge_server::App`, ...), a composite trait per tier
with accessor methods inline is the path. Descriptive name (`*Actions`,
`*Runtime`, `*Handler`), never `*Deps`. Default to one composite; split
into multiple only when a consumer genuinely opts out of part of the
surface.

**Granular `*Provider` accessor traits** — only when a function takes a
narrow bound that a composite can't express. Don't proliferate
speculatively.

### Hot/cold dispatch rule

| Path     | Dispatch                          | Why                                              |
| -------- | --------------------------------- | ------------------------------------------------ |
| **Hot**  | concrete `Arc<T>` or `<T: Trait>` | Per-request HMAC, rate-limit checks; vtable cost is measurable vs the op |
| **Cold** | `Arc<dyn Trait>`                  | Argon2 hashing, audit fan-out, socket revocation; op cost dwarfs vtable, testability earns it |

Choose by measurement, not aesthetic — when the op dominates, take the
testability win. `Arc<dyn>` also buys *type erasure* (one field on the
storing struct, no generic plumbing) — a separate axis that sometimes
justifies it on a hot path too.

### Enum dispatch before trait objects

Before reaching for *any* trait — `impl Trait` bound or `Arc<dyn Trait>` —
ask whether the set of implementations is closed and known at compile time.
If it is (a connection that is local, SSH, or a test mock; a backend that is
one of three known kinds), an **enum with a method that matches on `self`**
dispatches statically, needs no vtable, and keeps the variants exhaustively
checked. A trait earns its place only when the impl set is genuinely open or
crosses a crate boundary the lower crate can't name (see the capability-trait
rung above). This is the §Idioms "enums for closed sets" rule applied to
dispatch.

Canonical exemplars across the workspaces: `fuz_storage` keeps a `Storage`
trait for the genuinely-open `Arc<dyn Storage>` cold path **and** an
`enum StorageBackend { File, Object, Forge }` that matches on `self` for the
closed set (note: the enum wrapper must forward each backend's provided-method
overrides — e.g. the streaming `download_to_file`/`upload_file` — or it silently
regresses every backend to the buffered default). `zzz_server::Provider`,
`zap_core::EventHandler` (JSON-lines sink + a `Masking` decorator variant + a
`Multi` fan-out), `zap_core::Connection` (local / ssh / mock), and
`zap_core::ResourceKind` (one enum, parallel exhaustive matches in the
detect and execute passes) are all async-method-match-on-`self` with no
`#[async_trait]`. The inverse smell: **a single-impl `Arc<dyn Trait>` is a
deferred enum, not a capability trait** — until a second impl or a test mock
exists, prefer a concrete type or enum (real occurrence: the forge `FactStore`).

### Async traits — RPITIT, with one carve-out

Prefer return-position `impl Future` in traits (stable Rust 1.75+):

```rust
pub trait Storage: Send + Sync {
    fn upload(&self, path: &str, data: &[u8])
        -> impl Future<Output = Result<(), StorageError>> + Send;
}
```

Monomorphizes, no boxed-future allocation. Use this for traits consumed
as a generic bound or concrete type.

**Carve-out**: traits consumed as `Arc<dyn Trait>` can't use RPITIT yet
(no `dyn` support). For those, return `BoxFuture<'_, T>` manually rather
than reaching for `#[async_trait]` — one line, explicit, no proc-macro:

```rust
pub trait BootstrapTokenStore: Send + Sync {
    fn read_token(&self) -> futures::future::BoxFuture<'_, std::io::Result<Vec<u8>>>;
    fn delete_token(&self) -> futures::future::BoxFuture<'_, std::io::Result<()>>;
}
```

When RPITIT gains `dyn` support, migrate uniformly.

### Object-safety annotation on the trait def

Every deps-surface trait declares its object-safety status as an
item-level `///` doc on the trait, by *consumption pattern* not shape:

- **`**Object-safe**`** — dispatched dynamically anywhere (`Arc<dyn T>`,
  `&dyn T`, `Box<dyn T>`). Shape locked: no generic methods, no
  RPITIT (use `BoxFuture`).
- **`**Not object-safe**`** — generic-bound / concrete-adapter use
  only. Free to use generic methods, RPITIT, etc.

The annotation tells future contributors *why* they can't add a generic
method (or that they can). See the canonical spec for the dual-variant
`*` + `*Dyn` companion pattern when both dispatch shapes are load-bearing.

Scope: `pub` traits in shared crates carry the marker even when used only as a
generic bound today (e.g. `fuz_artifact::MetaIntegrity` and
`fuz_archive::Placement` — both `**Not object-safe**`, consumed only as
`T: Trait` / `P: Trait` bounds). Private one-off helper traits inside a single
crate need not.

### Test injection — concrete impls in a separate crate

Test-only crates ship alternate impls satisfying the production traits.
Tests construct the app with the test impl plugged in; no `cfg(test)`
shadows, no runtime branches in production. A release-time dep-graph
audit (e.g. an `xtask check-release` step) gates that no production
binary transitively depends on test crates.

The concrete shape is **two binaries over one runtime entry point**. The
production binary (`{proj}_server`) wires the real impls; a sibling
`testing_{proj}_server` wires the fast/deterministic ones (e.g. a cheap
password hasher in place of Argon2id) and is the target cross-process
integration tests launch. Both call the same `run_app(opts)` — only the
injected `*Options` differ, so the tested lifecycle is the real one. The
`check-release` audit makes this safe: it proves the test hasher can't reach
a shipped binary. Closures in the options struct (`ExtraActionSpecsFactory`,
a `PreMigrationHook`) let the test binary add test-only actions or DB setup
without the library taking a test dependency.

### Borrowed context, owned providers

Per-request contexts borrow (`ActionContext<'a>` holding `&dyn Fn(&str,
&Value)` notify, `&SignalToken`, `&tracing::Span`); the App struct owns
the underlying `Arc<T>`s. Side effects queue via a deferred-effects
channel rather than `&mut Ctx`. Notify seam stays `&dyn Fn`, not `Arc<dyn
Fn>`, on hot paths — zero alloc, zero capture.

### What stays concrete

tokio, tracing, `std::fs`, `std::env`, `std::time` — concrete by default.
Abstract only when a concrete reuse case appears.

A few subsystem-specific notes:

- **Clock**: tokio's `#[tokio::test(start_paused = true)]` + `tokio::time::advance(...)` already gives deterministic control over `Instant::now()` and `sleep_until` for anything in `tokio::time`. A `Clock` trait would wrap what tokio already abstracts — skip it; reach for one only if a non-tokio consumer needs determinism.
- **Filesystem**: prefer a **domain-scoped** trait (e.g. `BootstrapTokenStore` with `read_token` / `delete_token`) over a general `Fs`. Scope creep is the failure mode — narrow seams compose; wide ones accumulate methods.
- **Logger / env**: abstract only when production noise blocks log-shape assertions, or a subsystem needs per-call env override without process-global state.

## Project Structure

### Workspace Organization

```
project/
├── Cargo.toml          # Workspace config with shared deps, lints, profile
├── crates/
│   ├── {proj}_common/  # Foundation utilities (shared types, errors)
│   ├── {proj}_*/       # Feature-specific crates
│   ├── {proj}_cli/     # Production binary (or just {proj}/ — see below)
│   ├── {proj}_debug/   # Dev binary (may use Deno sidecar)
│   └── {proj}_wasm/    # Interface crates: WASM, C FFI
├── tests/              # Integration tests (where applicable; fuz uses unit tests)
│   └── fixtures/       # Test fixtures (if applicable)
└── docs/               # Architecture and reference documentation
```

Crate naming: generally `{project}_{crate}` (`fuz_sys`,
`blake3_wasm_core`). Exceptions: fuz's CLI is just `fuz` (not `fuz_cli`) and
its daemon is `fuzd` (not `fuz_daemon`) — short names for frequently-typed
commands.

### Common crate patterns

- **Foundation crate**: Shared types (Span, errors, config) with minimal deps
  (`fuz_sys`, `blake3_wasm_core`)
- **Feature crates**: Domain logic with `lib.rs` public API
- **Debug crate**: Dev tooling, may embed external runtimes (Deno sidecars)
- **Interface crates**: Binding layers (CLI, C FFI, WASM)
- **xtask crate**: Dev automation (`cargo xtask install`), used by fuz

## Build Configuration

### build.rs

- **Git version embedding** (fuz, fuzd): `cargo::rustc-env=FUZ_GIT_INFO={hash}`
- **Compile-time data** (fuz_crypto): Parse/validate public keys, generate
  constants
- **Target triple** (fuz_release): `cargo:rustc-env=TARGET={triple}`

### xtask pattern (fuz)

```bash
cargo xtask install                 # Build, install to ~/.fuz/, restart daemon
cargo xtask install --no-restart    # Build + install only
cargo xtask install --build-only    # Build only (CI)
cargo xtask clean                   # Remove ~/.fuz/, stop daemon
cargo xtask check-release           # Dep-graph audit (no production binary links fuz_testing/fuz_audit/fuz_sign)
cargo xtask key …                   # Publisher-only signing-key ops
cargo xtask publish {self,tool} …   # Bootstrap-only signer (publishes the self + first per-tool artifacts)
```

### Environment configuration (fuz)

fuz separates **non-secret dev config** from **secrets** by source:

| Source                  | Holds                | Read by                    | Notes                              |
| ----------------------- | -------------------- | -------------------------- | ---------------------------------- |
| `.cargo/config.toml`    | non-secret dev overrides (e.g. `FUZ_PORT`) | `cargo run` / `cargo test` | Checked in. Dev only. |
| `~/.fuz/config/env`     | generated dev env    | User shells (optional source) | Generated by `cargo xtask install` (gitignored, mode 0600) |
| systemd / Docker / secrets infra | secrets     | prod daemon                | Never sourced from a checked-in file |

```toml
# .cargo/config.toml
[env]
FUZ_PORT = "3621"    # non-secret dev override

[alias]
xtask = "run --package xtask --"
```

The principle: **`.cargo/config.toml` holds only non-secret dev overrides** —
anything checked in is silently inherited by every `cargo run`, so a secret has
no business there. Anything secret or environment-dependent goes in a generated,
gitignored file (mode 0600) or the prod secrets infra.

Note on the live model: `fuzd` authenticates over its UDS via `SO_PEERCRED`
(same-uid), so the old `FUZ_AUTH_TOKEN` is **retired** — there is no daemon
token to keep out of `.cargo/config.toml` anymore; the rule stands for any
future secret. The dev/prod port comes from `fuz_home::DEV_PORT`, not a
hardcoded literal.

## Testing

`cargo test --workspace`. Unit tests in `#[cfg(test)] mod tests`,
integration tests in `tests/` where applicable. fuz uses unit tests in
modules; blake3 tests correctness in TypeScript (WASM vs native) and uses
Wasmtime for the component. See each project's `CLAUDE.md` for specifics.

## CLI Patterns

Arg parsing tracks binary size. Three tiers:

| Use case | Parser | +bytes vs `println!("hello")` |
|----------|--------|-------------------------------|
| Backend daemons, a few flags | manual `std::env::args` | +5 KB |
| User-facing CLIs with subcommands (fuz, xtask) | **argh** | +16 KB |
| Needs env-var binding, shell completions, or `wrap_help` | clap (`derive`) | +340 KB |

Default is **manual** for daemons and **argh** for subcommanded CLIs. argh
is schema-driven (`#[derive(FromArgs)]`) — same mental model as fuz_util's
`args_parse` (Zod). Where a CLI exists in both TS and Rust, align flag
names and aliases (`--port` / `-p`).

Reach for clap only when env-var binding (`#[arg(env = "FUZ_…")]`), shell
completion generation, or terminal-width help wrapping is worth the +340 KB.

Manual daemon shape — `match` on the first arg. The dispatch returns `Result`
so the `main() -> ExitCode` wrapper (§Error Handling) owns exit; no
`std::process::exit` in the async body, no `args[1]` panic:

```rust
#[tokio::main]
async fn run() -> Result<(), CliError> {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("build") => build::cmd_build(&args[2..]).await,
        Some("status") => status::cmd_status(&args[2..]).await,
        _ => Err(CliError::Usage), // wrapper prints usage + exits 2
    }
}
```

Shared input modes: file path, `--content <string>`, `--stdin`.

## Dependencies

Minimal dependency philosophy: prefer the standard library, then the
approved allowlist, before reaching for anything new. Share at the
workspace level (`[workspace.dependencies]`) so member crates pin one
version. New deps need explicit approval.

The approved crate list — crate by crate, with purpose — lives in
./rust-dependencies.md. This section keeps only the lock-hygiene rule,
which is a correctness constraint rather than a catalog entry.

### Lock hygiene

`parking_lot` is the workspace's lock for **sync-only** critical sections
(no poisoning, smaller, faster). Reach for `tokio::sync::{Mutex, RwLock}`
when the section must hold a guard across an `.await`, and `std::sync::*`
only when you specifically need poisoning semantics. A single server often
uses all three deliberately — pick per critical section, not per project.

**Never hold a `parking_lot` or `std::sync` guard across `.await`** — it
blocks the executor thread and risks deadlock. Drop the guard before the
await, or switch to `tokio::sync::*`. See ./rust-perf.md §Async lock hygiene.

## Patterns

### Sidecar Controller / Subprocess Multiplexing (fuz)

`fuz_sidecar` hosts the pattern for managing long-running subprocesses that
multiplex many concurrent requests. The shape:

```rust
// Generic controller, configured per runtime
pub struct SpawnConfig {
    pub runtime: &'static str,          // identifier, e.g. "deno" / "python"
    pub script: &'static str,           // embedded via include_str!
    pub config: Option<&'static str>,   // optional config file content (e.g. deno.json)
    pub tools: &'static [ToolDef],      // tools this runtime exposes ({name, description})
    pub build_command: fn(script: &Path, config: Option<&Path>) -> Command,
}

// Per-request flow inside SidecarController:
// 1. Allocate a request ID
// 2. Park a oneshot::Sender<Result<Value, _>> in a HashMap keyed by ID
// 3. Send a WireRequest over the child's stdin
// 4. Reader task parses WireResponses line-by-line, looks up ID, fires oneshot
// 5. Caller awaits the oneshot::Receiver

pub struct SidecarController {
    pending: HashMap<u64, oneshot::Sender<Result<Value, SidecarError>>>,
    // zap for outbound requests, child process handle, etc.
}
```

Key design choices worth lifting to similar systems:

- **Function pointers in `SpawnConfig`** instead of trait objects — zero-cost,
  no allocation per spawn. Works because runtime configs are statically known
  at compile time.
- **JSON-lines framing**: one JSON object per line over stdin/stdout. Simple
  to parse with `tokio::io::AsyncBufReadExt::lines()`, no length prefixes,
  trivially debuggable with `tee`.
- **mpsc command channel + oneshot response channel**: callers don't share
  the child's stdin directly; they send `ControllerCommand`s to a serializer
  task that owns the stdin handle. Responses route back via per-request
  `oneshot::channel()`.
- **Embedded script via `include_str!`**: single-binary distribution. The
  script is written to a tempfile at spawn (held alive via `NamedTempFile` for
  the controller's lifetime) and passed to the child as a path argument.

When to use this pattern:

- A long-running subprocess that handles many requests (vs. spawn-per-request)
- The protocol is naturally request/response with correlation IDs
- You want to keep the daemon's address space lean (no embedded runtime)

When to skip it:

- One-shot subprocess invocations — just use `tokio::process::Command`
- Pure in-process work — use a regular `Arc<Mutex<...>>` pool

### Security Patterns

- **Constant-time token comparison** via `subtle::ConstantTimeEq`.
- **TOCTOU-safe file operations**: open with `O_NOFOLLOW`, check permissions
  on the fd, not the path.
- **Secure file permissions**: `0o600` for files, `0o700` for directories.
- **Subprocess env allowlist, not inheritance**: spawn with an explicit
  env map (`PATH`, and only the vars the child needs) rather than letting it
  inherit the parent's environment. Cap the child's output and kill it on
  overrun (`PayloadTooLarge`) so a runaway subprocess can't exhaust memory.
  Stronger than stripping known-sensitive vars after the fact — the child
  starts from nothing.
- **Sandboxed config evaluation**: when config is executable (a TS builder
  run under `deno`), evaluate it in a subprocess with fine-grained
  permission grants — `--allow-read` scoped to the config dir, no
  `--allow-net`/`--allow-env`/`--allow-write`. Pipe the wrapper over stdin
  rather than writing a temp file. The sandbox is the trust boundary for
  untrusted-but-local scripts. This least-privilege posture is specific to the
  **config-eval** context (canonical: `zap`'s `config/eval.rs`). Don't copy it to
  the **long-running runtime sidecar** path (`fuz_sidecar::secure_command` +
  `fuz_deno`), which deliberately grants a broader set (`--allow-env`,
  `--allow-sys`, unscoped `--allow-read`) and writes its embedded script to a
  tempfile by design — different trust context, different posture.

### Transactional state files

State that several invocations mutate (a lock ledger, an intent file) needs
serialization and atomicity, not just careful writing:

- **Advisory file locking** via `nix::fcntl::Flock` serializes concurrent
  writers to the same file across processes — acquire the lock before
  read-modify-write.
- **Atomic temp + rename**: write the new contents to a sibling tempfile,
  then `rename` over the target. A reader never sees a half-written file,
  and a crash mid-write leaves the old version intact.

The canonical implementation is `fuz_sys::fs::write_atomic` (write
`.<name>.tmp.<pid>` → `sync_all` → rename → **fsync the parent dir**); its doc
notes it "replaces ~five hand-rolled copies." Use it rather than re-rolling the
dance. The **parent-dir fsync** is required for *authoritative, non-regenerable*
state (lock ledgers, credentials, secure files — see also
`fuz_sys::secure_file`) and is deliberately **waived** for content-addressed
CAS bodies (a torn write is caught by re-hashing on read) and for ephemeral
regenerable run-state (`daemon.json`). State the choice when you skip it, so a
reviewer can tell a deliberate omission from a bug. For the lock itself, follow
`fuz_sys::file_lock`'s rule: `flock` locks the *inode*, so lock a stable
sidecar path and **never unlink on release** (truncate-but-keep-dirent) — else
two acquirers end up holding different inodes.

### Content-addressed storage with size-based routing

For a store of immutable blobs keyed by content hash (`blake3`), route by
size rather than picking one backend:

- Small blobs (below an embed threshold, e.g. 1 MiB) live inline in the
  database row — one round trip, transactional with their metadata.
- Large blobs spill to disk at `<root>/<hash>/content` via the atomic
  temp+rename above; the row stores a `file:<hash>` pointer.
- **Verify on read** for the external path (re-hash, treat a mismatch as
  unavailable); the inline path trusts the database as authoritative.
- Idempotent writes: content-addressed filenames plus `INSERT … ON CONFLICT
  (hash) DO NOTHING` make a re-store a no-op, not a duplicate.

### Bounded reads / size guards

A recurring (currently undocumented) pattern across the workspace: never read an
untrusted-size input unbounded.

- **For files**: preflight the reported size, then read with a `+1` cap so a
  file that grew between `stat` and read is still rejected rather than silently
  truncated — `take(MAX + 1)` and treat `len > MAX` as an error
  (`fuz_sys::secure_file::load_secure_file`, `fuz_artifact`'s `meta_file`
  `read_checked`).
- **For streams** (HTTP bodies, subprocess output): enforce a byte counter
  mid-stream and abort-on-overrun — a `Content-Length` header is a hint, not a
  bound (`fuz_forge`'s `stream_to_storage`, `fuz_storage`'s forge backend; the
  `drain_capped` in the `fuz_subprocess` candidate). Unlink any partial output
  on overrun.

The scattered per-subsystem size caps (each crate's own "10 GiB"-style limit)
are a consolidation target — centralize them rather than re-declaring per crate.

### Type State (compile-time state machines)

When a value progresses through states (parse → validate → authorize, or
unauthenticated → authenticated → closed), encode the state in the type so
calling a method in the wrong phase is a compile error, not a runtime check.
A **correctness** pattern, not a performance one — the removed `if authenticated`
branch was well-predicted; the win is that invalid sequences become
unrepresentable.

The real in-codebase shape is the **consuming transition**, not `PhantomData<S>`:
zap's `SecretRegistry::freeze(self) -> SecretMasker` makes "mask before the
registry is frozen" unrepresentable by moving the value into the next type. No
spine crate uses the `PhantomData<S>` form today — reach for it only when one
value must thread several states through a generic API; otherwise a consuming
method returning the next concrete type is enough.

Fits: ActionSpec-shaped dispatch (parse → auth → validate → dispatch), builders
where `.build()` before required fields should fail to compile, connection
lifecycles. Skip when states are data-driven (use a runtime enum), only one
transition exists, or the API must stay ergonomic for casual callers (type-state
leaks into every signature and error message).

### Logging

**Servers** (zzz_server): `tracing` with `tracing-subscriber` for structured
logging. axum integrates with `tracing` natively. Use `tracing::info!`,
`tracing::error!`, etc.

**CLIs / daemons** (`fuz`, `fuzd`): `eprintln!` — simple, no framework.
Batched request logging for performance; `--json` for machine-readable output.

## Spine Consumers, Env Loading & Daemon Lifecycle

Cross-repo conventions for the HTTP-server spine consumers (`zzz_server`,
`fuz_forge_server`, the test-only `testing_spine_stub`) and the CLI binaries.

### Server lifecycle (`run_app`)

Each consumer server exposes `pub async fn run_app(options: RunAppOptions)` —
one entry point that both the production `main.rs` and the sibling
`testing_*_server` binary call, differing only in the injected options. The
shared swap points:

- `password_hasher: Arc<dyn PasswordHasher>` — production Argon2id vs the test
  fast hasher (`fuz_testing::TestingArgon2idHasher`),
- `extra_action_specs_factory` — lets the test binary register `_testing_*`
  actions without `fuz_testing` entering the production dep graph,
- `pre_migration_hook` — test-only DB setup.

The `run_app` *body* is genuinely consumer-specific (domain App, migration set,
action-spec composition all differ) and is **not** a shared helper. But the two
boxed-closure shapes — `ExtraActionSpecsFactory<App>` and `PreMigrationHook<E>`,
plus the `ExtraActionSpecsRuntime` POD struct (its four fields —
`password_hasher`/`keyring`/`daemon_token_state`/`session_cookie_name` — are all
`fuz_auth` types) — are verbatim across consumers and live in
`fuz_actions::consumer_lifecycle`, generic over `App` and the error `E`, kept
generic so `fuz_testing` never enters the spine. (They belong in `fuz_actions`,
**not** `fuz_http::lifecycle` where the signal/drain helpers live: `fuz_http`
depends on no spine crate, so it can't name `fuz_auth` types or
`fuz_actions::ActionSpec`. Each consumer instantiates the generics with a
one-line concrete alias — `pub type ExtraActionSpecsFactory =
fuz_actions::ExtraActionSpecsFactory<handlers::App>;` — which is its own type
definition, not a re-export shim.) Align the `RunAppOptions` field vocabulary
across consumers (prefer a `SocketAddr` bind over `u16`+hardcoded-loopback;
always carry `drain_timeout`); `force_test_actions` is a legitimately
consumer-specific field.

`DEFAULT_DRAIN_TIMEOUT` belongs beside `fuz_http::serve_with_shutdown`, not
copied per consumer. The daemon-token keeper-resolved wiring
(`BootstrapKeeperResolved` adapter + the boot-time `query_keeper_account_id`
block) is spine-owned — provide it as a `fuz_auth` constructor/helper, don't
re-implement it in each consumer.

**JSON-RPC error envelope is `fuz_http`'s, period.** `fuz_http` owns the
constructors (`invalid_params(detail, reason)`, `internal_error`,
`internal_error_with_source`, `not_found`, `conflict`, `forbidden`,
`validation_error`, `rate_limited`) and the typed-params helper
`parse_params<T: DeserializeOwned>`. Consumers
must import these, never re-declare them — the wire envelope is what the
cross-backend parity tests assert byte-for-byte, and a local copy drifts (zzz's
re-implemented `invalid_params` dropped the spine's `reason` arg). Prefer typed
`#[derive(Deserialize)]` input structs + `parse_params` over per-field
`params.get().and_then(Value::as_str)` chains.

### Spine server env loading

The HTTP consumers share a boot-env contract; converge it rather than
re-rolling per repo:

- **Injectable seam**: load through `from_vars(get: impl Fn(&str) -> Option<String>)`
  so tests inject a map instead of mutating global process env
  (`fuz_forge_server`'s `FuzForgeEnv::from_vars` is the exemplar). Route *all*
  env reads through this seam — don't leave stray `std::env::var` calls in router
  code that bypass it.
- **Eager fail-loud validation** for security-consequential vars: an empty
  `FUZ_ALLOWED_ORIGINS` (empty allowlist = allow-all) and a malformed
  trusted-proxy list must return a `Config` error and **refuse to boot**, never
  warn-and-continue. This is the *"fail loud, not just fail closed"* rule. A
  failed `ActionRegistry::compile()` must likewise refuse to boot, not fall back
  to an empty registry (which silently answers `method_not_found` to everything).
- **Booleans** go through the shared `fuz_sys::env::parse_stringbool` (the
  `z.stringbool()`-shaped truthy/falsy closed set; an unknown value errors so a
  typo can't silently flip a feature). Don't re-declare it per crate.
- **Secret-shaped env names** follow the canonical `SECRET_*` prefix; keep that
  contract single-sourced across TS (`fuz_app` `BaseServerEnv`) and Rust.

### Daemon lifecycle — two layers

1. **Server-side graceful shutdown is shared** via `fuz_http::lifecycle`
   (`shutdown_token` + `serve_with_shutdown`), consumed by `zzz_server` and
   `fuz_forge_server`. The transport-free signal→`CancellationToken` half is
   single-sourced in `fuz_sys::signal` (behind the `signal` feature, which
   pulls tokio); `fuzd` (UDS, no axum) calls it directly and
   `fuz_http::lifecycle::shutdown_token` re-exports it, so the SIGINT/SIGTERM
   select lives in exactly one place. This was the forcing case for splitting
   the old `fuz_common` into **`fuz_sys`** (generic OS/system leaf) +
   **`fuz_home`** (the `~/.fuz` layer): the HTTP spine must be able to share the
   primitive without inheriting fuz's home conventions, so the shared signal
   helper lives in the home-agnostic leaf, and `fuz_http` deps `fuz_sys`, never
   a crate carrying `~/.fuz` paths.
2. **Client-side CLI lifecycle splits by transport.** `fuzd`'s UDS lifecycle
   lives in `fuz_daemon` (`socket_path` schema, `Hello`-based health, pulls
   `fuz_client`). An HTTP-server CLI manager (today only `zzz`'s) uses the
   port-based `DaemonInfo { version, pid, port, started, app_version }` schema
   (shared with `fuz_app` TS) and a `reqwest` `/health` probe. **Rule: reuse the
   shared primitives** — `fuz_sys::{pid::{is_pid_alive, send_signal},
   rfc3339_now, fs::write_atomic, SECURE_FILE_MODE}` plus `fuz_home::{daemon::*,
   rotate_logs, verify_pid_is_fuzd, the lifecycle constants}` — rather than
   re-deriving them (zzz's CLI now routes through `fuz_sys`; it formerly
   re-derived all of them, including a hand-rolled civil-from-days ISO
   timestamp). The HTTP lifecycle **must never enter the
   `fuz`/`fuzd` dependency graph** (`reqwest`; `check-release` already forbids
   `fuz_daemon`/`fuz_client` from `fuz`). Don't build a transport-generic
   lifecycle crate for a single consumer — extract only when a second HTTP CLI
   daemon-manager actually appears (a systemd-managed foreground server like
   `fuzfd` is **not** one — it has no client-side daemon lifecycle).

Model daemon liveness as a `DaemonState` enum (`Running(info)` / `Stopped` /
`Stale(info)`, plus a `Wedged(info)` arm for the HTTP "pid alive, `/health`
silent" case) with a single `get_daemon_state()` resolver — not scattered
`pid_alive` + `healthy` boolean pairs handled differently per command.
`fuz_daemon` (UDS) and zzz's CLI (HTTP) each carry their own such enum +
resolver — separate by transport, since there's only one HTTP-CLI
daemon-manager (don't build a transport-generic lifecycle crate for it).

### xtask & `check-release`

Every workspace's `xtask` wraps the shared dep-graph audit; don't hand-roll it:

- `fuz_audit::xtask_main()` — a complete single-subcommand xtask (used by
  `fuz_forge`'s 3-line `main`).
- `fuz_audit::run_check_release_cli()` — call from a workspace that has its own
  subcommand router (used by `zzz` + the `fuz` workspace, which add `dev`/
  `dev-setup`/`prod-setup`/etc.).
- `check_release_with` / `check_release_with_rules` — extension points for
  per-workspace extra-forbidden crates (the `fuz` workspace adds `fuz_sign`) and
  per-binary forbids (`fuz`/`fuzd` must not link `fuzi_*`).

The `[package.metadata.fuz_audit] dev_only = true` stanza on the xtask crate is
the **one piece of xtask config that is irreducibly per-repo** (it can't be
workspace-inherited). See ./rust-dependencies.md §Crate-vs-feature isolation for
why the forbidden crates are crates, not features.

### CLI flag & error conventions

- **Dry-run posture is intentional per tool**: convergence/deploy tools default
  to dry-run with an opt-in execute flag (`zap --wetrun`); build/prune tools
  default to execute with an opt-in `--dry-run` preview (`fuz`). The env-file
  flag is **hyphenated** `--env-file` (argh's default rendering) — don't
  introduce `--env_file`.
- **Exit codes**: prefer `fn main() -> ExitCode` with `exit_code(&self) -> u8`
  (zap's shape — can't represent the `>255`/negative codes raw `i32` allows, and
  avoids `std::process::exit`). Reserve `1` for generic failure, `2` for
  config/usage; `fuzi`'s sysexits codes (64/65/70/74) are a sanctioned exception
  for agent-consumable CLIs.
- **`HintMessage`** (`Static(&'static str) | Owned(String)`) is the shared CLI
  hint primitive — it lives in `fuz_sys::cli`, imported by every CLI that needs
  the interpolated case, not re-declared per binary. Hint strings carry *advice
  only* — the print site owns the `hint:` label; don't embed `"hint:"` inside the
  string.
- **Classifier verbs**: see §Error Handling conventions. They land where a
  consumer branches (today: `DbError` + the binary CLI errors).

### Pushing a unifying newtype all the way through

When you introduce a unifying newtype to retire primitive drift, push it through
the **wire/persistence shapes**, not just the compute helper — otherwise the
`String` (or `bool`) it was meant to retire survives at the boundary.
`fuz_crypto::ContentHash` exists to end `==`-vs-`ct_eq` bare-hex drift and the
forge's `FactHash` adopted it end-to-end, but the distribution crates still carry
bare-hex `String` in their manifest/meta fields and compare with `!=`. When the
wire format is fixed (a signed manifest), add a per-field serde adapter that
serializes the newtype to the legacy primitive (bare hex) so existing
signatures stay valid — keep the newtype as the in-memory carrier.

The same shape applies to closed sets that must serialize to a primitive wire
value: `fuz_http`'s `JsonrpcErrorCode` is a `#[repr(i32)]` enum with
`as_i32()`/`TryFrom<i32>` and a hand-written `Serialize` that emits the bare
`i32` the wire contract requires — not scattered `pub const … : i32`. Because
`JsonrpcError.code` is the enum (not an open `i32`), `error_code_to_http_status`
is an *exhaustive* match with no catch-all, so a new code is a compile error
there rather than a silent 500. `Display` renders the numeric code so the
`thiserror` envelope message is unchanged. The closed enum stays strictly more
capable than the consts for emit-only use; if a future deserialize path needs to
accept off-contract upstream codes, an `Other(i32)` catch-all is a non-breaking
add (and `TryFrom<i32>` already gives that boundary a non-panicking failure).

## Documentation

Doc comments (`///`) for public API; inline comments (`//`) for
implementation notes. `// TODO:` is the standard marker for known future
work — see §Core Values. Each project's `CLAUDE.md` has detailed conventions.
