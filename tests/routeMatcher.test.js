import { compileRoute, matchRoute, normalizeHash } from '../src/routeMatcher.js'

describe('normalizeHash', () => {
  test('빈 해시는 루트 경로로 정규화된다', () => {
    expect(normalizeHash('')).toBe('/')
    expect(normalizeHash('#')).toBe('/')
  })

  test('# 접두사를 제거한다', () => {
    expect(normalizeHash('#/squad/home')).toBe('/squad/home')
  })
})

describe('compileRoute + matchRoute', () => {
  test('정적 경로를 매칭한다', () => {
    const routes = [compileRoute('/match'), compileRoute('/result')]
    const matched = matchRoute(routes, '/match')
    expect(matched).not.toBeNull()
    expect(matched.route.pattern).toBe('/match')
    expect(matched.params).toEqual({})
  })

  test('파라미터가 있는 경로를 매칭하고 params를 추출한다', () => {
    const routes = [compileRoute('/squad/:side')]
    const matched = matchRoute(routes, '/squad/home')
    expect(matched).not.toBeNull()
    expect(matched.params).toEqual({ side: 'home' })
  })

  test('매칭되지 않으면 null을 반환한다', () => {
    const routes = [compileRoute('/squad/:side')]
    expect(matchRoute(routes, '/unknown')).toBeNull()
  })

  test('여러 라우트 중 먼저 일치하는 라우트를 반환한다', () => {
    const routes = [compileRoute('/tactics/:side'), compileRoute('/match')]
    expect(matchRoute(routes, '/match')).not.toBeNull()
    expect(matchRoute(routes, '/tactics/away').params).toEqual({ side: 'away' })
  })
})
