// 스쿼드 편집 뷰 — 무상태 렌더 함수들. (state, 콜백, 옵션)만 받아 DOM을 만든다.
// IF 빌더와 커리어 스쿼드 화면이 공유: 커리어는 pool(구단 로스터)/resolvePlayer(필러 포함)/
// cardDecorator(피로·폼·징계 칩)/isPickDisabled(정지자 차단)를 주입한다.

import { createPlayerBadge } from '../components/playerBadge.js'
import { createPlayerCard } from '../components/playerCard.js'
import { renderPitchLines } from '../components/pitchLines.js'

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
  const matched = pool.filter((p) => options.filterFn(p, state))
  if (matched.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'squad-builder__empty-msg'
    empty.textContent = '검색 결과가 없어'
    listEl.appendChild(empty)
    return
  }
  for (const player of matched) {
    const assigned = state.assignments.some((a) => a.playerId === player.id)
      || Boolean(isPickDisabled?.(player)) // 정지자 등 — 흐림 처리로 신호
    const card = createPlayerCard(player, { onClick: onPlayerPick, assigned })
    cardDecorator?.(card, player)
    listEl.appendChild(card)
  }
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

  refreshList()
  panel.append(search, filters, list)
  return panel
}
