// 경기 관전 화면. 스쿼드 빌더(getSquadState)와 감독 지침(getTacticsState)의 상태를
// 읽기 전용으로 가져와 simulateMatch를 돌리고, 그 결과 이벤트 로그를 재생한다.
// side별 화면이 아니라 양팀이 한 필드에 모이는 유일한 화면 — /match(파라미터 없음).

import { getSquadState } from './squadBuilder.js'
import { getTacticsState } from './tactics.js'
import { findPlayer } from '../../data/players.db.js'
import { simulateMatch } from '../../sim/engine.js'
import { eventCommentary } from '../../sim/commentary.js'
import { createPlayerBadge } from '../components/playerBadge.js'
import { renderPitchLines } from '../components/pitchLines.js'
import { navigate } from '../../router.js'

const SIDE_LABEL = { home: '홈', away: '원정' }
const SIDE_TO_TEAM = { home: 'A', away: 'B' }

// formations.js 좌표계(y=0 자기골~100 상대골)를 공유 필드의 화면 top%로 바꾼다.
// 홈은 squadBuilder와 동일하게 (100-y), 원정은 y를 한 번 더 뒤집은 값이 최종적으로 y 그대로
// 나온다(자기 반쪽을 미러링한 뒤 다시 top 변환을 거치면 부호가 상쇄됨 — formations.js 상단
// 주석의 "원정팀은 y를 100-y로 미러링" 규칙을 그대로 계산한 결과). 슬롯 배치와 이벤트(공)
// 위치 계산이 반드시 이 한 함수만 거치게 해서, squadBuilder처럼 대칭이라 안 걸리는 실수가
// 아니라 좌우 팀이 뒤바뀌는 형태로 터질 수 있는 리스크를 한 곳에서만 검증하면 되게 한다.
function screenTop(formationY, team) {
  return team === 'A' ? 100 - formationY : formationY
}

// possession.js의 BANDS(길이 5밴드)/CHANNELS(폭 3채널)를 화면 좌표로 근사한다.
// BAND_Y는 formations.js와 같은 형식(0=자기골 쪽)이라 screenTop을 그대로 재사용한다.
const BAND_Y = { DEFENSE: 8, OWN_MID: 27, OPP_MID: 52, FINAL_THIRD: 75, BOX: 92 }
const CHANNEL_X = { LEFT: 22, CENTER: 50, RIGHT: 78 }

function eventPosition(event) {
  return { left: CHANNEL_X[event.channel], top: screenTop(BAND_Y[event.zoneTo], event.team) }
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

function buildTeamInput(side) {
  const squad = getSquadState(side)
  const tactics = getTacticsState(side)
  return { squad11: squad.squad11, formation: squad.formation, tactics }
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
    link.addEventListener('click', () => navigate(`/squad/${side}`))
    row.append(text, link)
    guard.appendChild(row)
  }

  screen.append(topbar, guard)
  mountEl.appendChild(screen)
}

function renderStaticSlot(entry, team) {
  const el = document.createElement('div')
  el.className = 'pitch-slot pitch-slot--static'
  el.style.left = `${entry.slot.x}%`
  el.style.top = `${screenTop(entry.slot.y, team)}%`
  el.appendChild(createPlayerBadge(entry.player, { size: 'sm' }))
  const name = document.createElement('div')
  name.className = 'pitch-slot__name'
  name.textContent = entry.player.name
  el.appendChild(name)
  return el
}

// squad11([{player, slotIndex}]) + formation -> 렌더에 바로 쓸 [{player, slot}] 목록.
function withSlotPositions(squad11, formation) {
  return squad11.map(({ player, slotIndex }) => ({ player, slot: formation.slots[slotIndex] }))
}

// 재생 타이머는 모듈 스코프에 둔다 — 라우터가 hashchange 때 mountEl.replaceChildren()만
// 하고 별도 unmount 훅이 없어서, /match를 벗어났다가 다시 들어오면 이전 마운트가 예약해둔
// setTimeout이 그대로 살아있다(고아 타이머가 사라진 DOM을 계속 갱신하려 하거나, 새 마운트의
// 루프와 겹쳐 두 배로 진행되는 문제). renderMatch 진입 시 항상 먼저 정리한다.
let activeTimerId = null

