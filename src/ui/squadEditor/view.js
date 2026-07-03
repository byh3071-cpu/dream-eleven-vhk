// 스쿼드 편집 뷰 — 무상태 렌더 함수들. (state, 콜백, 옵션)만 받아 DOM을 만든다.
// IF 빌더와 커리어 스쿼드 화면이 공유: 커리어는 pool(구단 로스터)/resolvePlayer(필러 포함)/
// cardDecorator(피로·폼·징계 칩)/isPickDisabled(정지자 차단)를 주입한다.

import { createPlayerBadge } from '../components/playerBadge.js'
import { createPlayerCard } from '../components/playerCard.js'
import { renderPitchLines } from '../components/pitchLines.js'
import { playerOverallRating } from '../../sim/teamStrength.js'

// 리스트 스크롤 개선 3종(사용자 선택 A+B+C):
// A) 전체 보기(필터/검색 없음)에서 라인 그룹 헤더 + 앵커 점프
// B) 카드 <-> 컴팩트 행 토글 (state.viewMode)
// C) 슬롯 선택 시 해당 롤 상위 5명 "추천" 밴드 상단 고정
const LINE_GROUPS = [
  { key: 'gk', label: '골키퍼', roles: ['GK'] },
  { key: 'def', label: '수비', roles: ['CB', 'LB', 'RB'] },
  { key: 'mid', label: '미드필드', roles: ['DM', 'CM', 'AM', 'LM', 'RM'] },
  { key: 'att', label: '공격', roles: ['LW', 'RW', 'ST'] },
]

function lineOf(player) {
  const pos = player.positions[0]
  return LINE_GROUPS.find((g) => g.roles.includes(pos)) ?? LINE_GROUPS[2]
}

// 컴팩트 행(B): 한 줄에 레이팅/포지션/이름/에라 — 한 화면 표시량 3~4배.
function createPlayerRow(player, { onClick, assigned = false } = {}) {
  const row = document.createElement('button')
  row.type = 'button'
  row.className = 'player-row' + (assigned ? ' player-row--assigned' : '')
  if (onClick) row.addEventListener('click', () => onClick(player))

  const rating = document.createElement('span')
  rating.className = 'player-row__rating'
  rating.textContent = String(playerOverallRating(player))
  const pos = document.createElement('span')
  pos.className = 'player-row__pos'
  pos.textContent = player.positions[0]
  const name = document.createElement('span')
  name.className = 'player-row__name'
  name.textContent = player.name
  const era = document.createElement('span')
  era.className = 'player-row__era' + (player.era === 'legend' ? ' player-row__era--legend' : '')
  era.textContent = player.era === 'legend' ? 'LGD' : 'ACT'
  row.append(rating, pos, name, era)
  return row
}

function groupHeading(label, anchorKey) {
  const heading = document.createElement('div')
  heading.className = 'squad-builder__group-heading'
  heading.dataset.anchor = anchorKey
  heading.textContent = label
  return heading
}

function renderEmptySlotBadge(role) {
  const badge = document.createElement('div')
  badge.className = 'player-badge player-badge--sm'
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'hex')
  svg.setAttribute('viewBox', '0 0 100 100')
  const polygon = document.createElementNS(svgNS, 'polygon')
  polygon.setAttribute('points', '50,3 93,25 93,75 50,97 7,75 7,25')
  polygon.setAttribute('fill', 'transparent')
  polygon.setAttribute('stroke', 'var(--border-subtle)')
  polygon.setAttribute('stroke-width', '2')
  svg.appendChild(polygon)
  const roleEl = document.createElement('span')
  roleEl.className = 'pitch-slot__role'
  roleEl.textContent = role
  badge.append(svg, roleEl)
  return badge
}

function renderPitchSlot(slot, slotIndex, state, onSlotClick, resolvePlayer) {
  const assignment = state.assignments.find((a) => a.slotIndex === slotIndex)
  const player = assignment ? resolvePlayer(assignment.playerId) : null
  const selected = state.selectedSlotIndex === slotIndex

  const el = document.createElement('button')
  el.type = 'button'
  let cls = 'pitch-slot'
  if (!player) cls += ' pitch-slot--empty'
  if (selected) cls += ' pitch-slot--selected'
  el.className = cls
  el.style.left = `${slot.x}%`
  el.style.top = `${100 - slot.y}%`
  el.title = player ? `${player.name} — 클릭하면 이 자리를 비움` : `${slot.role} 빈 자리 — 클릭해서 선수 선택`
  el.addEventListener('click', () => onSlotClick(slotIndex))

  if (player) {
    const badge = createPlayerBadge(player, { size: 'sm' })
    const name = document.createElement('div')
    name.className = 'pitch-slot__name'
    name.textContent = player.name
    el.append(badge, name)
  } else {
    el.appendChild(renderEmptySlotBadge(slot.role))
  }
  return el
}

