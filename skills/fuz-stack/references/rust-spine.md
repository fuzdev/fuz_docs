---
description: Spine crate map, consumer servers, env, daemon lifecycle
---

# Rust Spine & Consumer Servers

**Applies to**: the fuz workspace's spine crates and the servers that consume
them — `zzz_server`, `fuz_forge_server`, and the test-only
`testing_spine_stub`. The spine is the Rust twin of `fuz_app`'s TS backend
(auth, db, http, realtime, actions); the twin relationship itself is
./twin-impl.md. Consumers take the spine as **path deps to a sibling checkout
of the fuz repo** — not git URLs, not vendoring.

Shared shape/idiom conventions live in ./rust-patterns.md; this covers the
spine surface and the consumer contracts.

## Spine layers

The crates a consumer server actually names, by layer (the fuz workspace's
full ~35-crate inventory is its own repo's concern):

- **System leaves** — `fuz_sys` (OS/system: fs, file_lock, secure_file, pid,
  env, limits, cli; `logging`/`signal`/`tls` features), `fuz_home` (the
  `~/.fuz` layer), `fuz_crypto` (Ed25519 verify, `ContentHash`, canonical
  JSON), `fuz_eval` (sandboxed one-shot Deno eval). HTTP/DB-free by enforced
  rule, so anything can link them.
- **HTTP spine** — `fuz_http` (JSON-RPC envelope, IP/origin, lifecycle),
  `fuz_db` (pool + migrations), `fuz_auth` (keyring, sessions,
  `PasswordHasher`, bootstrap, audit), `fuz_actions` (action dispatch +
  `consumer_lifecycle`), `fuz_realtime` (WS/SSE connection registries),
  `fuz_cell` / `fuz_cell_actions` (cell storage / verbs), `fuz_fact` /
  `fuz_fact_serving` (content-addressed byte store / authz'd reads),
  `fuz_storage` (File/Forge/Ssh backends).
- **Tooling** — `fuz_audit` (dep-graph audit), `fuz_testing` (test-only
  impls, e.g. `TestingArgon2idHasher` — never shippable).

The `fuz_fact`/`fuz_cell` storage-vs-serving splits and the
`fuz_sys`/`fuz_home` leaf split are enforced by layering rules
(§xtask & check-release), not just convention.

## Server lifecycle — `run_app`

Each consumer server exposes `pub async fn run_app(options: RunAppOptions)`
— one entry point that both the production `main.rs` and the sibling
`testing_*_server` binary call, differing only in injected options. The test
binary (`testing_zzzd`, `testing_fuzfd`) wires
`fuz_testing::TestingArgon2idHasher` (weak, fast params) and registers
`_testing_*` actions; it is what the TS cross-backend suite launches, and the
`testing_` name prefix + `check-release` keep it unshippable.

Shared swap points:

- `password_hasher: Arc<dyn PasswordHasher>` — Argon2id vs the test hasher
- `extra_action_specs_factory` — the test binary registers `_testing_*`
  actions without `fuz_testing` entering the production dep graph
- `pre_migration_hook` — test-only DB setup

The `run_app` *body* is consumer-specific (domain App, migration set,
action-spec composition) and is not a shared helper. The boxed-closure
shapes — `ExtraActionSpecsFactory<App>`, `PreMigrationHook<E>`, and the
`ExtraActionSpecsRuntime` POD (`password_hasher` / `keyring` /
`daemon_token_state` / `session_cookie_name`, all `fuz_auth` types) — live in
`fuz_actions::consumer_lifecycle`, generic over `App` and `E` so
`fuz_testing` never enters the spine. (They belong in `fuz_actions`, not
`fuz_http::lifecycle`: `fuz_http` deps no spine crate, so it can't name
`fuz_auth` types.) Each consumer instantiates with a one-line concrete alias
— `pub type ExtraActionSpecsFactory =
fuz_actions::ExtraActionSpecsFactory<handlers::App>;` — its own type
definition, not a re-export shim.

`RunAppOptions` shares a bind/drain vocabulary — `default_addr: SocketAddr`
(strictly more expressive than a bare port; loopback-only consumers default
`127.0.0.1:<port>` and override only the port) + `drain_timeout: Duration`,
passed `fuz_http::DEFAULT_DRAIN_TIMEOUT` (10 s) rather than a per-crate
const. Remaining fields are legitimately per-consumer (zzz adds
`force_test_actions` and `disable_login_rate_limit`; the forge has neither) —
don't force one struct across consumers. Bind env-var *names* are also
per-consumer (`PORT`/`HOST` for the forge, `ZZZ_PORT` for zzz).

The daemon-token keeper wiring (`BootstrapKeeperResolved` adapter + boot-time
`query_keeper_account_id`) is spine-owned in `fuz_auth` — don't re-implement
per consumer.

## JSON-RPC envelope — `fuz_http` owns it

`fuz_http` owns the error constructors (`invalid_params(detail, reason)`,
`internal_error`, `internal_error_with_source`, `not_found`, `conflict`,
`forbidden`, `validation_error`, `rate_limited`) and the typed-params helper
`parse_params<T: DeserializeOwned>`. Consumers import these, never
re-declare — the wire envelope is what the cross-backend parity tests assert
byte-for-byte, and a local copy drifts. Prefer typed `#[derive(Deserialize)]`
input structs + `parse_params` over per-field
`params.get().and_then(Value::as_str)` chains (adoption is uneven — treat the
chains as migration debt, not a competing style).

`JsonrpcErrorCode` is a `#[repr(i32)]` enum with a hand-written `Serialize`
emitting the bare `i32` the wire requires — not scattered `pub const … :
i32`. Because `JsonrpcError.code` is the enum, `error_code_to_http_status` is
an *exhaustive* match: a new code is a compile error there, not a silent 500.
The TS twin is `fuz_app`'s `jsonrpc_errors`; consumers referencing a code use
the enum (`JsonrpcErrorCode::NotFound as i64`), never a magic number.

## Env loading

- **Injectable seam**: load through `from_vars(get: impl Fn(&str) ->
  Option<String>)` so tests inject a map instead of mutating process env —
  `fuz_forge_server`'s env struct is the exemplar, including a test that
  actively *rejects retired var names*. Route all env reads through the seam;
  audit for stray `std::env::var` in router code (both consumers still have
  a few — migration debt).
- **Fail loud, not just fail closed**: security-consequential misconfig
  refuses to boot, never warn-and-continue — an empty `FUZ_ALLOWED_ORIGINS`
  (empty allowlist = allow-all; the shared check is
  `fuz_http::require_non_empty_origins`), a *malformed* trusted-proxy list
  (unset defaults to loopback — that's fine), missing/weak cookie keys, and a
  failed `ActionRegistry::compile()` (an empty-registry fallback would
  silently answer `method_not_found` to everything).
- **Booleans** go through `fuz_sys::env::parse_stringbool` (the
  `z.stringbool()`-shaped closed set; unknown values error so a typo can't
  silently flip a feature).
- **Secret-shaped env names** carry the `SECRET_*` prefix — one contract
  across TS (`fuz_app` `BaseServerEnv`) and Rust.

## Consumer wiring idioms

- **`OnceLock` breaks the App ↔ registry capture cycle**: action-spec
  builders capture `Arc<App>` into handler closures, so the compiled registry
  can't exist until the App does — it lives in `App.action_registry:
  OnceLock<Arc<ActionRegistry>>`, `set()` after construction.
- **`ActionContext<'a>` is the borrowed per-request seam**: `notify: &dyn
  Fn(&str, &Value)`, `connection_id: Option<…>` (set on WS, `None` on HTTP),
  `signal: &CancellationToken` (threaded into providers), `request_id`.
- **Streaming needs an owned sender**: the borrowed `notify` can't be
  captured into a `'static` closure, so zzz's provider streaming builds a
  per-request `ProgressSender = Box<dyn Fn(Value) + Send + Sync>` — only when
  the request carries a progress token *and* arrived over WS — wrapping
  chunks with `fuz_http::notification(…)` and routing through
  `Arc<fuz_realtime::ConnectionRegistry>::send_to(conn_id, …)`. HTTP requests
  get `None` → non-streaming.
- **Migration namespaces compose**: substrate DDL lives in the owning spine
  crate (`fuz_auth::AUTH_MIGRATIONS`, `fuz_cell::CELL_MIGRATIONS`,
  `fuz_fact::FACT_MIGRATIONS`); the consumer composes them with its own
  namespace via `fuz_db::run_migrations`, ordering for FKs (auth first). A
  consumer's own namespace should be small — the forge's is a single
  token-policy table.
- **Loopback-gated internal routes**: `/internal/*` callbacks check the
  `ConnectInfo<SocketAddr>` peer is loopback *and* a per-resource secret —
  X-Forwarded-For can't fake the peer address.
- **Server boot errors carry the CLI exit-code policy**: a `StartupError`
  with `exit_code()` mapping `Config → 2`, everything else `→ 1` — the
  remediation-keyed dialect from ./rust-patterns.md §CLI Patterns applied to
  a server binary.
- **Subprocess harness**: `SpawnOptions` + `spawn_collect`/`spawn_streaming`
  with an env-isolating spawn and a capped output drain lives in
  `fuz_forge_server` (deliberately local until a second consumer needs it —
  the promotion candidate is a spine-free leaf crate).

## Daemon lifecycle — two layers

1. **Server-side graceful shutdown is shared.** The signal →
   `CancellationToken` half is `fuz_sys::signal::shutdown_token()` (behind
   the `signal` feature); `fuz_http::lifecycle` re-exports it and adds
   `serve_with_shutdown` for the axum consumers. `fuzd` (UDS, no axum) calls
   `fuz_sys::signal` directly. This split is why `fuz_sys` (home-agnostic OS
   leaf) and `fuz_home` (the `~/.fuz` layer) are separate crates: the HTTP
   spine shares the primitive without inheriting fuz's home conventions.
2. **Client-side CLI lifecycle splits by transport.**
   - `fuzd`'s UDS lifecycle lives in `fuz_daemon`: v2 `daemon.json`
     (`socket_path`, no port), `Hello`-based health over `fuz_client`,
     `DaemonState { Running(info) | Stopped | Stale(info) }` with a single
     `get_daemon_state()` resolver.
   - zzz's HTTP lifecycle is deliberately **local to zzz's CLI**: a
     port-based `DaemonInfo { version, pid, port, started, app_version }`
     (schema shared with `fuz_app` TS) + a reqwest `/health` probe + a
     `Wedged(info)` arm for "pid alive, `/health` silent". It reuses the
     `fuz_sys` primitives (`fuz_sys::{is_pid_alive, send_signal,
     rfc3339_now}`, `fuz_sys::fs::write_atomic`) but **not** `fuz_home` —
     the `fuz_home` daemon helpers model the UDS schema, which doesn't fit
     HTTP/port. `daemon.json` here is world-readable `0o644` on purpose (no
     secrets in it).
   - Model liveness as the `DaemonState` enum + one resolver — not scattered
     `pid_alive`/`healthy` boolean pairs handled differently per command.
     Don't build a transport-generic lifecycle crate for a single HTTP
     consumer; extract only when a second HTTP CLI daemon-manager appears.
   - The HTTP lifecycle must never enter the `fuz`/`fuzd` dependency graph
     (`reqwest`; `check-release` already forbids `fuz_daemon`/`fuz_client`
     from `fuz`).

## xtask & check-release

Every spine-consuming workspace's `xtask` wraps the shared dep-graph audit;
don't hand-roll it:

- `fuz_audit::xtask_main()` — a complete single-subcommand xtask (the forge's
  3-line `main`).
- `fuz_audit::run_check_release_cli()` — for workspaces with their own
  subcommand router (zzz, zap).
- `run_check_release_cli_with_rules(&AuditRules)` — the rules-taking entry
  point. `AuditRules` is one POD: `extra_forbidden: &[&str]` (the fuz
  workspace adds `fuz_sign` so its `fuz` binary can never sign) +
  `per_binary: &[PerBinaryForbid]` (`fuz`/`fuzd` must not link `fuzi_*`).
  Only the fuz workspace passes rules; the no-arg consumers stay insulated.
- Exit codes are three-way sysexits: clean → 0, policy violation → 65,
  tooling failure → 69/70.

`BUILTIN_CRATE_LAYERING` — per-crate *library* layering applied
unconditionally in every workspace (absent subjects are skipped; the OK
output lists subjects actually checked so a renamed crate is visible, not
skipped green). Each rule says a library must not transitively
(runtime-)depend on a forbidden set. The four today:

| Subject | Must not reach | Invariant |
| ------- | -------------- | --------- |
| `fuz_fact` | `axum`, `fuz_http`, `fuz_cell`, `fuz_auth`, `fuz_actions` | bytes escape only through the authz'd `fuz_fact_serving` |
| `fuz_cell` | `fuz_actions` | storage/authz half can't reach the verb layer |
| `fuz_sys` | `axum`, `fuz_http` | the OS leaf stays HTTP-free |
| `fuz_home` | `axum`, `fuz_db`, `fuz_http` | the `~/.fuz` layer stays HTTP/DB-free |

The `fuz_cell` rule is deliberately narrower than `fuz_fact`'s — it
legitimately reaches `axum`/`fuz_http` transitively via `fuz_auth`, and the
BFS runs over the runtime graph, so a rule must account for what a subject's
legitimate deps already pull. Grow the table one rule per real, load-bearing
invariant — no speculative rules.

The `[package.metadata.fuz_audit] dev_only = true` stanza on each xtask crate
is the one piece of config that can't be workspace-inherited. Why the
forbidden capabilities are separate crates rather than cargo features:
./rust-dependencies.md §Crate-vs-feature isolation.
