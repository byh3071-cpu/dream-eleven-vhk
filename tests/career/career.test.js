// 커리어 순수 계층 검증 — 일정/드래프트/순위표/선수상태/AI라인업/러너/영속화.
// tests/sim 관례 미러링: DOM 없이 전부 검증 가능해야 한다.

import { CLUBS } from '../../src/career/clubs.js'
import { FILLER_PLAYERS } from '../../src/career/fillerPlayers.js'
import { CAREER_POOL, findCareerPlayer } from '../../src/career/players.js'
import { generateFixtures, fixturesOfRound, totalRounds } from '../../src/career/schedule.js'
import { runDraft, createDraftState, applyPick, currentClubOf } from '../../src/career/draft.js'
import { topScorers } from '../../src/career/records.js'
import { playerValue } from '../../src/career/value.js'
import { canBuy, bestSellOffer } from '../../src/career/transfers.js'
import { computeTable } from '../../src/career/table.js'
import { initialPlayerState, applyRound, dampenPlayer, isSuspended, FATIGUE_PER_MATCH } from '../../src/career/playerState.js'
import { pickBestXI } from '../../src/career/aiLineup.js'
import { simulateFixture, seedForFixture } from '../../src/career/matchRunner.js'
import { saveCareer, loadCareer, SCHEMA_VERSION } from '../../src/career/persistence.js'
import * as store from '../../src/career/store.js'
import { validatePlayer } from '../../src/data/player-schema.js'
import { simulateMatch } from '../../src/sim/engine.js'
import { createRng } from '../../src/sim/rng.js'
import { findFormation } from '../../src/data/formations.js'

const CLUB_IDS = CLUBS.map((c) => c.id)

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

// N4부터 newCareer는 드래프트 단계로 시작 — 시즌 테스트용 헬퍼는 "매 턴 첫 가용 선수 픽"
// 전략으로 드래프트를 완주시켜 시즌 단계 세이브를 만든다.
function completeDraft(storage) {
  let save = store.draftCatchUp(storage)
  while (save.phase === 'draft') {
    save = store.draftPick(save.draftState.availableIds[0], storage)
  }
  return save
}

function freshCareer(seed = 7) {
  const storage = fakeStorage()
  store.initCareer(storage)
  store.newCareer({ userClubId: 'aurum', masterSeed: seed, storage })
  const save = completeDraft(storage)
  return { storage, save }
}

describe('필러 선수', () => {
  test('스키마를 그대로 통과하고 id가 db와 충돌하지 않는다', () => {
    for (const filler of FILLER_PLAYERS) {
      expect(validatePlayer(filler)).toEqual([])
      expect(filler.id.startsWith('filler_')).toBe(true)
    }
    expect(new Set(CAREER_POOL.map((p) => p.id)).size).toBe(CAREER_POOL.length)
  })
})

describe('schedule — 쿼드러플 라운드로빈', () => {
  const fixtures = generateFixtures(CLUB_IDS)

  test('12라운드 × 2경기 = 24경기, 팀당 12경기', () => {
    expect(totalRounds(fixtures)).toBe(12)
    expect(fixtures).toHaveLength(24)
    for (const id of CLUB_IDS) {
      const mine = fixtures.filter((f) => f.homeClubId === id || f.awayClubId === id)
      expect(mine).toHaveLength(12)
      expect(mine.filter((f) => f.homeClubId === id)).toHaveLength(6) // 홈 6 원정 6
    }
  })

  test('각 상대와 정확히 4번(홈2 원정2) 만난다', () => {
    for (const a of CLUB_IDS) {
      for (const b of CLUB_IDS) {
        if (a === b) continue
        const homeGames = fixtures.filter((f) => f.homeClubId === a && f.awayClubId === b)
        expect(homeGames).toHaveLength(2)
      }
    }
  })

  test('한 라운드에 각 팀은 정확히 1경기', () => {
    for (let round = 1; round <= 12; round++) {
      const seen = new Set()
      for (const f of fixturesOfRound(fixtures, round)) {
        for (const id of [f.homeClubId, f.awayClubId]) {
          expect(seen.has(id)).toBe(false)
          seen.add(id)
        }
      }
      expect(seen.size).toBe(4)
    }
  })
})

