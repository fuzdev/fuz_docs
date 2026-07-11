---
description: Rust perf — profiling, arenas, locks, hot-path idioms, SIMD
---

# Rust Performance Patterns

**Applies to**: Rust workspaces across the ecosystem. Companion to
./rust-patterns.md — that one covers shape, this one covers speed. Generic Rust
perf hygiene (`with_capacity`, `swap_remove`, iterator fusion, bounds-check
elision via iterators/`assert!`, `#[inline]` mechanics) is assumed known and not
restated; this is the stack-specific layer.

Worth stating once: allocate on purpose, not by reflex — a deliberate allocation
(terminating a pipeline, decoupling lifetimes, batching repeated work) is often
the right design, not a smell to optimize away.

## Stack constraints

- **`unsafe_code = "forbid"` at the workspace.** A crate can override to
  `"allow"` case-by-case (FFI/binding crates already do — ./rust-patterns.md
  §Lints); performance can justify the same, conservatively — see §Unsafe escape
  hatch. Never per-function in an otherwise-safe crate.
- **Stable Rust.** No `#![feature(...)]`, no nightly toolchains.
- **tokio runtime.** Thread-per-core runtimes (`glommio`, `monoio`) are out of
  scope — see §Out of scope.

## Measure first

Always profile/bench with `--release` (debug runs with different hot paths).
tsv keeps a `[profile.profiling]` (`inherits = "release"`, `debug = true`,
`strip = false`) for symbolicated profiles. Curated tools:

| Profiler            | Surface                                  | When                                            |
| ------------------- | ---------------------------------------- | ----------------------------------------------- |
| `samply`            | CPU sampling, flamegraphs                | default on Linux; "where's wall-clock going?"   |
| `tokio-console`     | Live task states, busy/idle, polls       | async stalls, tasks that never yield, starvation |
| `cargo-instruments` | macOS Instruments                        | allocations on Apple HW                         |
| Cachegrind          | Instruction counts, I-cache, branch miss | verifying inline/cold heuristics                |

| Bench         | Metric             | Notes                                                            |
| ------------- | ------------------ | ---------------------------------------------------------------- |
| Criterion     | Wall-clock + stats | default; CI regression integrations                              |
| Divan         | Wall-clock + stats | lighter macros, native multithreaded benches                     |
| Iai-Callgrind | Instruction counts | deterministic, no OS jitter; ideal for CI/micro (weaker non-x86) |

## Arena allocation (`bumpalo`) — in use in tsv

tsv's core allocation strategy: every parser is
`parse<'arena>(source: &str, arena: &'arena Bump) -> Result<Ast<'arena>>` —
the **caller owns the `Bump`**, ASTs borrow it, and formatting takes a
separate doc arena. Conventions proven there:

- **Per-thread reusable arenas for binding hot loops** (`tsv_arena`):
  `with_ast_arena` / `with_doc_arena` hold one `thread_local!`
  `RefCell<Bump>` per thread and `reset()` at the **start** of each call, so
  the high-water chunk is retained and per-call malloc/free amortizes to
  zero. Soundness contract: the callback must fully consume arena-borrowed
  work into an owned return before the next reset. Non-reentrant (the
  `RefCell` borrow spans the callback) — a nested parse inside formatting
  uses a local `Bump`. Recovers cleanly after `catch_unwind` (the FFI path
  relies on this). Under WASM the thread-local is effectively a module
  static.
- **Trap**: `bumpalo` collections don't run `Drop` for contents — arenas hold
  POD (`Copy`, `&'arena str`). For types with destructors use `typed-arena`
  (not currently used anywhere). Never round-trip global-heap collections
  (`String`/`Vec`) through `into_bump_slice` — leaks.
- One arena per phase (AST vs doc IR), dropped/reset at phase end.

`bumpalo` stays safe-API-only, so `unsafe_code = "forbid"` holds.

## Async lock hygiene

**Never hold a sync lock (`parking_lot`/`std`) across `.await`** — the guard
blocks the executor thread; if the holder yields mid-section the runtime can
deadlock or starve. Drop the guard before the await, or use `tokio::sync::*`
which suspends cleanly. Pick per critical section:

- `parking_lot` — default for sync-only sections (no poisoning, smaller, faster).
- `tokio::sync::{Mutex, RwLock}` — sections that themselves `.await`.
- `std::sync::*` — only when you need poisoning semantics.

**DashMap** for hot shared maps: `Arc<RwLock<HashMap>>` serializes all readers
under any contended write and bounces the lock's cache line across cores;
DashMap shards internally. Reach for it when profiling shows contention on one
map — not the default.

## Stack-specific perf notes

Beyond generic hygiene:

