import { doQuadsIntersect, styledRunsOf, svgStyleOfRun } from './helper.js'
import {
  DEFAULT_FONT_SIZE, DEFAULT_PADDING, FONT_WIDTH_HEIGHT_RATIO, LINE_HEIGHT_RATIO, PATH_LABEL_STYLE, PATH_SVG_STYLE, SVG_NAMESPACE,
} from './variables.js'
import { LabelPadding, LabelPath, LabelRendererOptions, MeasuredRun, PathState } from './types.js'
import { createPathLayout, estimateText, layoutPath, measureText, shapePath } from './path-text.js'

import {
  labelStyles, injectStyles, labelClassName, hiddenLabelClassName, cappedLabelClassName, pathClassName, ribbonClassName,
} from './styles.js'

let globalVisLabelStyles: HTMLStyleElement | undefined
let pathId = 0
const cornersOfFirst = new Float64Array(8)
const cornersOfSecond = new Float64Array(8)

export class VisLabel {
  public element: HTMLDivElement = document.createElement('div')
  public seenAt = 0
  private _container: HTMLDivElement
  private _x = 0
  private _y = 0
  /** Measured size: from the DOM, or from the measured text for a label with a path. Cleared when size options change. */
  private _cachedRealWidth: number | undefined = undefined
  private _cachedRealHeight: number | undefined = undefined
  /** Heuristic size (font + padding); updated in _estimateTextSize when _needsMeasureUpdate. */
  private _estimatedWidth = 0
  private _estimatedHeight = 0
  private _visible = false
  private _prevVisible = false
  private _isMounted = false
  private _weight = 0
  private _needsMeasureUpdate = true

  private _customFontSize: number | undefined = undefined
  private _customColor: string | undefined = undefined
  private _customOpacity: number | undefined = undefined
  private _shouldBeShown = false
  private _text: string | number = ''
  private _hasText = false
  /**
   * Tracks whether content was set via `dangerouslySetHtml` (`true`) or `setText` (`false`).
   * Needed so that switching mode with the same string (e.g. `setText` then `dangerouslySetHtml`) still updates the DOM.
   */
  private _contentIsHtml = false
  private _customPadding: LabelPadding | undefined = undefined
  private _customMaxOuterWidth: number | undefined = undefined

  private _customPointerEvents: LabelRendererOptions['pointerEvents'] | undefined
  private _customStyle: string | undefined
  private _customClassName: string | undefined
  private _rotation = 0
  private _left = 0
  private _top = 0
  private _right = 0
  private _bottom = 0
  private _boundsAreStale = true
  private _pathState: PathState | undefined = undefined

  /**
   * @param container - The parent element for the label.
   * @param text - Initial label content (plain text or, if dangerousHtml is true, HTML).
   * @param dontInjectStyles - When true, global styles are not injected.
   * @param dangerousHtml - When true, text is set via innerHTML (XSS risk). Only use with trusted/sanitized content.
   */
  public constructor (container: HTMLDivElement, text?: string | number, dontInjectStyles?: boolean, dangerousHtml?: boolean) {
    if (!dontInjectStyles && !globalVisLabelStyles) globalVisLabelStyles = injectStyles(labelStyles)
    this._container = container
    this._updateClasses()
    if (text !== undefined) {
      if (dangerousHtml) {
        this.dangerouslySetHtml(text)
      } else {
        this.setText(text)
      }
    }
    this.resetFontSize()
    this.resetPadding()
  }

  /**
   * Width used for layout/overlap: measured from the DOM when available, otherwise estimated.
   */
  public get width (): number {
    if (this._cachedRealWidth === undefined) this._updateRealSizeCache()
    if (this._cachedRealWidth !== undefined) return this._cachedRealWidth
    this._estimateTextSize()
    return this._estimatedWidth
  }

  /**
   * Height used for layout/overlap: measured from the DOM when available, otherwise estimated.
   */
  public get height (): number {
    if (this._cachedRealHeight === undefined) this._updateRealSizeCache()
    if (this._cachedRealHeight !== undefined) return this._cachedRealHeight
    this._estimateTextSize()
    return this._estimatedHeight
  }

  public get fontWidthHeightRatio (): number {
    return FONT_WIDTH_HEIGHT_RATIO
  }

