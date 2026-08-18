---
description: Svelte 5 runes, contexts, snippets, attachments
---

# Svelte 5 Patterns

Svelte 5 runes and patterns used across the Fuz ecosystem — the stack's
deltas over Svelte's own docs, not a runes tutorial. Always runes mode; no
legacy syntax (`$:`, `export let`, `on:click`, slots, stores, `use:` actions).

## State Runes

### `$state.raw()` is the default

`$state.raw()` for reactive state; proxied `$state()` only where in-place
mutation is the point. `raw` stores the value directly and tracks only
reassignment — for primitives the two behave the same, and for objects/arrays
`raw` makes the update contract explicit: replace, don't mutate. This is the
house style across fuz_ui, fuz_app, and zzz (fuz_app's `ui/CLAUDE.md`
documents it; zzz Cell schema fields are `$state.raw()!`), so most fields you
encounter are `raw`.

Reach for proxied `$state()` when mutation drives the updates: `push`,
`splice`, `sort`, index assignment, property writes, and
`bind:value={obj.field}` all need the proxy. An accidental `raw` on such a
value silently breaks reactivity the moment something mutates it in place —
pick by how the value is updated, not by size or taste.

`structuredClone`, `JSON.stringify`, and `postMessage` all walk through
`$state()` proxies cleanly — proxy traps return the target's own keys.
`JSON.stringify` also calls `toJSON()` through the proxy.

```typescript
let name = $state.raw(''); // primitives: raw is the default
let selected_id = $state.raw<string | null>(null); // replaced wholesale: raw
let items = $state<string[]>([]); // proxied on purpose — mutated in place
items.push('new'); // triggers reactivity
let form_data = $state({ name: '', email: '' });
form_data.name = 'Alice'; // property write through the proxy
// bind:value={form_data.name} also needs the proxy
```

### The `$state.raw()!` Non-null Assertion Pattern

Class properties initialized by a constructor or `init()` use `$state.raw()!`:

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

Used across fuz_ui state classes and zzz Cell subclasses.

### `$state.snapshot()`

Deep-cloned plain copy of a reactive value (zzz Cell's `encode_property`
returns `$state.snapshot(value)` for serialization). Use it when handing a
`$state()` proxy structure to code that does reference-identity checks on
members; for serialization it's usually unnecessary — `JSON.stringify` and
`structuredClone` walk proxies on their own.

**Observed quirk** (Svelte 5.56 + vite-plugin-svelte, unfiled):
`const r = $state.snapshot(x)` is silently elided to `const r = x` downstream
of `compileModule`; `return $state.snapshot(x)` and inline expression use
work correctly.

## Derived Values

Use `$derived` to compute from state — never `$effect` with assignment.
Deriveds are writable (assign to override, but the expression re-evaluates on
dependency change). Derived objects/arrays are not deeply reactive.

### `$derived` vs `$derived.by()`

`$derived` takes an expression; `$derived.by()` takes a function for loops,
conditionals, or multi-step logic:

```typescript
let doubled = $derived(count * 2);
let filtered_items = $derived.by(() => {
	if (!filter) return items;
	return items.filter((item) => item.name.includes(filter));
});
```

### `$derived` in Classes

Always mark `$derived` class properties `readonly` unless you explicitly need
reassignment (which Svelte 5 does allow):

**Immutable data-wrapper classes use getters + memoization, not `$derived`.**
fuz_ui's `Library`/`Module`/`Declaration` were rewritten from
`readonly x = $derived(…)` fields to plain getters with `#field ??=` caches:

```typescript
// From Library class (fuz_ui/library.svelte.ts)
export class Library {
	readonly library_json: LibraryJson;
	#repo_url: RepoUrl | undefined;
	get repo_url(): RepoUrl {
		return (this.#repo_url ??= repo_url_parse(this.pkg_json.repository)!);
	}
}
```

