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
import { ifSquadPath, ifResultPath } from '../../routes.js'
import { computeTarget, springStep, MAX_SUBSTEP } from '../steering.js'
import { NARRATION_TYPES } from '../../sim/event-types.js'

const SIDE_LABEL = { home: '홈', away: '원정' }
const SIDE_TO_TEAM = { home: 'A', away: 'B' }

// formations.js 좌표계(y=0 자기골~100 상대골)를 공유 필드의 화면 top%로 바꾼다.
// 홈은 squadBuilder와 동일하게 (100-y), 원정은 y를 한 번 더 뒤집은 값이 최종적으로 y 그대로
// 나온다(자기 반쪽을 미러링한 뒤 다시 top 변환을 거치면 부호가 상쇄됨 — formations.js 상단
// 주석의 "원정팀은 y를 100-y로 미러링" 규칙을 그대로 계산한 결과). 슬롯 배치와 이벤트(공)
// 위치 계산이 반드시 이 한 함수만 거치게 해서, squadBuilder처럼 대칭이라 안 걸리는 실수가
// 아니라 좌우 팀이 뒤바뀌는 형태로 터질 수 있는 리스크를 한 곳에서만 검증하면 되게 한다.
// (실측 검증: 홈 골=top 8%, 원정 골=top 92% — Playwright로 골 6건 전부 대조 확인.)
function screenTop(formationY, team) {
  return team === 'A' ? 100 - formationY : formationY
}

// possession.js의 BANDS(길이 5밴드)/CHANNELS(폭 3채널)를 화면 좌표로 근사한다.
// BAND_Y는 formations.js와 같은 형식(0=자기골 쪽)이라 screenTop을 그대로 재사용한다.
const BAND_Y = { DEFENSE: 8, OWN_MID: 27, OPP_MID: 52, FINAL_THIRD: 75, BOX: 92 }
const CHANNEL_X = { LEFT: 22, CENTER: 50, RIGHT: 78 }

function eventPosition(event) {
  // pass는 channelFrom/channelTo를 갖는다(event-types.js) — 도착 채널 기준.
  const channel = event.channelTo ?? event.channel
  return { left: CHANNEL_X[channel], top: screenTop(BAND_Y[event.zoneTo], event.team) }
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
    link.addEventListener('click', () => navigate(ifSquadPath(side)))
    row.append(text, link)
    guard.appendChild(row)
  }

  screen.append(topbar, guard)
  mountEl.appendChild(screen)
}

