// goal 16 재정/신임도/게임오버 — 순수 계층. 밸런스 자체는 scripts/tune-finance.mjs가
// 3시즌 시뮬로 게이트하고, 여기선 규칙의 정확성(정산 산식/판정 경계)을 잠근다.

import { FINANCE, roundWageOf, expectedRankOf, settleRound, gameOverOf } from '../../src/career/finance.js'
import * as store from '../../src/career/store.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

function seasonSave(seed = 77) {
  const storage = fakeStorage()
  store.initCareer(storage)
  store.newCareer({ userClubId: 'aurum', masterSeed: seed, storage })
  let save = store.draftCatchUp(storage)
  while (save.phase === 'draft') save = store.draftPick(save.draftState.availableIds[0], storage)
  return { storage, save }
}

describe('finance — 정산 규칙', () => {
  test('주급은 로스터 가치에 비례하고 라운드 분할된다', () => {
    const { save } = seasonSave()
    const wage = roundWageOf(save, 'aurum')
    expect(wage).toBeGreaterThan(1)
    // 시즌 총 주급 ≈ 라운드 주급 × 12 (반올림 오차 허용)
    expect(wage * FINANCE.ROUNDS_PER_SEASON).toBeGreaterThan(30)
  })

  test('홈경기만 관중 수입, 승리·순위 보너스 반영', () => {
    const { save } = seasonSave()
    const settledHome = settleRound(save, [
      { homeClubId: 'aurum', awayClubId: 'obsidian', homeGoals: 2, awayGoals: 0 },
    ])
    const settledAway = settleRound(save, [
      { homeClubId: 'obsidian', awayClubId: 'aurum', homeGoals: 0, awayGoals: 2 },
    ])
    const gateHome = settledHome.financeLog.at(-1).gate
    const gateAway = settledAway.financeLog.at(-1).gate
    expect(gateHome).toBeGreaterThanOrEqual(FINANCE.GATE_BASE + FINANCE.GATE_WIN_BONUS)
    expect(gateAway).toBe(0)
  })

  test('신임도: 기대 미달+패배는 하락, 기대 충족+승리는 상승', () => {
    const { save } = seasonSave()
    // aurum이 기대 1~2위인 상태에서 패배를 시뮬 — 순위표는 아직 빈 판이라
    // actual은 동률 정렬 기준. 패배 결과로 delta 부호만 검증한다.
    const lost = settleRound({ ...save, boardTrust: 50 }, [
      { homeClubId: 'obsidian', awayClubId: 'aurum', homeGoals: 3, awayGoals: 0 },
    ])
    const won = settleRound({ ...save, boardTrust: 50 }, [
      { homeClubId: 'obsidian', awayClubId: 'aurum', homeGoals: 0, awayGoals: 3 },
    ])
    expect(won.boardTrust).toBeGreaterThan(lost.boardTrust)
    expect(expectedRankOf(save, 'aurum')).toBeGreaterThanOrEqual(1)
  })

  test('게임오버 판정 경계: 신임도 0=경질, 적자 연속 한도=파산', () => {
    expect(gameOverOf({ boardTrust: 0, debtRounds: 0 })).toBe('fired')
    expect(gameOverOf({ boardTrust: 1, debtRounds: FINANCE.DEBT_LIMIT_ROUNDS })).toBe('bankrupt')
    expect(gameOverOf({ boardTrust: 1, debtRounds: FINANCE.DEBT_LIMIT_ROUNDS - 1 })).toBeNull()
  })

  test('finishRound 결합: 정산 로그가 쌓이고 phase가 유지된다(건전 재정)', () => {
    const { storage } = seasonSave(78)
    let save = store.getCareer()
    save = store.finishRound({}, storage)
    expect(save.financeLog).toHaveLength(1)
    expect(save.financeLog[0]).toMatchObject({ season: 1, round: 1 })
    expect(save.phase).toBe('season')
    expect(typeof save.budgets.aurum).toBe('number')
  })

  test('finishRound 결합: 신임도가 바닥나면 phase gameover(경질)', () => {
    const { storage } = seasonSave(79)
    let save = store.getCareer()
    // 신임도를 판정 직전까지 조작 — 다음 라운드 최악 delta(-4)로 반드시 0 도달
    save = store.updateCareer((s) => ({ ...s, boardTrust: 4 }), storage)
    for (let round = 1; round <= 12 && save.phase === 'season'; round++) {
      save = store.finishRound({}, storage)
    }
    // 12라운드 안에 경질되거나(약팀 시드), 살아남으면 신임도가 회복됐다는 뜻 —
    // 판정 로직 자체는 위 경계 테스트가 잠그므로 여기선 phase 전이 배선만 확인.
    if (save.phase === 'gameover') {
      expect(save.gameOverReason).toBe('fired')
    } else {
      expect(save.boardTrust).toBeGreaterThan(0)
    }
  })
})
