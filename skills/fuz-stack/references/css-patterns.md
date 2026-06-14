# CSS Patterns

fuz_css: **semantic styles** (classless element defaults), **style variables**
(design tokens as CSS custom properties), and optional **utility classes**
generated per-project with only used classes.

## The Default Path: Semantic HTML First

**Most elements need zero classes.** fuz_css styles HTML elements by default —
headings, buttons, inputs, links, lists, code, tables, `<aside>`,
`<blockquote>`, `<details>`/`<summary>`, `<small>`, `<kbd>`/`<samp>`,
`<abbr>`, `<sub>`/`<sup>`, `<hr>`, `<img>`/`<picture>`/`<svg>`/`<video>`
all get sensible defaults via low-specificity `:where()` selectors. About
half of fuz_ui's components have no `<style>` block at all.

Work down this ladder when styling and stop at the first rung that suffices:

1. **Semantic HTML** — pick the right element and you're often done. Headings
   are pre-tiered (`h1`-`h6`), `<aside>` is a callout, `<blockquote>` is an
   emphasis block, `<small>` shrinks text, `<code>`/`<pre>`/`<kbd>` use mono
   font, form controls share consistent sizing and focus/hover/disabled states.
2. **Built-in class conventions** — `.selected`, `.disabled`, `.color_a`
   through `.color_j` (on buttons), `.deselectable`, `.inline`, `.unstyled`,
   `.sm`/`.md` (size overrides). These layer on the semantic defaults.
3. **Composite classes** — `box`, `row`, `column`, `panel`, `pane`, `chip`,
   `menuitem`, `clickable`, `ellipsis`. One class replaces 4-8 properties.
4. **Token classes** — `p_md`, `gap_lg`, `color_a_50`, `font_size_lg`. Map to
   the design system; never hardcode spacing or color values.
5. **Literal classes** — `display:flex`, `hover:opacity:80%`. For one-off CSS
   or modifiers (responsive, hover, focus) without a `<style>` block.
6. **`<style>` block with design tokens** — last resort, for component-specific
   layout/animation/responsive behavior that classes can't express cleanly.

The same hierarchy applies to text: prefer `<small>` over
`font-size: var(--font_size_sm)`, prefer `<h2>` over a custom heading style,
prefer `<aside>` over a custom callout box.

### Style tags vs utility classes — direction matters

The ladder describes how to **author** styling from scratch, not a mandate to
"rewrite every existing `<style>` block as utility classes." Pushing styling up
the ladder is neutral-to-good; pushing it down (style block → class soup) is
usually churn.

**Rule of thumb when reviewing or refactoring:**

- **Replacing classes with the right semantic element** — good (e.g.,
  `<div class="callout">` → `<aside>`, `<span class="muted-small">` →
  `<small class="text_70">`).
- **Replacing a tiny `<style>` block with a composite/token class** —
  good only when the block is **trivially redundant**: a 2–4 line block
  whose entire content is one of `display: flex; flex-direction: column;
gap: var(--space_md)` (→ `column gap_md`), `display: flex;
align-items: center; gap: …` (→ `row gap_*`), or a single hardcoded
  spacing/color that maps to a token. The original intent must survive
  the rewrite verbatim.
- **Replacing a non-trivial `<style>` block with a long class string** —
  **don't**. If the block has hover/focus/active states, animations,
  `@media` queries, parent-child selectors, pseudo-elements with
  content, sticky/absolute positioning, theming-API CSS variables, or
  more than ~6 utility classes' worth of properties, leave it as a
  `<style>` block. A `<style>` block with design tokens reads better
  than a 12-class string, gets IDE autocomplete, and survives
  conditional logic without `clsx` gymnastics.

**When in doubt, don't churn an existing `<style>` block** — the author chose
it because the styling exceeded "simple." Refactor only when the block is
plainly redundant with a single composite/token and the diff shrinks the file.

### Elements That Come Pre-Styled

| Element                           | What you get without classes                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `<h1>`–`<h6>`                     | Serif font, tiered sizes/weights, balanced text wrap, flow margins                       |
| `<a>`                             | Link color, focus outline, `.selected` state                                             |
| `<button>`                        | Fill, border, hover/active/focus/disabled/selected states                                |
| `<button class="color_a">`        | Hue variants `color_a` through `color_j` (intent/status colors)                          |
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

Most block elements (`p`, `ul`, `ol`, `form`, `fieldset`, `table`, `details`,
`textarea`, `select`, `label`, `pre`, `blockquote`, `aside`, `nav`, `legend`)
get `margin-bottom: var(--flow_margin)` unless `:last-child` — the **flow
margin** system. Inside a `.row` flex container, child margins reset to 0; use
`gap_*` instead.

### Built-In Class Conventions

State/variant classes that fuz_css's semantic styles recognize — no utility
classes needed:

| Class                 | Where it applies                                | Effect                                                     |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `.selected`           | `button`, `a`, `label`, `.menuitem`             | Filled selected appearance, non-interactive                |
| `.deselectable`       | `button.selected`                               | Keeps interactivity on a selected button                   |
| `.disabled`           | `label`                                         | Muted color, default cursor                                |
| `.color_a`–`.color_j` | `button`                                        | Hue variants (a=blue, b=green, c=red, etc.)                |
| `.inline`             | `button`, `input`, `code`, `select`, `textarea` | Inline-block display for inline use                        |
| `.unstyled`           | Most elements                                   | Opts out of opinionated styling, keeps normalizations      |
| `.sm`                 | Any container                                   | Tighter sizing (overrides `--font_size`, `--input_height`) |
| `.md`                 | Any container                                   | Resets to default sizing (reverses cascaded `.sm`)         |

Reach for these before custom CSS. A `<button class="color_c selected">` is
already a "selected destructive action" — no hand-rolled state styling.

## Project Setup

### Import Order

Import CSS in `+layout.svelte` (`src/routes`). First import is universal;
others as needed:

```typescript
import 'virtual:fuz.css'; // generated bundled CSS (all projects)
import '@fuzdev/fuz_code/theme.css'; // package-specific themes (if any)
import '$routes/style.css'; // project-specific global styles (app projects)
```

`$routes` resolves to `src/routes` in SvelteKit. Library/tool repos
(fuz_css, fuz_ui, `gro`, etc.) often import only `virtual:fuz.css`. Application
repos (fuz_template, fuz_blog, zzz, etc.) typically use all three.

### CSS Generation

The CSS is generated on demand by the `vite_plugin_fuz_css` Vite plugin and
imported as the `virtual:fuz.css` module — no committed `fuz.css` file. This is
the ecosystem default (SvelteKit and any other Vite project):

```typescript
// vite.config.ts
import {vite_plugin_fuz_css} from '@fuzdev/fuz_css/vite_plugin_fuz_css.js';
export default defineConfig({plugins: [vite_plugin_fuz_css()]});

// src/routes/+layout.svelte (or main.ts)
import 'virtual:fuz.css';
```

For TypeScript, declare the module's type once in `src/app.d.ts`:

```typescript
declare module 'virtual:fuz.css' {
	const css: string;
	export default css;
}
```

The plugin supports HMR — source changes regenerate the CSS. Default bundled
mode with tree-shaking needs no custom options. fuz_css itself passes
`{additional_variables: 'all'}` to include all variables for its docs site demos.

**Gro generator alternative**: a `src/routes/fuz.gen.css.ts` exporting
`gen_fuz_css()` writes a committed `fuz.css` genfile (regenerated via
`gro gen`). The Vite plugin is preferred; reach for this only when a project
can't run the plugin.

### Project `style.css`

Project-specific global styles in `src/routes/style.css`:

