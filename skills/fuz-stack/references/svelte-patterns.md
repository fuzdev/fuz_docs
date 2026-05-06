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
- [Debugging](#debugging)
- [Each Blocks](#each-blocks)
- [CSS in Components](#css-in-components)
- [Legacy Features to Avoid](#legacy-features-to-avoid)
- [Quick Reference](#quick-reference)

## State Runes

Only use `$state` for variables that should be _reactive_ — variables that
cause an `$effect`, `$derived`, or template expression to update. Everything
else can be a normal variable.

### `$state.raw()` vs `$state()` — opt into mutation reactivity, raw otherwise

**Principle: be explicit about when you're opting into mutation reactivity.**
For primitives the two are equivalent (one extra `typeof` check on set). For
objects and arrays, `$state()` proxies the value so in-place mutations trigger
updates; `$state.raw()` stores the value directly and only tracks reassignment.

**Use `$state()`** when you want in-place mutation to trigger reactivity:

- Arrays you `push`, `splice`, `pop`, `sort`, or index-assign
- Objects with individual property mutations
- `bind:value={obj.field}` — binding writes to a property on the object, which
  needs deep proxy reactivity (binding to a primitive `let` works either way,
  since the binding reassigns the variable)

**Use `$state.raw()`** for everything else — primitives, values replaced
wholesale (filter/spread/reassignment), API responses, data passed to APIs
that compare object identity, anything where property-level reactivity isn't
wanted.

This is a fuz-stack stylistic preference, not a technical requirement, and
diverges from Svelte's official guidance — which defaults to `$state()` and
treats `$state.raw` as a perf opt-out for large values that are only ever
reassigned (API responses and similar). The benefit here is explicit intent —
reading a state class tells you which fields are designed to mutate in place.
The cost is friction with idiomatic-Svelte reviewers and AI assistants that
default to `$state()`.

`structuredClone`, `JSON.stringify`, and `postMessage` all walk through
`$state()` proxies cleanly — proxy traps return the target's own keys.
`JSON.stringify` also calls `toJSON()` through the proxy.

```typescript
// $state.raw() — values replaced wholesale or never reassigned
let name = $state.raw(''); // primitive
let api_response = $state.raw<ApiResponse | null>(null); // replaced wholesale
let selections: ReadonlyArray<Item> = $state.raw([]); // array replaced wholesale

// $state() — opt-in for in-place mutation
let items = $state<string[]>([]);
items.push('new'); // triggers reactivity
let form_data = $state({name: '', email: ''});
form_data.name = 'Alice'; // triggers reactivity via proxy

// const objects with property writes need $state()
const config = $state({iterations: 5, warmup: 2});
// bind:value={config.iterations} writes a property; $state.raw() here silently
// breaks (const can't be reassigned, raw doesn't track property writes)
```

**Watch for `const` objects:** A `const` object declared with `$state.raw()` has
no way to trigger reactivity — it can't be reassigned and property mutations
aren't tracked. If the object's properties are mutated (directly or via
`bind:`), use `$state()`.

**Check consumer files, not just the declaring file.** A class field may be
mutated in place by external code that accesses it — e.g., a component importing
a state class and calling `thing.items.splice(i, 1)`. Grep the entire `src/`
directory for mutation patterns on the field name before deciding.

### The `$state.raw()!` Non-null Assertion Pattern

Class properties initialized by constructor or `init()` use `$state.raw()!`:

```typescript
export class ThemeState {
	theme: Theme = $state.raw()!;
	color_scheme: ColorScheme = $state.raw()!;

	constructor(options?: ThemeStateOptions) {
		this.theme = options?.theme ?? default_themes[0]!;
		this.color_scheme = options?.color_scheme ?? 'auto';
	}
}
```

Used across fuz_ui state classes and zzz Cell subclasses. Use `$state()!` only
for arrays/objects that are mutated in place (see above).

### `$state.snapshot()`

Deep-cloned plain copy of a reactive value. Per Svelte's source: recurses
into plain objects and arrays; for class instances with `toJSON()`, calls
it and clones the result; otherwise falls through to `structuredClone`
(which strips class prototypes).

```typescript
// cell.svelte.ts - encode_property uses snapshot for serialization
encode_property(value: unknown, _key: string): unknown {
	return $state.snapshot(value);
}
```

Use it when handing a `$state()` proxy structure to code that does
reference-identity checks on members and would otherwise see proxy
identities. `$state.raw()` values holding plain data don't need it at all.
For serialization, `JSON.stringify` and `structuredClone` walk through
proxies on their own.

**Observed quirk** (Svelte 5.55 + vite-plugin-svelte): `const r = $state.snapshot(x)` is
silently elided to `const r = x` somewhere in the toolchain (Svelte's
`compileModule` output is correct, so it's a downstream pass).
`return $state.snapshot(x)` and inline expression use work correctly.
zzz Cell's `encode_property` is the direct-return form, so `to_json()` is
unaffected. If you write `const r = $state.snapshot(x)` and the snapshot
semantics seem missing, this is the cause.

## Derived Values

Use `$derived` to compute from state — never `$effect` with assignment.
Deriveds are writable (assign to override, but the expression re-evaluates on
dependency change). Derived objects/arrays are not made deeply reactive.

### `$derived` vs `$derived.by()`

`$derived` takes an expression (not a function). `$derived.by()` for loops,
conditionals, or multi-step logic.

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

Class properties use `readonly $derived` and `readonly $derived.by()`. Always
mark `$derived` class properties as `readonly` unless you explicitly need
reassignment (which Svelte 5 does allow):

```typescript
// From Library class (fuz_ui/library.svelte.ts)
export class Library {
	readonly library_json: LibraryJson = $state.raw()!;

	readonly package_json = $derived(this.library_json.package_json);
	readonly source_json = $derived(this.library_json.source_json);
	readonly name = $derived(this.library_json.name);
	readonly repo_url = $derived(this.library_json.repo_url);
	readonly modules = $derived(
		this.source_json.modules
			? this.source_json.modules.map((module_json) => new Module(this, module_json))
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
readonly can_collapse = $derived(this.selections.length > 1);

readonly can_expand = $derived.by(() => {
	const selected = this.selections.at(-1);
	return !!selected?.is_menu && selected.items.length > 0;
});
```

### Derived from Props

Treat props as though they will change — use `$derived` for values that depend
on props:

```typescript
let {type} = $props();

// Do this — updates when type changes
let color = $derived(type === 'danger' ? 'red' : 'green');

// Don't do this — color won't update if type changes
// let color = type === 'danger' ? 'red' : 'green';
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

	// $derived.by works with SvelteMap - recomputes when links change
	readonly docs_links = $derived.by(() => {
		const children_map: Map<string | undefined, Array<DocsLinkInfo>> = new Map();
		for (const link of this.links.values()) {
			// ... build tree from SvelteMap entries
		}
		return result;
	});
}
```

Standard `Map`/`Set` are not tracked by Svelte's reactivity.

For entity streams where the same data is consumed by different
lookups, maintain **multiple `SvelteMap` indexes** over it — rebuild
on snapshot events, update incrementally on delta events. Deriveds
then use `.get()` lookups instead of array scans.

## Schema-Driven Reactive Classes

Zod schemas paired with Svelte 5 runes classes — the schema defines the JSON
shape, the class adds reactivity and behavior. See ./zod-schemas.md.

### Simple Pattern (fuz_ui)

```typescript
// theme_state.svelte.ts
export class ThemeState {
	theme: Theme = $state.raw()!;
	color_scheme: ColorScheme = $state.raw()!;

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

Advanced version with a `Cell` base class that automates JSON hydration from
Zod schemas. Same rune conventions (`$state.raw()!` by default, `$state()!`
for in-place mutations, `readonly $derived` for computed values). See
./zod-schemas.md for the full schema/class pattern.

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

Some contexts wrap values in `() => T` so the context reference stays stable
while the value can change:

```typescript
// Type is () => ThemeState, not ThemeState
export const theme_state_context = create_context<() => ThemeState>();

// Setting with a getter
theme_state_context.set(() => theme_state);

// Consuming - call the getter
const get_theme_state = theme_state_context.get();
const theme_state = get_theme_state();
```

Used when the context value might be reassigned (e.g., `theme_state` is a prop).
Direct value contexts like `frontend_context` and `library_context` are for
values stable for the context's lifetime.

For an inventory of contexts in fuz_ui and zzz, grep for `create_context<` in
the source.

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

Children can be parameterized — `Dialog` passes a close function back to the consumer:

```svelte
<!-- Dialog.svelte -->
<script lang="ts">
	const {children}: {
		children: Snippet<[close: (e?: Event) => void]>;
	} = $props();
</script>

{@render children(close)}
```

`ThemeRoot` uses the same pattern with multiple values:
`Snippet<[theme_state: ThemeState, style: string | null, theme_style_html: string | null]>`.

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

### Default Snippet Content and String/Snippet Unions

For optional snippets, fall back with `{#if snippet} {@render snippet()} {:else} ... {/if}`.
For props that accept either a string or a snippet (e.g. `icon?: string | Snippet`),
branch on `typeof` at render. fuz_ui's `Card` and `Alert` use this; `Alert` further
parameterizes with `Snippet<[icon: string]>` to pass the resolved icon back.

## Effect Patterns

Effects are an escape hatch — avoid when possible. Prefer:

- `$derived` / `$derived.by()` for computing from state
- `{@attach}` for syncing with external libraries or DOM
- Event handlers / function bindings for responding to user interaction
- `$inspect` / `$inspect.trace()` for debugging (not `$effect` + `console.log`)
- `createSubscriber` from `svelte/reactivity` for observing external sources

Don't wrap effect contents in `if (browser) {...}` — effects don't run on the
server. Avoid updating `$state` inside effects.

### Basic Effects

```typescript
$effect(() => {
	// Runs when any tracked dependency changes
	console.log('Count is now:', count);
});
```

### Effect Cleanup

Return a cleanup function for subscriptions or timers:

```typescript
$effect(() => {
	const interval = setInterval(() => {
		tick_count++;
	}, 1000);

	// Cleanup runs before next effect and on destroy
	return () => clearInterval(interval);
});
```

For window/document listeners, prefer `<svelte:window onkeydown={...}>` and
`<svelte:document>` over `$effect` + `addEventListener`. For element-scoped
listeners, prefer `{@attach}` (with `on()` from `svelte/events` inside).

### `$effect.pre()`

Runs before DOM updates. Used for dev-mode validation and scroll management:

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

**Use cases:** reading config that shouldn't trigger re-runs, accessing
stable references, breaking infinite loops in bidirectional syncing.

## Attachment Patterns

Svelte 5 attachments (`{@attach}`) replace actions (`use:`). Attachments live
in `*.svelte.ts` files and use `Attachment` from `svelte/attachments`.

### Attachment API

An attachment is `(element) => cleanup | void`. fuz_ui uses a **factory
pattern** — export a function that accepts configuration and returns the
`Attachment`:

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

Wraps IntersectionObserver with a **lazy function pattern** — reactive
callbacks update without recreating the observer.

```typescript
// intersect.svelte.ts — signature only, see source for implementation
export const intersect =
	(
		get_params: () => IntersectParamsOrCallback | null | undefined,
	): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		// Uses $effect internally: callbacks update reactively,
		// observer only recreates when options change (deep equality check)
	};
```

```svelte
<script>
	import {intersect} from '@fuzdev/fuz_ui/intersect.svelte.js';
</script>

<!-- Simple callback (receives IntersectState: intersecting, intersections, el, observer, disconnect) -->
<div {@attach intersect(() => ({intersecting}) => { ... })}>

<!-- Full params with options -->
<div {@attach intersect(() => ({
	onintersect: ({intersecting, el}) => {
		el.classList.toggle('visible', intersecting);
	},
	ondisconnect: ({intersecting, intersections}) => { ... },
	count: 1,
	options: {threshold: 0.5},
}))}>
```

#### `contextmenu_attachment` -- Context Menu Data

Caches context menu params on an element via dataset. Direct params (no lazy
function). Returns cleanup that removes the cache entry.

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

Attachments as class properties, sharing reactive state with the instance:

```typescript
// scrollable.svelte.ts (simplified — see source for flex-direction handling)
export class Scrollable {
	scroll_y: number = $state(0);
	readonly scrolled: boolean = $derived(this.scroll_y > this.threshold);

	// Listens to scroll events, updates class state
	container: Attachment = (element) => {
		const cleanup = on(element, 'scroll', () => {
			this.scroll_y = element.scrollTop;
		});
		return () => cleanup();
	};

	// Attachments run in an effect context — reruns when `this.scrolled` changes
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
2. Export a factory function returning `Attachment<HTMLElement | SVGElement>`
3. Return cleanup if holding resources (observers, listeners)
4. Use `$effect` inside for reactive behavior, `on()` for event listeners
5. Add JSDoc with `@module` and `@param` tags

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

## Event Handling

Svelte 5 uses standard DOM event syntax:

```svelte
<button onclick={handle_click}>Click</button>
<input oninput={(e) => value = e.currentTarget.value} />

<!-- Conditional event handlers (pass undefined to remove) -->
<svelte:window onkeydown={active ? on_window_keydown : undefined} />
```

### Programmatic Event Listeners

`on()` from `svelte/events` for programmatic listeners in attachments,
`.svelte.ts` files, and plain `.ts` modules. Preserves correct ordering
relative to declarative handlers that use event delegation. Always prefer
`on()` over `addEventListener` — even in non-component code. Returns a
cleanup function:

```typescript
import {on} from 'svelte/events';

// Inside an attachment or module
const cleanup = on(element, 'scroll', onscroll);
return () => cleanup();

// With options (e.g., passive: false for wheel events)
const cleanup = on(element, 'wheel', onwheel, {passive: false});
```

### `swallow` — Claiming Events

`swallow()` from `@fuzdev/fuz_util/dom.js` combines `preventDefault()` and
`stopImmediatePropagation()` (or `stopPropagation()` with `immediate: false`).

**Design principle: handling an event = claiming it.** If you call
`preventDefault`, you're already saying "I own this event's default behavior."
Use `swallow` to extend that to "and no one else should react to it either."
If a parent needs to observe events before children claim them, use the
`capture` phase explicitly — don't rely on implicit bubbling.

```typescript
import {swallow} from '@fuzdev/fuz_util/dom.js';

// swallow(event, immediate?, preventDefault?)
swallow(e);                  // preventDefault + stopImmediatePropagation (default)
swallow(e, false);           // preventDefault + stopPropagation (non-immediate)
swallow(e, true, false);     // stopImmediatePropagation only (no preventDefault)
```

Use `swallow` whenever you would call `preventDefault` — the event is yours,
stop it from propagating too. For handlers that only need `stopPropagation`
without `preventDefault` (e.g., preventing game input from seeing keystrokes
in a chat input), use `e.stopPropagation()` directly.

```svelte
<!-- Claiming an event in a handler -->
<script lang="ts">
  import {swallow} from '@fuzdev/fuz_util/dom.js';

  const on_keydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      swallow(e);
      send();
    } else if (e.key === 'Escape') {
      swallow(e);
      close();
    } else {
      // only stop propagation, don't prevent default (e.g., typing characters)
      e.stopPropagation();
    }
  };
</script>
```

```typescript
// Programmatic listener claiming context menu and wheel events
const cleanup_contextmenu = on(canvas, 'contextmenu', (e) => {
  swallow(e);
});

const cleanup_wheel = on(canvas, 'wheel', (e) => {
  handle_zoom(e);
  swallow(e);
}, {passive: false});
```

## Component Composition

### Module Script Block

`<script lang="ts" module>` for component-level exports (contexts, types):

```svelte
<!-- TomeSection.svelte -->
<script lang="ts" module>
	import {create_context} from './context_helpers.js';

	export type RegisterSectionHeader = (get_fragment: () => string) => string | undefined;
	export const register_section_header_context = create_context<RegisterSectionHeader>();
	export const section_depth_context = create_context(() => 0);
	export const section_id_context = create_context<string | undefined>();
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
components. Prefer **classes** over module-level state — export a class,
instantiate once at the appropriate root, and share it via context.

### Avoid Module-Level Runes for Shared State

Don't declare `$state` variables at module scope and expose them through
getter/setter objects. A module-level rune is a hidden global: it can't be
reset per test, per realm, or per session; it ties the lifetime of the
state to the module rather than to a component; and a second instance is
impossible when you later decide you need one.

```typescript
// Anti-pattern: module-level runes exposed through a singleton
let show_map = $state.raw(false);
let show_sidebar = $state.raw(true);

export const world_ui = {
	get show_map() { return show_map; },
	set show_map(v: boolean) { show_map = v; },
	get show_sidebar() { return show_sidebar; },
	set show_sidebar(v: boolean) { show_sidebar = v; },
};
```

Use a class + context instead — the class owns its state, and a root
component sets it once:

```typescript
// world_ui_state.svelte.ts
import {create_context} from '@fuzdev/fuz_ui/context_helpers.js';

export const world_ui_context = create_context<WorldUiState>();

export class WorldUiState {
	show_map: boolean = $state.raw(false);
	show_sidebar: boolean = $state.raw(true);
}
```

```svelte
<!-- +layout.svelte or similar root component -->
<script>
	import {WorldUiState, world_ui_context} from '$lib/world_ui_state.svelte.js';
	world_ui_context.set(new WorldUiState());
</script>
```

```svelte
<!-- any descendant component -->
<script>
	import {world_ui_context} from '$lib/world_ui_state.svelte.js';
	const world_ui = world_ui_context.get();
</script>
```

**When module-level runes are fine:** inside a factory function body (see
below) — the state is scoped to the returned object, not the module.

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
			const comment_lower = m.module_comment?.toLowerCase() ?? '';
			return terms.every((term) => path_lower.includes(term) || comment_lower.includes(term));
		});
	});

	const all_declarations = $derived(library.declarations);
	const filtered_declarations = $derived.by(() => {
		const items = query.trim() ? library.search_declarations(query) : all_declarations;
		return items.sort((a, b) => a.name.localeCompare(b.name));
	});

	return {
		get query() { return query; },
		set query(v: string) { query = v; },
		modules: {
			get all() { return all_modules; },
			get filtered() { return filtered_modules; },
		},
		declarations: {
			get all() { return all_declarations; },
			get filtered() { return filtered_declarations; },
		},
	};
};
```

### Reactive State Classes

The most common pattern for shared state:

```typescript
// dimensions.svelte.ts
export class Dimensions {
	width: number = $state.raw(0);
	height: number = $state.raw(0);
}
```

### Plain Classes for Imperative Loops

Canvas2D/WebGPU renderers, `requestAnimationFrame` loops, and
long-lived pointer listeners are the inverse case: use a **plain
class with no runes**, mounted by a thin `.svelte` wrapper. Private
fields (e.g. `#hovered_id`, `#cursor_x`) stay non-reactive on purpose
— mutating them from an rAF tick must not schedule reruns. The
wrapper binds dimensions, forwards reactive sources via
getter-backed options, and calls `destroy()` on unmount. Runes live
in the wrapper, never in the loop.