  /**
   * Sets the text of the element using textContent (safe from XSS).
   * @param text - The text to set.
   */
  public setText (text: string | number): void {
    this._setContent(text, false)
  }

  /**
   * Sets the inner HTML of the element. Only use with trusted or sanitized content.
   * WARNING: XSS risk — do not pass user-provided or unsanitized HTML.
   * @param html - The HTML to set (string or number; numbers are converted to string).
   */
  public dangerouslySetHtml (html: string | number): void {
    this._setContent(html, true)
  }

  /**
   * Sets the position of the label
   * @param x - The x coordinate of the label
   * @param y - The y coordinate of the label
   */
  public setPosition (x: number, y: number): void {
    if (this._x === x && this._y === y) return
    this._x = x
    this._y = y
    this._boundsAreStale = true
  }

  /**
   * Sets the CSS style of the element.
   * If a color, opacity or pointer-events is specified using the `setColor`,
   * `setOpacity` or `setPointerEvents` method, it takes priority over all custom styles.
   * The `fontSize` style will not apply from `setStyle`, and the `transform` style
   * will not apply, as it is used in the draw method to update the label position.
   * @param style - The style to be set.
   */
  public setStyle (style: string): void {
    if (this._customStyle === style) return
    this._customStyle = style
    this._applyStyles()
  }

  /**
   * Sets the rotation of the label in degrees. Positive = clockwise.
   * @param rotation - Degrees (0 = horizontal).
   */
  public setRotation (rotation: number): void {
    if (this._rotation !== rotation) {
      this._rotation = rotation
      this._boundsAreStale = true
    }
  }

  /**
   * Resets the label rotation to 0 (horizontal).
   */
  public resetRotation (): void {
    this.setRotation(0)
  }

  /**
   * Sets the class name of the component
   * @param className - The class name to be set
   */
  public setClassName (className: string): void {
    if (this._customClassName !== className) {
      this._customClassName = className
      this._updateClasses()
      this._resetRealSizeCache()
    }
  }

  /**
   * Sets the font size of the text in pixels.
   * This value cannot be changed through `setStyle` or `setClassName`
   * methods because it is used to measure the width and height of the label.
   * @param fontSize - The font size to set. If not specified, it will use the default value of `14px`.
   */
  public setFontSize (fontSize = DEFAULT_FONT_SIZE): void {
    if (this._customFontSize !== fontSize) {
      this.element.style.fontSize = `${fontSize}px`
      this._customFontSize = fontSize
      this._needsMeasureUpdate = true
      this._resetRealSizeCache()
    }
  }

  /**
   * Resets the font size of the element to default value.
   */
  public resetFontSize (): void {
    if (this._customFontSize !== DEFAULT_FONT_SIZE) {
      this.element.style.fontSize = `${DEFAULT_FONT_SIZE}px`
      this._customFontSize = DEFAULT_FONT_SIZE
      this._needsMeasureUpdate = true
      this._resetRealSizeCache()
    }
  }

  /**
   * Sets the color of the element.
   * This color will rewrite the color from `setStyle` CSS style if specified.
   * @param color - The color to set
   */
  public setColor (color: string): void {
    if (this._customColor !== color) {
      this.element.style.color = color
      this._customColor = color
    }
  }

  /**
   * Resets the color of the element.
   */
  public resetColor (): void {
    if (this._customColor === undefined) return
    this.element.style.removeProperty('color')
    this._customColor = undefined
  }

  /**
   * Sets the opacity of the element.
   * This opacity will rewrite the opacity from `setStyle` CSS style if specified.
   * @param opacity - The opacity to set.
   */
  public setOpacity (opacity: number): void {
    if (this._customOpacity !== opacity) {
      this.element.style.opacity = String(opacity)
      this._customOpacity = opacity
    }
  }

  /**
   * Resets the opacity of the element.
   */
  public resetOpacity (): void {
    if (this._customOpacity === undefined) return
    this.element.style.removeProperty('opacity')
    this._customOpacity = undefined
  }

  /**
   * Sets the `pointerEvents` property to 'none', 'auto', or 'all'.
   * This `pointerEvents` value will rewrite the pointer events from `setStyle` CSS style if specified.
   * @param pointerEvents - The `pointerEvents` value to be set.
   */
  public setPointerEvents (pointerEvents: LabelRendererOptions['pointerEvents']): void {
    if (this._customPointerEvents !== pointerEvents) {
      this.element.style.pointerEvents = `${pointerEvents}`
      this._customPointerEvents = pointerEvents
    }
  }

  /**
   * Resets the pointer-events of the element.
   */
  public resetPointerEvents (): void {
    if (this._customPointerEvents === undefined) return
    this.element.style.removeProperty('pointer-events')
    this._customPointerEvents = undefined
  }

  /**
   * Sets the padding of the element in pixels.
   * This value cannot be changed through `setStyle` or `setClassName`
   * methods because it is used to measure the width and height of the label.
   * @param padding - The padding object with left, top, right and bottom properties.
   * If not specified, it will use the default value of `{ left: 9px, top: 6px, right: 9px, bottom: 6px }`.
   */
  public setPadding (padding: LabelPadding = DEFAULT_PADDING): void {
    if (!this._customPadding ||
        this._customPadding.left !== padding.left ||
        this._customPadding.top !== padding.top ||
        this._customPadding.right !== padding.right ||
        this._customPadding.bottom !== padding.bottom) {
      this._customPadding = padding
      if (!this._pathState) this._applyPadding(padding)
      this._needsMeasureUpdate = true
      this._resetRealSizeCache()
    }
  }

  public resetPadding (): void {
    this.setPadding()
  }

  /**
   * Caps the label's outer width in pixels, padding and border included, unlike `--vis-label-max-width`, which caps the content box.
   * @param maxOuterWidth - The maximum outer width in pixels.
   */
  public setMaxOuterWidth (maxOuterWidth: number): void {
    if (this._customMaxOuterWidth === maxOuterWidth) return
    const wasSet = this._customMaxOuterWidth !== undefined
    this._customMaxOuterWidth = maxOuterWidth
    if (!this._pathState) this._applyMaxOuterWidth(maxOuterWidth)
    if (!wasSet) this._updateClasses()
    this._needsMeasureUpdate = true
    this._resetRealSizeCache()
  }

  /**
   * Removes the cap set with `setMaxOuterWidth`.
   */
  public resetMaxOuterWidth (): void {
    if (this._customMaxOuterWidth === undefined) return
    this._customMaxOuterWidth = undefined
    this.element.style.removeProperty('max-width')
    this._updateClasses()
    this._needsMeasureUpdate = true
    this._resetRealSizeCache()
  }

  /**
   * Lays the label out along a path instead of at its position and rotation. See `LabelOptions.path`.
   * @param path - The path in container pixels.
   */
  public setPath (path: LabelPath): void {
    if (this._pathState) {
      this._pathState.path = path
      this._pathState.isLayoutStale = true
      this._boundsAreStale = true
      return
    }
    this._pathState = {
      path,
      layout: createPathLayout(),
      source: undefined,
      sourceIsHtml: false,
      runs: [],
      text: undefined,
      isLayoutStale: true,
      areStylesStale: true,
      fits: false,
      lineHeight: 0,
      background: '',
      borderColor: '',
      borderWidth: 0,
      borderRadius: 0,
      svg: undefined,
      baseline: undefined,
      ribbon: undefined,
      textPath: undefined,
      writtenBaseline: '',
      writtenRibbon: '',
      writtenOffset: '',
      writtenText: '',
    }
    this._preparePathText(this._pathState)
    this._resetRealSizeCache()
  }

  /**
   * Stops laying the label out along a path.
   */
  public resetPath (): void {
    const state = this._pathState
    if (!state) return
    state.svg?.remove()
    this._pathState = undefined
    this._writeContent()
    this._applyStyles()
  }

  /**
   * Sets the boolean value of whether the element should be forced to shown or not
   * @param shouldBeShown - The boolean value to set
   */
  public setForceShow (shouldBeShown: boolean): void {
    this._shouldBeShown = shouldBeShown
  }

  /**
   * Gets the boolean value of whether the element should be shown or not.
   * @returns The boolean value of whether the element should be shown or not.
   */
  public getForceShow (): boolean {
    return this._shouldBeShown
  }

  /**
   * Draws the element to the container. A label with a path is drawn as SVG text along it. Any other label is placed
   * with a `transform` style, which rewrites the `transform` from `setStyle` CSS style if specified.
   */
  public draw (): void {
    const isVisible = this.getVisibility()
    if (isVisible !== this._prevVisible) {
      if (this._prevVisible === false) {
        this._container.appendChild(this.element)
      } else {
        this._container.removeChild(this.element)
      }
      this._isMounted = isVisible
      this._updateClasses()
      this._prevVisible = isVisible
    }

    if (isVisible) {
      const state = this._pathState
      if (state) {
        this._drawPathText(state)
        return
      }
      const rotation = this._rotation
      const rotate = rotation !== 0 ? ` rotate(${rotation}deg)` : ''
      // When rotated, pivot around the label’s bottom-center so it stays anchored at (x, y).
      if (rotation !== 0) {
        this.element.style.transformOrigin = '50% 100%'
      } else {
        this.element.style.removeProperty('transform-origin')
      }
      this.element.style.transform = `
        translate(-50%, -100%)
        translate3d(${this._x}px, ${this._y}px, 0)${rotate}
      `
    }
  }

  public overlaps (label: VisLabel): boolean {
    this._updateBounds()
    label._updateBounds()
    if (this._left > label._right || label._left > this._right || this._top > label._bottom || label._top > this._bottom) return false
    if (this._isAxisAligned() && label._isAxisAligned()) return true
    const quads = this._quads(cornersOfFirst)
    const otherQuads = label._quads(cornersOfSecond)
    const quadCount = this._quadCount()
    const otherQuadCount = label._quadCount()
    for (let quad = 0; quad < quadCount; quad += 1) {
      for (let otherQuad = 0; otherQuad < otherQuadCount; otherQuad += 1) {
        if (doQuadsIntersect(quads, otherQuads, quad * 8, otherQuad * 8)) return true
      }
    }
    return false
  }

  public setVisibility (visible = true): void {
    this._visible = visible
  }

  public getVisibility (): boolean {
    return this._visible && this._hasText
  }

  public isOnScreen (containerWidth?: number, containerHeight?: number): boolean {
    const state = this._pathState
    if (state) {
      this._updatePathLayout()
      if (!state.fits) return false
    }
    const width = containerWidth ?? this._container.offsetWidth
    const height = containerHeight ?? this._container.offsetHeight
    return this._x > 0 && this._y > 0 && this._x < width && this._y < height
  }

  public setWeight (weight: number): void {
    this._weight = weight
  }

  public getWeight (): number {
    return this._weight
  }

  public getPrevVisible (): boolean {
    return this._prevVisible
  }

  /**
   * Gets the left edge of the label's bounding box.
   * @returns The x coordinate of the left edge.
   */
  public getLeft (): number {
    this._updateBounds()
    return this._left
  }

  /**
   * Gets the right edge of the label's bounding box.
   * @returns The x coordinate of the right edge.
   */
  public getRight (): number {
    this._updateBounds()
    return this._right
  }

  /**
   * Gets the top edge of the label's bounding box.
   * @returns The y coordinate of the top edge.
   */
  public getTop (): number {
    this._updateBounds()
    return this._top
  }

  /**
   * Gets the bottom edge of the label's bounding box.
   * @returns The y coordinate of the bottom edge.
   */
  public getBottom (): number {
    this._updateBounds()
    return this._bottom
  }

  /**
   * Appends the element to the top of the container
   */
  public raise (): void {
    this._container.appendChild(this.element)
    this._isMounted = true
  }

  /**
   * Removes the element from the DOM.
   */
  public destroy (): void {
    this.element.remove()
    this._isMounted = false
  }

  /** Re-measures from the DOM if the element is currently mounted. No-op otherwise. */
  public refreshSizeFromDom (): void {
    this._updateRealSizeCache()
  }

  private _updateClasses (): void {
    if (this.getVisibility()) {
      window.requestAnimationFrame(() => {
        this.element.className = this._classNames(false)
        if (this._pathState) this._pathState.areStylesStale = true
      })
    } else {
      this.element.className = this._classNames(true)
    }
  }

