# Documentation System

Pipeline, Tome system, layout architecture, and project setup for `@fuzdev`
docs. For TSDoc/JSDoc authoring conventions, see ./tsdoc-comments.md.

## Pipeline Overview

```
source files → svelte-docinfo Vite plugin → virtual:svelte-docinfo (modules) → library_json_parse() → Library class → Tome pages + API routes
```

| Stage             | What                          | Key details                                                                                            |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Analysis**      | `svelte-docinfo`              | Standalone package analyzes TS/JS/Svelte modules via the TypeScript compiler API, extracting declarations and TSDoc metadata |
| **Generation**    | `svelte-docinfo/vite.js`      | Vite plugin runs the analysis at build/dev time and exposes the result through the `virtual:svelte-docinfo` virtual module (no committed `library.json`/`library.ts` files) |
| **Serialization** | `library_json_parse()`        | From `@fuzdev/fuz_util/library_json.js`; combines `package.json` + the virtual module's `modules` into a `LibraryJson` (`PackageJson` + `SourceJson` with computed properties) at runtime |
| **Runtime**       | `Library` class               | Wraps `LibraryJson` into `Module` and `Declaration` instances with `$derived` properties, search, and lookup maps |
| **Rendering**     | Tome pages + API routes       | Manual tomes + auto-generated API docs. `mdz` auto-links backticked identifiers in TSDoc via `tsdoc_mdz.ts` |

### Analysis

The `svelte-docinfo` package owns module analysis end to end: it walks source
files, dispatches per file type (`.ts`/`.js` vs `.svelte`), parses TSDoc/JSDoc
(`@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`, `@since`,
`@nodocs`, `@mutates`), merges re-exports into `also_exported_from`, sorts
modules, and checks for duplicate names in the flat namespace. It ships a CLI,
a Vite plugin (`svelte-docinfo/vite.js`), and a build-tool-agnostic API. fuz_ui
consumes its output but does not depend on it.

## Tome System

A **Tome** is a documentation page. Zod schema in `@fuzdev/fuz_ui/tome.js`:

```typescript
const Tome = z.object({
  name: z.string(),            // URL slug and display name
  category: z.string(),        // grouping in sidebar navigation
  Component: z.custom<Component<any, any>>(), // the +page.svelte component
  related_tomes: z.array(z.string()),         // cross-links to other tome pages
  related_modules: z.array(z.string()),       // links to source modules in API docs
  related_declarations: z.array(z.string()),  // links to specific exports in API docs
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

Every project with docs has `src/routes/docs/tomes.ts`:

```typescript
import type {Tome} from '@fuzdev/fuz_ui/tome.js';
import introduction from '$routes/docs/introduction/+page.svelte';
import api from '$routes/docs/api/+page.svelte';

