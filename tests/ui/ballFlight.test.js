import {
  restState, heldState, flightToTokenState, flightToPointState,
  advanceBall, ballPosition, settleBall,
} from '../../src/ui/ballFlight.js'

describe('ballFlight — 상태 전이', () => {
  test('flight는 duration 도달 시 held(수신자)로 전이한다', () => {
    let state = flightToTokenState({ left: 10, top: 10 }, 'zidane', 300)
    state = advanceBall(state, 200)
    expect(state.mode).toBe('flight')
    expect(state.elapsedMs).toBe(200)
    state = advanceBall(state, 150)
    expect(state).toEqual(heldState('zidane'))
  })

  test('flightToPoint는 duration 도달 시 rest(지점)로 전이한다', () => {
    let state = flightToPointState({ left: 50, top: 80 }, { left: 50, top: 98 }, 400)
    state = advanceBall(state, 400)
    expect(state.mode).toBe('rest')
    expect(state.pos).toEqual({ left: 50, top: 98 })
  })

  test('held/rest는 advance해도 그대로다', () => {
    expect(advanceBall(heldState('pele'), 999)).toEqual(heldState('pele'))
    const rest = restState({ left: 50, top: 50 })
    expect(advanceBall(rest, 999)).toEqual(rest)
  })
})

describe('ballFlight — 위치 계산 (호밍)', () => {
  test('held: 볼 위치 == 보유자 토큰의 실시간 위치', () => {
    const tokenPos = { pele: { left: 33, top: 44 } }
    const pos = ballPosition(heldState('pele'), (id) => tokenPos[id] ?? null)
    expect(pos).toEqual({ left: 33, top: 44 })
  })

  test('호밍: 수신자가 움직여도 t=1에 정확히 수신자 위치에 도착한다', () => {
    let state = flightToTokenState({ left: 0, top: 0 }, 'runner', 100)
    // 수신자가 매 스텝 이동하는 상황을 시뮬레이션
    let runnerPos = { left: 50, top: 50 }
    for (let i = 0; i < 10; i++) {
      state = advanceBall(state, 10)
      runnerPos = { left: runnerPos.left + 1, top: runnerPos.top - 0.5 }
    }
    // duration 정확히 소진 → held로 전이됨. held 위치 = 수신자의 "지금" 위치.
    expect(state.mode).toBe('held')
    const finalPos = ballPosition(state, () => runnerPos)
    expect(finalPos).toEqual(runnerPos)
  })

  test('비행 중간 위치는 출발점과 (움직이는) 목표 사이에 있다', () => {
    let state = flightToTokenState({ left: 0, top: 0 }, 'target', 100)
    state = advanceBall(state, 50)
    const pos = ballPosition(state, () => ({ left: 100, top: 0 }))
    expect(pos.left).toBeGreaterThan(0)
    expect(pos.left).toBeLessThan(100)
    expect(pos.top).toBe(0)
  })

  test('held인데 토큰 미해결이면 null — 임의 좌표를 지어내지 않는다', () => {
    expect(ballPosition(heldState('ghost'), () => null)).toBeNull()
  })
})

describe('ballFlight — settleBall (스킵)', () => {
  test('진행 중 비행을 보간 없이 최종 상태로 접는다', () => {
    const flight = flightToTokenState({ left: 0, top: 0 }, 'gk', 500)
    expect(settleBall(flight)).toEqual(heldState('gk'))
    const shot = flightToPointState({ left: 50, top: 80 }, { left: 50, top: 98 }, 500)
    expect(settleBall(shot)).toEqual(restState({ left: 50, top: 98 }))
    expect(settleBall(heldState('pele'))).toEqual(heldState('pele'))
  })
})
