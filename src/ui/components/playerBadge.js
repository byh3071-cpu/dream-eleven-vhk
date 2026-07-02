// 헥사곤 뱃지 (에라 색 테두리 + 이름). 스쿼드 빌더의 큰 선수 카드(lg)와 필드 위 작은
// 슬롯 토큰(sm)이 이 컴포넌트를 공유한다 — 긴 이름 줄바꿈 로직을 두 곳에 따로 구현하면
// verify-cards.html에서 사용자 확인까지 거쳐 잡은 버그(글자 잘림, 불균형 줄바꿈)가
// 한쪽에서만 재발할 수 있으므로 반드시 이 한 곳만 수정한다.

const FONT_SIZES = {
  lg: { short: '30px', mid: '25px', long: '22px' },
  sm: { short: '13px', mid: '11px', long: '10px' },
}

function badgeLinesFor(name) {
  const raw = name.includes(' ') ? name.split(' ').pop() : name
  if (raw.length <= 4) return [raw]
  const mid = Math.ceil(raw.length / 2)
  return [raw.slice(0, mid), raw.slice(mid)]
}

function fontSizeFor(size, lines) {
  const longest = Math.max(...lines.map((l) => l.length))
  const tier = FONT_SIZES[size]
  if (longest <= 3) return tier.short
  if (longest === 4) return tier.mid
  return tier.long
}

// player: { name, era }. size: 'lg'(108px, 카드) | 'sm'(44px, 필드 슬롯)
export function createPlayerBadge(player, { size = 'lg' } = {}) {
  const borderColor = player.era === 'legend' ? '#f0b429' : '#9ca3af'
  const lines = badgeLinesFor(player.name)

  const badge = document.createElement('div')
  badge.className = `player-badge player-badge--${size}`

  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'hex')
  svg.setAttribute('viewBox', '0 0 100 100')
  const polygon = document.createElementNS(svgNS, 'polygon')
  polygon.setAttribute('points', '50,3 93,25 93,75 50,97 7,75 7,25')
  polygon.setAttribute('fill', '#0b0e14')
  polygon.setAttribute('stroke', borderColor)
  polygon.setAttribute('stroke-width', '2')
  svg.appendChild(polygon)
  badge.appendChild(svg)

  const nameEl = document.createElement('span')
  nameEl.className = 'player-badge__name'
  nameEl.style.fontSize = fontSizeFor(size, lines)
  lines.forEach((line, i) => {
    if (i > 0) nameEl.appendChild(document.createElement('br'))
    nameEl.appendChild(document.createTextNode(line))
  })
  badge.appendChild(nameEl)

  return badge
}
