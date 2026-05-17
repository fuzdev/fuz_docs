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
- **Performance**: If it's slow, it's a bug.
- **Copious `// TODO:` comments**: Mark known future work, unfinished parts.
- **`todo!()` macro warns**: All projects set `todo = "warn"` — use
  `#[allow(clippy::todo)]` with justification when needed.

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

- `missing_debug_implementations`: "warn" in `fuz`; "allow" where public
  types contain non-Debug fields; not set in `blake3`.
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

Standard Rust — **snake_case + PascalCase**:

```rust
// Functions, variables, modules - snake_case
fn parse_typescript() {}
let source_text = "";
mod ast_builder;

// Types, structs, enums - PascalCase
struct AstNode {}
enum TokenKind {}

// Constants - SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE: usize = 4 * 1024 * 1024 * 1024;
```

Unlike TypeScript's domain-first naming, Rust free functions use natural naming:

```rust
impl Span {
    fn extract<'a>(&self, source: &'a str) -> &'a str { ... }
    fn range(&self) -> Range<usize> { ... }
}

// Free functions - natural Rust naming
fn create_artifact(inputs: &ArtifactInputs) -> Result<ArtifactMeta> { ... }
fn parse(source: &str) -> Result<Program> { ... }
fn format(program: &Program, source: &str) -> String { ... }
```

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
`fuz_sidecar::SpawnConfig` holds `command_builder: fn(&Path, Option<&Path>)
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

## Commands

```bash
cargo check --workspace            # Fast syntax check (no codegen)
cargo test --workspace             # Run all tests
cargo clippy --workspace           # Lint
cargo fmt                          # Format
cargo build --workspace            # Debug build
cargo build --workspace --release  # Optimized build
```

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

- `cargo test --workspace` runs all tests
- Unit tests in `#[cfg(test)] mod tests`
- Integration tests in `tests/` where applicable
- See each project's `CLAUDE.md` for specifics

### By project

- **fuz**: Unit tests in modules. Covers error handling, serialization, auth,
  crypto, artifacts.
- **blake3**: TypeScript correctness tests (WASM vs native reference). Rust
  tests for compilation. Component model tested via Wasmtime.

## CLI Patterns

Manual arg parsing (no clap) is the default — keeps binary size and compile
times down. The `fuz` shape is a simple `match` on the first arg in `main.rs`:

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
| `reqwest`     | HTTP client (fuz only)           |
| `tokio-util`  | CancellationToken, TaskTracker   |
| `parking_lot` | **Default** for `Mutex`/`RwLock` (sync, no poisoning) |

Use `std::sync::*` only when you need poisoning semantics, and
`tokio::sync::*` only when the critical section needs to `.await`.

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

## Patterns

### Sidecar Controller / Subprocess Multiplexing (fuz)

`fuz_sidecar` hosts the pattern for managing long-running subprocesses that
multiplex many concurrent requests. The shape:

```rust
// Generic controller, configured per runtime
pub struct SpawnConfig {
    pub command_builder: fn(script_path: &Path) -> Command,
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

### Logging

**Servers** (zzz_server): `tracing` with `tracing-subscriber` for structured
logging. axum integrates with `tracing` natively. Use `tracing::info!`,
`tracing::error!`, etc.

**CLIs / daemons** (`fuz`, `fuzd`): `eprintln!` — simple, no framework.
Batched request logging for performance. `--json` for machine-readable
output.

## Documentation

- **Copious `// TODO:` comments** — expected and valued
- `todo!()` macro: warned by default; allow per-crate with justification
- Doc comments (`///`) for public API
- Inline comments (`//`) for implementation notes

See each project's `CLAUDE.md` for detailed conventions.