- Custom element overrides (e.g., heading fonts, textarea styling)
- Patterns being prototyped before upstreaming to fuz_css
- App-specific layout (e.g., sidebar widths, primary nav height)

Keep minimal — most apps have near-empty `style.css` files.

## Three-Layer Architecture

| Layer              | File              | Purpose                                                   |
| ------------------ | ----------------- | --------------------------------------------------------- |
| 1. Semantic styles | `style.css`       | Reset + element defaults (buttons, inputs, forms, tables) |
| 2. Style variables | `theme.css`       | 600+ design tokens as CSS custom properties               |
| 3. Utility classes | `virtual:fuz.css` | Optional, generated per-project with only used classes    |

### Semantic Styles

`style.css` styles HTML elements without classes using low-specificity
`:where()` selectors, so utility classes always win. See §The Default Path
above for the full table of pre-styled elements and built-in class
conventions. The lowered specificity also keeps fuz_css's stylesheet from
interfering with the page's styles regardless of import order.

Combine semantic HTML with utility classes for color and layout — the element
gives typography and base styling, the classes layer on intent:

```svelte
<small class="text_50">{metadata}</small>
<small class="text_70">{subtitle}</small>
<small class="row gap_sm">{items}</small>
```

### `.unstyled` and `.inline` Modifiers

`.unstyled` opts an element out of opinionated styling (colors, borders,
decorative properties) while keeping normalizations (font inheritance,
border-collapse). Common for nav menus, custom list components, and links
used as buttons:

```svelte
<ul class="unstyled column gap_xs">  <!-- reset list, use as flex column -->
<a class="unstyled">                 <!-- reset link styling -->
<menu class="unstyled row gap_sm">   <!-- reset menu, use as flex row -->
```

`.inline` forces inline-block display for embedding interactive elements in
paragraph text:

```svelte
<p>Click <button class="inline">here</button> to continue.</p>
<p>Enter your <input class="inline" /> name.</p>
```

Applies to `code`, `input`, `textarea`, `select`, `button`. These also get
inline-block automatically when nested inside `<p>` (no class needed).

## Style Variables (Design Tokens)

Defined in TypeScript, rendered to CSS. Each can have `light` and/or `dark` values.

### Colors

10 hues with semantic roles:

- `a` (primary/blue), `b` (success/green), `c` (error/red), `d`
  (secondary/purple), `e` (tertiary/yellow)
- `f` (muted/brown), `g` (decorative/pink), `h` (caution/orange), `i`
  (info/cyan), `j` (flourish/teal)

**Intensity scale**: 13 stops from `color_a_00` (lightest) → `color_a_50`
(base) → `color_a_100` (darkest). Steps: `00`, `05`, `10`, `20`, `30`, `40`,
`50`, `60`, `70`, `80`, `90`, `95`, `100`.

### Color-Scheme Variants

| Prefix      | Behavior                                       | Use case                       |
| ----------- | ---------------------------------------------- | ------------------------------ |
| `fg_*`      | Toward contrast (darkens light, lightens dark) | Foreground overlays that stack |
| `bg_*`      | Toward surface (lightens light, darkens dark)  | Background overlays that stack |
| `darken_*`  | Always darkens (agnostic, alpha-based)         | Shadows, backdrops             |
| `lighten_*` | Always lightens (agnostic, alpha-based)        | Highlights                     |
| `text_*`    | Opaque, scheme-aware (low=subtle, high=bold)   | Text (alpha hurts performance) |
| `shade_*`   | Opaque, tinted neutrals (00→100), scheme-aware | Backgrounds, surfaces          |

`fg_*`/`bg_*` overlays use alpha and stack when nested (alpha accumulates),
unlike opaque `shade_*`. Both `shade_*` and `text_*` include `_min`/`_max`
variants for untinted extremes (pure black/white).

### Sizes

