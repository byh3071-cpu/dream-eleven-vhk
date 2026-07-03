// 스쿼드 빌더 화면. /squad/:side (side: 'home'|'away') 공용 — state는 side별로 분리 보관.
// 아직 저장(localStorage)은 없다: 세션 중 화면 이동은 유지되지만 새로고침하면 초기화된다
// (Goal 5 첫 슬라이스 범위 — 영속화는 별도로 다룬다).

import { PLAYERS, findPlayer } from '../../data/players.db.js'
import { POSITIONS } from '../../data/player-schema.js'
import { FORMATIONS, findFormation } from '../../data/formations.js'
import { computeTeamRatings, overallStrength } from '../../sim/teamStrength.js'
import { createPlayerBadge } from '../components/playerBadge.js'
import { createPlayerCard } from '../components/playerCard.js'
import { renderPitchLines } from '../components/pitchLines.js'
import { navigate } from '../../router.js'
import { ifTacticsPath } from '../../routes.js'

const SIDE_LABEL = { home: '홈', away: '원정' }

// side -> { formationId, assignments, selectedSlotIndex, searchQuery, positionFilter }
// assignments: [{ slotIndex, playerId }] — 빈 슬롯은 배열에 아예 안 들어간다.
// buildSquad11/positionFit이 player: null을 못 받는다(advisor 지적: 11칸 고정배열 + null로
// 모델링하면 첫 렌더에서 바로 throw) — 그래서 "배정 안 됨"은 배열에서 항목 자체를 뺀다.
function createSideState() {
  return {
    formationId: FORMATIONS[0].id,
    assignments: [],
    selectedSlotIndex: null,
    searchQuery: '',
    positionFilter: null,
  }
}

const state = { home: createSideState(), away: createSideState() }

function getSquad11(sideState) {
  return sideState.assignments.map(({ slotIndex, playerId }) => ({
    player: findPlayer(playerId),
    slotIndex,
  }))
}

// match.js가 킥오프 전에 읽는 진입점. store.js 같은 공용 상태 모듈을 새로 만들지 않고
// 필요한 값만 읽기 전용으로 노출한다(소비자가 아직 하나뿐이라 추상화는 과함).
// hasGoalkeeper는 "GK 슬롯에 누가 있는가"가 아니라 "11명 중 GK 포지션 보유자가 있는가"다 —
// possession.js의 goalkeeperEntry가 정확히 그 기준으로 찾기 때문에(슬롯 위치 무관, positions
// 배열에 'GK'가 있는 선수를 전체에서 검색) 이 기준이 어긋나면 킥오프 후 크래시로 이어진다.
export function getSquadState(side) {
  const sideState = state[side]
  const formation = findFormation(sideState.formationId)
  const squad11 = getSquad11(sideState)
  return {
    formation,
    squad11,
    isFull: sideState.assignments.length === formation.slots.length,
    hasGoalkeeper: squad11.some(({ player }) => player.positions.includes('GK')),
  }
}

// 슬롯에 배정하면 그 슬롯에 있던 선수와, 그 선수가 다른 슬롯에 이미 있었다면 그 자리 둘 다
// 비운 뒤 새로 넣는다 — 한 선수가 두 자리를 동시에 차지하는 상태를 만들지 않는다.
function assignPlayer(sideState, slotIndex, playerId) {
  sideState.assignments = sideState.assignments.filter(
    (a) => a.slotIndex !== slotIndex && a.playerId !== playerId)
  sideState.assignments.push({ slotIndex, playerId })
}

function unassignSlot(sideState, slotIndex) {
  sideState.assignments = sideState.assignments.filter((a) => a.slotIndex !== slotIndex)
}

function playerMatchesFilter(player, sideState) {
  if (sideState.positionFilter && !player.positions.includes(sideState.positionFilter)) return false
  const q = sideState.searchQuery.trim().toLowerCase()
  if (q && !player.name.toLowerCase().includes(q)) return false
  return true
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

function renderFormationChips(sideState, onChange) {
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
  const role_ = document.createElement('span')
  role_.className = 'pitch-slot__role'
  role_.textContent = role
  badge.append(svg, role_)
  return badge
}

// formations.js 좌표계: y=0 자기 골 ~ y=100 상대 골. 화면은 세로로 세워서 자기 골을
// 아래, 상대 골을 위에 두므로 top%는 (100-y)로 뒤집는다.
function renderPitchSlot(slot, slotIndex, sideState, onSlotClick) {
  const assignment = sideState.assignments.find((a) => a.slotIndex === slotIndex)
  const player = assignment ? findPlayer(assignment.playerId) : null
  const selected = sideState.selectedSlotIndex === slotIndex

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

function renderPitch(sideState, formation, onSlotClick) {
  const pitch = document.createElement('div')
  pitch.className = 'squad-builder__pitch'
  pitch.appendChild(renderPitchLines())
  formation.slots.forEach((slot, i) => {
    pitch.appendChild(renderPitchSlot(slot, i, sideState, onSlotClick))
  })
  return pitch
}

function renderCardListInto(listEl, sideState, onPlayerPick) {
  listEl.replaceChildren()
  const matched = PLAYERS.filter((p) => playerMatchesFilter(p, sideState))
  if (matched.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'squad-builder__empty-msg'
    empty.textContent = '검색 결과가 없어'
    listEl.appendChild(empty)
    return
  }
  for (const player of matched) {
    const assigned = sideState.assignments.some((a) => a.playerId === player.id)
    listEl.appendChild(createPlayerCard(player, { onClick: onPlayerPick, assigned }))
  }
}

function renderListPanel(sideState, onPlayerPick, onFilterChange) {
  const panel = document.createElement('div')
  panel.className = 'squad-builder__list-panel'

  const list = document.createElement('div')
  list.className = 'squad-builder__list'
  const refreshList = () => renderCardListInto(list, sideState, onPlayerPick)

  const search = document.createElement('input')
  search.type = 'search'
  search.className = 'squad-builder__search'
  search.placeholder = '선수 이름 검색...'
  search.value = sideState.searchQuery
  // 검색은 리스트(list)만 갈아끼운다 — 화면 전체를 다시 그리면 input이 새로 생성되면서
  // 포커스/커서 위치가 날아가 한 글자 칠 때마다 포커스가 빠지는 문제가 생긴다.
  search.addEventListener('input', () => {
    sideState.searchQuery = search.value
    refreshList()
  })

  const filters = document.createElement('div')
  filters.className = 'squad-builder__position-filters'
  const makeChip = (label, value) => {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (sideState.positionFilter === value ? ' chip--active' : '')
    chip.textContent = label
    chip.addEventListener('click', () => onFilterChange(value))
    return chip
  }
  filters.appendChild(makeChip('전체', null))
  for (const pos of POSITIONS) filters.appendChild(makeChip(pos, pos))

  refreshList()
  panel.append(search, filters, list)
  return panel
}

export function renderSquadBuilder(mountEl, params) {
  const side = params.side === 'away' ? 'away' : 'home'
  const sideState = state[side]
  const formation = findFormation(sideState.formationId)

  const fullRerender = () => {
    mountEl.replaceChildren()
    renderSquadBuilder(mountEl, params)
  }

  const onFormationChange = (formationId) => {
    sideState.formationId = formationId
    sideState.selectedSlotIndex = null
    fullRerender()
  }

  const onFilterChange = (value) => {
    sideState.positionFilter = value
    fullRerender()
  }

  // 빈 슬롯 클릭 -> 선택(다시 누르면 선택 해제), 그 슬롯 포지션으로 리스트 자동 필터.
  // 채워진 슬롯 클릭 -> 바로 비움(선수 교체 메뉴 없이 단순 토글).
  const onSlotClick = (slotIndex) => {
    const isFilled = sideState.assignments.some((a) => a.slotIndex === slotIndex)
    if (isFilled) {
      unassignSlot(sideState, slotIndex)
      sideState.selectedSlotIndex = null
    } else if (sideState.selectedSlotIndex === slotIndex) {
      sideState.selectedSlotIndex = null
    } else {
      sideState.selectedSlotIndex = slotIndex
      sideState.positionFilter = formation.slots[slotIndex].role
    }
    fullRerender()
  }

  // 리스트에서 선수 클릭 -> 선택된 슬롯이 있으면 거기로, 없으면 빈 슬롯을 찾아 자동 배정
  // (맞는 빈 슬롯이 없으면 아무 것도 안 함 — 엉뚱한 자리에 억지로 안 넣는다). 자동 배정 기준은
  // "지금 걸려있는 포지션 필터"를 우선한다 — 필터를 CB로 걸어놓고 부포지션이 CB인 선수를
  // 클릭했는데 주포지션(positions[0])만 보고 판단하면 조용히 씹혀서 왜 안 되는지 알 수 없다.
  // 필터가 "전체"일 때만 주포지션으로 판단.
  // 이미 배정된 선수를 다시 고르면 원래 자리에서 빠지고 새 자리로 옮겨간다(assignPlayer가 처리).
  const onPlayerPick = (player) => {
    if (sideState.selectedSlotIndex != null) {
      assignPlayer(sideState, sideState.selectedSlotIndex, player.id)
      sideState.selectedSlotIndex = null
    } else {
      const targetRole = sideState.positionFilter ?? player.positions[0]
      const emptySlotIndex = formation.slots.findIndex((slot, i) =>
        slot.role === targetRole && !sideState.assignments.some((a) => a.slotIndex === i))
      if (emptySlotIndex === -1) return
      assignPlayer(sideState, emptySlotIndex, player.id)
    }
    fullRerender()
  }

  const screen = document.createElement('div')
  screen.className = 'screen screen--squad-builder'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = `스쿼드 빌더 — ${SIDE_LABEL[side]}`

  const topbarRight = document.createElement('div')
  topbarRight.className = 'topbar__right'
  const tacticsLink = document.createElement('button')
  tacticsLink.type = 'button'
  tacticsLink.className = 'link-button'
  tacticsLink.textContent = '감독 지침 →'
  tacticsLink.addEventListener('click', () => navigate(ifTacticsPath(side)))
  topbarRight.append(renderStrength(sideState, formation), tacticsLink)

  topbar.append(title, topbarRight)

  const body = document.createElement('div')
  body.className = 'squad-builder__body'
  body.append(
    renderPitch(sideState, formation, onSlotClick),
    renderListPanel(sideState, onPlayerPick, onFilterChange))

  screen.append(topbar, renderFormationChips(sideState, onFormationChange), body)
  mountEl.appendChild(screen)
}
