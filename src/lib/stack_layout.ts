import type {StackEdge, StackEdgeKind, StackNode} from './stack_graph_types.ts';

/**
 * Pure, deterministic layout for the public `@fuzdev` stack dependency graph.
 *
 * `compute_stack_layout` takes raw nodes (name/category/language/description)
 * plus the full edge list and bakes in `layer`, `fan_in`, and world-space
 * `x`/`y` coordinates. No randomness — running it twice on the same input
 * yields byte-identical output, which keeps the generated `stack_graph.ts`
 * stable across `gro gen` runs.
 *
 * @module
 */

/** Vertical spacing between adjacent layers. */
export const ROW_GAP = 120;

/** Horizontal spacing between adjacent nodes within a layer. */
export const COL_GAP = 150;

/** Number of barycenter sweeps used to reduce edge crossings. */
const SWEEP_COUNT = 4;

/** Raw node input to `compute_stack_layout` — the positioned fields are filled in by the layout. */
export type StackNodeInput = Omit<StackNode, 'layer' | 'fan_in' | 'x' | 'y'>;

/** Structural (load-bearing) edge kinds that define the real dependency skeleton. */
const STRUCTURAL_KINDS: ReadonlySet<StackEdgeKind> = new Set<StackEdgeKind>(['prod', 'peer']);

/**
 * Computes baked layout positions for the stack graph.
 *
 * The full `edges` list is used only to derive the layering; the emitted edge
 * list is owned by the caller (the generator emits every edge, including the
 * `dev` ones this layout cuts).
 *
 * @param nodes - raw nodes keyed by `name`
 * @param edges - every dependency edge (`prod`, `peer`, and `dev`)
 * @returns positioned nodes sorted by `name`, with `layer`, `fan_in`, `x`, `y` filled in
 */
export const compute_stack_layout = (
	nodes: ReadonlyArray<StackNodeInput>,
	edges: ReadonlyArray<StackEdge>,
): Array<StackNode> => {
	// sorted, de-duped node names for fully deterministic iteration order
	const names = [...new Set(nodes.map((n) => n.name))].sort();
	const name_set = new Set(names);

	// 1. structural skeleton: reachability + longest-path depth over prod/peer edges only
	const reaches_structurally = build_structural_reachability(names, edges, name_set);
	const structural_layer = compute_layers(names, build_structural_out(names, edges, name_set));

	// 2. cut graph: orient `dev` edges so they never fight the structural skeleton
	const cut_edges: Array<StackEdge> = [];
	for (const edge of edges) {
		if (!name_set.has(edge.from) || !name_set.has(edge.to) || edge.from === edge.to) continue;
		if (edge.kind === 'dev') {
			// (a) B already structurally reaches A -> A->B is a mutual-tooling back-edge; drop it
			if (reaches_structurally(edge.to, edge.from)) continue;
			// (b) no structural relation either way -> a pure dev tangle (e.g. a tool/app that
			// dev-depends on a library, and vice versa). Orient by structural depth so the
			// structural-leaf consumer floats *above* the deeper library it builds on, rather
			// than letting an arbitrary cycle-break sink it. Keep exactly one direction.
			if (!reaches_structurally(edge.from, edge.to)) {
				const from_depth = structural_layer.get(edge.from)!;
				const to_depth = structural_layer.get(edge.to)!;
				const keep = from_depth < to_depth || (from_depth === to_depth && edge.from < edge.to);
				if (!keep) continue;
			}
			// (c) A structurally reaches B -> the dev edge agrees with the skeleton; keep it
		}
		cut_edges.push(edge);
	}

	// 3. residual cycle safety: deterministic DFS, drop any edge to a node on the stack
	const acyclic_out = break_residual_cycles(names, cut_edges);

	// 4. layering: longest path to a sink over the acyclic cut graph
	const layer_of = compute_layers(names, acyclic_out);

	// 5. fan_in: distinct in-degree over the cut graph
	const fan_in_of = compute_fan_in(names, acyclic_out);

	// 6/7. positions
	const max_layer = names.reduce((max, name) => Math.max(max, layer_of.get(name)!), 0);
	const x_of = compute_x_positions(names, acyclic_out, layer_of, max_layer);

	const by_name = new Map(nodes.map((n) => [n.name, n]));
	return names.map((name) => {
		const raw = by_name.get(name)!;
		const layer = layer_of.get(name)!;
		return {
			...raw,
			layer,
			fan_in: fan_in_of.get(name)!,
			x: x_of.get(name)!,
			// layer 0 (foundations) gets the largest y (bottom); top layer gets y=0
			y: (max_layer - layer) * ROW_GAP,
		};
	});
};

/**
 * Builds a `reaches_structurally(b, a)` predicate: is there a path `b -> … -> a`
 * using only structural (`prod`/`peer`) edges. Computed via a transitive-closure
 * over reverse-reachability so each lookup is O(1).
 */
