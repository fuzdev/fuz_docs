# Documentation System

How documentation works across `@fuzdev` projects — the pipeline, Tome system,
layout architecture, and project setup. This reference is AI-generated and
mostly poorly reviewed — not all patterns are endorsed, and details may be
out of date or incorrect.

For TSDoc/JSDoc authoring conventions, see `./tsdoc-comments.md`.

## Pipeline Overview

```
svelte-docinfo → library_gen.ts → library.json → Library class → Tome pages + API routes
```

| Stage             | What                          | Key details                                                                                            |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Analysis**      | `@fuzdev/svelte-docinfo`      | Extracts metadata from TS/Svelte via TypeScript compiler API. Build-tool agnostic (`SourceFileInfo[]`) |
| **Generation**    | `library_gen()` in fuz_ui     | Wraps `analyze()` with Gro `Gen` format + `SourceJson` metadata. Run via `gro gen`                     |
| **Serialization** | `library.json` + `library.ts` | Compact JSON (`jsonReplacerCompact` strips empty arrays). Typed wrapper for import                     |
| **Runtime**       | `Library` class               | Wraps JSON into `Module` and `Declaration` instances with computed properties and lookup               |
| **Rendering**     | Tome pages + API routes       | Manual tomes + auto-generated API docs. `mdz` auto-links backticked identifiers                        |

## Tome System

A **Tome** is a documentation page. The `Tome` type is a Zod schema defined in
`@fuzdev/fuz_ui/tome.js`:

```ts
{
  name: string;           // URL slug and display name
  category: string;       // grouping in sidebar navigation
  Component: Component;   // the +page.svelte component
  related_tomes: string[];        // cross-links to other tome pages
  related_modules: string[];      // links to source modules in API docs
  related_declarations: string[]; // links to specific exports in API docs
}
```

### Cross-references

The `related_*` fields create navigation links in the docs sidebar:

| Field                  | Links to                     | Example value                 |
| ---------------------- | ---------------------------- | ----------------------------- |
| `related_tomes`        | Other tome pages             | `['ThemeRoot']`               |
| `related_modules`      | Source files in `/docs/api/` | `['theme_state.svelte.ts']`   |
| `related_declarations` | Specific exports in API docs | `['ThemeRoot', 'ThemeState']` |

### Categories

Categories group tomes in the sidebar navigation. They are project-specific:

| Project | Categories                       |
| ------- | -------------------------------- |
| fuz_ui  | `guide`, `helpers`, `components` |
| fuz_css | `guide`, `systems`, `styles`     |

Choose categories that make sense for your project's content.

### Registry

Every project with docs has a central registry at `src/routes/docs/tomes.ts`
that imports each tome's page component and exports the full array:

```ts
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

- `get_tome_by_name(name)` — look up a Tome from context (throws if not found)
- `to_tome_pathname(tome, docs_path?, hash?)` — generate URL for a tome
- `docs_slugify(name)` — convert tome name to URL-safe slug

## Setting Up Docs in a Project

Six files to create, following the pattern established in fuz_ui and fuz_css.

### 1. Library generation

`src/routes/library.gen.ts` — Gro gen task that runs svelte-docinfo:

```ts
import {library_gen} from '@fuzdev/fuz_ui/library_gen.js';
import {throwOnDuplicates} from '@fuzdev/svelte-docinfo/analyze.js';

export const gen = library_gen({on_duplicates: throwOnDuplicates});
```

Run `gro gen` to produce `library.json` and `library.ts`.

### 2. Root layout

In `src/routes/+layout.svelte`, create a `Library` instance and provide it.
The generated `library.ts` wraps the JSON with a typed export:

```svelte
<script lang="ts">
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.js';
	import {library_json} from '$routes/library.js';

	library_context.set(new Library(library_json));
</script>
```

### 3. Docs layout

`src/routes/docs/+layout.svelte` — wraps children in the three-column layout:

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

The `breadcrumb_children` snippet is optional — use it to customize the logo
in the top nav bar.

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
depth. Sections are tracked by IntersectionObserver for the right sidebar
table of contents.

### 6. API routes

Two route files for auto-generated API documentation:

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

**Responsive behavior**: The right sidebar collapses below ~1000px. The left
sidebar collapses below ~800px and moves into a dialog accessible from the
top bar.

### Key contexts

The docs layout sets and consumes these contexts:

| Context              | Type                | Purpose                                      |
| -------------------- | ------------------- | -------------------------------------------- |
| `library_context`    | `Library`           | API metadata (modules, declarations, lookup) |
| `tomes_context`      | `Map<string, Tome>` | All registered tomes                         |
| `tome_context`       | `Tome`              | Current page's tome (set by `TomeContent`)   |
| `docs_links_context` | `DocsLinks`         | Fragment tracking for section navigation     |

## Component Reference

| Component            | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `Docs`               | Three-column layout, sets navigation contexts                |
| `TomeContent`        | Individual tome page wrapper, sets `tome_context`            |
| `TomeSection`        | Section container with depth tracking and intersection       |
| `TomeSectionHeader`  | Section heading with hashlink (auto h2/h3/h4)                |
| `TomeLink`           | Cross-reference link to another tome                         |
| `ApiIndex`           | API overview with search, lists all modules and declarations |
| `ApiModule`          | Single module's declarations with full detail                |
| `ApiDeclarationList` | Declaration listing within a module                          |
| `DeclarationLink`    | Link to a declaration in API docs                            |
| `ModuleLink`         | Link to a module in API docs                                 |
| `LibrarySummary`     | Compact package metadata card                                |
| `LibraryDetail`      | Expanded package info with file type breakdown               |

## See Also

- **`svelte_preprocess_mdz`** — build-time compilation of static `<Mdz>` content
  to pre-rendered Svelte markup, eliminating runtime parsing for known-static
  doc strings. See the `svelte_preprocess_mdz` tome in fuz_ui docs.
- **`vite_plugin_library_well_known`** — publishes library metadata at
  `.well-known/library.json` (RFC 8615) for external tool discovery. See the
  `vite_plugin_library_well_known` tome in fuz_ui docs.
- **`./tsdoc-comments.md`** — TSDoc/JSDoc authoring conventions, tag reference,
  mdz auto-linking, and documentation auditing.

## Cross-Project Pattern

fuz_ui **defines** all documentation components. Other projects **import** them:

```ts
// In fuz_ui (defines the components)
import Docs from '$lib/Docs.svelte';
import {library_context} from '$lib/library.svelte.js';

// In fuz_css or any consumer project
import Docs from '@fuzdev/fuz_ui/Docs.svelte';
import {library_context} from '@fuzdev/fuz_ui/library.svelte.js';
```

The layout structure is identical — only tomes, categories, and breadcrumb
branding differ. `library_gen()` + svelte-docinfo is the shared analysis
engine.
