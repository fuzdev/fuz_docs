import type {Tome} from '@fuzdev/fuz_ui/tome.js';
import ApiPage from '$routes/docs/api/+page.svelte';
import FuzStackPage from '$routes/docs/fuz-stack/+page.svelte';
import GrimoirePage from '$routes/docs/grimoire/+page.svelte';
import IntroductionPage from '$routes/docs/introduction/+page.svelte';
import LibraryPage from '$routes/docs/library/+page.svelte';
import StackPage from '$routes/docs/stack/+page.svelte';

export const tomes: Array<Tome> = [
	{
		name: 'introduction',
		category: 'guide',
		Component: IntroductionPage,
		related_tomes: ['fuz-stack', 'grimoire', 'stack'],
		related_modules: [],
		related_declarations: [],
	},
	{
		name: 'fuz-stack',
		category: 'skills',
		Component: FuzStackPage,
		related_tomes: ['stack'],
		related_modules: [],
		related_declarations: [],
	},
	{
		name: 'grimoire',
		category: 'skills',
		Component: GrimoirePage,
		related_tomes: ['fuz-stack'],
		related_modules: [],
		related_declarations: [],
	},
	{
		name: 'stack',
		category: 'reference',
		Component: StackPage,
		related_tomes: ['api', 'library'],
		related_modules: [],
		related_declarations: [],
	},
	{
		name: 'api',
		category: 'reference',
		Component: ApiPage,
		related_tomes: ['stack', 'library'],
		related_modules: [],
		related_declarations: [],
	},
	{
		name: 'library',
		category: 'reference',
		Component: LibraryPage,
		related_tomes: ['api', 'stack'],
		related_modules: [],
		related_declarations: [],
	},
];
