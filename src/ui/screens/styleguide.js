// 스타일가이드 (#/styleguide) — 디자인 시스템의 살아있는 단일 소스 뷰.
// 토큰 스와치는 css/tokens.css를 런타임에 fetch해서 tokensParser로 자동 생성한다
// (JS 쪽에 토큰 목록을 중복 유지하면 반드시 드리프트가 난다). 컴포넌트 섹션은
// 마크업 사본이 아니라 실제 컴포넌트 함수(createPlayerCard 등)를 픽스처 선수로
// 호출해서 렌더한다 — 컴포넌트가 회귀하면 여기서도 그대로 깨져 보이는 게 목적.
// 새 화면/새 상태를 추가하는 goal은 같은 goal 안에서 여기에도 추가한다(docs/DESIGN.md).

import { parseTokens } from '../tokensParser.js'
import { createPlayerBadge } from '../components/playerBadge.js'
import { createPlayerCard } from '../components/playerCard.js'
import { renderPitchLines } from '../components/pitchLines.js'
import { findPlayer } from '../../data/players.db.js'

// 실제 DB 선수를 픽스처로 쓴다 — legend/active, 긴 이름 케이스 커버.
const FIXTURE_IDS = { legend: 'zidane', active: 'mbappe', longName: 'ronaldinho' }

function sectionEl(title) {
  const section = document.createElement('section')
  section.className = 'styleguide__section'
  const heading = document.createElement('h2')
  heading.className = 'styleguide__heading'
  heading.textContent = title
  section.appendChild(heading)
  return section
}

function rowEl(label) {
  const row = document.createElement('div')
  row.className = 'styleguide__row'
  const labelEl = document.createElement('div')
  labelEl.className = 'styleguide__row-label'
  labelEl.textContent = label
  row.appendChild(labelEl)
  return row
}

// ---------- 토큰 스와치 ----------

function tokenSwatch(token) {
  const item = document.createElement('div')
  item.className = 'styleguide__token'

  const preview = document.createElement('div')
  preview.className = 'styleguide__token-preview'
  if (token.group === 'color') {
    preview.style.background = `var(--${token.name})`
  } else if (token.group === 'space') {
    const bar = document.createElement('div')
    bar.className = 'styleguide__space-bar'
    bar.style.width = `var(--${token.name})`
    preview.appendChild(bar)
  } else if (token.group === 'type') {
    preview.textContent = '가나 Ag'
    if (token.name.startsWith('text-')) preview.style.fontSize = `var(--${token.name})`
  } else if (token.group === 'radius') {
    const box = document.createElement('div')
    box.className = 'styleguide__radius-box'
    box.style.borderRadius = `var(--${token.name})`
    preview.appendChild(box)
  } else if (token.group === 'shadow') {
    const box = document.createElement('div')
    box.className = 'styleguide__shadow-box'
    box.style.boxShadow = `var(--${token.name})`
    preview.appendChild(box)
  } else {
    preview.textContent = token.value
    preview.classList.add('styleguide__token-preview--text')
  }

  const name = document.createElement('code')
  name.className = 'styleguide__token-name'
  name.textContent = `--${token.name}`
  const value = document.createElement('div')
  value.className = 'styleguide__token-value'
  value.textContent = token.value

  item.append(preview, name, value)
  return item
}

async function renderTokenSections(container) {
  let cssText
  try {
    const res = await fetch('./css/tokens.css')
    cssText = await res.text()
  } catch {
    const fail = document.createElement('p')
    fail.textContent = 'tokens.css를 불러오지 못했어 — 로컬 서버(npx serve)로 열었는지 확인.'
    container.appendChild(fail)
    return
  }
  const tokens = parseTokens(cssText)
  const groupOrder = ['color', 'space', 'type', 'radius', 'shadow', 'interaction', 'motion', 'z-index', 'border', 'etc']
  const groupLabels = {
    color: '색', space: '간격', type: '타입', radius: 'Radius', shadow: '그림자',
    interaction: '인터랙션 상태', motion: '모션', 'z-index': 'z-index', border: '보더', etc: '기타',
  }
  for (const group of groupOrder) {
    const groupTokens = tokens.filter((t) => t.group === group)
    if (groupTokens.length === 0) continue
    const section = sectionEl(`토큰 — ${groupLabels[group]}`)
    const grid = document.createElement('div')
    grid.className = 'styleguide__token-grid'
    for (const token of groupTokens) grid.appendChild(tokenSwatch(token))
    section.appendChild(grid)
    container.appendChild(section)
  }
}

// ---------- 컴포넌트 매트릭스 ----------

