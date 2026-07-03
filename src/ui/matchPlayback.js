// 매치 재생 계층 — IF 매치 화면(match.js)과 커리어 매치데이가 공유한다.
//
// 중요한 소유권 규칙: 재생 타이머(activeTimerId)와 스티어링 rAF(activeRafId)는 반드시
// 이 모듈 하나만 소유한다. 라우터에 unmount 훅이 없어서 화면을 떠나도 루프가 살아남는
// 문제를 "진입 시 정리"로 막고 있는데, 두 화면이 각자 타이머를 들면 그 장치가 이원화되어
// 서로의 고아 루프를 못 죽인다 — 추출 시 이 변수들을 셸에 남기지 않은 이유.
//
// resolvePlayer 주입: 커리어에는 DB에 없는 필러 선수가 있어서(findCareerPlayer),
// 커멘터리/뱃지가 db findPlayer를 직접 쓰면 필러 등장 순간 크래시한다.

import { eventCommentary } from '../sim/commentary.js'
import { possessionTeamOf } from '../sim/event-types.js'
import { createPlayerBadge } from './components/playerBadge.js'
import { renderPitchLines } from './components/pitchLines.js'
import { computeTarget, computeOverrideTarget, springStep, MAX_SUBSTEP } from './steering.js'
import {
  restState, flightToTokenState, flightToPointState,
  advanceBall, ballPosition, settleBall,
} from './ballFlight.js'

// formations.js 좌표계(y=0 자기골~100 상대골)를 공유 필드의 화면 top%로 바꾼다.
// 슬롯 배치와 이벤트(공) 위치 계산이 반드시 이 한 함수만 거치게 해서 좌우 팀이
// 뒤바뀌는 리스크를 한 곳에서만 검증한다. (실측: 홈 골=top 8%, 원정 골=top 92%.)
export function screenTop(formationY, team) {
  return team === 'A' ? 100 - formationY : formationY
}

const BAND_Y = { DEFENSE: 8, OWN_MID: 27, OPP_MID: 52, FINAL_THIRD: 75, BOX: 92 }
const CHANNEL_X = { LEFT: 22, CENTER: 50, RIGHT: 78 }

function eventPosition(event) {
  const channel = event.channelTo ?? event.channel
  return { left: CHANNEL_X[channel], top: screenTop(BAND_Y[event.zoneTo], event.team) }
}

// 이벤트별 페이싱. 볼 비행시간은 FLIGHT_RATIO배로 잡아 "이동 완료 후 다음 이벤트" 보장.
const DELAY_MS = {
  pass: 420, carry: 700, turnover_buildup: 550,
  shot_saved: 700, shot_off_target: 700, goal: 1500,
  foul: 700, free_kick: 850, corner_kick: 900, clearance: 650, offside: 800,
  yellow_card: 950, red_card: 1200, penalty_awarded: 1200,
}
const SHORT_PASS_DELAY_MS = 260
const FLIGHT_RATIO = 0.72
const CARRY_TRANSFER_MS = 160

function delayFor(event) {
  if (event.type === 'pass' && event.style === 'short') return SHORT_PASS_DELAY_MS
  return DELAY_MS[event.type] ?? 550
}

function pullActorOf(event) {
  if (event.type === 'pass') return event.toId
  if (event.type === 'free_kick' || event.type === 'corner_kick') return event.takerId
  if (event.type === 'yellow_card' || event.type === 'red_card' || event.type === 'penalty_awarded') return null
  return event.actorId ?? null
}

function goalMouthOf(team) {
  return { left: 50, top: screenTop(99, team) }
}

function cornerSpotOf(team, side) {
  return { left: side === 'LEFT' ? 4 : 96, top: screenTop(97, team) }
}

function penaltySpotOf(team) {
  return { left: 50, top: screenTop(88, team) }
}

function spawnFlash(pitchEl, text, variant) {
  const flash = document.createElement('div')
  flash.className = `match__flash match__flash--${variant}`
  flash.textContent = text
  flash.addEventListener('animationend', () => flash.remove())
  pitchEl.appendChild(flash)
}

// 재생 타이머/rAF — 모듈 스코프 단일 소유(파일 상단 주석 참고).
let activeTimerId = null
let activeRafId = null

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

// 어느 매치 화면이든 렌더 진입 시 반드시 먼저 호출 — 이전 화면의 고아 루프 정리.
export function clearActivePlayback() {
  clearActiveTimer()
  clearActiveRaf()
}

