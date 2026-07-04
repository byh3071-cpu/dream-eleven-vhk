import { computeTarget, springStep } from '../../src/ui/steering.js'

describe('computeTarget', () => {
  test('볼이 기준 위치와 같아도 포제션 형태 보정(shapeShift)은 남는다', () => {
    const base = { left: 50, top: 50 }
    const attacking = computeTarget(base, base, 'A', true)
    const defending = computeTarget(base, base, 'A', false)
    expect(attacking.left).toBeCloseTo(50, 5)
    expect(defending.left).toBeCloseTo(50, 5)
    expect(attacking.top).not.toBeCloseTo(50, 5)
    expect(defending.top).not.toBeCloseTo(50, 5)
  })

  test('볼 소유 시 더 적극적으로(더 크게) 당겨진다', () => {
    const base = { left: 50, top: 50 }
    const ball = { left: 55, top: 50 } // 거리 5 (양쪽 다 클램프 안 걸리는 거리)
    const attacking = computeTarget(base, ball, 'A', true)
    const defending = computeTarget(base, ball, 'A', false)
    const attackPull = attacking.left - base.left
    const defendPull = defending.left - base.left
    expect(attackPull).toBeGreaterThan(defendPull)
  })

  test('먼 공은 포제션별 절대 상한에서 각각 클램프됨(+ 팀 라인 시프트)', () => {
    const base = { left: 50, top: 50 }
    const ball = { left: 150, top: 50 } // 먼 공 — pull은 상한 클램프, 라인 시프트도 최대 클램프
    const attacking = computeTarget(base, ball, 'A', true)
    const defending = computeTarget(base, ball, 'A', false)
    const attackPull = attacking.left - base.left
    const defendPull = defending.left - base.left
    // 라인 시프트(LINE_SHIFT_MAX=12)는 team/possession 무관 공통이라 pull 상한 차이는 보존된다.
    expect(attackPull).toBeCloseTo(20, 5) // POSSESSION_MAX_PULL(8) + LINE_SHIFT_MAX(12)
    expect(defendPull).toBeCloseTo(17, 5) // DEFENSE_MAX_PULL(5) + LINE_SHIFT_MAX(12)
    expect(attackPull - defendPull).toBeCloseTo(3, 5) // pull 상한 차이(8-5)는 그대로
  })

  test('A팀은 볼 소유 시 top 감소 방향(상대 골)으로 전진 편향', () => {
    const base = { left: 50, top: 50 }
    const result = computeTarget(base, base, 'A', true)
    expect(result.top).toBeLessThan(base.top)
  })

  test('B팀은 볼 소유 시 top 증가 방향(상대 골)으로 전진 편향', () => {
    const base = { left: 50, top: 50 }
    const result = computeTarget(base, base, 'B', true)
    expect(result.top).toBeGreaterThan(base.top)
  })

  test('A팀은 볼 미소유 시 top 증가 방향(자기 골)으로 후퇴 편향', () => {
    const base = { left: 50, top: 50 }
    const result = computeTarget(base, base, 'A', false)
    expect(result.top).toBeGreaterThan(base.top)
  })
})

describe('springStep', () => {
  const ZERO_V = { left: 0, top: 0 }

  test('이미 목표에 있고 속도도 0이면 그대로 유지된다', () => {
    const pos = { left: 40, top: 60 }
    const result = springStep(pos, ZERO_V, pos, 80, 0.016)
    expect(result.current.left).toBeCloseTo(40, 5)
    expect(result.current.top).toBeCloseTo(60, 5)
  })

  test('pace가 높을수록 같은 시간에 더 많이 이동한다(정지 상태에서 출발)', () => {
    const current = { left: 0, top: 0 }
    const target = { left: 100, top: 0 }
    const slow = springStep(current, ZERO_V, target, 1, 0.016)
    const fast = springStep(current, ZERO_V, target, 99, 0.016)
    expect(fast.current.left).toBeGreaterThan(slow.current.left)
  })

  test('임계감쇠라 목표를 오버슈트하지 않는다(여러 스텝 누적)', () => {
    let current = { left: 0, top: 0 }
    let velocity = ZERO_V
    const target = { left: 10, top: 0 }
    for (let i = 0; i < 500; i++) {
      const result = springStep(current, velocity, target, 99, 1 / 75)
      current = result.current
      velocity = result.velocity
      expect(current.left).toBeLessThanOrEqual(target.left + 1e-6)
    }
    expect(current.left).toBeCloseTo(10, 1)
  })

  test('speedMultiplier가 클수록 같은 스텝 수 안에 목표에 더 가까이 간다', () => {
    const target = { left: 100, top: 0 }
    function runSteps(speedMultiplier) {
      let current = { left: 0, top: 0 }
      let velocity = ZERO_V
      for (let i = 0; i < 5; i++) {
        const result = springStep(current, velocity, target, 50, 0.01, speedMultiplier)
        current = result.current
        velocity = result.velocity
      }
      return current.left
    }
    expect(runSteps(4)).toBeGreaterThan(runSteps(1))
  })

  test('deltaSeconds가 0이면 위치도 속도도 변하지 않는다', () => {
    const current = { left: 10, top: 10 }
    const velocity = { left: 3, top: -2 }
    const target = { left: 90, top: 90 }
    const result = springStep(current, velocity, target, 99, 0)
    expect(result.current).toEqual(current)
    expect(result.velocity).toEqual(velocity)
  })
})
