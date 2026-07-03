// N2 튜닝 스윕 — TUNABLES 그리드를 돌려 몬테카를로 게이트(득점/승률) + 리얼리즘
// 게이트(파울/카드/코너/오프사이드/PK 빈도)를 동시 만족하는 셀을 찾는다.
// 의존성 0 (node + 프로젝트 소스만). 사용: node scripts/tune-v2.mjs [trials=120]
//
// 원칙(레포 관례): 민감도 상수(CREATE/FINISH_DIVISOR)는 스윕 대상에서 제외 —
// 기본 난이도/분기 확률부터 조절한다. 확정값은 tunables.js에 실측과 함께 기록.

import { simulateMatch } from '../src/sim/engine.js'
import { TUNABLES } from '../src/sim/tunables.js'
import { makeSyntheticTeam } from '../tests/fixtures/syntheticTeam.js'

const TRIALS = Number(process.argv[2] ?? 120)

function runSeries(ratingA, ratingB, trials) {
  const teamA = makeSyntheticTeam(ratingA)
  const teamB = makeSyntheticTeam(ratingB)
  let winsA = 0
  let goals = 0
  const realism = { fouls: 0, yellows: 0, reds: 0, corners: 0, offsides: 0, pks: 0 }
  for (let seed = 0; seed < trials; seed++) {
    const r = simulateMatch({
      home: { squad11: teamA.squad11, formation: teamA.formation, tactics: {} },
      away: { squad11: teamB.squad11, formation: teamB.formation, tactics: {} },
      seed,
    })
    goals += r.score.home + r.score.away
    if (r.score.home > r.score.away) winsA++
    realism.fouls += r.stats.A.fouls + r.stats.B.fouls
    realism.yellows += r.stats.A.yellows + r.stats.B.yellows
    realism.reds += r.stats.A.reds + r.stats.B.reds
    realism.corners += r.stats.A.corners + r.stats.B.corners
    realism.offsides += r.stats.A.offsides + r.stats.B.offsides
    realism.pks += r.events.filter((e) => e.type === 'penalty_awarded').length
  }
  return {
    avgGoals: goals / trials,
    winRateA: winsA / trials,
    perMatch: Object.fromEntries(Object.entries(realism).map(([k, v]) => [k, v / trials])),
  }
}

// 2차 스윕(좁힘): 1차 48셀 결과에서 파울/레드/코너 게이트 실패 원인을 모델 수정
// (SECOND_YELLOW_FACTOR)과 기준값(FOUL_BASE 0.28, P_FAIL_CORNER 0.14)으로 반영한 뒤
// 남은 축만 재탐색.
const GRID = {
  FINISH_BASELINE_SCALE: [0.40, 0.44, 0.48],
  P_BLOCKED_CORNER: [0.24, 0.28],
  FOUL_BASE_CHANCE: [0.26, 0.30],
  SECOND_YELLOW_FACTOR: [0.2, 0.3],
}

function* cells(grid) {
  const keys = Object.keys(grid)
  const idx = keys.map(() => 0)
  while (true) {
    yield Object.fromEntries(keys.map((k, i) => [k, grid[k][idx[i]]]))
    let d = keys.length - 1
    while (d >= 0) {
      idx[d]++
      if (idx[d] < grid[keys[d]].length) break
      idx[d] = 0
      d--
    }
    if (d < 0) return
  }
}

function inRange(value, min, max) {
  return value >= min && value <= max
}

const results = []
for (const cell of cells(GRID)) {
  Object.assign(TUNABLES, cell)
  const even = runSeries(75, 75, TRIALS)
  const skew = runSeries(90, 65, TRIALS)
  const m = even.perMatch
  const gates = {
    goals: inRange(even.avgGoals, 2.5, 3.0),
    winRate: inRange(skew.winRateA, 0.60, 0.75),
    fouls: inRange(m.fouls, 16, 30),
    yellows: inRange(m.yellows, 2, 5),
    reds: m.reds > 0 && m.reds <= 0.15,
    corners: inRange(m.corners, 5, 11),
    offsides: inRange(m.offsides, 1, 4),
    pks: inRange(m.pks, 0.1, 0.5),
  }
  const passCount = Object.values(gates).filter(Boolean).length
  const allPass = passCount === Object.keys(gates).length
  // 통과 셀 중 목표 중심값(득점 2.75, 승률 0.68) 근접도로 순위
  const distance = Math.abs(even.avgGoals - 2.75) / 0.25 + Math.abs(skew.winRateA - 0.68) / 0.08
  results.push({ cell, even, skew, gates, passCount, allPass, distance })
  const mark = allPass ? '✅' : `(${passCount}/8)`
  console.log(`${mark} FBS=${cell.FINISH_BASELINE_SCALE} Pbc=${cell.P_BLOCKED_CORNER} Poff=${cell.P_OFFSIDE} AD=${cell.AERIAL_DIVISOR} HS=${cell.HEADER_SCALE}`
    + ` | 득점 ${even.avgGoals.toFixed(2)} 승률 ${(skew.winRateA * 100).toFixed(1)}%`
    + ` | 파울 ${m.fouls.toFixed(1)} 옐로 ${m.yellows.toFixed(2)} 레드 ${m.reds.toFixed(3)} 코너 ${m.corners.toFixed(1)} 오프 ${m.offsides.toFixed(2)} PK ${m.pks.toFixed(2)}`)
}

const passing = results.filter((r) => r.allPass).sort((a, b) => a.distance - b.distance)
console.log(`\n통과 셀: ${passing.length}/${results.length}`)
if (passing.length > 0) {
  console.log('추천(중심값 최근접):', JSON.stringify(passing[0].cell))
} else {
  const best = results.sort((a, b) => b.passCount - a.passCount || a.distance - b.distance)[0]
  console.log('전패 — 최다 통과 셀:', JSON.stringify(best.cell), '게이트:', JSON.stringify(best.gates))
}
