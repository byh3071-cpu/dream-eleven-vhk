// css/tokens.css의 :root 선언을 파싱해 토큰 목록으로 만든다. DOM 의존 0 —
// 스타일가이드(브라우저 fetch)와 scripts/export-tokens.mjs(node fs)가 같은 코드를 쓴다.
// 토큰 목록을 JS에 별도 매니페스트로 중복 유지하지 않기 위한 단일 파서다:
// tokens.css가 유일한 소스고, 화면과 내보내기는 전부 여기서 파생된다.

// 프리픽스 -> 그룹. 순서 중요: 먼저 매치되는 것이 이긴다 (--color-danger는 color,
// --text-primary는 아래 color 예외 목록에 있어서 type이 아니라 color로 분류).
const GROUP_RULES = [
  { group: 'color', test: (n) => /^(bg-|accent-|text-primary$|text-dim$|border-subtle$|color-|pitch-|glow-|border-faint$|club-)/.test(n) },
  { group: 'space', test: (n) => n.startsWith('space-') },
  { group: 'type', test: (n) => n.startsWith('text-') || n.startsWith('font-') },
  { group: 'radius', test: (n) => n.startsWith('radius-') },
  { group: 'shadow', test: (n) => n.startsWith('shadow-') },
  { group: 'interaction', test: (n) => n.startsWith('opacity-') || n.startsWith('focus-') },
  { group: 'motion', test: (n) => n.startsWith('duration-') || n.startsWith('ease-') },
  { group: 'z-index', test: (n) => n.startsWith('z-') },
  { group: 'border', test: (n) => n.startsWith('border-') },
]

export function groupOf(name) {
  for (const rule of GROUP_RULES) {
    if (rule.test(name)) return rule.group
  }
  return 'etc'
}

// cssText -> [{ name, value, group }]. :root 블록 안의 커스텀 프로퍼티만 수집한다.
// 값에 var()/괄호가 들어가도 안전하게 "세미콜론까지"를 값으로 본다(토큰 파일은
// 선언 전용이라 중첩 규칙이 없다는 전제 — designLint가 그 전제를 강제).
export function parseTokens(cssText) {
  const withoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const tokens = []
  const declRe = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi
  let match
  while ((match = declRe.exec(withoutComments)) !== null) {
    const name = match[1].trim()
    const value = match[2].trim()
    tokens.push({ name, value, group: groupOf(name) })
  }
  return tokens
}

// Figma Tokens(Tokens Studio) 호환 JSON 구조로 변환 — scripts/export-tokens.mjs가 사용.
export function toFigmaTokens(tokens) {
  const typeByGroup = {
    color: 'color', space: 'spacing', type: 'fontSizes', radius: 'borderRadius',
    shadow: 'boxShadow', motion: 'other', 'z-index': 'other', border: 'border',
    interaction: 'other', etc: 'other',
  }
  const out = {}
  for (const token of tokens) {
    if (!out[token.group]) out[token.group] = {}
    out[token.group][token.name] = { value: token.value, type: typeByGroup[token.group] }
  }
  return out
}
