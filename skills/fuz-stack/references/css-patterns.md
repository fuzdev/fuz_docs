---
description: fuz_css styling — default-reliance, the styling ladder, variables, extraction
---

# CSS Patterns

fuz_css is three parts: **semantic styles** (classless element defaults),
**style variables** (design tokens as CSS custom properties), and optional
**utility classes** generated per-project with only the classes you use.

## Default styling is the baseline

**The single most common mistake is styling elements fuz_css already styles.**
Semantic HTML comes fully dressed — headings are tiered (`h1`–`h6`), form
controls share sizing and focus/hover/disabled states, `<code>`/`<pre>` use the
mono font, `<aside>` is a callout, and **block elements space themselves
vertically** via the flow-margin system: `p`, `ul`, `ol`, `menu`, `form`,
`fieldset`, `table`, `details`, `textarea`, `select`, `label`, `pre`,
`blockquote`, `aside`, `nav`, `legend` each get
`margin-bottom: var(--flow_margin, var(--space_lg))` unless `:last-child` or
`.unstyled`. So a stack of paragraphs, a heading followed by prose, a list under
a heading — all already have correct rhythm with **zero classes**.

Before adding any class or `<style>`, ask: *what specific gap in the defaults
does this close?* Hand-adding `mb_*`/`gap_*`/`p_*` to elements flow margin
already spaces, or re-declaring the color/font an element already carries, is
churn that fights the framework. This isn't stylistic — real application code
bears it out: most fuz app source files have **no `<style>` block at all**
(zzz's library is ~82% style-free, mdz's ~100%), and where classes appear the
overwhelming majority are a class or two, not long strings.

Reach past the defaults only for genuine layout (flex rows/columns, grids),
intent color (`palette_c` for a destructive button), or component-specific
behavior. The flex containers are the main reason to add classes at all —
inside a `.row`, child flow margins reset to 0 (`.row > *` → `margin: 0`), so
use `gap_*` for spacing there.

## The Styling Ladder

When you *do* style, work down this ladder and stop at the first rung that
suffices:

1. **Semantic HTML** — the right element, no class. Often the whole job.
2. **Built-in class conventions** — `.selected`, `.disabled`, `.palette_a`–
   `.palette_j`, `.inline`, `.unstyled` — state/variant classes the semantic
   styles already recognize.
3. **Composite classes** — `box`, `row`, `column`, `panel`, `chip`, `ellipsis`
   — one class for a whole layout pattern.
4. **Token classes** — `p_md`, `gap_lg`, `palette_a_50` — map to design tokens;
   never hardcode spacing or color.
5. **Literal classes** — `display:flex`, `width:100%`, `hover:opacity:80%` —
   arbitrary `property:value`, including responsive/state modifiers.
6. **`<style>` block with design tokens** — component-specific layout,
   animation, complex selectors, theming APIs.

**Rungs 3–5 are one tier in practice, not a strict frequency ranking.** They're
all utility classes you mix freely on the same element. The ordering is a mild
preference — reach for a composite when one *exactly* matches (`row` over
`display:flex align-items:center`), tokens for spacing/color, literals for
one-off layout. Empirically, spacing token classes (`mb_*`, `gap_*`, `p_*`) are
the single most-used class family, and **literal flex classes (`display:flex`,
`flex:1`, `width:100%`) are as common as composites** — heavily used in app
code, not a rare last resort. The real cut points on the ladder are between
rung 1 (semantic, no class) and the rest, and between rungs 1–5 (utility
classes) and rung 6 (`<style>` block).

The same hierarchy applies to text: `<small>` over
`font-size: var(--font_size_sm)`, `<h2>` over a custom heading style, `<aside>`
over a hand-built callout.

### Direction matters — don't churn `<style>` into class soup

The ladder describes how to **author** from scratch, not a mandate to rewrite
`<style>` blocks as classes. Pushing styling *up* the ladder (a `<div
class="callout">` → `<aside>`) is neutral-to-good; pushing it *down* (a working
`<style>` block → a 12-class string) is usually churn.

- **Class → right semantic element** — good.
- **Trivially-redundant `<style>` → composite/token** — good only when the
  block's entire content is one composite's worth: `display: flex;
  flex-direction: column; gap: var(--space_md)` (→ `column gap_md`),
  `display: flex; align-items: center; gap: …` (→ `row gap_*`), or a single
  token-mappable value. Intent must survive the rewrite verbatim.
- **Non-trivial `<style>` → long class string** — don't. If the block has
  hover/focus state machines, animations, `@media`, parent-child selectors,
  pseudo-element content, positioning, or theming-API variables, leave it. A
  `<style>` block with design tokens reads better than a 12-class string, gets
  IDE autocomplete, and survives conditional logic without `clsx` gymnastics.

**When in doubt, don't churn an existing `<style>` block** — the author chose it
because the styling exceeded "simple."

## Elements That Come Pre-Styled

| Element                           | What you get without classes                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `<h1>`–`<h6>`                     | Serif font, tiered sizes/weights, balanced text wrap, flow margins                       |
| `<a>`                             | Link color, focus outline, `.selected` state                                             |
| `<button>`                        | Fill, border, hover/active/focus/disabled/selected states                                |
| `<button class="palette_a">`        | Hue variants `palette_a` through `palette_j` (intent/status colors)                          |
| `<input>`/`<textarea>`/`<select>` | Padding, border, focus outline, hover/disabled states; range, checkbox, radio all styled |
| `<aside>`                         | Left border, tinted background, padding — callout/info box                               |
| `<blockquote>`                    | Thick left border, padding                                                               |
| `<code>`                          | Monospace, tinted background, padding; auto-inlines inside `<p>`                         |
| `<pre>`                           | Monospace, overflow handling                                                             |
| `<details>`/`<summary>`           | Pointer cursor, hover/active backgrounds                                                 |
| `<table>`/`<th>`/`<td>`/`<tr>`    | Border-collapse, header alignment, cell padding, row hover                               |
| `<small>`                         | `font-size: var(--font_size_sm)` — for metadata, secondary text                          |
| `<kbd>`/`<samp>`                  | Monospace font                                                                           |
| `<abbr title="...">`              | Dotted underline                                                                         |
| `<sub>`/`<sup>`                   | Baseline-aware sub/superscript                                                           |
| `<hr>`                            | Themed double border with vertical spacing                                               |
| `<img>`/`<svg>`/`<video>` etc.    | `display: block`, `max-width: 100%`, `height: auto`                                      |
| `<ul>`/`<ol>`/`<menu>`            | Indented padding (`.unstyled` removes bullets and indent)                                |
| `<label>`                         | Block layout, cursor pointer, `.selected`/`.disabled` states                             |
| `<label> .title`                  | Bold, small bottom margin — field label inside a `<label>`                               |
| `<fieldset>`/`<legend>`           | Column flex layout, larger legend text                                                   |

Low-specificity `:where()` selectors carry all of this, so any class or style
overrides it, regardless of import order.

## Built-In Class Conventions

State/variant classes authored into the semantic styles (`style.css`) — reach
for these before any utility class or custom CSS:

| Class                 | Where it applies                                | Effect                                                     |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `.selected`           | `button`, `a`, `label`, `.menuitem`             | Filled selected appearance; `button`/`label` also switch to `cursor: default` (links stay interactive) |
| `.deselectable`       | selected `button`, and the `selectable`/`menuitem` composites | Keeps interactivity on a selected element                  |
| `.disabled`           | `label`                                          | Muted color, default cursor                                |
| `.palette_a`–`.palette_j` | `button`                                        | Palette variants (a=blue·accent, c=red·negative, etc.)     |
| `.inline`             | `button`, `input`, `code`, `select`, `textarea` | Inline-block display for use inside paragraph text         |
| `.unstyled`           | Most elements                                   | Opts out of opinionated styling, keeps normalizations      |

