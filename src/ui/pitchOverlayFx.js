// 피치 위 DOM 연출(miniPop/flash) — 2D/3D 백엔드가 문자 그대로 공유한다(goal 19 설계).
// DOM인 이유: 텍스트/색이 전부 CSS 토큰 체계(designLint 감시) 안에 있고,
// prefers-reduced-motion과 animationend 자가 제거 수명 관리가 CSS에 이미 있다.

import { createIcon } from './components/icons.js'

export function spawnMiniPop(hostEl, { text, pos, trait = false }) {
  const pop = document.createElement('div')
  pop.className = 'match__pop' + (trait ? ' match__pop--trait' : '')
  if (trait) pop.appendChild(createIcon('star', { size: 12 }))
  pop.appendChild(document.createTextNode(text))
  pop.style.left = `${pos.left}%`
  pop.style.top = `${pos.top}%`
  pop.addEventListener('animationend', () => pop.remove())
  hostEl.appendChild(pop)
}

export function spawnFlash(hostEl, { text, variant }) {
  const flash = document.createElement('div')
  flash.className = `match__flash match__flash--${variant}`
  flash.textContent = text
  flash.addEventListener('animationend', () => flash.remove())
  hostEl.appendChild(flash)
}