`xs5` → `xs4` → `xs3` → `xs2` → `xs` → `sm` → `md` → `lg` → `xl` → `xl2` →
... → `xl15` (23 stops for spacing). Other families use subsets:

- **Font sizes**: 13 stops (`xs`-`xl9`)
- **Icon sizes**: 7 stops (`xs`-`xl3`, in px not rem)
- **Border radii**: 7 stops (`xs3`-`xl`)
- **Distances**: 5 stops (`xs`-`xl`, in px for absolute widths)
- **Shadows, line heights**: 5 stops (`xs`-`xl`)

### Additional Variable Families

- **`border_color_*`**: Alpha-based tinted borders (00-100 scale)
- **`shadow_alpha_*`**: Shadow opacity scale (00-100)
- **`darken_*`/`lighten_*`**: Non-adaptive alpha overlays (00-100)
- **`border_width_*`**: Numbered 1-9 (in px)
- **`duration_*`**: Numbered 1-6 (0.08s to 3s)
- **`hue_*`**: Base hue values for each color (`hue_a` through `hue_j`)
- **Non-adaptive variants**: `shade_XX_light`/`shade_XX_dark` and
  `color_X_XX_light`/`color_X_XX_dark` for fixed appearance regardless of
  color scheme

### Theme Specificity

Bundled mode: `:root` and `:root.dark`. Runtime theme switching (via
`render_theme_style()`) repeats the selector for higher specificity (default
`:root:root` and `:root:root.dark`) to handle unpredictable CSS insertion order.

Colors are HSL-based (OKLCH migration planned).

## CSS Classes

Three types of utility classes, generated on-demand:

| Type                  | Example                               | Purpose                      |
| --------------------- | ------------------------------------- | ---------------------------- |
| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |
| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |
| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |

### Token Classes

Map directly to style variable values:

- **Spacing**: `p_md`, `px_lg`, `mt_xl`, `gap_sm`, `mx_auto`, `m_0`
- **Text colors**: `text_70`, `text_min`, `color_a_50`, `color_b_50`
- **Background colors**: `shade_00`, `bg_10`, `fg_20`, `darken_30`,
  `bg_a_50` (hue + intensity background)
- **Typography**: `font_size_lg`, `font_family_mono`, `line_height_md`,
  `icon_size_sm`
- **Layout**: `width_md`, `width_atmost_lg`, `height_xl`, `top_sm`,
  `inset_md`
- **Borders**: `border_radius_xs`, `border_width_2`, `border_color_30`,
  `border_color_a_50`
- **Shadows**: `shadow_md`, `shadow_top_md`, `shadow_bottom_lg`,
  `shadow_inset_xs`, `shadow_inset_top_sm`, `shadow_inset_bottom_xs`,
  `shadow_alpha_50`, `shadow_color_umbra` (also `_highlight`, `_glow`,
  `_shroud`)
- **Hue**: `hue_a` through `hue_j` (sets `--hue` variable)

### Composite Classes

| Class         | What it does                                                       |
| ------------- | ------------------------------------------------------------------ |
| `box`         | Flex column, items centered, justify centered                      |
| `row`         | Flex row, align-items centered (overrides `box` direction)         |
| `column`      | Flex column (like `box` but uncentered)                            |
| `panel`       | Embedded container with tinted background and border-radius        |
| `pane`        | Floating container with opaque background and shadow               |
| `ellipsis`    | Block with text truncation (nowrap, overflow hidden, ellipsis)     |
| `clickable`   | Hover/focus/active scale transform effects (includes state styles) |
| `selectable`  | Button-like fill with hover/active/selected states                 |
| `chip`        | Inline label with padding and `color_X` hue variants               |
| `menuitem`    | Full-width list item with icon, title, and selected state          |
| `icon_button` | Square button sized to `--input_height` (flex-shrink: 0)           |
| `plain`       | Transparent border/fill/shadow when not hovered                    |
| `pixelated`   | Crisp pixel-art image rendering                                    |
| `circular`    | `border-radius: 50%`                                               |
| `chevron`     | Small right-pointing arrow via CSS border trick                    |
| `sm`          | Tighter sizing by overriding `--font_size`, `--input_height`, etc. |
| `md`          | Default sizing reset (reverses `sm` in a cascade)                  |
| `mb_flow`     | Flow-aware `margin-bottom` (responds to `--flow_margin`)           |
| `mt_flow`     | Flow-aware `margin-top` (responds to `--flow_margin`)              |

