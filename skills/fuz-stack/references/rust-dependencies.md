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
Verify it against the workspaces periodically.

Crates internal to a workspace (declared with `path = ...`) are not
dependencies in this sense and never appear here.

A few approved crates are pinned at the **member-crate** level rather than
in `[workspace.dependencies]` — `js-sys` (optional, feature-gated in tsv's
`tsv_wasm`) and `rand` (crate-pinned in `fuz_sign` for the `rand_core 0.6`
constraint). They're real external deps and belong here even though no root
`[workspace.dependencies]` lists them.

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
| `rustls` | TLS backend for `reqwest` — installs the `ring` crypto provider as the process default (`reqwest` is wired `rustls-no-provider`) |

## Concurrency

| Crate | Purpose |
| ----- | ------- |
| `parking_lot` | `Mutex`/`RwLock` for sync-only critical sections (no poisoning). See rust-perf.md §Async lock hygiene for when to use `tokio::sync` or `std::sync` instead. |
| `lru` | Bounded LRU cache backing the `RateLimiter` — caps tracked keys so a key-enumeration attacker can't grow the map unboundedly (twin of fuz_app's `LruMap`). |

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
| `ed25519-dalek` | Ed25519 signing/verification (artifact + release signatures) |
| `hmac` / `sha2` | HMAC-SHA256 (signed cookies, keyring) |
| `subtle` | Constant-time comparison |
| `zeroize` | Secure memory clearing |
| `getrandom` | OS randomness — the spine standard for new randomness (`fuz_sys::rand`, `fuz_auth`, `fuz_storage`) |
| `rand` | RNG — pinned `0.8` **crate-level inside `fuz_sign` only** (the `ed25519-dalek` → `rand_core 0.6` constraint), not a general workspace dep. Prefer `getrandom` for new code. |

## Filesystem & OS

| Crate | Purpose |
| ----- | ------- |
| `nix` | POSIX syscalls (advisory `flock`, permissions) |
| `libc` | Raw libc FFI for syscalls/types beyond `nix` (PTY, signals) |
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
| `js-sys` | engine-native `JSON.parse` for the wasm-bindgen parse exports (tsv) |
| `wit-bindgen` | Component-model bindings |
| `wasmtime` / `wasmtime-wasi` | WASM host (tests, benches) |

See rust-patterns.md §WASM boundary errors and wasm-patterns.md for the
binding-layer conventions these support.

## Crate-vs-feature isolation (supply-chain)

When a capability must be kept **out of** a binary's dependency graph for
security or trust reasons, make it a **separate crate, not a cargo feature**.
Cargo unifies features across a `--workspace` build, so a feature-gated
"signing" or "test-hasher" path can be silently turned on by an unrelated
crate's feature selection. A separate crate can't be: it is either in the
dependency graph or it is not, and that is auditable.

- `fuz_sign` is a separate crate (not a `fuz_crypto` feature) so signing stays
  out of the `fuz` consumer graph — `fuz` links verification-only `fuz_crypto`.
- `fuz_testing` is a separate crate (not a `fuz_auth` feature) so the weakened
  test Argon2 params can't reach a production binary.
- Enforcement is the `cargo xtask check-release` dep-graph audit (`fuz_audit`),
  which fails if any non-`testing_`-prefixed binary transitively links a
  forbidden crate. Workspaces add per-workspace extra-forbidden crates
  (`fuz_sign`) and per-binary forbids (`fuz`/`fuzd` must not link `fuzi_*`) by
  passing an `AuditRules` POD (`extra_forbidden` + `per_binary:
  &[PerBinaryForbid]`) to the single `run_check_release_cli_with_rules` entry
  point. See rust-patterns.md §xtask for the xtask wiring.

## Shared low-level leaves (consolidation candidates)

A few pure, IO-light utilities are independently reimplemented across
workspaces and are candidates for a single leaf crate (kept spine-free — no
`tokio`/HTTP/DB — so even `zap`, which takes no spine, can consume it):

- a minimal dotenv (`KEY=VALUE`) parser (reimplemented in `zap_core` + `zzz`),
- an env-isolating subprocess harness (`fuz_subprocess`: `SpawnOptions` +
  `spawn_collect`/`spawn_streaming` with a capped output drain — already
  prototyped in `fuz_forge_server`),
- an exponential-backoff retry combinator (a generic one exists in
  `fuz_storage`; `fuz_sidecar` hand-rolls a second).

Signal-crate convention: prefer `nix` for syscall wrappers; reserve `libc` for
types/constants `nix` doesn't expose (PTY). Avoid pulling both into one
workspace for the same job.

## Feature hygiene

- **`default-features = false` + explicit feature lists** for deps with heavy
  optional trees — `reqwest`, `nix`, `notify`, `futures-util` all do. Opt into
  exactly what the workspace uses; don't inherit a crate's default surface.
- **`multiple_crate_versions = "allow"`** (rust-patterns.md §Lints) tolerates
  *forced* duplicate majors from the dep graph — e.g. `tsv` carries hashbrown
  0.15 (via `string-interner`) and 0.16 (via `serde_json` → `indexmap`),
  unresolvable until `string-interner` bumps upstream. Not a license to ignore
  version drift you control.

## Adding a dependency

New crates are added deliberately, not incidentally:

- Prefer the standard library, then this list, before anything new.
- A new dependency needs explicit approval — name it, its purpose, what it
  replaces or enables, and its transitive footprint.
- Add it at the workspace level (`[workspace.dependencies]`) so member
  crates share one version, then record it here.
- Removing an unused dependency is pre-authorized — no approval needed. Verify
  nothing references it (including features and build scripts), then drop the
  entry. Removing the last user of a crate? Drop it from the workspace and
  this list in the same change.
