<script lang="ts">
	import {resolve} from '$app/paths';
	import Code from '@fuzdev/fuz_code/Code.svelte';
	import TomeContent from '@fuzdev/fuz_ui/TomeContent.svelte';
	import TomeSection from '@fuzdev/fuz_ui/TomeSection.svelte';
	import TomeLink from '@fuzdev/fuz_ui/TomeLink.svelte';
	import TomeSectionHeader from '@fuzdev/fuz_ui/TomeSectionHeader.svelte';
	import {get_tome_by_name} from '@fuzdev/fuz_ui/tome.js';

	import {skills} from '$routes/skills/skills_manifest.js';

	const tome = get_tome_by_name('fuz-stack');

	const fuz_stack = skills.find((s) => s.name === 'fuz-stack')!;

	const reference_descriptions: Record<string, string> = {
		'async-patterns': 'Concurrency primitives — semaphore, deferred, concurrent map/each',
		'code-generation': 'Gro gen system — .gen.* files, dependencies, output formats',
		'common-utilities': 'Result type, Logger, Timings, DAG execution',
		'css-patterns': 'fuz_css styling — variables, utility classes, modifiers, extraction',
		'dependency-injection': 'Injectable *Deps interfaces, mock factories, composition patterns',
		'svelte-patterns': 'Svelte 5 runes, contexts, snippets, attachments, Cell pattern',
		'task-patterns': 'Gro task system — .task.ts files, TaskContext, error handling',
		'testing-patterns': 'Vitest patterns, fixtures, mocks, assertion helpers',
		'tsdoc-comments': 'TSDoc style guide — tags, conventions, auditing',
		'type-utilities': 'Nominal typing (Flavored/Branded), strict utility types',
		'documentation-system': 'Docs pipeline — Tome system, layout architecture, project setup',
		'zod-schemas': 'Zod conventions — strictObject, branded types, introspection',
		'rust-conventions':
			'Shared Rust patterns — edition 2024, unsafe forbid, lints, crate structure',
		'wasm-patterns': 'WASM build targets — wasm-bindgen, component model, JS interop',
	};
</script>

<TomeContent {tome}>
	<TomeSection>
		<TomeSectionHeader text="Overview" />
		<p>
			Coding conventions and patterns for the <code>@fuzdev</code> TypeScript and Svelte 5 ecosystem.
			These conventions keep agent-assisted development consistent across ~20 repos — from naming and
			file organization to error handling, testing, and validation patterns.
		</p>
		<p>
			This content is AI-generated and mostly poorly reviewed. Not all patterns described here are
			endorsed, and some may be out of date or incorrect.
		</p>
		<p>
			The full skill documentation is at
			<a href={resolve('/skills/fuz-stack' as any)}><code>skills/fuz-stack</code></a>.
		</p>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Conventions" />
		<table>
			<thead>
				<tr><th>Area</th><th>Convention</th></tr>
			</thead>
			<tbody>
				<tr
					><td>Naming</td><td
						>snake_case functions/variables, PascalCase types/components, SCREAMING_SNAKE_CASE
						constants</td
					></tr
				>
				<tr
					><td>File organization</td><td
						><code>src/lib/</code> for library code, <code>src/test/</code> for tests (not
						co-located), <code>src/routes/</code> for SvelteKit</td
					></tr
				>
				<tr
					><td>Imports</td><td
						>Always include <code>.js</code> extension, import directly from source module (no re-exports)</td
					></tr
				>
				<tr><td>Formatting</td><td>Prettier with tabs, 100 char width</td></tr>
				<tr
					><td>Breaking changes</td><td>Acceptable — delete unused code, don't shim or alias</td
					></tr
				>
				<tr
					><td>Flat namespace</td><td
						>All exported identifiers unique across all modules; <code>gro gen</code> enforces</td
					></tr
				>
				<tr
					><td>Build</td><td
						><code>gro check</code> runs typecheck + test + gen --check + format --check + lint</td
					></tr
				>
			</tbody>
		</table>
		<Code
			lang="ts"
			content={`// snake_case functions — domain-prefix when bare name would be ambiguous
function git_push() {}  // git_* cluster, "push" alone is ambiguous
function truncate() {}  // action-first, self-descriptive

// PascalCase types and components
type PackageJson = {};
// file: DocsLink.svelte

// .js extension in imports, even for .ts files
import {git_push} from './git.js';`}
		/>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Core patterns" />
		<p>
			Beyond surface conventions, several deeper patterns define how <code>@fuzdev</code> code is structured:
		</p>
		<table>
			<thead>
				<tr><th>Pattern</th><th>Convention</th></tr>
			</thead>
			<tbody>
				<tr
					><td>Error handling</td><td
						><code>Result&lt;TValue, TError&gt;</code> discriminated union — never throw for expected
						errors</td
					></tr
				>
				<tr
					><td>Dependency injection</td><td
						>Small <code>*Deps</code> interfaces for all I/O, plain object mocks — no mocking libraries</td
					></tr
				>
				<tr
					><td>Validation</td><td
						><code>z.strictObject()</code> by default, PascalCase schema naming,
						<code>.brand()</code> for nominal types</td
					></tr
				>
				<tr
					><td>Testing</td><td
						>Fixture-based testing for parsers — input files, generated
						<code>expected.json</code>, never manually edit</td
					></tr
				>
			</tbody>
		</table>
		<Code
			lang="ts"
			content={`// Result pattern — properties directly on the result object
function parse_config(text: string): Result<{value: Config}, {error: ParseError}> {
\treturn {ok: true, value: JSON.parse(text)};
}

// Deps pattern — small interfaces, no god types
export interface FsDeps {
\tread_file: (path: string) => Promise<string>;
\twrite_file: (path: string, content: string) => Promise<void>;
}`}
		/>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="References" />
		<p>{fuz_stack.references.length} detailed reference documents:</p>
		<table>
			<thead>
				<tr><th>Reference</th><th>Covers</th></tr>
			</thead>
			<tbody>
				{#each fuz_stack.references as ref (ref.slug)}
					<tr
						><td
							><a href={resolve(('/skills/fuz-stack/references/' + ref.slug) as any)}>{ref.title}</a
							></td
						><td>{reference_descriptions[ref.slug] ?? ''}</td></tr
					>
				{/each}
			</tbody>
		</table>
	</TomeSection>

	<TomeSection>
		<TomeSectionHeader text="Stack" />
		<pre>fuz_util → gro + fuz_css → fuz_ui → fuz_* apps</pre>
		<p>
			<code>gro</code> is a temporary build tool, to be replaced by <code>fuz</code> (Rust daemon +
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			CLI). See <TomeLink name="stack" /> for the full dependency graph and package details.
		</p>
		<p>
			For cross-repo coordination patterns — planning, TODOs, and multi-repo goals — see
			<TomeLink name="grimoire" />.
		</p>
	</TomeSection>
</TomeContent>
