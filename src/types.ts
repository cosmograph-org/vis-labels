export type LabelPadding = {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type LabelPoint = [number, number]

export interface LabelPath {
  /** Start of the path in container pixels. */
  start: LabelPoint;
  /** End of the path in container pixels. */
  end: LabelPoint;
  /** Control point that bends the path into a quadratic curve. Omit for a straight path. */
  control?: LabelPoint;
  /** Weight of the control point: `1` is an ordinary quadratic Bézier, other values a rational quadratic curve. Default: `1`. */
  weight?: number;
  /** Length in pixels kept free at the start and at the end of the path, for example the radii of the nodes an edge connects. */
  inset?: [number, number];
  /** Distance in pixels between the path and the label. Default: `0`. */
  offset?: number;
}

export interface LabelOptions {
  id: string;
  text: string | number;
  x: number;
  y: number;
  weight?: number;
  fontSize?: number;
  color?: string;
  opacity?: number;
  shouldBeShown?: boolean;
  style?: string;
  className?: string;
  padding?: LabelPadding;
  /** Rotation in degrees. 0 = horizontal; positive = clockwise. */
  rotation?: number;
  /** Caps the label's outer width in pixels, padding and border included, unlike `--vis-label-max-width`, which caps the content box. */
  maxOuterWidth?: number;
  /** Lays the text along a straight or curved path instead of at `x`, `y` and `rotation`. */
  path?: LabelPath;
}

export type OnClickCallback = (e: MouseEvent, label: LabelOptions) => void | undefined

export interface LabelRendererOptions {
  onLabelClick?: OnClickCallback;
  pointerEvents?: 'none' | 'auto' | 'all';
  dispatchWheelEventElement?: HTMLElement;
  dontInjectStyles?: boolean;
  padding?: LabelPadding;
  fontSize?: number;
  /** When `true`, label text is set via `innerHTML` (`dangerouslySetHtml`).
   * Only enable with trusted/sanitized content — XSS risk.
   */
  dangerousHtml?: boolean;
}

export type TextRun = {
  text: string;
  style: string;
}

export type MeasuredRun = TextRun & {
  width: number;
  font: string;
}

export type FontParts = {
  style: string;
  weight: string;
  size: string;
  family: string;
}

export type MeasuredText = {
  runs: MeasuredRun[];
  width: number;
  ellipsisWidth: number;
  lineHeight: number;
  inkAscent: number;
  inkDescent: number;
}

export type LineMetrics = {
  height: number;
  inkAscent: number;
  inkDescent: number;
}

export type PathLayoutOptions = {
  maxWidth: number;
  offset: number;
  lineHeight: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  borderRadius: number;
}

export type OrientedPath = {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  weight: number;
  startInset: number;
  endInset: number;
}

export type PathLayout = {
  baseline: string;
  ribbon: string;
  /** Whether `baseline` and `ribbon` are behind the rest of the layout. They are built only for labels that are drawn. */
  areShapesStale: boolean;
  side: number;
  baselineDistance: number;
  ribbonFrom: number;
  ribbonTo: number;
  offset: number;
  thickness: number;
  borderRadius: number;
  textCenter: number;
  runs: MeasuredRun[];
  centerX: number;
  centerY: number;
  quads: Float64Array;
  quadCount: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type PathState = {
  path: LabelPath;
  layout: PathLayout;
  source: string | undefined;
  sourceIsHtml: boolean;
  runs: TextRun[];
  text: MeasuredText | undefined;
  isLayoutStale: boolean;
  areStylesStale: boolean;
  fits: boolean;
  lineHeight: number;
  background: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  svg: SVGSVGElement | undefined;
  baseline: SVGPathElement | undefined;
  ribbon: SVGPathElement | undefined;
  textPath: SVGTextPathElement | undefined;
  writtenBaseline: string;
  writtenRibbon: string;
  writtenOffset: string;
  writtenText: string;
}

export type GraphemeSegmenter = { segment (text: string): Iterable<{ segment: string }> }
export type GraphemeSegmenterConstructor = new (locale?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter
