import {
  ROUTE_PATTERNS, homePath, ifSquadPath, ifTacticsPath, ifMatchPath, ifResultPath,
  styleguidePath, careerPath,
} from '../src/routes.js'
import { compileRoute, matchRoute, normalizeHash } from '../src/routeMatcher.js'

describe('routes — 빌더와 패턴의 정합', () => {
  test('빌더가 만든 경로는 대응 패턴에 매치된다', () => {
    const compiled = Object.values(ROUTE_PATTERNS).map(compileRoute)
    const cases = [
      [ifSquadPath('home'), ROUTE_PATTERNS.ifSquad],
      [ifSquadPath('away'), ROUTE_PATTERNS.ifSquad],
      [ifTacticsPath('home'), ROUTE_PATTERNS.ifTactics],
      [ifMatchPath(), ROUTE_PATTERNS.ifMatch],
      [ifResultPath(), ROUTE_PATTERNS.ifResult],
      [homePath(), ROUTE_PATTERNS.home],
      [styleguidePath(), ROUTE_PATTERNS.styleguide],
    ]
    for (const [path, expectedPattern] of cases) {
      const matched = matchRoute(compiled, normalizeHash('#' + path))
      expect(matched).not.toBeNull()
      expect(matched.route.pattern).toBe(expectedPattern)
    }
  })

  test('side 파라미터가 그대로 추출된다', () => {
    const compiled = [compileRoute(ROUTE_PATTERNS.ifSquad)]
    const matched = matchRoute(compiled, ifSquadPath('away'))
    expect(matched.params).toEqual({ side: 'away' })
  })

  test('v1 시절 경로(/squad/home 등)는 더 이상 어떤 패턴에도 안 걸린다', () => {
    const compiled = Object.values(ROUTE_PATTERNS).map(compileRoute)
    for (const legacy of ['/squad/home', '/tactics/away', '/match', '/result']) {
      expect(matchRoute(compiled, legacy)).toBeNull()
    }
  })

  test('careerPath는 N3 예약 — 아직 패턴 테이블에 없다', () => {
    expect(careerPath()).toBe('/career')
    expect(Object.values(ROUTE_PATTERNS)).not.toContain('/career')
  })
})
