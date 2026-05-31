# Approved Rust Dependencies

The canonical allowlist of external crates approved for Rust workspaces
across the ecosystem. Prefer these; reach outside the list only with
explicit approval (see [§Adding a dependency](#adding-a-dependency)).

**Scope**: the canonical (non-experimental) Rust workspaces — CLIs and
daemons, the WASM bindings, the web servers and their spine crates.
Different-paradigm or pre-canonical repos (games, protocol research) carry
their own deps and are out of scope here.

**Source of truth**: each repo's root `[workspace.dependencies]`. This doc
mirrors the union of those for human and agent audit; it is not generated.
Verify it against the workspaces periodically — an automated audit parses
this list and reports any workspace dep that is missing from it.

Crates internal to a workspace (declared with `path = ...`) are not
dependencies in this sense and never appear here.

## Serialization & encoding

| Crate | Purpose |
| ----- | ------- |
| `serde` | Derive-based serialization framework |
| `serde_json` | JSON |
| `postcard` | Compact binary serialization (`no_std`-friendly) |
| `hex` | Hex encoding/decoding |
| `base64` | URL-safe base64 (tokens) |

## Errors & core utilities

| Crate | Purpose |
| ----- | ------- |
| `thiserror` | Derive typed error enums |
| `futures` / `futures-util` | Async combinators, `BoxFuture` |
| `time` | Date/time |
| `uuid` | UUIDs |
| `semver` | Semantic-version parsing |
| `url` | URL parsing |
| `tempfile` | Temp files/dirs (`NamedTempFile`) |
| `smallvec` | Stack-allocated small vectors |
| `string-interner` | String interning |
| `phf` | Compile-time perfect-hash maps/sets (keyword tables) |
| `unicode-ident` / `unicode-segmentation` / `unicode-width` | Unicode text handling |

## Async runtime & networking

| Crate | Purpose |
| ----- | ------- |
| `tokio` | Async runtime |
| `tokio-util` | `CancellationToken`, `TaskTracker` |
| `axum` | HTTP server (on hyper) |
| `axum-extra` | axum extras (typed headers, cookies) |
| `tower` / `tower-http` | Service middleware |
| `reqwest` | HTTP client |

## Concurrency

| Crate | Purpose |
| ----- | ------- |
| `parking_lot` | `Mutex`/`RwLock` for sync-only critical sections (no poisoning). See rust-patterns.md §Async lock hygiene for when to use `tokio::sync` or `std::sync` instead. |

## Database

| Crate | Purpose |
| ----- | ------- |
| `tokio-postgres` | Async PostgreSQL client |
| `deadpool-postgres` | Connection pooling |

## Crypto & auth

| Crate | Purpose |
| ----- | ------- |
| `blake3` | Content-addressed hashing, token hashing |
| `argon2` | Password hashing |
| `hmac` / `sha2` | HMAC-SHA256 (signed cookies, keyring) |
| `subtle` | Constant-time comparison |
| `zeroize` | Secure memory clearing |
| `getrandom` | OS randomness |
| `rand` | RNG |

## Filesystem & OS

| Crate | Purpose |
| ----- | ------- |
| `nix` | POSIX syscalls (advisory `flock`, permissions) |
| `notify` | Filesystem watching (inotify / FSEvents) |
| `tar` | tar archives |
| `flate2` | gzip / deflate |

## CLI

| Crate | Purpose |
| ----- | ------- |
| `argh` | Derive arg parser, size-optimized. See rust-patterns.md §CLI Patterns for the parser-tier guidance. |

## Logging

| Crate | Purpose |
| ----- | ------- |
| `tracing` | Structured logging |
| `tracing-subscriber` | Subscriber / formatting layers |
| `tracing-appender` | Non-blocking file appender |

## WASM & host

| Crate | Purpose |
| ----- | ------- |
| `wasm-bindgen` | JS interop (wasm-pack) |
| `wit-bindgen` | Component-model bindings |
| `wasmtime` / `wasmtime-wasi` | WASM host (tests, benches) |

See rust-patterns.md §WASM boundary errors and wasm-patterns.md for the
binding-layer conventions these support.

## Adding a dependency

New crates are added deliberately, not incidentally:

- Prefer the standard library, then this list, before anything new.
- A new dependency needs explicit approval — name it, its purpose, what it
  replaces or enables, and its transitive footprint.
- Add it at the workspace level (`[workspace.dependencies]`) so member
  crates share one version, then record it here.
- Removing the last user of a crate? Drop it from the workspace and from
  this list in the same change.
