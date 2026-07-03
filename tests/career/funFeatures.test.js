// goal 17 재미 요소 — 시즌 어워드(A)/서사 칩(C) 순수 계층 + 적립 재현성 + 세이브 v4.

import { seasonMvp, seasonBestXI, seasonAwards } from '../../src/career/awards.js'
import { computePreMatchChips } from '../../src/career/narrative.js'
import { loadCareer } from '../../src/career/persistence.js'
import * as store from '../../src/career/store.js'
import { findCareerPlayer } from '../../src/career/players.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

function seasonCareer(seed = 91) {
  const storage = fakeStorage()
  store.initCareer(storage)
  store.newCareer({ userClubId: 'aurum', masterSeed: seed, storage })
  let save = store.draftCatchUp(storage)
  while (save.phase === 'draft') {
    save = store.draftPick(save.draftState.availableIds[0], storage)
  }
  return { storage, save }
}

describe('A — 시즌 평점 적립 + 어워드', () => {
  test('finishRound가 seasonStats를 적립하고 같은 시드는 같은 집계(재현성)', () => {
    const run = () => {
      const { storage } = seasonCareer(91)
      let save = store.getCareer()
      for (let r = 1; r <= 3; r++) save = store.finishRound({}, storage)
      return save.seasonStats
    }
    const a = run()
    const b = run()
    expect(a).toEqual(b)
    const rows = Object.values(a)
    expect(rows.length).toBeGreaterThan(40) // 라운드당 4경기 × 22명 — 3라운드면 대부분 출전
    for (const row of rows) {
      expect(row.matches).toBeGreaterThanOrEqual(1)
      expect(row.matches).toBeLessThanOrEqual(3)
      expect(row.ratingSum).toBeGreaterThan(0)
    }
    // MOTM은 경기당 정확 1명 — 총합 = 총 경기 수(4구단 → 라운드당 2경기 × 3라운드)
    expect(rows.reduce((sum, r) => sum + r.motm, 0)).toBe(6)
  })

  test('MVP는 최소 6경기, 베스트 XI는 4-4-2 형태', () => {
    const stats = {}
    // 조작 집계: p1 평균 9.0(8경기), p2 평균 9.5(2경기 — 최소 출전 미달)
    stats.pele = { ratingSum: 72, matches: 8, motm: 5 }
    stats.messi = { ratingSum: 19, matches: 2, motm: 1 }
    expect(seasonMvp(stats).playerId).toBe('pele')

    // 시즌 완주 세이브에서 베스트 XI 형태 검증
    const { storage } = seasonCareer(92)
    let save = store.getCareer()
    for (let r = 1; r <= 12; r++) save = store.finishRound({}, storage)
    const xi = seasonBestXI(save.seasonStats)
    expect(xi.GK.length).toBe(1)
    expect(xi.def.length).toBe(4)
    expect(xi.mid.length).toBe(4)
    expect(xi.att.length).toBe(2)
    // 라인 소속 검증(GK 슬롯엔 GK만)
    expect(findCareerPlayer(xi.GK[0].playerId).positions).toContain('GK')

    const awards = seasonAwards(save)
    expect(awards.mvp).not.toBeNull()
    expect(awards.topScorer.goals).toBeGreaterThan(0)
  })

  test('시즌 전환 시 history에 mvp 박제 + seasonStats 리셋', () => {
    const { storage } = seasonCareer(93)
    let save = store.getCareer()
    for (let r = 1; r <= 12; r++) save = store.finishRound({}, storage)
    const mvpBefore = seasonMvp(save.seasonStats)
    save = store.enterTransferWindow(storage)
    expect(save.history[0].mvp.playerId).toBe(mvpBefore.playerId)
    expect(save.seasonStats).toEqual({})
  })
})

describe('C — 서사 칩', () => {
  const baseFixture = (round, home, away, result = null) => ({
    round, homeClubId: home, awayClubId: away, result,
  })
  const win = (hg, ag, scorers = []) => ({ homeGoals: hg, awayGoals: ag, scorers })

  const save = {
    userClubId: 'aurum',
    rosters: { aurum: ['pele', 'maradona'], obsidian: ['messi'], crimson: [], glacier: [] },
    fixtures: [
      baseFixture(1, 'aurum', 'obsidian', win(2, 0, [{ playerId: 'pele', minute: 10, team: 'A' }])),
      baseFixture(2, 'crimson', 'aurum', win(0, 1, [{ playerId: 'pele', minute: 30, team: 'B' }])),
      baseFixture(3, 'aurum', 'glacier', win(3, 1, [{ playerId: 'pele', minute: 5, team: 'A' }])),
      baseFixture(4, 'aurum', 'obsidian', null), // 다음 경기
    ],
  }

  test('3연승 + 연속 골 + 상대전적 칩이 나온다', () => {
    const chips = computePreMatchChips(save, save.fixtures[3])
    const texts = chips.map((c) => c.text).join(' | ')
    expect(texts).toContain('3연승')
    expect(texts).toContain('3경기 연속 골')
    expect(texts).toContain('상대전적 1승')
    // 내 팀 호재는 good 톤
    expect(chips.find((c) => c.text.includes('3연승')).tone).toBe('good')
  })

  test('기록이 없으면 칩도 없다(스팸 방지)', () => {
    const fresh = { ...save, fixtures: [baseFixture(1, 'aurum', 'obsidian', null)] }
    expect(computePreMatchChips(fresh, fresh.fixtures[0])).toEqual([])
  })
})

describe('세이브 v3 -> v4 마이그레이션', () => {
  test('seasonStats/boardTrust/financeLog 기본값 승격', () => {
    const storage = fakeStorage()
    const v3Save = {
      masterSeed: 1, userClubId: 'aurum', phase: 'season',
      season: { number: 1, currentRound: 2 },
      rosters: { aurum: [], obsidian: [], crimson: [], glacier: [] },
      draftState: null, history: [], budgets: {}, contracts: {}, transferLog: [],
      fixtures: [], playerState: {}, tactics: {}, lineup: null,
    }
    storage.setItem('dream-eleven.career', JSON.stringify({ schemaVersion: 3, savedAt: 'x', save: v3Save }))
    const { save } = loadCareer(storage)
    expect(save.seasonStats).toEqual({})
    expect(save.boardTrust).toBe(55)
    expect(save.financeLog).toEqual([])
  })
})
