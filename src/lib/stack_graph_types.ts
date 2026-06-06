/**
 * Hand-written types for the public `@fuzdev` stack dependency graph.
 *
 * The generated `stack_graph.ts` (under `src/routes/docs/stack/`) re-exports
 * these and provides the baked `stack_nodes` / `stack_edges` data. The pure
 * layout in `stack_layout.ts` produces the positioned `Stack_Node`s.
 *
 * @module
 */

/** Editorial grouping of a stack repo, hardcoded by the generator (not from any manifest). */
export type Stack_Category =
	| 'foundation'
	| 'build'
	| 'styling'
	| 'ui'
	| 'fullstack'
	| 'tooling'
	| 'app'
	| 'site';

/** Primary implementation language of a stack repo. */
export type Stack_Language = 'ts' | 'wasm' | 'rust';

/** Which dependency block an edge came from. */
export type Stack_Edge_Kind = 'prod' | 'peer' | 'dev';

/** A positioned node in the stack dependency graph. */
export interface Stack_Node {
	/** Short repo/display name, e.g. `fuz_util`, `fuz.dev`. */
	name: string;
	category: Stack_Category;
	language: Stack_Language;
	/** From the manifest `description` field; empty string if none. */
	description: string;
	/** Dependency depth from the cut graph: 0 = foundation (bottom). */
	layer: number;
	/** Number of nodes that depend on this one (in-degree over the cut graph); drives node size. */
	fan_in: number;
	/** Baked world-space layout coords. y grows downward (SVG); foundations have the largest y. */
	x: number;
	y: number;
}

/** A directed dependency edge between two stack nodes. */
export interface Stack_Edge {
	/** Dependent (the one that depends). */
	from: string;
	/** Dependency (the one depended upon). */
	to: string;
	kind: Stack_Edge_Kind;
}
