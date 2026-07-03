// IF 매치 관전 셸 — 스쿼드 빌더/감독 지침 상태를 읽어 simulateMatch를 돌리고,
// 재생은 공용 계층(matchPlayback.js)에 위임한다. 커리어 매치데이와 재생 코드를 공유.

import { getSquadState } from './squadBuilder.js'
import { getTacticsState } from './tactics.js'
import { findPlayer } from '../../data/players.db.js'
import { simulateMatch } from '../../sim/engine.js'
import { navigate } from '../../router.js'
import { homePath, ifSquadPath, ifResultPath } from '../../routes.js'
import { clearActivePlayback, buildPlaybackView } from '../matchPlayback.js'

const SIDE_LABEL = { home: '홈', away: '원정' }

// result.js가 읽는 진입점 — 재생 완료 여부와 무관하게 simulateMatch 반환 즉시 저장된다.
let lastMatchResult = null

export function getLastMatchResult() {
  return lastMatchResult
}

function checkReadiness(side) {
  const squad = getSquadState(side)
  const label = SIDE_LABEL[side]
  if (!squad.isFull) {
    return `${label} 스쿼드가 아직 다 안 채워졌어 (${squad.squad11.length}/${squad.formation.slots.length}명 배정됨)`
  }
  if (!squad.hasGoalkeeper) {
    return `${label} 스쿼드에 골키퍼가 없어 — 최소 한 명은 GK 포지션 선수를 넣어야 해`
  }
  return null
}

function renderGuard(mountEl, problems) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--match'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = '경기 관전'
  topbar.appendChild(title)

  const guard = document.createElement('div')
  guard.className = 'match__guard'
  const heading = document.createElement('p')
  heading.textContent = '아직 킥오프할 수 없어. 아래부터 먼저 채워줘:'
  guard.appendChild(heading)

  for (const { side, message } of problems) {
    const row = document.createElement('div')
    row.className = 'match__guard-row'
    const text = document.createElement('span')
    text.textContent = message
    const link = document.createElement('button')
    link.type = 'button'
    link.className = 'chip'
    link.textContent = `${SIDE_LABEL[side]} 스쿼드로 이동`
    link.addEventListener('click', () => navigate(ifSquadPath(side)))
    row.append(text, link)
    guard.appendChild(row)
  }

  screen.append(topbar, guard)
  mountEl.appendChild(screen)
}

export function renderMatch(mountEl) {
  clearActivePlayback()

  const homeProblem = checkReadiness('home')
  const awayProblem = checkReadiness('away')
  if (homeProblem || awayProblem) {
    const problems = []
    if (homeProblem) problems.push({ side: 'home', message: homeProblem })
    if (awayProblem) problems.push({ side: 'away', message: awayProblem })
    renderGuard(mountEl, problems)
    return
  }

  const homeSquad = getSquadState('home')
  const awaySquad = getSquadState('away')

  const screen = document.createElement('div')
  screen.className = 'screen screen--match'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = '경기 관전'
  // 경기 화면에서 나가는 길이 브라우저 뒤로가기뿐이던 문제(사용자 지적) — 상시 홈 링크.
  const homeLink = document.createElement('button')
  homeLink.type = 'button'
  homeLink.className = 'link-button'
  homeLink.textContent = '← 홈'
  homeLink.addEventListener('click', () => navigate(homePath()))
  topbar.append(title, homeLink)

  const buildInput = (side) => ({
    squad11: getSquadState(side).squad11,
    formation: getSquadState(side).formation,
    tactics: getTacticsState(side),
  })

  function startNewMatch() {
    const result = simulateMatch({
      home: buildInput('home'), away: buildInput('away'), seed: Date.now(),
    })
    lastMatchResult = result
    resultLink.hidden = true
    playback.setResult(result)
  }

  const playback = buildPlaybackView({
    homeSquad11: homeSquad.squad11,
    homeFormation: homeSquad.formation,
    awaySquad11: awaySquad.squad11,
    awayFormation: awaySquad.formation,
    tacticsBySide: { A: getTacticsState('home'), B: getTacticsState('away') },
    resolvePlayer: findPlayer,
    onKickoffRequest: startNewMatch,
    onPhase: (phase) => {
      if (phase === 'done') {
        resultLink.hidden = false
        rebuildLink.hidden = false
      }
    },
  })

  const rematchBtn = document.createElement('button')
  rematchBtn.type = 'button'
  rematchBtn.className = 'link-button'
  rematchBtn.textContent = '재대결(새 시드로 다시 시뮬레이션)'
  rematchBtn.addEventListener('click', startNewMatch)
  playback.controlsBar.appendChild(rematchBtn)

  const resultLink = document.createElement('button')
  resultLink.type = 'button'
  resultLink.className = 'link-button'
  resultLink.textContent = '결과 화면 보기 →'
  resultLink.hidden = true
  resultLink.addEventListener('click', () => navigate(ifResultPath()))
  playback.controlsBar.appendChild(resultLink)

  // 경기 종료 후 바로 팀을 다시 짜러 가는 길(사용자 지적).
  const rebuildLink = document.createElement('button')
  rebuildLink.type = 'button'
  rebuildLink.className = 'link-button'
  rebuildLink.textContent = '팀 다시 구성 →'
  rebuildLink.hidden = true
  rebuildLink.addEventListener('click', () => navigate(ifSquadPath('home')))
  playback.controlsBar.appendChild(rebuildLink)

  screen.append(topbar, playback.scoreboard, playback.stage, playback.controlsBar)
  mountEl.appendChild(screen)
}
