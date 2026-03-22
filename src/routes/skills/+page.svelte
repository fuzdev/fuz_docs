<script lang="ts">
	import {resolve} from '$app/paths';

	import {skills} from './skills_manifest.js';
</script>

<h1>Skills</h1>
<p>
	Experimental AI-generated <a href="https://agentskills.io/">skill</a> documentation for the Fuz ecosystem,
	designed for both human and machine consumption, rendered with mdz. Mostly poorly reviewed — everything
	is in flux, not all patterns are endorsed, and some content is plain slop.
</p>
<ul>
	{#each skills as skill (skill.name)}
		<li>
			<a href={resolve(('/skills/' + skill.name) as any)}>{skill.name}</a> — {skill.title}
		</li>
	{/each}
</ul>
