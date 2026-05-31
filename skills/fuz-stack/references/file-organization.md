# File Organization

Source layout, domain subdirectories, full-path imports, and test mirroring for
`@fuzdev` TypeScript/Svelte projects.

## Source Tree

```
src/
├── lib/              # exportable library code
│   ├── *.svelte      # UI components (PascalCase.svelte)
│   ├── *.ts          # TypeScript utilities
│   ├── *.svelte.ts   # Svelte 5 runes and reactive code
│   ├── *.gen.ts      # generated files (by Gro gen tasks)
│   └── domain/       # domain subdirectories (see below)
│       └── *.ts
├── test/             # tests (NOT co-located with source)
│   └── *.test.ts     # mirrors lib/ structure
└── routes/           # SvelteKit routes (if applicable)
```

## Domain Subdirectories

When a domain grows beyond a single file, group related modules in a
subdirectory under `lib/`. Each file is a distinct concern — no barrel/index
files.

```
src/lib/
├── env/              # environment variable handling
│   ├── load.ts       # schema-based env loading + validation
│   ├── resolve.ts    # $$VAR$$ reference resolution
│   ├── dotenv.ts     # .env file parsing
│   └── mask.ts       # secret value display masking
├── auth/             # authentication domain (~34 files)
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
├── cli/              # CLI infrastructure
├── actions/          # action spec system
├── realtime/         # SSE and pub/sub
├── testing/          # test utilities (shared across consumers)
├── ui/               # frontend components and state
└── dev/              # dev workflow helpers
```

**When to create a subdirectory**: 3+ closely related files sharing a domain
concept. A single file stays at `lib/` root. Don't create subdirectories
preemptively.

## Import by Full Path

**Consumers import individual modules by full path** — the subdirectory is part
of the import path, not hidden behind re-exports. No barrel/`index.ts`; package
`exports` use wildcard patterns (`"./*.js"`) so every module is importable.

```typescript
import {load_env} from '@fuzdev/fuz_app/env/load.js';
import {resolve_env_vars} from '@fuzdev/fuz_app/env/resolve.js';
import {create_app_backend} from '@fuzdev/fuz_app/server/app_backend.js';
```

## Tests Mirror the Subdirectory Structure

Tests live in `src/test/` (NOT co-located) and mirror `src/lib/` subdirectories:

```
src/test/
├── env/
│   ├── load.test.ts
│   ├── resolve.test.ts
│   ├── dotenv.test.ts
│   └── mask.test.ts
├── auth/
│   ├── keyring.test.ts
│   └── account_queries.db.test.ts  # .db.test.ts suffix for PGlite tests
└── server/
    └── env.test.ts     # server-specific env (BaseServerEnv, validate_server_env)
```

See ./testing-patterns.md for the full test file layout, naming, and fixtures.
