# TSDoc Comment Style Guide

JSDoc/TSDoc conventions for `@fuzdev` packages.

## Overview

Doc comments flow through a three-stage pipeline:

1. **fuz_ui analysis** — `tsdoc_helpers.ts`, `ts_helpers.ts`,
   `svelte_helpers.ts` extract JSDoc/TSDoc from TypeScript AST, producing
   structured metadata per declaration
2. **Gro gen tasks** — `library.gen.ts` outputs `library.json` and
   `library.ts` with all module and declaration metadata
3. **`mdz`** renders docs with auto-linking — backticked identifiers become
   clickable links to API docs

**Write standard JSDoc with the tags below, wrap identifier references in
backticks, and the system handles the rest.**

## Writing Good Documentation

### Prioritize "why" over "what"

Don't restate the function name. Explain why this exists and what problem it
solves.

```typescript
// Weak — restates function name
/**
 * Predicts the next version for a repo based on its changesets.
 */

// Strong — explains purpose
/**
 * Predicts the next version by analyzing all changesets in a repo.
 *
 * Critical for dry-run mode accuracy — allows simulating publishes without
 * actually running `gro publish` which consumes changesets.
 *
 * @returns predicted version and bump type, or null if no changesets
 */
```

### Document workflows with numbered steps

```typescript
/**
 * Multi-repo publishing pipeline.
 *
 * Steps:
 * 1. **Sort** — `compute_topological_order` determines publish order
 * 2. **Changeset** — `predict_next_version` simulates version bumps
 * 3. **Publish** — `publish_package` publishes and waits for propagation
 * 4. **Update** — `update_dependents` bumps downstream version ranges
 *
 * @module
 */
```

### Name algorithms and explain rationale

```typescript
/**
 * Computes topological sort order for dependency graph.
 *
 * Uses Kahn's algorithm with alphabetical ordering within tiers for
 * deterministic results.
 *
 * @param exclude_dev - If true, excludes dev dependencies to break cycles.
 *   Publishing uses exclude_dev=true to handle circular dev deps.
 */
```

### Explain system context

```typescript
/**
 * Waits for package version to propagate to NPM registry.
 *
 * Critical for multi-repo publishing: ensures published packages are available
 * before updating dependent packages.
 */
```

### When to document

Focus on:

- **Public API surfaces** — all exported functions consumers use
- **Complexity** — where the "why" isn't obvious
- **Side effects** — mutations, async operations, error conditions
- **Domain knowledge** — business rules, algorithms

Skip:

- Simple getters/setters with obvious behavior
- Internal helpers with clear names
- Code where TypeScript types provide sufficient documentation

## Tag Reference

### Main description

Complete sentences ending in a period. Separate summary from details with a
blank line:

```typescript
/**
 * Formats a person's name in display order.
 *
 * Combines first and last names, handling edge cases like hyphenated or
 * compound surnames. See `format_person_parts` for splitting.
 */
```

### `@param`

**Format:** `@param name - description`

- Hyphen separator (per TSDoc spec)
- **Single-sentence:** lowercase, no period
- **Multi-sentence:** capitalize, end with period
- Acronyms (CSS, HTML, URL) and proper names (Zod, Fisher-Yates) stay uppercase
- Wrap type/identifier references in backticks
- Must be in source parameter order
- Parser strips leading `- ` for rendering

```typescript
/**
 * Parses a semantic version string.
 * @param version_string - version to parse (format: "major.minor.patch")
 * @param allow_prerelease - allow versions with prerelease suffixes like "1.0.0-alpha"
 */
```

Multi-sentence:

```typescript
/**
 * Computes topological sort order for dependency graph.
 * @param exclude_dev - If true, excludes dev dependencies to break cycles.
 *   Publishing uses exclude_dev=true to handle circular dev deps.
 */
```

### `@returns`

Use `@returns` (not `@return`). Same capitalization rules as `@param`.

```typescript
/**
 * Gets the current time.
 * @returns the current `Date` in milliseconds since epoch
 */
```

For async functions, describe what the `Promise` resolves to:

```typescript
/**
 * Fetches user data from the API.
 * @returns user object with id, name, and email fields
 */
export async function fetch_user(id: string): Promise<User> {
	// ...
}
```

### `@throws`

