// N2 리얼리즘 게이트 — 새 이벤트(파울/카드/코너/오프사이드/PK)의 경기당 빈도가
// 실제 축구 통계 범위에 들어야 한다. 몬테카를로 게이트(승부 분포)와 함께 N2의 계약.
//
// 코너 하한이 실제 축구(8~12)보다 낮은 [5,11]인 이유(정직한 문서화): 이 체인 모델에는
// "크로스가 중간에 차단돼 나가는" 류의 코너 생성원이 없어서 슛 블록/걷어내기 두 경로만
// 코너를 만든다 — 하한은 모델이 실제로 낼 수 있는 값으로 잡고, 생성원이 늘면 올린다.

import { simulateMatch } from '../../src/sim/engine.js'
import { makeSyntheticTeam } from '../fixtures/syntheticTeam.js'

const TRIALS = 300

function measure() {
  const teamA = makeSyntheticTeam(75)
  const teamB = makeSyntheticTeam(75)
  const totals = { fouls: 0, yellows: 0, reds: 0, corners: 0, offsides: 0, pks: 0, fkGoals: 0 }
  for (let seed = 0; seed < TRIALS; seed++) {
    const r = simulateMatch({
      home: { squad11: teamA.squad11, formation: teamA.formation, tactics: {} },
      away: { squad11: teamB.squad11, formation: teamB.formation, tactics: {} },
      seed,
    })
    for (const side of ['A', 'B']) {
      totals.fouls += r.stats[side].fouls
      totals.yellows += r.stats[side].yellows
      totals.reds += r.stats[side].reds
      totals.corners += r.stats[side].corners
      totals.offsides += r.stats[side].offsides
    }
    totals.pks += r.events.filter((e) => e.type === 'penalty_awarded').length
    totals.fkGoals += r.events.filter((e) => e.type === 'goal' && e.via === 'free_kick').length
  }
  return Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / TRIALS]))
}

describe('리얼리즘 게이트 (경기당 평균, 75v75 합성팀)', () => {
  const m = measure()

  test('파울 16~30', () => {
    console.log(`[리얼리즘] 파울 ${m.fouls.toFixed(1)} / 옐로 ${m.yellows.toFixed(2)} / 레드 ${m.reds.toFixed(3)} / 코너 ${m.corners.toFixed(1)} / 오프사이드 ${m.offsides.toFixed(2)} / PK ${m.pks.toFixed(2)} / FK직접골 ${m.fkGoals.toFixed(2)}`)
    expect(m.fouls).toBeGreaterThanOrEqual(16)
    expect(m.fouls).toBeLessThanOrEqual(30)
  })

  test('옐로카드 2~5', () => {
    expect(m.yellows).toBeGreaterThanOrEqual(2)
    expect(m.yellows).toBeLessThanOrEqual(5)
  })

  test('레드카드 0 초과 0.15 이하', () => {
    expect(m.reds).toBeGreaterThan(0)
    expect(m.reds).toBeLessThanOrEqual(0.15)
  })

  test('코너킥 5~11', () => {
    expect(m.corners).toBeGreaterThanOrEqual(5)
    expect(m.corners).toBeLessThanOrEqual(11)
  })

  test('오프사이드 1~4', () => {
    expect(m.offsides).toBeGreaterThanOrEqual(1)
    expect(m.offsides).toBeLessThanOrEqual(4)
  })

  test('페널티킥 0.1~0.5', () => {
    expect(m.pks).toBeGreaterThanOrEqual(0.1)
    expect(m.pks).toBeLessThanOrEqual(0.5)
  })

  test('직접 프리킥 골 < 0.3 (스페셜리스트 보너스 과대 감시)', () => {
    expect(m.fkGoals).toBeLessThan(0.3)
  })
})
