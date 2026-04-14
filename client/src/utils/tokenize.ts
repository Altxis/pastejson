export type TokenType = 'key' | 'string' | 'number' | 'boolean' | 'null' | 'punctuation' | 'whitespace'
export type Token = { type: TokenType; text: string }

// Alternation order matters: key ("...":) must come before plain string ("...")
const TOKEN_RE =
  /"(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,]/g

export function tokenize(json: string): Token[] {
  const tokens: Token[] = []
  let last = 0
  let m: RegExpExecArray | null

  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(json)) !== null) {
    if (m.index > last) {
      tokens.push({ type: 'whitespace', text: json.slice(last, m.index) })
    }
    const text = m[0]
    if (text.startsWith('"')) {
      if (text.endsWith(':')) {
        // "key": — emit key and colon separately
        const colonIdx = text.lastIndexOf(':')
        tokens.push({ type: 'key', text: text.slice(0, colonIdx).trimEnd() })
        tokens.push({ type: 'punctuation', text: ':' })
      } else {
        tokens.push({ type: 'string', text })
      }
    } else if (text === 'true' || text === 'false') {
      tokens.push({ type: 'boolean', text })
    } else if (text === 'null') {
      tokens.push({ type: 'null', text })
    } else if ('{[}],: '.includes(text)) {
      tokens.push({ type: 'punctuation', text })
    } else {
      tokens.push({ type: 'number', text })
    }
    last = TOKEN_RE.lastIndex
  }

  if (last < json.length) {
    tokens.push({ type: 'whitespace', text: json.slice(last) })
  }
  return tokens
}
