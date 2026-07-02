import { simulateMatch } from '../../src/sim/engine.js'
import { findFormation } from '../../src/data/formations.js'
import { findPlayer, PLAYERS } from '../../src/data/players.db.js'

function buildSquad(ids) {
  return ids.map((id, index) => ({ player: findPlayer(id), slotIndex: index }))
}

const formation = findFormation('4-3-3')
const homeIds = ['buffon', 'roberto_carlos', 'maldini', 'beckenbauer', 'cafu', 'zidane', 'xavi', 'modric', 'ronaldo_cr7', 'ronaldo_r9', 'messi']
const usedHome = new Set(homeIds)
const awayIds = PLAYERS.map((p) => p.id).filter((id) => !usedHome.has(id)).slice(0, 11)

const home = { squad11: buildSquad(homeIds), formation, tactics: {} }
const away = { squad11: buildSquad(awayIds), formation, tactics: {} }

describe('simulateMatch — 구조적 정합성', () => {
  test('결정론적이다: 같은 seed면 완전히 같은 결과를 반환한다', () => {
    const r1 = simulateMatch({ home, away, seed: 7 })
    const r2 = simulateMatch({ home, away, seed: 7 })
    expect(r1).toEqual(r2)
  })

  test('다른 seed는 다른 결과를 낼 수 있다', () => {
    const r1 = simulateMatch({ home, away, seed: 1 })
    const r2 = simulateMatch({ home, away, seed: 2 })
    expect(r1.events).not.toEqual(r2.events)
  })

  test('score는 events의 goal 개수와 정확히 일치한다', () => {
    const result = simulateMatch({ home, away, seed: 3 })
    const goalsA = result.events.filter((e) => e.type === 'goal' && e.team === 'A').length
    const goalsB = result.events.filter((e) => e.type === 'goal' && e.team === 'B').length
    expect(result.score.home).toBe(goalsA)
    expect(result.score.away).toBe(goalsB)
  })

  test('이벤트가 분 단위로 정렬되어 있다', () => {
    const result = simulateMatch({ home, away, seed: 4 })
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].minute).toBeGreaterThanOrEqual(result.events[i - 1].minute)
    }
  })

  test('모든 이벤트의 minute은 1~90 범위 안이다', () => {
    const result = simulateMatch({ home, away, seed: 5 })
    for (const evt of result.events) {
      expect(evt.minute).toBeGreaterThanOrEqual(1)
      expect(evt.minute).toBeLessThanOrEqual(90)
    }
  })

  test('ratings는 양 팀 모두 4개 필드를 반환한다', () => {
    const result = simulateMatch({ home, away, seed: 6 })
    for (const side of ['home', 'away']) {
      for (const key of ['gkRating', 'defenseRating', 'midfieldRating', 'attackRating']) {
        expect(typeof result.ratings[side][key]).toBe('number')
      }
    }
  })
})
