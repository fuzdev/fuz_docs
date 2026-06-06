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

- **Publishing to npm**: wasm-bindgen
- **Benchmarking across runtimes**: both
- **Plugin systems** (speculative): component model

## WIT Interface Design

### Package naming

```wit
package fuzdev:blake3@0.0.1;
```

Format: `<namespace>:<name>@<version>`. Use `fuzdev` namespace.

### Kebab-case identifiers

WIT **requires** kebab-case (rejects snake_case/camelCase); binding generators
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
  computation, no ambient access

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
- **Struct + `export!`** — unit struct implements the `Guest` trait
- **`RefCell` for resource state** — resources receive `&self`, need interior
  mutability
- **Static factories return `hashing::Hasher`** wrapping the resource struct
- **Cannot use `lints.workspace = true`** — `wit-bindgen` generates
  `#[export_name]` and unsafe ABI stubs, so override `unsafe_code = "allow"` and
  **re-declare the rest of the workspace lints** (./rust-patterns.md §Lints —
  overriding only `unsafe_code` silently drops the restriction-lint floor).

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
under `target`, not directly under `component`.

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

Resources must be dropped explicitly. Host owns the handle; guest owns memory.

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

- `&[u8]` and `&mut self` — wasm-bindgen handles borrowing, no `RefCell`
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
more efficient than JSON strings. `parse_internal_*()` benchmarks skip
serialization via `std::hint::black_box()`.

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
- `stream.js` — stream functions
- `index.d.ts` — type declarations

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

Built via `make_stream_functions(Blake3Hasher)`. Browser entry passes a
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
Node.js/Deno (sync init); must be awaited in browsers.

