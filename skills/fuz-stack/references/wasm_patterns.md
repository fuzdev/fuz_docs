# WASM Patterns for the Fuz Ecosystem

**Applies to**: `blake3` (WASM hashing), `tsv` (parser/formatter bindings).
`fuz` does not currently use WASM.

## Two Build Targets

| Approach       | Tool           | Consumer            | Use case                        |
| -------------- | -------------- | -------------------- | ------------------------------- |
| wasm-bindgen   | `wasm-pack`    | JS runtimes          | Ship Rust to Deno/Node/browsers |
| Component model | `cargo-component` | Wasmtime / plugins | Sandboxed execution, composition |

**wasm-bindgen**: generates glue code, handles memory management, produces
`.wasm` + `.js` ready to import.

**Component model**: capability-controlled execution. Components declare
imports/exports via WIT interfaces for sandboxing and composition.

### When to use which

- **Publishing to JSR/npm**: wasm-bindgen
- **Benchmarking across runtimes**: both
- **Plugin systems** (speculative): component model

## WIT Interface Design

### Package naming

```wit
package fuzdev:blake3@0.0.1;
```

Format: `<namespace>:<name>@<version>`. Use `fuzdev` namespace.

### Kebab-case identifiers

WIT **requires** kebab-case (rejects snake_case/camelCase). Binding generators
convert to idiomatic casing per language.

### World and interface structure

From `blake3/wit/blake3.wit`:

```wit
interface hashing {
    enum hash-error {
        invalid-key-length,
    }

    hash: func(data: list<u8>) -> list<u8>;
    keyed-hash: func(key: list<u8>, data: list<u8>) -> result<list<u8>, hash-error>;
    derive-key: func(context: string, key-material: list<u8>) -> list<u8>;

    resource hasher {
        constructor();
        new-keyed: static func(key: list<u8>) -> result<hasher, hash-error>;
        new-derive-key: static func(context: string) -> hasher;
        update: func(data: list<u8>);
        finalize: func() -> list<u8>;
        finalize-and-reset: func() -> list<u8>;
        reset: func();
    }
}

world blake3 {
    export hashing;
}
```

### Design principles

- **One-shot functions** for stateless operations
- **Resources** for stateful streaming (`hasher` holds state across
  `update`/`finalize`)
- **`result<T, E>`** with typed error enums (not strings) for fallible ops
- **Minimal error enums** — one variant per distinct failure mode
- **Worlds declare capabilities** — `export hashing` with no imports = pure
  computation

## Component Implementation (wit-bindgen)

From `blake3/crates/blake3_component/src/lib.rs`:

```rust
use std::cell::RefCell;
use exports::fuzdev::blake3::hashing;

wit_bindgen::generate!({
    path: "../../wit",
    world: "blake3",
});

struct Component;

export!(Component);

impl hashing::Guest for Component {
    type Hasher = HasherResource;

    fn hash(data: Vec<u8>) -> Vec<u8> {
        blake3::hash(&data).as_bytes().to_vec()
    }

    fn keyed_hash(key: Vec<u8>, data: Vec<u8>) -> Result<Vec<u8>, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(blake3::keyed_hash(&key, &data).as_bytes().to_vec())
    }

    fn derive_key(context: String, key_material: Vec<u8>) -> Vec<u8> {
        blake3::derive_key(&context, &key_material).to_vec()
    }
}

struct HasherResource {
    inner: RefCell<blake3::Hasher>,
}

impl hashing::GuestHasher for HasherResource {
    fn new() -> Self {
        Self { inner: RefCell::new(blake3::Hasher::new()) }
    }

    fn new_keyed(key: Vec<u8>) -> Result<hashing::Hasher, hashing::HashError> {
        let key: [u8; 32] = key
            .try_into()
            .map_err(|_: Vec<u8>| hashing::HashError::InvalidKeyLength)?;
        Ok(hashing::Hasher::new(HasherResource {
            inner: RefCell::new(blake3::Hasher::new_keyed(&key)),
        }))
    }

    fn new_derive_key(context: String) -> hashing::Hasher {
        hashing::Hasher::new(HasherResource {
            inner: RefCell::new(blake3::Hasher::new_derive_key(&context)),
        })
    }

    fn update(&self, data: Vec<u8>) {
        self.inner.borrow_mut().update(&data);
    }

    fn finalize(&self) -> Vec<u8> {
        self.inner.borrow().finalize().as_bytes().to_vec()
    }

    fn finalize_and_reset(&self) -> Vec<u8> {
        let mut inner = self.inner.borrow_mut();
        let result = inner.finalize().as_bytes().to_vec();
        inner.reset();
        result
    }

    fn reset(&self) {
        self.inner.borrow_mut().reset();
    }
}
```

### Key patterns

- **`wit_bindgen::generate!`** generates bindings at compile time from WIT
- **Struct + `export!`** — unit struct implements `Guest` trait
- **`RefCell` for resource state** — resources receive `&self`, need interior
  mutability
- **Static factories return `hashing::Hasher`** wrapping the resource struct
- **Cannot use `lints.workspace = true`** — `wit-bindgen` generates
  `#[export_name]` and unsafe ABI stubs. Must override `unsafe_code = "allow"`.

### Cargo.toml for component crates

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
blake3 = { workspace = true, features = ["wasm32_simd"] }
wit-bindgen.workspace = true

# Cannot use `lints.workspace = true` because wit-bindgen generates unsafe stubs
[lints.rust]
unsafe_code = "allow"

[package.metadata.component]
package = "fuzdev:blake3"

[package.metadata.component.target]
world = "blake3"
path = "../../wit"
```

`[package.metadata.component.target]` is a sub-table — `world` and `path` go
under `target`, not under `component`.

### Build

```bash
RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128' \
    cargo component build -p blake3_component --release
```

Requires `cargo-component` and `wasm32-wasip1` target.

## Host-Side Embedding (wasmtime)

```rust
wasmtime::component::bindgen!({
    path: "../../wit",
    world: "blake3",
});

struct HostState {
    ctx: WasiCtx,
    table: ResourceTable,
}

impl WasiView for HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView { ctx: &mut self.ctx, table: &mut self.table }
    }
}

// Setup
let engine = wasmtime::Engine::new(
    wasmtime::Config::new().wasm_component_model(true)
)?;

let mut linker = wasmtime::component::Linker::new(&engine);
wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;

let component = wasmtime::component::Component::from_file(&engine, wasm_path)?;
let mut store = wasmtime::Store::new(&engine, HostState { ctx, table });

// Instantiate and call
let instance = Blake3::instantiate(&mut store, &component, &linker)?;
let hashing = instance.fuzdev_blake3_hashing();
let digest = hashing.call_hash(&mut store, data)?;
```

### Resource lifecycle on the host

```rust
let hasher = hashing.hasher().call_constructor(&mut store)?;

hashing.hasher().call_update(&mut store, hasher, chunk)?;
let result = hashing.hasher().call_finalize(&mut store, hasher)?;

// Drop resource — required to free guest memory
hasher.resource_drop(&mut store)?;
```

Resources must be explicitly dropped. Host owns the handle; guest owns memory.

## wasm-bindgen Patterns

### Crate architecture (blake3)

Shared core crate with thin wrappers:

| Crate              | Type    | Purpose                                |
| ------------------ | ------- | -------------------------------------- |
| `blake3_wasm_core` | `rlib`  | Shared wasm-bindgen exports + TS types |
| `blake3_wasm`      | `cdylib + rlib` | SIMD build (enables `blake3/wasm32_simd`)  |
| `blake3_wasm_small`| `cdylib + rlib` | Size-optimized build (no SIMD)             |

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
    pub fn new_derive_key(context: &str) -> Self { /* ... */ }
    pub fn update(&mut self, data: &[u8]) { self.inner.update(data); }
    pub fn finalize(&self) -> Vec<u8> { self.inner.finalize().as_bytes().to_vec() }
    pub fn finalize_and_reset(&mut self) -> Vec<u8> { /* finalize + reset in one call */ }
    pub fn reset(&mut self) { self.inner.reset(); }
}
```

