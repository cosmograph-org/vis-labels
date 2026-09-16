import { fontOfRun, lruGet, lruSet, splitGraphemes } from './helper.js'
import {
  FontParts, LabelPath, LineMetrics, MeasuredRun, MeasuredText, OrientedPath, PathLayout, PathLayoutOptions, TextRun,
} from './types.js'
import {
  CIRCLE_CONSTANT, ELLIPSIS, INK_ASCENT_RATIO, INK_DESCENT_RATIO, LINE_HEIGHT_RATIO, MAX_QUADS, MIN_BEND_RATIO,
  RIBBON_STEPS, SAMPLE_COUNT,
} from './variables.js'

const widths = new Map<string, number>()
const lines = new Map<string, LineMetrics>()
let measuringContext: CanvasRenderingContext2D | null | undefined
let probe: HTMLDivElement | undefined

const sampleX = new Float64Array(SAMPLE_COUNT + 1)
const sampleY = new Float64Array(SAMPLE_COUNT + 1)
const normalX = new Float64Array(SAMPLE_COUNT + 1)
const normalY = new Float64Array(SAMPLE_COUNT + 1)
const pathLength = new Float64Array(SAMPLE_COUNT + 1)
const baseLength = new Float64Array(SAMPLE_COUNT + 1)
const oriented: OrientedPath = { sx: 0, sy: 0, cx: 0, cy: 0, tx: 0, ty: 0, weight: 1, startInset: 0, endInset: 0 }
const cursor = { x: 0, y: 0, dx: 0, dy: 0 }
const edgePoint = { x: 0, y: 0 }

export function createPathLayout (): PathLayout {
  return {
    baseline: '',
    ribbon: '',
    areShapesStale: true,
    side: 1,
    baselineDistance: 0,
    ribbonFrom: 0,
    ribbonTo: 0,
    offset: 0,
    thickness: 0,
    borderRadius: 0,
    textCenter: 0,
    runs: [],
    centerX: 0,
    centerY: 0,
    quads: new Float64Array(MAX_QUADS * 8),
    quadCount: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  }
}

function getMeasuringContext (): CanvasRenderingContext2D | null {
  if (measuringContext === undefined) measuringContext = document.createElement('canvas').getContext('2d')
  return measuringContext
}

function measureFont (text: string, font: string): number | undefined {
  const key = `${font}\n${text}`
  const cached = lruGet(widths, key)
  if (cached !== undefined) return cached

  const context = getMeasuringContext()
  if (!context) return undefined
  context.font = font
  const width = context.measureText(text).width
  lruSet(widths, key, width)
  return width
}

function measureLine (text: string, font: string): LineMetrics {
  const key = `${font}\n${text}`
  const cached = lruGet(lines, key)
  if (cached) return cached

  // Canvas font metrics leave out the line gap CSS adds at `line-height: normal`, so the line box is laid out for real.
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(probe)
  }
  probe.style.cssText = `position: absolute; left: -9999px; top: 0; visibility: hidden; white-space: pre; line-height: normal; font: ${font}`
  probe.textContent = text
  const metrics: LineMetrics = { height: probe.offsetHeight, inkAscent: 0, inkDescent: 0 }

  const context = getMeasuringContext()
  if (context) {
    context.font = font
    const ink = context.measureText(text)
    metrics.inkAscent = ink.actualBoundingBoxAscent ?? 0
    metrics.inkDescent = ink.actualBoundingBoxDescent ?? 0
  }
  lruSet(lines, key, metrics)
  return metrics
}

export function measureText (runs: TextRun[], parts: FontParts): MeasuredText | undefined {
  const base = fontOfRun(parts, '')
  const measured: MeasuredRun[] = []
  let width = 0
  for (const run of runs) {
    const font = fontOfRun(parts, run.style)
    const runWidth = measureFont(run.text, font)
    if (runWidth === undefined) return undefined
    measured.push({ text: run.text, style: run.style, font, width: runWidth })
    width += runWidth
  }
  const ellipsisWidth = measureFont(ELLIPSIS, base)
  if (ellipsisWidth === undefined) return undefined
  const line = measureLine(runs.map(run => run.text).join(''), base)
  return { runs: measured, width, ellipsisWidth, lineHeight: line.height, inkAscent: line.inkAscent, inkDescent: line.inkDescent }
}

