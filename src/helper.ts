import { FontParts, GraphemeSegmenter, GraphemeSegmenterConstructor, TextRun } from './types.js'
import { LINE_BREAKING_TAGS, MAX_CACHED_MEASUREMENTS, TAG_STYLES } from './variables.js'

let graphemeSegmenter: GraphemeSegmenter | undefined
let markup: HTMLTemplateElement | undefined

function hasSeparatingAxis (quad: ArrayLike<number>, quadOffset: number, other: ArrayLike<number>, otherOffset: number): boolean {
  for (let edge = 0; edge < 2; edge += 1) {
    const axisX = quad[quadOffset + edge * 2 + 1] - quad[quadOffset + edge * 2 + 3]
    const axisY = quad[quadOffset + edge * 2 + 2] - quad[quadOffset + edge * 2]
    let minQuad = Infinity
    let maxQuad = -Infinity
    let minOther = Infinity
    let maxOther = -Infinity
    for (let corner = 0; corner < 4; corner += 1) {
      const quadProjection = quad[quadOffset + corner * 2] * axisX + quad[quadOffset + corner * 2 + 1] * axisY
      const otherProjection = other[otherOffset + corner * 2] * axisX + other[otherOffset + corner * 2 + 1] * axisY
      minQuad = Math.min(minQuad, quadProjection)
      maxQuad = Math.max(maxQuad, quadProjection)
      minOther = Math.min(minOther, otherProjection)
      maxOther = Math.max(maxOther, otherProjection)
    }
    if (maxQuad < minOther || maxOther < minQuad) return true
  }
  return false
}

export function doQuadsIntersect (quads1: ArrayLike<number>, quads2: ArrayLike<number>, offset1 = 0, offset2 = 0): boolean {
  return !hasSeparatingAxis(quads1, offset1, quads2, offset2) && !hasSeparatingAxis(quads2, offset2, quads1, offset1)
}

export function lruGet<T> (cache: Map<string, T>, key: string): T | undefined {
  const value = cache.get(key)
  if (value !== undefined) {
    cache.delete(key)
    cache.set(key, value)
  }
  return value
}

export function lruSet<T> (cache: Map<string, T>, key: string, value: T): void {
  if (cache.size >= MAX_CACHED_MEASUREMENTS) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

export function splitGraphemes (text: string): string[] {
  if (!graphemeSegmenter) {
    const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenterConstructor }).Segmenter
    if (!Segmenter) return Array.from(text)
    graphemeSegmenter = new Segmenter(undefined, { granularity: 'grapheme' })
  }
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment)
}

export function styledRunsOf (html: string): TextRun[] {
  if (!markup) markup = document.createElement('template')
  markup.innerHTML = html
  const runs: TextRun[] = []
  const append = (node: Node, style: string): void => {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.nodeValue ?? '').replace(/\s+/g, ' ')
        if (text) runs.push({ text, style })
      } else {
        if (LINE_BREAKING_TAGS.has(child.nodeName)) runs.push({ text: ' ', style })
        append(child, `${style}${TAG_STYLES[child.nodeName] ?? ''}${(child as HTMLElement).style?.cssText ?? ''}`)
      }
    })
  }
  append(markup.content, '')

  while (runs.length && !runs[0].text.trim()) runs.shift()
  while (runs.length && !runs[runs.length - 1].text.trim()) runs.pop()
  return runs
}

export function svgStyleOfRun (style: string): string {
  return style.replace(/(^|;)\s*color\s*:/gi, '$1fill:')
}

export function fontOfRun (parts: FontParts, style: string): string {
  if (!style) return `${parts.style} ${parts.weight} ${parts.size} ${parts.family}`
  const read = (property: string): string | undefined => new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(style)?.[1].trim()
  const size = read('font-size')
  const relative = size && /^([\d.]+)(em|%)$/i.exec(size)
  const scaled = relative && `${parseFloat(parts.size) * parseFloat(relative[1]) / (relative[2] === '%' ? 100 : 1)}px`
  return [
    read('font-style') ?? parts.style,
    read('font-weight') ?? parts.weight,
    scaled ?? (size?.endsWith('px') ? size : parts.size),
    read('font-family') ?? parts.family,
  ].join(' ')
}
