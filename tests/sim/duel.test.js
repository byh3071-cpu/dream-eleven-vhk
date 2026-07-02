import { successChance, rollSuccess } from '../../src/sim/duel.js'

describe('successChance', () => {
  test('동일한 스코어면 50%에 가깝다', () => {
    expect(successChance(70, 70)).toBeCloseTo(0.5, 5)
  })

  test('공격이 우세하면 50% 초과', () => {
    expect(successChance(90, 60)).toBeGreaterThan(0.5)
  })

  test('수비가 우세하면 50% 미만', () => {
    expect(successChance(60, 90)).toBeLessThan(0.5)
  })

  test('아무리 스탯 차이가 커도 최소/최대 확률 범위를 벗어나지 않는다', () => {
    expect(successChance(99, 1)).toBeLessThanOrEqual(0.9)
    expect(successChance(1, 99)).toBeGreaterThanOrEqual(0.1)
  })

  test('divisor가 작을수록 스탯 차이에 더 민감하다', () => {
    const looseDiff = successChance(80, 60, 80) - 0.5
    const tightDiff = successChance(80, 60, 20) - 0.5
    expect(tightDiff).toBeGreaterThan(looseDiff)
  })
})

describe('rollSuccess', () => {
  test('rng가 chance보다 작으면 성공', () => {
    expect(rollSuccess(() => 0.3, 0.5)).toBe(true)
    expect(rollSuccess(() => 0.7, 0.5)).toBe(false)
  })
})
