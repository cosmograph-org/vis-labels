import { LabelRenderer } from '@cosmograph/vis-labels'
import type { LabelOptions, LabelPoint } from '@cosmograph/vis-labels'

type Node = { x: number; y: number; radius: number }
type Edge = {
  id: string;
  source: number;
  target: number;
  text: string;
  bend: number;
  style?: string;
  weight?: number;
  trim?: number;
}

const STYLES = `
  .edge-amber {
    background: #f0b866;
    color: #10181e;
  }

  .edge-slate {
    background: #232b31;
  }

  .edge-violet {
    background: #6d5bd0;
    color: #f4f1ff;
  }
`

const NODES: Node[] = [
  { x: 80, y: 100, radius: 10 },
  { x: 410, y: 70, radius: 16 },
  { x: 480, y: 330, radius: 12 },
  { x: 130, y: 360, radius: 20 },
  { x: 285, y: 215, radius: 8 },
]

const EDGES: Edge[] = [
  { id: 'straight', source: 0, target: 1, text: 'straight edge', bend: 0, style: 'edge-amber', weight: 1 },
  {
    id: 'long',
    source: 1,
    target: 2,
    text: 'reviewed the pull request that moves the labels renderer into its own package',
    bend: 0.3,
    trim: 0.16,
  },
  { id: 'emoji', source: 2, target: 3, text: 'ships 🚀 from 🇯🇵 👍🏽', bend: -0.25 },
  { id: 'arabic', source: 3, target: 0, text: 'مرحبا بالعالم من مكتبة الرسوم', bend: 0.42, style: 'edge-violet', weight: 1 },
  {
    id: 'html',
    source: 4,
    target: 2,
    text: '<strong>Café Central</strong><br>Open now · <span style="color:#a3be8c">4.6★</span>',
    bend: 0.3,
    style: 'edge-slate',
  },
]

const LABEL_OFFSET = 3

const SVG_NS = 'http://www.w3.org/2000/svg'

function controlPoint (start: LabelPoint, end: LabelPoint, bend: number): LabelPoint {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  return [(start[0] + end[0]) / 2 - dy * bend, (start[1] + end[1]) / 2 + dx * bend]
}

export function pathLabels (div: HTMLDivElement): () => void {
  div.style.background = '#161b1f'

  const styles = document.createElement('style')
  styles.textContent = STYLES
  div.appendChild(styles)

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.cssText = 'position: absolute; inset: 0;'
  const edgePaths = EDGES.map(() => {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', '#4b5a63')
    path.setAttribute('stroke-width', '1.5')
    svg.appendChild(path)
    return path
  })
  const nodeCircles = NODES.map(({ radius }) => {
    const circle = document.createElementNS(SVG_NS, 'circle')
    circle.setAttribute('r', String(radius))
    circle.setAttribute('fill', '#7dd3c0')
    svg.appendChild(circle)
    return circle
  })
  div.appendChild(svg)

  const labelsContainer = document.createElement('div')
  labelsContainer.style.cssText = 'position: absolute; inset: 0; color: #d8e1e8;'
  div.appendChild(labelsContainer)

  const renderer = new LabelRenderer(labelsContainer, {
    fontSize: 13,
    padding: { top: 3, right: 4, bottom: 3, left: 4 },
    dangerousHtml: true,
  })

  const labels: LabelOptions[] = EDGES.map((edge, i) => {
    const start: LabelPoint = [NODES[edge.source].x, NODES[edge.source].y]
    const end: LabelPoint = [NODES[edge.target].x, NODES[edge.target].y]
    const control = controlPoint(start, end, edge.bend)
    edgePaths[i].setAttribute('d', `M ${start[0]} ${start[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`)
    nodeCircles[edge.source].setAttribute('cx', String(start[0]))
    nodeCircles[edge.source].setAttribute('cy', String(start[1]))
    nodeCircles[edge.target].setAttribute('cx', String(end[0]))
    nodeCircles[edge.target].setAttribute('cy', String(end[1]))
    const trim = (edge.trim ?? 0) * Math.hypot(end[0] - start[0], end[1] - start[1])
    return {
      id: edge.id,
      text: edge.text,
      x: 0,
      y: 0,
      opacity: 1,
      weight: edge.weight ?? 0,
      className: edge.style ?? '',
      path: {
        start,
        end,
        control,
        inset: [NODES[edge.source].radius + trim, NODES[edge.target].radius + trim],
        offset: LABEL_OFFSET,
      },
    }
  })

  renderer.setLabels(labels)
  renderer.draw()

  return () => {
    renderer.destroy()
    styles.remove()
  }
}
