type OptionRule = { declarations: string; className: string; rule: CSSRule; users: number }

const rules = new Map<string, OptionRule>()
let sheet: CSSStyleSheet | null = null
let nextId = 0

export function acquireOptionRule (declarations: string): string {
  const existing = rules.get(declarations)
  if (existing) {
    existing.users += 1
    return existing.declarations
  }
  if (!sheet) sheet = document.head.appendChild(document.createElement('style')).sheet
  if (!sheet) return declarations
  const className = `vis-label--option-${nextId}`
  nextId += 1
  const index = sheet.insertRule(`:where(.${className}) { ${declarations} }`, sheet.cssRules.length)
  rules.set(declarations, { declarations, className, rule: sheet.cssRules[index], users: 1 })
  return declarations
}

export function releaseOptionRule (declarations: string): void {
  const entry = rules.get(declarations)
  if (!entry) return
  entry.users -= 1
  if (entry.users > 0 || !sheet) return
  const index = Array.prototype.indexOf.call(sheet.cssRules, entry.rule)
  if (index >= 0) sheet.deleteRule(index)
  rules.delete(declarations)
}

export function optionClassName (declarations: string | undefined): string {
  return declarations === undefined ? '' : rules.get(declarations)?.className ?? ''
}