## Debugging

### `$inspect.trace()`

Add as the first line of an `$effect` or `$derived.by` to trace dependencies
and discover which one triggered an update:

```typescript
$effect(() => {
	$inspect.trace('my-effect');
	// ... effect body
});
```

## Each Blocks

Prefer keyed each blocks — Svelte can surgically insert or remove items
rather than updating existing DOM:

```svelte
{#each items as item (item.id)}
	<li>{item.name}</li>
{/each}
```

The key must uniquely identify the object — do not use the array index.
Avoid destructuring if you need to mutate the item (e.g.,
`bind:value={item.count}`).

## CSS in Components

**Goal: minimal `<style>` blocks.** Components should delegate styling to
fuz_css utility classes and design tokens. Many well-designed components
have no `<style>` block at all. See `css-patterns.md` §Component Styling
Philosophy for the full rationale, anti-patterns, and examples.

When a `<style>` block is needed, keep it focused on component-specific
layout logic (positioning, complex pseudo-states, responsive breakpoints).
All values should reference design tokens, not hardcoded pixels or colors.

**Class naming**: fuz_css utilities use `snake_case` (`p_md`, `gap_lg`).
Component-local classes use `kebab-case` (`site-header`, `nav-links`) to
distinguish them visually.

### JS Variables in CSS

