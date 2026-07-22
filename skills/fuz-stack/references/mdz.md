---
description: mdz dialect — grammar surface, component registration, rendering seam, autolink, preprocessor
---

# mdz — Strict Markdown Dialect

`mdz` (`@fuzdev/mdz`) is the ecosystem's markdown dialect: a deliberately
small, unambiguous grammar aimed at devs and AI agents rather than end users.
An agent touches it in three places — **rendering TSDoc/JSDoc prose** on docs
sites (backticked identifiers linkify to API docs), **authoring `<Mdz>`
content** with embedded Svelte components, and **rendering streaming LLM
output**. One grammar, two parsers: a synchronous tree parser
(`mdz_parse(content)` → `Array<MdzNode>`, from `@fuzdev/mdz/mdz.ts`) and an
incremental streaming parser (`MdzStreamParser`, emits opcodes) for partial
input; the sync parser is the normative reference and parity tests bind them.

**It is a dialect, not a CommonMark/GFM superset.** The design axiom is _false
negatives over false positives_: ambiguous input stays literal text rather than
guessing markup. Do not assume a markdown feature works because GFM supports it
— check the surface below.

## Dialect surface

| Feature                | Syntax                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inline code            | `` `code` ``                                                                                                                                                                                                                                                                                                                                               |
| Bold / italic / strike | `**bold**`, `_italic_`, `~~strike~~` — `**`/`~~` doubled; italic is single `_` at word boundaries (single `*`/`~` and intraword `_` are literal)                                                                                                                                                                                                           |
| Links                  | auto-detected URLs, `/internal/path`, `./relative` and `../relative` (autolinked after whitespace), `[text](url)`                                                                                                                                                                                                                                          |
| Headings               | `# Heading` … `######` at **column 0**; gets a lowercase slugified `id` for fragment links                                                                                                                                                                                                                                                                 |
| Lists                  | `- item` / `1. item` at column 0; indent nests; blank lines contained; items hold block children (paragraphs, nested lists, code blocks, blockquotes, tables) on indented lines — the marker-line remainder is inline-only                                                                                                                                 |
| Blockquotes            | `> ` per line (**no lazy continuation**); nest with `>>` or `> > `; bare `>` is the in-quote paragraph break; a blank line ends the quote; content is a mini-document                                                                                                                                                                                      |
| Code blocks            | fenced with optional language hint; an unclosed fence consumes to EOF (or to the end of its blockquote)                                                                                                                                                                                                                                                    |
| Horizontal rule        | `---` alone on a line                                                                                                                                                                                                                                                                                                                                      |
| Tables                 | `\| a \| b \|` rows + a `\| --- \| :-: \|` delimiter row (colons set per-column alignment); leading **and** trailing `\|` required; inline-only cells (`` `code` `` protects pipes; `\|` is the one escape, a literal pipe); a header/delimiter column mismatch stays a paragraph                                                                          |
| Components / elements  | `<Alert status="error">…</Alert>` (component) / `<aside class="box">…</aside>` (HTML element) — **both must be registered**; `<br />` (registered) for a hard break. Attributes are quoted strings (`"`/`'`) or bare booleans (`<input disabled />`); **elements** filter to a closed inert allowlist, **components** pass all attributes through as props |
| Paragraphs / breaks    | blank line separates paragraphs; a single newline is a soft break (collapses to a space by default)                                                                                                                                                                                                                                                        |

**Whitespace**: text nodes preserve literal `\n`, but the default rendering
applies no `white-space` style, so single newlines collapse to spaces. The
`whitespace` prop on `Mdz`/`MdzStream`/`MdzPrecompiled` opts into `pre-line`
(every newline breaks — chat-style input) or `pre-wrap` (spaces/tabs preserved
too).

## Deliberately unsupported (scope notes)

The strictness is the point — these are omitted on purpose, so don't reach for
them:

- **No single-delimiter emphasis** — `*x*`, `_x_` intraword, `~x~` all stay
  literal. Intraword `_` is literal by design so `snake_case` identifiers render
  verbatim (a core reason the dialect exists).
- **Attribute values: strings + bare booleans only** — `<Alert status="warning">`
  and `<input disabled />` parse (attributes **are** supported), but brace-literal
  values (`count={5}`) are **reserved** and stay literal for now, and malformed
  forms bail the whole tag back to literal text: unquoted (`a=b`), spaces around
  `=` (`a = "b"`), a duplicate name, or a newline inside the open tag. Directives /
  namespaced / spread / `{shorthand}` can never parse (`:` and `{` aren't
  attribute-name/value chars). Enforcement is at render time: **elements** filter
  attributes to a closed inert allowlist (`class`, `title`, `lang`, `dir`, `role`,
  `aria-{label,hidden,describedby,labelledby}` — anything else is dropped);
  **components** pass all attributes through as props (registering a component is
  the trust decision). `MdzComponents` stays `Map<string, Component>` — props pass
  through untyped.