**Gotcha**: Composites with rulesets (`clickable`, `selectable`, `menuitem`,
`plain`, `chip`) already include state styles. `hover:clickable` is redundant.

### Literal Classes

`property:value` maps directly to CSS:

```svelte
<div class="display:flex justify-content:center gap:var(--space_md)">
```

**Space encoding**: Use `~` for spaces in multi-value properties:

```svelte
<div class="margin:0~auto padding:var(--space_sm)~var(--space_lg)">
<div class="width:calc(100%~-~20px)">  <!-- calc requires ~ around +/- -->
```

If you need more than 2-3 `~` characters, use a `<style>` block instead.

## Modifiers

State/responsive/color-scheme styling that inline styles can't do:

```svelte
<!-- Responsive -->
<div class="display:none md:display:flex">

<!-- State -->
<button class="hover:opacity:80% focus:outline:2px~solid~var(--color_a_50)">

<!-- Color-scheme -->
<div class="box-shadow:var(--shadow_lg) dark:box-shadow:var(--shadow_sm)">

<!-- Pseudo-element (explicit content required) -->
<div class='before:content:"" before:display:block before:width:2rem'>
```

### Available Modifiers

**Responsive breakpoints**: `sm:` (40rem), `md:` (48rem), `lg:` (64rem), `xl:`
(80rem), `2xl:` (96rem). Max-width variants: `max-sm:`, `max-md:`, etc.
Arbitrary: `min-width(800px):`, `max-width(600px):`

**State modifiers — interaction**: `hover:`, `focus:`, `focus-visible:`,
`focus-within:`, `active:`, `visited:`, `any-link:`, `link:`, `target:`

**State modifiers — form**: `disabled:`, `enabled:`, `checked:`,
`indeterminate:`, `valid:`, `invalid:`, `user-valid:`, `user-invalid:`,
`required:`, `optional:`, `autofill:`, `blank:`, `default:`, `in-range:`,
`out-of-range:`, `placeholder-shown:`, `read-only:`, `read-write:`

**State modifiers — structural**: `first:`, `last:`, `only:`, `odd:`, `even:`,
`first-of-type:`, `last-of-type:`, `only-of-type:`, `empty:`. Parameterized:
`nth-child(2n+1):`, `nth-last-child(2n):`, `nth-of-type(2n):`,
`nth-last-of-type(2n):`

**State modifiers — UI**: `fullscreen:`, `modal:`, `open:`, `popover-open:`,
`paused:`, `playing:`

**Media features**: `print:`, `motion-safe:`, `motion-reduce:`,
`contrast-more:`, `contrast-less:`, `portrait:`, `landscape:`, `forced-colors:`

**Ancestor modifiers**: `dark:`, `light:`

**Pseudo-elements**: `before:`, `after:`, `placeholder:`, `selection:`,
`marker:`, `first-letter:`, `first-line:`, `cue:`, `file:`, `backdrop:`

### Modifier Order

`[media]:[ancestor]:[state...]:[pseudo-element]:property:value`

```svelte
<!-- Correct -->
<div class="md:dark:hover:opacity:80%">
<div class="md:hover:before:opacity:100%">

<!-- Multiple states must be alphabetical -->
<button class="focus:hover:outline:2px~solid~blue">  <!-- focus < hover -->

<!-- Wrong - will error -->
<div class="dark:md:hover:opacity:80%">   <!-- ancestor before media -->
<div class="hover:focus:opacity:80%">     <!-- h > f, not alphabetical -->
```

