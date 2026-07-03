import { simulateMatch } from '../../src/sim/engine.js'
import { makeSyntheticTeam } from '../fixtures/syntheticTeam.js'
import { makeSkewedTeam } from '../fixtures/skewedTeam.js'

// Goal 3 회귀 테스트 (goals/3-tactics.md):
//   1) 지침 값을 바꾸면 Goal 2 몬테카를로 결과 분포(평균 득점/승률/이벤트 수)가
//      뚜렷하게 달라진다 — 아래 각 테스트의 마진은 실측값(주석 참고)에 여유를 두고 설정.
//   2) 극단적 지침 하나가 상대 무관하게 항상 우세하지 않는다(스탯 격차를 못 뒤집음).
// 팀 스탯 자체가 동일한 synthetic 팀끼리 비교해 "지침만의 효과"를 순수하게 검증한다.

function runSeriesForTeams(teamA, teamB, tacticsA, tacticsB, trials) {
  let winsA = 0
  let winsB = 0
  let draws = 0
  let totalGoals = 0
  let totalEvents = 0

  for (let seed = 0; seed < trials; seed++) {
    const result = simulateMatch({
      home: { squad11: teamA.squad11, formation: teamA.formation, tactics: tacticsA },
      away: { squad11: teamB.squad11, formation: teamB.formation, tactics: tacticsB },
      seed,
    })
    totalGoals += result.score.home + result.score.away
    totalEvents += result.events.length
    if (result.score.home > result.score.away) winsA++
    else if (result.score.home < result.score.away) winsB++
    else draws++
  }

  return {
    winsA, winsB, draws,
    avgGoals: totalGoals / trials,
    winRateA: winsA / trials,
    avgEvents: totalEvents / trials,
  }
}

function runSeries(ratingA, ratingB, tacticsA, tacticsB, trials) {
  return runSeriesForTeams(makeSyntheticTeam(ratingA), makeSyntheticTeam(ratingB), tacticsA, tacticsB, trials)
}

describe('전술 지침 회귀 테스트 (Goal 3 — goals/3-tactics.md)', () => {
  const TRIALS = 200

  test('압박 강도: 풀압박 팀이 로우블록 상대보다 승률이 뚜렷하게 높다 (동일 스탯 75v75)', () => {
    const pressed = runSeries(75, 75, { pressing: 1.0 }, { pressing: 0.0 }, TRIALS)
    const neutral = runSeries(75, 75, {}, {}, TRIALS)
    console.log(`[압박] 풀압박=${(pressed.winRateA * 100).toFixed(1)}% vs 중립=${(neutral.winRateA * 100).toFixed(1)}%`)
    // 실측: 풀압박 47.0% vs 중립 39.0% (마진 4pt 확보)
    expect(pressed.winRateA).toBeGreaterThan(neutral.winRateA + 0.04)
  })

  test('멘탈리티: 공격적일수록 평균 득점이 늘고 수비적일수록 준다 (동일 스탯 75v75)', () => {
    const attacking = runSeries(75, 75, { mentality: 2 }, { mentality: 0 }, TRIALS)
    const defensive = runSeries(75, 75, { mentality: -2 }, { mentality: 0 }, TRIALS)
    console.log(`[멘탈리티] 공격몰빵 평균득점=${attacking.avgGoals.toFixed(2)} vs 수비몰빵 평균득점=${defensive.avgGoals.toFixed(2)}`)
    // 실측: 공격몰빵 3.07골 vs 수비몰빵 2.67골 (격차 0.40, 마진 0.25 확보)
    expect(attacking.avgGoals).toBeGreaterThan(defensive.avgGoals + 0.25)
    expect(attacking.winRateA).toBeGreaterThan(defensive.winRateA)
  })

  test('템포: 빠를수록 90분간 포제션 체인(이벤트) 수가 뚜렷하게 늘어난다 (양팀 동일 템포)', () => {
    const fast = runSeries(75, 75, { tempo: 1.0 }, { tempo: 1.0 }, TRIALS)
    const slow = runSeries(75, 75, { tempo: 0.0 }, { tempo: 0.0 }, TRIALS)
    console.log(`[템포] 빠름=${fast.avgEvents.toFixed(1)}건 vs 느림=${slow.avgEvents.toFixed(1)}건`)
    // 실측(M8 볼경로 확장 후 — 체인당 progression 경유 이벤트가 딸려서 건수 자체가 전반적으로
    // 늘어났다): 빠름 112.3건 vs 느림 91.8건 (격차 20.5, 마진 3.0은 그대로 여유 있게 통과)
    expect(fast.avgEvents).toBeGreaterThan(slow.avgEvents + 3)
  })

  test('폭: 측면 자원이 강한 팀은 좁게보다 넓게 설정했을 때 더 유리하다', () => {
    // width는 채널 선택을 바꿔서 pickActor 풀 구성(어떤 포지션이 뽑히는지)을 바꾸는
    // 방식이라 syntheticTeam(flat 스탯)으로는 검증 불가 — 채널이 바뀌어도 풀 안 선수
    // 스탯이 다 똑같으면 결과가 항상 같다. 측면/중앙 스탯을 갈라놓은 skewedTeam으로만
    // 드러난다. 효과 크기 자체는 멘탈리티/압박/템포보다 작다(듀얼당 4자리 풀 중 1자리만
    // 바뀌는 구조라서) — 그래도 방향이 일관되고 N을 올릴수록 더 뚜렷해지므로 장식용은 아니다.
    const wideStrong = makeSkewedTeam(99, 50) // 평균 67.8 — 아래 opponent와 전체 전력은 비슷
    const opponent = makeSyntheticTeam(68)
    const wide = runSeriesForTeams(wideStrong, opponent, { width: 1.0 }, {}, 400)
    const narrow = runSeriesForTeams(wideStrong, opponent, { width: 0.0 }, {}, 400)
    console.log(`[폭] 넓게=${(wide.winRateA * 100).toFixed(1)}% vs 좁게=${(narrow.winRateA * 100).toFixed(1)}%`)
    // 실측: 넓게 26.1% vs 좁게 21.1% (격차 5.0pt, 마진 2.0pt 확보)
    expect(wide.winRateA).toBeGreaterThan(narrow.winRateA + 0.02)
  })

  test('회귀: 극단적 지침을 전부 몰아줘도 큰 스탯 격차(25점)는 못 뒤집는다', () => {
    const result = runSeries(60, 85, { mentality: 2, pressing: 1.0, tempo: 1.0 }, {}, TRIALS)
    console.log(`[회귀] 약팀(60,전술올인) vs 강팀(85,중립) 승률=${(result.winRateA * 100).toFixed(1)}%`)
    // 실측: 17.0% (60~75% 게이트로 검증된 "확실히 강팀 우세" 범위 안에 여전히 남음)
    expect(result.winRateA).toBeLessThan(0.35)
  })

  test('지침을 안 주면(undefined) tactics: {} 와 완전히 동일하게 동작한다 (하위호환)', () => {
    const withEmptyTactics = runSeries(75, 75, {}, {}, TRIALS)
    const withUndefinedTactics = runSeries(75, 75, undefined, undefined, TRIALS)
    expect(withUndefinedTactics).toEqual(withEmptyTactics)
  })
})