describe('draft — 밸런스드 배정', () => {
  const { rosters } = runDraft({ clubIds: CLUB_IDS, pool: CAREER_POOL, rng: createRng(1) })

  test('구단당 19명(필드 17 + GK 2), 풀 전원 소진, 중복 없음', () => {
    const all = Object.values(rosters).flat()
    expect(all).toHaveLength(76)
    expect(new Set(all).size).toBe(76)
    for (const ids of Object.values(rosters)) {
      expect(ids).toHaveLength(19)
      const gks = ids.filter((id) => findCareerPlayer(id).positions.includes('GK'))
      expect(gks).toHaveLength(2) // 주전 GK + 백업 필러
      expect(gks.some((id) => id.startsWith('filler_'))).toBe(true)
      expect(gks.some((id) => !id.startsWith('filler_'))).toBe(true)
    }
  })

  test('어느 구단도 라인이 비지 않는다(4-4-2 XI 구성 가능)', () => {
    for (const ids of Object.values(rosters)) {
      const lineup = pickBestXI({
        rosterIds: ids, resolvePlayer: findCareerPlayer, formationId: '4-4-2',
      })
      expect(lineup).not.toBeNull()
      expect(lineup.assignments).toHaveLength(11)
    }
  })

  test('같은 rng 시드면 결과가 결정론적이다', () => {
    const a = runDraft({ clubIds: CLUB_IDS, pool: CAREER_POOL, rng: createRng(9) })
    const b = runDraft({ clubIds: CLUB_IDS, pool: CAREER_POOL, rng: createRng(9) })
    expect(a).toEqual(b)
  })
})

describe('table — 파생 순위표', () => {
  test('승점/득실/다득점 순 정렬', () => {
    const fixtures = [
      { round: 1, homeClubId: 'aurum', awayClubId: 'obsidian', result: { homeGoals: 2, awayGoals: 0 } },
      { round: 1, homeClubId: 'crimson', awayClubId: 'glacier', result: { homeGoals: 1, awayGoals: 1 } },
      { round: 2, homeClubId: 'glacier', awayClubId: 'aurum', result: { homeGoals: 0, awayGoals: 3 } },
      { round: 2, homeClubId: 'obsidian', awayClubId: 'crimson', result: null }, // 미소화
    ]
    const table = computeTable(CLUB_IDS, fixtures)
    expect(table[0]).toMatchObject({ clubId: 'aurum', points: 6, played: 2, goalsFor: 5, goalsAgainst: 0 })
    expect(table.map((r) => r.clubId)).toEqual(['aurum', 'crimson', 'glacier', 'obsidian'])
  })
})

