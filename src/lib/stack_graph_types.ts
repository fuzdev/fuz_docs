/**
 * Hand-written types for the public `@fuzdev` stack dependency graph.
 *
 * The generated `stack_graph.ts` (under `src/routes/docs/stack/`) re-exports
 * these and provides the baked `stack_nodes` / `stack_edges` data. The pure
 * layout in `stack_layout.ts` produces the positioned `StackNode`s.
 *
 * @module
 */

/** Editorial grouping of a stack repo, hardcoded by the generator (not from any manifest). */
export type StackCategory =
	'foundation' | 'build' | 'styling' | 'ui' | 'fullstack' | 'tooling' | 'app' | 'site';

/** Primary implementation language of a stack repo. */
export type StackLanguage = 'ts' | 'wasm' | 'rust';

/** Which dependency block an edge came from. */
export type StackEdgeKind = 'prod' | 'peer' | 'dev';

/** A positioned node in the stack dependency graph. */
export interface StackNode {
	/** Short repo/display name, e.g. `fuz_util`, `fuz.dev`. */
	name: string;
	category: StackCategory;
	language: StackLanguage;
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
export interface StackEdge {
	/** Dependent (the one that depends). */
	from: string;
	/** Dependency (the one depended upon). */
	to: string;
	kind: StackEdgeKind;
}
