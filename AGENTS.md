# AGENTS.md

Guidance for AI coding agents working on `@cosmograph/vis-labels`.

## Project Overview

Vis Labels is a lightweight TypeScript library for rendering many HTML labels over visualization surfaces such as canvas, WebGL, SVG, maps, charts, and graph layouts.

Use it when an app needs DOM-based labels that are easy to style, click, rotate, or render as trusted HTML, while the main visualization remains in another rendering layer.

## Project Structure

- `src/index.ts` - exports `LabelRenderer`, the batch label renderer.
- `src/vis-label.ts` - implements the individual `VisLabel` DOM label class.
- `src/react.tsx` - React wrapper exported from `@cosmograph/vis-labels/react`.
- `src/types.ts` - public types for labels, renderer options, padding, and callbacks.
- `src/styles.ts` and `src/styles.css` - injected and exported label styles.
- `src/helper.ts` and `src/variables.ts` - small shared helpers and defaults.
- `src/stories/` - Storybook docs, examples, demos, and edge cases.
- `ai/README.md` - published AI-facing usage guide copied into `dist/ai`.
- `dist/` - generated build output. Do not edit by hand.

## Local Development

- Install dependencies with `npm install`.
- Build with `npm run build`.
- Run Storybook with `npm run storybook`.
- Build Storybook with `npm run build-storybook`.
- Lint with `npm run lint`.

The publish path is `dist/`. The build script compiles TypeScript, copies `src/styles.css`, and copies `ai/` into `dist/ai` so AI docs are included in the npm bundle.

## Working Principles

- Make surgical changes. Keep edits as small as the requested behavior allows.
- Preserve the public API unless the user explicitly asks for a breaking change.
- Prefer existing patterns in this repo over new abstractions.
- Keep the runtime lightweight. Do not add dependencies unless there is a strong reason.
- Avoid unrelated refactors while fixing bugs or adding focused behavior.
- Treat `dangerousHtml` as opt-in and security-sensitive.
- Keep Storybook examples useful as behavioral documentation.
- Do not edit generated `dist/` files directly; change source files and run the build.

## Library Reasoning

Large visualizations often need labels, but rendering labels directly in canvas or WebGL makes text styling, multi-line content, hit testing, accessibility hooks, and rich HTML difficult. Rendering every label as unmanaged DOM is also expensive and can flicker when thousands of labels move or overlap.

Vis Labels sits between those options:

- It keeps labels as real HTML elements.
- It reuses DOM nodes by stable label `id`.
- It estimates and caches label size to avoid unnecessary layout work.
- It resolves overlaps with label weights and stable visibility decisions.
- It gives callers direct control over label data, styling, and draw timing.

This library is not a full visualization engine. It should be paired with the layout, camera, zoom, or rendering system that owns the main scene.

## Good Use Cases

- Network graph labels and node annotations.
- Map, chart, timeline, or canvas overlays.
- Thousands of labels that may overlap.
- Labels with priority, using `weight`.
- Plain text labels with custom CSS.
- Trusted rich labels, using `dangerousHtml`.
- Interactive overlays with click handling.
- React apps that need a small wrapper around the renderer.

## API Notes

Use `LabelRenderer` for normal batch rendering:

```ts
import { LabelRenderer } from '@cosmograph/vis-labels'

const renderer = new LabelRenderer(container, {
  fontSize: 12,
  padding: { top: 2, right: 4, bottom: 2, left: 4 },
})

renderer.setLabels([
  { id: 'a', text: 'Alpha', x: 120, y: 80, weight: 10, opacity: 1 },
  { id: 'b', text: 'Beta', x: 135, y: 85, weight: 1, opacity: 1 },
])

renderer.draw()
```

After `draw()`, use `isLabelVisible(id)` or `getVisibleLabelIds()` to find out which labels survived the overlap pass.

Use `VisLabel` directly only when managing a small number of individual labels yourself.

Use the React wrapper from the `react` subpath:

```tsx
import { VisLabels } from '@cosmograph/vis-labels/react'
```

## Label Data Guidance

- Always provide stable, unique `id` values. The renderer uses `id` to reuse DOM nodes.
- Use `x` and `y` in container-local pixel coordinates.
- Use `weight` to decide which label wins when labels overlap. Higher weight is preferred.
- Use `opacity` for visual fade effects, but still call `draw()` after changing label state.
- Use `shouldBeShown` sparingly to force important labels visible.
- Use `rotation` in degrees when label orientation should follow an edge, path, or map feature. Rotated labels are tested for overlap with their rotated box, and changing `rotation` every frame does not re-measure the label.
- Use `maxOuterWidth` to cap a label's whole drawn width in pixels, padding and border included, for example to the length of a link; the `--vis-label-max-width` CSS variable caps the content box instead. Combine it with CSS such as `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` to cut text, or leave text free to wrap.
- Use `path` to lay text along an edge instead of placing it at `x` and `y`: give its `start`, `end` and, for a curve, its `control` point and `weight`; `inset` keeps the text clear of the nodes at either end, and `offset` holds the label off the line. The text reads left to right on the outer side of the bend and is cut with an ellipsis when it doesn't fit.
- A label on a path, straight or curved, is SVG text on a `textPath` over a shape that carries the label's `background-color`, `border` and `border-radius`; the rest of what a CSS box can have, such as `box-shadow`, does not carry over.
- On a path, `padding.bottom` is the gap on the link side and `padding.top` the gap on the far side. The text is drawn in an element of the `vis-label--path` class, over one of the `vis-label--ribbon` class.
- Use `className` or `style` for visual styling, but prefer `fontSize` and `padding` options when those values affect label measurement.

## Performance Tips

- Reuse one `LabelRenderer` per labels container.
- Keep label `id` stable across frames to avoid destroying and recreating DOM nodes.
- Batch updates with `setLabels(labels)` and call `draw()` once per frame.
- When only positions change between frames, move labels with `setLabelPosition(id, x, y, rotation)` instead of passing every label to `setLabels` again.
- Avoid changing text, font size, padding, class names, or large inline styles every frame; those can invalidate measurements.
- Prefer renderer-level `fontSize` and `padding` when many labels share the same values.
- Pass `draw(false)` when overlap resolution is not needed for a frame.
- Keep the labels container sized and positioned over the visualization with CSS.
- Call `destroy()` when removing a renderer to clean up listeners and DOM nodes.

## HTML and Security

By default, label content is assigned with `textContent`, which is safe for untrusted text.

Only enable `dangerousHtml` when all label HTML is trusted or sanitized:

```ts
const renderer = new LabelRenderer(container, { dangerousHtml: true })
```

Never pass user-provided or unsanitized HTML to `dangerousHtml`.
