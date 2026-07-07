# Approved Rust Dependencies

The canonical allowlist of external crates approved for Rust workspaces
across the ecosystem. Prefer these; reach outside the list only with
explicit approval (see [§Adding a dependency](#adding-a-dependency)).

**Scope**: the canonical (non-experimental) Rust workspaces — CLIs and
daemons, the WASM/FFI/N-API bindings, the web servers and their spine crates.
Different-paradigm or pre-canonical repos (games, protocol research) carry
their own deps and are out of scope here. For an external project adopting
fuz-stack, the list is advisory — a vetted starting set, not a gate; the
approval *process* below applies only inside the ecosystem workspaces.

**Source of truth**: each repo's root `[workspace.dependencies]`. This doc
mirrors the **union** of those for human and agent audit; it is not
generated. Any single workspace carries a small subset (zap's direct
external set is ~11 crates; the forge's ~24 — everything else arrives
transitively via the spine). Verify against the workspaces periodically.

Crates internal to a workspace (declared with `path = ...`) are not
dependencies in this sense and never appear here — including cross-repo path
deps onto the fuz spine crates.

A few approved crates are pinned at the **member-crate** level rather than in
a root `[workspace.dependencies]`: `js-sys` (optional, feature-gated),
`wasm-bindgen`, and `talc` (wasm32-only target dep) in `tsv_wasm`, `similar`
and `tempfile` in `tsv_debug`, `libc` in `zzz_server`. They're real external
deps and belong here.

## Serialization & encoding

| Crate | Purpose |
| ----- | ------- |
| `serde` | Derive-based serialization framework |
| `serde_json` | JSON (tsv enables `preserve_order` + `float_roundtrip`) |
| `postcard` | Compact binary serialization (the fuzd UDS wire) |
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
| `bumpalo` | Arena allocation (`collections` feature) — tsv's core AST strategy; see rust-perf.md §Arena allocation |
| `string-interner` | String interning |
| `phf` | Compile-time perfect-hash maps/sets (keyword tables) |
| `unicode-ident` / `unicode-segmentation` / `unicode-width` | Unicode text handling |
| `similar` | Text diffing (tsv's debug/compare tooling) |

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
| `rand` | RNG — pinned `0.8` in `[workspace.dependencies]`, consumed only by `fuz_sign` (the `ed25519-dalek` → `rand_core 0.6` constraint). Prefer `getrandom` for new code. |

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
| `tracing-subscriber` | Subscriber / formatting layers (consumed via `fuz_sys::logging`, not per-consumer) |
| `tracing-appender` | Non-blocking file appender |

## WASM, N-API & host

| Crate | Purpose |
| ----- | ------- |
| `wasm-bindgen` | JS interop (wasm-pack) |
| `js-sys` | engine-native `JSON.parse` for the wasm-bindgen parse exports (tsv) |
| `talc` | WASM global allocator (`tsv_wasm`, wasm32-only target dep) — pure-Rust `no_std` replacement for std's dlmalloc; use the `WasmGrowAndExtend` source (the default claim source fragments a long-lived instance's linear memory). Pulls `lock_api` + `allocator-api2` into the wasm32 graph only |
| `napi` / `napi-derive` / `napi-build` | N-API bindings — the native Node.js/Bun npm path (`tsv_napi`); `napi-build` is the matching build dep |
| `wit-bindgen` | Component-model bindings |
| `wasmtime` / `wasmtime-wasi` | WASM host (tests, benches) |

See wasm-patterns.md for the binding-layer conventions these support.

## Image processing

| Crate | Purpose |
| ----- | ------- |
| `libvips` | Rust bindings to the system **libvips** image library — the same engine `sharp` wraps — for decode/resize/encode (JPEG/PNG/WebP/AVIF), EXIF-orientation baking, metadata stripping, and thumbnailing. For spine-consumer servers with an image-upload pipeline (e.g. `visiones_server`). Dynamically links system libvips: `libvips42` (Debian) at runtime + `libvips-dev` at build time — not a static-musl crate; on a Debian host `zap` installs it via apt. The `unsafe` FFI lives inside the binding — consumer crates keep `unsafe_code = "forbid"`. Chosen over the pure-Rust `image`/`ravif`/`image-webp` stack because matching `sharp`'s formats there pulls in `libwebp` + `dav1d` C deps anyway, across more crates and with worse parity. |

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
  forbidden crate; workspaces add extra forbids via `AuditRules`. See
  rust-spine.md §xtask & check-release for the entry points and the
  built-in layering rules.

## Shared low-level leaves (consolidation candidates)

The pattern is proven: the sandboxed config-eval harness was extracted from
zap into the spine's `fuz_eval` — a spine-free leaf (no tokio-server/HTTP/DB
surface) consumable even by spine-free repos — and is now shared across
consumers, including the JS wrapper ingredients themselves
(`DETERMINISM_STUBS_JS`, `CONSOLE_TO_STDERR_JS`,
`build_extract_export_wrapper`). Remaining candidates, still independently
reimplemented:

- a minimal dotenv (`KEY=VALUE`) parser — three copies today (`zap_core`,
  plus two inside zzz: the CLI's daemon-env loader and its xtask),
- an env-isolating subprocess harness with a capped output drain —
  prototyped in `fuz_forge_server`, promotion deferred until a second
  consumer,
- the atomic-write/flock transactional-file dance for spine-free consumers —
  `fuz_sys::fs::write_atomic` is canonical but zap can't link it and
  hand-rolls both authority calibrations (rust-patterns.md §Transactional
  state files),
- an exponential-backoff retry combinator — no generic one exists;
  `fuz_sidecar`'s crash-recovery respawn loop is the only backoff
  implementation, and it's supervision-shaped, not request-retry.

Signal-crate convention: prefer `nix` for syscall wrappers; reserve `libc` for
types/constants `nix` doesn't expose (PTY). Avoid pulling both into one
workspace for the same job.

## Feature hygiene

- **`default-features = false` + explicit feature lists** for deps with heavy
  optional trees — `reqwest`, `nix`, `notify`, `futures-util` all do. Opt into
  exactly what the workspace uses; don't inherit a crate's default surface.
- **`multiple_crate_versions = "allow"`** (rust-patterns.md §Lints) tolerates
  *forced* duplicate majors from the dep graph — e.g. `tsv` carries hashbrown
  0.16 (via `string-interner`) and 0.17 (via `serde_json` → `indexmap`),
  unresolvable until `string-interner` bumps upstream. Not a license to ignore
  version drift you control.

## Adding a dependency

New crates — whether a third-party dependency or a first-party workspace
member — are added deliberately, not incidentally:

- Prefer the standard library, then this list, before anything new.
- A new dependency needs explicit approval — name it, its purpose, what it
  replaces or enables, and its transitive footprint.
- Creating a new first-party crate (a new `crates/<name>/` workspace member)
  likewise needs explicit approval — minting a new crate boundary is a
  build-graph and release-surface decision. Adding a module, file, or
  directory inside an existing crate doesn't; the gate is only on the new
  crate itself.
- Add it at the workspace level (`[workspace.dependencies]`) so member
  crates share one version, then record it here.
- Removing an unused dependency is pre-authorized — no approval needed. Verify
  nothing references it (including features and build scripts), then drop the
  entry. Removing the last user of a crate? Drop it from the workspace and
  this list in the same change.
