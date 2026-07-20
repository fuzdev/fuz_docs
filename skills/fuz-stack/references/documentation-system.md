---
description: Docs pipeline — Tome system, layout architecture, project setup
---

# Documentation System

Pipeline, Tome system, layout architecture, and project setup for `@fuzdev`
docs. For TSDoc/JSDoc authoring conventions, see ./tsdoc-comments.md.

## Pipeline Overview

```
source files → svelte-docinfo plugin → virtual:svelte-docinfo (modules) ┐
                                                                         ├→ library_json_from_modules() → Library → Tome pages + API routes
package.json → vite_plugin_pkg_json  → virtual:pkg.json (pkg_json)       ┘
```

| Stage             | What                                              | Key details                                                                                                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Analysis**      | `svelte-docinfo`                                  | Standalone package analyzes TS/JS/Svelte modules via the TypeScript compiler API, extracting declarations and TSDoc metadata                                                                                                                                                                        |
| **Generation**    | `svelte-docinfo/vite.js` + `vite_plugin_pkg_json` | Two Vite plugins run at build/dev time: `svelte-docinfo` exposes the analyzed `modules` as `virtual:svelte-docinfo`; `vite_plugin_pkg_json` (from fuz_ui) curates `package.json` to the publish-safe `PkgJson` and exposes it as `virtual:pkg.json`. No committed generated data (`library.gen.ts`/`library.json`) |
| **Serialization** | `library_json_from_modules()`                     | From `@fuzdev/fuz_util/library_json.ts`; pairs the curated `pkg_json` (from `virtual:pkg.json`) with the analyzed `modules` (from `virtual:svelte-docinfo`) into the raw `{pkg_json, source_json}` `LibraryJson` (no derived values stored — those are computed by `Library`)                       |
| **Runtime**       | `Library` class                                   | Wraps `LibraryJson` into `Module` and `Declaration` instances with `$derived` properties, search, and lookup maps                                                                                                                                                                                   |
| **Rendering**     | Tome pages + API routes                           | Manual tomes + auto-generated API docs. Backticked identifiers in TSDoc auto-link to API docs via the mdz rendering seam — fuz_ui injects `DocsLink` as mdz's inline-code renderer, which resolves the identifier against the `Library` (see ./mdz.md)                                               |

### Analysis

The `svelte-docinfo` package owns module analysis end to end: it walks source
files, dispatches per file type (`.ts`/`.js` vs `.svelte`), parses TSDoc/JSDoc
(`@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`, `@since`,
`@module`, `@default`, `@nodocs`, `@mutates`), merges re-exports into
`alsoExportedFrom` (svelte-docinfo's API is camelCase — it targets the broad
Svelte ecosystem, not fuz conventions), sorts
modules, and checks for duplicate names in the flat namespace. It ships a CLI,
a Vite plugin (`svelte-docinfo/vite.js`), and a build-tool-agnostic API. fuz_ui
depends on it as a dev dependency — importing its types and a few runtime
helpers — while the heavy per-project module analysis runs in each *consumer's*
build via the Vite plugin, not at fuz_ui's runtime.

## Tome System

A **Tome** is a documentation page. Zod schema in `@fuzdev/fuz_ui/tome.ts`:

```typescript
const Tome = z.object({
	slug: z.string(), // URL path segment + lookup key (used in related_tomes)
	title: z.string().optional(), // display label; falls back to slug when omitted
	category: z.string(), // grouping in sidebar navigation
	Component: z.custom<Component<any, any>>(), // the +page.svelte component
	related_tomes: z.array(z.string()), // cross-links to other tome pages (by slug)
	related_modules: z.array(z.string()), // links to source modules in API docs
	related_declarations: z.array(z.string()), // links to specific exports in API docs
});
```

### Cross-references

| Field                  | Links to                     | Example value                 |
| ---------------------- | ---------------------------- | ----------------------------- |
| `related_tomes`        | Other tome pages             | `['ThemeRoot']`               |
| `related_modules`      | Source files in `/docs/api/` | `['theme_state.svelte.ts']`   |
| `related_declarations` | Specific exports in API docs | `['ThemeRoot', 'ThemeState']` |

### Categories

Categories group tomes in sidebar navigation; project-specific:

