// 포지션 적합도 + 팀 전력 계산. DOM 의존 0 — Goal 2 시뮬레이션 엔진과 스쿼드빌더 UI(Goal 5)가
// 공유하는 순수 로직. tactics 보정은 Goal 3의 tactics-modifiers.js에서 이 결과 위에 얹는다.

const LINE_GROUPS = {
  GK: 'goalkeeper',
  CB: 'defense', LB: 'defense', RB: 'defense',
  DM: 'midfield', CM: 'midfield', AM: 'midfield', LM: 'midfield', RM: 'midfield',
  LW: 'attack', RW: 'attack', ST: 'attack',
}

// 슬롯 역할별 "인접" 포지션 — 정확히 일치하진 않지만 자연스럽게 소화 가능한 자리.
const ADJACENT = {
  CB: ['DM'],
  LB: ['LM', 'LW'],
  RB: ['RM', 'RW'],
  DM: ['CB', 'CM'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'LM', 'RM', 'ST'],
  LM: ['LB', 'LW', 'AM'],
  RM: ['RB', 'RW', 'AM'],
  LW: ['LB', 'LM', 'ST'],
  RW: ['RB', 'RM', 'ST'],
  ST: ['LW', 'RW', 'AM'],
  GK: [],
}

const FIT_EXACT = 1.0
const FIT_ADJACENT = 0.85
const FIT_SAME_LINE = 0.65
const FIT_ALIEN = 0.4
const FIT_GOALKEEPER_MISMATCH = 0.15

export function positionFit(playerPositions, slotRole) {
  if (playerPositions.includes(slotRole)) return FIT_EXACT
  const involvesGoalkeeper = slotRole === 'GK' || playerPositions.includes('GK')
  if (involvesGoalkeeper) return FIT_GOALKEEPER_MISMATCH
  const adjacentRoles = ADJACENT[slotRole] || []
  if (playerPositions.some((p) => adjacentRoles.includes(p))) return FIT_ADJACENT
  const sameLine = playerPositions.some((p) => LINE_GROUPS[p] === LINE_GROUPS[slotRole])
  if (sameLine) return FIT_SAME_LINE
  return FIT_ALIEN
}

// squad11: [{ player, slotIndex }] — slotIndex는 formation.slots의 인덱스
export function buildSquad11(playerAssignments, formation) {
  return playerAssignments.map(({ player, slotIndex }) => ({
    player,
    slot: formation.slots[slotIndex],
    fit: positionFit(player.positions, formation.slots[slotIndex].role),
  }))
}

function weightedAvg(rated, roleSet, statFn) {
  const relevant = rated.filter((r) => roleSet.has(r.slot.role))
  if (relevant.length === 0) return 50
  const total = relevant.reduce((sum, r) => sum + statFn(r.player.stats) * r.fit, 0)
  return total / relevant.length
}

const DEFENSE_ROLES = new Set(['CB', 'LB', 'RB', 'DM'])
const MIDFIELD_ROLES = new Set(['DM', 'CM', 'AM', 'LM', 'RM'])
const ATTACK_ROLES = new Set(['AM', 'LW', 'RW', 'ST'])

// squad11: [{ player, slotIndex }]
export function computeTeamRatings(squad11, formation) {
  const rated = buildSquad11(squad11, formation)

  const gkEntry = rated.find((r) => r.slot.role === 'GK')
  const gkRating = gkEntry ? gkEntry.player.stats.defending * gkEntry.fit : 30

  const defenseRating = weightedAvg(rated, DEFENSE_ROLES, (s) =>
    s.defending * 0.5 + s.physical * 0.3 + s.pace * 0.2)
  const midfieldRating = weightedAvg(rated, MIDFIELD_ROLES, (s) =>
    s.passing * 0.4 + s.dribbling * 0.3 + s.defending * 0.15 + s.physical * 0.15)
  const attackRating = weightedAvg(rated, ATTACK_ROLES, (s) =>
    s.shooting * 0.45 + s.dribbling * 0.25 + s.pace * 0.2 + s.passing * 0.1)

  return { gkRating, defenseRating, midfieldRating, attackRating }
}

export function overallStrength(ratings) {
  return (ratings.gkRating + ratings.defenseRating * 2 + ratings.midfieldRating * 2 + ratings.attackRating * 2) / 7
}
