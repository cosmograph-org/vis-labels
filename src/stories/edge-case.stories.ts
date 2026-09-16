import type { Meta, StoryObj } from '@storybook/html-vite'
import { renderContainer, renderFullViewportContainer, LABEL_RENDERER_DIV_ATTR } from './render-container'
import { emptyLabelVisibility } from './edge-cases/empty-label-visibility'
import { swarmOfLabels, smallSwarmOfLabels } from './edge-cases/intersect-labels-performance'
import { rotatedLabelsOverlap } from './edge-cases/rotated-labels-overlap'
import { pathLabelsSwarm } from './edge-cases/path-labels-swarm'
// @ts-expect-error - Vite raw import
import emptyLabelVisibilitySource from './edge-cases/empty-label-visibility.ts?raw'
// @ts-expect-error - Vite raw import
import intersectLabelsPerformanceSource from './edge-cases/intersect-labels-performance.ts?raw'
// @ts-expect-error - Vite raw import
import rotatedLabelsOverlapSource from './edge-cases/rotated-labels-overlap.ts?raw'
// @ts-expect-error - Vite raw import
import pathLabelsSwarmSource from './edge-cases/path-labels-swarm.ts?raw'

const meta = {
  id: 'test',
  title: 'Edge Cases',
} satisfies Meta

// eslint-disable-next-line import/no-default-export
export default meta

type Story = StoryObj

export const EmptyLabelVisibility: Story = {
  name: 'Empty label visibility',
  render: renderContainer,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: emptyLabelVisibilitySource,
        language: 'typescript',
      },
    },
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    emptyLabelVisibility(div)
  },
}

export const RotatedLabelsOverlap: Story = {
  name: 'Rotated labels overlap',
  render: () => renderContainer({ width: '340px', height: '400px' }),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: rotatedLabelsOverlapSource,
        language: 'typescript',
      },
    },
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    rotatedLabelsOverlap(div)
  },
}

let cleanupSmallSwarm: (() => void) | undefined

export const SmallSwarm: Story = {
  name: 'Small swarm',
  render: () => {
    cleanupSmallSwarm?.()
    const wrapper = renderContainer({ width: '100%', height: '420px' })
    const div = wrapper.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (div) cleanupSmallSwarm = smallSwarmOfLabels(div)
    return wrapper
  },
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: intersectLabelsPerformanceSource,
        language: 'typescript',
      },
    },
  },
  async beforeEach () {
    cleanupSmallSwarm = undefined
    return () => cleanupSmallSwarm?.()
  },
}

let cleanup: (() => void) | undefined

export const IntersectLabelsPerformance: Story = {
  name: '30K intersecting labels',
  render: () => renderFullViewportContainer(),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: intersectLabelsPerformanceSource,
        language: 'typescript',
      },
    },
  },
  async beforeEach () {
    cleanup = undefined
    return () => cleanup?.()
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    cleanup = swarmOfLabels(div)
  },
}

let cleanupPathSwarm: (() => void) | undefined

export const PathLabelsSwarm: Story = {
  name: '600 labels along paths',
  render: () => renderFullViewportContainer(),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: pathLabelsSwarmSource,
        language: 'typescript',
      },
    },
  },
  async beforeEach () {
    cleanupPathSwarm = undefined
    return () => cleanupPathSwarm?.()
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    cleanupPathSwarm = pathLabelsSwarm(div)
  },
}