  private _classNames (isHidden: boolean): string {
    let names = `${labelClassName} ${this._customClassName || ''}`
    if (isHidden) names += ` ${hiddenLabelClassName}`
    if (this._customMaxOuterWidth !== undefined) names += ` ${cappedLabelClassName}`
    return names
  }

  /** Clears the real-size cache so it is re-measured after next appendChild. */
  private _resetRealSizeCache (): void {
    this._cachedRealWidth = undefined
    this._cachedRealHeight = undefined
    this._boundsAreStale = true
    if (this._pathState) {
      this._pathState.isLayoutStale = true
      this._pathState.areStylesStale = true
    }
  }

  /** Fills the size cache when the element is mounted: from the DOM, or from the measured text for a label with a path. */
  private _updateRealSizeCache (): void {
    if (!this._isMounted) return
    const state = this._pathState
    if (state) {
      this._preparePathText(state)
      this._readPathStyles(state)
      return
    }
    this._cachedRealWidth = this.element.offsetWidth
    this._cachedRealHeight = this.element.offsetHeight
    this._boundsAreStale = true
  }

  private _applyPadding ({ top, right, bottom, left }: LabelPadding): void {
    this.element.style.padding = `${top}px ${right}px ${bottom}px ${left}px`
  }

  private _applyMaxOuterWidth (maxOuterWidth: number): void {
    this.element.style.maxWidth = `${maxOuterWidth}px`
  }

  private _updateBounds (): void {
    if (!this._boundsAreStale) return
    const state = this._pathState
    if (state) {
      this._updatePathLayout()
      this._left = state.layout.left
      this._top = state.layout.top
      this._right = state.layout.right
      this._bottom = state.layout.bottom
    } else if (this._rotation === 0) {
      const halfWidth = this.width / 2
      this._left = this._x - halfWidth
      this._right = this._x + halfWidth
      this._top = this._y - this.height
      this._bottom = this._y
    } else {
      const corners = cornersOfFirst
      this._writeCorners(corners)
      this._left = Math.min(corners[0], corners[2], corners[4], corners[6])
      this._top = Math.min(corners[1], corners[3], corners[5], corners[7])
      this._right = Math.max(corners[0], corners[2], corners[4], corners[6])
      this._bottom = Math.max(corners[1], corners[3], corners[5], corners[7])
    }
    this._boundsAreStale = false
  }

  private _writeCorners (corners: Float64Array): void {
    const halfWidth = this.width / 2
    const height = this.height
    const radians = (this._rotation * Math.PI) / 180
    const widthX = -halfWidth * Math.cos(radians)
    const widthY = -halfWidth * Math.sin(radians)
    const heightX = height * Math.sin(radians)
    const heightY = -height * Math.cos(radians)
    corners[0] = this._x + widthX + heightX
    corners[1] = this._y + widthY + heightY
    corners[2] = this._x - widthX + heightX
    corners[3] = this._y - widthY + heightY
    corners[4] = this._x - widthX
    corners[5] = this._y - widthY
    corners[6] = this._x + widthX
    corners[7] = this._y + widthY
  }

  private _padding (): LabelPadding {
    return this._customPadding ?? DEFAULT_PADDING
  }

  private _isAxisAligned (): boolean {
    return !this._pathState && this._rotation === 0
  }

  private _quads (scratch: Float64Array): Float64Array {
    const state = this._pathState
    if (state) return state.layout.quads
    this._writeCorners(scratch)
    return scratch
  }

  private _quadCount (): number {
    return this._pathState?.layout.quadCount ?? 1
  }

  private _setContent (content: string | number, isHtml: boolean): void {
    if (this._text === content && this._contentIsHtml === isHtml) return
    this._text = content
    this._contentIsHtml = isHtml
    this._hasText = typeof content === 'number' || /\S/.test(content)
    if (!this._pathState) this._writeContent()
    this._needsMeasureUpdate = true
    this._resetRealSizeCache()
  }

  private _writeContent (): void {
    const text = typeof this._text === 'number' ? String(this._text) : this._text
    if (this._contentIsHtml) this.element.innerHTML = text
    else this.element.textContent = text
  }

  private _applyStyles (): void {
    this._writeOwnStyles()
    if (this._pathState) this._applyPathModeStyles()
    this._resetRealSizeCache()
  }

