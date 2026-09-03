---
description: Query modules, named-column projections, and the schema drift guard — TS + Rust
---

# Database Query Patterns

**Applies to**: any module that reads or writes Postgres rows — `fuz_app`'s
`auth/*_queries.ts` / `db/*_queries.ts`, the spine crates' `*_queries.rs`
(`fuz_auth`, `fuz_cell`, …), and a consumer's own tables on either spine.
Hand-written SQL by design: no query builder, no ORM — the strings stay
planner-visible, pglet-compatible, and readable across the TS ↔ Rust twin
(./twin-impl.md).

## Query module shape

One module per table. Every function is `query_<table>_<verb>`, takes
`deps: QueryDeps` (`{db}`) first, has no audit side effects, and returns the
affected row (or `null` / `None` for not-found) from mutations.

```ts
export const query_invite_delete_unclaimed = async (
	deps: QueryDeps,
	id: Uuid
): Promise<Invite | null> => {
	const row = await deps.db.query_one<Invite>(
		`DELETE FROM invite WHERE id = $1 AND claimed_at IS NULL
		 RETURNING ${columns_sql(INVITE_COLUMNS)}`,
		[id]
	);
	return row ?? null;
};
```

- **Values are parameterized, never interpolated.** Only column references,
  `$N::type` placeholders, and projection consts are template-inserted.
  Dynamic identifiers (a table name in a DDL/TRUNCATE) pass through
  `assert_valid_sql_identifier` first.
- **`INSERT … RETURNING` rows pass through `assert_row(row, context)`** —
  a missing row on an insert is a bug, not a not-found.
- **Unique violations surface as the Postgres `23505`** (`is_pg_unique_violation`);
  the handler, not the query, translates it to a wire error.
- **Transactions are the caller's** — a query takes whatever `db` it is
  handed (pool or transaction client) and never opens its own.

Rust mirrors this: `query_<table>_<verb><C: GenericClient + ?Sized>(client: &C, …)`,
`Result<Row, CrateError>` / `Result<Option<Row>, …>`, the driver error
wrapped in the crate's `thiserror` variant.

## Named-column projections

Every read — `SELECT` and `RETURNING` — projects through the table's
exported column const. Never `SELECT *`.

```ts
/** The full `invite` column set … keep in sync with `Invite` and the DDL. */
export const INVITE_COLUMNS = [
	'id',
	'email',
	'username',
	'claimed_by',
	'claimed_at',
	'created_at',
	'created_by'
] as const;
```

Why: `SELECT *` silently omits a dropped column, the hydrated row reads it
as `undefined`, and a `deleted_at === null` filter then rejects every row —
a silent total outage instead of an error. A named projection turns the
same drift into a loud Postgres `column "…" does not exist` at the first
read. It also keeps a leftover column from riding a strict wire schema.

The const is a column-name array; SQL text is rendered **at the read site**
from `db/sql_columns.ts`:

| Helper                             | Use                                                                                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns_sql(COLS)`                | single-table reads + `RETURNING` → `a, b, c`                                                                                                  |
| `qualify_columns(COLS, 'i')`       | reads that alias the table (JOINs) → `i.a, i.b, i.c`                                                                                          |
| `omit_columns(COLS, 'token_hash')` | a client-safe subset — throws on an unknown name so a typo can't keep the secret column on the wire (`as const` makes it a compile error too) |
| `iso8601_timestamp_expr(COLS, ['created_at'])` | the `expr` override projecting the named timestamp columns through `iso8601_timestamp_column`; curried by alias, throws on a name outside `COLS` |

Derived columns that aren't table columns (a correlated `COUNT(*) AS
grant_count`) are **appended as expressions** next to the rendered const,
never added to it — the const must be exactly the table's column set so
the drift guard below can compare it to the schema.

Don't spell a second column list anywhere: not a module-level "qualified
copy", not a per-site subset. Derive from the one const so one guard
covers every projection.

## The drift guard (both directions)

The projection makes a _dropped_ column fail loud. A column _added_ to the
DDL but not to the const would silently vanish from every read — so each
const is asserted against the live `public` schema in the module's
`.db.test.ts`:

```ts
describe_db('InviteQueries', (get_db) => {
	test('INVITE_COLUMNS names every live `invite` column', async () => {
		await assert_columns_match_live(get_db(), 'invite', INVITE_COLUMNS);
	});
});
```

`assert_columns_match_live` (from `testing/db.ts`) reads
`information_schema` via `query_public_columns` and `deepEqual`s the sorted
const — a live DB is the only truth for the migration chain's end state
(the base DDL string isn't, once migrations append `ALTER TABLE`s). The
`/ready` deploy gate covers the same drift at deploy time by column
presence; this guard covers it at development time, per table, in both
directions.

A consumer adding its own tables follows the identical shape: one const,
render at the site, one guard test — no registration step.

## Rust twin

Same discipline, same identifiers, one extra rule.

```rust
/// The `cell_grant` table's columns, in projection order.
pub const CELL_GRANT_COLUMNS: [&str; 8] = [
    "id", "cell_id", "level", "actor_id", "role", "scope_id", "granted_by", "created_at",
];

fn grant_columns(alias: &str) -> String {
    qualify_columns(
        &CELL_GRANT_COLUMNS,
        alias,
        iso8601_timestamp_expr(&CELL_GRANT_COLUMNS, &["created_at"], alias),
    )
}