**Differences from component model**:

- `&[u8]` and `&mut self` — wasm-bindgen handles borrowing. No `RefCell`.
- `JsError` for errors — string messages, not typed enums
- `free()` and `Symbol.dispose` generated by wasm-bindgen automatically

### tsv wasm-bindgen patterns

Uses `serde-wasm-bindgen` for complex return types (ASTs):

```rust
#[wasm_bindgen]
pub fn parse_svelte(source: &str) -> Result<JsValue, JsError> {
    let ast = tsv_svelte::parse(source).map_err(|e| JsError::new(&e.to_string()))?;
    let public = tsv_svelte::convert_ast(&ast, source);
    serde_wasm_bindgen::to_value(&public)
        .map_err(|e| JsError::new(&e.to_string()))
}
```

`serde_wasm_bindgen::to_value()` converts serde types directly to `JsValue` —
more efficient than JSON strings. Also provides `parse_internal_*()` benchmarks
that skip serialization via `std::hint::black_box()`.

### TypeScript entry points

Re-export from wasm-pack's `pkg/` output and add stream functions:

```typescript
import { Blake3Hasher, derive_key, hash, keyed_hash } from './pkg/deno/blake3_wasm.js';
export { Blake3Hasher, derive_key, hash, keyed_hash };
export type { Blake3HasherInstance } from './types.ts';
export type { StreamFunctions } from './stream.ts';

import { make_stream_functions } from './stream.ts';
export const { hash_stream, keyed_hash_stream, derive_key_stream } = make_stream_functions(
    Blake3Hasher,
);
```

Node entry uses synchronous initialization:

```typescript
import { readFileSync } from 'node:fs';
import { Blake3Hasher, derive_key, hash, initSync, keyed_hash } from './pkg/web/blake3_wasm.js';

const wasm = readFileSync(new URL('./pkg/web/blake3_wasm_bg.wasm', import.meta.url));
initSync({ module: wasm });
```

### npm package structure

`scripts/patch_npm_package.ts` generates:

- `index.js` — Node.js: auto-init via `readFileSync` + `initSync`
- `browser.js` — Browser: async `init()`, exports guarded with `_check()`
- `stream.js` — Stream functions
- `index.d.ts` — Type declarations

Package exports use `"node"` / `"default"` conditions.

### Symbol.dispose usage

```typescript
using hasher = new Blake3Hasher();
hasher.update(data);
const digest = hasher.finalize();
// hasher.free() called automatically at scope exit
```

### Shared TypeScript interfaces

```typescript
export interface Blake3HasherInstance {
    update(data: Uint8Array): void;
    finalize(): Uint8Array;
    finalize_and_reset(): Uint8Array;
    reset(): void;
    free(): void;
    [Symbol.dispose](): void;
}

export interface Blake3HasherConstructor {
    new (): Blake3HasherInstance;
    new_keyed(key: Uint8Array): Blake3HasherInstance;
    new_derive_key(context: string): Blake3HasherInstance;
}
```

### Stream convenience functions

16 KB batch size to reduce WASM boundary crossings:

```typescript
const digest = await hash_stream(file.stream());
const keyed = await keyed_hash_stream(key, file.stream());
const derived = await derive_key_stream('context', file.stream());
```

Built via `make_stream_functions(Blake3Hasher)`. Browser entry passes
`_check` callback to guard against uninitialized WASM.

### Consumer API (fuz_util)

`@fuzdev/fuz_util/hash_blake3.ts` wraps blake3_wasm:

```typescript
import { hash, init } from '@fuzdev/blake3_wasm';

export const blake3_ready = init(); // Eagerly start WASM initialization
export const hash_blake3 = (data: BufferSource | string): string =>
    to_hex(hash(to_bytes(data)));
```

Returns 64-character hex strings. `blake3_ready` resolves immediately in
Node.js/Deno (sync init), must be awaited in browsers.

### Cargo.toml for wasm-bindgen crates