describe('playerState — 피로/폼/징계', () => {
  test('출전자는 피로 적립+폼 반영, 미출전자는 회복', () => {
    const states = { a: initialPlayerState(), b: { ...initialPlayerState(), fatigue: 50 } }
    const next = applyRound(states, {
      allIds: ['a', 'b'], playedIds: ['a'],
      resultByClub: { aurum: 'W' }, clubOf: () => 'aurum', cards: [],
    })
    expect(next.a.fatigue).toBe(FATIGUE_PER_MATCH)
    expect(next.a.form).toBe(1)
    expect(next.b.fatigue).toBe(15) // 50 - 35 회복
  })

  test('레드 즉시 1경기 정지, 옐로 3장 누적마다 1경기 정지, 결장으로 소화', () => {
    let states = { x: initialPlayerState() }
    states = applyRound(states, { allIds: ['x'], playedIds: ['x'], resultByClub: { c: 'D' }, clubOf: () => 'c', cards: [{ playerId: 'x', type: 'red' }] })
    expect(isSuspended(states, 'x')).toBe(true)
    states = applyRound(states, { allIds: ['x'], playedIds: [], resultByClub: {}, clubOf: () => 'c', cards: [] })
    expect(isSuspended(states, 'x')).toBe(false)
    for (let i = 0; i < 3; i++) {
      states = applyRound(states, { allIds: ['x'], playedIds: ['x'], resultByClub: { c: 'D' }, clubOf: () => 'c', cards: [{ playerId: 'x', type: 'yellow' }] })
    }
    expect(isSuspended(states, 'x')).toBe(true)
  })

  test('댐프닝이 장식이 아니다 — 방전 팀은 쌩쌩한 같은 팀에게 열세다', () => {
    // 같은 XI를 상태만 다르게(피로 100+폼 -2 vs 폼 +2) 붙인다. 홈/원정을 스왑한
    // 미러 매치로 사이드 시드 편향을 상쇄하고, 승패보다 표본이 큰 "득점 점유율"로
    // 판정한다(divisor 설계가 스탯 격차를 의도적으로 완만하게 만들기 때문에 소표본
    // 승률은 노이즈에 묻힌다 — 실측 0.48/0.525 사고 후 재설계).
    const { save } = freshCareer(3)
    const lineup = pickBestXI({ rosterIds: save.rosters.aurum, resolvePlayer: findCareerPlayer, formationId: '4-4-2' })
    const fresh = {}
    const tired = {}
    for (const { playerId } of lineup.assignments) {
      fresh[playerId] = { ...initialPlayerState(), form: 2 }
      tired[playerId] = { ...initialPlayerState(), fatigue: 100, form: -2 }
    }
    const squadOf = (states) => lineup.assignments.map(({ slotIndex, playerId }) => ({
      player: dampenPlayer(findCareerPlayer(playerId), states), slotIndex,
    }))
    const formation = findFormation('4-4-2')
    let freshGoals = 0
    let tiredGoals = 0
    for (let seed = 0; seed < 250; seed++) {
      const a = simulateMatch({
        home: { squad11: squadOf(fresh), formation, tactics: {} },
        away: { squad11: squadOf(tired), formation, tactics: {} }, seed,
      })
      freshGoals += a.score.home; tiredGoals += a.score.away
      const b = simulateMatch({
        home: { squad11: squadOf(tired), formation, tactics: {} },
        away: { squad11: squadOf(fresh), formation, tactics: {} }, seed,
      })
      freshGoals += b.score.away; tiredGoals += b.score.home
    }
    expect(freshGoals / (freshGoals + tiredGoals)).toBeGreaterThan(0.53)
  })
})

describe('store + persistence — 세이브/이어하기', () => {
  test('새 커리어 -> 저장 -> 새 스토어 로드 시 동일 상태', () => {
    const { storage, save } = freshCareer(11)
    store.initCareer(storage) // 재로드 시뮬레이션
    expect(store.getCareer()).toEqual(save)
  })

  test('깨진 세이브는 corrupted 신호와 함께 null', () => {
    const storage = fakeStorage()
    storage.setItem('dream-eleven.career', '{{{망가진 JSON')
    expect(loadCareer(storage)).toEqual({ save: null, corrupted: true })
  })

  test('버전 엔벨로프가 기록된다', () => {
    const storage = fakeStorage()
    saveCareer({ hello: 1 }, storage)
    const envelope = JSON.parse(storage.getItem('dream-eleven.career'))
    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION)
    expect(envelope.save).toEqual({ hello: 1 })
  })
})