  /** Writes the label's inline styles as its options give them, before a path covers up its box. */
  private _writeOwnStyles (): void {
    const { style } = this.element
    style.cssText = this._customStyle ?? ''
    if (this._customColor) style.color = this._customColor
    if (this._customOpacity) style.opacity = String(this._customOpacity)
    if (this._customPointerEvents) style.pointerEvents = this._customPointerEvents
    if (this._customFontSize) style.fontSize = `${this._customFontSize}px`
    if (this._customPadding) this._applyPadding(this._customPadding)
    if (this._customMaxOuterWidth !== undefined) this._applyMaxOuterWidth(this._customMaxOuterWidth)
  }

  private _applyPathModeStyles (): void {
    const { style } = this.element
    Object.assign(style, PATH_LABEL_STYLE)
    style.removeProperty('transform')
    style.removeProperty('transform-origin')
    style.removeProperty('max-width')
    if (this._pathState?.svg) this._pathState.svg.style.pointerEvents = this._customPointerEvents ?? ''
  }

  private _preparePathText (state: PathState): void {
    const source = String(this._text)
    if (state.source === source && state.sourceIsHtml === this._contentIsHtml) return
    state.source = source
    state.sourceIsHtml = this._contentIsHtml
    state.runs = this._contentIsHtml ? styledRunsOf(source) : [{ text: source, style: '' }]
    state.text = undefined
    state.areStylesStale = true
    state.isLayoutStale = true
    this._applyPathModeStyles()
    this._boundsAreStale = true
  }

  private _readPathStyles (state: PathState): void {
    if (!state.areStylesStale) return
    state.areStylesStale = false

    // Read from the label's own box, so that a class or a `style` option styles both kinds of label.
    this._writeOwnStyles()
    const computed = getComputedStyle(this.element)
    state.background = computed.backgroundColor
    state.borderColor = computed.borderTopColor
    state.borderWidth = parseFloat(computed.borderTopWidth) || 0
    state.borderRadius = parseFloat(computed.borderTopLeftRadius) || 0
    const measured = measureText(state.runs, {
      style: computed.fontStyle,
      weight: computed.fontWeight,
      size: computed.fontSize,
      family: computed.fontFamily,
    })
    if (measured) state.text = measured
    const lineHeight = parseFloat(computed.lineHeight)
    state.lineHeight = Number.isFinite(lineHeight) ? lineHeight : measured?.lineHeight ?? parseFloat(computed.fontSize) * LINE_HEIGHT_RATIO
    this._applyPathModeStyles()
    state.isLayoutStale = true
    state.writtenRibbon = ''

    const { left, top, right, bottom } = this._padding()
    this._cachedRealWidth = (state.text?.width ?? 0) + left + right
    this._cachedRealHeight = state.lineHeight + top + bottom
    this._boundsAreStale = true
  }

  private _updatePathLayout (): void {
    const state = this._pathState
    if (!state) return
    this._preparePathText(state)
    if (!state.isLayoutStale) return
    state.isLayoutStale = false
    this._boundsAreStale = true

    const fontSize = this._customFontSize ?? DEFAULT_FONT_SIZE
    if (!state.text) state.text = estimateText(state.runs, fontSize, FONT_WIDTH_HEIGHT_RATIO)
    if (!state.lineHeight) state.lineHeight = state.text.lineHeight
    const { left, top, right, bottom } = this._padding()
    state.fits = layoutPath(state.path, state.text, {
      maxWidth: this._customMaxOuterWidth ?? Infinity,
      offset: state.path.offset ?? 0,
      lineHeight: state.lineHeight,
      paddingLeft: left,
      paddingRight: right,
      paddingTop: top,
      paddingBottom: bottom,
      borderRadius: state.borderRadius,
    }, state.layout)
    this._x = state.layout.centerX
    this._y = state.layout.centerY
  }

