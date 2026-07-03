// 디자인 시스템 강제 게이트 — 문서(docs/DESIGN.md)가 아니라 테스트가 규칙을 지킨다.
// npm test가 모든 goal 체크 스크립트의 공통 게이트라, 여기 걸리면 어떤 goal도 못 닫는다.
//
// 규칙 3가지:
//  1) 색 리터럴(hex/rgb/hsl)은 css/tokens.css에만 존재한다 — 나머지 CSS는 var()만.
//     예외: components.css의 designlint-allow 마커 구간(verify-cards 확정값 잠금 블록).
//  2) src/ 안의 JS에 hex 색 금지 — 색이 필요하면 'var(--토큰)' 문자열 패스스루.
//  3) tokens.css는 :root 선언 전용 — 다른 셀렉터가 생기면 tokensParser/export 전제가 깨진다.

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')

function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

function stripAllowlist(text) {
  return text.replace(
    /\/\* designlint-allow-start[\s\S]*?designlint-allow-end \*\//g,
    '',
  )
}

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g

function findColorLiterals(text) {
  return [...text.matchAll(COLOR_LITERAL)].map((m) => m[0])
}

function listFiles(dir, ext) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full, ext))
    else if (entry.name.endsWith(ext)) out.push(full)
  }
  return out
}

describe('designLint — 색 리터럴은 tokens.css에만', () => {
  const cssFiles = listFiles(path.join(ROOT, 'css'), '.css')
    .filter((f) => path.basename(f) !== 'tokens.css')

  test.each(cssFiles.map((f) => [path.relative(ROOT, f), f]))(
    '%s 에 raw 색 없음',
    (_label, file) => {
      const raw = fs.readFileSync(file, 'utf-8')
      const scannable = stripCssComments(stripAllowlist(raw))
      const found = findColorLiterals(scannable)
      expect(found).toEqual([])
    },
  )

  test('allowlist 마커는 components.css에 정확히 한 쌍 존재한다', () => {
    const text = fs.readFileSync(path.join(ROOT, 'css', 'components.css'), 'utf-8')
    expect(text.match(/designlint-allow-start/g)).toHaveLength(1)
    expect(text.match(/designlint-allow-end/g)).toHaveLength(1)
  })
})

describe('designLint — JS에 hex 색 금지', () => {
  const jsFiles = listFiles(path.join(ROOT, 'src'), '.js')

  test.each(jsFiles.map((f) => [path.relative(ROOT, f), f]))(
    '%s 에 hex 색 없음',
    (_label, file) => {
      const raw = fs.readFileSync(file, 'utf-8')
      // JS 주석 제거(라인/블록) 후 스캔 — deriveSeed의 0x45d9f3b 같은 16진 정수 리터럴은
      // #가 아니라 0x 표기라 애초에 안 걸린다.
      const scannable = raw
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      const found = [...scannable.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0])
      expect(found).toEqual([])
    },
  )
})

describe('designLint — tokens.css는 선언 전용', () => {
  test(':root 블록 하나만 존재하고 다른 셀렉터가 없다', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'css', 'tokens.css'), 'utf-8')
    const withoutComments = stripCssComments(raw).trim()
    // 전체가 ":root { ... }" 단일 블록이어야 함 (중첩 중괄호 없음)
    expect(withoutComments).toMatch(/^:root\s*\{[^{}]*\}$/)
  })

  test('토큰이 최소한의 핵심 세트를 포함한다 (파서 회귀 가드)', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'css', 'tokens.css'), 'utf-8')
    for (const required of [
      '--bg-primary', '--accent-gold', '--space-16', '--text-sm',
      '--radius-6', '--duration-ball-travel', '--border-panel', '--pitch-surface',
    ]) {
      expect(raw).toContain(required)
    }
  })
})
