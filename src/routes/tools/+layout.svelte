<script lang="ts">
	import type { Snippet } from 'svelte';

	import SidebarLayout from '$routes/SidebarLayout.svelte';

	const { children }: { children: Snippet } = $props();
</script>

<SidebarLayout>
	{@render children()}
</SidebarLayout>
