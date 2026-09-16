import { doQuadsIntersect } from './helper.js'
import { DEFAULT_FONT_SIZE, DEFAULT_PADDING, FONT_WIDTH_HEIGHT_RATIO } from './variables.js'
import { LabelPadding, LabelRendererOptions } from './types.js'

import { labelStyles, injectStyles, labelClassName, hiddenLabelClassName } from './styles.js'

let globalVisLabelStyles: HTMLStyleElement | undefined
const cornersOfFirst = new Float64Array(8)
const cornersOfSecond = new Float64Array(8)

export class VisLabel {
  public element: HTMLDivElement = document.createElement('div')
  public seenAt = 0
  private _container: HTMLDivElement
  private _x = 0
  private _y = 0
  /** Real size from offsetWidth/offsetHeight; set only after appendChild when not yet set; cleared when size options change. */
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

  private _customPointerEvents: LabelRendererOptions['pointerEvents'] | undefined
  private _customStyle: string | undefined
  private _customClassName: string | undefined
  private _rotation = 0
  private _left = 0
  private _top = 0
  private _right = 0
  private _bottom = 0
  private _boundsAreStale = true

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
    if (this._customStyle !== style) {
      this._customStyle = style
      this.element.style.cssText = this._customStyle

      if (this._customColor) this.element.style.color = this._customColor
      if (this._customOpacity) this.element.style.opacity = String(this._customOpacity)
      if (this._customPointerEvents) this.element.style.pointerEvents = this._customPointerEvents
      if (this._customFontSize) this.element.style.fontSize = `${this._customFontSize}px`
      if (this._customPadding) this._applyPadding(this._customPadding)
      this._resetRealSizeCache()
    }
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
   * This `pointerEvents` value will rewrite the opacity from `setStyle` CSS style if specified.
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
   * If not specified or partially specified, it will use the default value of
   * `{ left: 9px, top: 6px, right: 9px, bottom: 6px }` for unspecified values.
   */
  public setPadding (padding: LabelPadding = DEFAULT_PADDING): void {
    if (!this._customPadding ||
        this._customPadding.left !== padding.left ||
        this._customPadding.top !== padding.top ||
        this._customPadding.right !== padding.right ||
        this._customPadding.bottom !== padding.bottom) {
      this._customPadding = padding
      this._applyPadding(padding)
      this._needsMeasureUpdate = true
      this._resetRealSizeCache()
    }
  }

  public resetPadding (): void {
    this.setPadding()
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
   * Draws the element to the container and updates the label's coordinate.
   * The label's coordinate updates using `transform` style. It rewrite
   * the `transform` from `setStyle` CSS style if specified.
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
    if (this._rotation === 0 && label._rotation === 0) return true
    this._writeCorners(cornersOfFirst)
    label._writeCorners(cornersOfSecond)
    return doQuadsIntersect(cornersOfFirst, cornersOfSecond)
  }

  public setVisibility (visible = true): void {
    this._visible = visible
  }

  public getVisibility (): boolean {
    return this._visible && this._hasText
  }

  public isOnScreen (containerWidth?: number, containerHeight?: number): boolean {
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
    const isVisible = this.getVisibility()
    if (isVisible) {
      window.requestAnimationFrame(() => {
        this.element.className = `${labelClassName} ${this._customClassName || ''}`
      })
    } else {
      this.element.className = `${labelClassName} ${this._customClassName || ''} ${hiddenLabelClassName}`
    }
  }

  /** Clears the real-size cache so it is re-measured after next appendChild. */
  private _resetRealSizeCache (): void {
    this._cachedRealWidth = undefined
    this._cachedRealHeight = undefined
    this._boundsAreStale = true
  }

  /** Fills real-size cache from the DOM when the element is mounted. */
  private _updateRealSizeCache (): void {
    if (!this._isMounted) return
    this._cachedRealWidth = this.element.offsetWidth
    this._cachedRealHeight = this.element.offsetHeight
    this._boundsAreStale = true
  }

  private _applyPadding ({ top, right, bottom, left }: LabelPadding): void {
    this.element.style.padding = `${top}px ${right}px ${bottom}px ${left}px`
  }

  private _updateBounds (): void {
    if (!this._boundsAreStale) return
    if (this._rotation === 0) {
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

  private _setContent (content: string | number, isHtml: boolean): void {
    if (this._text === content && this._contentIsHtml === isHtml) return
    this._text = content
    this._contentIsHtml = isHtml
    this._hasText = typeof content === 'number' || /\S/.test(content)
    this._writeContent()
    this._needsMeasureUpdate = true
    this._resetRealSizeCache()
  }

  private _writeContent (): void {
    const text = typeof this._text === 'number' ? String(this._text) : this._text
    if (this._contentIsHtml) this.element.innerHTML = text
    else this.element.textContent = text
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
    const lineHeight = fontSize * 1.2
    this._estimatedWidth = fontSize * FONT_WIDTH_HEIGHT_RATIO * longestLineLength + left + right
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