| Project | Categories                       |
| ------- | -------------------------------- |
| fuz_ui  | `guide`, `helpers`, `components` |
| fuz_css | `guide`, `systems`, `styles`     |

### Registry

Every project with docs has `src/routes/docs/tomes.ts` (examples here use the
`#routes`/`#lib` subpath aliases — a new repo must declare them in
`package.json` `imports`, or adapt to its existing aliases):

```typescript
import type {Tome} from '@fuzdev/fuz_ui/tome.ts';
import introduction from '#routes/docs/introduction/+page.svelte';
import api from '#routes/docs/api/+page.svelte';

export const tomes: Array<Tome> = [
	{
		slug: 'introduction',
		category: 'guide',
		Component: introduction,
		related_tomes: ['api'],
		related_modules: [],
		related_declarations: [],
	},
	// ...
];
```

### Helpers

From `@fuzdev/fuz_ui/tome.ts`:

- `tome_get_by_slug(slug)` — look up a Tome from `tomes_context` (throws if not found)
- `tome_to_pathname(tome, docs_path?, hash?)` — generate URL for a tome
- `tome_to_title(tome)` — display label (its `title`, else its `slug`)
- `tomes_context` — context holding `() => Map<string, Tome>` (set by `Docs`)
- `tome_context` — context holding `() => Tome` for the current page (set by `TomeContent`)

From `@fuzdev/fuz_ui/docs_helpers.svelte.ts`:

- `docs_slugify(name)` — convert tome name to URL-safe slug (preserves case)
- `docs_links_context` — context holding `DocsLinks` for section navigation
- `DOCS_PATH_DEFAULT`, `DOCS_PATH`, `DOCS_API_PATH` — path constants

## Setting Up Docs in a Project

Following the pattern in fuz_ui and fuz_css.

### 1. Library analysis (Vite plugins)

Add the `svelte-docinfo` Vite plugin (exposes the analyzed `modules` as
`virtual:svelte-docinfo`) and fuz_ui's `vite_plugin_pkg_json` (exposes the
curated, publish-safe `package.json` subset as `virtual:pkg.json`) in
`vite.config.ts`:

```typescript
import {defineConfig} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';
import svelte_docinfo from 'svelte-docinfo/vite.js';
import {vite_plugin_pkg_json} from '@fuzdev/fuz_ui/vite_plugin_pkg_json.ts';

export default defineConfig({
	plugins: [sveltekit(), svelte_docinfo(), vite_plugin_pkg_json()],
});
```

Register the ambient types in `src/app.d.ts`:

```typescript
/// <reference types="svelte-docinfo/virtual-svelte-docinfo.js" />

declare module 'virtual:pkg.json' {
	import type {PkgJson} from '@fuzdev/fuz_util/pkg_json.ts';
	const pkg_json: PkgJson;
	export default pkg_json;
}
```

`vite_plugin_pkg_json` reads `package.json` at build time and serves only the
publish-safe `pkg_json_keys` subset, keeping `scripts`, `dependencies`, and
private config out of the client bundle (and avoiding SvelteKit's
`server.fs.allow` tripping on a cold HMR reload). There is no committed
generated data (`library.gen.ts`, `library.json`) — the plugins produce it at
runtime; the only committed artifact is the tiny hand-written
`src/routes/library.ts` glue (§3).

**Footgun**: if a project widens the published `package.json` fields it exposes,
the **same `keys` set must reach both** `vite_plugin_pkg_json` and
`library_json_from_modules()` — a mismatch silently drops fields end-to-end with
no error. When widening, wire a shared const (e.g. a `src/routes/pkg_json_keys.ts`)
passed to both callsites; no repo widens today, so the default keys need no wiring.

### 2. Root layout — site identity only

The root `src/routes/+layout.svelte` wraps **every** route, so keep it light:
set only the small `site_context` (icon, glyph, repo url — `glyph`/`repo_url`
derive from `virtual:pkg.json`). Do **not** build the `Library` here — that
pulls the heavy analyzed `modules` into the root chunk and instantiates
`Library` on every page, including the landing.

