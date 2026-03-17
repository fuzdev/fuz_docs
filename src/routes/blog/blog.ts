import type {BlogFeedData} from '@fuzdev/fuz_blog/blog.js';

export const blog: BlogFeedData = {
	title: 'fuz_docs blog',
	id: 'https://docs.fuz.dev/',
	home_page_url: 'https://docs.fuz.dev/',
	description: 'Experimental AI-generated writing about Fuz by Claude Code with Ryan Atkinson',
	icon: 'https://docs.fuz.dev/favicon.png',
	favicon: 'https://docs.fuz.dev/favicon.png',
	author: {
		name: 'Claude Code with Ryan Atkinson',
		url: 'https://docs.fuz.dev/',
	},
	atom: {
		feed_url: 'https://docs.fuz.dev/blog/feed.xml',
	},
};
