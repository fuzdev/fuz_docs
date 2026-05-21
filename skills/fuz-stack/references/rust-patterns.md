# Rust Patterns for the Fuz Ecosystem

**Applies to**: Rust workspaces across the ecosystem — CLIs and daemons
(`fuz`, `fuzd`), WASM bindings (`blake3`), web servers (`zzz_server`).
All use **Rust edition 2024**, resolver 2.

Each project's `CLAUDE.md` is authoritative for project-specific conventions.
This covers shared patterns.

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
- **Crate-level overrides**: FFI and binding crates (`fuz_pty`,
  `blake3_component`, and any N-API/C-FFI/wit-bindgen layer) override
  `unsafe_code = "allow"` because Cargo doesn't allow partial overrides —
  they duplicate workspace lints. `blake3_component` also allows
  `same_length_and_capacity` and `use_self` (false positives from
  wit-bindgen generated code).

Each crate opts in with `[lints] workspace = true`.

## Release Profile

```toml
[profile.release]
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

Slower builds (~2x), no symbol names in backtraces. Worth it for binary size
and performance.

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

// Central error handling in main()
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(hint) = e.hint() {
            eprintln!("{hint}");
        }
        std::process::exit(e.exit_code());
    }
}
```

### Helper methods (fuz)

```rust
impl CliError {
    pub fn hint(&self) -> Option<HintMessage> { ... }  // User-facing fix suggestion
    pub fn exit_code(&self) -> i32 { ... }             // Process exit code
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
  (`CliError`), or `&'static str` with `""` for absent when all do
  (`ClientError`). `HintMessage` (`Static | Owned`) handles the mixed case
  where some hints interpolate runtime data (a PID, a path) and others are
  pure constants.
- `.exit_code()` returns `i32`; reserve 1 for generic failure, 2+ for
  category-specific (e.g., auth/token errors). Match arms over variants.
- `.is_transient()` / `.is_recoverable()` answer "should the caller retry or
  restart?". Pure inspection, no side effects.
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
for shutdown coordination. The pattern is consistent across `fuz_server`,
`fuzd`, and `zzz_server`.

### Shutdown token threading

A single `CancellationToken` owned at the top level. Clone it into every task
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

axum integrates with `CancellationToken` directly. The server stops accepting
new connections when the token fires, but lets in-flight requests finish:

```rust
// fuz_server/src/lib.rs
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
token via `tokio::select!`. The fuz_server log flusher uses `Notify` for
event-driven wakeups rather than a fixed interval — flushes are debounced
behind the most recent log call, so an idle daemon doesn't tick uselessly:

```rust
// fuz_server/src/logging.rs — notify-driven flush task
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

`tokio_util::task::TaskTracker` is for waiting on a known set of spawned
tasks to finish. Use it when shutdown needs to verify "all worker tasks
exited cleanly" before the process exits. Skip it when the task is
short-lived or owned by an `Arc`-shared component that drops naturally.

### Don't use

- `std::process::exit()` from inside async code — bypasses Drop, leaks
  file descriptors, skips graceful shutdown.
- Bare `tokio::spawn` with no shutdown awareness for anything that holds
  resources (sockets, child processes, file handles).
- `tokio::sync::broadcast` as a poor-man's cancellation token. Use
  `CancellationToken` — it's purpose-built and composes via `.clone()`.

## Naming Conventions

Standard Rust (`snake_case` / `PascalCase` / `SCREAMING_SNAKE_CASE`). Free
functions use natural Rust naming — not the domain-first `domain_action`
style of this stack's TypeScript code (see SKILL.md). `fn parse(...)`,
`fn create_artifact(...)` — not `fn artifact_create(...)`.

## Idioms

Style guidance the lint config encodes (`clone_on_ref_ptr`, `panic`,
`unwrap_used` warn). Ecosystem-specific bits are called out with examples.

### Prefer enums for closed sets

Fixed variant sets → enum, not `bool` or sentinel string. The exhaustiveness
check turns every `match` into a contract that fires when variants change.

```rust
// Yes — exhaustive, named
pub enum AuditOutcome { Success, Failure }

// No — `bool` carries no name for what `true` means here
let success: bool = ...;
let kind: &str = "failure"; // typo-prone, no compiler help
```

### Zero-cost / low-cost abstractions

Three patterns recur across the ecosystem:

**Function pointers over trait objects** for statically-known dispatch.
`fuz_sidecar::SpawnConfig` holds `build_command: fn(&Path, Option<&Path>)
-> Command` instead of `Box<dyn Fn(...)>` — no allocation, inlinable.

**Callback resolution over allocating accessors** in hot paths. For interned
data or pooled resources, expose both an allocating accessor for one-off
lookups and a callback form for tight loops:

```rust
let owned: String = printer.resolve_symbol(sym);        // allocates
printer.with_resolved_symbol(sym, |s| out.push_str(s)); // zero-alloc
```

**`Cow`-shaped wrappers** when some returns are pure constants and others
need interpolation. `HintMessage` (`Static(&'static str) | Owned(String)`)
keeps the constant case allocation-free — same idea as `Cow<'static, str>`,
spelled out where API clarity matters more than terseness.

### Avoid clone smells

The `clone_on_ref_ptr` lint warns on `arc.clone()` — the workspace policy
is to use `Arc::clone(&arc)` instead, so the call site signals a refcount
bump rather than a deep copy. Other guidance:

- **Don't clone to satisfy a borrow.** Take `&T` or `&str`. A function that
  takes `String` when it only needs `&str` forces every caller to allocate.
- **Don't clone large collections just to pass them** — take `&[T]` or
  `&HashMap<K, V>`. Small, short-lived collections aren't worth Arc-wrapping
  to dodge a single clone.

Rough preference for inputs: `&str` >> `String`. Same shape for collections
(`&[T]` >> `Vec<T>`). Reach for `Cow<'_, str>` only when callers genuinely
have mixed-ownership data and the borrowed case is common — otherwise the
cleverness isn't worth it.

## Dependency Injection

The TS `*Deps` discipline doesn't translate 1:1 — much of what TS solves
with DI (runtime agnosticism, module mocking, capability bundles in
signatures, deterministic clocks) Rust solves natively with the crate
graph, trait bounds, monomorphization, test crates, and tokio's mock
clock. Treat the pattern as an **escalation ladder**: start at the
floor, climb a rung only when a concrete need requires it.

### Active rungs

**Floor — just import and call.** Pure utilities (crash-safe fs helpers,
canonical JSON, parsers, validators, formatters, stateless helpers)
don't enter the pattern at all. Import and call. Rust's modules + `use`
+ monomorphization are the DI for these cases; reaching for a trait or
accessor adds ceremony with no win.

**Default — concrete `*Options` struct + direct refs.** When a function
operates on state owned by the app (keyring, pool, audit emitter), pass
that state as a ref via a per-call-site `*Options` struct (or
`*RouteState` for route-group-shared state) holding `Arc<T>` fields:

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
(`zzz_server::App`, `zap_server::App`, ...), a composite trait per tier
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
storing struct, no generic plumbing) — that's a separate axis that
sometimes justifies it on a hot path too.

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

The annotation tells future contributors *why* they can't add a
generic method (or that they can). See the canonical spec for the
dual-variant `*` + `*Dyn` companion pattern when both dispatch shapes
are load-bearing.

### Test injection — concrete impls in a separate crate

Test-only crates ship alternate impls satisfying the production traits.
Tests construct the app with the test impl plugged in; no `cfg(test)`
shadows, no runtime branches in production. A release-time dep-graph
audit (e.g. an `xtask check-release` step) gates that no production
binary transitively depends on test crates.

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

- **Clock**: tokio's `#[tokio::test(start_paused = true)]` + `tokio::time::advance(...)` already gives deterministic control over `Instant::now()` and `sleep_until` for anything in `tokio::time`. A `Clock` trait would wrap something tokio already abstracts — skip it. Reach for one only if a non-tokio consumer needs determinism.
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
│   └── {proj}_wasm/    # Interface crates: WASM, FFI, N-API
├── tests/              # Integration tests (where applicable; fuz uses unit tests)
│   └── fixtures/       # Test fixtures (if applicable)
└── docs/               # Architecture and reference documentation
```

Crate naming: generally `{project}_{crate}` (`fuz_common`,
`blake3_wasm_core`). Exceptions: fuz's CLI is just `fuz` (not `fuz_cli`) and
its daemon is `fuzd` (not `fuz_daemon`) — short names for frequently-typed
commands.

### Common crate patterns

- **Foundation crate**: Shared types (Span, errors, config) with minimal deps
  (`fuz_common`, `blake3_wasm_core`)
- **Feature crates**: Domain logic with `lib.rs` public API
- **Debug crate**: Dev tooling, may embed external runtimes (Deno sidecars)
- **Interface crates**: Binding layers (CLI, C FFI, N-API, WASM)
- **xtask crate**: Dev automation (`cargo xtask install`), used by fuz

## Build Configuration

### build.rs

- **Git version embedding** (fuz, fuzd): `cargo::rustc-env=FUZ_GIT_INFO={hash}`
- **Compile-time data** (fuz_crypto): Parse/validate public keys, generate
  constants
- **Target triple** (fuz_release): `cargo:rustc-env=TARGET={triple}`

### xtask pattern (fuz)

```bash
cargo xtask install              # Build, install to ~/.fuz/, restart daemon
cargo xtask install --new-token  # Regenerate auth token
cargo xtask clean                # Remove ~/.fuz/, stop daemon
```

### Environment configuration (fuz)

fuz separates **dev config** from **prod config** by source:

| Source                  | Sets                | Read by                  | Notes                              |
| ----------------------- | ------------------- | ------------------------ | ---------------------------------- |
| `.cargo/config.toml`    | `FUZ_PORT`          | `cargo run` / `cargo test` | Checked in. Dev port (3621) only |
| `~/.fuz/config/env`     | `FUZ_PORT`, `FUZ_AUTH_TOKEN` | User shells (sourced)  | Generated by `cargo xtask install` |
| systemd / Docker / etc. | `FUZ_AUTH_TOKEN`    | prod daemon              | Never sourced from `~/.fuz/config/env` in prod |

```toml
# .cargo/config.toml
[env]
FUZ_PORT = "3621"    # Dev port override (avoids conflict with prod port 3620)

[alias]
xtask = "run --package xtask --"
```

**Rule: `.cargo/config.toml` does NOT set `FUZ_AUTH_TOKEN`.** Tokens are
secrets — they don't belong in a checked-in file, and they shouldn't be
silently inherited by every `cargo run` invocation. Dev tokens live in
`~/.fuz/config/env` (gitignored, mode 0600); prod tokens come from
systemd/Docker/secrets infrastructure.

This pattern generalizes: anything in `.cargo/config.toml` should be a
**non-secret dev override**. Anything secret or environment-dependent
goes in a generated, gitignored config file.

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

Manual daemon shape — `match` on the first arg in `main.rs`:

```rust
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e}");
        if let Some(hint) = e.hint() {
            eprintln!("{hint}");
        }
        std::process::exit(e.exit_code());
    }
}

#[tokio::main]
async fn run() -> Result<(), CliError> {
    let args: Vec<String> = std::env::args().collect();
    match args[1].as_str() {
        "build" => build::cmd_build(&args[2..]).await,
        "status" => status::cmd_status(&args[2..]).await,
        _ => { print_usage(); std::process::exit(1); }
    }
}
```

Shared input modes: file path, `--content <string>`, `--stdin`.

## Dependencies

Minimal dependency philosophy. Prefer workspace-level sharing. No new deps
without explicit request.

### Shared

| Crate                              | Purpose            | Used by                            |
| ---------------------------------- | ------------------ | ---------------------------------- |
| `serde`, `serde_json`              | Serialization      | fuz, zzz_server (blake3 bench crate only) |
| `thiserror`                        | Error derivation   | fuz, zzz_server                    |
| `tracing`, `tracing-subscriber`    | Structured logging | fuz, zzz_server                    |

### Domain-specific

**Async / networking** (fuz, zzz_server):

| Crate         | Purpose                          |
| ------------- | -------------------------------- |
| `tokio`       | Async runtime                    |
| `axum`        | HTTP server (built on hyper)     |
| `reqwest`     | HTTP client (fuz_client, fuz_storage, zzz_server) |
| `tokio-util`  | CancellationToken, TaskTracker   |
| `parking_lot` | **Default** for `Mutex`/`RwLock` (sync, no poisoning) |

Use `std::sync::*` only when you need poisoning semantics, and
`tokio::sync::*` only when the critical section needs to `.await`.

**Never hold a `parking_lot` or `std::sync` guard across `.await`** — it
blocks the executor thread and risks deadlock. Drop the guard before the
await, or switch to `tokio::sync::*`. See ./rust-perf.md §Async lock hygiene.

**Database** (zzz_server):

| Crate                | Purpose                        |
| -------------------- | ------------------------------ |
| `tokio-postgres`     | Async PostgreSQL client        |
| `deadpool-postgres`  | Connection pooling             |

**Auth / crypto**:

| Crate           | Purpose                                                | Used by    |
| --------------- | ------------------------------------------------------ | ---------- |
| `blake3`        | Content-addressed artifacts, session-token hashing     | fuz, zzz   |
| `ed25519-dalek` | Signing/verification                                   | fuz        |
| `subtle`        | Constant-time comparison                               | fuz        |
| `zeroize`       | Secure memory clearing                                 | fuz        |
| `argon2`        | Password hashing (with `rand` feature)                 | zzz_server |
| `hmac`, `sha2`  | HMAC-SHA256 for signed cookies / keyring               | zzz_server |
| `base64`        | URL-safe base64 for tokens                             | zzz_server |

**Filesystem / OS** (zzz_server):

| Crate    | Purpose                                                      |
| -------- | ------------------------------------------------------------ |
| `notify` | File system watching (FSEvents on macOS, inotify on Linux)   |

**WASM / JS bindings**:

| Crate                 | Purpose                                            |
| --------------------- | -------------------------------------------------- |
| `wasm-bindgen`        | JS interop (wasm-pack)                             |
| `serde-wasm-bindgen`  | Serde bridging at the JS boundary                  |
| `wit-bindgen`         | Component model (blake3)                           |
| `napi`, `napi-derive` | Node.js/Bun N-API bindings                         |

See ./wasm-patterns.md for build targets, WIT design, and optimization
profiles.

**CLI / arg parsing** (opt-in per binary):

| Crate       | Purpose                                  | Used by         |
| ----------- | ---------------------------------------- | --------------- |
| `argh`      | Derive arg parser, optimized for size    | fuz CLI, xtask  |
| `pico-args` | Minimal argv parser, no help generation  | (fallback only) |

Backend daemons use manual `std::env::args()` (no dep). See §CLI Patterns.

## Patterns

### Sidecar Controller / Subprocess Multiplexing (fuz)

`fuz_sidecar` hosts the pattern for managing long-running subprocesses that
multiplex many concurrent requests. The shape:

```rust
// Generic controller, configured per runtime
pub struct SpawnConfig {
    pub build_command: fn(script: &Path, config: Option<&Path>) -> Command,
    pub script: &'static str,           // embedded via include_str!
    pub tools: &'static [&'static str], // tool names this runtime exposes
}

// Per-request flow inside SidecarController:
// 1. Allocate a request ID
// 2. Park a oneshot::Sender<Result<Value, _>> in a HashMap keyed by ID
// 3. Send a WireRequest over the child's stdin
// 4. Reader task parses WireResponses line-by-line, looks up ID, fires oneshot
// 5. Caller awaits the oneshot::Receiver