export function renderPitch(state, formation, onSlotClick, { resolvePlayer }) {
  const pitch = document.createElement('div')
  pitch.className = 'squad-builder__pitch'
  pitch.appendChild(renderPitchLines())
  formation.slots.forEach((slot, i) => {
    pitch.appendChild(renderPitchSlot(slot, i, state, onSlotClick, resolvePlayer))
  })
  return pitch
}

export function renderCardListInto(listEl, state, pool, onPlayerPick, options = {}) {
  const { cardDecorator, isPickDisabled } = options
  listEl.replaceChildren()
  let matched = pool.filter((p) => options.filterFn(p, state))
  if (options.sortFn) matched = [...matched].sort(options.sortFn)
  if (matched.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'squad-builder__empty-msg'
    empty.textContent = '검색 결과가 없어'
    listEl.appendChild(empty)
    return
  }

  const compact = state.viewMode === 'row'
  listEl.classList.toggle('squad-builder__list--rows', compact)
  const renderItem = (player) => {
    const assigned = state.assignments.some((a) => a.playerId === player.id)
      || Boolean(isPickDisabled?.(player)) // 정지자 등 — 흐림 처리로 신호
    const item = compact
      ? createPlayerRow(player, { onClick: onPlayerPick, assigned })
      : createPlayerCard(player, { onClick: onPlayerPick, assigned })
    if (!compact) cardDecorator?.(item, player)
    return item
  }

  // C) 추천 밴드: 슬롯을 골라둔 상태(=positionFilter가 그 롤)면 상위 5명을 먼저 보여준다.
  if (state.selectedSlotIndex != null && state.positionFilter && matched.length > 5) {
    const top = matched.slice(0, 5)
    const rest = matched.slice(5)
    listEl.appendChild(groupHeading(`추천 TOP 5 — ${state.positionFilter}`, 'top'))
    for (const player of top) listEl.appendChild(renderItem(player))
    listEl.appendChild(groupHeading('나머지', 'rest'))
    for (const player of rest) listEl.appendChild(renderItem(player))
    return
  }

  // A) 라인 그룹 헤더: 전체 보기(필터/검색 없음)일 때만 — 필터가 걸리면 평면 리스트.
  const grouped = !state.positionFilter && !state.searchQuery.trim()
  if (grouped) {
    for (const group of LINE_GROUPS) {
      const players = matched.filter((p) => lineOf(p) === group)
      if (players.length === 0) continue
      listEl.appendChild(groupHeading(`${group.label} (${players.length})`, group.key))
      for (const player of players) listEl.appendChild(renderItem(player))
    }
    return
  }

  for (const player of matched) listEl.appendChild(renderItem(player))
}

export function renderListPanel(state, pool, callbacks, options = {}) {
  const { onPlayerPick, onFilterChange } = callbacks
  const panel = document.createElement('div')
  panel.className = 'squad-builder__list-panel'

  const list = document.createElement('div')
  list.className = 'squad-builder__list'
  const refreshList = () => renderCardListInto(list, state, pool, onPlayerPick, options)

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'squad-builder__search'
  search.placeholder = '선수 이름 검색...'
  search.value = state.searchQuery
  // 검색은 리스트만 갈아끼운다 — 전체 재렌더는 input 포커스를 죽인다(v1 실측 교훈).
  search.addEventListener('input', () => {
    state.searchQuery = search.value
    refreshList()
  })

  const filters = document.createElement('div')
  filters.className = 'squad-builder__position-filters'
  const makeChip = (label, value) => {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (state.positionFilter === value ? ' chip--active' : '')
    chip.textContent = label
    chip.addEventListener('click', () => onFilterChange(value))
    return chip
  }
  filters.appendChild(makeChip('전체', null))
  for (const pos of options.positions) filters.appendChild(makeChip(pos, pos))

  // B) 뷰 토글 + A) 라인 앵커 점프 바
  const toolbar = document.createElement('div')
  toolbar.className = 'squad-builder__list-toolbar'
  const viewToggle = document.createElement('button')
  viewToggle.type = 'button'
  viewToggle.className = 'chip'
  viewToggle.textContent = state.viewMode === 'row' ? '카드 보기' : '행 보기'
  viewToggle.addEventListener('click', () => {
    state.viewMode = state.viewMode === 'row' ? 'card' : 'row'
    viewToggle.textContent = state.viewMode === 'row' ? '카드 보기' : '행 보기'
    refreshList()
  })
  toolbar.appendChild(viewToggle)

  const anchors = document.createElement('div')
  anchors.className = 'squad-builder__anchors'
  for (const group of LINE_GROUPS) {
    const jump = document.createElement('button')
    jump.type = 'button'
    jump.className = 'link-button'
    jump.textContent = group.label
    jump.addEventListener('click', () => {
      const heading = list.querySelector(`[data-anchor="${group.key}"]`)
      heading?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
    anchors.appendChild(jump)
  }
  toolbar.appendChild(anchors)

  refreshList()
  panel.append(search, filters, toolbar, list)
  return panel
}