export function estimateText (runs: TextRun[], fontSize: number, widthRatio: number): MeasuredText {
  const advance = fontSize * widthRatio
  const measured = runs.map(run => ({ text: run.text, style: run.style, font: '', width: run.text.length * advance }))
  return {
    runs: measured,
    width: measured.reduce((total, run) => total + run.width, 0),
    ellipsisWidth: advance,
    lineHeight: fontSize * LINE_HEIGHT_RATIO,
    inkAscent: fontSize * INK_ASCENT_RATIO,
    inkDescent: fontSize * INK_DESCENT_RATIO,
  }
}

function cutRun (run: MeasuredRun, room: number): MeasuredRun | undefined {
  const graphemes = splitGraphemes(run.text)
  let low = 0
  let high = graphemes.length
  let keptWidth = 0
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = graphemes.slice(0, middle).join('')
    const width = run.font ? measureFont(candidate, run.font) ?? 0 : (candidate.length / run.text.length) * run.width
    if (width <= room) {
      low = middle
      keptWidth = width
    } else {
      high = middle - 1
    }
  }
  if (low === 0) return undefined
  return { text: graphemes.slice(0, low).join(''), style: run.style, font: run.font, width: keptWidth }
}

function fitRuns (text: MeasuredText, available: number, into: MeasuredRun[]): boolean {
  if (text.width <= available) {
    for (const run of text.runs) into.push(run)
    return into.length > 0
  }

  const room = available - text.ellipsisWidth
  if (room < 0) return false

  let used = 0
  for (const run of text.runs) {
    if (used + run.width <= room) {
      into.push(run)
      used += run.width
      continue
    }
    const cut = cutRun(run, room - used)
    if (cut) into.push(cut)
    break
  }

  if (into.length === 0) return false
  const last = into[into.length - 1]
  into[into.length - 1] = { text: last.text + ELLIPSIS, style: last.style, font: last.font, width: last.width + text.ellipsisWidth }
  return true
}

function evaluate (path: OrientedPath, t: number): void {
  const { sx, sy, cx, cy, tx, ty, weight } = path
  const u = 1 - t
  const a = u * u
  const b = 2 * t * u * weight
  const c = t * t
  const denominator = a + b + c
  const nx = a * sx + b * cx + c * tx
  const ny = a * sy + b * cy + c * ty
  const da = -2 * u
  const db = 2 * weight * (1 - 2 * t)
  const dc = 2 * t
  const dDenominator = da + db + dc
  cursor.x = nx / denominator
  cursor.y = ny / denominator
  cursor.dx = (da * sx + db * cx + dc * tx) * denominator - nx * dDenominator
  cursor.dy = (da * sy + db * cy + dc * ty) * denominator - ny * dDenominator
}

function orientPath (path: LabelPath): OrientedPath {
  const isReversed = path.end[0] < path.start[0]
  const [sx, sy] = isReversed ? path.end : path.start
  const [tx, ty] = isReversed ? path.start : path.end
  const [cx, cy] = path.control ?? [(sx + tx) / 2, (sy + ty) / 2]
  const [insetStart, insetEnd] = path.inset ?? [0, 0]
  oriented.sx = sx
  oriented.sy = sy
  oriented.cx = cx
  oriented.cy = cy
  oriented.tx = tx
  oriented.ty = ty
  oriented.weight = path.weight ?? 1
  oriented.startInset = isReversed ? insetEnd : insetStart
  oriented.endInset = isReversed ? insetStart : insetEnd
  return oriented
}

function bendOf (path: OrientedPath): number {
  const chordLengthSquared = (path.tx - path.sx) ** 2 + (path.ty - path.sy) ** 2
  if (chordLengthSquared === 0) return 0
  evaluate(path, 0.5)
  const bulge = (cursor.x - (path.sx + path.tx) / 2) * (path.ty - path.sy) - (cursor.y - (path.sy + path.ty) / 2) * (path.tx - path.sx)
  return bulge / chordLengthSquared
}

