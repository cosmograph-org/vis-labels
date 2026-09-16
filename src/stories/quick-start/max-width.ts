import { LabelRenderer } from '@cosmograph/vis-labels'

const TEXT = 'A label with more text than fits'
const ELLIPSIS = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'

export function maxWidthLabels (div: HTMLDivElement): () => void {
  const renderer = new LabelRenderer(div, { fontSize: 14 })
  let rafId = 0

  const tick = (time: number): void => {
    const maxOuterWidth = 100 + (Math.sin(time / 700) + 1) * 80
    renderer.setLabels([
      { id: 'cut', text: TEXT, x: 150, y: 90, maxOuterWidth, style: ELLIPSIS, opacity: 1 },
      { id: 'wrap', text: TEXT, x: 150, y: 230, maxOuterWidth, opacity: 1 },
    ])
    renderer.draw()
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(rafId)
    renderer.destroy()
  }
}
