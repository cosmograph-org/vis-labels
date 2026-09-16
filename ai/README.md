# AI Guide for Vis Labels

Vis Labels (`@cosmograph/vis-labels`) is a lightweight TypeScript library for rendering many HTML labels over visualization surfaces such as canvas, WebGL, SVG, maps, charts, and graph layouts.

Use it when an app needs DOM-based labels that are easy to style, click, rotate, or render as trusted HTML, while the main visualization remains in another rendering layer.

## Why This Library Exists

Large visualizations often need labels, but rendering labels directly in canvas or WebGL makes text styling, multi-line content, hit testing, accessibility hooks, and rich HTML difficult. Rendering every label as unmanaged DOM is also expensive and flickery when thousands of labels move or overlap.

Vis Labels sits between those options:

- It keeps labels as real HTML elements.
- It reuses DOM nodes by stable label `id`.
- It estimates and caches label size to avoid unnecessary layout work.
- It resolves overlaps with label weights and stable visibility decisions.
- It gives callers direct control over label data, styling, and draw timing.

## What It Is Great For

- Network graph labels and node annotations.
- Map, chart, timeline, or canvas overlays.
- Thousands of labels that may overlap.
- Labels with priority, using `weight`.
- Plain text labels with custom CSS.
- Trusted rich labels, using `dangerousHtml`.
- Interactive overlays with click handling.
- React apps that need a small wrapper around the renderer.

It is not a full visualization engine. Pair it with the layout, camera, zoom, or rendering system that owns the main scene.

## Core API

Use `LabelRenderer` for batches of labels:

```ts
import { LabelRenderer } from '@cosmograph/vis-labels'

const container = document.querySelector<HTMLDivElement>('#labels')
if (!container) throw new Error('Missing labels container')

const renderer = new LabelRenderer(container, {
  fontSize: 12,
  padding: { top: 2, right: 4, bottom: 2, left: 4 },
  onLabelClick: (event, label) => {
    console.log(label.id, event.clientX, event.clientY)
  },
})

renderer.setLabels([
  { id: 'a', text: 'Alpha', x: 120, y: 80, weight: 10, opacity: 1 },
  { id: 'b', text: 'Beta', x: 135, y: 85, weight: 1, opacity: 1 },
])

renderer.draw()
```

After `draw()`, ask which labels survived the overlap pass, for example to decorate only the labels that are on screen:

```ts
renderer.isLabelVisible('a')
renderer.getVisibleLabelIds()
```

Use `VisLabel` directly only when managing a small number of individual labels yourself:

```ts
import { VisLabel } from '@cosmograph/vis-labels'

const label = new VisLabel(container, 'Hello')
label.setPosition(100, 120)
label.setVisibility(true)
label.draw()
```

## React Usage

Use the React wrapper from the `react` subpath:

```tsx
import { VisLabels } from '@cosmograph/vis-labels/react'

export function LabelsOverlay (): JSX.Element {
  return (
    <div style={{ position: 'relative', width: 400, height: 300 }}>
      <VisLabels
        labels={[
          { id: 'a', text: 'Alpha', x: 120, y: 80, weight: 10 },
          { id: 'b', text: 'Beta', x: 135, y: 85, weight: 1 },
        ]}
        fontSize={12}
      />
    </div>
  )
}
```

## Label Data Tips

- Always provide stable, unique `id` values. The renderer uses `id` to reuse existing DOM nodes.
- Use `x` and `y` in container-local pixel coordinates.
- Use `weight` to decide which label wins when labels overlap. Higher weight is preferred.
- Use `opacity` for visual fade effects, but still call `draw()` after changing label state.
- Use `shouldBeShown` sparingly to force important labels visible.
- Use `rotation` in degrees when label orientation should follow an edge, path, or map feature. Rotated labels are tested for overlap with their rotated box, and changing `rotation` every frame does not re-measure the label.
- Use `className` or `style` for visual styling, but prefer `fontSize` and `padding` options when those values affect label measurement.

## HTML and Security

By default, label content is assigned with `textContent`, which is safe for untrusted text.

Only enable `dangerousHtml` when all label HTML is trusted or sanitized:

```ts
const renderer = new LabelRenderer(container, { dangerousHtml: true })

renderer.setLabels([
  { id: 'html', text: '<strong>Trusted</strong><br>label', x: 80, y: 40 },
])
```

Never pass user-provided or unsanitized HTML to `dangerousHtml`.

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

## Publishing Note

The package build copies this `ai/` folder into `dist/ai`, so these docs are included in the published npm bundle.
