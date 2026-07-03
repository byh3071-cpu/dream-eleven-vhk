// 아이콘 단일 소스 — Lucide(https://lucide.dev, ISC License) 서브셋 인라인 +
// 자체 제작 1종(soccer-ball). 전부 24x24 stroke 규격, currentColor라 토큰 색을 상속한다.
// 규칙(docs/DESIGN.md): 새 아이콘이 필요하면 이 파일에만 추가한다 — 화면에 raw SVG 금지.
// Lucide ISC 고지: Copyright (c) Lucide Contributors — 라이선스 전문은 lucide.dev 참조.

const ICON_PATHS = {
  'trophy': `<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" /><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" /><path d="M18 9h1.5a1 1 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" /><path d="M6 9H4.5a1 1 0 0 1 0-5H6" />`,
  'medal': `<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" /><path d="M8 7h8" /><circle cx="12" cy="17" r="5" /><path d="M12 18v-2h-.5" />`,
  'star': `<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />`,
  'tv': `<path d="m17 2-5 5-5-5" /><rect width="20" height="15" x="2" y="7" rx="2" />`,
  'flame': `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />`,
  'wallet': `<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />`,
  'armchair': `<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" /><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V11a2 2 0 0 0-4 0z" /><path d="M5 18v2" /><path d="M19 18v2" />`,
  'crown': `<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" /><path d="M5 21h14" />`,
  // 자체 제작 — 축구공(Lucide에 축구 전용이 없어 같은 24x24 stroke 규격으로 직접 디자인).
  'soccer-ball': `<circle cx="12" cy="12" r="10"/><path d="M12 7l4.2 3-1.6 5h-5.2l-1.6-5z"/><path d="M12 2v5M4.5 8.5l4.5 1.5M19.5 8.5L15 10M7.4 15l-2.9 3.5M16.6 15l2.9 3.5"/>`,
}

// 파싱은 DOMParser로 — innerHTML 싱크를 코드베이스에 남기지 않는다(콘텐츠는 위의
// 정적 상수뿐이지만, 이 프로젝트는 XSS를 한 번 잡은 전력이 있어 패턴부터 차단).
function parsePaths(name) {
  const doc = new DOMParser().parseFromString(
    '<svg xmlns="http://www.w3.org/2000/svg">' + (ICON_PATHS[name] ?? '') + '</svg>',
    'image/svg+xml',
  )
  return [...doc.documentElement.childNodes]
}

export function createIcon(name, { size = 16, className = '' } = {}) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('class', ('icon ' + className).trim())
  svg.setAttribute('aria-hidden', 'true')
  for (const node of parsePaths(name)) svg.appendChild(document.importNode(node, true))
  return svg
}

// 텍스트 앞에 아이콘을 붙인 라벨 조각 — 헤딩/칩/배너 공용.
export function iconLabel(name, text, { size = 16 } = {}) {
  const wrap = document.createElement('span')
  wrap.className = 'icon-label'
  wrap.append(createIcon(name, { size }), document.createTextNode(text))
  return wrap
}
