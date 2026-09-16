import { VisLabel } from './vis-label.js'
import { LabelOptions, OnClickCallback, LabelRendererOptions, LabelPadding } from './types.js'

import { labelContainerStyles, injectStyles, labelsContainerClassName, hiddenLabelsContainerClassName } from './styles.js'

let globalVisLabelRendererStyles: HTMLStyleElement | undefined
const byLeftEdge = (a: VisLabel, b: VisLabel): number => a.getLeft() - b.getLeft()
export class LabelRenderer {
  private _visLabels = new Map<string, VisLabel>()
  private _container: HTMLDivElement
  private _onClickCallback: OnClickCallback | undefined
  private _pointerEvents: LabelRendererOptions['pointerEvents'] | undefined
  private _elementToData = new Map<HTMLDivElement, LabelOptions>()
  private _labelOrder: VisLabel[] = []
  private _labelOrderIsStale = true
  private _onScreenLabels: VisLabel[] = []
  private _offScreenLabels: VisLabel[] = []
  private _dispatchWheelEventElement: HTMLElement | undefined
  private _dontInjectStyles: boolean | undefined
  private _padding: LabelPadding | undefined
  private _fontSize: number | undefined
  private _dangerousHtml = false
  private _sweep = 0
  private readonly _boundOnClick = this._onClick.bind(this)
  private readonly _boundOnWheel = this._onWheel.bind(this)

  public constructor (container: HTMLDivElement, options?: LabelRendererOptions) {
    if (!options?.dontInjectStyles && !globalVisLabelRendererStyles) globalVisLabelRendererStyles = injectStyles(labelContainerStyles)
    this._container = container
    this._setContainerVisibility(false)

    container.addEventListener('click', this._boundOnClick)
    this.setOptions(options ?? {})
  }

  public setOptions (options: LabelRendererOptions = {}): void {
    this._onClickCallback = options.onLabelClick
    this._pointerEvents = options.pointerEvents
    this._dontInjectStyles = options.dontInjectStyles
    this._padding = options.padding
    this._fontSize = options.fontSize
    this._dangerousHtml = Boolean(options.dangerousHtml)

    const previousDispatchWheelEventElement = this._dispatchWheelEventElement
    this._dispatchWheelEventElement = options.dispatchWheelEventElement
    if (!previousDispatchWheelEventElement && this._dispatchWheelEventElement) {
      this._container.addEventListener('wheel', this._boundOnWheel)
    } else if (previousDispatchWheelEventElement && !this._dispatchWheelEventElement) {
      this._container.removeEventListener('wheel', this._boundOnWheel)
    }
  }

  public setLabels (labels: LabelOptions[]): void {
    this._sweep += 1
    let named = 0
    labels.forEach(label => {
      const { x, y, fontSize, color, text, weight, opacity, shouldBeShown, style, className, padding, rotation, maxOuterWidth } = label
      const exists = this._visLabels.get(label.id)
      if (!exists) {
        this._labelOrderIsStale = true
        const cssLabel = new VisLabel(this._container, label.text, this._dontInjectStyles, this._dangerousHtml)
        this._visLabels.set(label.id, cssLabel)
        this._elementToData.set(cssLabel.element, label)
      }
      const labelToUpdate = this._visLabels.get(label.id)
      if (labelToUpdate) {
        if (labelToUpdate.seenAt !== this._sweep) {
          labelToUpdate.seenAt = this._sweep
          named += 1
        }
        if (this._dangerousHtml) {
          labelToUpdate.dangerouslySetHtml(text)
        } else {
          labelToUpdate.setText(text)
        }
        labelToUpdate.setPosition(x, y)
        if (style !== undefined) labelToUpdate.setStyle(style)
        if (weight !== undefined) labelToUpdate.setWeight(weight)

        if (color !== undefined) labelToUpdate.setColor(color)

        /**
         * We need to check if the font size and padding are specified in the Options.
         * These properties can't be set using general CSS styles or class names because
         * they are used to calculate the label's size.
         */
        if (fontSize !== undefined) labelToUpdate.setFontSize(fontSize)
        else if (this._fontSize !== undefined) labelToUpdate.setFontSize(this._fontSize)
        else labelToUpdate.resetFontSize()
        if (padding !== undefined) labelToUpdate.setPadding(padding)
        else if (this._padding !== undefined) labelToUpdate.setPadding(this._padding)
        else labelToUpdate.resetPadding()

        if (this._pointerEvents !== undefined) labelToUpdate.setPointerEvents(this._pointerEvents)
        else labelToUpdate.resetPointerEvents()
        if (opacity !== undefined) labelToUpdate.setOpacity(opacity)
        if (shouldBeShown !== undefined) labelToUpdate.setForceShow(shouldBeShown)
        if (className !== undefined) labelToUpdate.setClassName(className)
        if (rotation !== undefined) labelToUpdate.setRotation(rotation)
        else labelToUpdate.resetRotation()
        if (maxOuterWidth !== undefined) labelToUpdate.setMaxOuterWidth(maxOuterWidth)
        else labelToUpdate.resetMaxOuterWidth()
      }
    })

    // Remove labels from points that don't longer exist. Counted by labels named, not entries, so a repeated id can't hide a removal.
    if (this._visLabels.size === named) return
    this._visLabels.forEach((cssLabel, id) => {
      if (cssLabel.seenAt === this._sweep) return
      this._elementToData.delete(cssLabel.element)
      cssLabel.destroy()
      this._visLabels.delete(id)
      this._labelOrderIsStale = true
    })
  }

