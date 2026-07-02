import { computeTeamRatings, positionFit, overallStrength } from '../../src/sim/teamStrength.js'
import { findFormation } from '../../src/data/formations.js'
import { findPlayer } from '../../src/data/players.db.js'

describe('positionFit', () => {
  test('정확히 일치하면 1.0', () => {
    expect(positionFit(['CB'], 'CB')).toBe(1.0)
  })

  test('멀티 포지션 선수는 그 중 하나만 일치해도 1.0', () => {
    expect(positionFit(['CB', 'LB'], 'LB')).toBe(1.0)
  })

  test('인접 포지션은 0.85', () => {
    expect(positionFit(['DM'], 'CB')).toBe(0.85)
    expect(positionFit(['LW'], 'LB')).toBe(0.85)
  })

  test('같은 라인의 다른 롤은 0.65', () => {
    expect(positionFit(['RW'], 'LW')).toBe(0.65)
  })

  test('완전히 다른 라인은 0.4', () => {
    expect(positionFit(['CB'], 'ST')).toBe(0.4)
  })

  test('GK를 아웃필드 슬롯에 배치하면 강한 페널티', () => {
    expect(positionFit(['GK'], 'ST')).toBeLessThan(0.5)
    expect(positionFit(['ST'], 'GK')).toBeLessThan(0.5)
  })
})

describe('computeTeamRatings — 4-3-3 레전드 XI', () => {
  const formation = findFormation('4-3-3')
  // slot 순서: GK,LB,CB,CB,RB,CM,CM,CM,LW,ST,RW
  const wellFitted = [
    { player: findPlayer('buffon'), slotIndex: 0 },
    { player: findPlayer('roberto_carlos'), slotIndex: 1 },
    { player: findPlayer('maldini'), slotIndex: 2 },
    { player: findPlayer('beckenbauer'), slotIndex: 3 },
    { player: findPlayer('cafu'), slotIndex: 4 },
    { player: findPlayer('zidane'), slotIndex: 5 },
    { player: findPlayer('xavi'), slotIndex: 6 },
    { player: findPlayer('modric'), slotIndex: 7 },
    { player: findPlayer('ronaldo_cr7'), slotIndex: 8 },
    { player: findPlayer('ronaldo_r9'), slotIndex: 9 },
    { player: findPlayer('messi'), slotIndex: 10 },
  ]

  test('모든 슬롯에서 필드 안(0~99) 레이팅을 반환한다', () => {
    const ratings = computeTeamRatings(wellFitted, formation)
    for (const key of ['gkRating', 'defenseRating', 'midfieldRating', 'attackRating']) {
      expect(ratings[key]).toBeGreaterThan(0)
      expect(ratings[key]).toBeLessThanOrEqual(99)
    }
  })

  test('공격진(호날두/호나우두/메시)이 실제 포지션에 배치되면 attackRating이 높다(80대)', () => {
    const ratings = computeTeamRatings(wellFitted, formation)
    expect(ratings.attackRating).toBeGreaterThan(80)
  })

  test('포지션을 잘못 배치하면(CB↔ST 스왑) 같은 선수단이어도 전력이 하락한다', () => {
    const scrambled = wellFitted.map((entry) => {
      if (entry.slotIndex === 3) return { ...entry, slotIndex: 9 } // beckenbauer(CB) -> ST 슬롯
      if (entry.slotIndex === 9) return { ...entry, slotIndex: 3 } // ronaldo_r9(ST) -> CB 슬롯
      return entry
    })

    const goodRatings = computeTeamRatings(wellFitted, formation)
    const scrambledRatings = computeTeamRatings(scrambled, formation)

    expect(overallStrength(scrambledRatings)).toBeLessThan(overallStrength(goodRatings))
  })
})
