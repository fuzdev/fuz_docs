# Rust Patterns for the Fuz Ecosystem

**Applies to**: `fuz` (daemon + CLI), `tsv` (parser/formatter), `blake3` (WASM
bindings), `zzz_server` (axum web server). All projects use **Rust edition
2024**, resolver 2.

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

- `missing_debug_implementations`: "warn" in fuz, "allow" in tsv (parser types
  contain non-Debug fields like `Chars`, `RefCell<Interner>`), not set in blake3
- tsv has additional pedantic/nursery allows for parser code:
  `cast_possible_truncation`, `cast_lossless`, `cast_possible_wrap`,
  `wildcard_imports`, `cognitive_complexity`, etc.
- **Crate-level overrides**: `fuz_pty`, `tsv_napi`, and `blake3_component`
  override `unsafe_code = "allow"` (FFI/N-API/wit-bindgen require unsafe).
  These crates duplicate workspace lints since Cargo doesn't allow partial
  overrides. `blake3_component` also allows `same_length_and_capacity` and
  `use_self` (false positives from wit-bindgen generated code).

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

tsv profiling profile:

```toml
[profile.profiling]
inherits = "release"
debug = true
strip = false
```

## Error Handling

### fuz and tsv: `thiserror` for typed errors

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

### Context enrichment (tsv)

```rust
parser.parse().map_err(|e| e.with_context(source))
// Adds line/column info + source snippet with caret pointer
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

For component model errors, see `references/wasm-patterns.md`.

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
├── tests/              # Integration tests (tsv only; fuz uses unit tests)
│   └── fixtures/       # Test fixtures (if applicable)
└── docs/               # Architecture and reference documentation
```

Crate naming: generally `{project}_{crate}` (`fuz_common`, `tsv_lang`,
`blake3_wasm_core`). Exceptions: fuz's CLI is just `fuz` (not `fuz_cli`) and
its daemon is `fuzd` (not `fuz_daemon`) — short names for frequently-typed
commands.

### Common crate patterns

- **Foundation crate**: Shared types (Span, errors, config) with minimal deps
  (`fuz_common`, `tsv_lang`, `blake3_wasm_core`)
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
- **HTML entity tables** (tsv_html): `phf::Map` via `phf_codegen`
- **N-API build** (tsv_napi): `napi-build` bindings boilerplate

### xtask pattern (fuz)

```bash
cargo xtask install              # Build, install to ~/.fuz/, restart daemon
cargo xtask install --new-token  # Regenerate auth token
cargo xtask clean                # Remove ~/.fuz/, stop daemon
```

### .cargo/config.toml (fuz only)

```toml
[env]
FUZ_PORT = "3621"    # Dev port override (avoids conflict with prod port 3620)

[alias]
xtask = "run --package xtask --"
```

Does NOT set `FUZ_AUTH_TOKEN`. Dev config comes from `~/.fuz/config/env`,
generated by `cargo xtask install`.

## Testing

- `cargo test --workspace` runs all tests
- Unit tests in `#[cfg(test)] mod tests`
- Integration tests in `tests/` (tsv only)
- See each project's `CLAUDE.md` for specifics

### By project

- **tsv**: Fixture-based TDD with Deno for canonical comparison against
  Prettier and Svelte's parser. Integration tests in `tests/`.
- **fuz**: Unit tests in modules. Covers error handling, serialization, auth,
  crypto, artifacts.
- **blake3**: TypeScript correctness tests (WASM vs native reference). Rust
  tests for compilation. Component model tested via Wasmtime.

## CLI Patterns

Both fuz and tsv use manual arg parsing (no clap) for binary size and compile
times.

**fuz** — simple match in `main.rs`:

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

**tsv** — `CommandRegistry` with trait objects and shared input modes:

```rust
fn main() {
    let registry = cli::build_registry();
    registry.run(args);
}
```

Both share input modes: file path, `--content <string>`, `--stdin`.

## Dependencies

Minimal dependency philosophy. Prefer workspace-level sharing. No new deps
without explicit request.

### Shared

| Crate                              | Purpose            | Used by                            |
| ---------------------------------- | ------------------ | ---------------------------------- |
| `serde`, `serde_json`              | Serialization      | fuz, tsv, zzz_server (blake3 bench crate only) |
| `thiserror`                        | Error derivation   | fuz, tsv, zzz_server               |
| `tracing`, `tracing-subscriber`    | Structured logging | fuz, zzz_server                    |

### Domain-specific

**Async / networking** (fuz, zzz_server):

| Crate         | Purpose                        |
| ------------- | ------------------------------ |
| `tokio`       | Async runtime                  |
| `axum`        | HTTP server (built on hyper)   |
| `reqwest`     | HTTP client (fuz only)         |
| `tokio-util`  | CancellationToken, TaskTracker |
| `parking_lot` | Faster mutex (no poisoning)    |

**Database** (zzz_server):

| Crate               | Purpose                        |
| -------------------- | ------------------------------ |
| `tokio-postgres`     | Async PostgreSQL client        |
| `deadpool-postgres`  | Connection pooling             |

**Parsing** (tsv):

| Crate                | Purpose                             |
| -------------------- | ----------------------------------- |
| `smallvec`           | Stack-allocated vectors             |
| `string-interner`    | String interning for AST            |
| `phf`                | Compile-time perfect hash maps      |
| `unicode-ident`      | XID_Start/XID_Continue              |
| `unicode-segmentation` | Grapheme cluster iteration        |
| `unicode-width`      | Visual width calculation            |

**Crypto / hashing** (fuz):

| Crate           | Purpose                      |
| --------------- | ---------------------------- |
| `blake3`        | Content-addressed artifacts  |
| `ed25519-dalek` | Signing/verification         |
| `subtle`        | Constant-time comparison     |
| `zeroize`       | Secure memory clearing       |

**WASM** (blake3, tsv):

| Crate          | Purpose                     |
| -------------- | --------------------------- |
| `wasm-bindgen` | JS interop (wasm-pack)      |
| `wit-bindgen`  | Component model (blake3)    |
| `napi`         | N-API bindings (tsv)        |

See `references/wasm-patterns.md` for build targets, WIT design, and
optimization profiles.

## Patterns

### AST Architecture (tsv)

- **Internal AST**: Clean, semantic. No `serde::Serialize`.
- **Public AST**: Conversion layer matching external JSON output (Svelte's
  parser format).
- Raw strings extracted via `source[span.range()]`, never duplicated.

```rust
// Internal - clean and semantic
struct Literal {
    value: LiteralValue,  // Decoded
    span: Span,
}

// Public conversion - applies quirks at boundary
fn to_json(lit: &Literal, source: &str) -> Value {
    json!({
        "value": lit.value,
        "raw": &source[lit.span.range()],
    })
}
```

### Span Types (tsv)

- **Span**: `u32` for start/end (memory efficient, max 4GB)
- **Lexer/Parser**: `usize` (natural for indexing)
- Convert at boundaries. Helpers: `span.extract(source)`, `span.range()`

### Comment Handling (tsv)

Stored separately in flat `Vec<Comment>` at root. Printer finds comments via
O(log n) binary search on span positions.

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

**CLIs / daemons** (fuz, tsv): `eprintln!` — simple, no framework. Batched
request logging for performance. `--json` for machine-readable output.

## Documentation

- **Copious `// TODO:` comments** — expected and valued
- `todo!()` macro: allowed in tsv, warned in fuz
- Doc comments (`///`) for public API
- Inline comments (`//`) for implementation notes

See each project's `CLAUDE.md` for detailed conventions.