pub struct SidecarController {
    pending: HashMap<u64, oneshot::Sender<Result<Value, SidecarError>>>,
    // tx for outbound requests, child process handle, etc.
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
  script is written to a tempfile at spawn (held alive via
  `NamedTempFile` for the controller's lifetime) and passed to the child as a
  path argument.

When to use this pattern:

- A long-running subprocess that handles many requests (vs. spawn-per-request)
- The protocol is naturally request/response with correlation IDs
- You want to keep the daemon's address space lean (no embedded runtime)

When to skip it:

- One-shot subprocess invocations — just use `tokio::process::Command`
- Pure in-process work — use a regular `Arc<Mutex<...>>` pool

### Security Patterns (fuz)

- **Constant-time token comparison** via `subtle::ConstantTimeEq`
- **TOCTOU-safe file operations**: Open with `O_NOFOLLOW`, check permissions
  on fd not path
- **Secure file permissions**: `0o600` for files, `0o700` for directories
- **Environment isolation**: Strip sensitive env vars before spawning sidecars

### Type State (compile-time state machines)

When a value progresses through a sequence of states — parse → validate
→ authorize → dispatch, or unauthenticated → authenticated → closed —
encode the state as a type parameter rather than a runtime field. Each
transition consumes the value and returns it under a new state type, so
calling a method in the wrong phase is a compile error, not a runtime
check.

```rust
use std::marker::PhantomData;

pub struct Unauthenticated;
pub struct Authenticated;

pub struct Session<S> {
    inner: SessionInner,
    _state: PhantomData<S>,
}

impl Session<Unauthenticated> {
    pub fn authenticate(self, token: &str) -> Result<Session<Authenticated>, AuthError> {
        // verify token, then:
        // Ok(Session { inner: self.inner, _state: PhantomData })
    }
}

impl Session<Authenticated> {
    pub fn send(&self, msg: Message) -> Result<(), SendError> { /* ... */ }
}
```

Calling `send()` on `Session<Unauthenticated>` fails to compile — the
method doesn't exist for that state. `PhantomData<S>` is zero-sized;
the compiled binary is identical to a hand-written single-state API.

When it fits:

- ActionSpec-shaped dispatch pipelines (parse → auth → validate →
  rate-limit → dispatch → respond): each phase produces a typed handle
  the next phase consumes.
- Builder APIs where `.build()` before required fields are set should
  fail to compile, not at runtime.
- Connection / socket lifecycles: `Closed` → `Connecting` →
  `Handshaking` → `Established` → `Closing`.
- Filesystem transaction phases: `Staged` → `Committed` / `RolledBack`.

When to skip it:

- The set of states is dynamic or driven by data — a runtime state
  machine (enum) is clearer and supports collections of mixed states.
- Only one transition exists — the ceremony outweighs the win; a plain
  method that returns the next type is enough.
- The API is meant to be ergonomic for casual callers — type-state
  shows up in every signature and in compiler error messages.

Type-state is primarily a **correctness pattern**, not a performance
pattern. The runtime check it removes (an `if authenticated` branch)
is usually well-predicted and not a hot-path cost. The real win is
that invalid sequences become unrepresentable. Performance wins, when
they exist, are downstream of the optimizer seeing dead branches at
compile time.

### Logging

**Servers** (zzz_server): `tracing` with `tracing-subscriber` for structured
logging. axum integrates with `tracing` natively. Use `tracing::info!`,
`tracing::error!`, etc.

**CLIs / daemons** (`fuz`, `fuzd`): `eprintln!` — simple, no framework.
Batched request logging for performance. `--json` for machine-readable
output.

## Documentation

Doc comments (`///`) for public API; inline comments (`//`) for
implementation notes. `// TODO:` is the standard marker for known future
work — see §Core Values. Each project's `CLAUDE.md` has detailed
conventions.