function clearActiveTimer() {
  if (activeTimerId !== null) {
    clearTimeout(activeTimerId)
    activeTimerId = null
  }
}

const PLAYBACK_DELAY_MS = 550

// 이벤트 로그를 하나씩 순서대로 공개한다 — 실시간 시뮬레이션이 아니라 이미 계산된 로그를
// "재생"만 하는 것(사전계산 후 리플레이 아키텍처). 매 tick마다 전체 화면을 다시 그리면
// 검색창/슬라이더에서 겪은 것과 같은 문제(진행 중이던 애니메이션/포커스가 DOM 재생성으로
// 끊김)가 생기므로, 여기 전달된 노드들만 직접 갱신한다.
function startPlayback(events, refs) {
  clearActiveTimer()
  const { ballEl, scoreEl, minuteEl, commentaryEl, kickoffBtn } = refs
  let index = 0
  const score = { home: 0, away: 0 }

  function tick() {
    if (!document.contains(ballEl)) { clearActiveTimer(); return }
    if (index >= events.length) {
      clearActiveTimer()
      kickoffBtn.textContent = '경기 종료'
      return
    }

    const event = events[index]
    const pos = eventPosition(event)
    ballEl.style.left = `${pos.left}%`
    ballEl.style.top = `${pos.top}%`
    minuteEl.textContent = `${event.minute}'`

    if (event.type === 'goal') {
      if (event.team === 'A') score.home++
      else score.away++
      scoreEl.textContent = `${score.home} - ${score.away}`
    }

    const text = eventCommentary(event, findPlayer)
    if (text) {
      const line = document.createElement('div')
      line.className = 'match__commentary-line'
      if (event.type === 'goal') line.classList.add('match__commentary-line--goal')
      line.textContent = text
      commentaryEl.appendChild(line)
      commentaryEl.scrollTop = commentaryEl.scrollHeight
    }

    index++
    activeTimerId = setTimeout(tick, PLAYBACK_DELAY_MS)
  }

  tick()
}

export function renderMatch(mountEl) {
  clearActiveTimer()

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
  topbar.appendChild(title)

  const scoreboard = document.createElement('div')
  scoreboard.className = 'match__scoreboard'
  const minuteEl = document.createElement('span')
  minuteEl.className = 'match__minute'
  minuteEl.textContent = "0'"
  const scoreEl = document.createElement('span')
  scoreEl.className = 'match__score'
  scoreEl.textContent = '0 - 0'
  scoreboard.append(minuteEl, scoreEl)

  const pitch = document.createElement('div')
  pitch.className = 'match__pitch'
  pitch.appendChild(renderPitchLines())
  for (const entry of withSlotPositions(homeSquad.squad11, homeSquad.formation)) {
    pitch.appendChild(renderStaticSlot(entry, SIDE_TO_TEAM.home))
  }
  for (const entry of withSlotPositions(awaySquad.squad11, awaySquad.formation)) {
    pitch.appendChild(renderStaticSlot(entry, SIDE_TO_TEAM.away))
  }
  const ball = document.createElement('div')
  ball.className = 'match__ball'
  ball.style.left = '50%'
  ball.style.top = '50%'
  pitch.appendChild(ball)

  const commentary = document.createElement('div')
  commentary.className = 'match__commentary'

  const kickoffBtn = document.createElement('button')
  kickoffBtn.type = 'button'
  kickoffBtn.className = 'chip chip--active'
  kickoffBtn.textContent = '킥오프'
  kickoffBtn.addEventListener('click', () => {
    kickoffBtn.disabled = true
    kickoffBtn.textContent = '경기 진행 중...'
    commentary.replaceChildren()
    const result = simulateMatch({
      home: buildTeamInput('home'),
      away: buildTeamInput('away'),
      seed: Date.now(),
    })
    startPlayback(result.events, { ballEl: ball, scoreEl, minuteEl, commentaryEl: commentary, kickoffBtn })
  })

  screen.append(topbar, scoreboard, pitch, commentary, kickoffBtn)
  mountEl.appendChild(screen)
}
