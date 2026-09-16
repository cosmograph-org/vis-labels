import type { Meta, StoryObj } from '@storybook/html-vite'
import { renderContainer, LABEL_RENDERER_DIV_ATTR } from './render-container'
import { individualLabel } from './quick-start/single-label'
import { multipleLabels } from './quick-start/labels'
import { htmlMultilineLabels } from './quick-start/html-multiline-labels'
import { htmlMultilineLabelsIntersect } from './quick-start/html-multiline-labels-intersect'
import { angleRotation } from './quick-start/label-rotation'
import { cssVariables } from './quick-start/css-variables'
import { maxWidthLabels } from './quick-start/max-width'
// @ts-expect-error - Vite raw import
import singleLabelSource from './quick-start/single-label.ts?raw'
// @ts-expect-error - Vite raw import
import labelsSource from './quick-start/labels.ts?raw'
// @ts-expect-error - Vite raw import
import htmlMultilineLabelsSource from './quick-start/html-multiline-labels.ts?raw'
// @ts-expect-error - Vite raw import
import htmlMultilineLabelsIntersectSource from './quick-start/html-multiline-labels-intersect.ts?raw'
// @ts-expect-error - Vite raw import
import labelRotationSource from './quick-start/label-rotation.ts?raw'
// @ts-expect-error - Vite raw import
import cssVariablesSource from './quick-start/css-variables.ts?raw'
// @ts-expect-error - Vite raw import
import maxWidthSource from './quick-start/max-width.ts?raw'

const meta = {
  title: 'Quick Start',
} satisfies Meta

// eslint-disable-next-line import/no-default-export
export default meta

type Story = StoryObj

export const MultipleLabels: Story = {
  name: 'Multiple labels',
  render: renderContainer,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: labelsSource,
        language: 'typescript',
      },
    },
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    multipleLabels(div)
  },
}

export const IndividualLabel: Story = {
  name: 'Individual label',
  render: renderContainer,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: singleLabelSource,
        language: 'typescript',
      },
    },
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    individualLabel(div)
  },
}

export const HtmlMultilineLabels: Story = {
  name: 'HTML multi-line labels',
  render: () => renderContainer({ height: '400px' }),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: htmlMultilineLabelsSource,
        language: 'typescript',
      },
    },
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    htmlMultilineLabels(div)
  },
}

let cleanupHtmlIntersect: (() => void) | undefined

export const HtmlMultilineLabelsIntersect: Story = {
  name: 'HTML multi-line labels (moving, intersecting)',
  render: () => renderContainer({ width: '100%', height: '400px' }),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: htmlMultilineLabelsIntersectSource,
        language: 'typescript',
      },
    },
  },
  async beforeEach () {
    cleanupHtmlIntersect = undefined
    return () => cleanupHtmlIntersect?.()
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    cleanupHtmlIntersect = htmlMultilineLabelsIntersect(div)
  },
}

export const LabelRotation: Story = {
  name: 'Label rotation',
  render: renderContainer,
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: labelRotationSource,
        language: 'typescript',
      },
    },
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    angleRotation(div)
  },
}

let cleanupCssVariables: (() => void) | undefined

export const CssVariables: Story = {
  name: 'CSS variables',
  render: () => renderContainer({ width: '260px', height: '340px' }),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: cssVariablesSource,
        language: 'typescript',
      },
    },
  },
  async beforeEach () {
    cleanupCssVariables = undefined
    return () => cleanupCssVariables?.()
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    cleanupCssVariables = cssVariables(div)
  },
}

let cleanupMaxWidth: (() => void) | undefined

export const MaxWidth: Story = {
  name: 'Max width',
  render: () => renderContainer({ width: '300px', height: '300px' }),
  parameters: {
    docs: {
      source: {
        type: 'code',
        code: maxWidthSource,
        language: 'typescript',
      },
    },
  },
  async beforeEach () {
    cleanupMaxWidth = undefined
    return () => cleanupMaxWidth?.()
  },
  play: ({ canvasElement }) => {
    const div = canvasElement.querySelector<HTMLDivElement>(`[${LABEL_RENDERER_DIV_ATTR}]`)
    if (!div) return
    cleanupMaxWidth = maxWidthLabels(div)
  },
}
