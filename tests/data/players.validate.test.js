import { PLAYERS, findPlayer, playersByPosition } from '../../src/data/players.db.js'
import { validatePlayer, POSITIONS } from '../../src/data/player-schema.js'
import { FORMATIONS, findFormation } from '../../src/data/formations.js'

describe('players.db', () => {
  test('모든 선수가 스키마를 통과한다', () => {
    for (const player of PLAYERS) {
      const errors = validatePlayer(player)
      expect(errors).toEqual([])
    }
  })

  test('id가 전부 유일하다', () => {
    const ids = PLAYERS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('12개 포지션이 전부 최소 1명 이상 커버된다', () => {
    for (const position of POSITIONS) {
      expect(playersByPosition(position).length).toBeGreaterThanOrEqual(1)
    }
  })

  test('16명 이상 확보되어 있다 (M1 최소 목표)', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(16)
  })

  test('findPlayer가 존재하는 id로 선수를 찾는다', () => {
    expect(findPlayer('zidane').name).toBe('지네딘 지단')
    expect(findPlayer('unknown_id')).toBeUndefined()
  })

  test('호날두 두 명이 id로 명확히 구분된다', () => {
    expect(findPlayer('ronaldo_cr7').name).toContain('크리스티아누')
    expect(findPlayer('ronaldo_r9').name).toBe('호나우두')
  })
})

describe('formations.js', () => {
  test('모든 포메이션이 정확히 11슬롯을 가진다', () => {
    for (const formation of FORMATIONS) {
      expect(formation.slots).toHaveLength(11)
    }
  })

  test('모든 포메이션이 GK를 정확히 1명 포함한다', () => {
    for (const formation of FORMATIONS) {
      const gkCount = formation.slots.filter((s) => s.role === 'GK').length
      expect(gkCount).toBe(1)
    }
  })

  test('모든 슬롯 role이 유효한 포지션이다', () => {
    for (const formation of FORMATIONS) {
      for (const slot of formation.slots) {
        expect(POSITIONS).toContain(slot.role)
      }
    }
  })

  test('모든 슬롯 좌표가 0~100 범위 안에 있다', () => {
    for (const formation of FORMATIONS) {
      for (const slot of formation.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0)
        expect(slot.x).toBeLessThanOrEqual(100)
        expect(slot.y).toBeGreaterThanOrEqual(0)
        expect(slot.y).toBeLessThanOrEqual(100)
      }
    }
  })

  test('5개 이상의 포메이션 프리셋이 있다', () => {
    expect(FORMATIONS.length).toBeGreaterThanOrEqual(5)
  })

  test('findFormation이 존재하는 id로 포메이션을 찾는다', () => {
    expect(findFormation('4-3-3').label).toBe('4-3-3')
    expect(findFormation('unknown')).toBeUndefined()
  })
})