The reason is SSR: Svelte's server runtime only memoizes a `$derived` created
during a render, so a `Library` constructed at module scope — the normal shape
for a docs site — rebuilds its whole `Module`/`Declaration` tree on every
property read during prerender. Rule: for an immutable tree constructed at
module scope, plain getters + private-field caches; reactivity moves to the
instance level (swap the `Library`, don't mutate one). `$derived` class fields
are for instances whose dependencies actually change, as below.

```typescript
// From Thread class (zzz/thread.svelte.ts) - return `| undefined`, never throw
// from a $derived that templates read (a throw render-crashes every consumer);
// guard at the callsites instead.
readonly model: Model | undefined = $derived.by(() =>
	this.app.models.find_by_name(this.model_name),
);

// From ContextmenuState - $derived for simple, $derived.by for multi-step
// (this older class predates the readonly convention; new code should add it)
can_collapse = $derived(this.selections.length > 1);

can_expand = $derived.by(() => {
	const selected = this.selections.at(-1);
	return !!selected?.is_menu && selected.items.length > 0;
});
```

**Field-initializer order gotcha (plain classes).** Class field initializers run
_before_ the constructor body, so a `$derived` whose expression reads a field the
constructor assigns (common in plain `.svelte.ts` classes — `app`, `name`, …)
trips TS2729 _"used before initialization"_:

```typescript
export class ProviderCapability {
	readonly app: Frontend;
	readonly name: ProviderName;
	// Don't do this — `this.app`/`this.name` are read in a field initializer,
	// which runs before the constructor body assigns them (TS2729).
	readonly status = $derived(this.app.lookup_provider_status(this.name));
	constructor(o: { app: Frontend; name: ProviderName }) {
		this.app = o.app;
		this.name = o.name;
	}
}
```

Wrap the read in `$derived.by(() => …)`: TS's init-order check doesn't descend
into the closure, and the read is lazy at runtime regardless.

```typescript
// closure defers the read past construction
readonly status = $derived.by(() => this.app.lookup_provider_status(this.name));
```

Cells don't hit this — `app` comes from the base `Cell` constructor (runs before
subclass fields), and schema fields use `$state()!` (counts as initialized in
declaration order). It bites only plain classes that read constructor-assigned
fields in a `$derived`.

## Reactive Collections

### `SvelteMap` and `SvelteSet`

From `svelte/reactivity` — mutation-tracked Map/Set (standard `Map`/`Set`
are not tracked). `$derived.by` over a `SvelteMap` recomputes on mutation —
fuz_ui's `DocsLinks` (`links: SvelteMap`, `fragments_onscreen: SvelteSet`)
is the exemplar.

For entity collections consumed by different lookups, maintain **multiple
`SvelteMap` indexes** over the data — the worked implementation is zzz's
`IndexedCollection` (`indexed_collection.svelte.ts`): `by_id: SvelteMap`
plus `single_index(key)` / `multi_index(key)` secondary indexes, with
`values` derived from `by_id`. Deriveds then do `.get()` lookups instead of
array scans.

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
			color_scheme: this.color_scheme
		};
	}
}
```

### Cell Pattern (zzz)

Advanced version with a `Cell` base class that automates JSON hydration from
Zod schemas. Same rune conventions (`$state.raw()!` for schema fields,
`readonly $derived` for computed values). See ./zod-schemas.md for the full
pattern.

## Context Patterns

### Creating Context

`create_context<T>()` from `@fuzdev/fuz_ui/context_helpers.ts`. Two overloads:
without a fallback, `get()` throws if unset and `get_maybe()` returns `undefined`;
with a fallback, `get()` uses it and the `set()` value is optional:

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
// Define in a shared module; a provider component calls .set(app) at init,
// consumers call .get() at init
export const frontend_context = create_context<Frontend>();
export const section_depth_context = create_context(() => 0);
```

### Getter Function Context Pattern

Some contexts wrap values in `() => T` so the context reference stays stable
while the value can change:

```typescript
// Type is () => ThemeState, not ThemeState
export const theme_state_context = create_context<() => ThemeState>();

// Setting with a getter that closes over reactive state
theme_state_context.set(() => theme_state);

// Consuming: call .get() at init (it uses Svelte's getContext), then read
// the getter lazily so the value stays reactive
const get_theme_state = theme_state_context.get();
const theme_state = $derived(get_theme_state());
```

The getter must be read **lazily** — calling it once at init
(`const theme_state = get_theme_state();` without `$derived`) captures a
snapshot and loses reactivity, defeating the pattern's purpose. Besides the
script-level `$derived` above, two other lazy forms appear in real consumers:

```svelte
<!-- template-inline (MdzNodeView.svelte) — the getter is called inside {@const} -->
{@const link = mdz_classify_link(node.reference, node.link_type, get_mdz_base?.())}
```

