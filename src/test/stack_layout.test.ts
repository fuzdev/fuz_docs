import {describe, test, assert} from 'vitest';

import {compute_stack_layout, ROW_GAP, type StackNodeInput} from '$lib/stack_layout.js';
import type {StackEdge} from '$lib/stack_graph_types.js';

const node = (name: string): StackNodeInput => ({
	name,
	category: 'foundation',
	language: 'ts',
	description: '',
});

const find = (nodes: ReturnType<typeof compute_stack_layout>, name: string) => {
	const found = nodes.find((n) => n.name === name);
	assert.ok(found, `expected node ${name}`);
	return found;
};

describe('compute_stack_layout', () => {
	test('cuts the dev back-edge of a mutual-tooling cycle and keeps the peer edge', () => {
		// util depends on tool via dev (util -> tool dev), tool depends on util via peer (tool -> util peer).
		// the dev back-edge util->tool must be cut (tool structurally reaches util), so tool lands above util.
		const nodes = [node('util'), node('tool')];
		const edges: Array<StackEdge> = [
			{from: 'util', to: 'tool', kind: 'dev'},
			{from: 'tool', to: 'util', kind: 'peer'},
		];
		const result = compute_stack_layout(nodes, edges);
		const util = find(result, 'util');
		const tool = find(result, 'tool');
		// peer edge tool->util kept (tool depends on util), dev back-edge cut -> tool is higher
		assert.ok(
			tool.layer > util.layer,
			`expected tool.layer (${tool.layer}) > util.layer (${util.layer})`,
		);
		assert.equal(util.layer, 0);
	});

	test('lifts a pure consumer above the lib it only devDeps', () => {
		// chain: ui -> css -> util (structural), giving ui layer 2.
		// app -> ui is dev-only, no edge ui->app, so app is a pure consumer and lands above ui.
		const nodes = [node('util'), node('css'), node('ui'), node('app')];
		const edges: Array<StackEdge> = [
			{from: 'css', to: 'util', kind: 'peer'},
			{from: 'ui', to: 'css', kind: 'peer'},
			{from: 'app', to: 'ui', kind: 'dev'},
		];
		const result = compute_stack_layout(nodes, edges);
		const ui = find(result, 'ui');
		const app = find(result, 'app');
		assert.ok(ui.layer >= 2, `expected ui.layer >= 2, got ${ui.layer}`);
		assert.ok(app.layer > ui.layer, `expected app.layer (${app.layer}) > ui.layer (${ui.layer})`);
	});

	test('floats a structural-leaf tool above a lib they mutually devDep', () => {
		// chain: lib -> found (structural), so lib has structural depth 1.
		// tool has no structural deps (depth 0) and mutually dev-deps lib (tool<->lib).
		// the tangle must orient by structural depth: the leaf consumer `tool` floats above `lib`,
		// not sink to the bottom on an arbitrary cycle-break.
		const nodes = [node('found'), node('lib'), node('tool')];
		const edges: Array<StackEdge> = [
			{from: 'lib', to: 'found', kind: 'peer'},
			{from: 'tool', to: 'lib', kind: 'dev'},
			{from: 'lib', to: 'tool', kind: 'dev'},
		];
		const result = compute_stack_layout(nodes, edges);
		const lib = find(result, 'lib');
		const tool = find(result, 'tool');
		assert.ok(
			tool.layer > lib.layer,
			`expected tool.layer (${tool.layer}) > lib.layer (${lib.layer})`,
		);
		// the lib->tool dev edge was dropped, so tool is not counted as a dependency of lib
		assert.equal(find(result, 'found').layer, 0);
	});

	test('a foundation with no out-edges is layer 0 with the largest y', () => {
		const nodes = [node('util'), node('css'), node('app')];
		const edges: Array<StackEdge> = [
			{from: 'css', to: 'util', kind: 'peer'},
			{from: 'app', to: 'css', kind: 'peer'},
		];
		const result = compute_stack_layout(nodes, edges);
		const util = find(result, 'util');
		assert.equal(util.layer, 0);
		// foundation sits at the bottom (largest y)
		const max_y = Math.max(...result.map((n) => n.y));
		assert.equal(util.y, max_y);
		// with 3 layers (0,1,2) the foundation y is (max_layer - 0) * ROW_GAP
		assert.equal(util.y, 2 * ROW_GAP);
		// the top consumer is at y = 0
		assert.equal(find(result, 'app').y, 0);
	});

	test('fan_in counts distinct dependents over the cut graph', () => {
		// util is depended on by css, ui, and app -> fan_in 3
		const nodes = [node('util'), node('css'), node('ui'), node('app')];
		const edges: Array<StackEdge> = [
			{from: 'css', to: 'util', kind: 'peer'},
			{from: 'ui', to: 'util', kind: 'peer'},
			{from: 'app', to: 'util', kind: 'dev'},
		];
		const result = compute_stack_layout(nodes, edges);
		assert.equal(find(result, 'util').fan_in, 3);
		assert.equal(find(result, 'css').fan_in, 0);
	});

	test('is deterministic: identical output on repeated runs', () => {
		const nodes = [node('util'), node('css'), node('ui'), node('app'), node('tool')];
		const edges: Array<StackEdge> = [
			{from: 'css', to: 'util', kind: 'peer'},
			{from: 'ui', to: 'css', kind: 'peer'},
			{from: 'ui', to: 'util', kind: 'peer'},
			{from: 'app', to: 'ui', kind: 'dev'},
			{from: 'util', to: 'tool', kind: 'dev'},
			{from: 'tool', to: 'util', kind: 'peer'},
		];
		const a = compute_stack_layout(nodes, edges);
		const b = compute_stack_layout(nodes, edges);
		assert.deepEqual(a, b);
	});

	test('terminates and stays acyclic even with a residual cycle of structural edges', () => {
		// a pathological pure-structural cycle a->b->c->a; the residual-cycle DFS must
		// drop one back-edge and terminate rather than loop forever.
		const nodes = [node('a'), node('b'), node('c')];
		const edges: Array<StackEdge> = [
			{from: 'a', to: 'b', kind: 'peer'},
			{from: 'b', to: 'c', kind: 'peer'},
			{from: 'c', to: 'a', kind: 'peer'},
		];
		const result = compute_stack_layout(nodes, edges);
		// all three nodes positioned, finite layers
		assert.equal(result.length, 3);
		for (const n of result) {
			assert.ok(Number.isFinite(n.layer));
			assert.ok(Number.isFinite(n.x));
			assert.ok(Number.isFinite(n.y));
		}
	});
});
