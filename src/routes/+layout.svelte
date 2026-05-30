<script lang="ts">
	import 'virtual:fuz.css';
	import '@fuzdev/fuz_code/theme.css';
	import '$routes/style.css';

	import ThemeRoot from '@fuzdev/fuz_ui/ThemeRoot.svelte';
	import {library_context, Library} from '@fuzdev/fuz_ui/library.svelte.js';
	import {library_json_from_modules} from '@fuzdev/fuz_util/library_json.js';
	import {modules} from 'virtual:svelte-docinfo';
	import type {Snippet} from 'svelte';

	import package_json from '../../package.json' with {type: 'json'};

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	const library_json = library_json_from_modules(package_json, modules);

	library_context.set(new Library(library_json, '/fuz_docs'));
</script>

<svelte:head>
	<title>@fuzdev/fuz_docs</title>
</svelte:head>

<ThemeRoot>
	{@render children()}
</ThemeRoot>