fn decode_grant_row(row: &tokio_postgres::Row) -> Result<CellGrantRow, CellError> {
    Ok(CellGrantRow {
        id: row.get(col!(CELL_GRANT_COLUMNS, "id")),
        cell_id: row.get(col!(CELL_GRANT_COLUMNS, "cell_id")),
        // … each index resolved by name at compile time …
    })
}
```

- `fuz_db::qualify_columns(&COLS, alias, expr)` renders the const qualified
  by `alias` (always qualified — one const serves single-table reads and
  aliased JOINs; pass the table name for a bare-table read or `RETURNING`),
  with `expr` overriding individual columns for the `::text` casts and the
  `iso8601_timestamp_column` projection the wire shape needs.
  `fuz_db::omit_columns(&COLS, &["token_hash"])` narrows a const for a
  client-safe or payload-free read — derived, so the base const's guard
  still covers it, and it panics on an unknown name so a typo can't keep
  the column it meant to hide.
- **Timestamps project through one call, not a hand-written `match`** —
  `fuz_db::iso8601_timestamp_expr(&COLS, &["created_at"], alias)` builds the
  `expr` override for every timestamp the wire shape needs, and panics on a
  name outside `COLS` (the same hazard `omit_columns` guards: a misspelled
  timestamp would silently ship a raw Postgres timestamp). The TS twin is
  `iso8601_timestamp_expr(COLS, ['created_at'])`, curried by alias because TS
  reads rows by name. A projection that *also* overrides a non-timestamp
  column keeps its `match` and falls through — bind the closure to a local
  outside the `match`: the returned closure borrows the `&["…"]` slice
  literal, and a temporary built inside an arm dies at the end of that arm:

  ```rust
  let timestamps = iso8601_timestamp_expr(&CELL_COLUMNS, &["created_at"], alias);
  qualify_columns(&CELL_COLUMNS, alias, |col| match col {
      "data" => Some(format!("{alias}.data::text")),
      _ => timestamps(col),
  })
  ```
- **Decode is positional on the wire, name-checked at compile time** —
  through **one decoder per row shape**, each index resolved by
  `fuz_db::col!` against the const:
  `row.get(col!(CELL_GRANT_COLUMNS, "level"))`. The macro is
  `const { column_index(&COLS, "level") }` sugar — zero runtime cost, a
  name the const doesn't carry is a compile error, and the decoder follows
  the const however it's edited (insert / reorder / append freely; the
  guard compares sets, not order). A newly added column is simply unread
  until its struct field lands. A CTE / JOIN read appends its extra
  expressions after the const's columns and indexes them from
  `COLS.len()`, which also follows. Never write a bare integer index
  against a const-driven projection.
- **Derived (narrowed) projections** — a client-safe listing that omits
  `token_hash`, a metadata read that skips the payload — are *literal*
  consts the decoder `col!`s into, pinned to their derivation by a unit
  test: `assert_eq!(API_TOKEN_CLIENT_COLUMNS.to_vec(),
  omit_columns(&API_TOKEN_COLUMNS, &["token_hash"]))`. The base const's
  drift guard covers them through the pin.
- **Purpose rows.** Rust reads deliberately narrow rows the TS twin
  doesn't (`AccountRow` is an identity pair, not the table). Give each
  such shape its own private `const <SHAPE>_COLUMNS` + decoder next to
  the table const, decode via `col!`, and unit-check it as a subset with
  `fuz_db::columns_not_in(&SHAPE, &TABLE)` — the rule is *one list per
  shape*, never a column list typed at a call site. Scalar reads
  (`RETURNING id`, `SELECT EXISTS(…)`) and single-site join shapes whose
  projection is spelled inline next to their decoder stay literal.
- The drift guard is a crate integration test, `tests/columns.rs`, over
  `fuz_db::query_ready_columns` — `#[ignore]`-gated like the crate's other
  Postgres tests: every live table in the chains the fixture runs is a
  const or a reasoned exemption, and each const names exactly its live
  columns. Each spine crate exports a `fuz_db::ColumnProjections` set per
  migration chain (`AUTH_COLUMN_PROJECTIONS`, `CELL_COLUMN_PROJECTIONS`,
  `CELL_HISTORY_COLUMN_PROJECTIONS`, `FACT_COLUMN_PROJECTIONS`; `fuz_db`'s
  `DB_COLUMN_PROJECTIONS` covers `schema_version`), and the test composes
  the sets for the chains it migrates plus its own tables:
  `column_projection_mismatches_merged(&live, &[DB_COLUMN_PROJECTIONS,
  AUTH_COLUMN_PROJECTIONS, …, OWN])`. Never copy a spine chain's
  table→const list into a consumer — compose the exported set, so a spine
  table addition reaches every registry through one edit.
- Identifiers match the TS side exactly (`CELL_GRANT_COLUMNS`,
  `qualify_columns`, `omit_columns`) per ./twin-impl.md — the const is
  the same array on both spines, so column order can be diffed by eye.

## Anti-patterns

- `SELECT *` / `RETURNING *` on any table read, "mapper-fed" or not — the
  mapper narrows the wire, not the read.
- A second column list (a qualified copy, a `SELECT id, name` typed at one
  site) — it drifts independently of the guarded const.
- Folding a derived expression into the const.
- Hand-editing a projection to "fix" a failing drift test — the test is
  telling you the DDL and the const disagree; decide which is right.

## Related

- ./testing-patterns.md — `describe_db`, database factories, `.db.test.ts`.
- ./rust-spine.md — the spine crate map the Rust query modules live in.
- ./twin-impl.md — identifier parity and convergence between the two spines.
