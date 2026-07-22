---
description: WASM/N-API build targets — wasm-bindgen, component model, JS interop
---

# WASM Patterns for the Fuz Ecosystem

**Applies to**: `blake3` (WASM hashing) and `tsv` (parser/formatter bindings —
WASM, C-FFI, and N-API). The fuz workspace does not currently use WASM.

**Publishing stance**: npm gets **both** native (N-API) and WASM builds. The
C-FFI `cdylib` additionally serves Deno FFI and Python.

## Two Build Targets

| Approach        | Tool              | Consumer           | Use case                         |
| --------------- | ----------------- | ------------------ | -------------------------------- |
| wasm-bindgen    | `wasm-pack`       | JS runtimes        | Ship Rust to Deno/Node/browsers  |
| Component model | `cargo-component` | Wasmtime / plugins | Sandboxed execution, composition |

**wasm-bindgen**: generates glue code, handles memory management, produces
`.wasm` + `.js` ready to import. **Component model**: capability-controlled
execution — components declare imports/exports via WIT interfaces.

When to use which: npm publishing → wasm-bindgen; benchmarking across
runtimes → both; plugin systems (speculative) → component model.

## WIT Interface Design

Abridged from blake3's `wit/` (the full interface adds derive-key and more
resource methods):

```wit
package fuzdev:blake3@0.0.1;

interface hashing {
    enum hash-error { invalid-key-length }

    hash: func(data: list<u8>) -> list<u8>;
    keyed-hash: func(key: list<u8>, data: list<u8>) -> result<list<u8>, hash-error>;

    resource hasher {
        constructor();
        new-keyed: static func(key: list<u8>) -> result<hasher, hash-error>;
        update: func(data: list<u8>);
        finalize: func() -> list<u8>;
    }
}

world blake3 {
    export hashing;
}
```

- Package naming `<namespace>:<name>@<version>` — use the `fuzdev` namespace.
- WIT **requires** kebab-case; binding generators convert per language.
- **One-shot functions** for stateless ops; **resources** for stateful
  streaming (`hasher` holds state across `update`/`finalize`).
- **`result<T, E>` with typed error enums** (not strings); minimal enums —
  one variant per distinct failure mode.
- **Worlds declare capabilities** — `export hashing` with no imports = pure
  computation, no ambient access.

## Component Implementation (wit-bindgen)

Abridged from `blake3_component` (see the crate for the full impl):

```rust
use std::cell::RefCell;
use exports::fuzdev::blake3::hashing;

wit_bindgen::generate!({ path: "../../wit", world: "blake3" });

struct Component;
export!(Component);

impl hashing::Guest for Component {
    type Hasher = HasherResource;

    fn keyed_hash(key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(blake3::keyed_hash(&key, &data).as_bytes().to_vec())
    }
    // hash / derive_key: same shape
}

struct HasherResource {
    inner: RefCell<blake3::Hasher>,
}

impl hashing::GuestHasher for HasherResource {
    fn update(&self, data: Vec<u8>) {
        self.inner.borrow_mut().update(&data);
    }
    // constructor / static factories / finalize: same RefCell shape;
    // factories return hashing::Hasher::new(HasherResource { … })
}
```

Key patterns: `wit_bindgen::generate!` at compile time from WIT; unit struct

- `export!`; **`RefCell` for resource state** (resources receive `&self`);
  static factories return `hashing::Hasher` wrapping the resource struct.

### Cargo.toml for component crates

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
blake3 = { workspace = true, features = ["wasm32_simd"] }
wit-bindgen.workspace = true

# Cannot use `lints.workspace = true`: wit-bindgen generates #[export_name]
# and unsafe ABI stubs. Re-declare the ENTIRE workspace lint block (rust and
# clippy tables — see rust-patterns.md §Lints; overriding only unsafe_code
# silently drops the restriction-lint floor), changing only:
[lints.rust]
unsafe_code = "allow"
# ... full re-declared [lints.rust] + [lints.clippy] block here ...
# blake3_component additionally allows same_length_and_capacity + use_self
# (false positives from generated code).

[package.metadata.component]
package = "fuzdev:blake3"

[package.metadata.component.target]
world = "blake3"
path = "../../wit"
```

`[package.metadata.component.target]` is a sub-table — `world` and `path` go
under `target`, not directly under `component`.

Build (requires `cargo-component` and the `wasm32-wasip1` target; no
wasm-opt pass for the component):

```bash
RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128' \
    cargo component build -p blake3_component --release