### Modifiers in Practice

Responsive design typically uses `@media` queries in component `<style>`
blocks. Modifier classes are most common for hover/focus states on literal
classes. The full responsive modifier system is available, but convention
favors `<style>` for complex responsive layouts.

## Class Extraction

Classes extracted via AST parsing at build time:

- `class="..."` attributes
- `class={[...]}` and `class={{...}}` (Svelte 5.16+)
- `class:name` directives
- `clsx()`, `cn()`, `cx()` calls
- Variables ending in `classes`/`className`

### Dynamic Classes

For dynamically constructed class strings the extractor can't see statically,
use `@fuz-classes` comments:

```typescript
// @fuz-classes opacity:50% opacity:75% opacity:100%
const opacity_classes = [50, 75, 100].map((n) => `opacity:${n}%`);
```

Outside fuz_css's own docs site, AST extraction handles all cases and
`@fuz-classes` is rarely needed.

### Dynamic Elements

`@fuz-elements` declares HTML elements whose base styles should be included when
not statically detectable:

```typescript
// @fuz-elements button input textarea
```

### Dynamic Variables

`@fuz-variables` includes specific theme variables even when not caught by the
automatic `var(--name)` scan:

```typescript
// @fuz-variables shade_40 text_50
```

**Automatic variable detection**: CSS variables are also detected via regex scan
of `var(--name)` patterns. Only known theme variables are included; unknown ones
silently ignored. Catches usage in component props like
`size="var(--icon_size_xs)"` that AST-based extraction would miss.

### Error Handling

- **Auto-detected classes/elements/variables**: silently skip if unresolvable
- **`@fuz-classes`/`@fuz-elements`/`@fuz-variables` entries**: error if
  unresolvable (explicitly requested), with typo suggestions via string
  similarity

## Dynamic Theming

### Runtime Variable Overrides

Use Svelte's `style:` directive for runtime CSS variable overrides:

```svelte
<div style:--docs_menu_width={width}>
<Alert style:--text_color={color}>
<HueInput style:--hue={value}>
```

Components expose CSS variables as their theming API; consumers override inline.

### Color Scheme

Dark/light mode controlled by `dark`/`light` class on the root element.
`style.css` includes `:root.dark { color-scheme: dark; }` and
`:root.light { color-scheme: light; }`. Theme state (persistence, system
preference) is handled by fuz_ui's `ThemeState` class and `ThemeRoot`
component.

### Theme Switching

Three built-in themes: `base`, `low contrast`, `high contrast`. Custom themes
are arrays of `StyleVariable` overrides. Theme CSS is rendered via
`render_theme_style()` with higher specificity (default `:root:root`) to
override bundled theme variables regardless of CSS insertion order.

## Component Styling Philosophy

The fuz stack's core styling principle: **components should have minimal custom
CSS, delegating to fuz_css**. Most need zero or near-zero lines in their
`<style>` block. The design system exists so components don't reinvent layout,
spacing, color, or typography.

### What "Minimal Styles" Looks Like

Across fuz_ui's 65 components, ~30 have no `<style>` block at all. The rest
typically have 5-30 lines covering positioning, animations, or complex
pseudo-states. Shared traits:

- **No `<style>` block when possible** — all styling comes from semantic HTML
  and utility classes
- **When `<style>` exists, it's component-specific** — positioning, transitions,
  responsive breakpoints, complex parent-child selectors
- **All colors, spacing, typography come from design tokens** — never hardcoded
  values
- **Layout uses composites and utilities** — `box`, `row`, `column`, `panel`,
  `p_md`, `gap_lg` instead of manual flex declarations
- **Stateful styling is conventional** — `class={{selected: ...}}` on a button or
  link rides on fuz_css's built-in `.selected` rules; no custom CSS needed