const build_structural_reachability = (
	names: ReadonlyArray<string>,
	edges: ReadonlyArray<StackEdge>,
	name_set: ReadonlySet<string>,
): ((from: string, to: string) => boolean) => {
	// structural adjacency: from -> set of direct structural deps
	const adj = new Map<string, Set<string>>();
	for (const name of names) adj.set(name, new Set());
	for (const edge of edges) {
		if (!STRUCTURAL_KINDS.has(edge.kind)) continue;
		if (!name_set.has(edge.from) || !name_set.has(edge.to) || edge.from === edge.to) continue;
		adj.get(edge.from)!.add(edge.to);
	}

	// transitive closure: reachable.get(from) = all nodes reachable from `from`
	const reachable = new Map<string, Set<string>>();
	for (const start of names) {
		const seen = new Set<string>();
		const stack = [...adj.get(start)!].sort();
		while (stack.length > 0) {
			const node = stack.pop()!;
			if (seen.has(node)) continue;
			seen.add(node);
			for (const next of [...adj.get(node)!].sort()) {
				if (!seen.has(next)) stack.push(next);
			}
		}
		reachable.set(start, seen);
	}

	return (from, to) => reachable.get(from)?.has(to) ?? false;
};

/** Structural-only out-adjacency (`name -> sorted prod/peer deps`), used for structural depth. */
const build_structural_out = (
	names: ReadonlyArray<string>,
	edges: ReadonlyArray<StackEdge>,
	name_set: ReadonlySet<string>,
): Map<string, Array<string>> => {
	const out = new Map<string, Array<string>>();
	for (const name of names) out.set(name, []);
	const seen_pair = new Set<string>();
	for (const edge of edges) {
		if (!STRUCTURAL_KINDS.has(edge.kind)) continue;
		if (!name_set.has(edge.from) || !name_set.has(edge.to) || edge.from === edge.to) continue;
		const key = edge.from + '\0' + edge.to;
		if (seen_pair.has(key)) continue;
		seen_pair.add(key);
		out.get(edge.from)!.push(edge.to);
	}
	for (const list of out.values()) list.sort();
	return out;
};

/**
 * Removes any residual cycles from the cut graph with a deterministic DFS,
 * dropping each edge that points to a node currently on the recursion stack
 * (a back-edge). Returns adjacency `name -> sorted out-neighbors`.
 */
const break_residual_cycles = (
	names: ReadonlyArray<string>,
	cut_edges: ReadonlyArray<StackEdge>,
): Map<string, Array<string>> => {
	// de-dupe out-neighbors, sorted for determinism
	const raw_adj = new Map<string, Array<string>>();
	for (const name of names) raw_adj.set(name, []);
	const seen_pair = new Set<string>();
	for (const edge of cut_edges) {
		const key = edge.from + '\0' + edge.to;
		if (seen_pair.has(key)) continue;
		seen_pair.add(key);
		raw_adj.get(edge.from)!.push(edge.to);
	}
	for (const list of raw_adj.values()) list.sort();

	const out = new Map<string, Array<string>>();
	for (const name of names) out.set(name, []);

	const WHITE = 0;
	const GRAY = 1; // on the current DFS stack
	const BLACK = 2; // fully explored
	const color = new Map<string, number>();
	for (const name of names) color.set(name, WHITE);

	// iterative DFS to avoid stack overflow and guarantee termination
	const visit = (root: string): void => {
		// frame: node + index into its sorted neighbor list
		const stack: Array<{node: string; i: number}> = [{node: root, i: 0}];
		color.set(root, GRAY);
		while (stack.length > 0) {
			const frame = stack[stack.length - 1]!;
			const neighbors = raw_adj.get(frame.node)!;
			if (frame.i >= neighbors.length) {
				color.set(frame.node, BLACK);
				stack.pop();
				continue;
			}
			const next = neighbors[frame.i]!;
			frame.i++;
			const c = color.get(next)!;
			if (c === GRAY) continue; // back-edge -> drop it (do not add to `out`)
			// keep the edge
			out.get(frame.node)!.push(next);
			if (c === WHITE) {
				color.set(next, GRAY);
				stack.push({node: next, i: 0});
			}
		}
	};

	for (const name of names) {
		if (color.get(name) === WHITE) visit(name);
	}
	return out;
};

/**
 * Longest-path-to-a-sink layering over the acyclic cut graph.
 * `layer(n) = 0` when `n` has no out-edges, else `1 + max(layer(dep))`.
 */
