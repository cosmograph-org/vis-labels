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
