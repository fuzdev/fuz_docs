<script lang="ts">
	import {resolve} from '$app/paths';

	import {tools} from './tools_manifest.js';
</script>

<h1>Tools</h1>
<p>Interactive browser-based utilities.</p>
<ul>
	{#each tools as tool (tool.name)}
		<li>
			<a href={resolve(('/tools/' + tool.name) as any)}>{tool.name}</a> — {tool.title}
		</li>
	{/each}
</ul>
