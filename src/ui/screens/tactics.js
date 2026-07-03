// IF 감독 지침 셸 — /if/tactics/:side 공용. 컨트롤 마크업은 tacticsControls.js로
// 분리되어 커리어 전술 화면과 공유한다. side별 모듈 스코프 상태(세션 중 유지).

import { DEFAULT_TACTICS } from '../../sim/tactics-modifiers.js'
import { navigate } from '../../router.js'
import { ifSquadPath, ifMatchPath } from '../../routes.js'
import { renderMentalitySection, renderSliderSection, SLIDER_FIELDS } from '../tacticsControls.js'

const SIDE_LABEL = { home: '홈', away: '원정' }

const state = { home: { ...DEFAULT_TACTICS }, away: { ...DEFAULT_TACTICS } }

// match.js가 킥오프 전에 읽는 진입점 — squadBuilder.js의 getSquadState와 같은 패턴.
export function getTacticsState(side) {
  return { ...state[side] }
}

export function renderTactics(mountEl, params) {
  const side = params.side === 'away' ? 'away' : 'home'
  const sideState = state[side]

  const fullRerender = () => {
    mountEl.replaceChildren()
    renderTactics(mountEl, params)
  }

  const screen = document.createElement('div')
  screen.className = 'screen screen--tactics'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = `감독 지침 — ${SIDE_LABEL[side]}`
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'link-button'
  back.textContent = '← 스쿼드로 돌아가기'
  back.addEventListener('click', () => navigate(ifSquadPath(side)))
  topbar.append(title, back)

  const body = document.createElement('div')
  body.className = 'tactics__body'
  body.appendChild(renderMentalitySection(sideState.mentality, (value) => {
    sideState.mentality = value
    fullRerender()
  }))
  for (const field of SLIDER_FIELDS) {
    body.appendChild(renderSliderSection(field, sideState[field.key], (v) => {
      sideState[field.key] = v
    }))
  }

  // 홈 지침 다음엔 원정 스쿼드로, 원정 지침 다음엔 바로 경기로 — 이 버튼이 없으면
  // 홈 팀을 다 구성한 사용자가 원정 팀으로 갈 방법이 없다(실제 플레이스루 실측).
  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'chip chip--active'
  if (side === 'home') {
    nextBtn.textContent = '다음: 원정 스쿼드 구성 →'
    nextBtn.addEventListener('click', () => navigate(ifSquadPath('away')))
  } else {
    nextBtn.textContent = '경기 시작 →'
    nextBtn.addEventListener('click', () => navigate(ifMatchPath()))
  }
  body.appendChild(nextBtn)

  screen.append(topbar, body)
  mountEl.appendChild(screen)
}
