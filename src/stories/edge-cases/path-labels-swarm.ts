import { LabelRenderer } from '@cosmograph/vis-labels'
import type { LabelOptions, LabelPoint } from '@cosmograph/vis-labels'

const WORDS = ['follows', 'blocks', 'mentions', 'replies to', 'shared a draft of the roadmap']

function generateLabels (time: number, width: number, height: number, labelCount: number): LabelOptions[] {
  const labels: LabelOptions[] = []
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.42

  for (let i = 0; i < labelCount; i += 1) {
    const angle = (i / labelCount) * Math.PI * 2 + time * 0.0002
    const inner = radius * (0.35 + ((i * 7) % 10) / 20)
    const start: LabelPoint = [centerX + Math.cos(angle) * inner, centerY + Math.sin(angle) * inner]
    const end: LabelPoint = [centerX + Math.cos(angle + 0.9) * radius, centerY + Math.sin(angle + 0.9) * radius]
    const bend = 0.25 + Math.sin(time * 0.001 + i) * 0.1
    const control: LabelPoint = [
      (start[0] + end[0]) / 2 - (end[1] - start[1]) * bend,
      (start[1] + end[1]) / 2 + (end[0] - start[0]) * bend,
    ]
    labels.push({ id: `path-${i}`, text: WORDS[i % WORDS.length], x: 0, y: 0, weight: i % 3, path: { start, end, control } })
  }
  return labels
}

export function pathLabelsSwarm (container: HTMLDivElement): () => void {
  const renderer = new LabelRenderer(container, { fontSize: 12, padding: { top: 1, right: 3, bottom: 2, left: 3 } })
  let rafId = 0

  function tick (time: number): void {
    const width = container.offsetWidth
    const height = container.offsetHeight
    if (width > 0 && height > 0) {
      renderer.setLabels(generateLabels(time, width, height, 600))
      renderer.draw()
    }
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(rafId)
    renderer.destroy()
  }
}
