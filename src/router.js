import { compileRoute, matchRoute, normalizeHash } from './routeMatcher.js'

const routes = []
const renderers = new Map()

export function registerRoute(pattern, render) {
  const compiled = compileRoute(pattern)
  routes.push(compiled)
  renderers.set(compiled, render)
}

export function navigate(path) {
  window.location.hash = path
}

function renderCurrent(mountEl) {
  const path = normalizeHash(window.location.hash)
  const matched = matchRoute(routes, path)
  mountEl.replaceChildren()
  if (!matched) {
    const screen = document.createElement('div')
    screen.className = 'screen'
    const message = document.createElement('p')
    message.textContent = `페이지를 찾을 수 없습니다: ${path}`
    screen.appendChild(message)
    mountEl.appendChild(screen)
    return
  }
  const render = renderers.get(matched.route)
  render(mountEl, matched.params)
}

export function startRouter(mountEl) {
  window.addEventListener('hashchange', () => renderCurrent(mountEl))
  renderCurrent(mountEl)
}
