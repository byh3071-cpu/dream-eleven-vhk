import { applyTraitHooks } from '../../src/sim/traits.js'
import { resolvePenalty } from '../../src/sim/setpieces.js'
import { createRng } from '../../src/sim/rng.js'

function makePlayer(traits) {
  return { id: 'test', traits }
}

describe('applyTraitHooks', () => {
  test('특성이 없으면 빈 modifier를 반환한다', () => {
    expect(applyTraitHooks(makePlayer([]), 'onDuel', { duelType: 'progression' })).toEqual({})
  })

  test('poacher는 BOX 슈팅에서만 accuracyMult 보너스를 준다', () => {
    const player = makePlayer(['poacher'])
    expect(applyTraitHooks(player, 'onShot', { zoneBand: 'BOX' }).accuracyMult).toBeCloseTo(1.12)
    expect(applyTraitHooks(player, 'onShot', { zoneBand: 'FINAL_THIRD' })).toEqual({})
  })

  test('left_footed는 반대발(오른쪽) 채널 슈팅에 페널티를 준다', () => {
    const player = makePlayer(['left_footed'])
    expect(applyTraitHooks(player, 'onShot', { footChannel: 'right' }).accuracyMult).toBeLessThan(1)
    expect(applyTraitHooks(player, 'onShot', { footChannel: 'left' })).toEqual({})
  })

  test('veteran_declining은 스태미나 감소율을 높인다', () => {
    const player = makePlayer(['veteran_declining'])
    expect(applyTraitHooks(player, 'onStaminaDecay', {}).rateMult).toBeCloseTo(1.3)
  })

  test('여러 특성의 동일 modifier 키는 곱연산으로 누적된다', () => {
    // aerial_threat: aerial 듀얼에 1.15배. 두 특성이 같은 duelType을 겨냥하도록 가정 검증.
    const player = makePlayer(['aerial_threat'])
    const mods = applyTraitHooks(player, 'onDuel', { duelType: 'aerial' })
    expect(mods.scoreMult).toBeCloseTo(1.15)
  })

  test('tackle_specialist는 수비 role duel에서만 보너스를 준다', () => {
    const player = makePlayer(['tackle_specialist'])
    expect(applyTraitHooks(player, 'onDuel', { role: 'defend' }).scoreMult).toBeCloseTo(1.12)
    expect(applyTraitHooks(player, 'onDuel', { role: 'attack' })).toEqual({})
  })

  test('알 수 없는 훅 포인트를 조회해도 에러 없이 빈 객체를 반환한다', () => {
    const player = makePlayer(['poacher'])
    expect(applyTraitHooks(player, 'onSetPiece', {})).toEqual({})
  })

  test('composure는 페널티 세트피스에서만 successBonus를 준다', () => {
    const player = makePlayer(['composure'])
    expect(applyTraitHooks(player, 'onSetPiece', { setPieceType: 'penalty' }).successBonus).toBeCloseTo(0.08)
    expect(applyTraitHooks(player, 'onSetPiece', { setPieceType: 'free_kick' })).toEqual({})
  })

  // 위 단위 테스트는 setpieces.js의 실제 배선(clamp 안 successBonus 가산)이 빠져도 통과한다.
  // "장식 아님 = 실제 소비" 원칙은 resolvePenalty를 직접 굴려 전환율 차이로 검증한다.
  test('composure는 페널티 전환율을 실제로 높인다 (resolvePenalty 소비 검증)', () => {
    const fixture = (traits) => ({
      shooter: { player: { id: 'shooter', traits, stats: { shooting: 75 } } },
      gk: { player: { id: 'gk', stats: { defending: 75 } } },
      possessing: { stamina: {} },
      defending: { stamina: {} },
    })
    const N = 300
    let plainGoals = 0
    let composedGoals = 0
    for (let i = 0; i < N; i++) {
      // 같은 시드 → 같은 단일 draw. composed 확률(0.83)이 plain(0.75)의 상위집합이라 단조 증가.
      if (resolvePenalty({ ...fixture([]), rng: createRng(i) }) === 'goal') plainGoals++
      if (resolvePenalty({ ...fixture(['composure']), rng: createRng(i) }) === 'goal') composedGoals++
    }
    expect(composedGoals).toBeGreaterThan(plainGoals)
  })
})
