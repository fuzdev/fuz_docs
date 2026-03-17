# TSDoc Comment Style Guide

Conventions for JSDoc/TSDoc comments across the `@fuzdev` ecosystem
(`fuz_ui`, `fuz_css`, `fuz_util`, `svelte-docinfo`) and `@fuzdev/gro`.

## Overview

Doc comments flow through a three-stage pipeline:

1. **`svelte-docinfo`** extracts JSDoc/TSDoc from TypeScript AST at build time,
   producing structured metadata for each exported declaration
2. **Gro gen tasks** run `svelte-docinfo` and output `library.json` with all
   module and declaration metadata
3. **`mdz`** (fuz_ui's markdown dialect) renders documentation with
   auto-linking — backtick-wrapped identifiers become clickable links to API
   docs

As a doc comment author, the key thing to know is: **write standard JSDoc with
the tags below, wrap identifier references in backticks, and the system handles
the rest.**

## Writing Good Documentation

### Prioritize "why" over "what"

Don't restate the function name. Explain why this exists and what problem it
solves.

```ts
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

For multi-stage processes, numbered steps make the flow scannable:

```ts
/**
 * Library metadata generation pipeline.
 *
 * Pipeline stages:
 * 1. **Collection** — `library_collect_source_files` gathers and filters source files
 * 2. **Analysis** — `library_analyze_module` extracts metadata per module
 * 3. **Validation** — `library_find_duplicates` checks flat namespace constraints
 * 4. **Transformation** — `library_merge_re_exports` resolves re-export relationships
 * 5. **Output** — `library_sort_modules` prepares deterministic output
 *
 * @module
 */
```

### Name algorithms and explain rationale

```ts
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

Show where this fits in the larger architecture:

```ts
/**
 * Waits for package version to propagate to NPM registry.
 *
 * Critical for multi-repo publishing: ensures published packages are available
 * before updating dependent packages.
 */
```

### When to document

Focus doc comments on:

- **Public API surfaces** — all exported functions that consumers use
- **Complexity** — where the "why" isn't obvious from the code
- **Side effects** — mutations, async operations, error conditions
- **Domain knowledge** — business rules, algorithms, mathematical concepts

When to skip:

- Simple getters/setters with obvious behavior
- Internal helpers with clear names
- Code where TypeScript types provide sufficient documentation

## Tag Reference

### Main description

Complete sentences ending in a period. For longer descriptions, separate the
summary from details with a blank line:

```ts
/**
 * Formats a person's name in display order.
 *
 * Combines first and last names, handling edge cases like hyphenated or
 * compound surnames. See `format_person_parts` for splitting.
 */
```

### `@param`

Documents function parameters.

**Format:** `@param name - description`

**Format:** `@param name - description`

**Rules:**

- use a hyphen separator between name and description (per TSDoc spec)
- **single-sentence descriptions:** lowercase first word, no trailing period
- **multi-sentence descriptions:** capitalize first word, end with a period
  (all sentences punctuated normally)
- acronyms (CSS, HTML, URL, JSON, API, DOM) and proper names (Zod, Fisher-Yates)
  stay uppercase regardless
- wrap type/identifier references in backticks (same as main descriptions)
- must be in source parameter order
- can include type constraints or expected formats
- the parser strips the leading `- ` for clean rendering, so forgetting it
  is harmless

```ts
/**
 * Parses a semantic version string.
 * @param version_string - version to parse (format: "major.minor.patch")
 * @param allow_prerelease - allow versions with prerelease suffixes like "1.0.0-alpha"
 */
```

Multi-sentence example:

```ts
/**
 * Computes topological sort order for dependency graph.
 * @param exclude_dev - If true, excludes dev dependencies to break cycles.
 *   Publishing uses exclude_dev=true to handle circular dev deps.
 */
```

### `@returns`

Describes the return value. Use `@returns` (not `@return`). Wrap type references
in backticks.

**Rules:**

- **single-sentence descriptions:** lowercase first word, no trailing period
- **multi-sentence descriptions:** capitalize first word, end with a period
- acronyms (CSS, HTML, URL, JSON, API, DOM) and proper names stay uppercase
  regardless

```ts
/**
 * Gets the current time.
 * @returns the current `Date` in milliseconds since epoch
 */
```

For async functions, describe what the `Promise` resolves to:

```ts
/**
 * Fetches user data from the API.
 * @returns user object with id, name, and email fields
 */
export async function fetch_user(id: string): Promise<User> {
	// ...
}
```

### `@throws`

Documents errors that can be thrown. Multiple `@throws` tags list all possible
errors.

Formats:

- `@throws ErrorType description of when this is thrown`
- `@throws just description without type`

```ts
/**
 * Validates and parses user input.
 * @param input - untrusted user input
 * @returns parsed data
 * @throws TypeError if input is not a string
 * @throws SyntaxError if JSON parsing fails
 * @throws RangeError if input exceeds 1000 characters
 */
```

### `@example`

Code examples showing how to use the identifier. Multiple examples allowed.
Code must be wrapped in fenced code blocks for syntax highlighting — `mdz`
renders examples as markdown.

````ts
/**
 * Convert raw TSDoc `@see` content to mdz format for rendering.
 *
 * @param content - raw `@see` tag content in TSDoc format
 * @returns mdz-formatted string ready for `Mdz` component
 *
 * @example
 * ```ts
 * tsdoc_see_to_mdz('{@link https://fuz.dev|API Docs}')
 * // → '[API Docs](https://fuz.dev)'
 *
 * tsdoc_see_to_mdz('{@link SomeType}')
 * // → '`SomeType`'
 * ```
 */
````

Interface fields can have inline `@example` tags too:

````ts
export interface ModuleSourceOptions {
	/**
	 * Source directory paths to include, relative to `project_root`.
	 *
	 * @example
	 * ```ts
	 * ['src/lib'] // single source directory
	 * ```
	 * @example
	 * ```ts
	 * ['src/lib', 'src/routes'] // multiple directories
	 * ```
	 */
	source_paths: Array<string>;
}
````

### `@deprecated`

Marks an identifier as deprecated. Include migration guidance with
backtick-linked replacement:

```ts
/**
 * Legacy way to process data.
 * @deprecated Use `process_data_v2` instead for better performance.
 */
```

### `@see`

Links to related references. Used for both external URLs and sibling module
cross-references.

For external URLs, use `{@link}` syntax:

```ts
/** @see {@link https://tools.ietf.org/html/rfc5322|RFC 5322} */
```

For sibling modules, use the module filename directly:

```ts
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

For identifiers within the same codebase, wrap in backticks instead of using
`{@link}`:

```ts
/** @see `tsdoc_parse` for the extraction step */
```

### `@since`

Documents what version introduced this identifier:

```ts
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

Excludes a declaration from documentation generation and flat namespace
validation. This is a `svelte-docinfo` extension not in standard TSDoc.

Use cases:

- Internal helpers that shouldn't appear in public API docs
- Declarations that conflict with the flat namespace but need to coexist

```ts
/**
 * Internal helper for parsing — not part of public API.
 * @nodocs
 */
export function internal_parse_helper(input: string): void {
	// ...
}
```

Prefer renaming to follow `domain_action` patterns when possible. Use
`@nodocs` only when exclusion is the right solution.

### `@mutates` (non-standard)

Documents side effects when a function mutates its parameters or external state.
This is a `svelte-docinfo` extension not in standard TSDoc.

**Format:** `@mutates <target> - <description>`

**Rules:**

- use a hyphen separator between target and description (consistent with
  `@param`)
- **single-sentence descriptions:** lowercase first word, no trailing period
- **multi-sentence descriptions:** capitalize first word, end with a period
- proper nouns (Fisher-Yates) and acronyms stay uppercase regardless
- explicitly state what mutation happens
- only document mutations that "leak" — visible outside the function
- the parser strips the leading `- ` for clean rendering

**What to document:**

- direct parameter mutations (arrays, objects, DOM events)
- mutations to module-level variables
- mutations to static class properties
- calls to functions that mutate parameters
- mutations to objects in nested properties (like `options.cache`)

**What NOT to document:**

- internal-only mutations (local variables, closure state)
- mutations to instance properties (`this.x` in class methods)
- mutations that don't escape the function scope

Examples:

```ts
/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param array - the array to shuffle
 * @mutates array - randomly reorders elements in place
 */
export function shuffle<T>(array: T[]): T[] {
	// ...
}
```

```ts
/**
 * Handles the value of an event's target and invokes a callback.
 * @mutates event - calls `swallow` which mutates the event if `swallow_event` is true
 */
```

```ts
/**
 * Apply parsed TSDoc metadata to a declaration.
 * @param declaration - declaration object to update
 * @param tsdoc - parsed TSDoc comment (if available)
 * @mutates declaration - adds `doc_comment`, `deprecated_message`, `examples`, `see_also`, `throws`, `since` fields
 */
```

### `@module`

Marks a module-level doc comment. Place at the end of the comment block. See
[Module-level documentation](#module-level-documentation) for full patterns.

### Tag order

When multiple tags are present, follow this order:

1. Main description
2. `@param` (in source parameter order)
3. `@returns`
4. `@throws`
5. `@example`
6. `@deprecated`
7. `@see`
8. `@since`
9. `@default`
10. `@nodocs`
11. `@mutates`

## Inter-linking with mdz

`mdz` auto-links backtick-wrapped identifiers to API documentation. This is the
primary mechanism for cross-referencing within doc comments.

### How it works

1. `mdz` parses backtick content as `Code` nodes
2. `DocsLink.svelte` resolves each reference:
   - first tries `library.lookup_declaration(reference)` — matches exported
     functions, types, classes, variables
   - then tries `library.lookup_module(reference)` — matches module filenames
   - falls back to plain `<code>` if neither matches
3. Matched references render as clickable links to the API docs page

### Always link

**Wrap every mention of an exported identifier, module filename, or type name in
backticks.** This maximizes discoverability — readers can click through to see
the full API.

```ts
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

Paths starting with `/` after whitespace are auto-linked as internal navigation:

```ts
/**
 * See /docs/api for the full API reference.
 */
```

**Gotcha — API route lists in backend modules**: Any `/word` pattern gets
auto-linked, including HTTP route paths. In backend module docs that list routes,
bare paths create broken internal links that fail SvelteKit prerender:

```ts
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

References are case-sensitive and must match the exact exported identifier name.
`` `library` `` will NOT match `Library`.

### `{@link}` vs backticks

Use backticks for identifier references. Reserve `{@link}` for external URLs in
`@see` tags:

```ts
// Preferred — backtick for identifier
/** See `tsdoc_parse` for the extraction step. */

// Avoid — {@link} for identifier
/** See {@link tsdoc_parse} for the extraction step. */

// Correct — {@link} for URL
/** @see {@link https://fuz.dev|Fuz documentation} */
```

## Documentation Patterns

### Module-level documentation

Every module should have a doc comment with the `@module` tag. This is the
entry point for understanding the module's purpose.

**Basic pattern:**

```ts
/**
 * Module path and metadata helpers.
 *
 * Provides utilities for working with source module paths, file types,
 * and import relationships in the package generation system.
 *
 * @module
 */
```

**Design sections** use `##` headings inside the doc comment for complex
modules:

```ts
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

**Pipeline stages** with `@see` cross-references:

```ts
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

**Design philosophy** for core modules:

```ts
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

Full tag example:

```ts
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

Class-level docs describe hierarchy and purpose. Property docs for `$derived`
fields use brief inline comments:

```ts
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
	 * Declaration lookup map by name. Provides O(1) lookup.
	 */
	declaration_map = $derived(/* ... */);

	/**
	 * Look up a declaration by name.
	 */
	lookup_declaration(name: string): Declaration | undefined {
		return this.declaration_map.get(name);
	}
}
```

### Interfaces

Field-level inline docs with `@default` and `@example`:

````ts
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
	/** File content (required — analysis functions don't read from disk). */
	content: string;
	/**
	 * Absolute file paths of modules this file imports (optional).
	 * Only include resolved local imports, not node_modules.
	 * Order should be declaration order in source for deterministic output.
	 */
	dependencies?: ReadonlyArray<string>;
}
````

````ts
export interface ModuleSourceOptions {
	/**
	 * Absolute path to the project root directory.
	 *
	 * All `source_paths` are relative to this.
	 *
	 * @example
	 * ```ts
	 * '/home/user/my-project'
	 * ```
	 */
	project_root: string;
	/**
	 * Source directory paths to include, relative to `project_root`.
	 *
	 * @example
	 * ```ts
	 * ['src/lib'] // single source directory
	 * ```
	 * @example
	 * ```ts
	 * ['src/lib', 'src/routes'] // multiple directories
	 * ```
	 */
	source_paths: Array<string>;
}
````

### Svelte components

Document props inline in the `$props()` type annotation using JSDoc on each
field:

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

For props with obvious types and no default, a comment is optional. Focus
documentation on behavior, constraints, and non-obvious defaults.

### Type aliases

Bullet lists describe union type variants:

```ts
/**
 * Analyzer type for source files.
 *
 * - `'typescript'` — TypeScript/JS files analyzed via TypeScript Compiler API
 * - `'svelte'` — Svelte components analyzed via svelte2tsx + TypeScript
 *   Compiler API
 */
export type AnalyzerType = 'typescript' | 'svelte';
```

### Bullet items

Bullet items that are NOT complete sentences should use lowercase and no
trailing period:

```md
- this is a bullet item describing something
- another item without a period
- complete sentences in bullets are fine too. They end with periods.
```

## Auditing Coverage

Use `generate_jsdoc_audit.ts` to audit JSDoc coverage across a project:

```bash
gro run skills/fuz-stack/scripts/generate_jsdoc_audit.ts
```

This generates `jsdoc_audit.md` containing a checklist of all files in
`src/lib/` with status indicators for JSDoc presence.

### When to audit

- **Pre-release** — ensure public APIs are documented
- **Post-refactoring** — verify documentation stayed in sync
- **Code reviews** — identify documentation gaps
- **Regular maintenance** — periodic documentation sweeps

### Interpreting results

- **Files WITH JSDoc** — review for accuracy, completeness, and adherence to
  conventions
- **Files WITHOUT JSDoc** — evaluate if documentation is needed (many utility
  functions don't need JSDoc if TypeScript types are sufficient)

## Ecosystem Conventions

These conventions are shared across `@fuzdev` packages:

- `fuz_ui` — Svelte UI components, `mdz` rendering, documentation system
- `fuz_css` — CSS framework and design system
- `fuz_util` — general-purpose utilities
- `svelte-docinfo` — build-time code analysis and metadata extraction
- Gro (`@fuzdev/gro`) — build system and code generation

All packages use the same identifier naming pattern (`domain_action`), the same
JSDoc tag conventions, and generate documentation through the same
`svelte-docinfo` → `library.json` → `mdz` pipeline.