```

## Host-Side Embedding (wasmtime)

Only blake3's bench/compare binaries embed a component host; read
`blake3_bench_wasmtime` for the working setup. The gotchas:

- Pin `wasmtime`/`wasmtime-wasi` at the same major (currently 45) and enable
  the `component-model` feature on `wasmtime` — the `bindgen!`/component APIs
  don't compile without it.
- `wasmtime::component::bindgen!` mirrors the guest-side macro; the host state
  struct holds `WasiCtx` + `ResourceTable` and implements `WasiView`.
- Enable `wasm_component_model` on the engine `Config` and add WASI to the
  linker via `wasmtime_wasi::p2::add_to_linker_sync`.
- **Resource lifecycle**: the host owns the handle, the guest owns the memory —
  call `resource_drop` explicitly or the guest instance leaks.

## wasm-bindgen Patterns

### Crate architecture (blake3)

Shared core crate with thin wrappers — the SIMD split is genuinely two
crates (contrast tsv, where the split is a feature axis within one crate):

| Crate               | Type            | Purpose                                   |
| ------------------- | --------------- | ----------------------------------------- |
| `blake3_wasm_core`  | `rlib`          | Shared wasm-bindgen exports + TS types    |
| `blake3_wasm`       | `cdylib + rlib` | SIMD build (enables `blake3/wasm32_simd`) |
| `blake3_wasm_small` | `cdylib + rlib` | Size-optimized build (no SIMD)            |

Both wrappers contain only `pub use blake3_wasm_core::*;`.

### Rust side

```rust
#[wasm_bindgen]
pub fn hash(data: &[u8]) -> Vec<u8> {
    blake3::hash(data).as_bytes().to_vec()
}

#[wasm_bindgen]
pub fn keyed_hash(key: &[u8], data: &[u8]) -> Result<Vec<u8>, JsError> {
    let key: [u8; 32] = key
        .try_into()
        .map_err(|_| JsError::new("key must be exactly 32 bytes"))?;
    Ok(blake3::keyed_hash(&key, data).as_bytes().to_vec())
}

#[wasm_bindgen]
pub struct Blake3Hasher { inner: blake3::Hasher }

#[wasm_bindgen]
impl Blake3Hasher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self { Self { inner: blake3::Hasher::new() } }

    pub fn new_keyed(key: &[u8]) -> Result<Blake3Hasher, JsError> { /* ... */ }
    pub fn update(&mut self, data: &[u8]) { self.inner.update(data); }
    pub fn finalize(&self) -> Vec<u8> { self.inner.finalize().as_bytes().to_vec() }
    // new_derive_key / finalize_and_reset / reset
}
```

Differences from the component model: `&[u8]` and `&mut self` (wasm-bindgen
handles borrowing, no `RefCell`); `JsError` string messages, not typed enums;
`free()` and `Symbol.dispose` generated automatically.

### tsv wasm-bindgen patterns

Complex return types (ASTs) cross the boundary as a single JSON string,
parsed with the engine's native `JSON.parse` via `js-sys` — building the JS
object graph node-by-node with `serde-wasm-bindgen` was measurably slower and
was dropped. Parsers are arena-based (rust-perf.md §Arena allocation): the
binding runs inside `with_ast_arena` / `with_doc_arena` so per-call
allocation amortizes to zero.

```rust
// lang_bindings! macro-generates four exports per language:
//   parse_<lang>, parse_<lang>_json, parse_internal_<lang>, format_<lang>
// The extern type names the matching interface in the bundled tsv_ast.d.ts,
// so wasm-pack declares the return as the typed AST (e.g. `SvelteRoot`).
#[wasm_bindgen]
pub fn parse_svelte(source: &str) -> Result<SvelteRoot, JsError> {
    let json = parse_svelte_json(source)?;
    let js_value = js_sys::JSON::parse(&json)
        .map_err(|_| err("internal error: AST serialized to invalid JSON"))?;
    Ok(js_value.unchecked_into::<SvelteRoot>())
}

