# Rust Performance Patterns

**Applies to**: Rust workspaces across the ecosystem. Companion to
./rust-patterns.md — that one covers shape, this one covers speed.

## Stack constraints

- **`unsafe_code = "forbid"` at the workspace.** A specific crate can
  override to `"allow"` on a conservative, case-by-case basis (existing
  precedent: FFI/binding crates, see ./rust-patterns.md §Lints).
  Performance can justify the same override — see §Unsafe escape hatch.
  Never per-function in an otherwise-safe crate.
- **Stable Rust.** No `#![feature(...)]`, no nightly toolchains.
- **tokio runtime.** Thread-per-core runtimes (`glommio`, `monoio`) are
  out of scope — see §Out of scope.

## Measure first

Optimization without profiling is guesswork. Always profile and benchmark
with `--release`; debug builds run 10–100× slower with different hot paths.

### Profilers

| Tool                | Surface                                  | When                             |
| ------------------- | ---------------------------------------- | -------------------------------- |
| `samply`            | CPU sampling, flamegraphs                | "Where is wall-clock going?"     |
| `tokio-console`     | Live task states, busy/idle, polls       | Async stalls, starvation         |
| `cargo-instruments` | macOS Instruments integration            | Memory allocations on Apple HW   |
| Cachegrind          | Instruction counts, I-cache, branch miss | Verifying inline/cold heuristics |

`samply` is the default starting point on Linux. Reach for `tokio-console`
the moment an async server feels mysteriously sluggish — it surfaces tasks
that never yield, polls that take milliseconds, and workers that idle while
the queue grows.

### Benchmark frameworks

| Crate           | Metric             | Strengths                                                 |
| --------------- | ------------------ | --------------------------------------------------------- |
| Criterion       | Wall-clock + stats | Long-standing default; CI regression integrations         |
| Divan           | Wall-clock + stats | Lighter macros, native multithreaded benches              |
| Iai-Callgrind   | Instruction counts | Deterministic single run, no OS jitter; ideal for CI/micro |

Wall-clock benches are intuitive but sensitive to OS jitter and thermal
scaling. Instruction-count benches catch single-instruction regressions but
have weaker non-x86 / non-Linux support.

## Async lock hygiene

**Never hold a sync lock across `.await`.** `parking_lot::Mutex` and
`std::sync::Mutex` guards block the executor thread; if the holder yields
to the runtime mid-section, the runtime can deadlock or starve other tasks
that need the lock. Either:

- Scope the guard so it drops before the await point:
  ```rust
  let value = { let g = state.lock(); g.derive() };
  do_async(value).await;
  ```
- Or use `tokio::sync::Mutex` / `tokio::sync::RwLock`, which suspend
  cleanly across yields.

`parking_lot` remains the default for sync sections (./rust-patterns.md
§Dependencies). `tokio::sync::*` is for critical regions that themselves
must `.await`. `std::sync::*` only when you need poisoning semantics.

### DashMap for hot shared maps

`Arc<RwLock<HashMap<K, V>>>` serializes all readers under any contended
write, and even a pure-read workload bounces the lock's cache line across
cores. `DashMap` shards internally — each shard has its own lock, so
unrelated keys don't collide. Reach for it when profiling shows lock
contention on a single map. Not the default; the `RwLock` shape is fine
until proven otherwise.

## Allocation hygiene

Allocate on purpose, not by reflex. A deliberate allocation can be the
right design — terminating a pipeline, decoupling lifetimes, batching
work that would otherwise repeat. The tactics below target *incidental*
allocations: heap traffic that snuck in by habit, not by choice. Cheap,
idiomatic wins — apply without ceremony.

- **`Vec::with_capacity(n)`** when `n` is known or estimable. Default
  growth is geometric reallocation + memcpy per resize.
- **`swap_remove(i)`** instead of `remove(i)` when ordering is irrelevant.
  O(1) vs O(n).
