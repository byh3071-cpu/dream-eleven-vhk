import { parseTokens, groupOf, toFigmaTokens } from '../../src/ui/tokensParser.js'
import fs from 'fs'
import path from 'path'

describe('parseTokens', () => {
  test('주석/공백을 무시하고 선언만 수집한다', () => {
    const css = `/* 머리말 주석 */
:root {
  --bg-primary: #0b0e14; /* 인라인 주석 */
  --space-16: 1rem;
}`
    const tokens = parseTokens(css)
    expect(tokens).toEqual([
      { name: 'bg-primary', value: '#0b0e14', group: 'color' },
      { name: 'space-16', value: '1rem', group: 'space' },
    ])
  })

  test('var()와 괄호가 든 값도 세미콜론까지 통째로 잡는다', () => {
    const css = ':root { --pitch-surface: radial-gradient(ellipse at 50% 50%, var(--a) 0%, var(--b) 100%); }'
    const [token] = parseTokens(css)
    expect(token.value).toContain('radial-gradient')
    expect(token.value).toContain('var(--b) 100%)')
  })

  test('실제 tokens.css를 파싱하면 전 그룹이 비어있지 않다', () => {
    const raw = fs.readFileSync(path.resolve('css/tokens.css'), 'utf-8')
    const tokens = parseTokens(raw)
    const groups = new Set(tokens.map((t) => t.group))
    for (const g of ['color', 'space', 'type', 'radius', 'shadow', 'interaction', 'motion', 'z-index', 'border']) {
      expect(groups.has(g)).toBe(true)
    }
    // etc 그룹이 생기면 GROUP_RULES에 누락이 있다는 신호
    expect(tokens.filter((t) => t.group === 'etc')).toEqual([])
  })
})

describe('groupOf', () => {
  test('text-primary/text-dim은 타입이 아니라 색으로 분류된다', () => {
    expect(groupOf('text-primary')).toBe('color')
    expect(groupOf('text-dim')).toBe('color')
    expect(groupOf('text-sm')).toBe('type')
  })

  test('border-subtle/border-faint는 색, border-panel은 보더', () => {
    expect(groupOf('border-subtle')).toBe('color')
    expect(groupOf('border-faint')).toBe('color')
    expect(groupOf('border-panel')).toBe('border')
  })
})

describe('toFigmaTokens', () => {
  test('그룹별 {name: {value, type}} 구조로 변환한다', () => {
    const out = toFigmaTokens([
      { name: 'accent-gold', value: '#f0b429', group: 'color' },
      { name: 'space-16', value: '1rem', group: 'space' },
    ])
    expect(out.color['accent-gold']).toEqual({ value: '#f0b429', type: 'color' })
    expect(out.space['space-16']).toEqual({ value: '1rem', type: 'spacing' })
  })
})
