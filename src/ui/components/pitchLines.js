// 필드 라인(테두리/하프라인/센터서클/양쪽 페널티·골에어리어) — squadBuilder.js와 match.js가
// 공유한다. 한쪽에서만 고쳐서 두 화면 필드가 미묘하게 달라지는 걸 막기 위해 단일 소스로 둔다.
// viewBox 0~100은 formations.js의 슬롯 좌표계(x:0~100, y:0=자기골~100=상대골)와 그대로 맞물린다.
export function renderPitchLines() {
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'pitch-lines')
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('preserveAspectRatio', 'none')

  // var() 문자열 패스스루 — 색의 소스는 tokens.css 하나 (docs/DESIGN.md JS 색 정책)
  const stroke = 'var(--pitch-line)'
  const addShape = (tag, attrs) => {
    const el = document.createElementNS(svgNS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    el.setAttribute('fill', 'none')
    el.setAttribute('stroke', stroke)
    el.setAttribute('stroke-width', '0.4')
    svg.appendChild(el)
  }

  addShape('rect', { x: 2, y: 2, width: 96, height: 96 })
  addShape('line', { x1: 2, y1: 50, x2: 98, y2: 50 })
  addShape('circle', { cx: 50, cy: 50, r: 9 })
  // 아래(y=0 쪽, 자기 골) 페널티/골에어리어
  addShape('rect', { x: 22, y: 2, width: 56, height: 16 })
  addShape('rect', { x: 38, y: 2, width: 24, height: 6 })
  // 위(y=100 쪽, 상대 골) 페널티/골에어리어
  addShape('rect', { x: 22, y: 82, width: 56, height: 16 })
  addShape('rect', { x: 38, y: 92, width: 24, height: 6 })

  return svg
}
