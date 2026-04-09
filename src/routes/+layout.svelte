<script lang="ts">
	import '$routes/fuz.css';
	import '@fuzdev/fuz_code/theme.css';
	import '$routes/style.css';

	import ThemeRoot from '@fuzdev/fuz_ui/ThemeRoot.svelte';
	import {library_context, Library} from '@fuzdev/fuz_ui/library.svelte.js';
	import type {Snippet} from 'svelte';

	import {library_json} from '$routes/library.ts';

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	library_context.set(new Library(library_json, '/fuz_docs'));
</script>

<svelte:head>
	<title>@fuzdev/fuz_docs</title>
</svelte:head>

<ThemeRoot>
	{@render children()}
</ThemeRoot>
