<script lang="ts">
	import ApiIndex from '@fuzdev/fuz_ui/ApiIndex.svelte';
	import ApiModule from '@fuzdev/fuz_ui/ApiModule.svelte';
	import {library_context} from '@fuzdev/fuz_ui/library.svelte.js';
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';
	import {resolve} from '$app/paths';

	import {get_library} from '$routes/libraries.ts';

	const {params} = $props();

	const tome = get_tome_by_name('api');

	// Parse the path: first segment is repo_path, remainder is module_path.
	// Computed at init — Docs.svelte re-keys on pathname so this recreates on navigation.
	const full_path = $derived(params.module_path ?? '');
	const slash_index = $derived(full_path.indexOf('/'));
	const repo_path = $derived(slash_index === -1 ? full_path : full_path.slice(0, slash_index));
	const module_path = $derived(slash_index === -1 ? '' : full_path.slice(slash_index + 1));

	// TODO is not reactive, maybe put a getter inside `library_context` instead of the Library instance?
	// svelte-ignore state_referenced_locally
	const library = get_library(repo_path);

	// Set library_context during init so ModuleLink/DeclarationLink resolve correctly during SSR.
	if (library) {
		library_context.set(library);
	}
</script>

<svelte:head>
	<title>{module_path || repo_path} - API docs - @fuzdev stack</title>
</svelte:head>

{#if !library}
	<section>
		<p>Package not found: {repo_path}</p>
		<p><a href={resolve('/docs/api')}>Back to API index</a></p>
	</section>
{:else if module_path}
	<ApiModule {module_path} {library} {tome} />
{:else}
	<ApiIndex {library} {tome} />
{/if}