- **No CommonMark/GFM compatibility** — no setext headings, no reference links,
  no `*`-bullets or `+`-bullets (only `-`), no task lists.
- **No syntax highlighting, no themed components, no HTML sanitization** — only
  registered components/elements render; everything else is text. Rich rendering
  is injected (below), not built in.

## Rendering: plain by default, inject richer

mdz core renders inline code as `<code>` and code blocks as `<pre><code>` —
**plain elements**. Consumers inject richer renderers through getter-based
contexts in `@fuzdev/mdz/mdz_contexts.ts`, set via `MdzRoot` props or directly
with `mdz_set_context_with_fallback(context, () => Value)` (prefers the local
value, falls back to the ancestor's — ancestor captured once at init):

- `mdz_code_context` → a `Component<{reference: string}>` for inline `` `code` ``
- `mdz_codeblock_context` → a `Component<{lang, content}>` for code blocks
- `mdz_components_context` → the `<Alert>`-style component registry (a `Map`)
- `mdz_elements_context` → the allowed-HTML-element registry
- `mdz_base_context` → base path for resolving `./relative` links

The two code-prop contracts are shaped to match their canonical injections:
`mdz_code_context`'s `{reference}` matches fuz_ui's `DocsLink`, and
`mdz_codeblock_context`'s `{lang, content}` matches fuz_code's `Code`, so both
drop in directly. **mdz ships no default component registry** — every consumer
registers its own; an unregistered tag renders as a visible placeholder, not an
error.

## Backticked-identifier autolinking (TSDoc)

The autolink is the injection seam plus a lookup — there's no special "link"
syntax. When fuz_ui injects `DocsLink` as `mdz_code_context`, every inline
`` `code` `` span becomes a `DocsLink` whose `reference` is the span text.
`DocsLink` resolves it against the `Library` from `library_context`:
`declaration_by_name.get(reference)`, then `module_by_path.get(reference)` — a
hit renders a `DeclarationLink`/`ModuleLink`, a miss stays a plain `<code>`.
**Only real API symbols in the flat namespace resolve**; everything else is an
ordinary code span. This is why backticking identifiers in TSDoc "just works" on
docs sites and is inert elsewhere. (Separately, `mdz_from_tsdoc` in
`@fuzdev/mdz/tsdoc_mdz.ts` converts TSDoc `@see`/`{@link}` text into mdz strings
— a source bridge, not the autolinker.)

## Build-time preprocessor

`svelte_preprocess_mdz` (`@fuzdev/mdz/svelte_preprocess_mdz.ts`) compiles
**static** `<Mdz content="…">` usages — string literals and statically
resolvable ternary chains — into pre-rendered `<MdzPrecompiled>` markup at build
time, eliminating runtime parsing for known-static doc strings. Truly dynamic
content is left untouched. Its `code_component_import` /
`codeblock_component_import` (plus `components`/`elements`) options mirror the
runtime seam, so precompiled and runtime output stay identical. Reach for it
when a project renders many static `<Mdz>` blocks (docs sites); skip it for
purely dynamic content.

## Sync vs streaming

Two input regimes over one grammar. The **sync** pipeline (`mdz_parse`,
`Mdz.svelte`) owns random-access input — anything you hold as a complete string
(static content, the preprocessor). The **streaming** pipeline
(`MdzStreamParser`, `MdzStream.svelte` fed by an `MdzStreamState`) owns
append-only input arriving in chunks (LLM output). The streaming invariant: no
implicit re-parsing — corrections to already-emitted output are bounded, local,
and reified as opcodes. Use streaming only when you genuinely render partial
input as it arrives; otherwise `mdz_parse` is simpler.

## Testing

Fixture-based, in `src/test/` (not co-located): `fixtures/mdz/` drives the
parser (`input.mdz` → `expected.json`), `fixtures/svelte_preprocess_mdz/` drives
the preprocessor (`input.svelte`). **Never hand-edit `expected.json`** —
regenerate via `gro src/test/fixtures/mdz/update` (or the
`svelte_preprocess_mdz` equivalent). The fixtures are the ground truth for what
the dialect parses.
