// 스쿼드 편집 상태 모델 — 순수 로직(DOM 무관). IF 스쿼드 빌더와 커리어 스쿼드 화면이
// 공유한다. 선수 풀/리졸버는 파라미터로 받는다(IF=전체 DB, 커리어=구단 로스터+필러).
//
// assignments: [{ slotIndex, playerId }] — 빈 슬롯은 배열에 아예 안 들어간다
// (11칸 고정배열+null 모델은 첫 렌더에서 throw — v1 advisor 지적으로 확정된 형태).

export function createEditorState(formationId) {
  return {
    formationId,
    assignments: [],
    selectedSlotIndex: null,
    searchQuery: '',
    positionFilter: null,
  }
}

// 슬롯에 배정하면 그 슬롯의 기존 선수와, 그 선수가 차지하던 다른 슬롯 둘 다 비운 뒤
// 새로 넣는다 — 한 선수가 두 자리를 동시에 차지하는 상태를 만들지 않는다.
export function assignPlayer(state, slotIndex, playerId) {
  state.assignments = state.assignments.filter(
    (a) => a.slotIndex !== slotIndex && a.playerId !== playerId)
  state.assignments.push({ slotIndex, playerId })
}

export function unassignSlot(state, slotIndex) {
  state.assignments = state.assignments.filter((a) => a.slotIndex !== slotIndex)
}

export function playerMatchesFilter(player, state) {
  if (state.positionFilter && !player.positions.includes(state.positionFilter)) return false
  const q = state.searchQuery.trim().toLowerCase()
  if (q && !player.name.toLowerCase().includes(q)) return false
  return true
}

export function getSquad11(state, resolvePlayer) {
  return state.assignments.map(({ slotIndex, playerId }) => ({
    player: resolvePlayer(playerId),
    slotIndex,
  }))
}

// hasGoalkeeper 기준은 "슬롯 위치"가 아니라 "positions에 GK 포함" — possession.js의
// goalkeeperEntry와 같은 기준이어야 킥오프 후 크래시가 안 난다(v1 실측 버그).
export function squadFlags(state, formation, resolvePlayer) {
  const squad11 = getSquad11(state, resolvePlayer)
  return {
    squad11,
    isFull: state.assignments.length === formation.slots.length,
    hasGoalkeeper: squad11.some(({ player }) => player.positions.includes('GK')),
  }
}
