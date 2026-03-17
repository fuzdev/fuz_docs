<script lang="ts">
	import {resolve} from '$app/paths';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';
	import GithubLink from '@fuzdev/fuz_ui/GithubLink.svelte';

	const tome = get_tome_by_name('introduction');
</script>

<TomeContent {tome}>
	<TomeSection>
		<TomeSectionHeader text="Overview" />
		<p>
			fuz_docs is an experimental website with AI-generated documentation and agent skills for
			<a href="https://www.fuz.dev/">Fuz</a>, a zippy stack for autonomy. It's a poorly-reviewed
			actively-evolving dumping ground of conventions, patterns, and reference material for
			<GithubLink path="fuzdev"><code>@fuzdev</code></GithubLink> projects. Everything is in flux, not
			all patterns are endorsed, and some content is plain slop.
		</p>
		<p>
			This website is primarily designed for machine agents. Humans are welcome to browse
			<a href={resolve('/docs' as any)}>docs</a> and
			<a href={resolve('/skills' as any)}>skills</a>, but expect rough edges.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Skills" />
		<p>
			<a href="https://agentskills.io/">AI agent skills</a> are structured knowledge files that
			Claude Code loads for context. Each skill has a main <code>SKILL.md</code> and optional detailed
			references.
		</p>
		<table>
			<thead>
				<tr><th>Skill</th><th>Purpose</th></tr>
			</thead>
			<tbody>
				<tr
					><td><TomeLink name="fuz-stack" /></td><td
						>Coding conventions and patterns for TypeScript and Svelte 5 projects</td
					></tr
				>
				<tr
					><td><TomeLink name="grimoire" /></td><td
						>Cross-repo coordination with lore, quests, and skills</td
					></tr
				>
			</tbody>
		</table>
		<p>
			Browse all skills at <a href={resolve('/skills' as any)}><code>/skills</code></a>.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Reference" />
		<p>Auto-generated documentation from the <code>@fuzdev</code> ecosystem.</p>
		<table>
			<thead>
				<tr><th>Docs</th><th>Contents</th></tr>
			</thead>
			<tbody>
				<tr
					><td><TomeLink name="stack" /></td><td
						>Toolchain versions, all packages, dependency graph</td
					></tr
				>
				<tr
					><td><TomeLink name="api" /></td><td
						>Auto-generated TypeScript and Svelte API documentation</td
					></tr
				>
				<tr><td><TomeLink name="library" /></td><td>Package metadata and exports</td></tr>
			</tbody>
		</table>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Stack" />
		<pre>fuz_util → gro + fuz_css → fuz_ui → fuz_* apps</pre>
		<p>
			<code>gro</code> is a temporary build tool, to be replaced by <code>fuz</code> (Rust daemon +
			CLI). See <TomeLink name="stack" /> for details.
		</p>
	</TomeSection>
</TomeContent>
