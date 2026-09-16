import { LabelRenderer } from '@cosmograph/vis-labels'
import type { LabelOptions } from '@cosmograph/vis-labels'

export function rotatedLabelsOverlap (div: HTMLDivElement): void {
  const renderer = new LabelRenderer(div, { fontSize: 13, padding: { top: 2, right: 6, bottom: 2, left: 6 } })
  const rotation = -45
  const radians = (rotation * Math.PI) / 180
  const spacing = 26

  const labels: LabelOptions[] = Array.from({ length: 9 }, (_, i) => ({
    id: `diagonal-${i}`,
    text: `diagonal label ${i + 1}`,
    x: 170 - Math.sin(radians) * (i - 4) * spacing,
    y: 200 + Math.cos(radians) * (i - 4) * spacing,
    rotation,
    opacity: 1,
  }))

  renderer.setLabels(labels)
  renderer.draw()
}
