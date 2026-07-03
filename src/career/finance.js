// 구단 경영/재정 — 라운드 정산(주급/관중 수입), 보드 신임도, 게임오버 판정. 순수 함수.
// 상수는 scripts/tune-finance.mjs 3시즌 시뮬 게이트로 확정한다(tunables 방식 계승):
// "평범하게 운영하면 파산하지 않고, 돈이 의미 없게 폭증하지도 않는" 구간.

import { playerValue } from './value.js'
import { playerOverallRating } from '../sim/teamStrength.js'
import { findCareerPlayer } from './players.js'
import { computeTable } from './table.js'

export const FINANCE = {
  WAGE_RATE: 0.3, // 시즌 주급 = 선수 가치의 30% — 첫 실측(4%)은 지출이 유명무실해 잔고가 시즌당 +80M 폭증했다
  ROUNDS_PER_SEASON: 12,
  GATE_BASE: 8, // 홈경기 기본 관중 수입(M)
  GATE_RANK_BONUS: [4, 3, 2, 1], // 현 순위별 가산
  GATE_WIN_BONUS: 2, // 그 홈경기 승리 시
  TRUST_MEET: 1, // 기대 순위 이상일 때 — +2는 전 구단 신임도 100 고정(긴장감 0) 실측
  TRUST_MISS: -3, // 기대 미달일 때
  TRUST_WIN: 1,
  TRUST_LOSS: -1,
  TRUST_CHAMPION: 20,
  DEBT_LIMIT_ROUNDS: 3, // 예산 음수 연속 허용 라운드
}

// 시즌 주급의 라운드 분할(정수 M) — 반올림 오차는 게임적으로 무시.
export function roundWageOf(save, clubId) {
  const seasonWage = save.rosters[clubId].reduce((sum, playerId) =>
    sum + Math.round(playerValue(findCareerPlayer(playerId), save.contracts?.[playerId] ?? 2) * FINANCE.WAGE_RATE), 0)
  return Math.max(1, Math.round(seasonWage / FINANCE.ROUNDS_PER_SEASON))
}

// 전력 기대 순위 — 로스터 평균 레이팅 순위(신임도의 기준선).
export function expectedRankOf(save, clubId) {
  const avgOf = (ids) => ids.reduce((s, id) => s + playerOverallRating(findCareerPlayer(id)), 0) / ids.length
  const ranked = Object.entries(save.rosters)
    .map(([id, ids]) => ({ id, avg: avgOf(ids) }))
    .sort((a, b) => b.avg - a.avg || a.id.localeCompare(b.id))
  return ranked.findIndex((r) => r.id === clubId) + 1
}

// 라운드 정산 — finishRound가 결과 확정 직후 호출한다.
// roundFixtures: 이번 라운드의 [{homeClubId, awayClubId, homeGoals, awayGoals}]
export function settleRound(save, roundFixtures) {
  const clubIds = Object.keys(save.rosters)
  const table = computeTable(clubIds, save.fixtures)
  const rankOf = (clubId) => table.findIndex((r) => r.clubId === clubId) + 1

  const budgets = { ...save.budgets }
  let myGate = 0
  let myWage = 0
  for (const clubId of clubIds) {
    const wage = roundWageOf(save, clubId)
    let gate = 0
    const homeGame = roundFixtures.find((f) => f.homeClubId === clubId)
    if (homeGame) {
      gate = FINANCE.GATE_BASE + (FINANCE.GATE_RANK_BONUS[rankOf(clubId) - 1] ?? 0)
        + (homeGame.homeGoals > homeGame.awayGoals ? FINANCE.GATE_WIN_BONUS : 0)
    }
    budgets[clubId] = (budgets[clubId] ?? 0) + gate - wage
    if (clubId === save.userClubId) { myGate = gate; myWage = wage }
  }

  // 보드 신임도 — 기대 순위 대비 + 내 경기 결과
  const expected = expectedRankOf(save, save.userClubId)
  const actual = rankOf(save.userClubId)
  const myGame = roundFixtures.find((f) => f.homeClubId === save.userClubId || f.awayClubId === save.userClubId)
  let trustDelta = actual <= expected ? FINANCE.TRUST_MEET : FINANCE.TRUST_MISS
  if (myGame) {
    const isHome = myGame.homeClubId === save.userClubId
    const mine = isHome ? myGame.homeGoals : myGame.awayGoals
    const theirs = isHome ? myGame.awayGoals : myGame.homeGoals
    if (mine > theirs) trustDelta += FINANCE.TRUST_WIN
    if (mine < theirs) trustDelta += FINANCE.TRUST_LOSS
  }
  const boardTrust = Math.max(0, Math.min(100, (save.boardTrust ?? 55) + trustDelta))

  const debtRounds = budgets[save.userClubId] < 0 ? (save.debtRounds ?? 0) + 1 : 0

  const financeLog = [...(save.financeLog ?? []), {
    season: save.season.number,
    round: save.season.currentRound,
    gate: myGate,
    wage: myWage,
    balance: budgets[save.userClubId],
    trust: boardTrust,
  }]

  return { budgets, boardTrust, debtRounds, financeLog }
}

// 게임오버 판정 — settleRound 결과에 대해.
export function gameOverOf({ boardTrust, debtRounds }) {
  if (boardTrust <= 0) return 'fired' // 경질
  if (debtRounds >= FINANCE.DEBT_LIMIT_ROUNDS) return 'bankrupt' // 파산
  return null
}
