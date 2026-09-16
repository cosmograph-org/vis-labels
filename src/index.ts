import { VisLabel } from './vis-label.js'
import { LabelOptions, OnClickCallback, LabelRendererOptions, LabelPadding } from './types.js'

import { labelContainerStyles, injectStyles, labelsContainerClassName, hiddenLabelsContainerClassName } from './styles.js'

let globalVisLabelRendererStyles: HTMLStyleElement | undefined
export class LabelRenderer {
  private _visLabels = new Map<string, VisLabel>()
  private _container: HTMLDivElement
  private _onClickCallback: OnClickCallback | undefined
  private _pointerEvents: LabelRendererOptions['pointerEvents'] | undefined
  private _elementToData = new Map<HTMLDivElement, LabelOptions>()
  private _dispatchWheelEventElement: HTMLElement | undefined
  private _dontInjectStyles: boolean | undefined
  private _padding: LabelPadding | undefined
  private _fontSize: number | undefined
  private _dangerousHtml = false
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
    // Add new labels and take into account existing labels
    const labelsToDelete = new Map(this._visLabels)
    labels.forEach(label => {
      const { x, y, fontSize, color, text, weight, opacity, shouldBeShown, style, className, padding, rotation } = label
      const exists = this._visLabels.get(label.id)
      if (exists) {
        labelsToDelete.delete(label.id)
      } else {
        const cssLabel = new VisLabel(this._container, label.text, this._dontInjectStyles, this._dangerousHtml)
        this._visLabels.set(label.id, cssLabel)
        this._elementToData.set(cssLabel.element, label)
      }
      const labelToUpdate = this._visLabels.get(label.id)
      if (labelToUpdate) {
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
      }
    })

    // Remove labels from points that don't longer exist
    for (const [key] of labelsToDelete) {
      const cssLabel = this._visLabels.get(key)
      if (cssLabel) {
        this._elementToData.delete(cssLabel.element)
        cssLabel.destroy()
      }
      this._visLabels.delete(key)
    }
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
    const visLabels = Array.from(this._visLabels.values())

    // Cache container dimensions to avoid repeated layout recalculations
    const containerWidth = this._container.offsetWidth
    const containerHeight = this._container.offsetHeight

    // Set label visibility to true if they are on screen
    visLabels.forEach(l => l.setVisibility(l.isOnScreen(containerWidth, containerHeight)))

    // Re-measure any visible labels already mounted but with a stale/missing size cache
    // (e.g. after content or style changed). Labels not yet in the DOM are skipped (no-op).
    visLabels.forEach(l => { if (l.getVisibility()) l.refreshSizeFromDom() })

    if (visLabels.length <= 1) return

    // Sweep and Prune: Sort labels by their left edge (X-axis)
    visLabels.sort((a, b) => a.getLeft() - b.getLeft())

    // Check for overlaps using the sorted order
    for (let i = 0; i < visLabels.length; i += 1) {
      const label1 = visLabels[i]
      if (!label1.getVisibility()) continue

      for (let j = i + 1; j < visLabels.length; j += 1) {
        const label2 = visLabels[j]
        if (!label2.getVisibility()) continue

        // No further x-overlap possible (sorted by left edge)
        if (label2.getLeft() > label1.getRight()) break

        // Continue if the labels don't overlap
        if (!label1.overlaps(label2)) continue

        // Prefer: 1) higher weight, 2) previously visible (when equal weight and no forceShow)
        const preferLabel2 = label2.getWeight() > label1.getWeight() ||
          (label1.getWeight() === label2.getWeight() &&
            !label1.getForceShow() && !label2.getForceShow() &&
            label2.getPrevVisible() && !label1.getPrevVisible())

        const [winner, loser] = preferLabel2 ? [label2, label1] : [label1, label2]
        loser.setVisibility(winner.getForceShow() ? false : loser.getForceShow())

        // No further comparisons with this label
        if (!label1.getVisibility()) break
      }
    }
  }
}

export { VisLabel }
export type { LabelOptions, LabelPadding, LabelRendererOptions, OnClickCallback }