Three formats (all used):

- `@throws ErrorType description` — type as first word (most common)
- `@throws {ErrorType} description` — type in curly braces
- `@throws description` — no type

```typescript
/**
 * @throws Error if task with given name doesn't exist
 */

/**
 * @throws {TaskError} if production cycles detected
 */

/**
 * @throws if timeout_ms is negative
 */
```

### `@example`

Code must be in fenced code blocks for syntax highlighting — `mdz` renders
examples as markdown.

````typescript
/**
 * Convert raw TSDoc `@see` content to mdz format for rendering.
 *
 * @param content - raw `@see` tag content in TSDoc format
 * @returns mdz-formatted string ready for `Mdz` component
 *
 * @example
 * ```typescript
 * tsdoc_see_to_mdz('{@link https://fuz.dev|API Docs}')
 * // → '[API Docs](https://fuz.dev)'
 *
 * tsdoc_see_to_mdz('{@link SomeType}')
 * // → '`SomeType`'
 * ```
 */
````

Interface fields can have inline `@example` tags:

````typescript
export interface ModuleSourceOptions {
	/**
	 * Source directory paths to include, relative to `project_root`.
	 *
	 * @example
	 * ```typescript
	 * ['src/lib'] // single source directory
	 * ```
	 * @example
	 * ```typescript
	 * ['src/lib', 'src/routes'] // multiple directories
	 * ```
	 */
	source_paths: Array<string>;
}
````

#### Writing effective examples

Focus on giving the reader a clear mental model of how to use the API:

- Show the most common use case first — additional `@example` tags for variants
- Use `// =>` or `// →` comments to show return values inline
- For option objects, show the minimal required fields
- For type narrowing helpers, show the pattern that makes the types useful
- Constants and simple predicates don't need examples unless usage is non-obvious
- Keep examples complete enough to understand without reading the implementation

````typescript
// Good — shows input and return value
/**
 * @example
 * ```ts
 * get_component_name('components/Button.svelte') // => 'Button'
 * ```
 */

// Good — shows the pattern that motivates the API
/**
 * @example
 * ```ts
 * if (is_kind(declaration, 'function')) {
 *   declaration.parameters; // narrowed to FunctionDeclarationJson
 *   declaration.return_type; // accessible after narrowing
 * }
 * ```
 */

// Good — shows minimal setup and the typical workflow
/**
 * @example
 * ```ts
 * const {modules, diagnostics} = await analyze_from_files({
 *   project_root: process.cwd(),
 * });
 * if (diagnostics.has_errors()) {
 *   for (const err of diagnostics.errors()) {
 *     console.error(format_diagnostic(err));
 *   }
 * }
 * ```
 */

// Weak — doesn't show what the function does or returns
/**
 * @example
 * ```ts
 * process_data(input);
 * ```
 */
````

### `@deprecated`

Include migration guidance with backtick-linked replacement. Rarely used —
"no backwards compatibility" policy means deprecated code is usually deleted.

```typescript
/**
 * Legacy way to process data.
 * @deprecated Use `process_data_v2` instead for better performance.
 */
```

### `@see`

Three patterns:

**External URLs** — `{@link}` for display text, bare URL when self-explanatory:

```typescript
/** @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event} */
/** @see {@link https://tools.ietf.org/html/rfc5322|RFC 5322} */
/** @see https://github.com/colinhacks/zod#brand */
```

**Sibling modules** — filename for cross-references within a package:

```typescript
/**
 * Gro-specific library metadata generation.
 *
 * @see library_generate.ts for the generic generation entry point
 * @see library_pipeline.ts for pipeline helpers
 * @see library_output.ts for output file generation
 *
 * @module
 */
```

**Identifiers** — wrap in backticks (not `{@link}`):

```typescript
/** @see `tsdoc_parse` for the extraction step */
/** @see `format_number` in `maths.ts` for the underlying implementation. */
```

### `@since`

Supported by the parser but not currently used. Use when versioning matters.

```typescript
/**
 * Generates a UUID v4.
 * @since 1.5.0
 */
```

### `@default`

Documents default values for interface fields and component props:

```svelte
const {
	layout = 'centered',
	index = 0,
	content_selector = '.pane',
}: {
	/**
	 * @default 'centered'
	 */
	layout?: DialogLayout;
	/**
	 * Index 0 is under 1 is under 2 — the topmost dialog is last in the array.
	 * @default 0
	 */
	index?: number;
	/**
	 * If provided, prevents clicks that would close the dialog
	 * from bubbling past any elements matching this selector.
	 * @default '.pane'
	 */
	content_selector?: string | null;
} = $props();
```

### `@nodocs` (non-standard)

Excludes from docs generation and flat namespace validation. Supported by
fuz_ui's `tsdoc_helpers.ts` and `svelte-docinfo`.

Use cases:

- **Gro task exports** — `Args` and `task` are build system internals (most
  common use)
- **Gen file exports** — `gen` function called by Gro
- **Flat namespace conflicts** — declarations that need to coexist

```typescript
/** @nodocs */
export const Args = z.object({...});

/** @nodocs */
export const task: Task<typeof Args> = {...};
```

Prefer renaming to `domain_action` patterns when possible. Use `@nodocs` only
when exclusion is the right solution.

### `@mutates` (non-standard)

Documents mutations to parameters or external state. Supported by fuz_ui's
`tsdoc_helpers.ts`.

Two formats:

- `@mutates target - description` — bare name with hyphen (most common)
- `` @mutates `target` `` — backtick-wrapped, no description (when obvious)

Same capitalization rules as `@param`. Only document mutations visible outside
the function — not internal locals, closure state, or `this.x` in methods.

```typescript
/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array - the array to shuffle
 * @mutates array - randomly reorders elements in place
 */
export function shuffle<T>(array: T[]): T[] {
	// ...
}
```

```typescript
/**
 * Apply named middleware specs to a Hono app.
 *
 * @param app - the Hono app
 * @param specs - middleware specs to apply
 * @mutates `app`
 */
```

### `@module`

Marks a module-level doc comment. Place at end of comment block. Works in
`.ts` files and `.svelte` components.

```svelte
<script lang="ts">
	/**
	 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/alert/}
	 *
	 * @module
	 */
</script>
```

### Tag order

1. Main description
2. `@param` (in source parameter order)
3. `@returns`
4. `@mutates`
5. `@throws`
6. `@example`
7. `@deprecated`
8. `@see`
9. `@since`
10. `@default`
11. `@nodocs`

`@mutates` goes after `@returns` (or after `@param` if no return), logically
adjacent to parameter and return documentation.

## Inter-linking with mdz

Backtick-wrapped identifiers auto-link to API docs.

### How it works

1. `mdz` parses backtick content as `Code` nodes
2. `DocsLink.svelte` resolves: `library.declaration_by_name.get(ref)` →
   `library.module_by_path.get(ref)` → plain `<code>` fallback
3. Matches render as clickable links to API docs

### Always link

**Wrap every mention of an exported identifier, module filename, or type name
in backticks.** This maximizes discoverability.

```typescript
/**
 * Wraps `LibraryJson` with computed properties and provides the root
 * of the API documentation hierarchy: `Library` → `Module` → `Declaration`.
 *
 * @see `module.svelte.ts` for `Module` class
 * @see `declaration.svelte.ts` for `Declaration` class
 */
```

What to wrap:

- exported function names: `` `tsdoc_parse` ``, `` `shuffle` ``
- type and interface names: `` `ModuleJson` ``, `` `SourceFileInfo` ``
- class names: `` `Library` ``, `` `Declaration` ``
- module filenames: `` `module_helpers.ts` ``, `` `DocsLink.svelte` ``
- tag names in prose: `` `@param` ``, `` `@returns` ``
- enum and constant names

### Internal paths

Paths starting with `/` after whitespace auto-link as internal navigation.

**Gotcha — API route lists**: `/word` patterns get auto-linked, including HTTP
routes. Bare paths create broken links that fail SvelteKit prerender:

```typescript
// BAD — mdz auto-links /login as internal route, breaks prerender
/**
 * - POST /login
 * - GET /session
 */

// GOOD — backtick-wrapped renders as <code>, not <a>
/**
 * - `POST /login`
 * - `GET /session`
 */
```

### Case sensitivity

References are case-sensitive. `` `library` `` will NOT match `Library`.

### `{@link}` vs backticks