  public setLabelPosition (id: string, x: number, y: number, rotation?: number): boolean {
    const label = this._visLabels.get(id)
    if (!label) return false
    label.setPosition(x, y)
    if (rotation !== undefined) label.setRotation(rotation)
    return true
  }

  public draw (withIntersection = true): void {
    if (withIntersection) {
      this._intersectLabels()
    } else {
      const containerWidth = this._container.offsetWidth
      const containerHeight = this._container.offsetHeight
      this._visLabels.forEach(cssLabel =>
        cssLabel.setVisibility(cssLabel.isOnScreen(containerWidth, containerHeight)))
    }
    this._visLabels.forEach(cssLabel => cssLabel.draw())
  }

  public isLabelVisible (id: string): boolean {
    return this._visLabels.get(id)?.getVisibility() ?? false
  }

  public getVisibleLabelIds (): string[] {
    const ids: string[] = []
    this._visLabels.forEach((label, id) => {
      if (label.getVisibility()) ids.push(id)
    })
    return ids
  }

  public show (): void {
    this._setContainerVisibility(false)
  }

  public hide (): void {
    this._setContainerVisibility(true)
  }

  public destroy (): void {
    this._container.removeEventListener('click', this._boundOnClick)
    this._container.removeEventListener('wheel', this._boundOnWheel)
    this._visLabels.forEach(cssLabel => cssLabel.destroy())
  }

  private _onClick (e: MouseEvent): void {
    const label = this._elementToData.get(e.target as HTMLDivElement)
    if (label) {
      this._onClickCallback?.(e, label)
    }
  }

  private _onWheel (e: WheelEvent): void {
    e.preventDefault()
    const newWheelEvent = new WheelEvent('wheel', e)
    this._dispatchWheelEventElement?.dispatchEvent(newWheelEvent)
  }

  private _setContainerVisibility (hidden: boolean): void {
    this._container.classList.add(labelsContainerClassName)
    this._container.classList.toggle(hiddenLabelsContainerClassName, hidden)
  }

  private _intersectLabels (): void {
    if (this._labelOrderIsStale) {
      this._labelOrder = Array.from(this._visLabels.values())
      this._labelOrderIsStale = false
    }

    // Cache container dimensions to avoid repeated layout recalculations
    const containerWidth = this._container.offsetWidth
    const containerHeight = this._container.offsetHeight

    const onScreen = this._onScreenLabels
    const offScreen = this._offScreenLabels
    onScreen.length = 0
    offScreen.length = 0
    for (const label of this._labelOrder) {
      // Set label visibility to true if they are on screen
      label.setVisibility(label.isOnScreen(containerWidth, containerHeight))
      if (label.getVisibility()) {
        // Re-measure any visible labels already mounted but with a stale/missing size cache
        // (e.g. after content or style changed). Labels not yet in the DOM are skipped (no-op).
        label.refreshSizeFromDom()
        onScreen.push(label)
      } else {
        offScreen.push(label)
      }
    }

    if (onScreen.length > 1) {
      // Sweep and Prune: Sort labels by their left edge (X-axis)
      onScreen.sort(byLeftEdge)

      // Check for overlaps using the sorted order
      for (let i = 0; i < onScreen.length; i += 1) {
        const label1 = onScreen[i]
        if (!label1.getVisibility()) continue
        const right = label1.getRight()

        for (let j = i + 1; j < onScreen.length; j += 1) {
          const label2 = onScreen[j]

          // No further x-overlap possible (sorted by left edge)
          if (label2.getLeft() > right) break
          if (!label2.getVisibility()) continue

          // Continue if the labels don't overlap
          if (!label1.overlaps(label2)) continue

          // Prefer: 1) higher weight, 2) previously visible (when equal weight and no forceShow)
          const preferLabel2 = label2.getWeight() > label1.getWeight() ||
            (label1.getWeight() === label2.getWeight() &&
              !label1.getForceShow() && !label2.getForceShow() &&
              label2.getPrevVisible() && !label1.getPrevVisible())

          const winner = preferLabel2 ? label2 : label1
          const loser = preferLabel2 ? label1 : label2
          loser.setVisibility(winner.getForceShow() ? false : loser.getForceShow())

          // No further comparisons with this label
          if (!label1.getVisibility()) break
        }
      }
    }

    const order = this._labelOrder
    order.length = 0
    for (const label of onScreen) order.push(label)
    for (const label of offScreen) order.push(label)
  }
}

export { VisLabel }
export type { LabelOptions, LabelPadding, LabelRendererOptions, OnClickCallback }
