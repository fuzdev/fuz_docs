# CSS Patterns

Guide to fuz_css usage and styling conventions across the Fuz ecosystem.

fuz_css is a CSS framework built around **semantic styles** (classless element
defaults) and **style variables** (design tokens as CSS custom properties), with
optional **utility classes** generated per-project to include only what's used.

## Contents

- [Project Setup](#project-setup)
- [Three-Layer Architecture](#three-layer-architecture)
- [Style Variables (Design Tokens)](#style-variables-design-tokens)
- [CSS Classes](#css-classes)
- [Modifiers](#modifiers)
- [Class Extraction](#class-extraction)
- [Dynamic Theming](#dynamic-theming)
- [When to Use Classes vs Styles](#when-to-use-classes-vs-styles)
- [Quick Reference](#quick-reference)

## Project Setup

### Import Order

Projects import CSS in `+layout.svelte` (in `src/routes`). The first import is
universal; the others are included as needed:

```typescript
import './fuz.css'; // generated bundled CSS (all projects)
import '@fuzdev/fuz_code/theme.css'; // package-specific themes (if any)
import './style.css'; // project-specific global styles (app projects)
```

Library/tool repos (fuz_css, fuz_ui, `gro`, etc.) often import only `fuz.css`.
Application repos (fuz_template, fuz_blog, zzz, etc.) typically use all three.

### CSS Generation

Every project has an identical `src/routes/fuz.gen.css.ts`:

```typescript
import {gen_fuz_css} from '@fuzdev/fuz_css/gen_fuz_css.js';

export const gen = gen_fuz_css();
```

No custom options needed — default bundled mode with tree-shaking handles
everything. Run `gro gen` to regenerate after adding new classes.

### Project `style.css`

Project-specific global styles go in `src/routes/style.css`:

- Custom element overrides (e.g., heading fonts, textarea styling)
- Patterns being prototyped before upstreaming to fuz_css
- App-specific layout (e.g., sidebar widths, primary nav height)

Keep it minimal — most apps have near-empty `style.css` files.

## Three-Layer Architecture

| Layer              | File        | Purpose                                                   |
| ------------------ | ----------- | --------------------------------------------------------- |
| 1. Semantic styles | `style.css` | Reset + element defaults (buttons, inputs, forms, tables) |
| 2. Style variables | `theme.css` | ~250+ design tokens as CSS custom properties              |
| 3. Utility classes | `fuz.css`   | Optional, generated per-project with only used classes    |

### Semantic Styles

`style.css` styles HTML elements without classes using low-specificity `:where()`
selectors. Elements get sensible defaults automatically — buttons look like
buttons, inputs look like inputs, lists have bullets.

### `.unstyled` Class

Use `.unstyled` to opt out of semantic element styling:

```svelte
<ul class="unstyled column gap_xs">  <!-- reset list, use as flex column -->
<a class="unstyled">                 <!-- reset link styling -->
<menu class="unstyled row gap_sm">   <!-- reset menu, use as flex row -->
```

Common for navigation menus, custom list components, and links used as buttons.
Used in 11+ fuz_ui components.

## Style Variables (Design Tokens)

Defined in TypeScript, rendered to CSS. Each can have `light` and/or `dark`
values.

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

| Prefix      | Behavior                   | Use case                       |
| ----------- | -------------------------- | ------------------------------ |
| `bg_*`      | Swaps in dark mode (alpha) | Backgrounds that stack         |
| `fg_*`      | Swaps in dark mode (alpha) | Foreground overlays            |
| `darken_*`  | Always darkens (agnostic)  | Shadows, borders               |
| `lighten_*` | Always lightens (agnostic) | Highlights                     |
| `text_*`    | Opaque, scheme-aware       | Text (alpha hurts readability) |
| `shade_*`   | Neutral tints (00→100)     | Neutral backgrounds            |

### Sizes

`xs5` → `xs4` → `xs3` → `xs2` → `xs` → `sm` → `md` → `lg` → `xl` → `xl2` →
... → `xl15` (23 stops for spacing). Other families use subsets: font sizes have
13 stops (`xs`–`xl9`), border radius has 7 (`xs3`–`xl`).

### Theme Specificity

Themes render with `:root:root` (repeated selector) to handle unpredictable CSS
insertion order in bundlers. Dark mode uses `:root:root.dark`.

Colors are HSL-based.

## CSS Classes

Three types of utility classes, generated on-demand (only used classes included):

| Type                  | Example                               | Purpose                      |
| --------------------- | ------------------------------------- | ---------------------------- |
| **Token classes**     | `.p_md`, `.color_a_50`, `.gap_lg`     | Map to style variables       |
| **Composite classes** | `.box`, `.row`, `.ellipsis`           | Multi-property shortcuts     |
| **Literal classes**   | `.display:flex`, `.hover:opacity:80%` | Arbitrary CSS property:value |

### Token Classes

Map directly to style variable values:

- **Spacing**: `p_md`, `px_lg`, `mt_xl`, `gap_sm`, `mx_auto`
- **Colors**: `color_a_50`, `bg_10`, `shade_00`, `text_70`
- **Typography**: `font_size_lg`, `font_family_mono`
- **Layout**: `width_md`, `width_atmost_lg`, `border_radius_xs`
- **Shadows**: `shadow_md`, `shadow_inset_xs`

### Composite Classes

Multi-property shortcuts for common patterns:

| Class         | What it does                                                     |
| ------------- | ---------------------------------------------------------------- |
| `box`         | Flex column, items centered, justify centered                    |
| `row`         | Flex row, items centered                                         |
| `column`      | Flex column (not centered)                                       |
| `panel`       | Embedded container with tinted background and border-radius      |
| `pane`        | Floating container with shadow (dialogs, popovers)               |
| `ellipsis`    | Text truncation with overflow hidden and ellipsis                |
| `clickable`   | Hover/focus/active transform effects (includes own state styles) |
| `selectable`  | Button-like fill with hover/active/selected states               |
| `chip`        | Inline label with padding and optional hue color variants        |
| `menuitem`    | Full-width list item with icon, title, and selected state        |
| `icon_button` | Square button sized to input height                              |
| `plain`       | Transparent border/fill/shadow, visible on hover                 |
| `pixelated`   | Crisp pixel-art image rendering                                  |
| `circular`    | `border-radius: 50%`                                             |
| `chevron`     | Small right-pointing arrow via CSS border trick                  |

**Gotcha**: Composite classes with rulesets (like `clickable`) already include
state styles. Applying `hover:clickable` is redundant and may produce warnings.

### Literal Classes

`property:value` maps directly to CSS:

```svelte
<div class="display:flex justify-content:center gap:var(--space_md)">
```

**Space encoding**: Use `~` for spaces in multi-value properties (CSS classes
can't contain spaces):

```svelte
<div class="margin:0~auto padding:var(--space_sm)~var(--space_lg)">
<div class="width:calc(100%~-~20px)">  <!-- calc requires ~ around +/- -->
```

**Rule of thumb**: If you need more than 2-3 `~` characters, use a `<style>`
block instead.

## Modifiers

Modifiers enable state/responsive/color-scheme styling that inline styles can't
do:

```svelte
<!-- Responsive -->
<div class="display:none md:display:flex">

<!-- State -->
<button class="hover:opacity:80% focus:outline:2px~solid~var(--color_a_50)">

<!-- Color-scheme -->
<div class="box-shadow:var(--shadow_lg) dark:box-shadow:var(--shadow_sm)">

<!-- Pseudo-element (explicit content required) -->
<div class="before:content:'' before:display:block before:width:2rem">
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
`nth-child(2n+1):`, `nth-of-type(2n):`

**State modifiers — UI**: `fullscreen:`, `modal:`, `open:`, `popover-open:`,
`paused:`, `playing:`

**Media features**: `print:`, `motion-safe:`, `motion-reduce:`,
`contrast-more:`, `contrast-less:`, `portrait:`, `landscape:`, `forced-colors:`

**Ancestor modifiers**: `dark:`, `light:`

**Pseudo-elements**: `before:`, `after:`, `placeholder:`, `selection:`,
`marker:`, `first-letter:`, `first-line:`, `cue:`, `file:`, `backdrop:`

### Modifier Order

Order must be: `[media]:[ancestor]:[state...]:[pseudo-element]:property:value`

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

In the current ecosystem, responsive design typically uses `@media` queries in
component `<style>` blocks rather than modifier classes. Modifier classes are
most commonly used for hover/focus states on literal classes. The full responsive
modifier system is available but conventional usage favors `<style>` for complex
responsive layouts.

## Class Extraction

Classes are extracted via AST parsing at build time. Extraction handles:

- `class="..."` attributes
- `class={[...]}` and `class={{...}}` (Svelte 5.16+)
- `class:name` directives
- `clsx()`, `cn()`, `cx()` calls
- Variables ending in `classes`/`className`

### Dynamic Classes

For dynamically constructed class strings the extractor can't see statically, use
`@fuz-classes` comments:

```typescript
// @fuz-classes opacity:50% opacity:75% opacity:100%
const opacity_classes = [50, 75, 100].map((n) => `opacity:${n}%`);
```

The fuz_css docs site uses `@fuz-classes` extensively for demo pages (shadows,
shading, typography, borders). Outside fuz_css, AST extraction handles all cases
and `@fuz-classes` is rarely needed.

### Dynamic Elements

Similarly, use `@fuz-elements` to declare HTML elements whose base styles should
be included even when not statically detectable:

```typescript
// @fuz-elements button input textarea
```

### Error Handling

- **Auto-detected classes/elements**: Silently skip if unresolvable (might be
  from another CSS framework)
- **`@fuz-classes`/`@fuz-elements` entries**: Produce errors if unresolvable
  (you explicitly requested them), with typo suggestions via string similarity

## Dynamic Theming

Use Svelte's `style:` directive for runtime CSS variable overrides:

```svelte
<div style:--docs_menu_width={width}>
<Alert style:--text_color={color}>
<HueInput style:--hue={value}>
```

This allows component-scoped theme customization without generating new classes.
Components can expose CSS variables as their theming API, and consumers override
them inline.

## When to Use Classes vs Styles

| Need                   | Style tag | Utility class | Inline style |
| ---------------------- | --------- | ------------- | ------------ |
| Style own elements     | **Best**  | OK            | OK           |
| Style child components | No        | **Yes**       | Limited      |
| Hover/focus/responsive | Yes       | **Yes**       | No           |
| Runtime dynamic values | No        | No            | **Yes**      |
| IDE autocomplete       | **Yes**   | No            | Partial      |

### Rules of Thumb

- **Literal classes are the primary layout mechanism** — `display:flex`,
  `gap_md`, `justify-content:center` appear in nearly every component
- **`<style>` blocks for complex styling** — media queries, animations, complex
  selectors, pseudo-elements with multiple properties
- **Token classes for design system values** — spacing (`p_md`, `gap_lg`) and
  colors (`color_a_50`) maintain consistency; avoid hardcoded values
- **Inline `style:prop` for runtime values** — dynamic widths, computed colors,
  CSS variable overrides
- **Keep class strings manageable** — if a `<div>` accumulates 5+ utility
  classes, consider whether a `<style>` rule would be clearer
- **Use `<style>` for responsive layouts** — `@media` queries in component
  styles are the conventional approach; reserve responsive modifiers (`md:`,
  `lg:`) for simple one-off overrides

## Quick Reference

### Common Spacing

| Class     | CSS                               |
| --------- | --------------------------------- |
| `p_md`    | `padding: var(--space_md)`        |
| `px_lg`   | `padding-inline: var(--space_lg)` |
| `mt_xl`   | `margin-top: var(--space_xl)`     |
| `mx_auto` | `margin-inline: auto`             |
| `gap_sm`  | `gap: var(--space_sm)`            |

### Common Layout

| Class / literal                 | What it does          |
| ------------------------------- | --------------------- |
| `box`                           | Flex column, centered |
| `row`                           | Flex row, centered    |
| `column`                        | Flex column           |
| `display:flex`                  | Flexbox               |
| `flex:1`                        | Flex grow             |
| `flex-wrap:wrap`                | Allow wrapping        |
| `align-items:center`            | Cross-axis center     |
| `justify-content:space-between` | Even spacing          |
| `width:100%`                    | Full width            |

### Common Typography

| Class                  | What it does                        |
| ---------------------- | ----------------------------------- |
| `font_size_lg`         | Large text                          |
| `font_family_mono`     | Monospace font                      |
| `ellipsis`             | Truncate with ...                   |
| `text-align:center`    | Center text                         |
| `white-space:pre-wrap` | Preserve whitespace, allow wrapping |
