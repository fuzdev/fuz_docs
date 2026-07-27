---
description: Svelte 5 runes, contexts, snippets, attachments
---

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
- [CSS in Components](#css-in-components)
- [Legacy Features to Avoid](#legacy-features-to-avoid)
- [Quick Reference](#quick-reference)

## State Runes

Only use `$state` for variables that should be _reactive_ — variables that
cause an `$effect`, `$derived`, or template expression to update. Everything
else can be a normal variable.

### `$state()` is the default

`$state()` for all reactive state. It proxies objects and arrays so in-place
mutations trigger updates — `push`, `splice`, `sort`, index assignment,
property writes, and `bind:value={obj.field}` all work without further
thought. For primitives it costs one extra `typeof` check on set.

`$state.raw()` is a **performance opt-out**, not a style choice: it stores the
value directly and tracks only reassignment. Reach for it when a large value is
replaced wholesale, never mutated in place, and proxying it is measurably
expensive. Don't reach for it to signal intent — an unnecessary `raw` silently
breaks reactivity the moment someone mutates the value in place.

`structuredClone`, `JSON.stringify`, and `postMessage` all walk through
`$state()` proxies cleanly — proxy traps return the target's own keys.
`JSON.stringify` also calls `toJSON()` through the proxy.

```typescript
let name = $state(''); // primitive
let items = $state<string[]>([]);
items.push('new'); // triggers reactivity
let form_data = $state({ name: '', email: '' });
form_data.name = 'Alice'; // triggers reactivity via proxy
const config = $state({ iterations: 5, warmup: 2 });
// bind:value={config.iterations} writes a property — the proxy tracks it
```

### The `$state()!` Non-null Assertion Pattern

Class properties initialized by a constructor or `init()` use `$state()!`:

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

Used across fuz_ui state classes and zzz Cell subclasses.

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
identities. For serialization it's usually unnecessary — `JSON.stringify` and
`structuredClone` walk proxies on their own.

**Observed quirk** (Svelte 5.56 + vite-plugin-svelte): `const r = $state.snapshot(x)` is
silently elided to `const r = x` somewhere downstream of Svelte's
`compileModule` (whose output is correct). `return $state.snapshot(x)` and
inline expression use work correctly. zzz Cell's `encode_property` is the
direct-return form, so `to_json()` is unaffected. If `const r =
$state.snapshot(x)` seems to lose snapshot semantics, this is the cause.

## Derived Values

Use `$derived` to compute from state — never `$effect` with assignment.
Deriveds are writable (assign to override, but the expression re-evaluates on
dependency change). Derived objects/arrays are not deeply reactive.

### `$derived` vs `$derived.by()`

`$derived` takes an expression (not a function); `$derived.by()` takes a
function for loops, conditionals, or multi-step logic.

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

Always mark `$derived` class properties `readonly` unless you explicitly need
reassignment (which Svelte 5 does allow):

```typescript
// From Library class (fuz_ui/library.svelte.ts)
export class Library {
	readonly library_json: LibraryJson = $state()!;

	readonly pkg_json = $derived(this.library_json.pkg_json);
	readonly source_json = $derived(this.library_json.source_json);
	// `LibraryJson` stores only the raw `pkg_json`/`source_json` pair — these
	// derive from `pkg_json`, not from extra `LibraryJson` fields.
	readonly name = $derived(this.pkg_json.name);
	readonly repo_url = $derived(repo_url_parse(this.pkg_json.repository)!);
	readonly modules = $derived(
		this.source_json.modules
			? this.source_json.modules.map((module_json) => new Module(this, module_json))
			: []
	);
	readonly module_by_path = $derived(new Map(this.modules.map((m) => [m.path, m])));
}
```

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

### Derived from Props

Treat props as though they will change — use `$derived` for values depending
on props:

```typescript
let { type } = $props();

// Do this — updates when type changes
let color = $derived(type === 'danger' ? 'red' : 'green');

// Don't do this — color won't update if type changes
// let color = type === 'danger' ? 'red' : 'green';
```

## Reactive Collections

### `SvelteMap` and `SvelteSet`

From `svelte/reactivity` — reactive Map/Set that trigger updates on mutations:

```typescript
import { SvelteMap, SvelteSet } from 'svelte/reactivity';

// From DocsLinks class (fuz_ui/docs_helpers.svelte.ts)
export class DocsLinks {
	readonly links: SvelteMap<string, DocsLinkInfo> = new SvelteMap();
	readonly fragments_onscreen: SvelteSet<string> = new SvelteSet();

	// $derived.by works with SvelteMap - recomputes when links change
	docs_links = $derived.by(() => {
		const children_map: Map<string | undefined, Array<DocsLinkInfo>> = new Map();
		for (const link of this.links.values()) {
			// ... build tree from SvelteMap entries
		}
		return result;
	});
}
```

Standard `Map`/`Set` are not tracked by Svelte's reactivity.

For entity collections consumed by different lookups, maintain **multiple
`SvelteMap` indexes** over the data (by id, plus one or more secondary keys),
rebuilding or updating them as the source changes. Deriveds then do `.get()`
lookups instead of array scans.

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
			color_scheme: this.color_scheme
		};
	}
}
```

### Cell Pattern (zzz)

Advanced version with a `Cell` base class that automates JSON hydration from
Zod schemas. Same rune conventions (`$state()!` for schema fields,
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
// Define the context (typically in a shared module)
export const frontend_context = create_context<Frontend>();
export const section_depth_context = create_context(() => 0);
```

