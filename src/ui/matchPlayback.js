// 매치 재생 계층 — IF 매치 화면(match.js)과 커리어 매치데이가 공유한다.
//
// 중요한 소유권 규칙: 재생 타이머(activeTimerId)와 스티어링 rAF(activeRafId)는 반드시
// 이 모듈 하나만 소유한다. 라우터에 unmount 훅이 없어서 화면을 떠나도 루프가 살아남는
// 문제를 "진입 시 정리"로 막고 있는데, 두 화면이 각자 타이머를 들면 그 장치가 이원화되어
// 서로의 고아 루프를 못 죽인다 — 추출 시 이 변수들을 셸에 남기지 않은 이유.
//
// goal 19(2D/3D 듀얼 렌더러) 1단계: 컨트롤러(이벤트/타이머/물리 계산)와 "피치 안에
// 그리는 것"을 PitchBackend 인터페이스로 분리했다. 백엔드는 타이머/rAF를 절대 소유하지
// 않고(syncFrame 안에서 그리기만), 프레임 데이터는 전부 % 논리 좌표다. HUD(스코어보드/
// 커멘터리/컨트롤바)는 2D/3D 무관 DOM이라 셸에 남는다.
//
// resolvePlayer 주입: 커리어에는 DB에 없는 필러 선수가 있어서(findCareerPlayer),
// 커멘터리/뱃지가 db findPlayer를 직접 쓰면 필러 등장 순간 크래시한다.

import { eventCommentary } from '../sim/commentary.js'
import { possessionTeamOf } from '../sim/event-types.js'
import { computeTarget, computeFlexTarget, computeOverrideTarget, springStep, MAX_SUBSTEP } from './steering.js'
import {
  restState, flightToTokenState, flightToPointState,
  advanceBall, ballPosition, settleBall,
} from './ballFlight.js'
import { createDomPitchBackend } from './pitchRenderer.dom.js'
import { getRendererPref, setRendererPref } from './rendererPref.js'

// formations.js 좌표계(y=0 자기골~100 상대골)를 공유 필드의 화면 top%로 바꾼다.
// 슬롯 배치와 이벤트(공) 위치 계산이 반드시 이 한 함수만 거치게 해서 좌우 팀이
// 뒤바뀌는 리스크를 한 곳에서만 검증한다. (실측: 홈 골=top 8%, 원정 골=top 92%.)
export function screenTop(formationY, team) {
  return team === 'A' ? 100 - formationY : formationY
}

const BAND_Y = { DEFENSE: 8, OWN_MID: 27, OPP_MID: 52, FINAL_THIRD: 75, BOX: 92 }
const CHANNEL_X = { LEFT: 22, CENTER: 50, RIGHT: 78 }

// 리플레이 컷 시작점 — From 필드가 있으면 거기서, 없으면 이벤트 지점에서 시작.
function replayStartPos(event) {
  const channel = event.channelFrom ?? event.channel ?? event.channelTo
  const zone = event.zoneFrom ?? event.zoneTo
  if (channel && zone) return { left: CHANNEL_X[channel], top: screenTop(BAND_Y[zone], event.team) }
  return eventPosition(event)
}

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

// 재생 타이머/rAF/활성 백엔드 — 모듈 스코프 단일 소유(파일 상단 주석 참고).
// 백엔드 destroy까지 여기서 담당: 화면 진입부의 clearActivePlayback() 호출이 곧
// 이전 화면 백엔드의 자원 해제 지점이다(3D WebGL 컨텍스트 누수 방어 — goal 19 3단계).
let activeTimerId = null
let activeRafId = null
let activeBackend = null

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
  if (activeBackend !== null) {
    activeBackend.destroy() // 멱등 — 이중 호출 안전이 백엔드 계약
    activeBackend = null
  }
}

function withSlotPositions(squad11, formation) {
  return squad11.map(({ player, slotIndex }) => ({ player, slot: formation.slots[slotIndex] }))
}