const compute_layers = (
	names: ReadonlyArray<string>,
	out: ReadonlyMap<string, Array<string>>,
): Map<string, number> => {
	const memo = new Map<string, number>();
	const visiting = new Set<string>();
	const compute = (name: string): number => {
		const cached = memo.get(name);
		if (cached !== undefined) return cached;
		// cycle guard: a back-edge to a node already on the recursion stack contributes 0.
		// the cut graph is acyclic, so this only fires on pathological input (and on the raw
		// structural graph, whose longest-path depth is used for dev-edge orientation).
		if (visiting.has(name)) return 0;
		visiting.add(name);
		const deps = out.get(name)!;
		let layer = 0;
		if (deps.length > 0) {
			let max = -1;
			for (const dep of deps) max = Math.max(max, compute(dep));
			layer = max + 1;
		}
		visiting.delete(name);
		memo.set(name, layer);
		return layer;
	};
	for (const name of names) compute(name);
	return memo;
};

/** Distinct in-degree over the cut graph: how many nodes point at each node. */
const compute_fan_in = (
	names: ReadonlyArray<string>,
	out: ReadonlyMap<string, Array<string>>,
): Map<string, number> => {
	const incoming = new Map<string, Set<string>>();
	for (const name of names) incoming.set(name, new Set());
	for (const from of names) {
		for (const to of out.get(from)!) incoming.get(to)!.add(from);
	}
	const fan_in = new Map<string, number>();
	for (const name of names) fan_in.set(name, incoming.get(name)!.size);
	return fan_in;
};

/**
 * Barycenter-ordered x positions. Groups nodes by layer (alphabetical init),
 * runs alternating sweeps that reorder each layer by the mean order-index of
 * its neighbors in the adjacent layer, then centers each layer at `x = 0`.
 */
const compute_x_positions = (
	names: ReadonlyArray<string>,
	out: ReadonlyMap<string, Array<string>>,
	layer_of: ReadonlyMap<string, number>,
	max_layer: number,
): Map<string, number> => {
	// nodes grouped by layer, each layer initialized alphabetically
	const layers: Array<Array<string>> = [];
	for (let l = 0; l <= max_layer; l++) layers.push([]);
	for (const name of names) layers[layer_of.get(name)!]!.push(name);
	for (const layer of layers) layer.sort();

	// adjacency between a node and the layer directly above (layer+1) and below (layer-1).
	// an out-edge from->to has layer(from) > layer(to), so `to` sits below `from`.
	// neighbors_above(n) = nodes in layer+1 that depend on n (incoming from above)
	// neighbors_below(n) = nodes in layer-1 that n depends on (its out-edges into the lower layer)
	const above = new Map<string, Array<string>>(); // n -> dependents one layer up
	const below = new Map<string, Array<string>>(); // n -> deps one layer down
	for (const name of names) {
		above.set(name, []);
		below.set(name, []);
	}
	for (const from of names) {
		const from_layer = layer_of.get(from)!;
		for (const to of out.get(from)!) {
			// eslint-disable-next-line @typescript-eslint/no-confusing-non-null-assertion
			if (layer_of.get(to)! === from_layer - 1) {
				below.get(from)!.push(to);
				above.get(to)!.push(from);
			}
		}
	}

	const index_in_layer = (): Map<string, number> => {
		const idx = new Map<string, number>();
		for (const layer of layers) {
			for (let i = 0; i < layer.length; i++) idx.set(layer[i]!, i);
		}
		return idx;
	};

	const reorder = (
		layer: Array<string>,
		neighbors: ReadonlyMap<string, Array<string>>,
		idx: ReadonlyMap<string, number>,
	): void => {
		const bary = new Map<string, number>();
		for (let i = 0; i < layer.length; i++) {
			const node = layer[i]!;
			const ns = neighbors.get(node)!;
			let mean: number;
			if (ns.length === 0) {
				mean = i; // no neighbors: keep current position as a stable tiebreaker
			} else {
				let sum = 0;
				for (const n of ns) sum += idx.get(n)!;
				mean = sum / ns.length;
			}
			bary.set(node, mean);
		}
		// stable sort by barycenter, then by name for full determinism
		layer.sort((a, b) => bary.get(a)! - bary.get(b)! || a.localeCompare(b));
	};

	for (let sweep = 0; sweep < SWEEP_COUNT; sweep++) {
		if (sweep % 2 === 0) {
			// downward sweep: order each layer (top->bottom) by neighbors in the layer above
			const idx = index_in_layer();
			for (let l = max_layer; l >= 0; l--) reorder(layers[l]!, above, idx);
		} else {
			// upward sweep: order each layer (bottom->top) by neighbors in the layer below
			const idx = index_in_layer();
			for (let l = 0; l <= max_layer; l++) reorder(layers[l]!, below, idx);
		}
	}

	const x_of = new Map<string, number>();
	for (const layer of layers) {
		const count = layer.length;
		for (let i = 0; i < count; i++) {
			x_of.set(layer[i]!, (i - (count - 1) / 2) * COL_GAP);
		}
	}
	return x_of;
};