```svelte
<!-- Provider component sets the context -->
<script>
	import type { Snippet } from 'svelte';
	import { frontend_context } from './frontend.svelte.ts';

	const { app, children }: { app: Frontend; children: Snippet } = $props();
	frontend_context.set(app);
</script>

{@render children()}
```

```svelte
<!-- Consumer components get the context -->
<script>
	import { frontend_context } from './frontend.svelte.ts';
	const app = frontend_context.get();
</script>
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
reason — components with a `library` prop (`LibraryDetail`, `ApiIndex`,
`ApiModule`) project the prop into it for their subtree via
`library_context.set(() => library)`. Direct value contexts like
`frontend_context` and `site_context` are for values stable for the context's
lifetime.

For an inventory of contexts in fuz_ui and zzz, grep for `create_context<`.

## Snippet Patterns

Svelte 5 replaces slots with snippets (`{#snippet}`, `{@render}`).

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

A snippet prop can take parameters (`Snippet<[T]>`), and `generics="T"` on the
`<script>` tag makes them generic over the component's data — a list renderer
takes `items: T[]` plus `item: Snippet<[T]>` and renders `{@render item(entry)}`
per entry. fuz_ui's real `generics=` user is `Contextmenu.svelte`.

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
- `$inspect` / `$inspect.trace()` for debugging (not `$effect` + `console.log`)
- `createSubscriber` from `svelte/reactivity` for observing external sources

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

From `@fuzdev/fuz_ui/rune_helpers.svelte.ts` — passes call count to the
effect, useful for skipping the initial run:

```typescript
import { effect_with_count } from '@fuzdev/fuz_ui/rune_helpers.svelte.ts';

// Skip the first run (count === 1), save on subsequent changes
effect_with_count((count) => {
	const v = theme_state.color_scheme;
	if (count === 1) return; // skip initial
	save_color_scheme(v);
});
```

### `untrack()`

Read values without creating dependencies — config reads that shouldn't
trigger re-runs, stable references, or breaking infinite loops in
bidirectional syncing:

```typescript
import { untrack } from 'svelte';

$effect(() => {
	// count is tracked
	console.log('Count changed to:', count);

	// other_value is NOT tracked - reading it won't re-run the effect
	const snapshot = untrack(() => other_value);
	save_snapshot(count, snapshot);
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
	scroll_y: number = $state(0);
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

### Writing a New Attachment

1. Create `src/lib/my_attachment.svelte.ts`
2. Export a factory returning `Attachment<HTMLElement | SVGElement>`
3. Return cleanup if holding resources (observers, listeners)
4. Use `$effect` inside for reactive behavior, `on()` for event listeners
5. Add JSDoc with `@module` and `@param` tags

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

Real examples from fuz_ui:

```typescript
// HueInput.svelte
let { value = $bindable(180), children, ...rest } = $props();

// Details.svelte
let { open = $bindable(), ...rest } = $props();

// DocsSearch.svelte
let { search_query = $bindable(), ...rest } = $props();
```

### Rest Props with SvelteHTMLElements

Intersect `SvelteHTMLElements` from `svelte/elements` with custom props:

```svelte
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SvelteHTMLElements } from 'svelte/elements';

	const {
		align = 'left',
		icon,
		children,
		...rest
	}: SvelteHTMLElements['div'] &
		SvelteHTMLElements['a'] & {
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

```typescript
// Programmatic listener claiming context menu and wheel events
const cleanup_contextmenu = on(canvas, 'contextmenu', (e) => {
	swallow(e);
});

const cleanup_wheel = on(
	canvas,
	'wheel',
	(e) => {
		handle_zoom(e);
		swallow(e);
	},
	{ passive: false }
);
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

```typescript
// Anti-pattern: module-level runes exposed through a singleton
let show_map = $state(false);
let show_sidebar = $state(true);

export const world_ui = {
	get show_map() {
		return show_map;
	},
	set show_map(v: boolean) {
		show_map = v;
	},
	get show_sidebar() {
		return show_sidebar;
	},
	set show_sidebar(v: boolean) {
		show_sidebar = v;
	}
};
```

Use a class + context instead — the class owns its state, and a root
component sets it once:

```typescript
// world_ui_state.svelte.ts
import { create_context } from '@fuzdev/fuz_ui/context_helpers.ts';

export const world_ui_context = create_context<WorldUiState>();

export class WorldUiState {
	show_map: boolean = $state(false);
	show_sidebar: boolean = $state(true);
}
```

```svelte
<!-- +layout.svelte or similar root component -->
<script>
	import { WorldUiState, world_ui_context } from '#lib/world_ui_state.svelte.ts';
	world_ui_context.set(new WorldUiState());
</script>
```

```svelte
<!-- any descendant component -->
<script>
	import { world_ui_context } from '#lib/world_ui_state.svelte.ts';
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
		modules: {
			get all() {
				return all_modules;
			},
			get filtered() {
				return filtered_modules;
			}
		},
		declarations: {
			get all() {
				return all_declarations;
			},
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
	width: number = $state(0);
	height: number = $state(0);
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

## CSS in Components

**Goal: minimal `<style>` blocks.** Components delegate styling to fuz_css
utility classes and design tokens; many well-designed components have no
`<style>` block at all. When one is needed, keep it focused on
component-specific layout logic (positioning, complex pseudo-states,
responsive breakpoints), with all values referencing design tokens. Full
rationale, class naming, anti-patterns, and examples: ./css-patterns.md
§Default styling is the baseline and §Component Styling In Practice.

### JS Variables in CSS

Use `style:` directive to pass JS values as CSS custom properties:

```svelte
<div style:--columns={columns}>...</div>

<style>
	div {
		grid-template-columns: repeat(var(--columns), 1fr);
	}
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
	h1 {
		color: var(--color);
	}
</style>
```

```svelte
<!-- :global override (last resort) -->
<div>
	<Child />
</div>

<style>
	div :global {
		h1 {
			color: red;
		}
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

| Instead of                      | Use                                           |
| ------------------------------- | --------------------------------------------- |
| `let count = 0` (implicit)      | `let count = $state(0)`                       |
| `$:` assignments/statements     | `$derived` / `$effect`                        |
| `export let`                    | `$props()`                                    |
| `on:click={...}`                | `onclick={...}`                               |
| `<slot>`                        | `{#snippet}` / `{@render}`                    |
| `<svelte:component this={C}>`   | `<C />` (dynamic component directly)          |
| `<svelte:self>`                 | `import Self from './Self.svelte'` + `<Self>` |
| `use:action`                    | `{@attach}`                                   |
| `class:active`                  | `class={['base', active && 'active']}`        |
| Stores (`writable`, `readable`) | Classes with `$state` fields                  |

## Quick Reference

The decision-fraught choices, summarized:

- **`$state()` vs `$state.raw()`** — `$state()` always, unless profiling shows
  proxying a large wholesale-replaced value costs measurably. `raw` tracks only
  reassignment, so it silently breaks in-place mutation (`push`, property
  writes, `bind:` on object properties).
- **`$derived` vs `$derived.by()`** — `$derived` takes an expression;
  `$derived.by()` takes a function for loops/conditionals/multi-step logic.
  Mark class-level deriveds `readonly`.
- **`{@attach}` vs `$effect`** — attachments for element behavior (replaces
  `use:action`); effects for everything else, but reach for `$derived`,
  `<svelte:window>`, or event handlers first.
- **`create_context<T>()` vs raw `setContext`/`getContext`** — fuz_ui's
  `create_context` provides the throw-on-missing `get()` plus `get_maybe()`,
  with optional fallback factory.