```svelte
<script lang="ts">
	import ThemeRoot from '@fuzdev/fuz_ui/ThemeRoot.svelte';
	import {SiteState, site_context} from '@fuzdev/fuz_ui/site.svelte.ts';
	import {logo_my_project} from '#lib/logos.ts';
	import pkg_json from 'virtual:pkg.json';
	import type {Snippet} from 'svelte';

	const {children}: {children: Snippet} = $props();

	// `glyph` and `repo_url` derive from `pkg_json`; `icon` stays explicit.
	site_context.set(new SiteState({icon: logo_my_project, pkg_json}));
</script>

<ThemeRoot>{@render children()}</ThemeRoot>
```

### 3. Library data — a shared module, provided per subtree

Build the `LibraryJson` once in `src/routes/library.ts`. As a module-level
`export const` it evaluates lazily on first import and is shared by every
importer; because only the docs subtree imports it, the heavy
`virtual:svelte-docinfo` payload stays out of the root chunk:

```typescript
// src/routes/library.ts
import {library_json_from_modules} from '@fuzdev/fuz_util/library_json.ts';
import {modules} from 'virtual:svelte-docinfo';
import pkg_json from 'virtual:pkg.json';

export const library_json = library_json_from_modules(pkg_json, modules);
```

Provide `library_context` in the docs layout (`src/routes/docs/+layout.svelte`),
which covers all `/docs/*` pages:

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';
	import Docs from '@fuzdev/fuz_ui/Docs.svelte';
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.ts';
	import {tomes} from '#routes/docs/tomes.ts';
	import {library_json} from '#routes/library.ts';

	const {children}: {children: Snippet} = $props();

	const library = new Library(library_json);
	library_context.set(() => library);
</script>

<Docs {tomes}>
	{@render children()}
</Docs>
```

`library_context` holds a getter (`() => Library`) — set it with a closure
over reactive state as above. `library_context.get()` **throws** when unset,
and that only surfaces at SSR/prerender (`gro build`) — not in `gro typecheck`
or `gro test`. So it must be set by a layout that is a common ancestor of
every component that reads it (`DeclarationLink`, `ModuleLink`, `TypeLink`,
`DocsTertiaryNav`, and `Mdz` with an injected `DocsLink`). Components that
take a `library` prop (`LibraryDetail`, `ApiIndex`, `ApiModule`) project it
into the context for their own subtree, so an aggregator can render a foreign
library without touching the site-level context. Any consumer **outside**
`/docs` provides its own from the same `library.ts` — e.g. an `/about` page or
a `/skills` subtree:

```svelte
<script lang="ts">
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.ts';
	import {library_json} from '#routes/library.ts';

	const library = new Library(library_json);
	library_context.set(() => library);
</script>
```

Keep these off the landing page so it never pulls the heavy data. After any
change that moves a context provider, verify with `gro build` — a missing
provider passes typecheck and tests but fails the prerender.

### 4. Tomes registry

`src/routes/docs/tomes.ts` — see [Registry](#registry) above.

### 5. Individual tome pages

Each tome is a `+page.svelte` in `src/routes/docs/{slug}/`:

```svelte
<script lang="ts">
	import {tome_get_by_slug} from '@fuzdev/fuz_ui/tome.ts';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';

	const TOME_SLUG = 'MyComponent';
	const tome = tome_get_by_slug(TOME_SLUG);
</script>

<TomeContent {tome}>
	<section>
		<!-- Introduction content -->
	</section>
	<TomeSection>
		<TomeSectionHeader text="Usage" />
		<!-- Section content with examples -->
	</TomeSection>
	<TomeSection>
		<TomeSectionHeader text="Options" />
		<!-- Another section -->
	</TomeSection>
</TomeContent>
```

`TomeSectionHeader` auto-detects heading level (h2/h3/h4) from nesting depth.
Sections tracked by IntersectionObserver for the right sidebar TOC.

### 6. API routes

`src/routes/docs/api/+page.svelte` — API overview:

```svelte
<script lang="ts">
	import ApiIndex from '@fuzdev/fuz_ui/ApiIndex.svelte';
</script>

<ApiIndex />
```

`src/routes/docs/api/[...module_path]/+page.svelte` — per-module docs:

```svelte
<script lang="ts">
	import ApiModule from '@fuzdev/fuz_ui/ApiModule.svelte';

	const {params} = $props();
	const module_path = $derived(params.module_path ?? '');
