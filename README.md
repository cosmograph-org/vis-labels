<p align="center" style="color: #444">
  <h1 align="center">Vis Labels</h1>
</p>

Vis Labels is a lightweight, performance-focused library for rendering large numbers of HTML labels with built-in intersection handling. It was created to support scenes with many thousands of overlapping labels while keeping the API small and the rendering model predictable.

It powers label rendering in [Cosmograph](https://cosmograph.app), the fastest web-based network graph rendering framework.

### Why Vis Labels

- Zero-dependency runtime package.
- Built for scale, including large sets of intersecting labels.
- Built-in overlap resolution with weighted label priority.
- Stable visibility decisions to reduce flicker between frames.
- Reuses DOM nodes by label `id` instead of recreating them every draw.
- Uses cached and estimated label measurements to avoid unnecessary layout work.
- Supports plain text, custom CSS, and trusted HTML / multi-line labels.
- Lays text along straight or curved paths, such as the edges between graph nodes.
- Works both as a batch renderer (`LabelRenderer`) and as individual labels (`VisLabel`).
- Optional style injection, exported stylesheet, click handling, and wheel event forwarding for interactive canvases and graphs.

### Quick Start

Install the package:

```bash
npm install @cosmograph/vis-labels
```

Create HTML div element and render labels:

```javascript
import { LabelRenderer } from '@cosmograph/vis-labels'

const div = document.querySelector('#labels')  
const renderer = new LabelRenderer(div)

renderer.setLabels([
  { id: 'monster', text: '👾', x: 100, y: 50, opacity: 1 },
  { id: 'alien', text: '👽', x: 50, y: 150, opacity: 1 },
  { id: 'ufo', text: '🛸', x: 150, y: 150, opacity: 1 },
])
renderer.draw()
```

Or create single Vis label:

```javascript
import { VisLabel } from '@cosmograph/vis-labels'
const div = document.querySelector('#labels')

const label = new VisLabel(div, '🐣')
label.setPosition(100, 110)
label.setVisibility(true)
label.setOpacity(1)
label.draw()
```

### React

Import the React wrapper from the `react` subpath:

```tsx
import { VisLabels } from '@cosmograph/vis-labels/react'

const labels = [
  { id: 'monster', text: '👾', x: 100, y: 50, opacity: 1 },
  { id: 'alien', text: '👽', x: 50, y: 150, opacity: 1 },
  { id: 'ufo', text: '🛸', x: 150, y: 150, opacity: 1 },
]

export function App (): JSX.Element {
  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      <VisLabels labels={labels} fontSize={18} />
    </div>
  )
}
```

You can also access the underlying renderer and container via a forwarded ref:

```tsx
import { useEffect, useRef } from 'react'
import { VisLabels } from '@cosmograph/vis-labels/react'
import type { VisLabelsHandle } from '@cosmograph/vis-labels/react'

export function App (): JSX.Element {
  const labelsRef = useRef<VisLabelsHandle>(null)

  useEffect(() => {
    labelsRef.current?.renderer?.draw()
  }, [])

  return (
    <div style={{ position: 'relative', width: 200, height: 200 }}>
      <VisLabels
        ref={labelsRef}
        labels={[
          { id: 'label', text: 'Hello React', x: 100, y: 110, opacity: 1 },
        ]}
        fontSize={16}
      />
    </div>
  )
}
```
