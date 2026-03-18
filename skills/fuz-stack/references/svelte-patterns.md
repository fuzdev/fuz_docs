# Svelte 5 Patterns

Comprehensive guide to Svelte 5 runes and patterns used across the Fuz
ecosystem.

## Contents

- [State Runes](#state-runes)
- [Derived Values](#derived-values)
- [Schema-Driven Reactive Classes](#schema-driven-reactive-classes)
- [Context Patterns](#context-patterns)
- [Snippet Patterns](#snippet-patterns)
- [Effect Patterns](#effect-patterns)
- [Attachment Patterns](#attachment-patterns)
- [Props Patterns](#props-patterns)
- [Event Handling](#event-handling)
- [Component Composition](#component-composition)
- [Quick Reference](#quick-reference)

## State Runes

### `$state()` vs `$state.raw()`

Use `$state()` for reactive objects that need deep tracking. Use `$state.raw()`
for data that should be replaced wholesale rather than mutated.

```typescript
// $state() - deep reactivity, use for UI state
let form_data = $state({name: '', email: ''});
form_data.name = 'Alice'; // triggers reactivity

// $state.raw() - shallow, use for API responses
let ollama_show_response = $state.raw<OllamaShowResponse | null>(null);
let completion_request = $state.raw<CompletionRequest | null>(null);
let completion_response = $state.raw<CompletionResponse | null>(null);
```

**When to use `$state.raw()`:**

- API responses (replaced entirely on each fetch)
- Large objects where deep tracking is wasteful
- Immutable data structures
- Objects from external libraries

**When to use `$state()`:**

- Form state with individual field updates
- UI state (toggles, selections, counters)
- Objects you'll mutate property-by-property

### Arrays and Collections

```typescript
// Reactive array - mutations tracked
let items = $state<string[]>([]);
items.push('new'); // triggers reactivity
items[0] = 'updated'; // triggers reactivity

// Raw array - only replacement tracked
let api_results = $state.raw<Result[]>([]);
api_results = [...api_results, new_result]; // triggers
api_results.push(new_result); // does NOT trigger
```

## Derived Values

### `$derived` vs `$derived.by()`

Use `$derived` for simple expressions. Use `$derived.by()` when you need loops,
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

**Real example from Thread.svelte:**

```typescript
// Thread hierarchy computation
let threads = $derived.by(() => {
	const result: Thread[] = [];
	for (const message of messages) {
		if (message.parent_id === thread_id) {
			result.push(create_thread(message));
		}
	}
	return result;
});
```

### Derived with Dependencies

Derived values automatically track their dependencies:

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

## Schema-Driven Reactive Classes

Zod schemas paired with Svelte 5 runes classes — the schema defines the JSON
shape, the class adds reactivity and behavior. See ./zod-schemas.md
for schema conventions.

```typescript
import {z} from 'zod';

export const MessageJson = z.strictObject({
	id: z.string(),
	content: z.string(),
	role: z.enum(['user', 'assistant']),
	created: z.number(),
});

export type MessageJson = z.infer<typeof MessageJson>;

export class Message {
	id: string = $state()!;
	content: string = $state()!;
	role: 'user' | 'assistant' = $state()!;
	created: number = $state()!;

	constructor(json: MessageJson) {
		this.id = json.id;
		this.content = json.content;
		this.role = json.role;
		this.created = json.created;
	}

	// Derived state
	get is_user(): boolean {
		return this.role === 'user';
	}

	// Serialize back to JSON
	to_json(): MessageJson {
		return {
			id: this.id,
			content: this.content,
			role: this.role,
			created: this.created,
		};
	}
}
```

**Key patterns:**

- Zod schema defines the JSON shape (see ./zod-schemas.md)
- Class properties use `$state()` for reactivity
- Constructor hydrates from JSON
- `to_json()` method for serialization
- Getters for derived values (automatically reactive)

## Context Patterns

### Creating Context

Use `create_context<T>()` from `@fuzdev/fuz_ui/context_helpers.js`. It has two
overloads — without a fallback, `get()` throws if the context is unset and
`get_maybe()` returns `undefined`; with a fallback function, `get()` uses it
and `set()` value becomes optional:

```typescript
// context_helpers.ts (from @fuzdev/fuz_ui)
import {getContext, setContext} from 'svelte';

// Without fallback — get() throws if unset, get_maybe() returns undefined
export function create_context<T>(): {
	get: (error_message?: string) => T;
	get_maybe: () => T | undefined;
	set: (value: T) => T;
};

// With fallback — get() uses fallback if unset, set() value is optional
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

<!-- Provider component sets the context -->
<script>
  import type {Snippet} from 'svelte';
  import { frontend_context } from './contexts.js';

  const {children}: {children: Snippet} = $props();
  const frontend = new Frontend();
  frontend_context.set(frontend);
</script>

{@render children()}

<!-- Consumer components get the context -->
<script>
  import { frontend_context } from './contexts.js';
  const frontend = frontend_context.get();
</script>
```

### Common Contexts

| Context                 | Type         | Purpose                        |
| ----------------------- | ------------ | ------------------------------ |
| `theme_state_context`   | `ThemeState` | Theme state and switching      |
| `library_context`       | `Library`    | Package API metadata for docs  |
| `tome_context`          | `Tome`       | Current documentation page     |
| `frontend_context`      | `Frontend`   | Application state              |
| `section_depth_context` | `number`     | Heading level depth (fallback) |

## Snippet Patterns

Svelte 5 replaces slots with snippets (`{#snippet}` and `{@render}`).

### Basic Snippets

```svelte
<!-- Card.svelte -->
<script>
	import type {Snippet} from 'svelte';

	const {
		header,
		content,
	}: {
		header?: Snippet;
		content?: Snippet;
	} = $props();
</script>

<div class="card">
	{#if header}
		<div class="card-header">
			{@render header()}
		</div>
	{/if}
	{#if content}
		<div class="card-content">
			{@render content()}
		</div>
	{/if}
</div>
```

Usage:

```svelte
<Card>
	{#snippet header()}
		<h2>Card Title</h2>
	{/snippet}

	{#snippet content()}
		<p>Card body content here.</p>
	{/snippet}
</Card>
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

Usage:

```svelte
<List items={users}>
	{#snippet item(user)}
		<span>{user.name} ({user.email})</span>
	{/snippet}

	{#snippet empty()}
		<em>No users found.</em>
	{/snippet}
</List>
```

### Default Snippet Content

```svelte
<!-- Component with default snippet -->
<script lang="ts">
	import type {Snippet} from 'svelte';

	const {
		menu,
	}: {
		menu?: Snippet;
	} = $props();
</script>

{#if menu}
	{@render menu()}
{:else}
	<!-- Default content when no snippet provided -->
	<button>Default Menu</button>
{/if}
```

### Menu and Contextmenu Snippets

Common pattern for contextmenus and dropdowns:

```svelte
<!-- Item.svelte -->
<script lang="ts">
	import type {Snippet} from 'svelte';
	import Contextmenu from './Contextmenu.svelte';

	const {
		contextmenu,
	}: {
		contextmenu?: Snippet;
	} = $props();
</script>

<div class="item">
	<!-- content -->
	{#if contextmenu}
		<Contextmenu>
			{@render contextmenu()}
		</Contextmenu>
	{/if}
</div>
```

Usage:

```svelte
<Item>
	{#snippet contextmenu()}
		<MenuItem onclick={handle_edit}>Edit</MenuItem>
		<MenuItem onclick={handle_delete}>Delete</MenuItem>
	{/snippet}
</Item>
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

Runs before DOM updates (like Svelte 4's `beforeUpdate`):

```typescript
$effect.pre(() => {
	// Access DOM state before Svelte updates it
	previous_scroll = container.scrollTop;
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

**Use cases for `untrack()`:**

- Reading configuration that shouldn't trigger re-runs
- Accessing stable references (event handlers, callbacks)
- Breaking infinite loops in bidirectional syncing

## Attachment Patterns

Svelte 5 replaces actions with attachments (`{@attach}`). Attachments in fuz_ui
live in `*.svelte.ts` files and use the `Attachment` type from
`svelte/attachments`.

### Attachment API

An attachment is a function `(element) => cleanup | void`. In fuz_ui,
attachments use a **factory pattern** — the exported function accepts
configuration and returns the `Attachment`:

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

#### `autofocus` — Focus on Mount

Solves the problem where the HTML `autofocus` attribute doesn't work when
elements mount from reactive conditionals (`{#if}`) in SPAs.

```typescript
// autofocus.svelte.ts
import type {Attachment} from 'svelte/attachments';

export const autofocus =
	(options?: FocusOptions): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		el.focus({focusVisible: true, ...options});
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

#### `intersect` — IntersectionObserver

Wraps the IntersectionObserver API with a **lazy function pattern** for reactive
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

#### `contextmenu_attachment` — Context Menu Data

Caches context menu params on an element via dataset for later retrieval at
interaction time. Simpler pattern — direct params, no lazy function.

```typescript
// contextmenu_state.svelte.ts (exported alongside Contextmenu state class)
export const contextmenu_attachment =
	<T extends ContextmenuParams>(
		params: T | Array<T> | null | undefined,
	): Attachment<HTMLElement | SVGElement> =>
	(el) => {
		/* cache params in dataset */
	};
```

### Choosing a Pattern

| Pattern                       | When to use                               | Example       |
| ----------------------------- | ----------------------------------------- | ------------- |
| **Simple factory**            | Fire-once, no ongoing observation         | `autofocus`   |
| **Lazy function** (`() => p`) | Reactive callbacks without observer churn | `intersect`   |
| **Direct params**             | Static config cached for later retrieval  | `contextmenu` |

### Writing a New Attachment

1. Create `src/lib/my_attachment.svelte.ts` (use `.svelte.ts` for attachments)
2. Import `Attachment` type from `svelte/attachments`
3. Export a factory function returning `Attachment<HTMLElement | SVGElement>`
4. Return a cleanup function if holding resources (observers, listeners)
5. Use `$effect` inside the attachment body for reactive behavior
6. Add JSDoc with `@module` tag and `@param` tags

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

```svelte
<script lang="ts">
	const {
		value = $bindable(),
	}: {
		value: string;
	} = $props();
</script>

<!-- Usage -->
<Input bind:value={search} />
```

### Rest Props

```svelte
<script lang="ts">
	import type {Snippet} from 'svelte';
	import type {HTMLAttributes} from 'svelte/elements';

	const {
		variant = 'primary',
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & {
		variant?: 'primary' | 'secondary';
		children?: Snippet;
	} = $props();
</script>

<div class="box {variant}" {...rest}>
	{#if children}
		{@render children()}
	{/if}
</div>
```

## Event Handling

Svelte 5 uses standard DOM event syntax:

```svelte
<!-- Svelte 5 -->
<button onclick={handle_click}>Click</button>
<input oninput={(e) => value = e.currentTarget.value} />

<!-- Event modifiers via wrapper functions -->
<script>
  function prevent_default<T extends Event>(fn: (e: T) => void) {
    return (e: T) => {
      e.preventDefault();
      fn(e);
    };
  }
</script>

<form onsubmit={prevent_default(handle_submit)}>
```

## Component Composition

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

## Quick Reference

| Pattern         | Use Case                           |
| --------------- | ---------------------------------- |
| `$state()`      | Mutable UI state, form data        |
| `$state.raw()`  | API responses, immutable data      |
| `$derived`      | Simple computed values             |
| `$derived.by()` | Complex logic, loops, conditionals |
| `$effect`       | Side effects, subscriptions        |
| `$effect.pre()` | Before DOM update                  |
| `untrack()`     | Read without tracking              |
| `$props()`      | Component inputs                   |
| `$bindable()`   | Two-way binding props              |
| `{#snippet}`    | Named content slots                |
| `{@render}`     | Render snippets                    |
| `{@attach}`     | DOM element behaviors              |
