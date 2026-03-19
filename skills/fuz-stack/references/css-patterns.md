# CSS Patterns

fuz_css: **semantic styles** (classless element defaults), **style variables**
(design tokens as CSS custom properties), and optional **utility classes**
generated per-project with only used classes.

## Project Setup

### Import Order

Import CSS in `+layout.svelte` (`src/routes`). First import is universal;
others as needed:

```typescript
import '$routes/fuz.css'; // generated bundled CSS (all projects)
import '@fuzdev/fuz_code/theme.css'; // package-specific themes (if any)
import '$routes/style.css'; // project-specific global styles (app projects)
```

`$routes` resolves to `src/routes` in SvelteKit. Library/tool repos
(fuz_css, fuz_ui, `gro`, etc.) often import only `fuz.css`. Application repos
(fuz_template, fuz_blog, zzz, etc.) typically use all three.

### CSS Generation

Most consumer projects have an identical `src/routes/fuz.gen.css.ts`:

```typescript
import {gen_fuz_css} from '@fuzdev/fuz_css/gen_fuz_css.js';

export const gen = gen_fuz_css();
```

No custom options needed — default bundled mode with tree-shaking handles
everything. Run `gro gen` to regenerate after adding new classes.

fuz_css itself uses `gen_fuz_css({additional_variables: 'all'})` to include all
variables for its docs site demos.

**Vite plugin alternative**: For non-SvelteKit projects (Svelte, React, Preact,
Solid):

```typescript
// vite.config.ts
import {vite_plugin_fuz_css} from '@fuzdev/fuz_css/vite_plugin_fuz_css.js';
export default defineConfig({plugins: [vite_plugin_fuz_css()]});

// main.ts
import 'virtual:fuz.css';
```

The Vite plugin supports HMR — source changes automatically trigger CSS
regeneration.

### Project `style.css`

Project-specific global styles in `src/routes/style.css`:

- Custom element overrides (e.g., heading fonts, textarea styling)
- Patterns being prototyped before upstreaming to fuz_css
- App-specific layout (e.g., sidebar widths, primary nav height)

Keep minimal — most apps have near-empty `style.css` files.

## Three-Layer Architecture

| Layer              | File        | Purpose                                                   |
| ------------------ | ----------- | --------------------------------------------------------- |
| 1. Semantic styles | `style.css` | Reset + element defaults (buttons, inputs, forms, tables) |
| 2. Style variables | `theme.css` | 600+ design tokens as CSS custom properties               |
| 3. Utility classes | `fuz.css`   | Optional, generated per-project with only used classes    |

### Semantic Styles

`style.css` styles HTML elements without classes using low-specificity `:where()`
selectors. Elements get sensible defaults automatically.

Key behaviors:

- **Flow margins**: Block elements (`p`, `ul`, `ol`, `form`, `fieldset`,
  `table`, `textarea`, etc.) get `margin-bottom: var(--flow_margin, var(--space_lg))`
  unless `:last-child`
- **Row margin reset**: `.row > *` resets margins to 0 (use `gap_*` instead)
- **Button styling**: Fill, border, shadow, hover/active/disabled/selected
  states. Hue variants via `color_a`-`color_j` classes
- **Input styling**: Inputs, textareas, selects share consistent sizing and
  borders

### `.unstyled` Class

Opts out of opinionated styling (colors, borders, decorative properties) while
keeping normalizations (font inheritance, border-collapse):

```svelte
<ul class="unstyled column gap_xs">  <!-- reset list, use as flex column -->
<a class="unstyled">                 <!-- reset link styling -->
<menu class="unstyled row gap_sm">   <!-- reset menu, use as flex row -->
```

Common for navigation menus, custom list components, and links used as buttons.
Applied to interactive elements and decorative containers.

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