- **`retain(|x| ...)`** for bulk filter-deletes — single pass, in place.
- **`.copied()` / `.cloned()`** on iterators of `Copy` references often
  generates better codegen than threading `&T` through the chain.
- **Don't `.collect()` mid-pipeline** just to keep chaining. Fuse the
  iterators (`iter().map(...).filter(...).sum()`) — every intermediate
  `Vec` is a heap allocation plus drop.
- **Strings**: `String::with_capacity`, `write!` into a buffer, `format!`
  only when the result is the final value.
- **Take `&str` / `&[T]`, not `String` / `Vec<T>`**, unless you need
  ownership. Already covered in ./rust-patterns.md §Avoid clone smells —
  it's both a clarity and an allocation rule.

## Bounds check elision

Let the compiler prove what you already know. Rust inserts a runtime
bounds check on every `vec[i]` access; inside tight loops these stall
the pipeline and inhibit auto-vectorization. The tactics below give
LLVM the invariants it needs to drop the check:

- **Iterators over indexing.** `for x in &v` — no check.
  `for i in 0..v.len() { v[i] }` — check every iteration.
- **Hoist slice lengths.** `let slice = &v[..n];` *before* the loop. The
  compiler proves bounds once, elides per-iteration checks.
- **`assert!(i < v.len())`** before a loop is a free optimizer hint —
  LLVM propagates the invariant downward.

`get_unchecked` / `get_unchecked_mut` are off-limits in workspace-default
crates. If a benchmark proves the bounds check is the bottleneck *and*
iterator/assert rewrites can't eliminate it, isolate the hot kernel in a
dedicated crate that overrides `unsafe_code = "allow"` — see §Unsafe
escape hatch.

## Inlining

Inlining isn't primarily about saving call overhead — it's about giving
the compiler a single block to optimize across, so constants fold,
branches collapse, and dead code drops. `#[inline]` is a hint;
`#[inline(always)]` is a mandate; `#[inline(never)]` blocks it. Apply
surgically:

- **`#[inline(always)]`**: tiny, hot, frequently-called helpers — e.g.
  branches that collapse away when a callsite passes `false` to a bool
  parameter.
- **`#[inline(never)]` + `#[cold]`**: rare error formatters, panic
  builders, anything off the hot path. Pulls cold code out of the critical
  I-cache footprint, keeping the hot sequence dense.
- **Cross-crate inlining**: `#[inline]` only inlines within a crate by
  default. The release profile sets `lto = true` and `codegen-units = 1`
  (./rust-patterns.md §Release Profile), which enables cross-crate
  inlining without per-fn annotations.

Don't sprinkle `#[inline(always)]` on large functions. Duplicating big
bodies at every call site bloats the binary and blows the I-cache.

Verify with Cachegrind: an inlined function's brace lines have zero event
counts.

## False sharing

When per-thread counters/stats sit adjacent in memory, they share a 64-byte
CPU cache line. A write by thread A invalidates the line on every other
core, forcing thread B to re-fetch from memory even though it touched a
different field. Under contention this can be a 5–10× slowdown on what
looks like independent atomic increments.

```rust
#[repr(align(64))]
struct ThreadStats {
    allocs: AtomicU64,
    bytes: AtomicU64,
}
```

Cost: padding bytes per struct. Win: eliminating cross-core invalidation
traffic on hot atomics. Apply to per-thread / per-shard structures that
get written from multiple cores.

## Arena allocation (bumpalo)

**Status**: not currently in use in any workspace crate. Documented as
the default choice if/when AST or parser work motivates an arena — pointer-
bump allocations + single arena drop eliminate per-node free-list traversal
and most pointer chasing, with cache-friendly contiguous layout.

**The drop-glue trap**: `bumpalo::Vec` and arena-allocated types do *not*
run `Drop` for their contents when the arena drops. If you put a `String`
or `std::vec::Vec` inside a `bumpalo::Vec` and call `into_bump_slice`, the
inner heap allocations leak permanently. Real-world incidents elsewhere
have run 18 months before detection.