export const tomes: Array<Tome> = [
	{
		name: 'introduction',
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

From `@fuzdev/fuz_ui/tome.js`:

- `get_tome_by_name(name)` — look up a Tome from `tomes_context` (throws if not found)
- `to_tome_pathname(tome, docs_path?, hash?)` — generate URL for a tome
- `tomes_context` — context holding `() => Map<string, Tome>` (set by `Docs`)
- `tome_context` — context holding `() => Tome` for the current page (set by `TomeContent`)

From `@fuzdev/fuz_ui/docs_helpers.svelte.js`:

- `docs_slugify(name)` — convert tome name to URL-safe slug (preserves case)
- `docs_links_context` — context holding `DocsLinks` for section navigation
- `DOCS_PATH_DEFAULT`, `DOCS_PATH`, `DOCS_API_PATH` — path constants

## Setting Up Docs in a Project

Following the pattern in fuz_ui and fuz_css.

### 1. Library analysis (Vite plugin)

Add the `svelte-docinfo` Vite plugin in `vite.config.ts` so
`virtual:svelte-docinfo` is available at build/dev time:

```typescript
import {defineConfig} from 'vite';
import {sveltekit} from '@sveltejs/kit/vite';
import svelte_docinfo from 'svelte-docinfo/vite.js';

export default defineConfig({
	plugins: [sveltekit(), svelte_docinfo()],
});
```

Register the ambient types in `src/app.d.ts`:

```typescript
/// <reference types="svelte-docinfo/virtual-svelte-docinfo.js" />
```

There are no committed `library.gen.ts`, `library.json`, or `library.ts` files
— the module data is produced by the plugin at runtime.

### 2. Root layout

In `src/routes/+layout.svelte`, build a `LibraryJson` from `package.json` plus
the virtual module's `modules`, then create a `Library` instance and provide it:

```svelte
<script lang="ts">
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.js';
	import {library_json_parse} from '@fuzdev/fuz_util/library_json.js';
	import type {PackageJson} from '@fuzdev/fuz_util/package_json.js';
	import {modules} from 'virtual:svelte-docinfo';

	import package_json from '../../package.json' with {type: 'json'};

	const library_json = library_json_parse(package_json as PackageJson, {
		name: package_json.name,
		version: package_json.version,
		modules,
	});

	library_context.set(new Library(library_json));
</script>
```

### 3. Docs layout

`src/routes/docs/+layout.svelte`:

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';
	import Docs from '@fuzdev/fuz_ui/Docs.svelte';
	import {library_context} from '@fuzdev/fuz_ui/library.svelte.js';
	import {tomes} from '$routes/docs/tomes.js';

	const {children}: {children: Snippet} = $props();
	const library = library_context.get();
</script>

<Docs {tomes} {library}>
	{@render children()}
</Docs>
```

Optional `breadcrumb_children` snippet for custom logo in the top nav:

```svelte
<Docs {tomes} {library}>
	{#snippet breadcrumb_children(is_primary_nav)}
		{#if is_primary_nav}
			<div class="icon row">
				<Svg data={logo} size="var(--icon_size_sm)" /> <span class="ml_sm">my_project</span>
			</div>
		{:else}
			<Svg data={logo} size="var(--icon_size_sm)" />
		{/if}
	{/snippet}
	{@render children()}
</Docs>
```

### 4. Tomes registry

`src/routes/docs/tomes.ts` — see [Registry](#registry) above.

### 5. Individual tome pages

Each tome is a `+page.svelte` in `src/routes/docs/{name}/`:

```svelte
<script lang="ts">
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';

	const LIBRARY_ITEM_NAME = 'MyComponent';
	const tome = get_tome_by_name(LIBRARY_ITEM_NAME);
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

- `library_context` (`Library`) — API metadata
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

All use `$derived` for reactive computed properties.

## Component Reference

### Documentation layout

| Component          | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `Docs`             | Three-column layout, sets `tomes_context` and `docs_links_context` |
| `DocsPrimaryNav`   | Top bar with breadcrumb navigation and menu toggle           |
| `DocsSecondaryNav` | Left sidebar — tome list grouped by category                 |
| `DocsTertiaryNav`  | Right sidebar — section headers within current page          |
| `DocsContent`      | Content wrapper for docs pages                               |
| `DocsFooter`       | Footer with library info and breadcrumb                      |
| `DocsSearch`       | Search input for filtering modules and declarations          |
| `DocsMenu`         | Navigation menu for tomes                                    |
| `DocsLink`         | Navigation link within docs                                  |
| `DocsList`         | List component for docs navigation                           |
| `DocsPageLinks`    | Links section within a docs page                             |
| `DocsMenuHeader`   | Header within the docs navigation menu                       |

### Tome components

| Component           | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `TomeContent`       | Individual tome page wrapper, sets `tome_context`     |
| `TomeHeader`        | Default header rendered by `TomeContent`              |
| `TomeSection`       | Section container with depth tracking and intersection |
| `TomeSectionHeader` | Section heading with hashlink (auto h2/h3/h4)         |
| `TomeLink`          | Cross-reference link to another tome                   |

### API documentation

| Component            | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `ApiIndex`           | API overview with search, lists all modules and declarations |
| `ApiModule`          | Single module's declarations with full detail                |
| `ApiModulesList`     | Module listing within the API index                          |
| `ApiDeclarationList` | Declaration listing within a module                          |
| `DeclarationDetail`  | Full detail view of a single declaration                     |
| `DeclarationLink`    | Link to a declaration in API docs                            |
| `ModuleLink`         | Link to a module in API docs                                 |
| `TypeLink`           | Link to a type reference                                     |

### Library metadata

| Component        | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `LibrarySummary` | Compact package metadata card                    |
| `LibraryDetail`  | Expanded package info with file type breakdown   |

## Cross-Project Pattern

fuz_ui **defines** all documentation components and the analysis pipeline.
Other projects **import** them:

```typescript
// In fuz_ui (defines the components)
import Docs from '$lib/Docs.svelte';
import {library_context} from '$lib/library.svelte.js';

// In fuz_css or any consumer project
import Docs from '@fuzdev/fuz_ui/Docs.svelte';
import {library_context} from '@fuzdev/fuz_ui/library.svelte.js';
```

Layout structure is identical — only tomes, categories, and breadcrumb
branding differ. The `svelte-docinfo` Vite plugin and `virtual:svelte-docinfo`
are the shared analysis engine across projects.

## See Also

- **`svelte_preprocess_mdz`** — build-time compilation of static `<Mdz>` content
  to pre-rendered Svelte markup, eliminating runtime parsing for known-static
  doc strings
- **`svelte-docinfo`** — the shared module-analysis engine (see [Analysis](#analysis))
- ./tsdoc-comments.md — TSDoc/JSDoc authoring conventions, tag reference,
  mdz auto-linking, and documentation auditing
