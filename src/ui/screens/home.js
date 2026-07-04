// 홈(/) = 모드 선택. v2 듀얼 모드의 진입점 — IF 매치(드림매치 단판)와 커리어(감독 모드).
// 커리어 타일은 N3 전까지 disabled로 정보 구조만 먼저 확정해둔다(활성화 시 화면 개편 없이
// 기능만 꽂기 위함). 세이브가 생기면 라벨이 "이어하기"로 바뀌는 것도 N3에서.

import { navigate } from '../../router.js'
import { ifSquadPath, ifMatchPath, careerPath } from '../../routes.js'
import { randomFillBothSquads } from './squadBuilder.js'

function modeTile({ title, description, cta, disabled, onStart, secondary }) {
  const tile = document.createElement('div')
  tile.className = 'home__tile' + (disabled ? ' home__tile--disabled' : '')

  const heading = document.createElement('h2')
  heading.className = 'home__tile-title'
  heading.textContent = title

  const desc = document.createElement('p')
  desc.className = 'home__tile-desc'
  desc.textContent = description

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'chip' + (disabled ? '' : ' chip--active')
  button.textContent = cta
  button.disabled = Boolean(disabled)
  if (!disabled) button.addEventListener('click', onStart)

  const actions = document.createElement('div')
  actions.className = 'home__tile-actions'
  actions.appendChild(button)
  if (secondary && !disabled) {
    const secBtn = document.createElement('button')
    secBtn.type = 'button'
    secBtn.className = 'chip'
    secBtn.textContent = secondary.cta
    secBtn.addEventListener('click', secondary.onStart)
    actions.appendChild(secBtn)
  }

  tile.append(heading, desc, actions)
  return tile
}

export function renderHome(mountEl) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--home'

  const title = document.createElement('h1')
  title.className = 'home__title'
  title.textContent = 'Dream Eleven'

  const subtitle = document.createElement('p')
  subtitle.className = 'home__subtitle'
  subtitle.textContent = '레전드와 현역 선수로 베스트 일레븐을 구성하고, 감독처럼 전술을 지시해보세요.'

  const tiles = document.createElement('div')
  tiles.className = 'home__tiles'
  tiles.append(
    modeTile({
      title: 'IF 매치',
      description: '"펠레와 마라도나가 한 팀이라면?" — 양 팀을 직접 짜서 붙이는 드림매치 단판 시뮬레이션.',
      cta: '새 경기 시작',
      onStart: () => navigate(ifSquadPath('home')),
      secondary: {
        cta: '🎲 랜덤으로 바로 시작',
        onStart: () => { randomFillBothSquads(); navigate(ifMatchPath()) },
      },
    }),
    modeTile({
      title: '커리어',
      description: '가상 리그 4구단이 레전드 풀을 드래프트 — 한 시즌을 지휘하는 감독 모드.',
      cta: '커리어 시작',
      onStart: () => navigate(careerPath()),
    }),
  )

  screen.append(title, subtitle, tiles)
  mountEl.appendChild(screen)
}
