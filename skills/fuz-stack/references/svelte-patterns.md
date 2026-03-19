# Svelte 5 Patterns

Svelte 5 runes and patterns used across the Fuz ecosystem.

## Contents

- [State Runes](#state-runes)
- [Derived Values](#derived-values)
- [Reactive Collections](#reactive-collections)
- [Schema-Driven Reactive Classes](#schema-driven-reactive-classes)
- [Context Patterns](#context-patterns)
- [Snippet Patterns](#snippet-patterns)
- [Effect Patterns](#effect-patterns)
- [Attachment Patterns](#attachment-patterns)
- [Props Patterns](#props-patterns)
- [Event Handling](#event-handling)
- [Component Composition](#component-composition)
- [Runes in .svelte.ts Files](#runes-in-sveltets-files)
- [Quick Reference](#quick-reference)

## State Runes

### `$state()` vs `$state.raw()`

`$state()` for deep reactivity. `$state.raw()` for data replaced wholesale.

```typescript
// $state() - deep reactivity, use for UI state
let form_data = $state({name: '', email: ''});
form_data.name = 'Alice'; // triggers reactivity

// $state.raw() - shallow, use for API responses and immutable data
let ollama_show_response = $state.raw<OllamaShowResponse | null>(null);
let completion_request = $state.raw<CompletionRequest | null>(null);
let completion_response = $state.raw<CompletionResponse | null>(null);
```

**When to use `$state.raw()`:**

- API responses (replaced entirely on each fetch)
- ReadonlyArray collections replaced via spread (`$state.raw([])`)
- Large objects where deep tracking is wasteful
- Immutable data structures
- Objects from external libraries

**When to use `$state()`:**

- Form state with individual field updates
- UI state (toggles, selections, counters)
- Objects you'll mutate property-by-property

### The `$state()!` Non-null Assertion Pattern

Class properties initialized by constructor or `init()` use `$state()!`:

```typescript
export class ThemeState {
	theme: Theme = $state()!;
	color_scheme: ColorScheme = $state()!;

	constructor(options?: ThemeStateOptions) {
		this.theme = options?.theme ?? default_themes[0]!;
		this.color_scheme = options?.color_scheme ?? 'auto';
	}
}
```

Used in fuz_ui state classes (`ThemeState`, `ContextmenuState`, `DocsLinks`,
`Library`) and zzz Cell subclasses.

### Arrays and Collections

```typescript
// Reactive array - mutations tracked
let items = $state<string[]>([]);
items.push('new'); // triggers reactivity
items[0] = 'updated'; // triggers reactivity

// Raw array - only replacement tracked (common for immutable lists)
let selections: ReadonlyArray<ItemState> = $state.raw([]);
selections = [...selections, new_item]; // triggers
selections.push(new_item); // does NOT trigger (and type error with ReadonlyArray)
```

Real example from `ContextmenuState`:

```typescript
// ReadonlyArray + $state.raw() for immutable-style updates
params: ReadonlyArray<ContextmenuParams> = $state.raw([]);
selections: ReadonlyArray<ItemState> = $state.raw([]);
items: ReadonlyArray<ItemState> = $state.raw([]);
```

## Derived Values

### `$derived` vs `$derived.by()`

`$derived` for simple expressions. `$derived.by()` for loops, conditionals,
or multi-step logic.

```typescript
// Simple expression - use $derived
let count = $state(0);
let doubled = $derived(count * 2);
let is_empty = $derived(items.length === 0);

// Complex logic - use $derived.by()
let filtered_items = $derived.by(() => {
	if (!filter) return items;
	return items.filter((item) => item.name.includes(filter));
});

// Loops require $derived.by()
let total = $derived.by(() => {
	let sum = 0;
	for (const item of items) {
		sum += item.value;
	}
	return sum;
});
```

### `$derived` in Classes

Class properties use `$derived` and `$derived.by()` directly:

```typescript
// From Library class (fuz_ui/library.svelte.ts)
export class Library {
	readonly library_json: LibraryJson = $state.raw()!;

	readonly name = $derived(this.library_json.name);
	readonly repo_url = $derived(this.library_json.repo_url);
	readonly modules = $derived(
		this.source_json.modules
			? this.source_json.modules.map((m) => new Module(this, m))
			: [],
	);
	readonly module_by_path = $derived(
		new Map(this.modules.map((m) => [m.path, m])),
	);
}
```

```typescript
// From Thread class (zzz/thread.svelte.ts) - $derived.by for complex logic
readonly model: Model = $derived.by(() => {
	const model = this.app.models.find_by_name(this.model_name);
	if (!model) throw new Error(`Model "${this.model_name}" not found`);
	return model;
});

// From ContextmenuState - $derived for simple, $derived.by for multi-step
can_collapse = $derived(this.selections.length > 1);

can_expand = $derived.by(() => {
	const selected = this.selections.at(-1);
	return !!selected?.is_menu && selected.items.length > 0;
});
```

### Derived with Dependencies

```typescript
let search = $state('');
let category = $state('all');

// Re-computes when search OR category changes
let filtered = $derived.by(() => {
	let result = items;
	if (category !== 'all') {
		result = result.filter((i) => i.category === category);
	}
	if (search) {
		result = result.filter((i) => i.name.includes(search));
	}
	return result;
});
```

## Reactive Collections

### `SvelteMap` and `SvelteSet`

From `svelte/reactivity` — reactive Map/Set that trigger updates on mutations:

```typescript
import {SvelteMap, SvelteSet} from 'svelte/reactivity';

// From DocsLinks class (fuz_ui/docs_helpers.svelte.ts)
export class DocsLinks {
	readonly links: SvelteMap<string, DocsLinkInfo> = new SvelteMap();
	readonly fragments_onscreen: SvelteSet<string> = new SvelteSet();
}
```

Standard `Map`/`Set` are not tracked by Svelte's reactivity.

## Schema-Driven Reactive Classes

Zod schemas paired with Svelte 5 runes classes — the schema defines the JSON
shape, the class adds reactivity and behavior. See ./zod-schemas.md.

### Simple Pattern (fuz_ui)

```typescript
// theme_state.svelte.ts
export class ThemeState {
	theme: Theme = $state()!;
	color_scheme: ColorScheme = $state()!;

	constructor(options?: ThemeStateOptions) {
		this.theme = options?.theme ?? default_themes[0]!;
		this.color_scheme = options?.color_scheme ?? 'auto';
	}

	toJSON(): ThemeStateJson {
		return {
			theme: this.theme,
			color_scheme: this.color_scheme,
		};
	}
}
```

### Cell Pattern (zzz)

Advanced version with `Cell` base class that automates JSON hydration from
Zod schemas:

```typescript
// Schema with CellJson base, .meta for class registration
export const ChatJson = CellJson.extend({
	name: z.string().default(''),
	thread_ids: z.array(Uuid).default(() => []),
}).meta({cell_class_name: 'Chat'});

export class Chat extends Cell<typeof ChatJson> {
	// Schema fields use $state()! - set by Cell.init()
	name: string = $state()!;
	thread_ids: Array<Uuid> = $state()!;

	// Computed values use $derived or $derived.by()
	readonly threads: Array<Thread> = $derived.by(() => {
		const result: Array<Thread> = [];
		for (const id of this.thread_ids) {
			const thread = this.app.threads.items.by_id.get(id);
			if (thread) result.push(thread);
		}
		return result;
	});

	constructor(options: ChatOptions) {
		super(ChatJson, options);
		this.init(); // Must call at end of constructor
	}
}
```

**Key patterns:**

- Zod schema defines the JSON shape (see ./zod-schemas.md)
- Class properties use `$state()!` for reactivity (non-null assertion)
- `$derived` / `$derived.by()` for computed values in classes
- `$state.raw()` for properties replaced wholesale
- `toJSON()` or `to_json()` for serialization (zzz Cell uses a `$derived` `json`
  property)

## Context Patterns

### Creating Context

`create_context<T>()` from `@fuzdev/fuz_ui/context_helpers.js`. Two overloads:
without fallback, `get()` throws if unset and `get_maybe()` returns `undefined`;
with fallback, `get()` uses it and `set()` value is optional:

```typescript
// Without fallback -- get() throws if unset, get_maybe() returns undefined
export function create_context<T>(): {
	get: (error_message?: string) => T;
	get_maybe: () => T | undefined;
	set: (value: T) => T;
};

// With fallback -- get() uses fallback if unset, set() value is optional
export function create_context<T>(fallback: () => T): {
	get: () => T;
	set: (value?: T) => T;
};
```

### Using Context

```typescript
// Define the context (typically in a shared module)
export const frontend_context = create_context<Frontend>();
export const section_depth_context = create_context(() => 0);
```

```svelte
<!-- Provider component sets the context -->
<script>
  import type {Snippet} from 'svelte';
  import {frontend_context} from './frontend.svelte.js';

  const {app, children}: {app: Frontend; children: Snippet} = $props();
  frontend_context.set(app);
</script>

{@render children()}
```

```svelte
<!-- Consumer components get the context -->
<script>
  import {frontend_context} from './frontend.svelte.js';
  const app = frontend_context.get();
</script>
```

### Getter Function Context Pattern

Some contexts wrap values in `() => T` so the reference stays stable while the
underlying value can change:

```typescript
// Type is () => ThemeState, not ThemeState
export const theme_state_context = create_context<() => ThemeState>();

// Setting with a getter
theme_state_context.set(() => theme_state);

// Consuming - call the getter
const get_theme_state = theme_state_context.get();
const theme_state = get_theme_state();
```

Used when the context value might be reassigned (e.g., `theme_state` is a
prop). Direct value contexts like `frontend_context` and `library_context` are
for values stable for the context's lifetime.

### Common Contexts

**fuz_ui contexts:**

| Context                      | Type                       | Source file                      | Purpose                       |
| ---------------------------- | -------------------------- | -------------------------------- | ----------------------------- |
| `theme_state_context`        | `() => ThemeState`         | `theme_state.svelte.ts`          | Theme state (getter pattern)  |
| `library_context`            | `Library`                  | `library.svelte.ts`              | Package API metadata for docs |
| `tomes_context`              | `() => Map<string, Tome>`  | `tome.ts`                        | Available documentation tomes |
| `tome_context`               | `() => Tome`               | `tome.ts`                        | Current documentation page    |
| `docs_links_context`         | `DocsLinks`                | `docs_helpers.svelte.ts`         | Documentation navigation      |
| `section_depth_context`      | `number`                   | `TomeSection.svelte`             | Heading depth (fallback: 0)   |
| `contextmenu_context`        | `() => ContextmenuState`   | `contextmenu_state.svelte.ts`    | Context menu state (getter)   |
| `contextmenu_dimensions_context` | `Dimensions`           | `contextmenu_state.svelte.ts`    | Context menu positioning      |
| `selected_variable_context`  | `SelectedStyleVariable`    | `style_variable_helpers.svelte.ts` | Style variable selection    |
| `mdz_components_context`     | `MdzComponents`            | `mdz_components.ts`              | Custom mdz components         |
| `mdz_base_context`           | `() => string \| undefined` | `mdz_components.ts`             | Base path for mdz links       |

**zzz contexts:**

| Context              | Type       | Source file          | Purpose           |
| -------------------- | ---------- | -------------------- | ----------------- |
| `frontend_context`   | `Frontend` | `frontend.svelte.ts` | Application state |

## Snippet Patterns

Svelte 5 replaces slots with snippets (`{#snippet}` and `{@render}`).

### The `children` Snippet

Implicit `children` replaces the default slot. Typed as `Snippet` (or
`Snippet<[params]>` with parameters):

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {children}: {children: Snippet} = $props();
</script>

<div class="wrapper">
	{@render children()}
</div>
```

Content between component tags becomes `children`:

```svelte
<Wrapper>
	<p>This becomes the children snippet.</p>
</Wrapper>
```

### Children with Parameters

`ThemeRoot` and `Dialog` pass data back to consumers via parameterized children:

```svelte
<!-- ThemeRoot.svelte passes theme_state, style, and html to children -->
<script lang="ts">
	const {children}: {
		children: Snippet<[theme_state: ThemeState, style: string | null, theme_style_html: string | null]>;
	} = $props();
</script>

{@render children(theme_state, style, theme_style_html)}
```

```svelte
<!-- Dialog.svelte passes a close function -->
<script lang="ts">
	const {children}: {
		children: Snippet<[close: (e?: Event) => void]>;
	} = $props();
</script>

{@render children(close)}
```

### Named Snippets

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {
		summary,
		children,
	}: {
		summary: string | Snippet;
		children: Snippet;
	} = $props();
</script>

<details>
	<summary>
		{#if typeof summary === 'string'}
			{summary}
		{:else}
			{@render summary()}
		{/if}
	</summary>
	{@render children()}
</details>
```

### Snippets with Parameters

```svelte
<!-- List.svelte -->
<script lang="ts" generics="T">
	import type {Snippet} from 'svelte';

	const {
		items,
		item,
		empty,
	}: {
		items: T[];
		item: Snippet<[T]>;
		empty?: Snippet;
	} = $props();
</script>

{#if items.length === 0}
	{#if empty}
		{@render empty()}
	{/if}
{:else}
	{#each items as entry}
		{@render item(entry)}
	{/each}
{/if}
```

### Default Snippet Content

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {menu}: {menu?: Snippet} = $props();
</script>

{#if menu}
	{@render menu()}
{:else}
	<!-- Default content when no snippet provided -->
	<button>Default Menu</button>
{/if}
```

### Icon as String or Snippet

`Card` and `Alert` accept icons as string (emoji) or Snippet:

```typescript
const {icon}: {icon?: string | Snippet} = $props();
```

```svelte
{#if typeof final_icon === 'string'}
	{final_icon}
{:else}
	{@render final_icon()}
{/if}
```

## Effect Patterns

### Basic Effects

```typescript
$effect(() => {
	// Runs when any tracked dependency changes
	console.log('Count is now:', count);
});
```

### Effect Cleanup

Return a cleanup function for subscriptions, timers, or listeners:

```typescript
$effect(() => {
	const interval = setInterval(() => {
		tick_count++;
	}, 1000);

	// Cleanup runs before next effect and on destroy
	return () => clearInterval(interval);
});

$effect(() => {
	const handler = (e: KeyboardEvent) => {
		if (e.key === 'Escape') close();
	};
	window.addEventListener('keydown', handler);
	return () => window.removeEventListener('keydown', handler);
});
```

### `$effect.pre()`

Runs before DOM updates. Used in fuz_ui for dev-mode validation and in zzz
for scroll position management:

```typescript
// Dev-mode validation (GithubLink.svelte)
if (DEV) {
	$effect.pre(() => {
		if (!path && !href_prop) {
			throw new Error('GithubLink requires either `path` or `href` prop');
		}
	});
}
```

### `effect_with_count()`

From `@fuzdev/fuz_ui/rune_helpers.svelte.js` — passes call count to the
effect, useful for skipping the initial run:

```typescript
import {effect_with_count} from '@fuzdev/fuz_ui/rune_helpers.svelte.js';

// Skip the first run (count === 1), save on subsequent changes
effect_with_count((count) => {
	const v = theme_state.color_scheme;
	if (count === 1) return; // skip initial
	save_color_scheme(v);
});
```

### `untrack()`

Read values without creating dependencies:

```typescript
import {untrack} from 'svelte';

$effect(() => {
	// count is tracked
	console.log('Count changed to:', count);

	// other_value is NOT tracked - reading it won't re-run the effect
	const snapshot = untrack(() => other_value);
	save_snapshot(count, snapshot);
});
```

**Use cases:**

- Reading configuration that shouldn't trigger re-runs
- Accessing stable references (event handlers, callbacks)
- Breaking infinite loops in bidirectional syncing

## Attachment Patterns

Svelte 5 attachments (`{@attach}`) replace actions (`use:`). In fuz_ui,
attachments live in `*.svelte.ts` files and use `Attachment` from
`svelte/attachments`.

### Attachment API

An attachment is `(element) => cleanup | void`. fuz_ui uses a **factory
pattern** — the export accepts configuration and returns the `Attachment`:

```typescript
import type {Attachment} from 'svelte/attachments';

export const my_attachment =
	(options?: MyOptions): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		// setup
		return () => {
			// cleanup (optional)
		};
	};
```

Usage: `{@attach my_attachment()}` or `{@attach my_attachment({...options})}`

### fuz_ui Attachments

#### `autofocus` -- Focus on Mount

Solves the HTML `autofocus` attribute not working when elements mount from
reactive conditionals (`{#if}`) in SPAs.

```typescript
// autofocus.svelte.ts
import type {Attachment} from 'svelte/attachments';

export const autofocus =
	(options?: FocusOptions): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		el.focus({focusVisible: true, ...options} as FocusOptions);
	};
```

```svelte
<script>
	import {autofocus} from '@fuzdev/fuz_ui/autofocus.svelte.js';
</script>

<!-- Basic usage -->
<input {@attach autofocus()} />

<!-- With options -->
<input {@attach autofocus({preventScroll: true})} />
```

#### `intersect` -- IntersectionObserver

Wraps IntersectionObserver with a **lazy function pattern** for reactive
callbacks that update without recreating the observer.

```typescript
// intersect.svelte.ts
export const intersect =
	(
		get_params: () => IntersectParamsOrCallback | null | undefined,
	): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		// Persistent state across callback changes
		let observer: IntersectionObserver | null = null;

		$effect(() => {
			const params = get_params();
			// Parse params, create/update observer reactively
			// Only recreates observer when options change (deep equality check)
		});

		return disconnect;
	};
```

```svelte
<script>
	import {intersect} from '@fuzdev/fuz_ui/intersect.svelte.js';
</script>

<!-- Simple callback -->
<div {@attach intersect(() => ({intersecting}) => { ... })}>

<!-- Full params with options -->
<div {@attach intersect(() => ({
	onintersect: ({intersecting, el}) => {
		el.classList.toggle('visible', intersecting);
	},
	count: 1,
	options: {threshold: 0.5},
}))}>
```

#### `contextmenu_attachment` -- Context Menu Data

Caches context menu params on an element via dataset for later retrieval.
Direct params, no lazy function. Returns cleanup that removes the cache entry.

```typescript
// contextmenu_state.svelte.ts (exported alongside Contextmenu state class)
export const contextmenu_attachment =
	<T extends ContextmenuParams, U extends T | Array<T>>(
		params: U | null | undefined,
	): Attachment<HTMLElement | SVGElement> =>
	(el): undefined | (() => void) => {
		if (params == null) return;
		// cache params in dataset, return cleanup
	};
```

### Class Method Attachments (zzz)

Attachments as methods on a state class, sharing reactive state with the
instance:

```typescript
// scrollable.svelte.ts
export class Scrollable {
	scroll_y: number = $state(0);
	readonly scrolled: boolean = $derived(this.scroll_y > this.threshold);

	// Attachment as a class property - listens to scroll events
	container: Attachment = (element) => {
		const cleanup = on(element, 'scroll', () => {
			this.scroll_y = element.scrollTop;
		});
		return () => cleanup();
	};

	// Attachment reads reactive state - reruns when `this.scrolled` changes
	// because attachments run in an effect context
	target: Attachment = (element) => {
		if (this.scrolled) {
			element.classList.add(this.target_class);
		} else {
			element.classList.remove(this.target_class);
		}
		return () => element.classList.remove(this.target_class);
	};
}
```

```svelte
<div {@attach scrollable.container} {@attach scrollable.target}>
```

### Choosing a Pattern

| Pattern                       | When to use                               | Example         |
| ----------------------------- | ----------------------------------------- | --------------- |
| **Simple factory**            | Fire-once, no ongoing observation         | `autofocus`     |
| **Lazy function** (`() => p`) | Reactive callbacks without observer churn | `intersect`     |
| **Direct params**             | Static config cached for later retrieval  | `contextmenu`   |
| **Class method**              | Attachment shares state with a class      | `Scrollable`    |

### Writing a New Attachment

1. Create `src/lib/my_attachment.svelte.ts`
2. Import `Attachment` type from `svelte/attachments`
3. Export a factory function returning `Attachment<HTMLElement | SVGElement>`
4. Return cleanup if holding resources (observers, listeners)
5. Use `$effect` inside for reactive behavior
6. Use `on()` from `svelte/events` for programmatic event listeners
7. Add JSDoc with `@module` and `@param` tags

## Props Patterns

### Basic Props

```svelte
<script lang="ts">
	const {
		name,
		count = 0,
		items = [],
	}: {
		name: string;
		count?: number;
		items?: string[];
	} = $props();
</script>
```

### Bindable Props

Use `let` (not `const`) for `$bindable()` props:

```svelte
<script lang="ts">
	let {
		value = $bindable(180),
		children,
	}: {
		value?: number;
		children?: Snippet;
	} = $props();
</script>

<!-- Usage -->
<HueInput bind:value={hue} />
```

Real examples from fuz_ui:

```typescript
// HueInput.svelte
let {value = $bindable(180), children, ...rest} = $props();

// Details.svelte
let {open = $bindable(), ...rest} = $props();

// DocsSearch.svelte
let {search_query = $bindable(), ...rest} = $props();
```

### Rest Props with SvelteHTMLElements

Use `SvelteHTMLElements` from `svelte/elements` intersected with custom props:

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';
	import type {SvelteHTMLElements} from 'svelte/elements';

	const {
		align = 'left',
		icon,
		children,
		...rest
	}: SvelteHTMLElements['div'] & SvelteHTMLElements['a'] & {
		align?: 'left' | 'right' | 'above' | 'below';
		icon?: string | Snippet;
		children: Snippet;
	} = $props();
</script>

<div {...rest} class="card {rest.class}">
	{@render children()}
</div>
```

Use `SvelteHTMLElements['div']` (not `HTMLAttributes<HTMLDivElement>`).
`rest.class` preserves user-provided classes alongside component classes.

## Event Handling

Svelte 5 uses standard DOM event syntax:

```svelte
<button onclick={handle_click}>Click</button>
<input oninput={(e) => value = e.currentTarget.value} />

<!-- Conditional event handlers (pass undefined to remove) -->
<svelte:window onkeydown={active ? on_window_keydown : undefined} />
```

### Programmatic Event Listeners

`on()` from `svelte/events` for programmatic listeners (attachments,
`.svelte.ts` files). Returns cleanup:

```typescript
import {on} from 'svelte/events';

// Inside an attachment
const cleanup = on(element, 'scroll', onscroll);
return () => cleanup();
```

## Component Composition

### Module Script Block

`<script lang="ts" module>` for component-level exports (contexts, types):

```svelte
<script lang="ts" module>
	import {create_context} from './context_helpers.js';

	export const section_depth_context = create_context(() => 0);
	export type RegisterSectionHeader = (get_fragment: () => string) => string | undefined;
</script>

<script lang="ts">
	// instance script
</script>
```

### Forwarding Snippets

```svelte
<!-- Wrapper.svelte -->
<script lang="ts">
	import type {Snippet} from 'svelte';
	import Inner from './Inner.svelte';

	const {
		header,
		children,
	}: {
		header?: Snippet;
		children?: Snippet;
	} = $props();
</script>

<div class="wrapper">
	<Inner {header}>
		{#if children}
			{@render children()}
		{/if}
	</Inner>
</div>
```

### Generic Components

```svelte
<script lang="ts" generics="T">
	import type {Snippet} from 'svelte';

	const {
		items,
		render,
	}: {
		items: T[];
		render: Snippet<[T, number]>;
	} = $props();
</script>

{#each items as item, index}
	{@render render(item, index)}
{/each}
```

### Dynamic Elements

`svelte:element` for components rendering different HTML tags:

```svelte
<script lang="ts">
	const {tag, href, children, ...rest} = $props();

	const link = $derived(!!href);
	const final_tag = $derived(tag ?? (link ? 'a' : 'div'));
</script>

<svelte:element this={final_tag} {...rest} {href}>
	{@render children()}
</svelte:element>
```

### Transitions

```svelte
<script>
	import {slide} from 'svelte/transition';
</script>

{#if open}
	<div transition:slide>{@render children()}</div>
{/if}
```

## Runes in .svelte.ts Files

`.svelte.ts` files use runes (`$state`, `$derived`, `$effect`) outside
components.

### Factory Functions with Getter/Setter Proxies

```typescript
// api_search.svelte.ts
export const create_api_search = (library: Library): ApiSearchState => {
	let query = $state('');
	const all_modules = $derived(library.modules_sorted);
	const filtered_modules = $derived.by(() => {
		if (!query.trim()) return all_modules;
		const terms = query.trim().toLowerCase().split(/\s+/);
		return all_modules.filter((m) => {
			const path_lower = m.path.toLowerCase();
			return terms.every((term) => path_lower.includes(term));
		});
	});

	return {
		get query() { return query; },
		set query(v: string) { query = v; },
		modules: {
			get all() { return all_modules; },
			get filtered() { return filtered_modules; },
		},
	};
};
```

### Reactive State Classes

The most common pattern for shared state:

```typescript
// dimensions.svelte.ts
export class Dimensions {
	width: number = $state(0);
	height: number = $state(0);
}
```

### Effect Helpers

```typescript
// rune_helpers.svelte.ts
export const effect_with_count = (fn: (count: number) => void, initial = 0): void => {
	let count = initial;
	$effect(() => {
		fn(++count);
	});
};
```

## Quick Reference

| Pattern              | Use Case                                      |
| -------------------- | --------------------------------------------- |
| `$state()`           | Mutable UI state, form data, class properties |
| `$state()!`          | Class properties initialized by constructor   |
| `$state.raw()`       | API responses, ReadonlyArrays, immutable data |
| `$derived`           | Simple computed values, class properties       |
| `$derived.by()`      | Complex logic, loops, conditionals             |
| `$effect`            | Side effects, subscriptions                    |
| `$effect.pre()`      | Before DOM update, dev-mode validation         |
| `effect_with_count`  | Skip initial effect run                        |
| `untrack()`          | Read without tracking                          |
| `$props()`           | Component inputs (`const` or `let`)            |
| `$bindable()`        | Two-way binding props (requires `let`)         |
| `{#snippet}`         | Named content areas                            |
| `{@render}`          | Render snippets                                |
| `{@attach}`          | DOM element behaviors (replaces `use:`)        |
| `create_context`     | Typed Svelte context                           |
| `SvelteMap/Set`      | Reactive Map/Set collections                   |
| `on()` (events)      | Programmatic event listeners                   |
