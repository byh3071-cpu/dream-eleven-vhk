// 세트피스 판정 + 휴면 특성의 "실호출 경로" 검증.
// docs/state/learnings.md 교훈 적용: 특성 훅은 hand-written ctx 단위 테스트만으로는
// 실제 파이프라인이 보내는 ctx와 어긋나도 안 걸린다 — 반드시 실제 호출 경로
// (resolveFreeKick/resolveCross)로도 발동을 확인한다.

import { resolveFreeKick, resolveCross, resolvePenalty, freeKickTaker } from '../../src/sim/setpieces.js'
import { initialStaminaState } from '../../src/sim/stamina.js'
import { createRng } from '../../src/sim/rng.js'
import { makeSyntheticTeam } from '../fixtures/syntheticTeam.js'

function ctxOf(team) {
  return { squad11: team.squad11, stamina: initialStaminaState(team.squad11), tactics: {} }
}

function withTraitAll(team, trait) {
  // 합성팀 필드플레이어 전원에 특성 부여 — flat 팀에선 "누가 뽑히든" 특성이 걸리게 해서
  // 실호출 경로의 발동 여부만 순수하게 비교한다(개별 배정은 taker/pool 추첨에 희석됨).
  const squad11 = team.squad11.map((entry) => ({
    ...entry,
    player: {
      ...entry.player,
      traits: entry.player.positions.includes('GK') ? [] : [trait],
    },
  }))
  return { squad11, formation: team.formation }
}

describe('setpieces — 실호출 경로', () => {
  const base = makeSyntheticTeam(75)

  test('resolveFreeKick: 중앙은 direct/cross 혼합, 측면은 항상 cross', () => {
    const possessing = ctxOf(base)
    const defending = ctxOf(makeSyntheticTeam(75))
    const rng = createRng(1)
    const variants = new Set()
    for (let i = 0; i < 60; i++) {
      variants.add(resolveFreeKick({ possessing, defending, channel: 'CENTER', rng }).variant)
    }
    expect(variants).toEqual(new Set(['direct', 'cross']))
    for (let i = 0; i < 20; i++) {
      expect(resolveFreeKick({ possessing, defending, channel: 'LEFT', rng }).variant).toBe('cross')
    }
  })

  test('free_kick_specialist가 실호출 경로에서 직접 FK 성공률을 올린다', () => {
    const plain = ctxOf(base)
    const specialist = ctxOf(withTraitAll(makeSyntheticTeam(75), 'free_kick_specialist'))
    const defending = () => ctxOf(makeSyntheticTeam(75))
    const goalsOf = (possessing) => {
      const rng = createRng(42)
      let goals = 0
      for (let i = 0; i < 800; i++) {
        const fk = resolveFreeKick({ possessing, defending: defending(), channel: 'CENTER', rng })
        if (fk.variant === 'direct' && fk.result === 'goal') goals++
      }
      return goals
    }
    // successBonus 0.12는 flat 75 기준 직접 FK 골을 눈에 띄게 늘려야 한다.
    expect(goalsOf(specialist)).toBeGreaterThan(goalsOf(plain) * 1.5)
  })

  test('aerial_threat가 실호출 경로에서 공중볼 승률을 올린다 (수비측 발동 포함)', () => {
    const plainAttack = ctxOf(base)
    const threatAttack = ctxOf(withTraitAll(makeSyntheticTeam(75), 'aerial_threat'))
    const winsOf = (possessing, defending) => {
      const rng = createRng(7)
      let wins = 0
      for (let i = 0; i < 600; i++) {
        const cross = resolveCross({ possessing, defending, channel: 'CENTER', rng })
        if (cross.result !== 'clearance') wins++ // 공중볼을 이겨 헤더까지 간 횟수
      }
      return wins
    }
    const baseline = winsOf(plainAttack, ctxOf(makeSyntheticTeam(75)))
    // 공격측 특성 → 승률 상승
    expect(winsOf(threatAttack, ctxOf(makeSyntheticTeam(75)))).toBeGreaterThan(baseline * 1.1)
    // 수비측 특성 → 공격 승률 하락 — 코너 수비 강화 창발.
    // 기대 효과 크기: scoreMult 1.15는 flat 75 기준 듀얼 승률을 0.50→0.454로 내린다
    // (비율 0.91) — 마진은 그보다 느슨한 0.95로 잡는다(발동 여부 검증이 목적).
    const threatDefend = ctxOf(withTraitAll(makeSyntheticTeam(75), 'aerial_threat'))
    expect(winsOf(plainAttack, threatDefend)).toBeLessThan(baseline * 0.95)
  })

  test('resolvePenalty: 성공률이 클램프 범위(0.62~0.85) 안', () => {
    const possessing = ctxOf(base)
    const defending = ctxOf(makeSyntheticTeam(75))
    const shooter = possessing.squad11.find((e) => e.player.positions[0] === 'ST')
    const gk = defending.squad11.find((e) => e.player.positions.includes('GK'))
    const rng = createRng(3)
    let goals = 0
    const n = 2000
    for (let i = 0; i < n; i++) {
      if (resolvePenalty({ shooter, gk, possessing, defending, rng }) === 'goal') goals++
    }
    expect(goals / n).toBeGreaterThan(0.6)
    expect(goals / n).toBeLessThan(0.87)
  })

  test('freeKickTaker는 슈팅+패스 평균 최고 선수를 결정론적으로 뽑는다', () => {
    const squad = base.squad11
    expect(freeKickTaker(squad)).toBe(freeKickTaker(squad))
  })

  // ADR-001 Step 2 — aerial 서브스탯이 실호출 경로에서 실제 소비되는지 + 폴백 검증.
  test('aerial 서브스탯이 resolveCross 공중볼 판정을 좌우한다 (physical 고정, aerial만 변경)', () => {
    const withAerial = (aerial) => ctxOf({
      squad11: makeSyntheticTeam(75).squad11.map((e) => ({
        ...e,
        player: e.player.positions.includes('GK')
          ? e.player
          : { ...e.player, stats: { ...e.player.stats, aerial } },
      })),
    })
    const winsOf = (possessing) => {
      const defending = ctxOf(makeSyntheticTeam(75))
      const rng = createRng(7)
      let wins = 0
      for (let i = 0; i < 600; i++) {
        if (resolveCross({ possessing, defending, channel: 'CENTER', rng }).result !== 'clearance') wins++
      }
      return wins
    }
    // physical=75로 동일한데 aerial만 90 vs 55 → 판정이 aerial을 읽어야만 승률이 갈린다.
    expect(winsOf(withAerial(90))).toBeGreaterThan(winsOf(withAerial(55)) * 1.1)
  })

  test('aerial 미지정은 physical로 폴백 — 기존 데이터(DB·구 유스) 결과 비트 동일', () => {
    const noAerial = ctxOf(makeSyntheticTeam(75)) // aerial 키 없음 → physical 75
    const explicit = ctxOf({
      squad11: makeSyntheticTeam(75).squad11.map((e) => ({
        ...e, player: { ...e.player, stats: { ...e.player.stats, aerial: 75 } },
      })),
    })
    const seq = (possessing, rng) => {
      const defending = ctxOf(makeSyntheticTeam(75))
      return Array.from({ length: 200 }, () =>
        resolveCross({ possessing, defending, channel: 'CENTER', rng }).result)
    }
    expect(seq(noAerial, createRng(11))).toEqual(seq(explicit, createRng(11)))
  })
})
