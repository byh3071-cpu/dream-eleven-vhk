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

// 카드에 표시할 "개인 종합 레이팅". 포지션 무관하게 6개 스탯을 똑같이 평균 내면 수비 스탯이
// 낮은 공격수(윙어/스트라이커)가 부당하게 낮게 나온다(예: 호나우지뉴 DEF 32가 발목을 잡아
// 평균 81 — 체감상 "너프"로 보임). 실제 FIFA/FC류처럼 포지션별로 실제 관련 있는 스탯만
// 크게 반영해서, 그 포지션에서 안 쓰는 스탯(윙어의 수비력 등)이 레이팅을 깎지 않게 한다.
const RATING_WEIGHTS = {
  GK: (s) => s.defending * 0.85 + s.physical * 0.15,
  CB: (s) => s.defending * 0.5 + s.physical * 0.3 + s.pace * 0.2,
  LB: (s) => s.defending * 0.35 + s.pace * 0.3 + s.dribbling * 0.2 + s.physical * 0.15,
  RB: (s) => s.defending * 0.35 + s.pace * 0.3 + s.dribbling * 0.2 + s.physical * 0.15,
  DM: (s) => s.defending * 0.4 + s.passing * 0.3 + s.physical * 0.2 + s.dribbling * 0.1,
  CM: (s) => s.passing * 0.35 + s.dribbling * 0.25 + s.defending * 0.2 + s.physical * 0.2,
  AM: (s) => s.passing * 0.3 + s.dribbling * 0.3 + s.shooting * 0.25 + s.pace * 0.15,
  LM: (s) => s.dribbling * 0.3 + s.passing * 0.25 + s.pace * 0.25 + s.defending * 0.2,
  RM: (s) => s.dribbling * 0.3 + s.passing * 0.25 + s.pace * 0.25 + s.defending * 0.2,
  LW: (s) => s.pace * 0.3 + s.dribbling * 0.3 + s.shooting * 0.3 + s.passing * 0.1,
  RW: (s) => s.pace * 0.3 + s.dribbling * 0.3 + s.shooting * 0.3 + s.passing * 0.1,
  ST: (s) => s.shooting * 0.45 + s.dribbling * 0.2 + s.pace * 0.2 + s.physical * 0.15,
}

export function playerOverallRating(player) {
  const weightFn = RATING_WEIGHTS[player.positions[0]] ?? RATING_WEIGHTS.CM
  return Math.round(weightFn(player.stats))
}
