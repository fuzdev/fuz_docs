---
description: src/ tree, domain subdirectories, full-path imports, test mirroring
---

# File Organization

The core rules live in SKILL.md §File Organization: `src/lib/` exportable
code + `src/test/` (not co-located) + `src/routes/`; no barrels; wildcard
package `exports`; tests mirror `lib/` subdirectories. This reference adds
the worked example.

## Domain Subdirectories

When a domain grows beyond a single file, group related modules in a
subdirectory under `lib/`. Each file is a distinct concern — no barrel/index
files. fuz_app's `lib/` shows the shape:

```
src/lib/
├── env/              # environment variable handling
│   ├── load.ts       # schema-based env loading + validation
│   ├── resolve.ts    # $$VAR$$ reference resolution
│   ├── dotenv.ts     # .env file parsing
│   └── mask.ts       # secret value display masking
├── auth/             # authentication domain (the largest — dozens of files)
│   ├── keyring.ts    # crypto: HMAC-SHA256 cookie signing
│   ├── password.ts   # crypto: password hashing interface
│   ├── account_schema.ts  # types + Zod schemas
│   ├── account_queries.ts # database queries
│   ├── session_middleware.ts  # Hono middleware
│   └── account_routes.ts     # route spec factories
├── http/             # generic HTTP framework
├── db/               # database infrastructure
├── server/           # backend lifecycle + assembly
├── runtime/          # composable runtime deps + implementations
├── actions/          # action spec system
├── realtime/         # SSE and pub/sub
├── testing/          # test utilities (shared across consumers)
└── ui/               # frontend components and state
```

**When to create a subdirectory**: 3+ closely related files sharing a domain
concept. A single file stays at `lib/` root. Don't create subdirectories
preemptively.

**Consumers import individual modules by full path** — the subdirectory is
part of the import path (`@fuzdev/fuz_app/env/load.ts`), never hidden behind
re-exports. Tests mirror the structure: `src/lib/auth/keyring.ts` →
`src/test/auth/keyring.test.ts` (see ./testing-patterns.md).