describe('matchRunner — 라운드 진행', () => {
  test('관전(사전 시뮬)과 즉시 결과가 같은 시드라 동일 결과다', () => {
    const { save } = freshCareer(21)
    const myFixtureIndex = save.fixtures.findIndex(
      (f) => f.round === 1 && (f.homeClubId === 'aurum' || f.awayClubId === 'aurum'))
    const a = simulateFixture(save, myFixtureIndex).result
    const b = simulateFixture(save, myFixtureIndex).result
    expect(a.score).toEqual(b.score)
    expect(seedForFixture(save, myFixtureIndex)).toBe(seedForFixture(save, myFixtureIndex))
  })

  test('12라운드 완주: 전 경기 결과 확정 + 시즌 종료 판정 + 순위표 24경기 반영', () => {
    let { save, storage } = freshCareer(33)
    for (let round = 1; round <= 12; round++) {
      save = store.finishRound({}, storage)
    }
    expect(save.fixtures.every((f) => f.result)).toBe(true)
    expect(store.seasonDone(save)).toBe(true)
    const table = computeTable(CLUB_IDS, save.fixtures)
    expect(table.reduce((sum, row) => sum + row.played, 0)).toBe(48) // 24경기 × 양팀
    // 승점 합 = 경기당 2(무) 또는 3(승패) — 24경기면 48~72 사이
    const pointsSum = table.reduce((sum, row) => sum + row.points, 0)
    expect(pointsSum).toBeGreaterThanOrEqual(48)
    expect(pointsSum).toBeLessThanOrEqual(72)
  })

  test('시즌을 돌리면 피로/폼이 실제로 변한다(전원 0 고정이 아님)', () => {
    let { save, storage } = freshCareer(5)
    save = store.finishRound({}, storage)
    save = store.finishRound({}, storage)
    const states = Object.values(save.playerState)
    expect(states.some((s) => s.fatigue > 0)).toBe(true)
    expect(states.some((s) => s.form !== 0)).toBe(true)
  })
})

describe('N4 — 인터랙티브 드래프트 프리미티브', () => {
  test('스네이크 순서: 1라운드 정방향, 2라운드 역방향', () => {
    const ds = createDraftState({ clubIds: CLUB_IDS, pool: CAREER_POOL, rng: createRng(1) })
    const first = currentClubOf(ds)
    let s = ds
    const firstRound = []
    for (let i = 0; i < 4; i++) {
      firstRound.push(currentClubOf(s))
      s = applyPick(s, s.availableIds[0])
    }
    const secondRound = []
    for (let i = 0; i < 4; i++) {
      secondRound.push(currentClubOf(s))
      s = applyPick(s, s.availableIds[0])
    }
    expect(firstRound[0]).toBe(first)
    expect(secondRound).toEqual([...firstRound].reverse())
  })

  test('이미 지명된 선수는 다시 픽할 수 없다', () => {
    let ds = createDraftState({ clubIds: CLUB_IDS, pool: CAREER_POOL, rng: createRng(2) })
    const target = ds.availableIds[0]
    ds = applyPick(ds, target)
    expect(() => applyPick(ds, target)).toThrow()
  })

  test('드래프트 중단 후 재개해도 AI 픽이 동일하다(세이브 재현성)', () => {
    const run = () => {
      const storage = fakeStorage()
      store.initCareer(storage)
      store.newCareer({ userClubId: 'aurum', masterSeed: 99, storage })
      let save = store.draftCatchUp(storage)
      // 내 픽 2회 후 "재개" 시뮬: 스토리지에서 다시 로드해 이어서 완주
      save = store.draftPick(save.draftState.availableIds[3], storage)
      store.draftPick(save.draftState.availableIds[5], storage)
      store.initCareer(storage)
      return completeDraft(storage).rosters
    }
    expect(run()).toEqual(run())
  })
})

