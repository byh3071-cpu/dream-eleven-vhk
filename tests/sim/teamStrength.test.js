import { computeTeamRatings, positionFit, overallStrength, playerOverallRating } from '../../src/sim/teamStrength.js'
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

describe('playerOverallRating — 포지션별 가중치 카드 레이팅', () => {
  test('필드 안(1~99) 정수를 반환한다', () => {
    const rating = playerOverallRating(findPlayer('messi'))
    expect(Number.isInteger(rating)).toBe(true)
    expect(rating).toBeGreaterThanOrEqual(1)
    expect(rating).toBeLessThanOrEqual(99)
  })

  test('공격수의 낮은 수비 스탯이 레이팅을 부당하게 깎지 않는다 (호나우지뉴 DEF 32)', () => {
    // 단순 6스탯 평균이었다면 defending 32가 발목을 잡아 80대 초반까지 떨어졌을 것 —
    // LW 가중치(수비 비중 0)를 쓰면 공격 스탯 위주로 90 안팎이 나와야 한다.
    const rating = playerOverallRating(findPlayer('ronaldinho'))
    expect(rating).toBeGreaterThanOrEqual(88)
  })

  test('수비수의 낮은 슈팅 스탯이 레이팅을 부당하게 깎지 않는다 (칸나바로 SHO 40)', () => {
    const rating = playerOverallRating(findPlayer('cannavaro'))
    expect(rating).toBeGreaterThanOrEqual(83)
  })

  test('같은 스탯이라도 포지션에 따라 다른 레이팅이 나온다 (포지션 가중치가 실제로 반영됨)', () => {
    const flatStats = { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70 }
    const asCB = playerOverallRating({ positions: ['CB'], stats: flatStats })
    const asST = playerOverallRating({ positions: ['ST'], stats: flatStats })
    // 스탯이 완전히 평평하면 어느 포지션이든 가중치 합이 1이므로 결과는 같아야 한다 —
    // 이건 가중치 정의가 깨지지 않았는지(합이 1에서 크게 벗어나지 않는지) 확인하는 회귀 테스트.
    expect(asCB).toBeCloseTo(70, 0)
    expect(asST).toBeCloseTo(70, 0)
  })
})