#[wasm_bindgen]
pub fn parse_svelte_json(source: &str) -> Result<String, JsError> {
    with_ast_arena(|arena| {
        let ast = tsv_svelte::parse(source, arena).map_err(err)?;
        Ok(tsv_svelte::convert_ast_json_string(&ast, source))
    })
}
```

`parse_*_json` returns the wire string directly for consumers that forward it
without materializing a JS object. `parse_internal_*` benchmarks skip
serialization via `std::hint::black_box`. Goal-aware exports
(`parse_typescript_json_with_goal`, `format_typescript_with_goal`) sit
outside the macro.

tsv_wasm runs wasm-opt with explicit feature flags — bulk-memory +
nontrapping-float are required for Rust 2024 output, and simd + multivalue
mirror the `-Ctarget-feature=+simd128,+multivalue` rustflags in tsv's
`.cargo/config.toml` (wasm-opt rejects those instructions unless enabled by
name):

```toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = [
    '-O3',
    '--enable-bulk-memory',
    '--enable-nontrapping-float-to-int',
    '--enable-simd',
    '--enable-multivalue',
]
```

### TypeScript entry points

Re-export from wasm-pack's `pkg/` output and add stream functions:

```typescript
import { Blake3Hasher, derive_key, hash, keyed_hash } from './pkg/deno/blake3_wasm.js';
export { Blake3Hasher, derive_key, hash, keyed_hash };

import { make_stream_functions } from './stream.ts';
export const { hash_stream, keyed_hash_stream, derive_key_stream } =
	make_stream_functions(Blake3Hasher);
```

Node entry uses synchronous initialization (`readFileSync` + `initSync`).
The generated packages bridge wasm-bindgen's camelCase to the ecosystem
convention: `initSync` is re-exported as `init_sync`.

### npm package structure

`scripts/patch_npm_package.ts` generates: `index.js` (Node auto-init),
`browser.js` (async `init()`, exports guarded with `_check()`), `stream.js`,
`index.d.ts`. Package exports map `.` → `{ types, node, default }`
conditions plus a `./package.json` self-reference.

### Streaming, disposal, consumer API

- Stream helpers batch at 16 KB to reduce WASM boundary crossings:
  `await hash_stream(file.stream())` etc., built via
  `make_stream_functions(Blake3Hasher)`; the browser entry passes a `_check`
  guard against uninitialized WASM.
- `using hasher = new Blake3Hasher();` — wasm-bindgen generates
  `Symbol.dispose`, so `free()` runs at scope exit. Shared
  `Blake3HasherInstance` / `Blake3HasherConstructor` interfaces type the
  class across entries.
- `@fuzdev/fuz_util/hash_blake3.ts` is the ecosystem consumer:
  `export const blake3_ready = init();` (eager init — resolves immediately
  under sync init, awaited in browsers) and
  `hash_blake3(data: Uint8Array | BufferSource | string): string` returning
  64-char hex (validated by the `Blake3Hash` Zod schema).

### deno compile compatibility

wasm-bindgen's deno target loads WASM via `fetch()`, incompatible with
`deno compile`. The build pipeline patches the generated JS to use
`Deno.readFileSync` and creates a `_bg.js` stub for module resolution.

## Multiple Binding Crates (tsv pattern)

A library targeting several runtimes keeps one binding crate per technology,
all exporting identical macro-generated signatures (`parse` /
`parse_internal` / `format` per language), so consumers choose by runtime:

| Crate      | Technology   | Target                         | Error type           |
| ---------- | ------------ | ------------------------------ | -------------------- |
| `tsv_wasm` | wasm-bindgen | Deno, browsers, Node           | `Result<T, JsError>` |
| `tsv_napi` | N-API        | Node.js, Bun (native npm path) | N-API errors         |
| `tsv_ffi`  | C ABI        | Deno FFI, Python               | JSON error objects   |

All three share the `tsv_arena` per-thread arenas. `tsv_ffi` and `tsv_napi`
override `unsafe_code = "allow"` and re-declare the full workspace lint block
(rust-patterns.md §Lints). `tsv_ffi` uses raw pointers with
`tsv_free(ptr, len)` for memory management and wraps every entry point in
`panic::catch_unwind`, rendering payloads as `{"error": "panic: …"}` — which
requires the `panic = "unwind"` corpus profile to be effective
(rust-patterns.md §Release Profile).

## Package naming: `_wasm` suffix

WASM artifacts carry a `_wasm` suffix everywhere they could be confused with a
native build; native artifacts stay bare. The suffix is part of the published
identity — npm package, crate name, and the generated `*_wasm_bg.wasm` all
agree.

| Project | WASM packages                                                                                        | Native                                                |
| ------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| blake3  | `@fuzdev/blake3_wasm` (SIMD), `@fuzdev/blake3_wasm_small` (no SIMD)                                  | none                                                  |
| tsv     | `@fuzdev/tsv_wasm` (parse + format + `tsv` CLI), `@fuzdev/tsv_format_wasm`, `@fuzdev/tsv_parse_wasm` | `tsv` CLI binary, `tsv_ffi` `.so`, `tsv_napi` `.node` |

- **The three tsv WASM packages come from one crate.** `tsv_wasm` has
  `format`/`parse` cargo features (default = both); the subset packages are
  `--no-default-features --features format|parse` builds. `parse` pulls the
  language crates' `convert` feature (the AST→JSON layer) + `js-sys`. The
  umbrella `@fuzdev/tsv_wasm` is the flagship (it ships the JS `tsv` CLI).
- **Native stays bare, and "tsv" is deliberately overloaded**: the native CLI
  binary (`tsv_cli` crate), the C-FFI lib, and the JS CLI inside
  `@fuzdev/tsv_wasm` are all invoked as `tsv` — same tool, per-runtime
  delivery.
- **Drop redundant kind labels.** Where artifacts are already grouped by kind,
  don't repeat `(wasm)` / `(native)` in the row name — the `_wasm` suffix (or
  its absence) carries it.

## Two Packages, Not Two Profiles (blake3)

blake3 ships two npm packages from different crates. Both are size-optimized
end-to-end (`opt-level=s` + wasm-opt `-Os`); the only differentiator is SIMD:

| Package                     | Crate               | RUSTFLAGS                                   | wasm-opt              | Size   |
| --------------------------- | ------------------- | ------------------------------------------- | --------------------- | ------ |
| `@fuzdev/blake3_wasm`       | `blake3_wasm`       | `-C opt-level=s -C target-feature=+simd128` | `-Os --enable-simd …` | ~45 KB |
| `@fuzdev/blake3_wasm_small` | `blake3_wasm_small` | `-C opt-level=s`                            | `-Os …`               | ~32 KB |

SIMD build: ~2.6x faster at large inputs (Deno/Node), slower on Bun (WASM
SIMD regression) — use the small build for Bun and bundle-size-sensitive
contexts. A size regression test pins the byte counts. The wasmtime component
is the exception — `opt-level=3`, since the host can absorb bytes for speed.

```toml
# blake3_wasm (SIMD)
[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Os", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core", features = ["simd"] }
```

blake3_wasm_small is the same minus `--enable-simd` and without the `simd`
feature. Rust 2024 enables bulk memory for `wasm32-unknown-unknown`, so
wasm-opt needs `--enable-bulk-memory` (and friends) or it fails.
`--strip-producers` removes compiler metadata.

### Build commands

```bash
RUSTFLAGS='-C opt-level=s -C target-feature=+simd128' \
    wasm-pack build crates/blake3_wasm --scope fuzdev --target deno --release --out-dir pkg/deno