function indexAt (lengths: Float64Array, distance: number): number {
  let sample = 0
  while (sample < SAMPLE_COUNT - 1 && lengths[sample + 1] < distance) sample += 1
  const segment = lengths[sample + 1] - lengths[sample]
  return sample + (segment > 0 ? (distance - lengths[sample]) / segment : 0)
}

function interpolate (values: Float64Array, index: number): number {
  const low = Math.min(SAMPLE_COUNT, Math.max(0, Math.floor(index)))
  const high = Math.min(SAMPLE_COUNT, low + 1)
  return values[low] + (values[high] - values[low]) * (index - low)
}

function pointAt (index: number, distance: number): void {
  edgePoint.x = interpolate(sampleX, index) + interpolate(normalX, index) * distance
  edgePoint.y = interpolate(sampleY, index) + interpolate(normalY, index) * distance
}

function coordinatesAt (along: number, out: number): string {
  pointAt(indexAt(baseLength, along), out)
  return `${edgePoint.x.toFixed(1)} ${edgePoint.y.toFixed(1)}`
}

function buildRibbon (from: number, to: number, offset: number, thickness: number, borderRadius: number): string {
  const length = to - from
  if (length <= 0) return ''
  const radius = Math.max(0, Math.min(borderRadius, thickness / 2, length / 2))
  const far = offset + thickness
  const step = (length - radius * 2) / RIBBON_STEPS
  const handle = radius * (1 - CIRCLE_CONSTANT)

  let data = `M${coordinatesAt(from + radius, offset)}`
  for (let i = 1; i <= RIBBON_STEPS; i += 1) data += `L${coordinatesAt(from + radius + step * i, offset)}`
  data += `C${coordinatesAt(to - handle, offset)} ${coordinatesAt(to, offset + handle)} ${coordinatesAt(to, offset + radius)}`
  data += `L${coordinatesAt(to, far - radius)}`
  data += `C${coordinatesAt(to, far - handle)} ${coordinatesAt(to - handle, far)} ${coordinatesAt(to - radius, far)}`
  for (let i = 1; i <= RIBBON_STEPS; i += 1) data += `L${coordinatesAt(to - radius - step * i, far)}`
  data += `C${coordinatesAt(from + handle, far)} ${coordinatesAt(from, far - handle)} ${coordinatesAt(from, far - radius)}`
  data += `L${coordinatesAt(from, offset + radius)}`
  data += `C${coordinatesAt(from, offset + handle)} ${coordinatesAt(from + handle, offset)} ${coordinatesAt(from + radius, offset)}`
  return `${data}Z`
}

function buildQuads (from: number, to: number, offset: number, thickness: number, layout: PathLayout): void {
  const length = to - from
  const count = Math.min(MAX_QUADS, Math.max(1, Math.ceil(length / (thickness * 2))))
  const quads = layout.quads
  const far = offset + thickness
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let quad = 0; quad < count; quad += 1) {
    const startIndex = indexAt(baseLength, from + (length * quad) / count)
    const endIndex = indexAt(baseLength, from + (length * (quad + 1)) / count)
    const base = quad * 8
    pointAt(startIndex, offset)
    quads[base] = edgePoint.x
    quads[base + 1] = edgePoint.y
    pointAt(endIndex, offset)
    quads[base + 2] = edgePoint.x
    quads[base + 3] = edgePoint.y
    pointAt(endIndex, far)
    quads[base + 4] = edgePoint.x
    quads[base + 5] = edgePoint.y
    pointAt(startIndex, far)
    quads[base + 6] = edgePoint.x
    quads[base + 7] = edgePoint.y
    for (let corner = 0; corner < 8; corner += 2) {
      minX = Math.min(minX, quads[base + corner])
      maxX = Math.max(maxX, quads[base + corner])
      minY = Math.min(minY, quads[base + corner + 1])
      maxY = Math.max(maxY, quads[base + corner + 1])
    }
  }
  layout.quadCount = count
  layout.left = minX
  layout.top = minY
  layout.right = maxX
  layout.bottom = maxY
}