describe('N4 — 세이브 마이그레이션 v1 -> v2', () => {
  test('v1 세이브가 phase/history/draftState 기본값으로 승격된다', () => {
    const storage = fakeStorage()
    // N3(v1) 형태의 최소 세이브를 v1 엔벨로프로 직접 기록
    const v1Save = {
      masterSeed: 1, userClubId: 'aurum',
      season: { number: 1, currentRound: 3 },
      rosters: { aurum: [], obsidian: [], crimson: [], glacier: [] },
      fixtures: [], playerState: {}, tactics: {}, lineup: null,
    }
    storage.setItem('dream-eleven.career', JSON.stringify({ schemaVersion: 1, savedAt: 'x', save: v1Save }))
    const { save } = loadCareer(storage)
    expect(save.phase).toBe('season')
    expect(save.draftState).toBeNull()
    expect(save.history).toEqual([])
    expect(save.season.currentRound).toBe(3) // 기존 진행 보존
  })
})

describe('N4/N5 — 시즌 전환(이적창) + 득점왕', () => {
  test('시즌1 완주 -> 이적창: 히스토리/순위 보상, 로스터 유지, 시즌2 진행 가능', () => {
    let { storage } = freshCareer(41)
    let save = store.getCareer()
    for (let round = 1; round <= 12; round++) save = store.finishRound({}, storage)
    expect(store.seasonDone(save)).toBe(true)

    const season1Top = topScorers(save.fixtures, { limit: 1 })[0]
    expect(season1Top.goals).toBeGreaterThan(0)
    const rostersBefore = JSON.parse(JSON.stringify(save.rosters))

    save = store.enterTransferWindow(storage)
    expect(save.phase).toBe('transfer')
    expect(save.season.number).toBe(2)
    expect(save.history).toHaveLength(1)
    expect(save.history[0].championClubId).toBeTruthy()
    expect(save.history[0].topScorer.playerId).toBe(season1Top.playerId)
    // 순위 보상: 총 예산이 지급 총액(40+30+25+20)만큼 증가
    const totalBudget = Object.values(save.budgets).reduce((a, b) => a + b, 0)
    expect(totalBudget).toBe(4 * 60 + 115)
    // 로스터 연속성(재드래프트 폐지): AI-AI 이적 몇 건 외에는 유지 — 총원 76 불변
    expect(Object.values(save.rosters).flat()).toHaveLength(76)
    expect(save.rosters[save.userClubId].length).toBeGreaterThanOrEqual(15)
    // 계약 연차 -1 (단, AI 이적으로 옮긴 선수는 새 3년 계약이 정상)
    const transferred = new Set(save.transferLog.map((t) => t.playerId))
    const untouchedYears = Object.entries(save.contracts)
      .filter(([id]) => !transferred.has(id))
      .map(([, years]) => years)
    expect(Math.max(...untouchedYears)).toBeLessThanOrEqual(2)
    for (const id of transferred) expect(save.contracts[id]).toBe(3)
    void rostersBefore

    save = store.startSeasonAfterTransfer(storage)
    expect(save.phase).toBe('season')
    expect(save.fixtures).toHaveLength(24)
    expect(save.fixtures.every((f) => !f.result)).toBe(true)
    save = store.finishRound({}, storage)
    expect(save.season.currentRound).toBe(2)
  })
})