// steeringRefs가 주어지면 이 슬롯을 M8 스티어링 애니메이션 대상으로 등록한다(선수 토큰만 —
// 좌표는 그대로 두고 재생 중 style.transform만 덧붙여서 미세하게 볼 쪽으로 쏠리게 만든다).
function renderStaticSlot(entry, team, steeringRefs) {
  const el = document.createElement('div')
  el.className = 'pitch-slot pitch-slot--static'
  const basePos = { left: entry.slot.x, top: screenTop(entry.slot.y, team) }
  el.style.left = `${basePos.left}%`
  el.style.top = `${basePos.top}%`
  el.appendChild(createPlayerBadge(entry.player, { size: 'sm' }))
  const name = document.createElement('div')
  name.className = 'pitch-slot__name'
  name.textContent = entry.player.name
  el.appendChild(name)
  if (steeringRefs) {
    steeringRefs.push({
      el, basePos, team, pace: entry.player.stats.pace,
      current: { ...basePos }, velocity: { left: 0, top: 0 },
    })
  }
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

// M8 스티어링 rAF 루프도 activeTimerId와 같은 이유로 모듈 스코프에 둔다 — 별개의 두 번째
// 진행 루프이므로 같은 고아 상태 위험(라우터 unmount 훅 없음)이 그대로 적용된다.
let activeRafId = null

// result.js가 읽는 진입점 — squadBuilder.js/tactics.js의 getSquadState/getTacticsState와
// 같은 패턴(store.js 없이 필요한 값만 읽기 전용으로 노출). 재생을 끝까지 안 보고 나가도
// simulateMatch가 반환한 시점에 이미 결과가 확정돼 있으므로, 재생 완료 여부와 무관하게
// 계산되는 즉시 저장한다.
let lastMatchResult = null

export function getLastMatchResult() {
  return lastMatchResult
}

function clearActiveTimer() {
  if (activeTimerId !== null) {
    clearTimeout(activeTimerId)
    activeTimerId = null
  }
}

function clearActiveRaf() {
  if (activeRafId !== null) {
    cancelAnimationFrame(activeRafId)
    activeRafId = null
  }
}

const BASE_DELAY_MS = 550
// 서술 이벤트(pass/carry)는 골/슈팅 같은 결정적 이벤트보다 훨씬 짧게 보여줘야
// "여러 지점을 순간이동"이 아니라 "지나간다"처럼 보인다. css/match-view.css의
// .match__ball transition(--duration-ball-travel)보다는 길게 잡아야 이동이 끝나고
// 다음 이동이 시작된다 — 그보다 짧으면 transition이 매번 중간에 끊긴다.
// (N1-c에서 타입별 페이싱 테이블로 확장 예정)
const NARRATION_DELAY_MS = 180

function delayFor(event) {
  return (NARRATION_TYPES.includes(event.type) ? NARRATION_DELAY_MS : BASE_DELAY_MS)
}

// 이벤트 로그를 하나씩 순서대로 공개한다 — 실시간 시뮬레이션이 아니라 이미 계산된 로그를
// "재생"만 하는 것(사전계산 후 리플레이 아키텍처). 매 tick마다 전체 화면을 다시 그리면
// 검색창/슬라이더에서 겪은 것과 같은 문제(진행 중이던 애니메이션/포커스가 DOM 재생성으로
// 끊김)가 생기므로, 여기 전달된 노드들만 직접 갱신한다.
//
// 일시정지/배속/스킵/다시보기가 전부 같은 index/score 위에서 동작하므로 컨트롤러 객체로
// 묶는다. 다시보기는 이 events 배열을 그대로 재사용(재시뮬레이션 없음), 재대결은 호출부가
// simulateMatch를 새로 돌려 새 컨트롤러를 만든다.
function createPlaybackController(events, refs) {
  const { ballEl, scoreEl, minuteEl, commentaryEl, onPhaseChange, pitchEl, steeringRefs } = refs
  let index = 0
  let speed = 1
  const score = { home: 0, away: 0 }
  let ballTarget = { left: 50, top: 50 }
  // 이 이벤트를 만든(=이 순간 볼을 가진) 팀. steering.js의 computeTarget이 소유/비소유팀을
  // 다르게 반응시키는 데 쓴다 — null이면(킥오프 직전) 양팀 다 "비소유" 취급.
  let possessionTeam = null
  let lastFrameTime = null
  let pitchWidth = 0
  let pitchHeight = 0

  // 선수 토큰의 basePos 기준 애니메이션 오프셋을 픽셀로 변환해 transform에 얹는다.
  // .pitch-slot 자체가 이미 transform: translate(-50%, -50%)로 중앙정렬돼 있으므로
  // 여기서 덮어쓰지 않고 뒤에 이어붙인다.
  function applyOffset(ref) {
    const dxPx = ((ref.current.left - ref.basePos.left) / 100) * pitchWidth
    const dyPx = ((ref.current.top - ref.basePos.top) / 100) * pitchHeight
    ref.el.style.transform = `translate(-50%, -50%) translate(${dxPx}px, ${dyPx}px)`
  }

  function stepFrame(now) {
    if (!document.contains(pitchEl)) { activeRafId = null; return }
    const deltaSeconds = lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, 0.1)
    lastFrameTime = now
    // 스프링 적분은 deltaSeconds가 크면(프레임 드랍 등) 발산할 수 있어 작은 서브스텝으로
    // 쪼갠다. target은 프레임당 한 번만 계산(볼 위치는 프레임 중 안 바뀜), 적분만 반복.
    const substeps = deltaSeconds === 0 ? 0 : Math.ceil(deltaSeconds / MAX_SUBSTEP)
    const subDt = substeps === 0 ? 0 : deltaSeconds / substeps
    for (const ref of steeringRefs) {
      const hasPossession = ref.team === possessionTeam
      const target = computeTarget(ref.basePos, ballTarget, ref.team, hasPossession)
      for (let s = 0; s < substeps; s++) {
        const result = springStep(ref.current, ref.velocity, target, ref.pace, subDt, speed)
        ref.current = result.current
        ref.velocity = result.velocity
      }
      applyOffset(ref)
    }
    activeRafId = requestAnimationFrame(stepFrame)
  }

  function startSteering() {
    clearActiveRaf()
    lastFrameTime = null
    pitchWidth = pitchEl.offsetWidth
    pitchHeight = pitchEl.offsetHeight
    activeRafId = requestAnimationFrame(stepFrame)
  }

  // 스킵은 재생 없이 바로 최종 상태로 점프해야 하므로, 보간 없이 목표 지점에 즉시 스냅한다.
  // velocity도 같이 0으로 되돌려야 한다 — 안 그러면 이후 다시보기/재대결이 이 잔여 속도를
  // 이어받아 첫 프레임에 튀는 것처럼 보인다.
  function snapPlayersToTarget() {
    pitchWidth = pitchEl.offsetWidth
    pitchHeight = pitchEl.offsetHeight
    for (const ref of steeringRefs) {
      const hasPossession = ref.team === possessionTeam
      ref.current = computeTarget(ref.basePos, ballTarget, ref.team, hasPossession)
      ref.velocity = { left: 0, top: 0 }
      applyOffset(ref)
    }
  }

  function applyEvent(event) {
    const pos = eventPosition(event)
    ballTarget = pos
    possessionTeam = event.team
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
  }

  function tick() {
    if (!document.contains(ballEl)) { clearActiveTimer(); clearActiveRaf(); return }
    if (index >= events.length) {
      clearActiveTimer()
      clearActiveRaf()
      onPhaseChange('done')
      return
    }
    const event = events[index]
    applyEvent(event)
    index++
    activeTimerId = setTimeout(tick, delayFor(event) / speed)
  }

  function resetVisuals() {
    ballEl.style.left = '50%'
    ballEl.style.top = '50%'
    ballTarget = { left: 50, top: 50 }
    possessionTeam = null
    minuteEl.textContent = "0'"
    scoreEl.textContent = '0 - 0'
    commentaryEl.replaceChildren()
    score.home = 0
    score.away = 0
    for (const ref of steeringRefs) {
      ref.current = { ...ref.basePos }
      ref.velocity = { left: 0, top: 0 }
      ref.el.style.transform = 'translate(-50%, -50%)'
    }
  }

  return {
    start() {
      clearActiveTimer()
      clearActiveRaf()
      index = 0
      resetVisuals()
      onPhaseChange('playing')
      tick()
      startSteering()
    },
    pause() {
      clearActiveTimer()
      clearActiveRaf()
      onPhaseChange('paused')
    },
    resume() {
      if (index >= events.length) return
      onPhaseChange('playing')
      tick()
      startSteering()
    },
    setSpeed(next) {
      speed = next
    },
    skipToEnd() {
      clearActiveTimer()
      clearActiveRaf()
      while (index < events.length) {
        applyEvent(events[index])
        index++
      }
      snapPlayersToTarget()
      onPhaseChange('done')
    },
  }
}

