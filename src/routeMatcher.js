export function compileRoute(pattern) {
  const paramNames = []
  const regexSrc = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1))
        return '([^/]+)'
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { pattern, paramNames, regex: new RegExp(`^${regexSrc}$`) }
}

export function matchRoute(compiledRoutes, path) {
  for (const route of compiledRoutes) {
    const match = path.match(route.regex)
    if (!match) continue
    const params = {}
    route.paramNames.forEach((name, i) => { params[name] = match[i + 1] })
    return { route, params }
  }
  return null
}

export function normalizeHash(hash) {
  const path = hash.replace(/^#/, '')
  return path === '' ? '/' : path
}
