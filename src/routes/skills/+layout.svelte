<script lang="ts">
	import type {Snippet} from 'svelte';
	import {Library, library_context} from '@fuzdev/fuz_ui/library.svelte.js';

	import SidebarLayout from '../SidebarLayout.svelte';
	import {library_json} from '$routes/library.js';

	const {children}: {children: Snippet} = $props();

	// Skill docs render with `Mdz`, whose injected `DocsLink` resolves backticked
	// identifiers against `library_context` — so the `/skills` subtree provides its
	// own (this section loads the heavy analyzed `modules`; the landing doesn't).
	library_context.set(new Library(library_json, '/fuz_docs'));
</script>

<SidebarLayout>
	{@render children()}
</SidebarLayout>
