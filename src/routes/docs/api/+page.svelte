<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';
	import {resolve} from '$app/paths';

	import {stack} from '$routes/stack.js';
	import {libraries_map} from '$routes/libraries.js';

	const tome = get_tome_by_name('api');

	// Only show packages that have library data (modules to document)
	const packages_with_docs = stack.libraries.filter(
		(lib) => lib.kind === 'package' && libraries_map.has(lib.path),
	);

	const total_modules = packages_with_docs.reduce((sum, pkg) => sum + pkg.module_count!, 0);
	const total_exports = packages_with_docs.reduce((sum, pkg) => sum + pkg.export_count!, 0);
</script>

<svelte:head>
	<title>API docs - @fuzdev stack</title>
</svelte:head>

<TomeContent {tome}>
	<TomeSection>
		<TomeSectionHeader text="Packages" />
		<p>
			{packages_with_docs.length} packages, {total_modules} modules, {total_exports} exports
		</p>
		<ul class="packages">
			{#each packages_with_docs as pkg (pkg.name)}
				<li>
					<a class="package_card" href={resolve(`/docs/api/${pkg.path}`)}>
						<span class="glyph">{pkg.glyph}</span>
						<span class="name">{pkg.name}</span>
						<span class="description">{pkg.description}</span>
						<span class="stats"
							>{pkg.exported_module_count} modules, {pkg.export_count} exports</span
						>
					</a>
				</li>
			{/each}
		</ul>
	</TomeSection>
</TomeContent>

<style>
	.packages {
		display: flex;
		flex-direction: column;
		gap: var(--space_sm);
		padding: 0;
		list-style: none;
	}
	.packages li {
		margin: 0;
	}
	.package_card {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--space_xs) var(--space_md);
		padding: var(--space_md) var(--space_lg);
		border: var(--border_width) solid var(--border_color);
		border-radius: var(--border_radius);
		text-decoration: none;
	}
	.package_card:hover {
		border-color: var(--color_a_5);
		background: var(--fg_1);
	}
	.glyph {
		font-size: var(--size_xl);
	}
	.name {
		font-weight: 700;
	}
	.description {
		flex: 1;
		color: var(--text_2);
	}
	.stats {
		font-size: var(--size_sm);
		color: var(--text_3);
	}
</style>
