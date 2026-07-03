// goal 18 — 유스 생성기/파생 에이징/세이브-바운드 리졸버/세이브 v5.

import { generateYouth, scoutStars } from '../../src/career/youthGen.js'
import { developPlayer, potentialOf, POSITION_CORE_STATS } from '../../src/career/development.js'
import { resolveCareerPlayer } from '../../src/career/players.js'
import { validatePlayer } from '../../src/data/player-schema.js'
import { loadCareer } from '../../src/career/persistence.js'
import { playerOverallRating } from '../../src/sim/teamStrength.js'
import * as store from '../../src/career/store.js'
import { createRng } from '../../src/sim/rng.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

describe('youthGen — 생성기', () => {
  test('결정론: 같은 rng 시드는 같은 유스', () => {
    const a = generateYouth({ season: 2, index: 0, rng: createRng(5) })
    const b = generateYouth({ season: 2, index: 0, rng: createRng(5) })
    expect(a).toEqual(b)
  })

  test('스키마 통과 + 범위(나이 15~17, potential > 현재, id 네임스페이스)', () => {
    const rng = createRng(9)
    for (let i = 0; i < 30; i++) {
      const youth = generateYouth({ season: 3, index: i, rng })
      expect(validatePlayer(youth)).toEqual([])
      expect(youth.age).toBeGreaterThanOrEqual(15)
      expect(youth.age).toBeLessThanOrEqual(17)
      expect(youth.id.startsWith('youth_s3_')).toBe(true)
      expect(youth.potential).toBeGreaterThan(playerOverallRating(youth))
      expect(scoutStars(youth)).toBeGreaterThanOrEqual(1)
      expect(scoutStars(youth)).toBeLessThanOrEqual(5)
      expect(youth.nationality).toBeTruthy()
    }
  })

  test('포지션 원형: 주 스탯이 보조보다 높게 생성된다', () => {
    const rng = createRng(11)
    for (let i = 0; i < 20; i++) {
      const youth = generateYouth({ season: 1, index: i, rng })
      if (youth.positions[0] === 'GK') continue // GK는 필드 스탯 하향 규칙 별도
      const core = POSITION_CORE_STATS[youth.positions[0]]
      const coreAvg = core.reduce((s, k) => s + youth.stats[k], 0) / core.length
      const rest = Object.keys(youth.stats).filter((k) => !core.includes(k))
      const restAvg = rest.reduce((s, k) => s + youth.stats[k], 0) / rest.length
      expect(coreAvg).toBeGreaterThan(restAvg)
    }
  })
})

describe('development — 파생 에이징(저장 0)', () => {
  const base = {
    id: 'youth_s1_0', age: 16, positions: ['ST'], potential: 90,
    stats: { pace: 65, shooting: 68, passing: 55, dribbling: 60, defending: 40, physical: 66 },
  }

  test('시즌1은 무변화, 시즌 경과만큼 나이·스탯 파생(원본 불변)', () => {
    const s1 = { masterSeed: 42, season: { number: 1 } }
    expect(developPlayer(base, s1)).toBe(base) // 참조 그대로 — 복제 비용 0

    const s3 = { masterSeed: 42, season: { number: 3 } }
    const grown = developPlayer(base, s3)
    expect(grown.age).toBe(18)
    expect(playerOverallRating(grown)).toBeGreaterThan(playerOverallRating(base))
    expect(base.stats.shooting).toBe(68) // 원본 불변
    // 결정론: 같은 세이브 좌표는 같은 궤적
    expect(developPlayer(base, s3)).toEqual(grown)
  })

  test('성장은 potential에서 멈추고, 30+는 신체 쇠퇴', () => {
    const capped = { ...base, potential: playerOverallRating(base) } // 이미 도달
    const s5 = { masterSeed: 7, season: { number: 5 } }
    const after = developPlayer(capped, s5)
    expect(playerOverallRating(after)).toBeLessThanOrEqual(potentialOf(capped) + 1)

    const veteran = { ...base, id: 'zidane_like', age: 29, potential: 85 }
    const aged = developPlayer(veteran, { masterSeed: 7, season: { number: 4 } }) // 32세
    expect(aged.stats.pace).toBeLessThan(veteran.stats.pace)
    expect(aged.stats.physical).toBeLessThan(veteran.stats.physical)
  })
})