| Prefix      | Behavior                                          | Use case                      |
| ----------- | ------------------------------------------------- | ----------------------------- |
| `fg_*`      | Toward contrast (darkens light, lightens dark)     | Foreground overlays that stack |
| `bg_*`      | Toward surface (lightens light, darkens dark)      | Background overlays that stack |
| `darken_*`  | Always darkens (agnostic, alpha-based)             | Shadows, backdrops            |
| `lighten_*` | Always lightens (agnostic, alpha-based)            | Highlights                    |
| `text_*`    | Opaque, scheme-aware (low=subtle, high=bold)       | Text (alpha hurts performance) |
| `shade_*`   | Opaque, tinted neutrals (00→100), scheme-aware     | Backgrounds, surfaces         |

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
`render_theme_style()`): selector repeats for higher specificity (default
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
- **Shadows**: `shadow_md`, `shadow_inset_xs`, `shadow_alpha_50`,
  `shadow_color_umbra`
- **Hue**: `hue_a` through `hue_j` (sets `--hue` variable)

### Composite Classes

| Class         | What it does                                                     |
| ------------- | ---------------------------------------------------------------- |
| `box`         | Flex column, items centered, justify centered                    |
| `row`         | Flex row, align-items centered (overrides `box` direction)       |
| `column`      | Flex column (like `box` but uncentered)                          |
| `panel`       | Embedded container with tinted background and border-radius      |
| `pane`        | Floating container with opaque background and shadow             |
| `ellipsis`    | Block with text truncation (nowrap, overflow hidden, ellipsis)   |
| `clickable`   | Hover/focus/active scale transform effects (includes state styles) |
| `selectable`  | Button-like fill with hover/active/selected states               |
| `chip`        | Inline label with padding and `color_X` hue variants             |
| `menuitem`    | Full-width list item with icon, title, and selected state        |
| `icon_button` | Square button sized to `--input_height` (flex-shrink: 0)         |
| `plain`       | Transparent border/fill/shadow when not hovered                  |
| `pixelated`   | Crisp pixel-art image rendering                                  |
| `circular`    | `border-radius: 50%`                                             |
| `chevron`     | Small right-pointing arrow via CSS border trick                  |
| `sm`          | Tighter sizing by overriding `--font_size`, `--input_height`, etc. |
| `md`          | Default sizing reset (reverses `sm` in a cascade)                |
| `mb_flow`     | Flow-aware `margin-bottom` (responds to `--flow_margin`)         |
| `mt_flow`     | Flow-aware `margin-top` (responds to `--flow_margin`)            |

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
`nth-child(2n+1):`, `nth-of-type(2n):`

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
blocks. Modifier classes are most commonly used for hover/focus states on
literal classes. The full responsive modifier system is available but
convention favors `<style>` for complex responsive layouts.

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

`@fuz-elements` declares HTML elements whose base styles should be included
when not statically detectable:

```typescript
// @fuz-elements button input textarea
```

### Dynamic Variables

`@fuz-variables` ensures specific theme variables are included even when not
detected by the automatic `var(--name)` scan:

```typescript
// @fuz-variables shade_40 text_50
```

**Automatic variable detection**: CSS variables also detected via regex scan of
`var(--name)` patterns. Only known theme variables included; unknown silently
ignored. Catches usage in component props like `size="var(--icon_size_xs)"` that
AST-based extraction would miss.

### Error Handling

- **Auto-detected classes/elements/variables**: Silently skip if unresolvable
- **`@fuz-classes`/`@fuz-elements`/`@fuz-variables` entries**: Error if
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
`:root.light { color-scheme: light; }`. Theme state management (persistence,
system preference) handled by fuz_ui's `ThemeState` class and `ThemeRoot`
component.

### Theme Switching

Three built-in themes: `base`, `low contrast`, `high contrast`. Custom themes
are arrays of `StyleVariable` overrides. Theme CSS rendered via
`render_theme_style()` with higher specificity (default `:root:root`) to
override bundled theme variables regardless of CSS insertion order.

## When to Use Classes vs Styles

| Need                   | Style tag | Utility class | Inline style |
| ---------------------- | --------- | ------------- | ------------ |
| Style own elements     | **Best**  | OK            | OK           |
| Style child components | No        | **Yes**       | Limited      |
| Hover/focus/responsive | Yes       | **Yes**       | No           |
| Runtime dynamic values | No        | No            | **Yes**      |
| IDE autocomplete       | **Yes**   | No            | Partial      |

### Rules of Thumb

- **Literal classes for primary layout** — `display:flex`, `gap_md`,
  `justify-content:center` appear in nearly every component
- **`<style>` blocks for complex styling** — media queries, animations,
  complex selectors, multi-property pseudo-elements
- **Token classes for design system values** — spacing (`p_md`, `gap_lg`)
  and colors (`color_a_50`) maintain consistency; avoid hardcoded values
- **Inline `style:prop` for runtime values** — dynamic widths, computed
  colors, CSS variable overrides
- **Keep class strings manageable** — if a `<div>` accumulates 5+ utility
  classes, consider a `<style>` rule
- **`<style>` for responsive layouts** — `@media` queries in component styles
  are conventional; reserve responsive modifiers for simple one-off overrides

## Quick Reference

### Common Spacing

| Class     | CSS                                                            |
| --------- | -------------------------------------------------------------- |
| `p_md`    | `padding: var(--space_md)`                                     |
| `px_lg`   | `padding-left: var(--space_lg); padding-right: var(--space_lg)` |
| `mt_xl`   | `margin-top: var(--space_xl)`                                  |
| `mx_auto` | `margin-left: auto; margin-right: auto`                        |
| `gap_sm`  | `gap: var(--space_sm)`                                         |

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

Many token classes set both a CSS property and a cascading custom property,
enabling children to inherit:

- `font_size_lg` sets `font-size` and `--font_size`
- `color_a_50` sets `color` and `--text_color`
- `border_color_30` sets `border-color` and `--border_color`
- `shadow_color_umbra` sets `--shadow_color`

Children of `font_size_lg` can reference `var(--font_size)` and get the
inherited value.