/** Samples the curve and its baseline into the shared arrays, and returns the baseline as SVG path data when asked for it. */
function sampleCurve (current: OrientedPath, side: number, baselineDistance: number, withBaseline: boolean): string {
  let previousX = 0
  let previousY = 0
  let previousBaseX = 0
  let previousBaseY = 0
  let baseline = ''
  for (let i = 0; i <= SAMPLE_COUNT; i += 1) {
    evaluate(current, i / SAMPLE_COUNT)
    const tangent = Math.hypot(cursor.dx, cursor.dy) || 1
    sampleX[i] = cursor.x
    sampleY[i] = cursor.y
    normalX[i] = (side * cursor.dy) / tangent
    normalY[i] = (-side * cursor.dx) / tangent
    const baseX = cursor.x + normalX[i] * baselineDistance
    const baseY = cursor.y + normalY[i] * baselineDistance
    pathLength[i] = i === 0 ? 0 : pathLength[i - 1] + Math.hypot(cursor.x - previousX, cursor.y - previousY)
    baseLength[i] = i === 0 ? 0 : baseLength[i - 1] + Math.hypot(baseX - previousBaseX, baseY - previousBaseY)
    previousX = cursor.x
    previousY = cursor.y
    previousBaseX = baseX
    previousBaseY = baseY
    if (withBaseline) baseline += `${i === 0 ? 'M' : 'L'}${baseX.toFixed(1)} ${baseY.toFixed(1)}`
  }
  return baseline
}

export function layoutPath (path: LabelPath, text: MeasuredText, options: PathLayoutOptions, layout: PathLayout): boolean {
  layout.runs.length = 0
  layout.areShapesStale = true
  const current = orientPath(path)
  const side = bendOf(current) < -MIN_BEND_RATIO ? -1 : 1
  const thickness = options.paddingBottom + options.lineHeight + options.paddingTop
  // Chrome and Safari resolve `dominant-baseline: central` differently on a `textPath`, so the baseline is placed by hand.
  const inkCentre = (text.inkAscent - text.inkDescent) / 2
  const baselineDistance = options.offset + options.paddingBottom + options.lineHeight / 2 - side * inkCentre
  sampleCurve(current, side, baselineDistance, false)

  const total = pathLength[SAMPLE_COUNT]
  const startOffset = interpolate(baseLength, indexAt(pathLength, Math.min(current.startInset, total)))
  const endOffset = interpolate(baseLength, indexAt(pathLength, Math.max(0, total - current.endInset)))

  const available = Math.min(options.maxWidth - options.paddingLeft - options.paddingRight, endOffset - startOffset)
  if (available <= 0 || !fitRuns(text, available, layout.runs)) return false

  let width = 0
  for (const run of layout.runs) width += run.width
  const center = (startOffset + endOffset) / 2
  layout.textCenter = center

  pointAt(indexAt(baseLength, center), options.offset + thickness / 2)
  layout.centerX = edgePoint.x
  layout.centerY = edgePoint.y

  const from = center - width / 2 - options.paddingLeft
  const to = center + width / 2 + options.paddingRight
  buildQuads(from, to, options.offset, thickness, layout)

  layout.side = side
  layout.baselineDistance = baselineDistance
  layout.ribbonFrom = from
  layout.ribbonTo = to
  layout.offset = options.offset
  layout.thickness = thickness
  layout.borderRadius = options.borderRadius
  return true
}

/**
 * Builds the SVG path data for a laid out label's baseline and background. Kept apart from `layoutPath`, which every
 * label with a path goes through for the overlap pass, since only the labels that survive it are drawn.
 */
export function shapePath (path: LabelPath, layout: PathLayout): void {
  if (!layout.areShapesStale) return
  layout.areShapesStale = false
  layout.baseline = sampleCurve(orientPath(path), layout.side, layout.baselineDistance, true)
  layout.ribbon = buildRibbon(layout.ribbonFrom, layout.ribbonTo, layout.offset, layout.thickness, layout.borderRadius)
}