See §Two Packages for the build config and `Cargo.toml` for blake3's two
wasm-bindgen crates. tsv_wasm runs wasm-opt with explicit feature flags so it
works on Rust 2024 output — bulk-memory and nontrapping-float-to-int are passed
by name (without them wasm-opt fails on Rust 2024's bulk-memory ops):

```toml
[package.metadata.wasm-pack.profile.release]
wasm-opt = ['-O3', '--enable-bulk-memory', '--enable-nontrapping-float-to-int']
```

## Multiple Binding Crates (tsv pattern)

A library targeting several runtimes keeps one binding crate per technology,
all exporting identical signatures so consumers choose by runtime:

| Crate      | Technology   | Target               | Error type           |
| ---------- | ------------ | -------------------- | -------------------- |
| `tsv_wasm` | wasm-bindgen | Deno, browsers, Node | `Result<T, JsError>` |
| `tsv_ffi`  | C ABI        | Deno FFI, Python     | JSON error objects   |

**Published surface is WASM and C-FFI only.** npm gets the wasm-bindgen
packages; the C-FFI `cdylib` serves Deno FFI and Python. N-API is not
supported — the deliberate stance is a clean break from Node-native,
WASM-to-npm.

- `parse_internal_*()` benchmarks skip serialization via `black_box()`
- `tsv_ffi` requires `unsafe_code = "allow"` (raw pointers / ABI stubs);
  re-declare the rest of the workspace lints — see ./rust-patterns.md §Lints
- `tsv_ffi` uses raw pointers with `tsv_free(ptr, len)` for memory management

## Package naming: `_wasm` suffix

WASM artifacts carry a `_wasm` suffix everywhere they could be confused with a
native build; native (FFI) artifacts stay bare. The suffix is part of the
published identity — npm package, crate name, and the generated `*_wasm_bg.wasm`
all agree — not just an internal label.

| Project | WASM packages | Native |
| ------- | ------------- | ------ |
| blake3 | `@fuzdev/blake3_wasm` (SIMD), `@fuzdev/blake3_wasm_small` (no SIMD) | none published |
| tsv | `@fuzdev/tsv_format_wasm` (format), `@fuzdev/tsv_parse_wasm` (parse + AST) | `tsv` (`tsv_ffi` C-ABI build, not on npm) |

- **Native stays bare.** blake3 publishes no native binding; tsv's native FFI
  lib is just `tsv` in tooling (one `.so` exposing every function), while the
  WASM surface splits into the `_wasm`-suffixed pieces.
- **Drop redundant kind labels.** Where artifacts are already grouped by kind
  (a "WASM modules" vs "Native binaries" table, say), don't repeat `(wasm)` /
  `(native)` in the row name — the `_wasm` suffix (or its absence) carries it.
- **Pieces vs. umbrella.** Both libraries ship two related WASM packages, split
  on a build axis: blake3 on SIMD (`_wasm` vs `_wasm_small`), tsv on the
  `ast` / `convert` feature (format-only `tsv_format_wasm` vs parse + AST
  `tsv_parse_wasm`). tsv additionally reserves a full `@fuzdev/tsv_wasm`
  umbrella (parse + format + future tooling), with the two pieces as the
  independently-shippable subsets.

## Two Packages, Not Two Profiles

blake3 ships two npm packages from different crates. Both are
size-optimized end-to-end (`opt-level=s` + wasm-opt `-Os`); the only
differentiator is SIMD:

| Package                     | Crate              | RUSTFLAGS                                   | wasm-opt              | Size   |
| --------------------------- | ------------------ | ------------------------------------------- | --------------------- | ------ |
| `@fuzdev/blake3_wasm`       | `blake3_wasm`      | `-C opt-level=s -C target-feature=+simd128` | `-Os --enable-simd …` | ~47 KB |
| `@fuzdev/blake3_wasm_small` | `blake3_wasm_small`| `-C opt-level=s`                            | `-Os …`               | ~32 KB |

SIMD build: ~2.6x faster at large inputs (Deno/Node), slower on Bun (WASM
SIMD regression). Use the small build for Bun and bundle-size-sensitive
contexts. The wasmtime component (`build:component`) is the exception — it
uses `opt-level=3` because the host can absorb more bytes for speed.

```toml
# blake3_wasm (SIMD)
[package.metadata.wasm-pack.profile.release]
wasm-opt = ["-Os", "--enable-simd", "--enable-bulk-memory", "--enable-nontrapping-float-to-int", "--enable-mutable-globals", "--enable-sign-ext", "--strip-producers"]

[dependencies]
blake3_wasm_core = { path = "../blake3_wasm_core", features = ["simd"] }
```

blake3_wasm_small is the same minus `--enable-simd` and without the `simd`
feature on the core crate.

Rust 2024 enables bulk memory for `wasm32-unknown-unknown`, so wasm-opt
needs `--enable-bulk-memory` (and friends) or it fails with "Bulk memory
operations require bulk memory". `--strip-producers` removes compiler
metadata (~26 bytes).

### Build commands

```bash
RUSTFLAGS='-C opt-level=s -C target-feature=+simd128' \
    wasm-pack build crates/blake3_wasm --scope fuzdev --target deno --release --out-dir pkg/deno

RUSTFLAGS='-C opt-level=s' \
    wasm-pack build crates/blake3_wasm_small --scope fuzdev --target deno --release --out-dir pkg/deno
```

**Why RUSTFLAGS**: `wasm-pack` doesn't support `--profile` (conflicts with
`--release`), so RUSTFLAGS overrides at the compiler level.

Build pipeline runs both packages in parallel; deno and web targets run
sequentially within each (shared cargo intermediate artifacts).

### Release profile

```toml
[profile.release]
opt-level = "s"      # Base: size-optimized (overridden by RUSTFLAGS)
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

### deno compile compatibility

wasm-bindgen's deno target uses `fetch()` to load WASM, incompatible with
`deno compile`. Build pipeline patches generated JS to use
`Deno.readFileSync` and creates a `_bg.js` stub for module resolution.

## Cross-References

| Resource                         | Link                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Blake3 WASM bindings             | [fuzdev/blake3](https://github.com/fuzdev/blake3)                               |
| Component model spec — WIT       | [WebAssembly/component-model WIT](https://github.com/WebAssembly/component-model/blob/main/design/mvp/WIT.md) |
| Component model spec — Explainer | [WebAssembly/component-model Explainer](https://github.com/WebAssembly/component-model/blob/main/design/mvp/Explainer.md) |
| Rust patterns (WASM errors)      | ./rust-patterns.md                                                              |
| Rust performance                 | ./rust-perf.md                                                                  |