Backticks for identifiers. `{@link}` for external URLs in `@see`:

```typescript
// Preferred — backtick for identifier
/** See `tsdoc_parse` for the extraction step. */

// Avoid — {@link} for identifier
/** See {@link tsdoc_parse} for the extraction step. */

// Correct — {@link} for URL
/** @see {@link https://fuz.dev|Fuz documentation} */
```

## Documentation Patterns

### Module-level documentation

Prioritize `@module` for modules with design rationale, pipeline stages, or
cross-references.

**Basic:**

```typescript
/**
 * Module path and metadata helpers.
 *
 * Provides utilities for working with source module paths, file types,
 * and import relationships in the package generation system.
 *
 * @module
 */
```

**Design sections** with `##` headings for complex modules:

```typescript
/**
 * TSDoc/JSDoc parsing helpers using the TypeScript Compiler API.
 *
 * ## Design
 *
 * Pure extraction approach: extracts documentation as-is with minimal
 * transformation, preserving source intent. Works around TypeScript
 * Compiler API quirks where needed.
 *
 * ## Tag support
 *
 * Supports a subset of standard TSDoc tags:
 * `@param`, `@returns`, `@throws`, `@example`, `@deprecated`, `@see`,
 * `@since`, `@nodocs`.
 *
 * ## Behavioral notes
 *
 * Due to TS Compiler API limitations:
 * - `@throws` tags have `{Type}` stripped by TS API; fallback regex
 *   extracts first word as error type
 * - TS API strips URL protocols from `@see` tag text; we use
 *   `getText()` to preserve original format
 *
 * @module
 */
```

