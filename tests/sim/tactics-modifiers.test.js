import {
  mentalityAttackMult, mentalityDefendMult, pressingDefendMult, tempoChainDelta, tempoAccuracyMult,
} from '../../src/sim/tactics-modifiers.js'

describe('mentalityAttackMult / mentalityDefendMult', () => {
  test('멘탈리티 0(균형)은 배율 1(무효과)이다', () => {
    expect(mentalityAttackMult(0)).toBeCloseTo(1)
    expect(mentalityDefendMult(0)).toBeCloseTo(1)
  })

  test('공격적일수록 attackMult는 오르고 defendMult는 내려간다 (트레이드오프)', () => {
    expect(mentalityAttackMult(2)).toBeGreaterThan(mentalityAttackMult(0))
    expect(mentalityDefendMult(2)).toBeLessThan(mentalityDefendMult(0))
  })

  test('수비적일수록 attackMult는 내려가고 defendMult는 오른다', () => {
    expect(mentalityAttackMult(-2)).toBeLessThan(mentalityAttackMult(0))
    expect(mentalityDefendMult(-2)).toBeGreaterThan(mentalityDefendMult(0))
  })

  test('범위를 벗어난 값은 -2~2로 clamp된다', () => {
    expect(mentalityAttackMult(99)).toBeCloseTo(mentalityAttackMult(2))
    expect(mentalityAttackMult(-99)).toBeCloseTo(mentalityAttackMult(-2))
  })

  test('undefined는 0(균형)으로 취급한다', () => {
    expect(mentalityAttackMult(undefined)).toBeCloseTo(1)
  })
})

describe('pressingDefendMult', () => {
  test('압박 0.5(기본값)는 배율 1이다', () => {
    expect(pressingDefendMult(0.5)).toBeCloseTo(1)
    expect(pressingDefendMult(undefined)).toBeCloseTo(1)
  })

  test('풀압박(1.0)은 수비 스코어를 올리고, 로우블록(0.0)은 내린다', () => {
    expect(pressingDefendMult(1.0)).toBeGreaterThan(1)
    expect(pressingDefendMult(0.0)).toBeLessThan(1)
    expect(pressingDefendMult(1.0)).toBeGreaterThan(pressingDefendMult(0.0))
  })
})

describe('tempoChainDelta', () => {
  test('양팀 다 기본 템포(0.5)면 보정값 0이다', () => {
    expect(tempoChainDelta(0.5, 0.5)).toBeCloseTo(0)
    expect(tempoChainDelta(undefined, undefined)).toBeCloseTo(0)
  })

  test('양팀 템포가 빠를수록 체인 수가 늘고, 느릴수록 준다', () => {
    expect(tempoChainDelta(1, 1)).toBeGreaterThan(0)
    expect(tempoChainDelta(0, 0)).toBeLessThan(0)
  })

  test('한쪽만 빨라도 평균이 오르므로 공용으로 체인이 늘어난다', () => {
    expect(tempoChainDelta(1, 0.5)).toBeGreaterThan(tempoChainDelta(0.5, 0.5))
  })
})

describe('tempoAccuracyMult', () => {
  test('기본 템포(0.5)는 배율 1이다', () => {
    expect(tempoAccuracyMult(0.5)).toBeCloseTo(1)
  })

  test('템포가 빠를수록 정확도 배율은 내려간다 (개인 대가)', () => {
    expect(tempoAccuracyMult(1)).toBeLessThan(1)
    expect(tempoAccuracyMult(0)).toBeGreaterThan(1)
  })
})