- **`get_unchecked` is off-limits in workspace-default crates.** If a bench
  proves a bounds check is the bottleneck *and* iterator/`assert!`-hoist
  rewrites can't elide it, isolate the hot kernel in a crate that overrides
  `unsafe_code = "allow"` (§Unsafe escape hatch).
- **Cross-crate inlining is free here**: the release profile's `lto = true` +
  `codegen-units = 1` (./rust-patterns.md §Release Profile) inlines across crates
  without per-fn `#[inline]`. Reserve `#[cold]` + `#[inline(never)]` for rare
  error/panic formatters to keep the hot I-cache dense.
- **Box the error, keep `Ok` pointer-sized**: tsv's lexer returns
  `Result<_, Box<ParseError>>` so the hot `next_token` Ok path stays small; a
  `From<Box<ParseError>>` unboxes at the parser boundary. Apply when the error
  type is fat and the fallible call is hot.
- **Don't round-trip a closed set through serde on a hot path**: zzz's
  `ProviderName::parse(&str)` matches literals directly instead of allocating
  a `Value::String` per request, with `as_str`/`Display`/serde-rename
  single-sourced from one match.
- **Compact span/token types**: tsv's `Span { start: u32, end: u32 }` (`Copy`)
  halves span memory vs `usize` pairs and caps files at 4 GiB — pair the cap
  with an explicit `FileTooLarge` guard.
- **False sharing**: pad per-thread/per-shard hot atomics to a cache line
  (`#[repr(align(64))]`) when multiple cores write adjacent counters —
  otherwise one write invalidates the line on every core (5–10× on what look
  like independent increments).

## Open questions / not-yet-used

None of these are in any workspace crate today; noted tersely so the choice is
in-context if the workload arrives.

- **Zero-copy archives (`rkyv`)** — candidate for content-addressed bodies and
  snapshot manifests read repeatedly without mutation (the on-disk bytes *are*
  the in-memory layout, no parse); not for mutation-heavy or read-once paths.
  Wire surfaces (HTTP/SSE/JSON-RPC) stay on `serde_json`. Pair untrusted reads
  with `bytecheck`; treat the archived schema as a wire format (a field rename =
  re-archive every file). Don't derive both archived and `serde` shapes on one
  type — pick one per type so the canonical representation is unambiguous.
- **Global allocator (jemalloc/mimalloc)** — for long-running daemons whose RSS
  climbs under glibc fragmentation (`zzz_server`), not CLIs. jemalloc: stable RSS
  under chaotic load + good profiling; mimalloc: best throughput/CPU but RSS can
  spike in bursts. Bench per service. Gotcha: a C dep calling raw `malloc` (LMDB)
  bypasses the Rust allocator — use mimalloc symbol-override or `LD_PRELOAD`.
- **SIMD on stable** — `target-cpu=native` / `target-feature` via `RUSTFLAGS`
  drives LLVM auto-vectorization (no source changes); crate `simd` features gate
  `std::arch` paths (blake3's `wasm32_simd`, ./wasm-patterns.md). Don't ship
  AVX-512 to general consumers — it crashes instantly on older CPUs. `std::simd`
  is nightly, out of scope.

## Unsafe escape hatch

A crate may override `unsafe_code = "allow"` for performance, conservatively:

- **Isolate** in a dedicated crate / tightly-scoped module, never per-function.
- **Document** every `unsafe { ... }` with a `// SAFETY:` invariant comment.
- **Bench-justify** — a regression test shows the unsafe path wins meaningfully,
  not "I think this is faster."
- **Reversible** — keep a safe fallback in the same crate.

Cleared this bar elsewhere: `get_unchecked` in proven-safe inner loops,
`std::arch` SIMD for a specific target. Has *not*: dodging `clone()`, "the
compiler should be able to prove this," speed claims without measurements.

## Out of scope

Honest notes to prevent cargo-culting:

- **Thread-per-core** (`glommio`/`monoio`): Linux/io_uring-bound, abandon tokio
  — a major architectural break for one service, trade-offs rarely favor it.
- **SoA layouts** (`soapy`/`soa_derive`): niche to bulk numeric pipelines; reach
  for it only if profiling shows cache-line waste on a homogeneous workload.
- **`multiversion`** runtime CPU-feature dispatch: single-target builds suffice.
- **Left-right** (`evmap`): 2× memory, eventual consistency, writers blocked on
  slow readers — niche to read:write ratios of orders of magnitude, after
  `DashMap`/`RwLock` have been profiled as the bottleneck.
- **Hand-rolled lock-free** (`crossbeam-epoch`): reach for `DashMap`,
  `tokio::sync`, `crossbeam::queue` before writing your own stack/queue/skiplist.