RUSTFLAGS='-C opt-level=s' \
    wasm-pack build crates/blake3_wasm_small --scope fuzdev --target deno --release --out-dir pkg/deno
```

**Why RUSTFLAGS**: `wasm-pack` doesn't support `--profile` (conflicts with
`--release`), so RUSTFLAGS overrides at the compiler level. The base
`[profile.release]` keeps `opt-level = "s"` plus the canonical
lto/codegen-units/panic/strip block.

The build pipeline runs the two packages in parallel; deno and web targets
run sequentially within each (shared cargo intermediate artifacts).

## Testing

blake3 keeps **zero Rust unit tests by design**: correctness is asserted in
TypeScript (WASM vs native test vectors) and via a Wasmtime compare binary
for the component; `cargo test --workspace` serves as a compile gate. tsv's
binding tests run per runtime (Deno, N-API, npm) plus in-crate FFI/N-API
round-trip tests — see rust-patterns.md §Testing.

## Cross-References

| Resource                         | Link                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Blake3 WASM bindings             | [fuzdev/blake3](https://github.com/fuzdev/blake3)                                                                         |
| Component model spec — WIT       | [WebAssembly/component-model WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md)             |
| Component model spec — Explainer | [WebAssembly/component-model Explainer](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md) |
| Rust patterns                    | ./rust-patterns.md                                                                                                        |
| Rust performance (arenas)        | ./rust-perf.md                                                                                                            |