  private _buildPathElements (state: PathState): void {
    const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
    svg.style.cssText = PATH_SVG_STYLE

    const defs = document.createElementNS(SVG_NAMESPACE, 'defs')
    state.baseline = document.createElementNS(SVG_NAMESPACE, 'path')
    pathId += 1
    state.baseline.id = `vis-label-path-${pathId}`
    defs.appendChild(state.baseline)

    state.ribbon = document.createElementNS(SVG_NAMESPACE, 'path')
    state.ribbon.setAttribute('class', ribbonClassName)

    const text = document.createElementNS(SVG_NAMESPACE, 'text')
    text.setAttribute('class', pathClassName)
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('fill', 'currentColor')
    state.textPath = document.createElementNS(SVG_NAMESPACE, 'textPath')
    state.textPath.setAttribute('href', `#${state.baseline.id}`)
    text.appendChild(state.textPath)

    svg.append(defs, state.ribbon, text)
    svg.style.pointerEvents = this._customPointerEvents ?? ''
    state.svg = svg
    this.element.replaceChildren(svg)
    state.writtenBaseline = ''
    state.writtenRibbon = ''
    state.writtenOffset = ''
    state.writtenText = ''
  }

  private _drawRibbon (state: PathState): void {
    const ribbon = state.ribbon
    if (!ribbon) return
    const hasFill = state.background !== '' && state.background !== 'rgba(0, 0, 0, 0)' && state.background !== 'transparent'
    const shape = state.fits && (hasFill || state.borderWidth > 0) ? state.layout.ribbon : ''
    if (state.writtenRibbon === shape) return
    state.writtenRibbon = shape
    ribbon.setAttribute('d', shape)
    ribbon.setAttribute('fill', hasFill ? state.background : 'none')
    ribbon.setAttribute('stroke', state.borderWidth > 0 ? state.borderColor : 'none')
    ribbon.setAttribute('stroke-width', String(state.borderWidth))
  }

  private _drawPathRuns (state: PathState, runs: MeasuredRun[]): void {
    const textPath = state.textPath
    if (!textPath) return
    const key = runs.map(run => `${run.style} ${run.text}`).join('')
    if (state.writtenText === key) return
    state.writtenText = key

    if (runs.length === 1 && !runs[0].style) {
      textPath.textContent = runs[0].text
      return
    }
    const fragment = document.createDocumentFragment()
    for (const run of runs) {
      const tspan = document.createElementNS(SVG_NAMESPACE, 'tspan')
      if (run.style) tspan.setAttribute('style', svgStyleOfRun(run.style))
      tspan.textContent = run.text
      fragment.appendChild(tspan)
    }
    textPath.replaceChildren(fragment)
  }

  private _drawPathText (state: PathState): void {
    if (state.areStylesStale && this._isMounted) this._readPathStyles(state)
    this._updatePathLayout()
    if (!state.svg || state.svg.parentElement !== this.element) this._buildPathElements(state)

    const { layout } = state
    if (state.fits) shapePath(state.path, layout)
    if (state.writtenBaseline !== layout.baseline) {
      state.writtenBaseline = layout.baseline
      state.baseline?.setAttribute('d', layout.baseline)
    }
    const offset = layout.textCenter.toFixed(1)
    if (state.writtenOffset !== offset) {
      state.writtenOffset = offset
      state.textPath?.setAttribute('startOffset', offset)
    }
    this._drawPathRuns(state, layout.runs)
    this._drawRibbon(state)
  }

  /**
   * Updates estimated size when needed. Real size is cached separately after appendChild.
   */
  private _estimateTextSize (): void {
    if (!this._needsMeasureUpdate) return

    const { left, top, right, bottom } = this._padding()
    const fontSize = this._customFontSize ?? DEFAULT_FONT_SIZE
    const lines = this._getEstimatedTextLines()
    const longestLineLength = lines.reduce((longest, line) => Math.max(longest, line.length), 0)
    const lineHeight = fontSize * LINE_HEIGHT_RATIO
    this._estimatedWidth = Math.min(fontSize * FONT_WIDTH_HEIGHT_RATIO * longestLineLength + left + right, this._customMaxOuterWidth ?? Infinity)
    this._estimatedHeight = (lines.length > 1 ? lineHeight * lines.length : fontSize) + top + bottom

    this._needsMeasureUpdate = false
  }

  private _getEstimatedTextLines (): string[] {
    const text = String(this._text)
    const normalizedText = this._contentIsHtml
      ? text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:div|p|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
      : text
    const lines = normalizedText.split(/\r?\n/).map(line => line.trim())
    return lines.length > 0 ? lines : ['']
  }
}