```svelte
<!-- GOOD: No <style> block needed — semantic HTML + utility classes -->
<aside class="column gap_md">
	<h2>{title}</h2>
	<small class="text_50">{subtitle}</small>
	<p>{description}</p>
	<button class="color_a">Confirm</button>
	<button class={['color_c', {selected: destructive}]}>Delete</button>
</aside>
```

Real example from fuz_ui's `Details.svelte`, `EcosystemLinks.svelte`,
`Mdz.svelte`, `Hashlink.svelte`, `LibrarySummary.svelte`: all use semantic
HTML directly (`<details>`, `<summary>`, `<ul>`, `<li>`, `<a>`, `<p>`) and
ride on the default element styling.

### Anti-Patterns

These patterns indicate a component is doing too much styling work:

#### Reimplementing semantic defaults

```svelte
<!-- BAD: rebuilding what <small> already does -->
<span class="subtitle">{text}</span>

<!-- GOOD: the element does the work -->
<small class="text_70">{text}</small>

<style>
	.subtitle {
		color: var(--text_70);
		font-size: var(--font_size_sm);
	}
</style>
```

```svelte
<!-- BAD: rebuilding what <aside> already does -->
<div class="info-box">{message}</div>

<!-- GOOD: the element is the callout -->
<aside>{message}</aside>

<style>
	.info-box {
		border-left: 3px solid var(--border_color);
		padding: var(--space_md);
		background: var(--fg_10);
	}
</style>
```

#### Writing flex layout in `<style>` instead of using composites

```svelte
<!-- BAD: manual flex in <style> -->
<div class="container">...</div>
<div class="header">...</div>

<!-- GOOD: utility classes -->
<div class="column gap_md">...</div>
<div class="row">...</div>

<style>
	.container {
		display: flex;
		flex-direction: column;
		gap: var(--space_md);
	}
	.header {
		display: flex;
		align-items: center;
	}
</style>
```

#### Custom button colors/states when class conventions work

```svelte
<!-- BAD: hand-rolled destructive button -->
<button class={['delete-btn', {active: pending}]}>Delete</button>

<!-- GOOD: built-in conventions handle it -->
<button class={['color_c', {selected: pending}]}>Delete</button>

<style>
	.delete-btn {
		color: var(--color_c_50);
		border-color: var(--color_c_50);
	}
	.delete-btn.active {
		background: var(--color_c_40);
	}
</style>
```

#### Repeating the same layout patterns across components

If multiple components each define their own `.sidebar`, `.header`, `.content`
classes with the same flex/padding/border patterns, those should be utility
classes, project `style.css` classes, or composites.

#### Hardcoding pixel values

```svelte
<!-- BAD: hardcoded pixels -->
<style>
  .sidebar { width: 220px; padding-top: 40px; }
</style>

<!-- GOOD: design tokens or CSS custom properties -->
<style>
  .sidebar { width: var(--sidebar_width); padding-top: var(--space_xl2); }
</style>
```

### When Custom CSS IS Justified

Custom `<style>` blocks are appropriate for:

- **Complex interactive states** — multi-property hover/active/selected
  combinations, especially with `color-mix` shadows or parent-child selectors
  like `.parent:hover .child`. Examples: tab shadow state machines,
  hover-to-reveal controls (see fuz_ui's `Hashlink.svelte` for the
  parent-hover-reveal pattern).
- **Structural behavior** — `flex-direction: column-reverse` for bottom-up
  scrolling, `position: sticky/absolute/fixed` with calculated offsets
- **Responsive layouts** — `@media` queries for structural layout changes
  (e.g., `Card.svelte` shrinks icon and font at narrow widths)
- **Animations/transitions** — `@keyframes`, `transition` definitions
- **Rendering contexts** — canvas, 3D, or other surfaces with inherently
  custom layout
- **Theming APIs for child consumers** — declaring CSS custom properties
  that consumers override via `style:` (e.g., `Alert.svelte` exposes
  `--text_color`)

