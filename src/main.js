import { registerRoute, startRouter, navigate } from './router.js'
import { renderSquadBuilder } from './ui/screens/squadBuilder.js'
import { renderTactics } from './ui/screens/tactics.js'
import { renderMatch } from './ui/screens/match.js'

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

function renderPlaceholder(label) {
  return (mountEl, params) => {
    const screen = document.createElement('div')
    screen.className = 'screen'
    const heading = document.createElement('h2')
    heading.textContent = `${label} (준비 중)`
    screen.appendChild(heading)
    if (params && Object.keys(params).length > 0) {
      const info = document.createElement('p')
      info.style.color = 'var(--text-dim)'
      info.textContent = JSON.stringify(params)
      screen.appendChild(info)
    }
    mountEl.appendChild(screen)
  }
}

registerRoute('/', renderHome)
registerRoute('/squad/:side', renderSquadBuilder)
registerRoute('/tactics/:side', renderTactics)
registerRoute('/match', renderMatch)
registerRoute('/result', renderPlaceholder('결과'))

startRouter(document.getElementById('app'))
