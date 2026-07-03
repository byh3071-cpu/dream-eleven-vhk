import { resolveChain, decidePossession } from '../../src/sim/possession.js'
import { ALL_EVENT_TYPES, TERMINAL_TYPES, isTerminal } from '../../src/sim/event-types.js'
import { initialStaminaState } from '../../src/sim/stamina.js'
import { createRng } from '../../src/sim/rng.js'
import { findPlayer } from '../../src/data/players.db.js'

function buildSquad11(ids) {
  return ids.map((id, index) => ({ player: findPlayer(id), slotIndex: index }))
}

describe('resolveChain', () => {
  const homeIds = ['buffon', 'roberto_carlos', 'maldini', 'beckenbauer', 'cafu', 'zidane', 'xavi', 'modric', 'ronaldo_cr7', 'ronaldo_r9', 'messi']
  const awayIds = ['neuer', 'ramos', 'iniesta', 'makelele', 'casemiro', 'beckham', 'maradona', 'van_basten', 'mbappe', 'pele', 'cafu']
  const homeSquad = buildSquad11(homeIds)
  const awaySquad = buildSquad11(awayIds)

  function runChain(rng, narrationRng) {
    const possessing = { squad11: homeSquad, stamina: initialStaminaState(homeSquad), tactics: {} }
    const defending = { squad11: awaySquad, stamina: initialStaminaState(awaySquad), tactics: {} }
    return resolveChain({ possessing, defending, teamLabel: 'A', minute: 10, rng, narrationRng })
  }

  test('항상 유효한 이벤트 타입을 최소 1개 반환하고, 종료 이벤트는 정확히 마지막 1개다', () => {
    const rng = createRng(1)
    const narrationRng = createRng(101)
    for (let i = 0; i < 50; i++) {
      const events = runChain(rng, narrationRng)
      expect(events.length).toBeGreaterThanOrEqual(1)
      for (const evt of events) {
        expect(ALL_EVENT_TYPES).toContain(evt.type)
        expect(evt.team).toBe('A')
        expect(typeof evt.minute).toBe('number')
      }
      const terminals = events.filter(isTerminal)
      expect(terminals).toHaveLength(1)
      expect(TERMINAL_TYPES).toContain(events.at(-1).type)
    }
  })

  test('참여자 소속: pass/carry/슛은 공격팀, turnover의 actorId만 수비팀', () => {
    const rng = createRng(2)
    const narrationRng = createRng(102)
    const homeIdSet = new Set(homeIds)
    const awayIdSet = new Set(awayIds)
    for (let i = 0; i < 50; i++) {
      for (const evt of runChain(rng, narrationRng)) {
        if (evt.type === 'pass') {
          expect(homeIdSet.has(evt.fromId)).toBe(true)
          expect(homeIdSet.has(evt.toId)).toBe(true)
          expect(evt.fromId).not.toBe(evt.toId)
        } else if (evt.type === 'carry') {
          expect(homeIdSet.has(evt.actorId)).toBe(true)
        } else if (evt.type === 'turnover_buildup') {
          expect(awayIdSet.has(evt.actorId)).toBe(true)
          expect(homeIdSet.has(evt.victimId)).toBe(true)
          expect(['tackle', 'interception']).toContain(evt.cause)
        } else {
          expect(homeIdSet.has(evt.actorId)).toBe(true)
        }
      }
    }
  })

  test('많이 반복하면 골이 한 번 이상 발생한다(확률적으로 0%가 아님을 확인)', () => {
    const rng = createRng(3)
    const narrationRng = createRng(103)
    let goals = 0
    for (let i = 0; i < 300; i++) {
      if (runChain(rng, narrationRng).at(-1).type === 'goal') goals++
    }
    expect(goals).toBeGreaterThan(0)
  })

  test('서술 RNG가 달라져도 종료 이벤트(판정 결과)는 동일하다 — 아웃컴/서술 격리', () => {
    // 같은 chainRng 시드 + 다른 narrationRng 시드 두 벌을 굴려서,
    // 서술(패스 경로)은 달라질 수 있어도 최종 판정은 절대 안 바뀌는 걸 확인.
    const run = (narrationSeed) => {
      const rng = createRng(7)
      const narrationRng = createRng(narrationSeed)
      const out = []
      for (let i = 0; i < 30; i++) out.push(runChain(rng, narrationRng).at(-1).type)
      return out
    }
    expect(run(1000)).toEqual(run(2000))
  })
})

describe('decidePossession', () => {
  test('두 미드필드 전력이 같으면 대략 50대50으로 갈린다', () => {
    const rng = createRng(4)
    let aWins = 0
    const trials = 2000
    for (let i = 0; i < trials; i++) {
      if (decidePossession(70, 70, rng)) aWins++
    }
    expect(aWins / trials).toBeGreaterThan(0.4)
    expect(aWins / trials).toBeLessThan(0.6)
  })

  test('미드필드 전력이 훨씬 높은 팀이 더 자주 점유를 가져간다', () => {
    const rng = createRng(5)
    let aWins = 0
    const trials = 2000
    for (let i = 0; i < trials; i++) {
      if (decidePossession(90, 40, rng)) aWins++
    }
    expect(aWins / trials).toBeGreaterThan(0.6)
  })
})