// 컨트롤 버튼들을 만들고, phase(idle/playing/paused/done)에 따라 disabled만 바꾼다.
// 버튼을 통째로 갈아끼우지 않는 이유: 재생 중 배속을 누르는 것도 잦은 상호작용이라 검색창/
// 슬라이더와 같은 원칙(진행 중인 걸 방해하는 DOM 재생성 금지)을 여기도 적용한다.
function renderControls(onKickoff, onTogglePause, onSetSpeed, onSkip) {
  const bar = document.createElement('div')
  bar.className = 'match__controls'

  const kickoffBtn = document.createElement('button')
  kickoffBtn.type = 'button'
  kickoffBtn.className = 'chip chip--active'
  kickoffBtn.textContent = '킥오프'
  kickoffBtn.addEventListener('click', onKickoff)

  const pauseBtn = document.createElement('button')
  pauseBtn.type = 'button'
  pauseBtn.className = 'chip'
  pauseBtn.textContent = '일시정지'
  pauseBtn.disabled = true
  pauseBtn.addEventListener('click', onTogglePause)

  const speedWrap = document.createElement('div')
  speedWrap.className = 'match__speed-group'
  const speedButtons = [1, 2, 4].map((s) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip' + (s === 1 ? ' chip--active' : '')
    b.textContent = `${s}x`
    b.disabled = true
    b.addEventListener('click', () => onSetSpeed(s, b))
    speedWrap.appendChild(b)
    return b
  })

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.className = 'chip'
  skipBtn.textContent = '스킵'
  skipBtn.disabled = true
  skipBtn.addEventListener('click', onSkip)

  bar.append(kickoffBtn, pauseBtn, speedWrap, skipBtn)
  return { bar, kickoffBtn, pauseBtn, speedButtons, skipBtn }
}

