// 경기 간 지속되는 선수 상태 — 피로(fatigue 0=쌩쌩~100=방전)/폼(form -2~+2)/징계.
// 전부 순수 함수: (상태, 라운드 정보) -> 새 상태. "장식 금지" 원칙에 따라 이 값들은
// 반드시 실제 경기력에 반영된다(dampenPlayer가 simulateMatch 진입 전 스탯을 조정 —
// src/sim/ 무접촉 프리패스, 엔진이 피로 네이티브 입력을 갖게 되면 그때 교체).

export const FATIGUE_PER_MATCH = 28 // 출전 1경기당 피로 적립
export const FATIGUE_RECOVERY = 35 // 미출전 라운드당 회복
// 피로 100 기준 감쇠: 신체 스탯(pace/physical) -20%, 기술 스탯 -12%.
// 기술 스탯에도 걸어야 하는 이유(실측): 엔진 듀얼이 passing/dribbling/shooting/defending
// 중심이라 신체만 깎으면 결과 결합이 거의 없어 "장식 금지" 원칙을 위반했다
// (방전 팀 상대 승률이 노이즈 수준이었음 — tests/career의 댐프닝 테스트가 감시).
const FATIGUE_STAT_SPAN = 0.20
const FATIGUE_SKILL_SPAN = 0.12
const FORM_STAT_STEP = 0.02 // 폼 1단계당 전 스탯 ±2%
const YELLOWS_PER_BAN = 3 // 시즌 누적 경고 3장마다 1경기 정지

export function initialPlayerState() {
  return { fatigue: 0, form: 0, yellowsSeason: 0, suspendedFor: 0 }
}

export function stateOf(playerStates, playerId) {
  return playerStates[playerId] ?? initialPlayerState()
}

// 라운드 종료 반영. playedIds: 이번 라운드 출전자, resultByClub: {clubId: 'W'|'D'|'L'},
// clubOf: playerId -> clubId, cards: [{playerId, type: 'yellow'|'red'}].
export function applyRound(playerStates, { allIds, playedIds, resultByClub, clubOf, cards }) {
  const next = {}
  const played = new Set(playedIds)
  for (const id of allIds) {
    const prev = stateOf(playerStates, id)
    const state = { ...prev }
    if (played.has(id)) {
      state.fatigue = Math.min(100, state.fatigue + FATIGUE_PER_MATCH)
      const result = resultByClub[clubOf(id)]
      if (result === 'W') state.form = Math.min(2, state.form + 1)
      else if (result === 'L') state.form = Math.max(-2, state.form - 1)
    } else {
      state.fatigue = Math.max(0, state.fatigue - FATIGUE_RECOVERY)
      // 출전 정지 소화: 뛰지 못한 라운드마다 잔여 정지 차감.
      if (state.suspendedFor > 0) state.suspendedFor--
    }
    next[id] = state
  }
  for (const card of cards) {
    const state = next[card.playerId] ?? initialPlayerState()
    if (card.type === 'red') {
      state.suspendedFor += 1
    } else {
      state.yellowsSeason += 1
      if (state.yellowsSeason % YELLOWS_PER_BAN === 0) state.suspendedFor += 1
    }
    next[card.playerId] = state
  }
  return next
}

export function isSuspended(playerStates, playerId) {
  return stateOf(playerStates, playerId).suspendedFor > 0
}

// 피로/폼을 스탯에 반영한 선수 사본 — 시뮬레이션 입력 직전에만 씌운다(저장 안 함).
export function dampenPlayer(player, playerStates) {
  const state = stateOf(playerStates, player.id)
  const physicalMult = 1 - (state.fatigue / 100) * FATIGUE_STAT_SPAN
  const skillMult = 1 - (state.fatigue / 100) * FATIGUE_SKILL_SPAN
  const formMult = 1 + state.form * FORM_STAT_STEP
  const stats = { ...player.stats }
  for (const key of Object.keys(stats)) {
    const isPhysical = key === 'pace' || key === 'physical' || key === 'aerial'
    stats[key] = Math.max(1, stats[key] * (isPhysical ? physicalMult : skillMult) * formMult)
  }
  return { ...player, stats }
}
