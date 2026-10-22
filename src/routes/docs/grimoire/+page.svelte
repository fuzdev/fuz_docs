<script lang="ts">
	import { resolve } from '$app/paths';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import { tome_get_by_slug } from '@fuzdev/fuz_ui/tome.ts';

	const tome = tome_get_by_slug('grimoire');

	const skill_href = resolve('/skills/grimoire' as any);
</script>

<TomeContent {tome}>
	<TomeSection>
		<TomeSectionHeader text="Overview" />
		<p>
			A grimoire is a markdown meta-repo that sits beside the repos it coordinates and holds working
			understanding about them — what was decided and why, what's next, what connects to what. Units
			of work that cut across repos get a home without polluting implementation repos, and stateless
			agent sessions get the context to orient across a whole ecosystem.
		</p>
		<p>
			These are broad patterns one personal grimoire has proved out, not a spec. A grimoire is meant
			to evolve for its owner's needs.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="The skill" />
		<p>
			The <a href={skill_href}>grimoire skill</a> is the full reference, written for agents and
			humans alike. It covers:
		</p>
		<ul>
			<li>
				<strong>Lore</strong> — per-repo planning context, paired with each repo's own crystallized
				<code>docs/</code>
			</li>
			<li><strong>Quests</strong> — cross-repo goals with a lifecycle</li>
			<li><strong>Arcs</strong> — long-running implementation efforts across many sessions</li>
			<li>
				<strong>Supporting layers</strong> — skills, writing, glossary, memory, self-observation,
				and tending
			</li>
			<li><strong>Work loop</strong> — orient, work, update, review after landing</li>
			<li><strong>Health</strong> — distillation, staleness, and treating claims as leads</li>
			<li>
				<strong>Key concepts</strong> — taste, the membrane, an agent-agnostic substrate, private or
				shared
			</li>
		</ul>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="See also" />
		<ul>
			<li>
				<TomeLink slug="fuz-stack" /> — coding conventions across the <code>@fuzdev</code> ecosystem
			</li>
			<li>
				<a href="https://agentskills.io/">Agent Skills</a> — the skill format the grimoire uses
			</li>
		</ul>
	</TomeSection>
</TomeContent>
