import { initialStaminaState, decayStamina, staminaFactor } from '../../src/sim/stamina.js'

function makeSquad(players) {
  return players.map((player) => ({ player, slotIndex: 0 }))
}

describe('stamina', () => {
  test('초기 스태미나는 전원 100이다', () => {
    const squad = makeSquad([{ id: 'a', traits: [] }, { id: 'b', traits: [] }])
    const state = initialStaminaState(squad)
    expect(state.a).toBe(100)
    expect(state.b).toBe(100)
  })

  test('시간이 지날수록 스태미나가 감소한다', () => {
    const squad = makeSquad([{ id: 'a', traits: [] }])
    const state = initialStaminaState(squad)
    decayStamina(state, squad, 45, 0.5)
    expect(state.a).toBeLessThan(100)
    expect(state.a).toBeGreaterThan(0)
  })

  test('veteran_declining 특성을 가진 선수는 더 빨리 지친다', () => {
    const squad = makeSquad([
      { id: 'young', traits: [] },
      { id: 'veteran', traits: ['veteran_declining'] },
    ])
    const state = initialStaminaState(squad)
    decayStamina(state, squad, 45, 0.5)
    expect(state.veteran).toBeLessThan(state.young)
  })

  test('압박강도가 높을수록 스태미나 소모가 크다', () => {
    const squadLow = makeSquad([{ id: 'a', traits: [] }])
    const squadHigh = makeSquad([{ id: 'a', traits: [] }])
    const stateLow = initialStaminaState(squadLow)
    const stateHigh = initialStaminaState(squadHigh)
    decayStamina(stateLow, squadLow, 45, 0.1)
    decayStamina(stateHigh, squadHigh, 45, 0.9)
    expect(stateHigh.a).toBeLessThan(stateLow.a)
  })

  test('staminaFactor는 최소 배율(0.55) 밑으로 내려가지 않는다', () => {
    const squad = makeSquad([{ id: 'a', traits: [] }])
    const state = initialStaminaState(squad)
    decayStamina(state, squad, 9999, 1)
    expect(state.a).toBe(0)
    expect(staminaFactor(state, 'a')).toBeCloseTo(0.55)
  })

  test('스태미나 100이면 staminaFactor는 1.0', () => {
    const state = { a: 100 }
    expect(staminaFactor(state, 'a')).toBeCloseTo(1.0)
  })
})
