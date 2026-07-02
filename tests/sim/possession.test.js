import { resolveChain, decidePossession } from '../../src/sim/possession.js'
import { initialStaminaState } from '../../src/sim/stamina.js'
import { createRng } from '../../src/sim/rng.js'
import { findPlayer } from '../../src/data/players.db.js'

const VALID_EVENT_TYPES = new Set([
  'turnover_buildup', 'shot_off_target', 'shot_saved', 'goal',
])

function buildSquad11(ids) {
  return ids.map((id, index) => ({ player: findPlayer(id), slotIndex: index }))
}

describe('resolveChain', () => {
  const homeIds = ['buffon', 'roberto_carlos', 'maldini', 'beckenbauer', 'cafu', 'zidane', 'xavi', 'modric', 'ronaldo_cr7', 'ronaldo_r9', 'messi']
  const awayIds = ['neuer', 'ramos', 'iniesta', 'makelele', 'casemiro', 'beckham', 'maradona', 'van_basten', 'mbappe', 'pele', 'cafu']
  const homeSquad = buildSquad11(homeIds)
  const awaySquad = buildSquad11(awayIds)

  test('항상 유효한 이벤트 타입을 최소 1개 반환한다', () => {
    const rng = createRng(1)
    const possessing = { squad11: homeSquad, stamina: initialStaminaState(homeSquad), tactics: {} }
    const defending = { squad11: awaySquad, stamina: initialStaminaState(awaySquad), tactics: {} }
    for (let i = 0; i < 50; i++) {
      const events = resolveChain({ possessing, defending, teamLabel: 'A', minute: 10, rng })
      expect(events.length).toBeGreaterThanOrEqual(1)
      for (const evt of events) {
        expect(VALID_EVENT_TYPES.has(evt.type)).toBe(true)
        expect(evt.team).toBe('A')
        expect(typeof evt.minute).toBe('number')
      }
    }
  })

  test('actorId는 항상 공격측(possessing) 스쿼드의 선수다', () => {
    const rng = createRng(2)
    const possessing = { squad11: homeSquad, stamina: initialStaminaState(homeSquad), tactics: {} }
    const defending = { squad11: awaySquad, stamina: initialStaminaState(awaySquad), tactics: {} }
    const homeIdSet = new Set(homeIds)
    for (let i = 0; i < 50; i++) {
      const [evt] = resolveChain({ possessing, defending, teamLabel: 'A', minute: 10, rng })
      if (evt.type === 'turnover_buildup') continue // 이 타입은 수비측 선수가 actor
      expect(homeIdSet.has(evt.actorId)).toBe(true)
    }
  })

  test('많이 반복하면 골이 한 번 이상 발생한다(확률적으로 0%가 아님을 확인)', () => {
    const rng = createRng(3)
    const possessing = { squad11: homeSquad, stamina: initialStaminaState(homeSquad), tactics: {} }
    const defending = { squad11: awaySquad, stamina: initialStaminaState(awaySquad), tactics: {} }
    let goals = 0
    for (let i = 0; i < 300; i++) {
      const [evt] = resolveChain({ possessing, defending, teamLabel: 'A', minute: 10, rng })
      if (evt.type === 'goal') goals++
    }
    expect(goals).toBeGreaterThan(0)
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
