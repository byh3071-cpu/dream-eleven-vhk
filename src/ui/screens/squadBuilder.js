// 스쿼드 빌더 화면. /squad/:side (side: 'home'|'away') 공용 — state는 side별로 분리 보관.
// 아직 저장(localStorage)은 없다: 세션 중 화면 이동은 유지되지만 새로고침하면 초기화된다
// (Goal 5 첫 슬라이스 범위 — 영속화는 별도로 다룬다).

import { PLAYERS, findPlayer } from '../../data/players.db.js'
import { FORMATIONS, findFormation } from '../../data/formations.js'
import { computeTeamRatings, overallStrength } from '../../sim/teamStrength.js'
import { createPlayerBadge } from '../components/playerBadge.js'
import { createPlayerCard } from '../components/playerCard.js'

const SIDE_LABEL = { home: '홈', away: '원정' }

// side -> { formationId, assignments: [{ slotIndex, playerId }] }
// 빈 슬롯은 배열에 아예 안 들어간다 — buildSquad11/positionFit이 player: null을 못 받는다
// (advisor 지적: 11칸 고정배열 + null로 모델링하면 첫 렌더에서 바로 throw).
const state = {
  home: { formationId: FORMATIONS[0].id, assignments: [] },
  away: { formationId: FORMATIONS[0].id, assignments: [] },
}

function getSquad11(sideState) {
  return sideState.assignments.map(({ slotIndex, playerId }) => ({
    player: findPlayer(playerId),
    slotIndex,
  }))
}

function renderStrength(sideState, formation) {
  const wrap = document.createElement('div')
  wrap.className = 'squad-builder__strength'
  if (sideState.assignments.length < formation.slots.length) {
    // 부분 배정 상태에서는 computeTeamRatings의 "빈 라인은 50점" 폴백이 실제 실력처럼
    // 보여서 오해를 준다(11명 다 안 채웠는데도 전력 47~50대로 뜨는 문제) — 다 채우기 전엔
    // 숫자를 보여주지 않는다.
    wrap.textContent = `전력 — (${sideState.assignments.length}/${formation.slots.length}명 배정)`
    return wrap
  }
  const ratings = computeTeamRatings(getSquad11(sideState), formation)
  wrap.textContent = `전력 ${Math.round(overallStrength(ratings))}`
  return wrap
}

function renderFormationChips(side, sideState, onChange) {
  const wrap = document.createElement('div')
  wrap.className = 'squad-builder__formation-chips'
  for (const formation of FORMATIONS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (formation.id === sideState.formationId ? ' chip--active' : '')
    chip.textContent = formation.label
    chip.addEventListener('click', () => onChange(formation.id))
    wrap.appendChild(chip)
  }
  return wrap
}

function renderPitchLines() {
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('class', 'pitch-lines')
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('preserveAspectRatio', 'none')

  const stroke = 'rgba(240, 244, 240, 0.35)'
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

// formations.js 좌표계: y=0 자기 골 ~ y=100 상대 골. 화면은 세로로 세워서 자기 골을
// 아래, 상대 골을 위에 두므로 top%는 (100-y)로 뒤집는다.
function renderPitchSlot(slot, slotIndex, sideState, onSlotClick) {
  const assignment = sideState.assignments.find((a) => a.slotIndex === slotIndex)
  const player = assignment ? findPlayer(assignment.playerId) : null

  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'pitch-slot' + (player ? '' : ' pitch-slot--empty')
  el.style.left = `${slot.x}%`
  el.style.top = `${100 - slot.y}%`
  el.addEventListener('click', () => onSlotClick(slotIndex))

  if (player) {
    const badge = createPlayerBadge(player, { size: 'sm' })
    const name = document.createElement('div')
    name.className = 'pitch-slot__name'
    name.textContent = player.name
    el.append(badge, name)
  } else {
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
    const role = document.createElement('span')
    role.className = 'pitch-slot__role'
    role.textContent = slot.role
    badge.append(svg, role)
    el.appendChild(badge)
  }

  return el
}

function renderPitch(sideState, formation, onSlotClick) {
  const pitch = document.createElement('div')
  pitch.className = 'squad-builder__pitch'
  pitch.appendChild(renderPitchLines())
  formation.slots.forEach((slot, i) => {
    pitch.appendChild(renderPitchSlot(slot, i, sideState, onSlotClick))
  })
  return pitch
}

function renderListPanel() {
  const panel = document.createElement('div')
  panel.className = 'squad-builder__list-panel'

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'squad-builder__search'
  search.placeholder = '선수 이름 검색...'

  const filters = document.createElement('div')
  filters.className = 'squad-builder__position-filters'
  const allChip = document.createElement('button')
  allChip.type = 'button'
  allChip.className = 'chip chip--active'
  allChip.textContent = '전체'
  filters.appendChild(allChip)

  const list = document.createElement('div')
  list.className = 'squad-builder__list'
  for (const player of PLAYERS) {
    list.appendChild(createPlayerCard(player))
  }

  panel.append(search, filters, list)
  return panel
}

export function renderSquadBuilder(mountEl, params) {
  const side = params.side === 'away' ? 'away' : 'home'
  const sideState = state[side]
  const formation = findFormation(sideState.formationId)

  const screen = document.createElement('div')
  screen.className = 'screen screen--squad-builder'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = `스쿼드 빌더 — ${SIDE_LABEL[side]}`
  topbar.append(title, renderStrength(sideState, formation))

  const rerender = () => {
    mountEl.replaceChildren()
    renderSquadBuilder(mountEl, params)
  }

  const onFormationChange = (formationId) => {
    sideState.formationId = formationId
    rerender()
  }

  const onSlotClick = () => {
    // 다음 단계(리스트 클릭으로 슬롯 배정/해제)에서 채운다 — 지금은 정적 배치 확인 단계.
  }

  const body = document.createElement('div')
  body.className = 'squad-builder__body'
  body.append(renderPitch(sideState, formation, onSlotClick), renderListPanel())

  screen.append(topbar, renderFormationChips(side, sideState, onFormationChange), body)
  mountEl.appendChild(screen)
}
