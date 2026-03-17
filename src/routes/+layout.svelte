<script lang="ts">
	import '$routes/fuz.css';
	import '@fuzdev/fuz_code/theme.css';
	import '$routes/style.css';

	import ThemeRoot from '@fuzdev/fuz_ui/ThemeRoot.svelte';
	import {library_context, Library} from '@fuzdev/fuz_ui/library.svelte.js';
	import {blog_feed_context} from '@fuzdev/fuz_blog/blog.js';
	import type {Snippet} from 'svelte';

	import {library_json} from '$routes/library.ts';
	import {feed} from '$routes/blog/feed.ts';

	const {
		children,
	}: {
		children: Snippet;
	} = $props();

	library_context.set(new Library(library_json, '/fuz_docs'));
	blog_feed_context.set(feed);
</script>

<svelte:head>
	<title>@fuzdev/fuz_docs</title>
	<link rel="alternate" type="application/atom+xml" title="Atom" href={feed.atom.feed_url} />
</svelte:head>

<ThemeRoot>
	{@render children()}
</ThemeRoot>
