---
description: Docs pipeline — Tome system, layout architecture, project setup
---

# Documentation System

Pipeline, Tome system, and project setup for `@fuzdev` docs sites. TSDoc
authoring: ./tsdoc-comments.md.

## Pipeline

```
source files → svelte-docinfo plugin → virtual:svelte-docinfo (modules) ┐
                                                                         ├→ library_json_from_modules() → Library → Tome pages + API routes
package.json → vite_plugin_pkg_json  → virtual:pkg.json (pkg_json)       ┘
```

- **`svelte-docinfo`** (standalone package) analyzes TS/JS/Svelte via the
  TypeScript compiler API: declarations, TSDoc tags, re-exports merged into
  `alsoExportedFrom`, module sorting, flat-namespace duplicate checks. Its API
  is camelCase (it targets the broad Svelte ecosystem). Its Vite plugin
  exposes `modules` — and `diagnostics` (author-facing tag problems like
  `misplaced_tag`; no repo consumes it yet) — as `virtual:svelte-docinfo`.
  fuz_ui depends on it as a dev dependency for types and a few helpers; the
  per-project analysis runs in each _consumer's_ build.
- **`vite_plugin_pkg_json`** (fuz_ui) curates `package.json` to the
  publish-safe `PkgJson` subset as `virtual:pkg.json`, keeping `scripts`,
  `dependencies`, and private config out of the client bundle (and avoiding
  SvelteKit's `server.fs.allow` tripping on a cold HMR reload).
- **`library_json_from_modules(pkg_json, modules)`** (`@fuzdev/fuz_util/library_json.ts`)
  pairs them into the raw `LibraryJson`; **`Library`** (fuz_ui,
  `library.svelte.ts`) wraps it into `Module` / `Declaration` instances with
  lookup maps (`module_by_path`, `declaration_by_name`) and
  `search_declarations(query)`.
- **Rendering**: tomes + generated API pages. Backticked identifiers in TSDoc
  autolink because fuz_ui injects `DocsLink` as mdz's inline-code renderer,
  resolving against the `Library` (./mdz.md).

There is no committed `library.gen.ts`/`library.json`; the only committed
artifact is the hand-written `src/routes/library.ts` glue.

## Tome System

A **Tome** is a documentation page (`@fuzdev/fuz_ui/tome.ts`):

```typescript
const Tome = z.object({
	slug: z.string(),                 // URL segment + lookup key
	title: z.string().optional(),     // display label; falls back to slug
	category: z.string(),             // sidebar grouping (fuz_ui: guide/helpers/components; fuz_css: guide/systems/styles)
	Component: z.custom<Component<any, any>>(),
	related_tomes: z.array(z.string()),        // other tome slugs
	related_modules: z.array(z.string()),      // source files in /docs/api/ ('theme_state.svelte.ts')
	related_declarations: z.array(z.string())  // exports in API docs ('ThemeRoot')
});
```

Helpers from `tome.ts`: `tome_get_by_slug(slug)` (throws if missing),
`tome_to_pathname(tome, docs_path?, hash?)`, `tome_to_title(tome)`,
`tomes_context` (`() => Map<string, Tome>`, set by `Docs`), `tome_context`
(`() => Tome`, set by `TomeContent`). From `docs_helpers.svelte.ts`:
`docs_slugify(name)` (preserves case), `docs_links_context` (`DocsLinks`
section navigation), `DOCS_PATH_DEFAULT` / `DOCS_PATH` / `DOCS_API_PATH`.

## Setting Up Docs in a Project

Examples use the `#routes`/`#lib` subpath aliases — the target convention,
declared in `package.json` `imports` (fuz_app does today; fuz_ui and fuz_css
still use `$lib`/`$routes`).

### 1. Vite plugins and ambient types

```typescript
// vite.config.ts
import svelte_docinfo from 'svelte-docinfo/vite.js';
import { vite_plugin_pkg_json } from '@fuzdev/fuz_ui/vite_plugin_pkg_json.ts';
export default defineConfig({ plugins: [sveltekit(), svelte_docinfo(), vite_plugin_pkg_json()] });
```

```typescript
// src/app.d.ts
/// <reference types="svelte-docinfo/virtual-svelte-docinfo.js" />
declare module 'virtual:pkg.json' {
	import type { PkgJson } from '@fuzdev/fuz_util/pkg_json.ts';
	const pkg_json: PkgJson;
	export default pkg_json;
}
```

**Footgun**: if a project widens the exposed `package.json` fields, the
**same `keys` set must reach both** `vite_plugin_pkg_json` and
`library_json_from_modules()` — a mismatch silently drops fields. Wire a shared
const (e.g. `src/routes/pkg_json_keys.ts`) to both callsites; no repo widens
today.

### 2. Root layout — site identity only

The root `+layout.svelte` wraps every route, so it sets only `site_context`
(icon, glyph, repo url — `glyph`/`repo_url` derive from `virtual:pkg.json`).
**Do not build the `Library` here** — that pulls the analyzed `modules` into
the root chunk and instantiates `Library` on every page.

```svelte
<script lang="ts">
	import pkg_json from 'virtual:pkg.json';
	const { children }: { children: Snippet } = $props();
	site_context.set(new SiteState({ icon: logo_my_project, pkg_json }));
</script>

<ThemeRoot>{@render children()}</ThemeRoot>
```

### 3. Library data — shared module, provided per subtree

```typescript
// src/routes/library.ts — module-level const: lazy on first import, shared by importers
import { library_json_from_modules } from '@fuzdev/fuz_util/library_json.ts';
import { modules } from 'virtual:svelte-docinfo';
import pkg_json from 'virtual:pkg.json';
export const library_json = library_json_from_modules(pkg_json, modules);
```

```svelte
<!-- src/routes/docs/+layout.svelte — covers all /docs/* -->
<script lang="ts">
	import Docs from '@fuzdev/fuz_ui/Docs.svelte';
	import { Library, library_context } from '@fuzdev/fuz_ui/library.svelte.ts';
	import { tomes } from '#routes/docs/tomes.ts';
	import { library_json } from '#routes/library.ts';
	const { children }: { children: Snippet } = $props();
	const library = new Library(library_json);
	library_context.set(() => library);
</script>

<Docs {tomes}>{@render children()}</Docs>
```

`library_context` holds a getter (`() => Library`). `library_context.get()`
**throws when unset, and only at SSR/prerender (`gro build`)** — not in
typecheck or tests — so it must be set by a common ancestor of every reader
(`DeclarationLink`, `ModuleLink`, `TypeLink`, `DocsTertiaryNav`, `Mdz` with
an injected `DocsLink`). Any consumer outside `/docs` (an `/about` page, a
`/skills` subtree) provides its own from the same `library.ts`. Components
taking a `library` prop project it for their subtree — `LibraryDetail` sets it
directly; `ApiIndex`/`ApiModule` resolve prop-or-ancestor via
`set_library_context_with_fallback` — so an aggregator can render a foreign
library without touching the site-level context. After moving any provider,
verify with `gro build`.

### 4. Tomes registry

`src/routes/docs/tomes.ts` exports `tomes: Array<Tome>`, each importing its
`+page.svelte` as `Component`.

### 5. Tome pages

Each tome is `src/routes/docs/{slug}/+page.svelte`:

```svelte
<script lang="ts">
	const tome = tome_get_by_slug('MyComponent');
</script>

<TomeContent {tome}>
	<section><!-- introduction --></section>
	<TomeSection>
		<TomeSectionHeader text="Usage" />
		<!-- ... -->
	</TomeSection>
</TomeContent>
```

`TomeSectionHeader` picks h2/h3/h4 from nesting depth; sections are tracked by
IntersectionObserver for the right-sidebar TOC.

### 6. API routes

`docs/api/+page.svelte` renders `<ApiIndex />`;
`docs/api/[...module_path]/+page.svelte` renders
`<ApiModule module_path={params.module_path ?? ''} />`.

## Layout and Components

`<Docs>` is a three-column responsive layout: `DocsPrimaryNav` (top bar —
breadcrumb, nav dialog toggle), `DocsSecondaryNav` (left — tomes by category),
`main`, `DocsTertiaryNav` (right — section headers). Right collapses below
~1000px, left below ~800px, both into a dialog from the top bar.

Contexts: `library_context` (`() => Library`, per docs-consuming subtree, never
root), `tomes_context` (set by `Docs`), `tome_context` (set by `TomeContent`),
`docs_links_context` (`DocsLinks`, fragment tracking).

Components a consumer wires: `Docs`, `TomeContent`, `TomeSection`,
`TomeSectionHeader`, `ApiIndex`, `ApiModule`, `LibrarySummary` /
`LibraryDetail` (metadata card / expanded package info). The full ~27-component
set is fuz_ui inventory (its `CLAUDE.md`). fuz_ui defines everything; other
projects import unchanged — only tomes, categories, and branding differ.