// 이벤트 로그 재생 컨트롤러 — 사전계산 후 리플레이. 물리/타깃 계산 전부 여기서 하고
// backend.syncFrame(frame)에 "그릴 것"만 넘긴다(frame은 % 논리 좌표).
function createPlaybackController(events, refs) {
  const { backend, scoreEl, minuteEl, commentaryEl, onPhaseChange, steeringRefs, tacticsBySide, resolvePlayer } = refs
  let index = 0
  let speed = 1
  const score = { home: 0, away: 0 }
  let possessionTeam = null
  let lastFrameTime = null

  let ballState = restState({ left: 50, top: 50 })
  let ballScreenPos = { left: 50, top: 50 }
  // 골 리플레이: 득점 체인 구간을 0.4x로 1회 재적용(visualOnly — 점수/기록 불변).
  let replayQueue = []
  let replayIntro = false
  let replayEnding = false
  let timeScale = 1
  const pullOverrides = new Map()
  let activeFlair = null
  let celebration = null

  const refsById = new Map(steeringRefs.map((ref) => [ref.playerId, ref]))
  const resolveTokenPos = (playerId) => {
    const ref = refsById.get(playerId)
    return ref ? ref.current : null
  }

  // 그리기 직전 좌표 확정까지가 컨트롤러 책임 — 룰렛 오프셋이 ballScreenPos로
  // 피드백되어 스티어링 타깃/다음 비행 시작점에 쓰이므로 백엔드로 옮기면 거동이 변한다.
  function currentBall() {
    let pos = ballPosition(ballState, resolveTokenPos)
    if (pos && activeFlair?.type === 'roulette' && ballState.mode === 'held'
        && ballState.holderId === activeFlair.actorId) {
      const theta = (activeFlair.elapsedMs / activeFlair.durationMs) * Math.PI * 2
      pos = { left: pos.left + Math.cos(theta) * 1.4, top: pos.top + Math.sin(theta) * 1.4 }
    }
    if (pos) ballScreenPos = pos
    const inFlight = ballState.mode === 'flight' || ballState.mode === 'flightToPoint'
    return {
      pos: { ...ballScreenPos },
      mode: ballState.mode,
      holderId: ballState.mode === 'held' ? ballState.holderId : '',
      toId: ballState.mode === 'flight' ? ballState.toId : '',
      // 비행 진행률 — 2D는 아크 스케일, 3D는 실제 높이로 해석(백엔드가 결정).
      flightT: inFlight ? Math.min(1, ballState.elapsedMs / ballState.durationMs) : null,
    }
  }

  function syncFrame() {
    backend.syncFrame({
      tokens: steeringRefs,
      ball: currentBall(),
    })
  }

  function stepFrame(now) {
    if (!backend.isLive()) { activeRafId = null; return }
    const deltaSeconds = lastFrameTime === null ? 0 : Math.min((now - lastFrameTime) / 1000, 0.1)
    lastFrameTime = now

    const frameMs = deltaSeconds * 1000 * speed * timeScale
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
    // 오프볼 유연성: 포제션 팀에서 볼과 가까운 아군 2명(보유자·GK 제외)이 지원 런.
    const holderId = ballState.mode === 'held' ? ballState.holderId : null
    const supportIds = possessionTeam === null ? [] : steeringRefs
      .filter((r) => r.team === possessionTeam && !r.isGK && r.playerId !== holderId)
      .map((r) => ({ id: r.playerId, d: Math.hypot(r.current.left - ballScreenPos.left, r.current.top - ballScreenPos.top) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((x) => x.id)

    for (const ref of steeringRefs) {
      let target
      if (scorerRef && ref.team === celebration.team && !ref.isGK && ref.playerId !== celebration.scorerId) {
        target = { ...scorerRef.current }
      } else {
        const override = pullOverrides.get(ref.playerId)
        target = override
          ? computeOverrideTarget(ref.basePos, override)
          : computeFlexTarget(ref.basePos, ballScreenPos, ref.team, ref.team === possessionTeam, {
            supportRank: supportIds.indexOf(ref.playerId) === -1 ? null : supportIds.indexOf(ref.playerId),
            overlap: ref.team === possessionTeam && !ref.isGK
              && (ref.team === 'A' ? ref.basePos.top > 66 : ref.basePos.top < 34)
              && (ref.basePos.left < 32 || ref.basePos.left > 68)
              && Math.abs(ballScreenPos.left - ref.basePos.left) < 30,
          })
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
    }
    ballState = advanceBall(ballState, frameMs)
    syncFrame()
    activeRafId = requestAnimationFrame(stepFrame)
  }

  function startSteering() {
    clearActiveRaf()
    lastFrameTime = null
    backend.beginPlayback()
    activeRafId = requestAnimationFrame(stepFrame)
  }

  function snapPlayersToTarget() {
    backend.beginPlayback()
    for (const ref of steeringRefs) {
      const override = pullOverrides.get(ref.playerId)
      ref.current = override
        ? computeOverrideTarget(ref.basePos, override)
        : computeTarget(ref.basePos, ballScreenPos, ref.team, ref.team === possessionTeam)
      ref.velocity = { left: 0, top: 0 }
    }
    ballState = settleBall(ballState)
    syncFrame()
  }

  function applyEvent(event, { visualOnly = false } = {}) {
    possessionTeam = possessionTeamOf(event)
    if (!visualOnly) minuteEl.textContent = `${event.minute}'`

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

    syncFrame()

    if (event.type === 'turnover_buildup') {
      backend.applyEventVisual({ kind: 'lunge', playerId: event.actorId })
      const tackleSpecialist = event.cause === 'tackle'
        && resolvePlayer(event.actorId)?.traits?.includes('tackle_specialist')
      backend.applyEventVisual({
        kind: 'miniPop', pos: eventPos,
        text: tackleSpecialist ? '⭐ 태클 장인!' : event.cause === 'tackle' ? '태클!' : '인터셉트!',
      })
    } else if (event.type === 'foul') {
      backend.applyEventVisual({ kind: 'lunge', playerId: event.actorId })
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: event.dangerous ? '파울! 위험한 위치' : '파울' })
    } else if (event.type === 'free_kick'
        && resolvePlayer(event.takerId)?.traits?.includes('free_kick_specialist')) {
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: '⭐ 프리킥 장인' })
    } else if ((event.type === 'goal' || event.type === 'shot_saved')
        && (event.via === 'header_corner' || event.via === 'header_fk')
        && resolvePlayer(event.actorId)?.traits?.includes('aerial_threat')) {
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: '⭐ 공중 지배' })
    } else if (event.type === 'clearance') {
      backend.applyEventVisual({ kind: 'lunge', playerId: event.actorId })
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: '걷어냄!' })
    } else if (event.type === 'offside') {
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: '오프사이드' })
    }

    if (event.type === 'goal') {
      if (!visualOnly) {
        if (event.team === 'A') score.home++
        else score.away++
        scoreEl.textContent = `${score.home} - ${score.away}`
      }
      celebration = { team: event.team, scorerId: event.actorId, remainingMs: 1400 }
      backend.applyEventVisual({ kind: 'flash', variant: 'goal', text: 'GOAL!' })
    } else if (event.type === 'yellow_card') {
      backend.applyEventVisual({ kind: 'flash', variant: 'yellow', text: '' })
    } else if (event.type === 'red_card') {
      backend.applyEventVisual({ kind: 'flash', variant: 'red', text: '' })
      backend.applyEventVisual({ kind: 'sendOff', playerId: event.actorId })
    }

    if (visualOnly) return // 리플레이는 화면 연출만 — 기록(커멘터리 포함)은 본 재생의 몫
    const text = eventCommentary(event, resolvePlayer)
    if (text) pushLine(text, { goal: event.type === 'goal' })
  }

  function pushLine(text, { goal = false } = {}) {
    const line = document.createElement('div')
    line.className = 'match__commentary-line'
    if (goal) line.classList.add('match__commentary-line--goal')
    line.textContent = text
    commentaryEl.appendChild(line)
    commentaryEl.scrollTop = commentaryEl.scrollHeight
  }

  const REPLAY_TIME_SCALE = 0.4
  const REPLAY_SEGMENT_MAX = 4

  function tick() {
    if (!backend.isLive()) { clearActivePlayback(); return }
    if (replayEnding) { timeScale = 1; replayEnding = false }

    // 골 리플레이 구간 — 본 재생을 멈추고 같은 체인을 슬로모로 재적용.
    if (replayIntro) {
      replayIntro = false
      backend.applyEventVisual({ kind: 'flash', variant: 'replay', text: 'REPLAY' })
      const startPos = replayStartPos(replayQueue[0])
      ballScreenPos = { ...startPos }
      ballState = restState(startPos)
      timeScale = REPLAY_TIME_SCALE
      activeTimerId = setTimeout(tick, 700 / speed)
      return
    }
    if (replayQueue.length > 0) {
      const replayEvent = replayQueue.shift()
      applyEvent(replayEvent, { visualOnly: true })
      if (replayQueue.length === 0) replayEnding = true
      activeTimerId = setTimeout(tick, delayFor(replayEvent) / (speed * timeScale))
      return
    }

    if (index === 0) pushLine("0' 킥오프! 경기가 시작된다")
    if (index >= events.length) {
      clearActiveTimer()
      clearActiveRaf()
      pushLine(`90' 경기 종료 — 최종 스코어 ${score.home} - ${score.away}`)
      onPhaseChange('done')
      return
    }
    const event = events[index]
    applyEvent(event)
    index++
    if (event.type === 'goal') {
      const segment = events.filter((e) => e.chainId === event.chainId)
      replayQueue = segment.slice(Math.max(0, segment.length - REPLAY_SEGMENT_MAX))
      replayIntro = true
      pushLine('📺 골 리플레이')
    }
    activeTimerId = setTimeout(tick, delayFor(event) / speed)
  }

  function resetVisuals() {
    ballState = restState({ left: 50, top: 50 })
    ballScreenPos = { left: 50, top: 50 }
    replayQueue = []
    replayIntro = false
    replayEnding = false
    timeScale = 1
    pullOverrides.clear()
    activeFlair = null
    celebration = null
    possessionTeam = null
    minuteEl.textContent = "0'"
    scoreEl.textContent = '0 - 0'
    commentaryEl.replaceChildren()
    score.home = 0
    score.away = 0
    for (const ref of steeringRefs) {
      ref.current = { ...ref.basePos }
      ref.velocity = { left: 0, top: 0 }
    }
    backend.reset()
    syncFrame()
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
      replayQueue = []
      replayIntro = false
      replayEnding = false
      timeScale = 1
      pushLine(`90' 경기 종료 — 최종 스코어 ${score.home} - ${score.away}`)
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

// 재생 뷰 전체 조립 — 스코어보드/피치(백엔드)/커멘터리/컨트롤바.
// onKickoffRequest(): 컨트롤러가 아직 없을 때 킥오프를 누르면 호출 — 셸이 setResult로 응답
// (IF는 이때 새 시뮬, 커리어는 미리 계산된 고정 시드 결과 전달). onPhase(phase): 'playing'|
// 'paused'|'done' — 셸이 부가 UI(결과 링크 등)를 제어.
export function buildPlaybackView({
  homeSquad11, homeFormation, awaySquad11, awayFormation,
  tacticsBySide, resolvePlayer, onKickoffRequest, onPhase,
  // 팀 구분(사용자 지적: 홈/원정 분간 불가): 뱃지 테두리+이름+스코어보드 태그에 반영.
  teamColors = { A: 'var(--accent-gold)', B: 'var(--club-glacier)' },
  teamLabels = { A: '홈', B: '원정' },
}) {
  const scoreboard = document.createElement('div')
  scoreboard.className = 'match__scoreboard'
  const makeTeamTag = (team) => {
    const tag = document.createElement('span')
    tag.className = 'match__team-tag'
    const dot = document.createElement('span')
    dot.className = 'match__team-dot'
    dot.style.background = teamColors[team]
    const label = document.createElement('span')
    label.textContent = teamLabels[team]
    tag.append(dot, label)
    return tag
  }
  const center = document.createElement('span')
  center.className = 'match__scoreboard-center'
  const minuteEl = document.createElement('span')
  minuteEl.className = 'match__minute'
  minuteEl.textContent = "0'"
  const scoreEl = document.createElement('span')
  scoreEl.className = 'match__score'
  scoreEl.textContent = '0 - 0'
  center.append(minuteEl, scoreEl)
  scoreboard.append(makeTeamTag('A'), center, makeTeamTag('B'))

  // 토큰(선수) 목록 — 백엔드 mount 입력이자 컨트롤러 스티어링 레코드의 원천.
  // 논리 필드(스티어링)는 컨트롤러가, DOM 요소는 백엔드가 갖는다(경계 원칙).
  const tokens = []
  const steeringRefs = []
  const pushTeam = (squad11, formation, team) => {
    for (const entry of withSlotPositions(squad11, formation)) {
      const basePos = { left: entry.slot.x, top: screenTop(entry.slot.y, team) }
      tokens.push({ playerId: entry.player.id, player: entry.player, team, basePos })
      steeringRefs.push({
        basePos, team, playerId: entry.player.id,
        pace: entry.player.stats.pace,
        dribbling: entry.player.stats.dribbling,
        isGK: entry.player.positions.includes('GK'),
        idlePhase: steeringRefs.length * 1.7,
        current: { ...basePos }, velocity: { left: 0, top: 0 },
      })
    }
  }
  pushTeam(homeSquad11, homeFormation, 'A')
  pushTeam(awaySquad11, awayFormation, 'B')

  let backend = createDomPitchBackend()
  backend.mount({ tokens, teamColors })
  activeBackend = backend

  const commentary = document.createElement('div')
  commentary.className = 'match__commentary'

  let controller = null
  let paused = false
  let lastResult = null
  let playbackPhase = 'idle' // 'idle'|'playing'|'paused'|'done' — 렌더러 전환 허용 판정용

  function setPhase(phase) {
    playbackPhase = phase
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

  // 피치+커멘터리를 한 스테이지로 묶는다 — 와이드 화면에서 나란히(실시간 채팅 느낌),
  // 좁은 화면에선 세로 스택(css/match-view.css 미디어쿼리). 사용자 지적 반영.
  const stage = document.createElement('div')
  stage.className = 'match__stage'
  stage.append(backend.root, commentary)

  // 백엔드 전용 컨트롤(2D의 '입체 뷰' 틸트 등) — 스왑 시 함께 갈아끼운다.
  let extraControlEls = []
  function mountExtraControls() {
    for (const el of extraControlEls) el.remove()
    extraControlEls = backend.extraControls ?? []
    for (const control of extraControlEls) ui.bar.appendChild(control)
  }

  // ---------- 렌더러 전환(goal 19): [2D 클래식 | 3D 스타디움] ----------
  // 킥오프 전(idle)과 done에서만 허용 — 재생 중 상태 이식은 v2로 미룬다(설계 결정).
  // 3D 모듈은 선택 시에만 dynamic import(2D 사용자 다운로드 비용 0). 실패 시 2D 폴백.
  const modeBtns = {}
  let swapping = false
  async function swapTo(mode) {
    if (swapping || (playbackPhase === 'playing' || playbackPhase === 'paused')) return
    const current = backend.root.classList.contains('match__pitch3d') ? '3d' : '2d'
    if (mode === current) return
    swapping = true
    ui.kickoffBtn.disabled = true
    try {
      let nextBackend
      if (mode === '3d') {
        const { createThreePitchBackend } = await import('./pitchRenderer.three.js')
        nextBackend = createThreePitchBackend()
      } else {
        nextBackend = createDomPitchBackend()
      }
      nextBackend.mount({ tokens, teamColors })
      const oldRoot = backend.root
      backend.destroy()
      backend = nextBackend
      activeBackend = backend
      stage.replaceChild(backend.root, oldRoot)
      backend.beginPlayback()
      mountExtraControls()
      setRendererPref(mode)
      // done 상태였다면 같은 이벤트 로그를 새 백엔드로 재생할 컨트롤러 재생성
      // ('다시보기' 대기 — 자동 재생하지 않는다).
      if (controller && lastResult) {
        controller = makeController(lastResult)
      }
      Object.entries(modeBtns).forEach(([key, btn]) => btn.classList.toggle('chip--active', key === mode))
    } catch (err) {
      console.error('3D 렌더러 로드 실패 — 2D 유지:', err)
    } finally {
      swapping = false
      ui.kickoffBtn.disabled = playbackPhase === 'playing'
    }
  }

  const modeWrap = document.createElement('div')
  modeWrap.className = 'match__speed-group'
  for (const [mode, label] of [['2d', '2D'], ['3d', '3D']]) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'chip' + (mode === '2d' ? ' chip--active' : '')
    btn.textContent = label
    btn.addEventListener('click', () => swapTo(mode))
    modeBtns[mode] = btn
    modeWrap.appendChild(btn)
  }
  ui.bar.appendChild(modeWrap)
  mountExtraControls()

  function makeController(result) {
    return createPlaybackController(result.events, {
      backend, scoreEl, minuteEl, commentaryEl: commentary,
      onPhaseChange: setPhase, steeringRefs, tacticsBySide, resolvePlayer,
    })
  }

  // 저장된 선호가 3D면 초기 진입에서 전환(비동기 — 로드 완료 전 킥오프 disabled).
  if (getRendererPref() === '3d') swapTo('3d')

  return {
    scoreboard, pitch: backend.root, commentary, stage, controlsBar: ui.bar,
    // 결과 장착(+즉시 재생 시작). IF 재대결은 새 결과로 다시 호출하면 된다.
    setResult(result) {
      lastResult = result
      controller = makeController(result)
      controller.start()
    },
    hasController: () => controller !== null,
  }
}