Even justified custom CSS should use design tokens (`var(--space_md)`,
`var(--border_color)`), not hardcoded values.

### Project `style.css` for Shared App Patterns

When a pattern recurs across multiple components in one app but isn't general
enough for fuz_css, put it in the project's `style.css` (e.g.,
`src/routes/style.css`) — the right place for app-scoped shared classes: button
variants, layout columns, drag indicators, scroll shadows, etc.

Mark patterns with `// TODO upstream` if they might belong in fuz_css. This keeps
component `<style>` blocks focused on truly component-specific logic while
avoiding premature generalization into the design system.

### Class Naming Conventions

Two naming systems coexist:

- **fuz_css design tokens**: `snake_case` — `p_md`, `color_a_50`, `gap_lg`,
  `font_size_sm`. The global vocabulary.
- **Component-local classes**: `kebab-case` — `nav-separator`, `edit-sidebar`,
  `character-entry`. Distinguishes component-scoped styles from design
  system classes at a glance.

```svelte
<!-- snake_case = fuz_css utility, kebab-case = component-local -->
<div class="column gap_md site-header">
	<nav class="row gap_sm nav-links">...</nav>
</div>

<style>
	.site-header {
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.nav-links {
		border-bottom: var(--border_width_1) var(--border_style) var(--border_color);
	}
</style>
```

This convention is fully adopted across the ecosystem — component-local
classes were migrated from `snake_case` to `kebab-case`.

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

### Rules of Thumb

`<style>` blocks are the default for non-trivial styling; existing ones
shouldn't be churned into class strings (§Style tags vs utility classes —
direction matters), and the table above maps each scenario to its tool. The one
heuristic the table doesn't capture: **long class strings are a smell** — 4–6
classes is the comfortable upper bound, and 8+ (especially with several literal
`property:value` classes) usually reads worse than the equivalent `<style>`
block with design tokens. `<style>` blocks also get IDE autocomplete and compose
with conditional logic without `clsx` gymnastics.

## Quick Reference

### Common Spacing

| Class     | CSS                                                             |
| --------- | --------------------------------------------------------------- |
| `p_md`    | `padding: var(--space_md)`                                      |
| `px_lg`   | `padding-left: var(--space_lg); padding-right: var(--space_lg)` |
| `mt_xl`   | `margin-top: var(--space_xl)`                                   |
| `mx_auto` | `margin-left: auto; margin-right: auto`                         |
| `gap_sm`  | `gap: var(--space_sm)`                                          |

### Common Layout

| Class / literal                 | What it does                    |
| ------------------------------- | ------------------------------- |
| `box`                           | Flex column, centered both axes |
| `row`                           | Flex row, align-items centered  |
| `column`                        | Flex column (uncentered)        |
| `display:flex`                  | Flexbox                         |
| `flex:1`                        | Flex grow                       |
| `flex-wrap:wrap`                | Allow wrapping                  |
| `align-items:center`            | Cross-axis center               |
| `justify-content:space-between` | Even spacing                    |
| `width:100%`                    | Full width                      |

### Common Typography

| Class                  | What it does                        |
| ---------------------- | ----------------------------------- |
| `font_size_lg`         | Large text                          |
| `font_family_mono`     | Monospace font                      |
| `ellipsis`             | Truncate with ...                   |
| `text-align:center`    | Center text                         |
| `white-space:pre-wrap` | Preserve whitespace, allow wrapping |

### Cascading Variable Pattern

Many token classes set both a CSS property and a cascading custom property, so
children can inherit:

- `font_size_lg` sets `font-size` and `--font_size`
- `color_a_50` sets `color` and `--text_color`
- `border_color_30` sets `border-color` and `--border_color`
- `shadow_color_umbra` sets `--shadow_color`

Children of `font_size_lg` can reference `var(--font_size)` for the inherited
value.