A `<button class="palette_c selected">` is already a "selected destructive
action" — no hand-rolled state styling. (Size classes `sm`/`md`/`lg`/etc. read
like conventions but are composites that require extraction — see
[Composite Classes](#composite-classes).)

## Project Setup

### Import Order

Import CSS in `+layout.svelte` (`src/routes`). First import is universal; others
as needed:

```typescript
import 'virtual:fuz.css'; // generated bundled CSS (all projects)
import '@fuzdev/fuz_code/theme.css'; // package-specific themes (if any)
import '#routes/style.css'; // project-specific global styles (app projects)
```

`#routes` resolves to `src/routes` in SvelteKit. Library/tool repos (fuz_css,
fuz_ui, `gro`) often import only `virtual:fuz.css`; application repos
(fuz_template, fuz_blog, zzz) typically use all three.

### CSS Generation

CSS is generated on demand by the `vite_plugin_fuz_css` Vite plugin and imported
as the `virtual:fuz.css` module — no committed `fuz.css` file. Ecosystem default
for any Vite project:

```typescript
// vite.config.ts
import {vite_plugin_fuz_css} from '@fuzdev/fuz_css/vite_plugin_fuz_css.ts';
export default defineConfig({plugins: [vite_plugin_fuz_css()]});

// src/routes/+layout.svelte (or main.ts)
import 'virtual:fuz.css';
```

Declare the module type once in `src/app.d.ts`:

```typescript
declare module 'virtual:fuz.css' {
	const css: string;
	export default css;
}
```

The plugin supports HMR; tree-shaken bundled mode needs no options. fuz_css
itself passes `{additional_variables: 'all'}` to include all variables for its
docs demos.

**Gro generator alternative**: a `src/routes/fuz.gen.css.ts` exporting
`gen_fuz_css()` writes a committed `fuz.css` genfile (regenerated via `gro
gen`). Prefer the Vite plugin; reach for this only when a project can't run it.

### Project `style.css`

Project-specific global styles in `src/routes/style.css`: custom element
overrides, patterns being prototyped before upstreaming to fuz_css, app-specific
layout (sidebar widths, nav heights). Keep minimal — most apps have near-empty
`style.css` files.

## Style Variables (Design Tokens)

Defined in TypeScript, rendered to CSS. 600+ tokens; each can have `light`
and/or `dark` values.

### Colors

10 palette hues, glossed by color name plus default intent binding:

- `a` (blue · accent), `b` (green · positive), `c` (red · negative), `d`
  (purple), `e` (yellow)
- `f` (brown · neutral), `g` (pink), `h` (orange · caution), `i`
  (cyan · info), `j` (teal)

Semantic intent knobs alias meaning over the letters — `--hue_accent`,
`--hue_positive`, `--hue_negative`, `--hue_caution`, `--hue_info`, plus
`--hue_neutral`/`--neutral_chroma` for every surface/text/border tint. Each
intent derives a full 13-stop scale (`--accent_00`–`--accent_100`) with
text/background token classes (`positive_50`, `bg_caution_10`) — prefer
intent tokens over palette letters when the color carries meaning.

**Intensity scale**: 13 stops from `palette_a_00` (nearest the background) →
`palette_a_50` (base) → `palette_a_100` (highest contrast), scheme-adaptive:
`00`, `05`, `10`, `20`, `30`, `40`, `50`, `60`, `70`, `80`, `90`, `95`, `100`.

### Color-Scheme Variants

| Prefix      | Behavior                                       | Use case                       |
| ----------- | ---------------------------------------------- | ------------------------------ |
| `text_*`    | Opaque, scheme-aware (low=subtle, high=bold)   | Text (alpha hurts performance) |
| `shade_*`   | Opaque, tinted neutrals (00→100), scheme-aware | Backgrounds, surfaces          |
| `fg_*`      | Toward contrast (darkens light, lightens dark) | Foreground overlays that stack |
| `bg_*`      | Toward surface (lightens light, darkens dark)  | Background overlays that stack |
| `darken_*`  | Always darkens (agnostic, alpha-based)         | Shadows, backdrops             |
| `lighten_*` | Always lightens (agnostic, alpha-based)        | Highlights                     |

`text_*` and `shade_*` are the everyday opaque, scheme-aware color tokens —
reach for them first. `fg_*`/`bg_*` overlays use alpha and accumulate when
nested. Both `shade_*` and `text_*` have `_min`/`_max` for untinted extremes
(pure black/white). For a color that
doesn't adapt to the scheme, write the literal value or define one custom
property (the old `_light`/`_dark` absolute variants were removed).

### Sizes

`xs5` → … → `xs` → `sm` → `md` → `lg` → `xl` → `xl2` → … → `xl15` (23 stops for
spacing). Other families use subsets:

- **Font sizes**: 13 stops (`xs`–`xl9`)
- **Icon sizes**: 7 stops (`xs`–`xl3`, in px not rem)
- **Border radii**: 7 stops (`xs3`–`xl`)
- **Distances**: 5 stops (`xs`–`xl`, px — absolute widths: 200/320/800/1200/1600)
- **Shadows, line heights**: 5 stops (`xs`–`xl`)

### Additional Variable Families

- **`border_color_*`**, **`outline_color_*`**: alpha-based tinted borders/outlines (00–100)
- **`shadow_alpha_*`**: shadow opacity scale (00–100)
- **`border_width_*`**: numbered 1–9 (px)
- **`duration_*`**: numbered 1–6 (0.08s to 3s)
- **`hue_*`**: base hue values for each color (`hue_a` through `hue_j`)

### Cascade Layers

All shipped CSS is layered: `fuz.base` (default variables + element styles) <
`fuz.theme` (theme overrides, where `render_theme_style()` renders) <
`fuz.utilities` (generated classes). Consumers' unlayered styles beat
everything. Colors are derived OKLCH (curve knobs → ramp stops → color stops,
computed in pure CSS).

### Cascading Variable Pattern

Many token classes set both a CSS property **and** a cascading custom property,
so children inherit the value:

- `font_size_lg` → `font-size` + `--font_size`
- `palette_a_50` → `color` + `--text_color`
- `border_color_30` → `border-color` + `--border_color`
- `outline_a_50` → `outline-color` + `--outline_color` (focus rings key off it)
- `shadow_color_umbra` → `--shadow_color`

A child of `font_size_lg` can reference `var(--font_size)` for the inherited
value.

## Utility Classes

Three types, generated on-demand:

| Type                  | Example                               | Purpose                      |
| --------------------- | ------------------------------------- | ---------------------------- |
| **Token classes**     | `.p_md`, `.palette_a_50`, `.gap_lg`     | Map to style variables       |
| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |
| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |

### Token Classes

- **Spacing**: `p_md`, `px_lg`, `mt_xl`, `gap_sm`, `mx_auto`, `m_0` — by far the
  most-used family
- **Text colors**: `text_70`, `text_min`, `palette_a_50`
- **Background colors**: `shade_00`, `bg_10`, `fg_20`, `darken_30`, `bg_a_50`
- **Typography**: `font_size_lg`, `font_family_mono`, `line_height_md`, `icon_size_sm`
- **Layout**: `width_md` (space scale), `top_sm`, `inset_md`, and the
  **distance-scale** sizers `width_atmost_lg`/`width_atleast_sm`/`height_atmost_md`
  — these emit `width: 100%; max-width: var(--distance_*)` (px caps: 200–1600),
  distinct from `width_md` which maps to the space scale
- **Borders**: `border_radius_xs`, `border_width_2`, `border_color_30`
- **Shadows**: `shadow_md`, `shadow_top_md`, `shadow_inset_xs`, `shadow_alpha_50`,
  `shadow_color_umbra` (also `_highlight`, `_glow`, `_shroud`)
- **Hue**: `hue_a` through `hue_j` (sets `--hue`)

### Composite Classes

| Class         | What it does                                                       |
| ------------- | ------------------------------------------------------------------ |
| `box`         | Flex column, items centered, justify centered                      |
| `row`         | Flex row, align-items centered (overrides `box` direction)         |
| `column`      | Flex column (like `box` but uncentered)                            |
| `panel`       | Embedded container with tinted background and border-radius        |
| `pane`        | Floating container with opaque background and shadow               |
| `ellipsis`    | Block with text truncation (nowrap, overflow hidden, ellipsis)     |
| `chip`        | Inline label styling (font/padding/bg/radius + `color_X` hues); display comes from the host element |
| `menuitem`    | Full-width list item with icon, title, and selected state          |
| `icon_button` | Square button sized to `--input_height` (flex-shrink: 0)           |
| `selectable`  | Button-like fill with hover/active/selected states                 |
| `clickable`   | Hover/focus/active scale transform effects (includes state styles) |
| `plain`       | Transparent border/fill/shadow when not hovered                    |
| `chevron`     | Small right-pointing arrow via CSS border trick                    |
| `circular`    | `border-radius: 50%`                                               |
| `pixelated`   | Crisp pixel-art image rendering                                    |
| `xs`/`sm`/`md`/`lg`/`xl` | **Size composites** — see below                         |

**Size composites cascade to a subtree.** `xs`/`sm`/`md`/`lg`/`xl` are a
five-member family at fixed step offsets from the `md` default. Put one on any
**container** and it rescales that subtree's `--font_size`, `--input_height`,
`--icon_size`, padding, **and `--flow_margin`** in lockstep — so a `sm` panel
gets tighter text, controls, icons, and vertical rhythm together. `md` resets to
default within an already-sized parent. This is the idiomatic way to make a
whole region denser or roomier without touching individual elements.

**Gotcha**: composites with rulesets (`clickable`, `selectable`, `menuitem`,
`plain`, `chip`) already include their state styles — `hover:clickable` is
redundant. Several composites see near-zero real use (`circular`, `pixelated`,
`pane`, `chevron`); the load-bearing ones are `row`, `column`, `box`, `panel`,
`chip`, `menuitem`.

### Literal Classes

`property:value` maps directly to CSS:

```svelte
<div class="display:flex justify-content:center gap:var(--space_md)">
```

**Space encoding**: `~` for spaces in multi-value properties:

```svelte
<div class="margin:0~auto padding:var(--space_sm)~var(--space_lg)">
<div class="width:calc(100%~-~20px)">  <!-- calc requires ~ around +/- -->
```

If you need more than 2–3 `~` characters, use a `<style>` block instead.

## Modifiers

State/responsive/color-scheme styling that inline styles can't do, prefixed onto
a literal class. Each maps 1:1 to a CSS pseudo-class or at-rule (`hover:` →
`:hover`, `disabled:` → `:disabled`, `print:` → `@media print`, `before:` →
`::before`), so the full list is inferable; the exhaustive registry lives in
fuz_css's `modifiers.ts`. The stack-specific parts worth knowing:

```svelte
<button class="hover:opacity:80% focus:outline:2px~solid~var(--palette_a_50)">
<div class="display:none md:display:flex">          <!-- responsive -->
<div class="box-shadow:var(--shadow_lg) dark:box-shadow:var(--shadow_sm)">
<div class='before:content:"" before:display:block'> <!-- pseudo needs explicit content -->
```

- **Responsive breakpoints**: `sm:` (40rem), `md:` (48rem), `lg:` (64rem), `xl:`
  (80rem), `2xl:` (96rem). Also `max-sm:`…, and arbitrary `min-width(800px):` /
  `max-width(600px):`.
- **Ancestor**: `dark:` / `light:` (color scheme).
- **Order**: `[media]:[ancestor]:[state...]:[pseudo-element]:property:value` —
  and **multiple states must be alphabetical** (`focus:hover:…`, not
  `hover:focus:…`), which the parser enforces.

**In practice, modifier classes are rare in real code.** Responsive layout is
overwhelmingly done with `@media` in component `<style>` blocks, and hover/focus
states ride on stateful composites (`clickable`, `selectable`, `menuitem`,
`plain`) or `<style>`. The modifier system is fully available and correct, but
convention favors `<style>` for anything beyond an occasional one-off literal
state.

## Class Extraction

Classes are extracted via AST parsing at build time from:

- `class="..."` attributes
- `class={[...]}` and `class={{...}}` (Svelte 5.16+)
- `class:name` directives
- `clsx()`, `cn()`, `cx()`, `classNames()`, `classnames()` calls
- variables whose names end in `class`/`classes`/`className(s)`/`classList(s)`

CSS variables are additionally caught by a `var(--name)` regex scan (only known
theme variables are included; unknown ones silently ignored), which catches
usage in component props like `size="var(--icon_size_xs)"` that AST extraction
would miss.

### Comment hints for the dynamic cases

When a class/element/variable is constructed dynamically and the extractor can't
see it statically, declare it explicitly:

```typescript
// @fuz-classes opacity:50% opacity:75% opacity:100%
// @fuz-elements button input textarea
// @fuz-variables shade_40 text_50
```

Behavior: auto-detected-but-unresolvable classes/elements/variables are
**silently skipped** (they may belong to another framework); an explicit
`@fuz-*` entry that can't be resolved is an **error** with typo suggestions via
string similarity. Outside fuz_css's own docs site, AST extraction handles
almost everything and `@fuz-*` hints are rarely needed.

## Dynamic Theming

### Runtime Variable Overrides

Use Svelte's `style:` directive for runtime CSS variable overrides — components
expose CSS variables as their theming API, consumers override inline:

```svelte
<div style:--docs_menu_width={width}>
<Alert style:--text_color={color}>
<HueInput style:--hue={value}>
```

### Color Scheme

Dark/light mode is a `dark`/`light` class on the root element. `style.css`
includes `:root.dark { color-scheme: dark; }` / `:root.light { color-scheme:
light; }`. Persistence and system-preference handling live in fuz_ui's
`ThemeState` class and `ThemeRoot` component.

### Theme Switching

Three built-in themes (`base`, `low contrast`, `high contrast`); custom themes
are arrays of `StyleVariable` overrides. Theme CSS is rendered via
`render_theme_style()` with higher specificity (default `:root:root`) to
override bundled theme variables regardless of insertion order.

## Component Styling In Practice

Everything above lands as one principle for component authors: **components
should have minimal custom CSS, delegating to fuz_css.** Across fuz_ui's 64
components, ~29 (45%) have no `<style>` block at all — and fuz_ui is a component
library, the styling-heaviest code in the ecosystem. Application code skews far
more classless (70–100% style-free). Where a `<style>` block exists it's usually
5–30 lines (median ~16), with a tail up to ~90 for layout-heavy components
(cards, dialogs, nav bars). Shared traits of well-styled components:

- **No `<style>` block when possible** — styling from semantic HTML + utilities
- **When `<style>` exists, it's component-specific** — positioning, transitions,
  responsive breakpoints, complex parent-child selectors
- **All colors/spacing/typography from design tokens** — never hardcoded
- **Layout uses composites/utilities** — `box`, `row`, `column`, `panel`,
  `gap_lg` over manual flex
- **Stateful styling is conventional** — `class={{selected: …}}` rides on the
  built-in `.selected` rules

```svelte
<!-- No <style> needed — semantic HTML + utility classes -->
<aside class="column gap_md">
	<h2>{title}</h2>
	<small class="text_50">{subtitle}</small>
	<p>{description}</p>
	<button class="palette_a">Confirm</button>
	<button class={['palette_c', {selected: destructive}]}>Delete</button>
</aside>
```

fuz_ui's `Details.svelte` and `EcosystemLinks.svelte` are real examples: pure
semantic HTML (`<details>`, `<summary>`, `<ul>`, `<a>`, `<p>`) riding on the
default element styling, no `<style>` block.

### Anti-Patterns

Each of these signals a component doing work fuz_css already does:

```svelte
<!-- BAD: rebuilding what <small>/<aside> already do -->
<span class="subtitle">{text}</span>          <!-- GOOD: <small class="text_70"> -->
<div class="info-box">{message}</div>         <!-- GOOD: <aside> -->

<!-- BAD: manual flex in <style> -->
<div class="container">…</div>                <!-- GOOD: <div class="column gap_md"> -->
<style>.container { display: flex; flex-direction: column; gap: var(--space_md); }</style>

<!-- BAD: hand-rolled destructive button -->
<button class={['delete-btn', {active}]}>Delete</button>
<!-- GOOD: <button class={['palette_c', {selected: pending}]}>Delete</button> -->

<!-- BAD: hardcoded pixels -->
<style>.sidebar { width: 220px; padding-top: 40px; }</style>
<!-- GOOD: <style>.sidebar { width: var(--sidebar_width); padding-top: var(--space_xl2); }</style> -->
```

If multiple components each define their own `.sidebar`/`.header`/`.content`
with the same flex/padding, those belong in composites, project `style.css`, or
utility classes — not repeated per component.

### When Custom CSS IS Justified

- **Complex interactive states** — multi-property hover/active/selected,
  `color-mix` shadows, parent-child selectors like `.parent:hover .child`
  (fuz_ui's `Hashlink.svelte` is the canonical parent-hover-reveal example)
- **Structural behavior** — `flex-direction: column-reverse` for bottom-up
  scroll, `position: sticky/absolute/fixed` with calculated offsets
- **Responsive layouts** — `@media` queries for structural changes
- **Animations/transitions** — `@keyframes`, `transition`
- **Rendering contexts** — canvas, 3D, custom-layout surfaces
- **Theming APIs for children** — declaring CSS custom properties consumers
  override via `style:` (e.g. `Alert.svelte` exposes `--text_color`)

Even justified custom CSS uses design tokens (`var(--space_md)`), not hardcoded
values.

### Project `style.css` for shared app patterns

When a pattern recurs across components in one app but isn't general enough for
fuz_css, put it in the project's `src/routes/style.css` — the right home for
app-scoped shared classes (button variants, layout columns, scroll shadows).
Mark candidates with `// TODO upstream` if they might belong in fuz_css. Keeps
component `<style>` blocks focused and avoids premature generalization.

### Class Naming

Two naming systems coexist:

- **fuz_css design tokens**: `snake_case` — `p_md`, `palette_a_50`, `gap_lg`. The
  global vocabulary.
- **Component-local classes**: `kebab-case` — `site-header`, `nav-links`,
  `character-entry`. Distinguishes component-scoped styles from design-system
  classes at a glance.

```svelte
<!-- snake_case = fuz_css utility, kebab-case = component-local -->
<div class="column gap_md site-header">
	<nav class="row gap_sm nav-links">…</nav>
</div>

<style>
	.site-header { position: sticky; top: 0; z-index: 10; }
	.nav-links { border-bottom: var(--border_width_1) var(--border_style) var(--border_color); }
</style>
```

kebab-case for component-local classes is the **target** convention, fully
adopted in zzz and fuz_ui; the fuz_css and fuz_docs docs sites still lean
`snake_case` for local classes and haven't been migrated. New code should use
kebab-case.

## When to Use Classes vs Styles

| Need                                      | Utility class | Style tag       | Inline style   |
| ----------------------------------------- | ------------- | --------------- | -------------- |
| Simple layout (`row`, `column`, `gap_*`)  | **Preferred** | Overkill        | No             |
| Design tokens on own elements (1–4 props) | **Yes**       | OK              | OK             |
| Non-trivial own-element styling           | OK            | **Preferred**   | No             |
| Style child components                    | **Yes**       | No              | Limited        |
| Hover/focus/active state machines         | Limited       | **Preferred**   | No             |
| `@media` responsive layout                | Limited       | **Preferred**   | No             |
| Animations, transitions, keyframes        | No            | **Preferred**   | No             |
| Parent-child / sibling selectors          | No            | **Only option** | No             |
| Theming API (CSS vars consumers override) | No            | **Yes**         | Yes (override) |
| Runtime dynamic values                    | No            | No              | **Yes**        |

**One heuristic the table doesn't capture: long class strings are a smell.** 4–6
classes is the comfortable upper bound (98%+ of real class attributes are ≤6
tokens); 8+ (especially several literal `property:value` classes) usually reads
worse than the equivalent `<style>` block with design tokens, which also gets
IDE autocomplete and composes with conditional logic without `clsx` gymnastics.
And per §Direction matters, don't churn *existing* `<style>` blocks into class
strings.