blake3_wasm:

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-O3", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core", features = ["simd"] }
wasm-bindgen.workspace = true
```

blake3_wasm_small:

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Os", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core" }  # no simd feature
wasm-bindgen.workspace = true
```

tsv_wasm:

```toml
[lib]
crate-type = ["cdylib", "rlib"]

[package.metadata.wasm-pack.profile.release]
wasm-opt = false  # Disabled until wasm-opt supports Rust 2024's bulk memory

[dependencies]
wasm-bindgen = "0.2"
serde-wasm-bindgen = "0.6"
```

## Multiple Binding Crates (tsv pattern)

| Crate      | Technology     | Target              | Error type           |
| ---------- | -------------- | -------------------- | -------------------- |
| `tsv_wasm` | wasm-bindgen   | Deno, browsers, Node | `Result<T, JsError>` |
| `tsv_napi` | napi-rs        | Node.js, Bun         | `napi::Result<T>`    |
| `tsv_ffi`  | C ABI          | Deno FFI, Python     | JSON error objects    |

All export identical signatures. Consumers choose by runtime.

- `parse_internal_*()` benchmarks skip serialization via `black_box()`
- N-API requires `unsafe_code = "allow"`
- FFI uses raw pointers with `tsv_free(ptr, len)` for memory management

## Two Packages, Not Two Profiles

blake3 ships two npm packages from different crates:

| Package                     | Crate              | RUSTFLAGS                                | wasm-opt   | Size    |
| --------------------------- | ------------------ | ---------------------------------------- | ---------- | ------- |
| `@fuzdev/blake3_wasm`       | `blake3_wasm`      | `-C opt-level=3 -C target-feature=+simd128` | `-O3 --enable-simd` | ~47 KB |
| `@fuzdev/blake3_wasm_small` | `blake3_wasm_small` | `-C opt-level=s`                         | `-Os`      | ~32 KB |

SIMD build: ~2.6x faster at large inputs (Deno/Node), slower on Bun (WASM
SIMD regression). Small build for Bun and bundle-size-sensitive contexts.

### Build commands

```bash
# SIMD build
RUSTFLAGS='-C opt-level=3 -C target-feature=+simd128' \
    wasm-pack build crates/blake3_wasm --scope fuzdev --target deno --release --out-dir pkg/deno

# Size-optimized build
RUSTFLAGS='-C opt-level=s' \
    wasm-pack build crates/blake3_wasm_small --scope fuzdev --target deno --release --out-dir pkg/deno
```

**Why RUSTFLAGS**: `wasm-pack` doesn't support `--profile` (conflicts with
`--release`). RUSTFLAGS overrides at the compiler level.

Build pipeline runs both packages in parallel; deno and web targets sequential
within each (shared cargo intermediate artifacts).

### Release profile

```toml
[profile.release]
opt-level = "s"      # Base: size-optimized (overridden by RUSTFLAGS)
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### wasm-opt

Per-crate with explicit feature flags. Rust 2024 enables bulk memory for
`wasm32-unknown-unknown`, so wasm-opt must know:

```toml
# blake3_wasm — speed-optimized, SIMD
wasm-opt = ["-O3", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

# blake3_wasm_small — size-optimized, no SIMD
wasm-opt = ["-Os", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]
```

Without `--enable-*` flags, wasm-opt fails with "Bulk memory operations
require bulk memory". `--strip-producers` removes compiler metadata (~26 bytes).

### deno compile compatibility

wasm-bindgen's deno target uses `fetch()` to load WASM, incompatible with
`deno compile`. Build pipeline patches generated JS to use
`Deno.readFileSync`, creates `_bg.js` stub for module resolution.

## Cross-References

| Resource                         | Link                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Blake3 WASM bindings             | [fuzdev/blake3](https://github.com/fuzdev/blake3)                               |
| tsv WASM bindings                | `private_tsv/crates/tsv_wasm/`                                                  |
| Component model spec — WIT       | [WebAssembly/component-model WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md) |
| Component model spec — Explainer | [WebAssembly/component-model Explainer](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md) |
| Rust conventions (WASM errors)   | `references/rust_conventions.md`                                                |
