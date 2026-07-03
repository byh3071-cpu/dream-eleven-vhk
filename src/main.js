import { registerRoute, startRouter, navigate } from './router.js'
import { renderSquadBuilder } from './ui/screens/squadBuilder.js'
import { renderTactics } from './ui/screens/tactics.js'
import { renderMatch } from './ui/screens/match.js'
import { renderResult } from './ui/screens/result.js'
import { renderStyleguide } from './ui/screens/styleguide.js'

function renderHome(mountEl) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--home'

  const title = document.createElement('h1')
  title.textContent = 'Dream Eleven'

  const subtitle = document.createElement('p')
  subtitle.textContent = '레전드와 현역 선수로 베스트 일레븐을 구성하고, 감독처럼 전술을 지시해보세요.'
  subtitle.style.color = 'var(--text-dim)'

  const startButton = document.createElement('button')
  startButton.className = 'chip chip--active'
  startButton.textContent = '새 경기 시작'
  startButton.addEventListener('click', () => navigate('/squad/home'))

  screen.append(title, subtitle, startButton)
  mountEl.appendChild(screen)
}

registerRoute('/', renderHome)
registerRoute('/squad/:side', renderSquadBuilder)
registerRoute('/tactics/:side', renderTactics)
registerRoute('/match', renderMatch)
registerRoute('/result', renderResult)
// 개발 지그 — 모드 네임스페이스 밖 상시 노출(디자인 시스템 단일 소스 뷰)
registerRoute('/styleguide', renderStyleguide)

startRouter(document.getElementById('app'))