export function renderMatch(mountEl) {
  clearActiveTimer()
  clearActiveRaf()

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
  const steeringRefs = []
  for (const entry of withSlotPositions(homeSquad.squad11, homeSquad.formation)) {
    pitch.appendChild(renderStaticSlot(entry, SIDE_TO_TEAM.home, steeringRefs))
  }
  for (const entry of withSlotPositions(awaySquad.squad11, awaySquad.formation)) {
    pitch.appendChild(renderStaticSlot(entry, SIDE_TO_TEAM.away, steeringRefs))
  }
  const ball = document.createElement('div')
  ball.className = 'match__ball'
  ball.style.left = '50%'
  ball.style.top = '50%'
  pitch.appendChild(ball)

  const commentary = document.createElement('div')
  commentary.className = 'match__commentary'

  let controller = null
  let paused = false

  function setPhase(phase) {
    const { kickoffBtn, pauseBtn, speedButtons, skipBtn } = ui
    if (phase === 'playing') {
      paused = false
      kickoffBtn.disabled = true
      kickoffBtn.textContent = '경기 진행 중...'
      pauseBtn.disabled = false
      pauseBtn.textContent = '일시정지'
      speedButtons.forEach((b) => { b.disabled = false })
      skipBtn.disabled = false
    } else if (phase === 'paused') {
      paused = true
      pauseBtn.textContent = '재생'
    } else if (phase === 'done') {
      kickoffBtn.disabled = false
      kickoffBtn.textContent = '다시보기'
      pauseBtn.disabled = true
      pauseBtn.textContent = '일시정지'
      speedButtons.forEach((b) => { b.disabled = true })
      skipBtn.disabled = true
      resultLink.hidden = false
    }
  }

  function startNewMatch() {
    const result = simulateMatch({
      home: buildTeamInput('home'),
      away: buildTeamInput('away'),
      seed: Date.now(),
    })
    lastMatchResult = result
    resultLink.hidden = true
    controller = createPlaybackController(result.events, {
      ballEl: ball, scoreEl, minuteEl, commentaryEl: commentary, onPhaseChange: setPhase,
      pitchEl: pitch, steeringRefs,
    })
    controller.start()
  }

  const ui = renderControls(
    () => {
      // "킥오프"는 처음 한 번만 새 시뮬레이션을 돌린다. 경기가 끝난 뒤 같은 버튼이
      // "다시보기"로 바뀌는데, 이때는 재시뮬레이션 없이 같은 이벤트 로그를 처음부터
      // 재생한다(재대결과 구분 — 다시보기는 시드를 다시 안 뽑는다).
      if (controller) controller.start()
      else startNewMatch()
    },
    () => {
      if (!controller) return
      if (paused) controller.resume()
      else controller.pause()
    },
    (speed, clickedBtn) => {
      if (!controller) return
      controller.setSpeed(speed)
      ui.speedButtons.forEach((b) => b.classList.toggle('chip--active', b === clickedBtn))
    },
    () => { if (controller) controller.skipToEnd() },
  )

  const rematchBtn = document.createElement('button')
  rematchBtn.type = 'button'
  rematchBtn.className = 'link-button'
  rematchBtn.textContent = '재대결(새 시드로 다시 시뮬레이션)'
  rematchBtn.addEventListener('click', startNewMatch)
  ui.bar.appendChild(rematchBtn)

  const resultLink = document.createElement('button')
  resultLink.type = 'button'
  resultLink.className = 'link-button'
  resultLink.textContent = '결과 화면 보기 →'
  resultLink.hidden = true
  resultLink.addEventListener('click', () => navigate(ifResultPath()))
  ui.bar.appendChild(resultLink)

  screen.append(topbar, scoreboard, pitch, commentary, ui.bar)
  mountEl.appendChild(screen)
}
