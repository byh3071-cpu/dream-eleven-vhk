import { computeTarget, stepToward } from '../../src/ui/steering.js'

describe('computeTarget', () => {
  test('공이 기준 위치와 같으면 목표는 기준 위치 그대로', () => {
    const base = { left: 50, top: 50 }
    expect(computeTarget(base, { left: 50, top: 50 })).toEqual({ left: 50, top: 50 })
  })

  test('가까운 공은 거리 비례만큼만 당겨짐 (상한 미도달)', () => {
    const base = { left: 50, top: 50 }
    const ball = { left: 60, top: 50 } // 거리 10, 0.18배 = 1.8 (상한 7 미만)
    const target = computeTarget(base, ball)
    expect(target.top).toBeCloseTo(50, 5)
    expect(target.left).toBeCloseTo(51.8, 5)
  })

  test('먼 공은 절대 상한(MAX_PULL=7)에서 클램프됨', () => {
    const base = { left: 50, top: 50 }
    const ball = { left: 50, top: 100 } // 거리 50, 0.18배 = 9 (상한 7 초과 -> 7로 클램프)
    const target = computeTarget(base, ball)
    expect(target.left).toBeCloseTo(50, 5)
    expect(target.top).toBeCloseTo(57, 5)
  })

  test('대각선 방향도 두 축 모두 비율대로 이동', () => {
    const base = { left: 0, top: 0 }
    const ball = { left: 3, top: 4 } // 거리 5, 0.18배 = 0.9
    const target = computeTarget(base, ball)
    expect(target.left).toBeCloseTo(3 * (0.9 / 5), 5)
    expect(target.top).toBeCloseTo(4 * (0.9 / 5), 5)
  })
})

describe('stepToward', () => {
  test('목표와 현재 위치가 같으면 그대로 유지', () => {
    const pos = { left: 40, top: 60 }
    expect(stepToward(pos, pos, 80, 0.1)).toEqual({ left: 40, top: 60 })
  })

  test('pace가 높을수록 같은 시간에 더 많이 이동한다', () => {
    const current = { left: 0, top: 0 }
    const target = { left: 100, top: 0 } // 절대 못 닿을 만큼 멀리 둬서 순수 속도 비교
    const slow = stepToward(current, target, 1, 0.1)
    const fast = stepToward(current, target, 99, 0.1)
    expect(fast.left).toBeGreaterThan(slow.left)
  })

  test('한 스텝으로 목표에 도달 가능하면 오버슈트 없이 정확히 목표에서 멈춘다', () => {
    const current = { left: 50, top: 50 }
    const target = { left: 50.1, top: 50 } // 아주 가까운 목표
    const result = stepToward(current, target, 99, 1) // 1초, 최고 속도
    expect(result).toEqual({ left: 50.1, top: 50 })
  })

  test('speedMultiplier가 배속만큼 이동 거리를 스케일한다', () => {
    const current = { left: 0, top: 0 }
    const target = { left: 100, top: 0 }
    const at1x = stepToward(current, target, 50, 0.1, 1)
    const at4x = stepToward(current, target, 50, 0.1, 4)
    expect(at4x.left).toBeCloseTo(at1x.left * 4, 5)
  })

  test('deltaSeconds가 0이면 움직이지 않는다', () => {
    const current = { left: 10, top: 10 }
    const target = { left: 90, top: 90 }
    expect(stepToward(current, target, 99, 0)).toEqual({ left: 10, top: 10 })
  })
})
