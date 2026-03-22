<script lang="ts">
	import Breadcrumb from '@fuzdev/fuz_ui/Breadcrumb.svelte';
	import type {Snippet} from 'svelte';

	const {
		children,
	}: {
		children: Snippet;
	} = $props();
</script>

<section class="breadcrumbs">
	<Breadcrumb>📜</Breadcrumb>
</section>
<section class="wrapper">
	{@render children()}
</section>
<section class="breadcrumbs">
	<Breadcrumb>📜</Breadcrumb>
</section>

<style>
	.wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		padding: var(--space_xl2);
	}
	.breadcrumbs {
		margin-top: var(--space_xl3);
		display: flex;
		flex-direction: column;
		align-items: center;
	}
</style>