Discipline:

- Arenas hold **POD-only data** (`Copy` types, `&'arena str`, primitives,
  arena-internal references).
- For arena-allocated types with destructors, use `typed-arena` instead —
  it walks allocations and runs `Drop` on teardown.
- Never round-trip global-heap collections (`String`, `Vec`, `HashMap`)
  through `into_bump_slice`.
- One arena per logical phase (per-file parse, per-request render). Drop
  at phase end.

## Zero-copy archives (rkyv)

**Status**: not currently in use. Documented as a candidate for content-
addressed object storage — blake3-hashed bodies and `{path → hash}`
snapshot manifests that get read repeatedly without intervening mutation.
The HTTP / SSE / JSON-RPC wire surfaces stay on `serde` + `serde_json`.

`serde_json` parses bytes into freshly allocated structs on every read.
`rkyv` skips the parse step entirely: the on-disk bytes *are* the in-
memory layout. An archive is reached via a single offset calculation
into the buffer, returning a `&Archived<T>` that aliases the buffer.
Internal pointers are encoded as offsets relative to the field's own
position, so the buffer is valid whether it was just mmap'd, read from
disk, or received over a socket — no fixup pass needed.

When it fits:

- mmap'd or repeatedly-read on-disk artifacts (content-addressed bodies,
  packed snapshot manifests, cached index pages)
- the hot path is "decode → traverse → drop without mutating"
- the schema is stable across versions, or evolution is rare enough to
  warrant explicit migration

When it doesn't:

- HTTP / SSE / JSON-RPC wire surfaces — `serde_json` stays the right call
- mutation-heavy workloads — writes go through `AlignedVec`, not in-place
  edits; rkyv is for the read side
- one-shot reads where the buffer is decoded once and thrown away —
  `serde`'s cost is amortized away

Discipline:

- Pair archived reads from untrusted input with `bytecheck` (rkyv's
  validation layer). Without it, a malformed buffer can dereference out-
  of-bounds offsets — and validation is opt-in, not the default.
- Treat the archived schema as a wire format. Renaming a field or
  reordering enum variants breaks every existing file on disk. The
  pre-stable workspace policy still applies — break in place and
  migrate, no compat shims — but the migration is "re-archive every
  file," not just "update callers."
- Don't mix archived and `serde`-derived shapes for the same type. Pick
  one per type so a reader doesn't have to guess.

## SIMD on stable

Portable SIMD (`std::simd`) is nightly-only and out of scope. On stable:

- **`target-feature` / `target-cpu=native`** via `RUSTFLAGS` enables LLVM
  auto-vectorization for the build target. The compiler emits AVX2 / SSE /
  NEON when the target supports it, no source changes required.
- **Crate-specific SIMD features**: some crates expose `simd` cargo
  features that gate `std::arch` intrinsic paths. Precedent: `blake3`
  uses `wasm32_simd` for WASM SIMD (./wasm-patterns.md).
- **Don't ship AVX-512 binaries** to general consumers — most consumer
  CPUs lack it, and binaries compiled with AVX-512 crash instantly on
  older hardware with no `unsafe` block to blame. Use `target-cpu=native`
  for in-house workloads; explicit feature flags for distributed binaries.

Hand-rolled `std::arch` intrinsics require `unsafe`. Isolate in a dedicated
crate (§Unsafe escape hatch); pair with strict bench regression tests.

## Global allocator (long-running daemons only)

**Status**: no workspace crate currently overrides the global allocator.
Guidance here is for when a daemon's RSS or CPU profile motivates a switch.

Default glibc `malloc` fragments badly under long uptimes with mixed-size
async allocations — RSS climbs continuously even with no leaks. Swapping
the allocator can drop RSS and CPU substantially.