**Pipeline stages** — combines numbered steps with `@see` cross-references
(see also the [Document workflows with numbered steps](#document-workflows-with-numbered-steps)
pattern above):

```typescript
/**
 * Library metadata generation pipeline.
 *
 * Pipeline stages:
 * 1. **Collection** — `library_collect_source_files` gathers and filters
 * 2. **Analysis** — `library_analyze_module` extracts metadata
 * 3. **Validation** — `library_find_duplicates` checks flat namespace
 * 4. **Transformation** — `library_merge_re_exports` resolves re-exports
 * 5. **Output** — `library_sort_modules` prepares deterministic output
 *
 * @see library_generate.ts for the main generation entry point
 * @see library_analysis.ts for module-level analysis
 * @see library_output.ts for output file generation
 * @see library_gen.ts for Gro-specific integration
 *
 * @module
 */
```

**Design philosophy:**

```typescript
/**
 * mdz — minimal markdown dialect for Fuz documentation.
 *
 * ## Design philosophy
 *
 * - **False negatives over false positives**: When in doubt, treat as
 *   plain text.
 * - **One way to do things**: Single unambiguous syntax per feature.
 * - **Explicit over implicit**: Clear delimiters avoid ambiguity.
 * - **Simple over complete**: Prefer simple parsing rules.
 *
 * @module
 */
```

### Functions

```typescript
/**
 * Find duplicate declaration names across modules.
 *
 * Returns a `Map` of declaration names to their full metadata
 * (only includes duplicates). Callers decide how to handle duplicates
 * (throw, warn, ignore).
 *
 * @example
 * const duplicates = library_find_duplicates(source_json);
 * if (duplicates.size > 0) {
 *   for (const [name, occurrences] of duplicates) {
 *     console.error(`"${name}" found in:`);
 *     for (const {declaration, module} of occurrences) {
 *       console.error(`  - ${module}:${declaration.source_line}`);
 *     }
 *   }
 * }
 */
export const library_find_duplicates = (
	source_json: SourceJson,
): Map<string, Array<DuplicateInfo>> => {
	// ...
};
```

### Classes

```typescript
/**
 * Rich runtime representation of a library.
 *
 * Wraps `LibraryJson` with computed properties and provides the root
 * of the API documentation hierarchy: `Library` → `Module` → `Declaration`.
 *
 * @see `module.svelte.ts` for `Module` class
 * @see `declaration.svelte.ts` for `Declaration` class
 */
export class Library {
	/**
	 * URL path prefix for multi-package documentation sites.
	 * Prepended to `/docs/api/` paths in `Module.url_api` and
	 * `Declaration.url_api`. Default `''` preserves single-package behavior.
	 */
	readonly url_prefix: string;

	/**
	 * All modules as rich `Module` instances.
	 */
	modules = $derived(/* ... */);

	/**
	 * Module lookup map by path.
	 */
	module_by_path = $derived(/* ... */);

	/**
	 * Declaration lookup map by name.
	 */
	declaration_by_name = $derived(/* ... */);

	/**
	 * Search declarations by query string with multi-term AND logic.
	 */
	search_declarations(query: string): Array<Declaration> {
		// ...
	}
}
```

### Interfaces

````typescript
/**
 * File information for source analysis.
 *
 * Can be constructed from Gro's `Disknode` or from plain file system access.
 * This abstraction enables non-Gro usage while keeping Gro support via adapter.
 *
 * Note: `content` is required to keep analysis functions pure (no hidden I/O).
 */
export interface SourceFileInfo {
	/** Absolute path to the file. */
	id: string;
	/** File content (required - analysis functions don't read from disk). */
	content: string;
	/**
	 * Absolute file paths of modules this file imports (optional).
	 * Only include resolved local imports, not node_modules.
	 * Order should be declaration order in source for deterministic output.
	 */
	dependencies?: ReadonlyArray<string>;
	/**
	 * Absolute file paths of modules that import this file (optional).
	 * Only include resolved local imports, not node_modules.
	 */
	dependents?: ReadonlyArray<string>;
}
````

````typescript
export interface ModuleSourceOptions {
	/**
	 * Absolute path to the project root directory.
	 *
	 * All `source_paths` are relative to this.
	 *
	 * @example
	 * ```typescript
	 * '/home/user/my-project'
	 * ```
	 */
	project_root: string;
	/**
	 * Source directory paths to include, relative to `project_root`.
	 *
	 * @example
	 * ```typescript
	 * ['src/lib'] // single source directory
	 * ```
	 * @example
	 * ```typescript
	 * ['src/lib', 'src/routes'] // multiple directories
	 * ```
	 */
	source_paths: Array<string>;
}
````

### Svelte components

Document props inline in the `$props()` type annotation:

```svelte
<script lang="ts">
	const {
		container,
		layout = 'centered',
		index = 0,
		active = true,
		content_selector = '.pane',
		onclose,
		children,
	}: {
		container?: HTMLElement;
		/**
		 * @default 'centered'
		 */
		layout?: DialogLayout;
		/**
		 * Index 0 is under 1 is under 2 — the topmost dialog
		 * is last in the array.
		 * @default 0
		 */
		index?: number;
		/**
		 * @default true
		 */
		active?: boolean;
		/**
		 * If provided, prevents clicks that would close the dialog
		 * from bubbling past any elements matching this selector.
		 * @default '.pane'
		 */
		content_selector?: string | null;
		onclose?: () => void;
		children: Snippet<[close: (e?: Event) => void]>;
	} = $props();
</script>
```

For obvious props with no default, a comment is optional. Focus on behavior,
constraints, and non-obvious defaults.

### Type aliases

```typescript
/**
 * Analyzer type for source files.
 *
 * - `'typescript'` - TypeScript/JS files analyzed via TypeScript Compiler API
 * - `'svelte'` - Svelte components analyzed via svelte2tsx + TypeScript Compiler API
 */
export type AnalyzerType = 'typescript' | 'svelte';
```

### Bullet items

Non-sentence bullets: lowercase, no trailing period:

```md
- this is a bullet item describing something
- another item without a period
- complete sentences in bullets are fine too. They end with periods.
```

## Auditing Coverage

```bash
gro run skills/fuz-stack/scripts/generate_jsdoc_audit.ts
```

Generates `jsdoc_audit.md` — a checklist of `src/lib/` files that contain
JSDoc, for reviewing and cleaning up existing comments. Files without JSDoc
are omitted.

### When to audit

- Pre-release — ensure public APIs are documented
- Post-refactoring — verify docs stayed in sync
- Code reviews — identify documentation gaps

## Ecosystem Conventions

Shared across `@fuzdev` packages (fuz_ui, fuz_css, fuz_util, fuz_app, gro).
All use `domain_action` naming, the same JSDoc tags, and generate docs through
fuz_ui analysis → `library.json` → `mdz` pipeline.