describe('resolveCareerPlayer — 3계층 리졸버', () => {
  test('유스(세이브) → DB → 필러 순서 + 에이징 오버레이', () => {
    const youth = generateYouth({ season: 1, index: 0, rng: createRng(3) })
    const save = {
      masterSeed: 1, season: { number: 2 },
      youthPlayers: { [youth.id]: youth },
    }
    const resolved = resolveCareerPlayer(save, youth.id)
    expect(resolved.name).toBe(youth.name)
    expect(resolved.age).toBe(youth.age + 1) // 시즌2 — 1년 경과

    const pele = resolveCareerPlayer(save, 'pele')
    expect(pele.name).toContain('펠레')
    const filler = resolveCareerPlayer(save, 'filler_gk_1')
    expect(filler.positions).toContain('GK')
    expect(resolveCareerPlayer(save, 'nope')).toBeUndefined()
  })
})

describe('store — 아카데미 흐름 + 세이브 v5', () => {
  function seasonCareer(seed = 55) {
    const storage = fakeStorage()
    store.initCareer(storage)
    store.newCareer({ userClubId: 'aurum', masterSeed: seed, storage })
    let save = store.draftCatchUp(storage)
    while (save.phase === 'draft') save = store.draftPick(save.draftState.availableIds[0], storage)
    return { storage }
  }

  test('이적창 개장 시 내 후보 3명 + AI 자동 유스, 계약/소멸 동작', () => {
    const { storage } = seasonCareer()
    let save = store.getCareer()
    for (let r = 1; r <= 12; r++) save = store.finishRound({}, storage)
    save = store.enterTransferWindow(storage)

    expect(save.academyCandidates).toHaveLength(3)
    expect(save.academyCandidates.every((c) => c.clubId === 'aurum')).toBe(true)
    const aiYouth = Object.values(save.rosters).flat().filter((id) => id.startsWith('youth_'))
    expect(aiYouth).toHaveLength(3) // AI 3구단 × 1

    const target = save.academyCandidates[0]
    const beforeCount = save.rosters.aurum.length
    save = store.signAcademyPlayer(target.id, storage)
    expect(save.rosters.aurum).toContain(target.id)
    expect(save.rosters.aurum).toHaveLength(beforeCount + 1)
    expect(save.contracts[target.id]).toBe(3)
    expect(save.academyCandidates).toHaveLength(2)

    save = store.startSeasonAfterTransfer(storage)
    expect(save.academyCandidates).toEqual([]) // 미계약 소멸
    expect(save.youthPlayers[target.id]).toBeTruthy()
    // 시즌2 라운드 진행 — 유스 포함 리그가 정상 구동
    save = store.finishRound({}, storage)
    expect(save.season.currentRound).toBe(2)
  })

  test('v4 → v5 마이그레이션: youthPlayers/academyCandidates 기본값', () => {
    const storage = fakeStorage()
    const v4Save = {
      masterSeed: 1, userClubId: 'aurum', phase: 'season',
      season: { number: 1, currentRound: 2 },
      rosters: { aurum: [], obsidian: [], crimson: [], glacier: [] },
      draftState: null, history: [], budgets: {}, contracts: {}, transferLog: [],
      seasonStats: {}, boardTrust: 55, financeLog: [], debtRounds: 0, gameOverReason: null,
      fixtures: [], playerState: {}, tactics: {}, lineup: null,
    }
    storage.setItem('dream-eleven.career', JSON.stringify({ schemaVersion: 4, savedAt: 'x', save: v4Save }))
    const { save } = loadCareer(storage)
    expect(save.youthPlayers).toEqual({})
    expect(save.academyCandidates).toEqual([])
  })
})