```typescript
// prop default, re-evaluated while the prop is undefined (ColorSchemeInput.svelte)
const { value = get_theme_state() } = $props();
```

Used when the context value might be reassigned (e.g., `theme_state` is a
prop). `library_context` is a getter context (`() => Library`) for the same
reason. Components with an optional `library` prop resolve prop-or-ancestor
via `set_library_context_with_fallback(() => library_prop, 'ApiIndex')`
(fuz_ui's `library.svelte.ts`) — it prefers the prop, falls back to the
ancestor context, and throws a component-named error when neither exists;
`LibraryDetail` does a plain `library_context.set(() => library)`. Direct
value contexts like `frontend_context` and `site_context` are for values
stable for the context's lifetime.

For an inventory of contexts in fuz_ui and zzz, grep for `create_context<`.

## Snippet Patterns

### Children with Parameters

Children can be parameterized — `Dialog` passes a `DialogContext` object back to
the consumer (`DialogContext` from `@fuzdev/fuz_ui/dialog.ts` is
`{close: (e?: Event) => void; register_surface: (el) => () => void}`):

```svelte
<!-- Dialog.svelte -->
<script lang="ts">
	const {
		children
	}: {
		children: Snippet<[dialog: DialogContext]>;
	} = $props();
</script>

{@render children(context)}
```

Consumers reach `close` via `dialog.close`; `register_surface` marks
click-outside-safe regions. `ThemeRoot` uses the same parameterized-children
pattern with multiple values:
`Snippet<[theme_state: ThemeState, style: string | null, theme_style_html: string | null]>`.

### Snippets with Parameters

A snippet prop can take parameters (`Snippet<[T]>`), and `generics` on the
`<script>` tag can make them generic over component data. fuz_ui's only real
`generics=` use is `Contextmenu.svelte`'s tag-name generic
(`generics="T extends string = 'span'"`) — the generic-list-renderer shape
(`items: T[]` + `item: Snippet<[T]>`) has no ecosystem precedent yet.

### Default Snippet Content and String/Snippet Unions

For optional snippets, fall back with `{#if snippet} {@render snippet()} {:else} ... {/if}`.
For props accepting a string or a snippet (e.g. `icon?: string | Snippet`),
branch on `typeof` at render. fuz_ui's `Card` and `Alert` use this; `Alert` further
parameterizes with `Snippet<[icon: string]>` to pass the resolved icon back.

## Effect Patterns

Effects are an escape hatch — avoid when possible. Prefer:

- `$derived` / `$derived.by()` for computing from state
- `{@attach}` for syncing with external libraries or DOM
- Event handlers / function bindings for responding to user interaction
- `untrack()` for reads that shouldn't create a dependency (config reads,
  breaking bidirectional-sync loops)

Don't wrap effect contents in `if (browser) {...}` — effects don't run on the
server. Avoid updating `$state` inside effects.

### Effect Cleanup

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

From `@fuzdev/fuz_ui/rune_helpers.svelte.ts` —
`effect_with_count(fn: (count: number) => void, initial = 0)` passes a call
count to the effect, useful for skipping the initial run:

```typescript
import { effect_with_count } from '@fuzdev/fuz_ui/rune_helpers.svelte.ts';

// Skip the first run (count === 1), save on subsequent changes
effect_with_count((count) => {
	const v = theme_state.color_scheme;
	if (count === 1) return; // skip initial
	save_color_scheme(v);
});
```

## Attachment Patterns

Svelte 5 attachments (`{@attach}`) replace actions (`use:`). Attachments live
in `*.svelte.ts` files and use `Attachment` from `svelte/attachments`.

### Attachment API

An attachment is `(element) => cleanup | void`. fuz_ui uses a **factory
pattern** — export a function that accepts config and returns the `Attachment`:

```typescript
import type { Attachment } from 'svelte/attachments';

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

The three factory shapes, one per row of the table below:

- **`autofocus(options?)`** — simple factory, fire-once. Solves the HTML
  `autofocus` attribute not firing when an element mounts from a reactive
  `{#if}` in an SPA. `<input {@attach autofocus()} />`
- **`intersect(get_params)`** — takes a **lazy function**
  (`() => IntersectParamsOrCallback | null | undefined`), not params directly.
  It runs `$effect` internally so reactive callbacks update without recreating
  the IntersectionObserver, which rebuilds only when the options themselves
  change (deep equality). Accepts a bare callback or a full params object
  (`onintersect`, `ondisconnect`, `count`, `options`).
- **`contextmenu_attachment(params)`** — direct params, no lazy function.
  Caches menu params on the element's dataset, returns cleanup that removes the
  entry.

Reach for the lazy form whenever the attachment builds an expensive observer
out of reactive values; direct params are for static config read back later.

### Class Method Attachments (zzz)

An attachment can be a class property sharing reactive state with the instance.
**Attachments run in an effect context**, so one that reads reactive state
reruns when that state changes — which is the whole reason to reach for this
shape:

```typescript
// scrollable.svelte.ts (simplified — see source for flex-direction handling)
export class Scrollable {
	scroll_y: number = $state.raw(0);
	readonly scrolled: boolean = $derived(this.scroll_y > this.threshold);

	container: Attachment = (element) => {
		const onscroll = () => {
			this.scroll_y = element.scrollTop;
		};
		const cleanup = on(element, 'scroll', onscroll);
		onscroll(); // sync the initial value — the event won't fire on mount
		return cleanup;
	};

	// reruns whenever `this.scrolled` flips
	target: Attachment = (element) => {
		element.classList.toggle(this.target_class, this.scrolled);
		return () => element.classList.remove(this.target_class);
	};
}
```

```svelte
<div {@attach scrollable.container} {@attach scrollable.target}>
```

### Choosing a Pattern

| Pattern                       | When to use                               | Example       |
| ----------------------------- | ----------------------------------------- | ------------- |
| **Simple factory**            | Fire-once, no ongoing observation         | `autofocus`   |
| **Lazy function** (`() => p`) | Reactive callbacks without observer churn | `intersect`   |
| **Direct params**             | Static config cached for later retrieval  | `contextmenu` |
| **Class method**              | Attachment shares state with a class      | `Scrollable`  |

## Props Patterns

### Bindable Props

Use `let` (not `const`) for `$bindable()` props:

```svelte
<script lang="ts">
	let {
		value = $bindable(180),
		children
	}: {
		value?: number;
		children?: Snippet;
	} = $props();
</script>

<!-- Usage -->
<HueInput bind:value={hue} />
```

### Rest Props with SvelteHTMLElements

Intersect `SvelteHTMLElements` from `svelte/elements` with custom props:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	const {
		icon,
		children,
		...rest
	}: SvelteHTMLElements['div'] & {
		icon?: string | Snippet;
		children: Snippet;
	} = $props();
</script>

<div {...rest} class="card {rest.class}">
	{@render children()}
</div>
```

Use `SvelteHTMLElements['div']` (not `HTMLAttributes<HTMLDivElement>`) for
single-root components. When the root tag varies by props (`Card` renders
`<a>` or `<div>`), don't intersect both element types onto one bag — type the
shared rest props as the common denominator (`HTMLAttributes<HTMLElement>`)
and take branch-specific attrs as separate props
(`a_attrs?: SvelteHTMLElements['a']`). `Card`, `Alert`, and `Details` all use
this `*_attrs` shape.

## Event Handling

Standard DOM event syntax; conditional handlers pass `undefined` to remove
(`<svelte:window onkeydown={active ? on_window_keydown : undefined} />`).

### Programmatic Event Listeners

`on()` from `svelte/events` for programmatic listeners in attachments,
`.svelte.ts` files, and plain `.ts` modules. It preserves correct ordering
relative to declarative handlers that use event delegation, and returns a
cleanup function. Always prefer `on()` over `addEventListener`, even in
non-component code:

```typescript
import { on } from 'svelte/events';

// Inside an attachment or module
const cleanup = on(element, 'scroll', onscroll);
return () => cleanup();

// With options (e.g., passive: false for wheel events)
const cleanup = on(element, 'wheel', onwheel, { passive: false });
```

### `swallow` — Claiming Events

`swallow()` from `@fuzdev/fuz_util/dom.ts` combines `preventDefault()` and
`stopImmediatePropagation()` (or `stopPropagation()` with `immediate: false`).

**Design principle: handling an event = claiming it.** Calling `preventDefault`
already says "I own this event's default behavior"; `swallow` extends that to
"and no one else should react to it either." Use it whenever you would call
`preventDefault`. If a parent needs to observe events before children claim
them, use the `capture` phase explicitly — don't rely on implicit bubbling.

```typescript
import { swallow } from '@fuzdev/fuz_util/dom.ts';

// swallow(event, immediate?, preventDefault?)
swallow(e); // preventDefault + stopImmediatePropagation (default)
swallow(e, false); // preventDefault + stopPropagation (non-immediate)
swallow(e, true, false); // stopImmediatePropagation only (no preventDefault)
```

For handlers that only need `stopPropagation` without `preventDefault` (e.g.,
preventing game input from seeing keystrokes in a chat input), use
`e.stopPropagation()` directly.

```svelte
<!-- Claiming an event in a handler -->
<script lang="ts">
	import { swallow } from '@fuzdev/fuz_util/dom.ts';

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

## Component Composition

### Module Script Block

Use `<script lang="ts" module>` for component-level exports (contexts, types):

```svelte
<!-- TomeSection.svelte -->
<script lang="ts" module>
	import { create_context } from './context_helpers.ts';

	export type RegisterSectionHeader = (get_fragment: () => string) => string | undefined;
	export const register_section_header_context = create_context<RegisterSectionHeader>();
	export const section_depth_context = create_context(() => 0);
	export const section_id_context = create_context<string | undefined>();
</script>

<script lang="ts">
	// instance script
</script>
```

## Runes in .svelte.ts Files

`.svelte.ts` files use runes (`$state`, `$derived`, `$effect`) outside
components. Prefer **classes** over module-level state — export a class,
instantiate once at the appropriate root, share it via context.

### Avoid Module-Level Runes for Shared State

Don't declare `$state` variables at module scope and expose them through
getter/setter objects. A module-level rune is a hidden global: it can't be
reset per test, per realm, or per session; it ties state lifetime to the
module rather than a component; and a second instance is impossible if you
later need one.

Use a class + context instead — the class owns its state, a root component
sets it once (`world_ui_context.set(new WorldUiState())` in a layout), and
descendants `get()` it:

```typescript
// world_ui_state.svelte.ts
import { create_context } from '@fuzdev/fuz_ui/context_helpers.ts';

export const world_ui_context = create_context<WorldUiState>();

export class WorldUiState {
	show_map: boolean = $state.raw(false);
	show_sidebar: boolean = $state.raw(true);
}
```

**When module-level runes are fine:** inside a factory function body (see
below) — the state is scoped to the returned object, not the module.

### Factory Functions with Getter/Setter Proxies

```typescript
// api_search.svelte.ts (abridged)
export const create_api_search = (library: Library): ApiSearchState => {
	let query = $state.raw('');

	const filtered_declarations = $derived.by(() => {
		const items = query.trim() ? library.search_declarations(query) : library.declarations;
		// spread before sort — `items` may be the shared source array
		return [...items].sort((a, b) => a.name.localeCompare(b.name));
	});

	return {
		get query() {
			return query;
		},
		set query(v: string) {
			query = v;
		},
		declarations: {
			get filtered() {
				return filtered_declarations;
			}
		}
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

Canvas2D/WebGPU renderers, `requestAnimationFrame` loops, and long-lived
pointer listeners are the inverse case: use a **plain class with no runes**,
mounted by a thin `.svelte` wrapper. Private fields (e.g. `#hovered_id`,
`#cursor_x`) stay non-reactive on purpose — mutating them from an rAF tick
must not schedule reruns. The wrapper binds dimensions, forwards reactive
sources via getter-backed options, and calls `destroy()` on unmount. Runes
live in the wrapper, never in the loop.

## CSS in Components

**Goal: minimal `<style>` blocks.** Components delegate styling to fuz_css
utility classes and design tokens; many well-designed components have no
`<style>` block at all. When one is needed, keep it focused on
component-specific layout logic (positioning, complex pseudo-states,
responsive breakpoints), with all values referencing design tokens. Full
rationale, class naming, anti-patterns, and examples: ./css-patterns.md
§Default styling is the baseline and §Component Styling In Practice.

Use clsx-style arrays and objects in `class` attributes instead of the
`class:` directive:

```svelte
<!-- Do this -->
<div class={['card', active && 'active', size]}></div>

<!-- Not this -->
<div class="card" class:active class:size></div>
```

Theming and child-styling mechanics (`style:` on elements, `--prop={v}` on
components, `:global` as last resort): ./css-patterns.md §Dynamic Theming.
Stores (`writable`/`readable`) are legacy — classes with `$state` fields
replace them.
