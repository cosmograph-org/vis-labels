import { LabelPadding } from './types.js'

export const TOP_BOTTOM_PADDING = 6
export const LEFT_RIGHT_PADDING = 9
export const DEFAULT_FONT_SIZE = 14

export const DEFAULT_PADDING: LabelPadding = Object.freeze({
  left: LEFT_RIGHT_PADDING,
  top: TOP_BOTTOM_PADDING,
  right: LEFT_RIGHT_PADDING,
  bottom: TOP_BOTTOM_PADDING,
})

export const FONT_WIDTH_HEIGHT_RATIO = 0.6
export const LINE_HEIGHT_RATIO = 1.2
export const INK_ASCENT_RATIO = 0.72
export const INK_DESCENT_RATIO = 0.2

export const ELLIPSIS = '…'
export const MAX_CACHED_MEASUREMENTS = 2000

export const SAMPLE_COUNT = 24
export const RIBBON_STEPS = 12
export const MAX_QUADS = 4
export const MIN_BEND_RATIO = 0.001
export const CIRCLE_CONSTANT = 0.5523

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
// An SVG clips to its own viewport whatever its overflow says, so it has to span the container its coordinates are in.
export const PATH_SVG_STYLE = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: visible;'
export const PATH_LABEL_STYLE: Partial<CSSStyleDeclaration> = {
  right: '0',
  bottom: '0',
  padding: '0',
  background: 'none',
  border: 'none',
  boxShadow: 'none',
  pointerEvents: 'none',
}

export const LINE_BREAKING_TAGS = new Set(['BR', 'DIV', 'P', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'])
export const TAG_STYLES: Record<string, string> = {
  STRONG: 'font-weight: 700;',
  B: 'font-weight: 700;',
  EM: 'font-style: italic;',
  I: 'font-style: italic;',
  U: 'text-decoration: underline;',
  S: 'text-decoration: line-through;',
  DEL: 'text-decoration: line-through;',
}
