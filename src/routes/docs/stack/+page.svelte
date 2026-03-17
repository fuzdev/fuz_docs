<script lang="ts">
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';

	import {stack} from '$routes/stack.js';
	import {SvelteMap} from 'svelte/reactivity';

	const tome = get_tome_by_name('stack');

	const packages = stack.libraries.filter((lib) => lib.kind === 'package');
	const crates = stack.libraries.filter((lib) => lib.kind === 'crate');

	const total_exports = packages.reduce((sum, pkg) => sum + pkg.export_count!, 0);
	const total_modules = packages.reduce((sum, pkg) => sum + pkg.module_count!, 0);
	const total_exported_modules = packages.reduce((sum, pkg) => sum + pkg.exported_module_count!, 0);

	const dep_graph: Record<string, Array<string>> = stack.dependency_graph;

	const build_dag_section = (pkgs: typeof packages): string => {
		const lines: Array<string> = [];
		for (const pkg of pkgs) {
			const deps = dep_graph[pkg.name] ?? [];
			if (deps.length === 0) {
				lines.push(pkg.name + ' (no runtime @fuzdev deps)');
			} else {
				lines.push(pkg.name);
				for (let i = 0; i < deps.length; i++) {
					const prefix = i === deps.length - 1 ? '└── ' : '├── ';
					lines.push(`  ${prefix}${deps[i]}`);
				}
			}
		}
		return lines.join('\n');
	};

	const published_packages = packages.filter((pkg) => pkg.published);
	const private_packages = packages.filter((pkg) => !pkg.published);

	const dag_text =
		build_dag_section(published_packages) +
		(private_packages.length > 0
			? '\n\nUnpublished packages:\n' + build_dag_section(private_packages)
			: '');

	// Group crates by workspace
	const crate_workspaces: Array<{name: string; edition: string; crates: typeof crates}> = $state(
		[],
	);
	{
		const ws_map: Map<string, (typeof crate_workspaces)[number]> = new SvelteMap();
		for (const crate of crates) {
			const ws_name = crate.workspace!;
			if (!ws_map.has(ws_name)) {
				const ws = {name: ws_name, edition: crate.edition!, crates: [] as typeof crates};
				crate_workspaces.push(ws);
				ws_map.set(ws_name, ws);
			}
			ws_map.get(ws_name)!.crates.push(crate);
		}
	}
</script>

<TomeContent {tome}>
	<TomeSection>
		<TomeSectionHeader text="Toolchain" />
		<table>
			<thead>
				<tr><th>Tool</th><th>Version</th></tr>
			</thead>
			<tbody>
				{#each Object.entries(stack.toolchain) as [tool, version] (tool)}
					<tr><td>{tool}</td><td><code>{version}</code></td></tr>
				{/each}
			</tbody>
		</table>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="TypeScript and Svelte packages" />
		<p>
			{packages.length} packages, {total_exported_modules} exported modules ({total_modules}
			total), {total_exports} exports
		</p>
		<table>
			<thead>
				<tr>
					<th>Package</th>
					<th>Version</th>
					<th>Description</th>
					<th>Modules</th>
					<th>Exports</th>
					<th>Published</th>
				</tr>
			</thead>
			<tbody>
				{#each packages as pkg (pkg.name)}
					<tr>
						<td>
							{pkg.glyph}
							{#if pkg.homepage_url}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
								<a href={pkg.homepage_url}>{pkg.name}</a>
							{:else}
								{pkg.name}
							{/if}
						</td>
						<td><code>{pkg.version}</code></td>
						<td>{pkg.description}</td>
						<td>
							{#if pkg.exported_module_count! < pkg.module_count!}
								{pkg.exported_module_count}/{pkg.module_count}
							{:else}
								{pkg.module_count}
							{/if}
						</td>
						<td>{pkg.export_count}</td>
						<td>{pkg.published ? 'yes' : 'no'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</TomeSection>

	{#if crate_workspaces.length > 0}
		<TomeSection>
			<TomeSectionHeader text="Rust workspaces" />
			{#each crate_workspaces as workspace (workspace.name)}
				<h3>{workspace.name}</h3>
				<table>
					<thead>
						<tr>
							<th>Crate</th>
							<th>Version</th>
							<th>Kind</th>
							<th>Description</th>
							<th>Deps</th>
						</tr>
					</thead>
					<tbody>
						{#each workspace.crates as crate (crate.name)}
							<tr>
								<td><code>{crate.name}</code></td>
								<td><code>{crate.version}</code></td>
								<td>{crate.crate_kind}</td>
								<td>{crate.description}</td>
								<td>{crate.internal_deps!.join(', ')}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/each}
		</TomeSection>
	{/if}

	<TomeSection>
		<TomeSectionHeader text="Dependency graph" />
		<pre>{dag_text}</pre>
	</TomeSection>
</TomeContent>