</script>

<ApiModule {module_path} />
```

## Docs Layout Architecture

`<Docs>` provides a three-column responsive layout:

| Column        | Component          | Content                              |
| ------------- | ------------------ | ------------------------------------ |
| Top bar       | `DocsPrimaryNav`   | Breadcrumb, nav dialog toggle        |
| Left sidebar  | `DocsSecondaryNav` | Tome list grouped by category        |
| Center        | `main`             | Route content (tome pages, API docs) |
| Right sidebar | `DocsTertiaryNav`  | Section headers within current page  |

Right sidebar collapses below ~1000px, left below ~800px. Both move into a
dialog accessible from the top bar's menu button.

### Key contexts

The four contexts that wire the layout together (full list in [Helpers](#helpers)):

- `library_context` (`() => Library`) — API metadata, set with a getter; provided per docs-consuming subtree (docs layout, `/about`, …), never at the root (see [Setting Up Docs](#setting-up-docs-in-a-project) §3); components with a `library` prop project it for their subtree
- `tomes_context` (`() => Map<string, Tome>`) — registered tomes (set by `Docs`)
- `tome_context` (`() => Tome`) — current page's tome (set by `TomeContent`)
- `docs_links_context` (`DocsLinks`) — fragment tracking for section navigation

### Runtime Classes

`Library` class (`library.svelte.ts`) provides the runtime API documentation
hierarchy:

- **`Library`** — wraps `LibraryJson`, provides `modules`, `declarations`,
  `module_by_path`, `declaration_by_name` lookup maps, and
  `search_declarations(query)` for multi-term search
- **`Module`** (`module.svelte.ts`) — wraps `ModuleJson`, provides `path`,
  `declarations`, `url_api`, `module_comment`
- **`Declaration`** (`declaration.svelte.ts`) — wraps `DeclarationJson`,
  provides `name`, `kind`, `module_path`, `url_api`, `url_github`

## Component Reference

You wire up only a handful of these when adopting the docs system — the ones the
setup steps import:

| Component                          | Role in setup                                                            |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `Docs`                             | Three-column layout wrapper; sets `tomes_context` + `docs_links_context` |
| `TomeContent`                      | Individual tome page wrapper; sets `tome_context`                        |
| `TomeSection`                      | Section container with depth tracking and intersection                   |
| `TomeSectionHeader`                | Section heading with hashlink (auto h2/h3/h4)                            |
| `ApiIndex`                         | API overview page (search + all modules/declarations)                    |
| `ApiModule`                        | Per-module API page (`[...module_path]`)                                 |
| `LibrarySummary` / `LibraryDetail` | Compact metadata card / expanded package info                            |

The full set (~27 components — the `Docs*` nav internals, `Api*`/`Declaration*`
list pieces, `Tome*`/`Module*`/`Type*` links) is fuz_ui inventory; see fuz_ui's
`CLAUDE.md` for the exhaustive catalog. All are defined in fuz_ui and imported by
consumers unchanged (see [Cross-Project Pattern](#cross-project-pattern)).

## Cross-Project Pattern

fuz_ui **defines** all documentation components and the analysis pipeline.
Other projects **import** them:

```typescript
// In fuz_ui (defines the components)
import Docs from './Docs.svelte';
import {library_context} from './library.svelte.ts';

// In fuz_css or any consumer project
import Docs from '@fuzdev/fuz_ui/Docs.svelte';
import {library_context} from '@fuzdev/fuz_ui/library.svelte.ts';
```

Layout structure is identical — only tomes, categories, and breadcrumb
branding differ. The `svelte-docinfo` Vite plugin and `virtual:svelte-docinfo`
are the shared analysis engine across projects.

## See Also

- ./mdz.md — the mdz dialect, the `DocsLink`/`Code` rendering seam,
  backticked-identifier autolinking, and `svelte_preprocess_mdz` (build-time
  compilation of static `<Mdz>` content)
- **`svelte-docinfo`** — the shared module-analysis engine (see [Analysis](#analysis))
- ./tsdoc-comments.md — TSDoc/JSDoc authoring conventions, tag reference,
  mdz auto-linking, and documentation auditing
