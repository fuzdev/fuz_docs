<script lang="ts">
	import {resolve} from '$app/paths';
	import {page} from '$app/state';
	import type {Snippet} from 'svelte';
	import Breadcrumb from '@fuzdev/fuz_ui/Breadcrumb.svelte';

	import {skills} from './skills/skills_manifest.js';
	import {tools} from './tools/tools_manifest.js';

	const {children}: {children: Snippet} = $props();

	const pathname = $derived(page.url.pathname);
</script>

<div class="sidebar_layout">
	<header class="primary_nav">
		<nav>
			<Breadcrumb>📜</Breadcrumb>
		</nav>
	</header>
	<aside class="sidebar unstyled">
		<nav>
			<ul class="unstyled">
				<li>
					<a class="menuitem" href={resolve('/docs')}>docs</a>
				</li>
				<li>
					<a
						class="menuitem"
						href={resolve('/skills')}
						class:selected={pathname === resolve('/skills')}>skills</a
					>
				</li>
				{#each skills as skill (skill.name)}
					{@const skill_path = resolve(('/skills/' + skill.name) as any)}
					{@const skill_active = pathname.startsWith(skill_path)}
					<li>
						<a class="menuitem pl_lg" href={skill_path} class:selected={pathname === skill_path}
							>{skill.name}</a
						>
						{#if skill_active && skill.references.length > 0}
							<ul class="unstyled">
								{#each skill.references as ref (ref.slug)}
									<li>
										<a
											class="menuitem"
											style:padding-left="calc(2 * var(--space_lg))"
											href={resolve(('/skills/' + skill.name + '/' + ref.slug) as any)}
											class:selected={pathname ===
												resolve(('/skills/' + skill.name + '/' + ref.slug) as any)}>{ref.title}</a
										>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
				<li>
					<a
						class="menuitem"
						href={resolve('/tools')}
						class:selected={pathname === resolve('/tools')}>tools</a
					>
				</li>
				{#each tools as tool (tool.name)}
					{@const tool_path = resolve(('/tools/' + tool.name) as any)}
					<li>
						<a class="menuitem pl_lg" href={tool_path} class:selected={pathname === tool_path}
							>{tool.name}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	</aside>
	<div class="content">
		<div class="width_atmost_md">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.sidebar_layout {
		--primary_nav_height: 52px;
		--sidebar_width: 280px;
	}
	.primary_nav {
		position: sticky;
		top: 0;
		z-index: 10;
		height: var(--primary_nav_height);
		display: flex;
		align-items: center;
		padding-left: var(--space_md);
		background-color: var(--shade_00);
		border-bottom: var(--border_width) solid var(--border_color);
	}
	.sidebar {
		position: fixed;
		left: 0;
		top: var(--primary_nav_height);
		width: var(--sidebar_width);
		height: calc(100% - var(--primary_nav_height));
		overflow-y: auto;
		scrollbar-width: thin;
		background: var(--sidebar_bg, var(--shade_05));
		padding: var(--space_md);
	}
	.content {
		min-height: 100%;
		padding: var(--space_lg) var(--space_xl) var(--space_xl7)
			calc(var(--sidebar_width) + var(--space_xl));
	}
</style>