function chipSection() {
  const section = sectionEl('칩')
  const row = rowEl('기본 / active / disabled')
  const normal = document.createElement('button')
  normal.type = 'button'
  normal.className = 'chip'
  normal.textContent = '4-4-2'
  const active = document.createElement('button')
  active.type = 'button'
  active.className = 'chip chip--active'
  active.textContent = '4-3-3'
  const disabled = document.createElement('button')
  disabled.type = 'button'
  disabled.className = 'chip'
  disabled.disabled = true
  disabled.style.opacity = 'var(--opacity-disabled)'
  disabled.textContent = '일시정지'
  row.append(normal, active, disabled)
  section.appendChild(row)

  const linkRow = rowEl('link-button')
  const link = document.createElement('button')
  link.type = 'button'
  link.className = 'link-button'
  link.textContent = '결과 화면 보기 →'
  linkRow.appendChild(link)
  section.appendChild(linkRow)
  return section
}

function badgeSection() {
  const section = sectionEl('선수 뱃지 (playerBadge.js 실호출)')
  const row = rowEl('lg / lg 긴이름 / sm')
  row.append(
    createPlayerBadge(findPlayer(FIXTURE_IDS.legend), { size: 'lg' }),
    createPlayerBadge(findPlayer(FIXTURE_IDS.longName), { size: 'lg' }),
    createPlayerBadge(findPlayer(FIXTURE_IDS.active), { size: 'sm' }),
  )
  section.appendChild(row)
  return section
}

function cardSection() {
  const section = sectionEl('선수 카드 (createPlayerCard 실호출 — 확정값 잠금 대상)')
  const row = rowEl('legend / active / assigned / 긴이름')
  row.append(
    createPlayerCard(findPlayer(FIXTURE_IDS.legend)),
    createPlayerCard(findPlayer(FIXTURE_IDS.active)),
    createPlayerCard(findPlayer(FIXTURE_IDS.legend), { assigned: true }),
    createPlayerCard(findPlayer(FIXTURE_IDS.longName)),
  )
  section.appendChild(row)
  return section
}

function pitchSection() {
  const section = sectionEl('피치 + 필드 슬롯')
  const row = rowEl('pitch-surface / pitch-lines / 슬롯 4상태')

  const pitch = document.createElement('div')
  pitch.className = 'styleguide__pitch-demo'
  pitch.appendChild(renderPitchLines())

  const filled = document.createElement('div')
  filled.className = 'pitch-slot pitch-slot--static'
  filled.style.left = '30%'
  filled.style.top = '30%'
  filled.appendChild(createPlayerBadge(findPlayer(FIXTURE_IDS.legend), { size: 'sm' }))
  const filledName = document.createElement('div')
  filledName.className = 'pitch-slot__name'
  filledName.textContent = findPlayer(FIXTURE_IDS.legend).name
  filled.appendChild(filledName)

  const selected = document.createElement('div')
  selected.className = 'pitch-slot pitch-slot--selected pitch-slot--static'
  selected.style.left = '70%'
  selected.style.top = '30%'
  selected.appendChild(createPlayerBadge(findPlayer(FIXTURE_IDS.active), { size: 'sm' }))

  const ball = document.createElement('div')
  ball.className = 'match__ball'
  ball.style.left = '50%'
  ball.style.top = '65%'

  pitch.append(filled, selected, ball)
  row.appendChild(pitch)
  section.appendChild(row)
  return section
}

function textPatternSection() {
  const section = sectionEl('텍스트 패턴')
  const commentaryRow = rowEl('커멘터리 일반 / 골')
  const line = document.createElement('div')
  line.className = 'match__commentary-line'
  line.textContent = "34' 홈 지네딘 지단의 슈팅, 마누엘 노이어 선방"
  const goalLine = document.createElement('div')
  goalLine.className = 'match__commentary-line match__commentary-line--goal'
  goalLine.textContent = "56' 골! 홈 킬리안 음바페의 득점 (어시스트: 지네딘 지단)"
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'column'
  wrap.style.gap = 'var(--space-4)'
  wrap.append(line, goalLine)
  commentaryRow.appendChild(wrap)
  section.appendChild(commentaryRow)

  const statsRow = rowEl('스탯 행 (result)')
  const stats = document.createElement('div')
  stats.className = 'result__stats-row'
  stats.style.width = '320px'
  const home = document.createElement('span')
  home.className = 'result__stats-value'
  home.textContent = '9'
  home.style.textAlign = 'right'
  const label = document.createElement('span')
  label.className = 'result__stats-label'
  label.textContent = '슈팅'
  const away = document.createElement('span')
  away.className = 'result__stats-value'
  away.textContent = '4'
  stats.append(home, label, away)
  statsRow.appendChild(stats)
  section.appendChild(statsRow)
  return section
}

export function renderStyleguide(mountEl) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--styleguide'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = '스타일가이드 — 디자인 시스템 단일 소스'
  topbar.appendChild(title)
  screen.appendChild(topbar)

  const body = document.createElement('div')
  body.className = 'styleguide__body'
  screen.appendChild(body)

  body.append(chipSection(), badgeSection(), cardSection(), pitchSection(), textPatternSection())

  // 토큰 섹션은 fetch라 비동기 — 컴포넌트 섹션 먼저 붙이고 위에 끼워넣는다.
  const tokensContainer = document.createElement('div')
  body.prepend(tokensContainer)
  renderTokenSections(tokensContainer)

  mountEl.appendChild(screen)
}
