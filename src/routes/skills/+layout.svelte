<script lang="ts">
	import type {Snippet} from 'svelte';

	import SidebarLayout from '../SidebarLayout.svelte';

	const {children}: {children: Snippet} = $props();
</script>

<SidebarLayout>
	{@render children()}
</SidebarLayout>