function renderStaticSlot(entry, team, steeringRefs) {
  const el = document.createElement('div')
  el.className = 'pitch-slot pitch-slot--static'
  el.dataset.playerId = entry.player.id
  const basePos = { left: entry.slot.x, top: screenTop(entry.slot.y, team) }
  el.style.left = `${basePos.left}%`
  el.style.top = `${basePos.top}%`
  el.appendChild(createPlayerBadge(entry.player, { size: 'sm' }))
  const name = document.createElement('div')
  name.className = 'pitch-slot__name'
  name.textContent = entry.player.name
  el.appendChild(name)
  steeringRefs.push({
    el, basePos, team, playerId: entry.player.id,
    pace: entry.player.stats.pace,
    dribbling: entry.player.stats.dribbling,
    isGK: entry.player.positions.includes('GK'),
    idlePhase: steeringRefs.length * 1.7,
    current: { ...basePos }, velocity: { left: 0, top: 0 },
  })
  return el
}

function withSlotPositions(squad11, formation) {
  return squad11.map(({ player, slotIndex }) => ({ player, slot: formation.slots[slotIndex] }))
}

// 이벤트 로그 재생 컨트롤러 — 사전계산 후 리플레이. 상세 원리 주석은 v1/N1/N2 커밋 이력 참고.
function createPlaybackController(events, refs) {
  const { ballEl, scoreEl, minuteEl, commentaryEl, onPhaseChange, pitchEl, steeringRefs, tacticsBySide, resolvePlayer } = refs
  let index = 0
  let speed = 1
  const score = { home: 0, away: 0 }
  let possessionTeam = null
  let lastFrameTime = null
  let pitchWidth = 0
  let pitchHeight = 0

  let ballState = restState({ left: 50, top: 50 })
  let ballScreenPos = { left: 50, top: 50 }
  const pullOverrides = new Map()
  let activeFlair = null
  let celebration = null

  const refsById = new Map(steeringRefs.map((ref) => [ref.playerId, ref]))
  const resolveTokenPos = (playerId) => {
    const ref = refsById.get(playerId)
    return ref ? ref.current : null
  }

  function syncBallDebugDataset() {
    ballEl.dataset.mode = ballState.mode
    ballEl.dataset.holderId = ballState.mode === 'held' ? ballState.holderId : ''
    ballEl.dataset.toId = ballState.mode === 'flight' ? ballState.toId : ''
  }

  function renderBall() {
    let pos = ballPosition(ballState, resolveTokenPos)
    if (pos && activeFlair?.type === 'roulette' && ballState.mode === 'held'
        && ballState.holderId === activeFlair.actorId) {
      const theta = (activeFlair.elapsedMs / activeFlair.durationMs) * Math.PI * 2
      pos = { left: pos.left + Math.cos(theta) * 1.4, top: pos.top + Math.sin(theta) * 1.4 }
    }
    if (pos) ballScreenPos = pos
    ballEl.style.left = `${ballScreenPos.left}%`
    ballEl.style.top = `${ballScreenPos.top}%`
    syncBallDebugDataset()
  }

  function applyOffset(ref) {
    const dxPx = ((ref.current.left - ref.basePos.left) / 100) * pitchWidth
    const dyPx = ((ref.current.top - ref.basePos.top) / 100) * pitchHeight
    ref.el.style.transform = `translate(-50%, -50%) translate(${dxPx}px, ${dyPx}px)`
  }

  function stepFrame(now) {
    if (!document.contains(pitchEl)) { activeRafId = null; return }
    const deltaSeconds = lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, 0.1)
    lastFrameTime = now

    const frameMs = deltaSeconds * 1000 * speed
    if (activeFlair) {
      activeFlair.elapsedMs += frameMs
      if (activeFlair.elapsedMs >= activeFlair.durationMs) activeFlair = null
    }
    if (celebration) {
      celebration.remainingMs -= frameMs
      if (celebration.remainingMs <= 0) celebration = null
    }
    const scorerRef = celebration ? refsById.get(celebration.scorerId) : null

    const substeps = deltaSeconds === 0 ? 0 : Math.ceil(deltaSeconds / MAX_SUBSTEP)
    const subDt = substeps === 0 ? 0 : deltaSeconds / substeps
    for (const ref of steeringRefs) {
      let target
      if (scorerRef && ref.team === celebration.team && !ref.isGK && ref.playerId !== celebration.scorerId) {
        target = { ...scorerRef.current }
      } else {
        const override = pullOverrides.get(ref.playerId)
        target = override
          ? computeOverrideTarget(ref.basePos, override)
          : computeTarget(ref.basePos, ballScreenPos, ref.team, ref.team === possessionTeam)
        target = {
          left: target.left + Math.sin(now / 1100 + ref.idlePhase) * 0.35,
          top: target.top + Math.cos(now / 1450 + ref.idlePhase) * 0.3,
        }
        if (activeFlair?.type === 'weave' && activeFlair.actorId === ref.playerId) {
          const dx = target.left - ref.current.left
          const dy = target.top - ref.current.top
          const len = Math.hypot(dx, dy) || 1
          const wobble = Math.sin(activeFlair.elapsedMs / 70) * activeFlair.amp
          target = { left: target.left + (-dy / len) * wobble, top: target.top + (dx / len) * wobble }
        }
      }
      for (let s = 0; s < substeps; s++) {
        const result = springStep(ref.current, ref.velocity, target, ref.pace, subDt, speed)
        ref.current = result.current
        ref.velocity = result.velocity
      }
      applyOffset(ref)
    }
    ballState = advanceBall(ballState, frameMs)
    renderBall()
    activeRafId = requestAnimationFrame(stepFrame)
  }

  function startSteering() {
    clearActiveRaf()
    lastFrameTime = null
    pitchWidth = pitchEl.offsetWidth
    pitchHeight = pitchEl.offsetHeight
    activeRafId = requestAnimationFrame(stepFrame)
  }

  function snapPlayersToTarget() {
    pitchWidth = pitchEl.offsetWidth
    pitchHeight = pitchEl.offsetHeight
    for (const ref of steeringRefs) {
      const override = pullOverrides.get(ref.playerId)
      ref.current = override
        ? computeOverrideTarget(ref.basePos, override)
        : computeTarget(ref.basePos, ballScreenPos, ref.team, ref.team === possessionTeam)
      ref.velocity = { left: 0, top: 0 }
      applyOffset(ref)
    }
    ballState = settleBall(ballState)
    renderBall()
  }

  function applyEvent(event) {
    possessionTeam = possessionTeamOf(event)
    minuteEl.textContent = `${event.minute}'`

    const flightMs = delayFor(event) * FLIGHT_RATIO
    if (event.type === 'pass') {
      ballState = flightToTokenState(ballScreenPos, event.toId, flightMs)
    } else if (event.type === 'carry' || event.type === 'turnover_buildup'
        || event.type === 'clearance' || event.type === 'offside') {
      ballState = flightToTokenState(ballScreenPos, event.actorId, CARRY_TRANSFER_MS)
    } else if (event.type === 'foul') {
      ballState = flightToTokenState(ballScreenPos, event.victimId, CARRY_TRANSFER_MS)
    } else if (event.type === 'free_kick') {
      ballState = flightToTokenState(ballScreenPos, event.takerId, CARRY_TRANSFER_MS)
    } else if (event.type === 'corner_kick') {
      ballState = flightToPointState(ballScreenPos, cornerSpotOf(event.team, event.side), flightMs)
    } else if (event.type === 'penalty_awarded') {
      ballState = flightToPointState(ballScreenPos, penaltySpotOf(event.team === 'A' ? 'B' : 'A'), flightMs)
    } else if (event.type === 'shot_saved') {
      ballState = flightToTokenState(ballScreenPos, event.gkId, flightMs)
    } else if (event.type === 'goal' || event.type === 'shot_off_target') {
      ballState = flightToPointState(ballScreenPos, goalMouthOf(event.team), flightMs)
    }

    pullOverrides.clear()
    const eventPos = event.type === 'corner_kick'
      ? cornerSpotOf(event.team, event.side)
      : eventPosition(event)
    const puller = pullActorOf(event)
    if (puller) pullOverrides.set(puller, eventPos)

    const defendingTeam = possessionTeam === 'A' ? 'B' : 'A'
    const pressing = tacticsBySide?.[defendingTeam]?.pressing ?? 0.5
    const pursuerCount = pressing > 0.66 ? 2 : 1
    const pursuers = steeringRefs
      .filter((r) => r.team === defendingTeam && !r.isGK && !pullOverrides.has(r.playerId))
      .map((r) => ({ r, d: Math.hypot(r.current.left - eventPos.left, r.current.top - eventPos.top) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, pursuerCount)
    for (const { r } of pursuers) pullOverrides.set(r.playerId, eventPos)

    if (event.type === 'carry') {
      const carrier = refsById.get(event.actorId)
      const dribbling = carrier?.dribbling ?? 60
      const rouletteTick = (event.chainId * 7 + event.minute) % 4 === 0
      if (dribbling >= 86 && rouletteTick) {
        activeFlair = { type: 'roulette', actorId: event.actorId, elapsedMs: 0, durationMs: 450 }
      } else {
        activeFlair = {
          type: 'weave', actorId: event.actorId, elapsedMs: 0,
          durationMs: delayFor(event), amp: 0.7 + (dribbling / 99) * 1.3,
        }
      }
    } else {
      activeFlair = null
    }

    renderBall()

    if (event.type === 'goal') {
      if (event.team === 'A') score.home++
      else score.away++
      scoreEl.textContent = `${score.home} - ${score.away}`
      celebration = { team: event.team, scorerId: event.actorId, remainingMs: 1400 }
      spawnFlash(pitchEl, 'GOAL!', 'goal')
    } else if (event.type === 'yellow_card') {
      spawnFlash(pitchEl, '', 'yellow')
    } else if (event.type === 'red_card') {
      spawnFlash(pitchEl, '', 'red')
      const ref = refsById.get(event.actorId)
      if (ref) ref.el.style.opacity = 'var(--opacity-disabled)'
    }

    const text = eventCommentary(event, resolvePlayer)
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
    if (!document.contains(ballEl)) { clearActivePlayback(); return }
    if (index >= events.length) {
      clearActivePlayback()
      onPhaseChange('done')
      return
    }
    const event = events[index]
    applyEvent(event)
    index++
    activeTimerId = setTimeout(tick, delayFor(event) / speed)
  }

  function resetVisuals() {
    ballState = restState({ left: 50, top: 50 })
    ballScreenPos = { left: 50, top: 50 }
    pullOverrides.clear()
    activeFlair = null
    celebration = null
    possessionTeam = null
    renderBall()
    minuteEl.textContent = "0'"
    scoreEl.textContent = '0 - 0'
    commentaryEl.replaceChildren()
    score.home = 0
    score.away = 0
    for (const ref of steeringRefs) {
      ref.current = { ...ref.basePos }
      ref.velocity = { left: 0, top: 0 }
      ref.el.style.transform = 'translate(-50%, -50%)'
      ref.el.style.opacity = ''
    }
  }

  return {
    start() {
      clearActivePlayback()
      index = 0
      resetVisuals()
      onPhaseChange('playing')
      tick()
      startSteering()
    },
    pause() {
      clearActivePlayback()
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
      clearActivePlayback()
      while (index < events.length) {
        applyEvent(events[index])
        index++
      }
      snapPlayersToTarget()
      onPhaseChange('done')
    },
  }
}

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

// 재생 뷰 전체 조립 — 스코어보드/피치(22토큰+볼)/커멘터리/컨트롤바.
// onKickoffRequest(): 컨트롤러가 아직 없을 때 킥오프를 누르면 호출 — 셸이 setResult로 응답
// (IF는 이때 새 시뮬, 커리어는 미리 계산된 고정 시드 결과 전달). onPhase(phase): 'playing'|
// 'paused'|'done' — 셸이 부가 UI(결과 링크 등)를 제어.
export function buildPlaybackView({
  homeSquad11, homeFormation, awaySquad11, awayFormation,
  tacticsBySide, resolvePlayer, onKickoffRequest, onPhase,
}) {
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
  for (const entry of withSlotPositions(homeSquad11, homeFormation)) {
    pitch.appendChild(renderStaticSlot(entry, 'A', steeringRefs))
  }
  for (const entry of withSlotPositions(awaySquad11, awayFormation)) {
    pitch.appendChild(renderStaticSlot(entry, 'B', steeringRefs))
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
    if (phase === 'playing') {
      paused = false
      ui.kickoffBtn.disabled = true
      ui.kickoffBtn.textContent = '경기 진행 중...'
      ui.pauseBtn.disabled = false
      ui.pauseBtn.textContent = '일시정지'
      ui.speedButtons.forEach((b) => { b.disabled = false })
      ui.skipBtn.disabled = false
    } else if (phase === 'paused') {
      paused = true
      ui.pauseBtn.textContent = '재생'
    } else if (phase === 'done') {
      ui.kickoffBtn.disabled = false
      ui.kickoffBtn.textContent = '다시보기'
      ui.pauseBtn.disabled = true
      ui.pauseBtn.textContent = '일시정지'
      ui.speedButtons.forEach((b) => { b.disabled = true })
      ui.skipBtn.disabled = true
    }
    onPhase?.(phase)
  }

  const ui = renderControls(
    () => {
      // 첫 킥오프는 셸에 결과를 요청, 이후엔 같은 이벤트 로그 다시보기(재시뮬 없음).
      if (controller) controller.start()
      else onKickoffRequest()
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

  return {
    scoreboard, pitch, commentary, controlsBar: ui.bar,
    // 결과 장착(+즉시 재생 시작). IF 재대결은 새 결과로 다시 호출하면 된다.
    setResult(result) {
      controller = createPlaybackController(result.events, {
        ballEl: ball, scoreEl, minuteEl, commentaryEl: commentary,
        onPhaseChange: setPhase, pitchEl: pitch, steeringRefs, tacticsBySide, resolvePlayer,
      })
      controller.start()
    },
    hasController: () => controller !== null,
  }
}
