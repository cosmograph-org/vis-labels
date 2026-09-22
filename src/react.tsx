import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { LabelRenderer } from './index.js'
import type {
  LabelOptions, LabelPadding, LabelPath, LabelPlacement, LabelPoint, LabelRendererOptions, OnClickCallback,
} from './types.js'

export interface VisLabelsHandle {
  readonly renderer: LabelRenderer | null;
  readonly container: HTMLDivElement | null;
}

export type VisLabelsProps = LabelRendererOptions & {
  labels: LabelOptions[];
  withIntersection?: boolean;
  children?: never;
}

export const VisLabels = forwardRef<VisLabelsHandle, VisLabelsProps>(function VisLabels (
  {
    labels,
    withIntersection = true,
    children: _children,
    ...options
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<LabelRenderer | null>(null)

  useImperativeHandle(ref, () => ({
    get renderer () {
      return rendererRef.current
    },
    get container () {
      return containerRef.current
    },
  }), [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new LabelRenderer(container, options)
    rendererRef.current = renderer

    renderer.setLabels(labels)
    renderer.draw(withIntersection)

    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return

    renderer.setOptions(options)
    renderer.setLabels(labels)
    renderer.draw(withIntersection)
  }, [labels, options, withIntersection])

  return <div ref={containerRef} />
})

VisLabels.displayName = 'VisLabels'

export type { LabelOptions, LabelPadding, LabelPath, LabelPlacement, LabelPoint, LabelRendererOptions, OnClickCallback }
