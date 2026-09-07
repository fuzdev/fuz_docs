---
description: Spine crate map, consumer servers, env, daemon lifecycle
---

# Rust Spine & Consumer Servers

**Applies to**: the fuz workspace's spine crates and the servers consuming
them — `zzz_server`, `fuz_forge_server`, the test-only `testing_spine_stub`.
The spine is the Rust twin of `fuz_app`'s TS backend (./twin-impl.md).
Consumers take the spine as **path deps to a sibling checkout of the fuz
repo** — not git URLs, not vendoring. Shape/idiom conventions:
./rust-patterns.md; this covers the spine surface and consumer contracts.
This doc is the deliberate exception to the conventions-not-inventory rule:
consumer authors need the spine's names in one place, so it carries them.

## Spine layers

The crates a consumer server names (the full ~35-crate inventory is the fuz
repo's concern):

- **System leaves** — `fuz_sys` (fs, file_lock, secure_file, pid, env,
  limits, cli; `logging`/`signal`/`tls` features), `fuz_home` (the `~/.fuz`
  layer), `fuz_crypto` (Ed25519 verify, `ContentHash`, canonical JSON),
  `fuz_eval` (sandboxed one-shot Deno eval). HTTP/DB-free by enforced rule.
- **HTTP spine** — `fuz_http` (JSON-RPC envelope, IP/origin, lifecycle),
  `fuz_db` (pool + migrations), `fuz_auth` (keyring, sessions,
  `PasswordHasher`, bootstrap, audit), `fuz_actions` (dispatch +
  `consumer_lifecycle`), `fuz_realtime` (WS/SSE registries), `fuz_cell` /
  `fuz_cell_actions` (storage / verbs), `fuz_fact` / `fuz_fact_serving`
  (content-addressed bytes / authz'd reads), `fuz_storage` (File/Forge/Ssh).
- **Tooling** — `fuz_audit` (dep-graph audit), `fuz_testing` (test-only
  impls, e.g. `TestingArgon2idHasher` — never shippable).

Consumers also name `fuz_db_admin`, `fuz_release`, `fuz_sign` (the forge) and
`fuz_pty` (zzz). The storage-vs-serving splits and the `fuz_sys`/`fuz_home`
leaf split are enforced by layering rules (§xtask & check-release).

## Server lifecycle — `run_app`

Each consumer exposes `pub async fn run_app(options: RunAppOptions)` — one
entry point that both the production `main.rs` and the sibling
`testing_*_server` binary (`testing_zzzd`, `testing_fuzfd`) call, differing
only in injected options. The test binary wires `TestingArgon2idHasher` and
registers `_testing_*` actions; it's what the TS cross-backend suite launches,
and the `testing_` prefix + `check-release` keep it unshippable. Swap points:

- `password_hasher: Arc<dyn PasswordHasher>`
- `extra_action_specs_factory` — `_testing_*` actions without `fuz_testing`
  entering the production graph
- `pre_migration_hook` — test-only DB setup
- `daemon_token_state` — production `None`; the producer is confined to
  `fuz_testing` by the dep graph

The `run_app` _body_ is consumer-specific (domain App, migrations, action-spec
composition), not a shared helper. The boxed-closure shapes —
`ExtraActionSpecsFactory<App>`, `PreMigrationHook<E>`, the
`ExtraActionSpecsRuntime` POD (`password_hasher` / `keyring` /
`daemon_token_state` / `session_cookie_name`, all `fuz_auth` types) — live in
`fuz_actions::consumer_lifecycle`, generic over `App` and `E` so `fuz_testing`
never enters the spine. (Not in
`fuz_http::lifecycle`: `fuz_http` deps no spine crate, so it can't name
`fuz_auth` types.) Each consumer instantiates with a one-line concrete alias
(`pub type ExtraActionSpecsFactory = fuz_actions::ExtraActionSpecsFactory<handlers::App>;`)
— its own definition, not a re-export shim.

`RunAppOptions` shares a bind/drain vocabulary: `default_addr: SocketAddr`
(more expressive than a bare port; loopback-only consumers default
`127.0.0.1:<port>` and override only the port), `drain_timeout: Duration`
passed `fuz_http::DEFAULT_DRAIN_TIMEOUT` (10 s), and
`rate_limiters: fuz_auth::RateLimiterMode`. Remaining fields are per-consumer (zzz adds
`force_test_actions`) — don't force one struct across consumers; bind env-var
names are per-consumer too (`PORT`/`HOST` forge, `ZZZ_PORT` zzz).

**Every spine rate limiter is built through `RateLimiterMode`** —
`mode.limiter(fuz_auth::DEFAULT_LOGIN_IP_RATE_LIMIT)`, never
`Some(Arc::new(RateLimiter::new(…)))` + a conditional null. Production passes
`Enforced`; the `testing_*` binary passes `DisabledForTesting` — the twin of
`fuz_app`'s testing wiring (a cross-process suite's failed-login cases would
otherwise exhaust the per-IP budget). Building through the mode keeps a newly wired
surface from staying enforced while the rest is disabled, and any process that
nulls a limiter prints a startup banner (same fail-loud shape as
`TestingArgon2idHasher`). Consumer-owned limiters that aren't spine surfaces
(visiones's upload caps) stay live in both modes.

The daemon-token keeper wiring (`BootstrapKeeperResolved` + boot-time
`query_keeper_account_id`) is spine-owned in `fuz_auth` — don't re-implement.

## JSON-RPC envelope — `fuz_http` owns it

`fuz_http` owns the error constructors (`invalid_params(detail, reason)`,
`internal_error`, `internal_error_with_source`, `not_found`, `conflict`,
`forbidden`, `validation_error`, `rate_limited`) and `parse_params<T: DeserializeOwned>`. Consumers import, never re-declare — the envelope is what
parity tests assert byte-for-byte. Prefer typed `#[derive(Deserialize)]` input
structs + `parse_params` over `params.get().and_then(Value::as_str)` chains
(the chains are migration debt).

`JsonrpcErrorCode` is a `#[repr(i32)]` enum with a hand-written `Serialize`
emitting the bare `i32` — not scattered `pub const … : i32`. Because
`JsonrpcError.code` is the enum, `error_code_to_http_status` is exhaustive: a
new code is a compile error, not a silent 500. TS twin: `fuz_app`'s
`jsonrpc_errors`; consumers use `JsonrpcErrorCode::NotFound as i64`, never a
magic number.

## Env loading

- **Injectable seam**: load through `from_vars(get: impl Fn(&str) -> Option<String>)` so tests inject a map — `fuz_forge_server`'s env struct is
  the exemplar, including a test that _rejects retired var names_. Audit for
  stray `std::env::var` in router code (both consumers still have a few).
- **Fail loud, not just closed**: security-consequential misconfig refuses to
  boot — an empty `FUZ_ALLOWED_ORIGINS` (empty allowlist = allow-all;
  `fuz_http::require_non_empty_origins`), a _malformed_ trusted-proxy list
  (unset → loopback is fine), missing/weak cookie keys, a failed
  `ActionRegistry::compile()` (an empty-registry fallback would answer
  `method_not_found` to everything).
- **Booleans** via `fuz_sys::env::parse_stringbool` (the `z.stringbool()`
  closed set; unknown values error).
- **Secret-shaped names** carry the `SECRET_*` prefix — one contract across TS
  (`fuz_app` `BaseServerEnv`) and Rust.

## Consumer wiring idioms

- **`OnceLock` breaks the App ↔ registry cycle**: action-spec builders capture
  `Arc<App>` into handler closures, so the compiled registry can't exist until
  the App does — `App.action_registry: OnceLock<Arc<ActionRegistry>>`, `set()`
  after construction.
- **`ActionContext<'a>` is the borrowed per-request seam**: `notify: &dyn Fn(&str, &Value)`, `connection_id: Option<…>` (set on WS, `None` on HTTP),
  `signal: &fuz_realtime::SignalToken` (alias of `CancellationToken`, threaded
  into providers),
  `request_id`, plus `db`, `auth`, `audit`, `log`, `client_ip`,
  `credential_type`, `post_commit_effects`.
- **Streaming needs an owned sender**: the borrowed `notify` can't be captured
  into a `'static` closure, so zzz builds a per-request `ProgressSender = Box<dyn Fn(Value) + Send + Sync>` — only when the request carries a progress
  token _and_ arrived over WS — wrapping chunks with `fuz_http::notification(…)`
  and routing through `Arc<fuz_realtime::ConnectionRegistry>::send_to`. HTTP →
  `None` → non-streaming.
- **Migration namespaces compose**: substrate DDL lives in the owning crate
  (`fuz_auth::AUTH_MIGRATIONS`, `fuz_cell::CELL_MIGRATIONS`,
  `fuz_fact::FACT_MIGRATIONS`); the consumer composes them with its own via
  `fuz_db::run_migrations`, ordered for FKs (auth first). A consumer's own
  namespace stays small (the forge's is one token-policy table).
- **Loopback-gated internal routes**: `/internal/*` checks the
  `ConnectInfo<SocketAddr>` peer is loopback _and_ a per-resource secret —
  X-Forwarded-For can't fake the peer.
- **Boot errors carry the CLI exit-code policy**: a `StartupError` with
  `exit_code()` mapping `Config → 2`, else `1` (./rust-patterns.md §CLI Patterns).
- **Subprocess harness**: `SpawnOptions` + `spawn_collect`/`spawn_streaming`
  (env-isolating spawn, capped output drain) lives in `fuz_forge_server` —
  local until a second consumer needs it; the promotion target is a spine-free
  leaf crate.

## Daemon lifecycle — two layers

1. **Server-side graceful shutdown is shared.** Signal → `CancellationToken` is
   `fuz_sys::signal::shutdown_token()` (`signal` feature); `fuz_http::lifecycle`
   re-exports it and adds `serve_with_shutdown` for axum consumers; `fuzd`
   (UDS, no axum) calls `fuz_sys::signal` directly. This split is why
   `fuz_sys` (home-agnostic OS leaf) and `fuz_home` (`~/.fuz`) are separate.
2. **Client-side CLI lifecycle splits by transport.**
   - `fuzd`'s UDS lifecycle lives in `fuz_daemon`: v2 `daemon.json`
     (`socket_path`, no port), `Hello`-based health over `fuz_client`, a
     `DaemonState` enum (`Running(info)` / `Stopped` / `Stale(info)`) with one
     `get_daemon_state()` resolver.
   - zzz's HTTP lifecycle is deliberately **local to zzz's CLI**: a port-based
     `DaemonInfo` (`version`, `pid`, `port`, `started`, `app_version`; schema
     shared with `fuz_app` TS), a reqwest `/health` probe, a `Wedged(info)` arm
     for "pid alive, `/health` silent". It reuses `fuz_sys` primitives
     (`is_pid_alive`, `send_signal`, `rfc3339_now`, `fs::write_atomic`) but
     **not** `fuz_home`, whose daemon helpers model the UDS schema. Its
     `daemon.json` is `0o644` on purpose (no secrets).
   - Model liveness as one `DaemonState` enum + one resolver, not scattered
     `pid_alive`/`healthy` booleans. Don't build a transport-generic lifecycle
     crate for a single HTTP consumer.
   - The HTTP lifecycle (and `reqwest`) must never enter the `fuz`/`fuzd`
     graph — a convention, not a `check-release` rule, since `fuz` legitimately
     links `fuz_daemon`/`fuz_client` for UDS.

## xtask & check-release

Every spine-consuming workspace's `xtask` wraps the shared audit — don't
hand-roll it: `fuz_audit::xtask_main()` (complete single-subcommand xtask; the
forge's 3-line `main`), `run_check_release_cli()` (workspaces with their own
router — zzz, zap), `run_check_release_cli_with_rules(&AuditRules)` where
`AuditRules` is one POD: `extra_forbidden: &[&str]` (fuz adds `fuz_sign` so
its `fuz` binary can never sign) + `per_binary: &[PerBinaryForbid]`
(`fuz`/`fuzd` must not link `fuzi_*`). Only the fuz workspace passes rules;
the no-arg consumers stay insulated.
Exit codes: clean 0, policy violation 65, tooling failure 69/70.

`BUILTIN_CRATE_LAYERING` — per-crate _library_ layering applied
unconditionally in every workspace (absent subjects skipped; the OK output
lists subjects actually checked so a renamed crate is visible). Each rule: a
library must not transitively runtime-depend on a forbidden set.

| Subject    | Must not reach                                            | Invariant                                                |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------- |
| `fuz_fact` | `axum`, `fuz_http`, `fuz_cell`, `fuz_auth`, `fuz_actions` | bytes escape only through the authz'd `fuz_fact_serving` |
| `fuz_cell` | `fuz_actions`                                             | storage/authz half can't reach the verb layer            |
| `fuz_sys`  | `axum`, `fuz_http`                                        | the OS leaf stays HTTP-free                              |
| `fuz_home` | `axum`, `fuz_db`, `fuz_http`                              | the `~/.fuz` layer stays HTTP/DB-free                    |

`fuz_cell`'s rule is narrower than `fuz_fact`'s because it legitimately
reaches `axum`/`fuz_http` via `fuz_auth` — the BFS runs over the runtime graph,
so a rule must account for what a subject's legitimate deps pull. Grow the
table one rule per real invariant; no speculative rules. The
`[package.metadata.fuz_audit] dev_only = true` stanza on each xtask crate is
the one config that can't be workspace-inherited. Why forbidden capabilities
are crates, not features: ./rust-dependencies.md §Crate-vs-feature isolation.
