<script lang="ts">
	import {resolve} from '$app/paths';
	import Code from '@fuzdev/fuz_code/Code.svelte';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';

	const tome = get_tome_by_name('grimoire');
</script>

<TomeContent {tome}>
	<TomeSection>
		<TomeSectionHeader text="Overview" />
		<p>
			Units of work often cut across repos — a type change ripples through three packages, a new
			feature needs coordinated planning in four. A grimoire gives those units a home without
			polluting implementation repos with planning artifacts. It's a markdown meta-repo that holds
			working understanding: what was decided and why, what's next, what connects to what.
		</p>
		<p>
			For AI agents, a grimoire is persistent memory across stateless sessions. Each agent arrives
			fresh, reads the grimoire to orient, does work, and updates it before the session ends. The
			grimoire bridges what one session learned to the next.
		</p>
		<p>
			The full skill documentation is at
			<a href={resolve('/skills/grimoire' as any)}><code>skills/grimoire</code></a>.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Structure" />
		<p>Three core primitives, plus supporting layers that emerge as the grimoire grows:</p>
		<table>
			<thead>
				<tr><th>Primitive</th><th>Location</th><th>Purpose</th></tr>
			</thead>
			<tbody>
				<tr
					><td>Lore</td><td><code>lore/&#123;project&#125;/</code></td><td
						>Per-repo planning projections — decisions, TODOs, cross-cutting concerns. Standard
						pair: <code>CLAUDE.md</code> + <code>TODO.md</code></td
					></tr
				>
				<tr
					><td>Quests</td><td><code>quests/</code></td><td
						>Cross-repo goals with dependencies and completion criteria. Single-repo work stays in
						lore TODOs</td
					></tr
				>
				<tr
					><td>Skills</td><td><code>skills/&#123;name&#125;/</code></td><td
						><a href="https://agentskills.io/">Agent skill</a> knowledge files — conventions, references,
						and tooling scripts</td
					></tr
				>
			</tbody>
		</table>
		<Code
			content={`grimoire/
├── lore/           # per-repo planning projections
│   └── {project}/
│       ├── CLAUDE.md    # planning context, decisions
│       └── TODO.md      # active work items
├── quests/         # cross-repo goals
│   ├── CLAUDE.md        # quest index
│   └── {slug}.md        # individual quests
├── skills/         # agent knowledge modules
│   └── {name}/
│       └── SKILL.md
└── writing/        # philosophy and vision (not repo-scoped)`}
		/>
		<p>
			<code>writing/</code> holds ideas that span the whole ecosystem rather than projecting a
			single repo — design philosophies, conceptual foundations. Supporting directories like
			<code>scripts/</code> and <code>scries/</code> for experimental linting may emerge from need;
			a new grimoire starts with just <code>lore/</code> and grows.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Work loop" />
		<p>
			Each agent session reads the grimoire to orient, does the work, then writes back what changed.
		</p>
		<table>
			<thead>
				<tr><th>Phase</th><th>Action</th></tr>
			</thead>
			<tbody>
				<tr
					><td>Orient</td><td
						>Read <code>lore/&#123;project&#125;/</code> for planning context and TODOs. Check
						<code>quests/</code> for cross-repo goals touching this project. Read the repo's own
						<code>CLAUDE.md</code> for implementation context.</td
					></tr
				>
				<tr><td>Work</td><td>Do the implementation work in the target repo.</td></tr>
				<tr
					><td>Update</td><td
						>Update <code>TODO.md</code> for work items. Check off quest tasks. Update
						<code>CLAUDE.md</code> if decisions changed.</td
					></tr
				>
				<tr
					><td>Graduate</td><td
						>Should content advance? Done quests synthesize into lore, then get deleted. Ideas that
						matured into code get removed from TODOs.</td
					></tr
				>
			</tbody>
		</table>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Knowledge lifecycle" />
		<p>
			Content flows forward through stages and gets deleted from earlier ones when it graduates —
			existing in one place at a time, wherever it's most useful right now.
		</p>
		<Code
			content={`lore → quest → implementation → published → lore
 (ideas)  (goals)    (code)        (docs)     (new understanding)`}
		/>
		<p>
			The cycle turns at different speeds — ideas accumulate slowly in lore, quests can move fast
			through implementation — but content should exist in one place at a time, wherever it's most
			useful right now.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Key ideas" />
		<p>
			<strong>Taste.</strong> A grimoire encodes a developer's preferences — which patterns are
			valued, which tradeoffs are preferred, what "good" looks like. This is what makes a grimoire
			<em>yours</em> rather than generic documentation. Agents can apply taste fluidly rather than following
			rigid rules.
		</p>
		<p>
			<strong>Always slightly wrong.</strong> A grimoire is approximate context, not ground truth. It's
			trying to capture dimensions of a person's entire body of work — too large for any document to represent
			faithfully. When current state matters, read the actual repo. Past a certain threshold of staleness,
			a doc misleads more than it helps.
		</p>
		<p>
			<strong>Rewrite, don't just prune.</strong> Conceptual staleness — content whose framing no
			longer matches reality — is more dangerous than old files. A lore doc untouched for months can
			still be accurate; a freshly-written TODO that assumes yesterday's architecture misleads
			immediately. Delete what's dead, rewrite what's drifted. The grimoire stays useful by staying
			<em>accurate</em>, not just lean.
		</p>
		<p>
			<strong>Growth trajectory.</strong> A grimoire starts small — one <code>CLAUDE.md</code>, a
			couple of <code>TODO.md</code> files. Quests appear when work first spans multiple repos. Writing
			appears when ideas emerge that don't project any single repo. Don't build structure speculatively.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="More" />
		<p>
			For full conventions — lore structure, quest format, creating new artifacts, common pitfalls —
			see the
			<a href={resolve('/skills/grimoire' as any)}>grimoire skill</a>. For coding conventions across
			the <code>@fuzdev</code> ecosystem, see <TomeLink name="fuz-stack" />.
		</p>
	</TomeSection>
</TomeContent>