| Allocator | Strengths                                              | Trade-offs                                  |
| --------- | ------------------------------------------------------ | ------------------------------------------- |
| glibc     | Default, no setup                                      | Heavy fragmentation in long-running servers |
| jemalloc  | Rock-stable RSS under chaotic load; great profiling    | Slightly higher CPU than mimalloc           |
| mimalloc  | Best throughput / lowest CPU; aggressive `munmap`      | RSS can spike during traffic bursts         |

```rust
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;
```

Candidates: long-running daemons (`zzz_server`). Not candidates:
CLIs and short-lived tools — startup cost matters more than fragmentation
they'll never see. Bench per service before adopting; the right answer
depends on workload shape.

**C-malloc gotcha**: a dependency that links a C library calling raw
`malloc` (e.g., LMDB) bypasses your Rust global allocator, mimicking a
leak. Fix: use mimalloc's symbol-override mode or `LD_PRELOAD` it so C
`malloc` calls also route through it.

## Unsafe escape hatch

Workspace lints `forbid` `unsafe_code`. A specific crate can override to
`"allow"` when justified — existing precedent is FFI/binding crates
(`blake3_component`, `tsv_ffi`; see ./rust-patterns.md §Lints).

Performance can also justify it, but conservatively:

- **Isolate.** The unsafe code lives in a dedicated crate or tightly-scoped
  module, never sprinkled per-function across safe code.
- **Document.** Every `unsafe { ... }` block carries a `// SAFETY:` comment
  stating the invariants the caller must uphold.
- **Bench-justify.** A regression test or benchmark demonstrates the
  unsafe path wins meaningfully over the safe equivalent — not "I think
  this might be faster."
- **Reversible.** Keep a safe fallback in the same crate so the unsafe
  path can be disabled if it ever causes trouble in production.
- **Narrow scope** — the crate-level `unsafe_code = "allow"` should not
  become a license for unrelated unsafe elsewhere in the crate. Code
  review treats new unsafe blocks as gated.

Candidates that have cleared this bar elsewhere: `get_unchecked` in
proven-safe inner loops, `std::arch` SIMD intrinsics for a specific CPU
target. Candidates that have *not*: dodging `clone()`, "the compiler
should be able to prove this," speed claims without measurements.

## What's out of scope

Honest notes to prevent cargo-culting:

- **Thread-per-core runtimes** (`glommio`, `monoio`): Linux-only, io_uring-
  bound, abandon tokio. Stack uses tokio + axum throughout — adopting TPC
  for one service is a major architectural break and the load-balance
  trade-offs rarely favor it.
- **Portable SIMD** (`std::simd`): nightly-only. See §SIMD on stable.
- **Structure-of-Arrays layouts** (`soapy`, `soa_derive`): niche to bulk
  numeric pipelines (graphics, physics, ML kernels). Reach for it if
  profiling shows cache-line waste on a homogeneous workload; otherwise
  the AoS-shaped struct is fine and clearer.
- **`multiversion` crate** for runtime CPU-feature dispatch: not currently
  justified — single-target builds suffice for the workloads here.
- **Manual AVX intrinsics with hand-unrolled loops**: covered by §Unsafe
  escape hatch; rare in practice and almost never the right first move.
- **Left-right concurrency** (`evmap` and similar): two synchronized
  copies of a structure for fully lock-free reads at the cost of 2×
  memory, eventual consistency, and writers blocked on slow readers.
  Niche to workloads where reads outnumber writes by orders of magnitude
  *and* `DashMap` / `RwLock` have been profiled as the bottleneck. Today
  the read paths here haven't hit that wall.
- **Hand-rolled lock-free structures with `crossbeam-epoch`**: epoch-
  based reclamation is the standard answer for "free a node only once
  no reader can still see it," but writing your own lock-free stack /
  queue / skiplist is rarely the right move. `DashMap`, `tokio::sync`,
  and `crossbeam::queue` already vendor the well-tested versions —
  reach for those before reaching for the primitive.
