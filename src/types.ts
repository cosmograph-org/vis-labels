export type LabelPadding = {
  left: number;
  top: number;
  right: number;
  bottom: number;
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
