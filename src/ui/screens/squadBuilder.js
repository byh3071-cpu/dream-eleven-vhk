// IF 스쿼드 빌더 셸 — /if/squad/:side (side: 'home'|'away') 공용. 상태는 side별 모듈
// 스코프(세션 중 유지, 새로고침 초기화 — IF는 휘발이 매력). 편집 모델/뷰는
// src/ui/squadEditor/로 분리되어 커리어 스쿼드 화면과 공유한다.

import { PLAYERS, findPlayer } from '../../data/players.db.js'
import { POSITIONS } from '../../data/player-schema.js'
import { FORMATIONS, findFormation } from '../../data/formations.js'
import { computeTeamRatings, overallStrength, playerOverallRating } from '../../sim/teamStrength.js'
import { navigate } from '../../router.js'
import { ifTacticsPath } from '../../routes.js'
import {
  createEditorState, assignPlayer, unassignSlot, playerMatchesFilter, getSquad11, squadFlags,
} from '../squadEditor/model.js'
import { renderPitch, renderListPanel } from '../squadEditor/view.js'

const SIDE_LABEL = { home: '홈', away: '원정' }

const state = {
  home: createEditorState(FORMATIONS[0].id),
  away: createEditorState(FORMATIONS[0].id),
}

// match.js가 킥오프 전에 읽는 진입점 — 계약 유지(3층 분리 후에도 시그니처 무변경).
export function getSquadState(side) {
  const sideState = state[side]
  const formation = findFormation(sideState.formationId)
  return { formation, ...squadFlags(sideState, formation, findPlayer) }
}

// 랜덤 자동 편성 — 양팀을 상호배제 유지하며 포지션별로 채운다(IF는 휘발이라 결정론 불필요).
// "22명 채우기 귀찮다"는 사용자 요구: 빈 스쿼드에서 바로 관전하게 하는 편의 기능.
function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 한 팀을 랜덤으로 채운다 — 슬롯 role에 맞는 선수 우선, 부족하면 부/인접 포지션 폴백.
function fillSide(side, excludeIds) {
  const sideState = state[side]
  sideState.assignments = []
  const formation = findFormation(sideState.formationId)
  const used = new Set(excludeIds)
  const pool = shuffled(PLAYERS.filter((p) => !used.has(p.id)))
  formation.slots.forEach((slot, slotIndex) => {
    // 1순위 주포지션 일치, 2순위 포지션 목록 포함, 3순위 아무나(리스트 소진 방지).
    let pick = pool.find((p) => !used.has(p.id) && p.positions[0] === slot.role)
      ?? pool.find((p) => !used.has(p.id) && p.positions.includes(slot.role))
      ?? pool.find((p) => !used.has(p.id))
    if (pick) {
      assignPlayer(sideState, slotIndex, pick.id)
      used.add(pick.id)
    }
  })
  return sideState.assignments.map((a) => a.playerId)
}

// 홈 먼저 채우고, 원정은 홈이 쓴 선수를 제외한 풀에서(상호배제). 실패 없이 22명 보장.
export function randomFillBothSquads() {
  const homeIds = fillSide('home', [])
  fillSide('away', homeIds)
}

function renderStrength(sideState, formation) {
  const wrap = document.createElement('div')
  wrap.className = 'squad-builder__strength'
  if (sideState.assignments.length < formation.slots.length) {
    // 부분 배정 상태에서 "빈 라인 50점 폴백"이 실제 실력처럼 보이는 오해 방지.
    wrap.textContent = `전력 — (${sideState.assignments.length}/${formation.slots.length}명 배정)`
    return wrap
  }
  const ratings = computeTeamRatings(getSquad11(sideState, findPlayer), formation)
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

  // 빈 슬롯 클릭 -> 선택(+그 포지션으로 필터), 채워진 슬롯 클릭 -> 비움.
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

  // 자동 배정 기준은 "지금 걸려있는 포지션 필터" 우선 — 필터가 CB인데 주포지션만 보면
  // 부포지션 CB 선수가 조용히 씹힌다(v1 실측 버그).
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

  // 상호 배제: 반대편(홈<->원정)에 이미 배정된 선수는 이쪽 풀에서 제외 — 같은 선수가
  // 양팀에 동시에 서는 비현실(사용자 지적: 카푸가 양팀 출전)을 차단한다.
  const otherSide = side === 'home' ? 'away' : 'home'
  const usedByOther = new Set(state[otherSide].assignments.map((a) => a.playerId))
  const pool = PLAYERS.filter((p) => !usedByOther.has(p.id))

  const body = document.createElement('div')
  body.className = 'squad-builder__body'
  body.append(
    renderPitch(sideState, formation, onSlotClick, { resolvePlayer: findPlayer }),
    renderListPanel(sideState, pool, { onPlayerPick, onFilterChange }, {
      positions: POSITIONS,
      filterFn: playerMatchesFilter,
      // 긴 스크롤 완화 1차: 레이팅 내림차순 - 상위 자원이 먼저 보인다(사용자 지적).
      sortFn: (a, b) => playerOverallRating(b) - playerOverallRating(a),
    }))

  screen.append(topbar, renderFormationChips(sideState, onFormationChange), body)
  mountEl.appendChild(screen)
}
