// goal 20 — 시즌 서사/기자회견/은퇴/통산 기록/세이브 v6.

import { composeSeasonStory } from '../../src/career/story.js'
import { rollRetirements } from '../../src/career/retirement.js'
import { pressTriggerFor, pressQuestionOf, applyPressAnswer } from '../../src/career/press.js'
import { loadCareer } from '../../src/career/persistence.js'
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

function playedCareer(seed = 33, rounds = 12, { answerPress = true } = {}) {
  const storage = fakeStorage()
  store.initCareer(storage)
  store.newCareer({ userClubId: 'aurum', masterSeed: seed, storage })
  let save = store.draftCatchUp(storage)
  while (save.phase === 'draft') save = store.draftPick(save.draftState.availableIds[0], storage)
  for (let r = 1; r <= rounds; r++) {
    // 대기 중 질문은 그때그때 답한다 — 설계상 미답변 질문이 있으면 다음 회견이
    // 트리거되지 않는다(질문이 쌓이지 않게).
    if (answerPress && store.getCareer().pendingPress) {
      const q = pressQuestionOf(store.getCareer().pendingPress)
      save = store.answerPress(q.answers[0].id, storage)
    }
    save = store.finishRound({}, storage)
  }
  return { storage, save }
}

describe('story — 시즌 서사 조합', () => {
  test('시즌 완주 세이브에서 총평+개인 영예가 반드시 나온다', () => {
    const { save } = playedCareer(33)
    const story = composeSeasonStory(save)
    expect(story.length).toBeGreaterThanOrEqual(3)
    expect(story[0]).toContain('시즌 1')
    expect(story.some((s) => s.includes('득점왕'))).toBe(true)
  })

  test('은퇴 헌사는 retirees가 있을 때만', () => {
    const { save } = playedCareer(34)
    const without = composeSeasonStory(save)
    const withRet = composeSeasonStory(save, {
      retirees: [{ name: '레프 야신', age: 41, clubId: 'aurum', season: 1 }],
    })
    expect(withRet.length).toBe(without.length + 1)
    expect(withRet.at(-1)).toContain('야신')
  })
})

describe('retirement — 은퇴 판정', () => {
  test('37+ 강제, 34 미만 면제, 하한 15명 가드(잔류+은퇴 보존)', () => {
    const { save } = playedCareer(35)
    // 새 시즌 기준(전환 후) 세이브를 흉내 — season+1이면 파생 나이 +1
    const nextSave = { ...save, season: { number: 2, currentRound: 1 } }
    const { retirees, rosters } = rollRetirements(nextSave, createRng(1))
    for (const r of retirees) expect(r.age).toBeGreaterThanOrEqual(34)
    for (const [clubId, ids] of Object.entries(rosters)) {
      expect(ids.length).toBeGreaterThanOrEqual(15)
      const before = save.rosters[clubId].length
      const retiredHere = retirees.filter((r) => r.clubId === clubId).length
      expect(ids.length + retiredHere).toBe(before) // 보존 법칙
    }
    // 결정론
    const again = rollRetirements(nextSave, createRng(1))
    expect(again.retirees).toEqual(retirees)
  })
})

describe('press — 기자회견', () => {
  test('트리거 3슬롯: 개막(R1)/중반(R7)/종료(R13+), 같은 슬롯 중복 없음', () => {
    const base = {
      masterSeed: 5, userClubId: 'aurum', pendingPress: null, pressLog: [],
      season: { number: 1, currentRound: 1 },
      rosters: { aurum: [], obsidian: [], crimson: [], glacier: [] },
      fixtures: [],
    }
    const opening = pressTriggerFor(base)
    expect(opening.slot).toBe('opening')
    expect(pressQuestionOf(opening)).toBeTruthy()

    const mid = pressTriggerFor({ ...base, season: { number: 1, currentRound: 7 } })
    expect(mid.slot).toBe('mid')

    const closing = pressTriggerFor({ ...base, season: { number: 1, currentRound: 13 } })
    expect(closing.slot).toBe('closing')

    // 이미 답변한 슬롯은 재트리거 없음
    const answered = { ...base, pressLog: [{ season: 1, slot: 'opening' }] }
    expect(pressTriggerFor(answered)).toBeNull()
    // 결정론
    expect(pressTriggerFor(base)).toEqual(pressTriggerFor(base))
  })

  test('답변이 신임도에 반영되고 로그가 쌓인다', () => {
    const { save } = playedCareer(36, 6) // 개막 회견은 헬퍼가 답변 — R7 진입 시 mid 트리거
    expect(save.pendingPress).toBeTruthy()
    const question = pressQuestionOf(save.pendingPress)
    const answer = question.answers[0]
    const before = save.boardTrust
    const after = applyPressAnswer(save, answer.id)
    expect(after.boardTrust).toBe(Math.max(0, Math.min(100, before + answer.trust)))
    expect(after.pressLog.at(-1)).toMatchObject({ slot: 'mid', answerId: answer.id })
    expect(after.pendingPress).toBeNull()
  })
})

describe('store 통합 — 시즌 전환의 서사 축적', () => {
  test('이적창 진입 시 story/careerTotals/retiredLog가 쌓이고 closing 회견이 뜬다', () => {
    const { storage } = playedCareer(37)
    // 시즌 중 마지막 대기 질문(mid)을 소화해야 closing이 뜬다(설계: 질문 비축적)
    if (store.getCareer().pendingPress) {
      const q = pressQuestionOf(store.getCareer().pendingPress)
      store.answerPress(q.answers[0].id, storage)
    }
    const save = store.enterTransferWindow(storage)
    expect(save.history[0].story.length).toBeGreaterThanOrEqual(3)
    expect(Object.keys(save.careerTotals).length).toBeGreaterThan(5)
    expect(save.pendingPress?.slot).toBe('closing')
    // 은퇴자는 로스터에 없고 로그에 있다
    for (const r of save.retiredLog) {
      expect(save.rosters[r.clubId]).not.toContain(r.playerId)
    }
  })
})

describe('세이브 v5 -> v6', () => {
  test('retiredLog/careerTotals/pressLog/pendingPress 기본값 승격', () => {
    const storage = fakeStorage()
    const v5Save = {
      masterSeed: 1, userClubId: 'aurum', phase: 'season',
      season: { number: 1, currentRound: 2 },
      rosters: { aurum: [], obsidian: [], crimson: [], glacier: [] },
      draftState: null, history: [], budgets: {}, contracts: {}, transferLog: [],
      seasonStats: {}, boardTrust: 55, financeLog: [], debtRounds: 0, gameOverReason: null,
      youthPlayers: {}, academyCandidates: [],
      fixtures: [], playerState: {}, tactics: {}, lineup: null,
    }
    storage.setItem('dream-eleven.career', JSON.stringify({ schemaVersion: 5, savedAt: 'x', save: v5Save }))
    const { save } = loadCareer(storage)
    expect(save.retiredLog).toEqual([])
    expect(save.careerTotals).toEqual({})
    expect(save.pressLog).toEqual([])
    expect(save.pendingPress).toBeNull()
  })
})