describe('N5 — 가치/이적 규칙', () => {
  test('가치: 레이팅 단조 증가, 나이 피크(26), 만료 할인', () => {
    const base = { positions: ['ST'], stats: { pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 40, physical: 80 } }
    const strong = { ...base, age: 26, stats: { ...base.stats, shooting: 95 } }
    const weak = { ...base, age: 26, stats: { ...base.stats, shooting: 60 } }
    expect(playerValue(strong, 2)).toBeGreaterThan(playerValue(weak, 2))
    const peak = { ...base, age: 26 }
    const old_ = { ...base, age: 36 }
    expect(playerValue(peak, 2)).toBeGreaterThan(playerValue(old_, 2))
    expect(playerValue(peak, 0)).toBeLessThan(playerValue(peak, 2)) // 계약 만료 할인
  })

  test('영입: 예산/로스터 상한/상대 GK 가드가 거절 사유를 돌려준다', () => {
    let { storage } = freshCareer(51)
    let save = store.getCareer()
    for (let round = 1; round <= 12; round++) save = store.finishRound({}, storage)
    save = store.enterTransferWindow(storage)

    // 타 구단 최고가 선수 — 예산을 0으로 만들면 거절
    const otherClub = Object.keys(save.rosters).find((id) => id !== save.userClubId)
    const target = save.rosters[otherClub][2]
    const broke = { ...save, budgets: { ...save.budgets, [save.userClubId]: 0 } }
    expect(canBuy(broke, target).ok).toBe(false)
    expect(canBuy(broke, target).reason).toContain('예산')

    // 상대 GK 하한: 상대 구단 GK를 사려는 시도(GK 2명뿐) -> 거절
    const theirGk = save.rosters[otherClub].find((id) => findCareerPlayer(id).positions.includes('GK'))
    expect(canBuy(save, theirGk).ok).toBe(false)
  })

  test('영입+판매 왕복: 총원 76/총예산 보존(수수료는 이동만)', () => {
    let { storage } = freshCareer(61)
    let save = store.getCareer()
    for (let round = 1; round <= 12; round++) save = store.finishRound({}, storage)
    save = store.enterTransferWindow(storage)

    const before = Object.values(save.budgets).reduce((a, b) => a + b, 0)
    const otherClub = Object.keys(save.rosters).find((id) => id !== save.userClubId)
    const target = save.rosters[otherClub].find((id) => canBuy(save, id).ok)
    expect(target).toBeTruthy()
    save = store.buyPlayer(target, storage)
    expect(save.rosters[save.userClubId]).toContain(target)
    expect(save.contracts[target]).toBe(3) // 새 3년 계약

    const sellable = save.rosters[save.userClubId].find((id) => id !== target && bestSellOffer(save, id))
    expect(sellable).toBeTruthy()
    save = store.sellPlayer(sellable, storage)
    expect(save.rosters[save.userClubId]).not.toContain(sellable)

    expect(Object.values(save.rosters).flat()).toHaveLength(76)
    expect(Object.values(save.budgets).reduce((a, b) => a + b, 0)).toBe(before)
    expect(save.transferLog.length).toBeGreaterThanOrEqual(2)
  })

  test('AI-AI 이적이 결정론적이고 가드를 지킨다', () => {
    const run = () => {
      let { storage } = freshCareer(71)
      let save = store.getCareer()
      for (let round = 1; round <= 12; round++) save = store.finishRound({}, storage)
      return store.enterTransferWindow(storage)
    }
    const a = run()
    const b = run()
    expect(a.transferLog).toEqual(b.transferLog)
    for (const ids of Object.values(a.rosters)) {
      expect(ids.length).toBeGreaterThanOrEqual(15)
      const gks = ids.filter((id) => findCareerPlayer(id).positions.includes('GK'))
      expect(gks.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('N5 — 세이브 마이그레이션 v2 -> v3', () => {
  test('v2 세이브가 budgets/contracts/transferLog 기본값으로 승격된다', () => {
    const storage = fakeStorage()
    const v2Save = {
      masterSeed: 1, userClubId: 'aurum', phase: 'season',
      season: { number: 1, currentRound: 3 },
      rosters: { aurum: ['zidane'], obsidian: [], crimson: [], glacier: [] },
      draftState: null, history: [],
      fixtures: [], playerState: {}, tactics: {}, lineup: null,
    }
    storage.setItem('dream-eleven.career', JSON.stringify({ schemaVersion: 2, savedAt: 'x', save: v2Save }))
    const { save } = loadCareer(storage)
    expect(save.budgets.aurum).toBe(60)
    expect(save.contracts.zidane).toBe(2)
    expect(save.transferLog).toEqual([])
  })
})
