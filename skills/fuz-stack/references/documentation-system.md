# Documentation System

Pipeline, Tome system, layout architecture, and project setup for `@fuzdev`
docs. For TSDoc/JSDoc authoring conventions, see ./tsdoc-comments.md.

## Pipeline Overview

```
source files → library_generate() → library.json + library.ts → Library class → Tome pages + API routes
```

| Stage             | What                          | Key details                                                                                            |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Analysis**      | fuz_ui analysis modules       | `ts_helpers.ts`, `svelte_helpers.ts`, `tsdoc_helpers.ts` extract metadata via TypeScript compiler API. `library_analysis.ts` dispatches to the appropriate analyzer based on file type |
| **Generation**    | `library_gen()` in fuz_ui     | Wraps `library_generate()` with Gro `Gen` format. `library_pipeline.ts` handles collection, validation, dedup, re-export merging. Run via `gro gen` |
| **Serialization** | `library.json` + `library.ts` | `library_output.ts` produces JSON and a typed TS wrapper. `LibraryJson` (from `@fuzdev/fuz_util/library_json.js`) combines `PackageJson` + `SourceJson` with computed properties |
| **Runtime**       | `Library` class               | Wraps `LibraryJson` into `Module` and `Declaration` instances with `$derived` properties, search, and lookup maps |
| **Rendering**     | Tome pages + API routes       | Manual tomes + auto-generated API docs. `mdz` auto-links backticked identifiers in TSDoc via `tsdoc_mdz.ts` |

### Analysis Modules

| Module                | Purpose                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| `library_gen.ts`      | Gro-specific entry point — adapts Gro's `Disknode` to `SourceFileInfo` |
| `library_generate.ts` | Build-tool agnostic entry point — orchestrates the full pipeline       |
| `library_analysis.ts` | Unified dispatcher — routes to `ts_analyze_module` or `svelte_analyze_module` based on file type |
| `library_pipeline.ts` | Pipeline helpers — collect source files, find duplicates, merge re-exports, sort modules |
| `library_output.ts`   | Output generation — produces `library.json` and `library.ts` files     |
| `ts_helpers.ts`       | TypeScript compiler API utilities — analyzes TS/JS module exports      |
| `svelte_helpers.ts`   | Svelte component analysis — uses svelte2tsx + TypeScript compiler API  |
| `tsdoc_helpers.ts`    | JSDoc/TSDoc parsing — extracts `@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`, `@since`, `@nodocs`, `@mutates` |
| `module_helpers.ts`   | Path utilities — file type detection, path extraction, `SourceFileInfo` type |
| `analysis_context.ts` | Diagnostic collection — structured error/warning accumulation          |

### Two-Phase Analysis

1. **Phase 1**: Analyze each module, collecting declarations and re-export
   information. Dispatches to `ts_analyze_module` (.ts/.js) or
   `svelte_analyze_module` (.svelte) via `library_analyze_module`.
2. **Phase 2**: Merge re-exports via `library_merge_re_exports` to build
   `also_exported_from` arrays on canonical declarations.

After both phases: sort modules, check for duplicate names in the flat
namespace, and generate output files.

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

Categories group tomes in sidebar navigation. Project-specific:

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

Six files, following the pattern in fuz_ui and fuz_css.

### 1. Library generation

`src/routes/library.gen.ts`:

```typescript
import {library_gen} from '@fuzdev/fuz_ui/library_gen.js';
import {library_throw_on_duplicates} from '@fuzdev/fuz_ui/library_generate.js';

export const gen = library_gen({on_duplicates: library_throw_on_duplicates});
```

Run `gro gen` to produce `library.json` and `library.ts`.

### 2. Root layout

In `src/routes/+layout.svelte`, create a `Library` instance and provide it:

```svelte
<script lang="ts">
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.js';
	import {library_json} from '$routes/library.js';

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

`TomeSectionHeader` auto-detects heading level (h2/h3/h4) based on nesting
depth. Sections tracked by IntersectionObserver for right sidebar TOC.

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

See [Helpers](#helpers) for the full list. The four contexts that wire the
layout together:

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
branding differ. `library_gen()` with fuz_ui's built-in analysis is the shared
generation engine.

## See Also

- **`svelte_preprocess_mdz`** — build-time compilation of static `<Mdz>` content
  to pre-rendered Svelte markup, eliminating runtime parsing for known-static
  doc strings
- **`vite_plugin_library_well_known`** — publishes library metadata at
  `.well-known/library.json` (RFC 8615) for external tool discovery
- **`svelte-docinfo`** (`@fuzdev/svelte-docinfo`) — standalone package with the
  same TypeScript/Svelte analysis as fuz_ui, with CLI, Vite plugin, and
  build-tool agnostic API. fuz_ui does not depend on it.
- **./tsdoc-comments.md** — TSDoc/JSDoc authoring conventions, tag reference,
  mdz auto-linking, and documentation auditing