Use `style:` directive to pass JS values as CSS custom properties:

```svelte
<div style:--columns={columns}>...</div>

<style>
	div { grid-template-columns: repeat(var(--columns), 1fr); }
</style>
```

### Styling Child Components

Prefer CSS custom properties. Use `:global` only when necessary (e.g.,
third-party components):

```svelte
<!-- Parent passes custom property -->
<Child --color="red" />

<!-- Child uses it -->
<style>
	h1 { color: var(--color); }
</style>
```

```svelte
<!-- :global override (last resort) -->
<div>
	<Child />
</div>

<style>
	div :global {
		h1 { color: red; }
	}
</style>
```

Use clsx-style arrays and objects in `class` attributes instead of `class:`
directive:

```svelte
<!-- Do this -->
<div class={['card', active && 'active', size]}></div>

<!-- Not this -->
<div class="card" class:active class:size></div>
```

## Legacy Features to Avoid

Always use runes mode. Deprecated patterns and their replacements:

| Instead of                         | Use                                           |
| ---------------------------------- | --------------------------------------------- |
| `let count = 0` (implicit)         | `let count = $state(0)`                       |
| `$:` assignments/statements        | `$derived` / `$effect`                        |
| `export let`                       | `$props()`                                    |
| `on:click={...}`                   | `onclick={...}`                               |
| `<slot>`                           | `{#snippet}` / `{@render}`                    |
| `<svelte:component this={C}>`      | `<C />` (dynamic component directly)          |
| `<svelte:self>`                    | `import Self from './Self.svelte'` + `<Self>` |
| `use:action`                       | `{@attach}`                                   |
| `class:active`                     | `class={['base', active && 'active']}`        |
| Stores (`writable`, `readable`)    | Classes with `$state` fields                  |

## Quick Reference

The decision-fraught choices, summarized:

- **`$state.raw()` vs `$state()`** — `$state.raw()` for primitives and values
  replaced wholesale; `$state()` when you want in-place mutation (`push`,
  property writes, `bind:` on object properties) to trigger reactivity.
- **`$derived` vs `$derived.by()`** — `$derived` takes an expression;
  `$derived.by()` takes a function for loops/conditionals/multi-step logic.
  Mark class-level deriveds `readonly`.
- **`{@attach}` vs `$effect`** — attachments for element behavior (replaces
  `use:action`); effects for everything else, but reach for `$derived`,
  `<svelte:window>`, or event handlers first.
- **`create_context<T>()` vs raw `setContext`/`getContext`** — fuz_ui's
  `create_context` provides the throw-on-missing `get()` plus `get_maybe()`,
  with optional fallback factory.
