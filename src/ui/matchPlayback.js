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
  restState, flightToTokenState, flightToPointState, flightCurlState,
  advanceBall, ballPosition, settleBall,
} from './ballFlight.js'
import { createDomPitchBackend } from './pitchRenderer.dom.js'
import { getRendererPref, setRendererPref } from './rendererPref.js'
import { matchSound, enableSound, disableSound, isSoundOn } from './soundManager.js'

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
// x1 기본 체감 완화(사용자 확정: 숏패스 260→340 등 ~1.25배 — 초당 이벤트 수 감소).
const DELAY_MS = {
  pass: 520, carry: 820, turnover_buildup: 660,
  shot_saved: 820, shot_off_target: 820, goal: 1600,
  foul: 820, free_kick: 950, corner_kick: 1000, clearance: 760, offside: 900,
  yellow_card: 1050, red_card: 1300, penalty_awarded: 1300,
}
const SHORT_PASS_DELAY_MS = 340
const FLIGHT_RATIO = 0.88
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
  let { backend } = refs
  const { scoreEl, minuteEl, commentaryEl, onPhaseChange, steeringRefs, tacticsBySide, resolvePlayer } = refs
  let index = 0
  let speed = 1
  const score = { home: 0, away: 0 }
  let lastMinute = 0 // 전광판(3D) 미러용 — applyEvent에서 갱신
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
  const strongPullIds = new Set() // 세트피스 쇄도 등 강풀(캡 큰) override 대상

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

  const SEP_RANGE = 5.2 // % — 이 범위 안에서 거리 반비례 연속 반발(하드 임계 없음)
  const SEP_STRENGTH = 2.6 // 목표를 밀어내는 최대 세기(d→0일 때)

  // 연속 반발을 목표 지점에 적용 — current 직접 수정(톱니 진동)이 아니라 목표를 벌려
  // 스프링이 부드럽게 수렴하게 한다. 거리 반비례라 안정 평형점이 생겨 flicker가 없다.
  function separateTargets(targets, holderId) {
    const inCelebration = celebration !== null
    // 반발 제외 대상:
    // - 홀더(볼 지터 방지), 셀레머니 군집(의도된 몰림)
    // - GK(골문 앞 고정 — 세트피스로 박스에 몰린 선수들과 반발하면 부르르 떨림. 계측으로
    //   확인: 코너 경기에서 양 팀 GK가 진동 top이었다)
    // - 세트피스 쇄도 선수(strongPullIds — 박스 밀집은 의도된 대형이라 서로 밀치면 안 됨)
    // 완전 제외(반발 소스도 대상도 아님): 홀더(볼 지터 방지), 셀레머니 군집·세트피스 쇄도
    // (의도된 몰림). GK는 여기서 제외하지 않는다 — GK는 반발 "소스"로 남겨 상대 공격수를
    // 밀어낸다(안 그러면 공격수가 골키퍼를 뚫고 지나간다). GK 자신은 아래 push 가드로
    // 안 밀린다(골문 앞 앵커 유지 — 진동은 이미 GK target 앵커가 막는다).
    const skip = (ref) => ref.playerId === holderId
      || strongPullIds.has(ref.playerId)
      || (inCelebration && ref.team === celebration.team)
    const push = steeringRefs.map(() => ({ left: 0, top: 0 }))
    for (let i = 0; i < steeringRefs.length; i++) {
      if (skip(steeringRefs[i])) continue
      for (let j = i + 1; j < steeringRefs.length; j++) {
        if (skip(steeringRefs[j])) continue
        const dx = steeringRefs[j].current.left - steeringRefs[i].current.left
        const dy = steeringRefs[j].current.top - steeringRefs[i].current.top
        const d = Math.hypot(dx, dy)
        if (d < SEP_RANGE && d > 0.001) {
          const force = SEP_STRENGTH * (1 - d / SEP_RANGE) // 거리 반비례 연속
          const nx = dx / d
          const ny = dy / d
          // GK는 밀리지 않는다(앵커) — 상대만 GK로부터 밀려나 통과가 막힌다.
          if (!steeringRefs[i].isGK) { push[i].left -= nx * force; push[i].top -= ny * force }
          if (!steeringRefs[j].isGK) { push[j].left += nx * force; push[j].top += ny * force }
        }
      }
    }
    // 저역통과 필터(EMA) — 3명+ 밀집이면 반발이 A↔B↔C 순환하며 진동하는데(리밋사이클),
    // 프레임간 스무딩으로 고주파 떨림을 걸러 안정값으로 수렴시킨다("부르르 떨림" 제거).
    steeringRefs.forEach((ref, idx) => {
      const prev = ref.sepPrev ?? { left: 0, top: 0 }
      const sm = { left: prev.left * 0.6 + push[idx].left * 0.4, top: prev.top * 0.6 + push[idx].top * 0.4 }
      ref.sepPrev = sm
      targets[idx].left += sm.left
      targets[idx].top += sm.top
    })
  }

  function syncFrame(dtMs = 0) {
    backend.syncFrame({
      tokens: steeringRefs,
      ball: currentBall(),
      dtMs, // 백엔드 모션 시계(3D 달리기 스윙 등) — 배속/리플레이 슬로모 자동 반영
      score: { home: score.home, away: score.away }, // 3D 전광판 미러(2D는 무시)
      minute: lastMinute,
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
    // 침투 러너 — 소유 팀에서 가장 전진한 비홀더 1명이 수비 배후로 대각 런(빈 공간 노림).
    // 지원런(볼 쪽 붙기)과 달리 볼 반대 채널로 벌리며 앞으로 — 정적 대형에 종적 위협을 만든다.
    const penetratorId = possessionTeam === null ? null : steeringRefs
      .filter((r) => r.team === possessionTeam && !r.isGK && r.playerId !== holderId && !supportIds.includes(r.playerId))
      .map((r) => ({ id: r.playerId, adv: possessionTeam === 'A' ? -r.basePos.top : r.basePos.top }))
      .sort((a, b) => b.adv - a.adv)[0]?.id ?? null

    // 1패스 — 각 선수의 목표 지점 계산(아직 이동 안 함). idle 워블은 약하게(±0.2/0.18)로
    // 낮춰 "부르르 떨림"을 줄인다(진동 지표 기반 조정).
    const targets = steeringRefs.map((ref) => {
      if (scorerRef && ref.team === celebration.team && !ref.isGK && ref.playerId !== celebration.scorerId) {
        return { ...scorerRef.current }
      }
      const override = pullOverrides.get(ref.playerId)
      let target
      if (override) {
        target = computeOverrideTarget(ref.basePos, override, strongPullIds.has(ref.playerId) ? 70 : undefined)
      } else if (ref.isGK) {
        // GK는 골문 앞 — 볼의 좌우 각도만 완만히 커버하고 전후(top)는 고정한다. 필드 스티어링
        // (라인시프트/볼쏠림)을 그대로 받으면 볼이 오갈 때마다 골문 앞에서 부르르 떤다(계측:
        // GK가 진동 top에 반복 등장). 골키퍼는 자리를 지키는 게 자연스럽다.
        target = { left: ref.basePos.left + (ballScreenPos.left - 50) * 0.12, top: ref.basePos.top }
      } else {
        target = computeFlexTarget(ref.basePos, ballScreenPos, ref.team, ref.team === possessionTeam, {
          supportRank: supportIds.indexOf(ref.playerId) === -1 ? null : supportIds.indexOf(ref.playerId),
          penetrate: ref.playerId === penetratorId,
          overlap: ref.team === possessionTeam && !ref.isGK
            && (ref.team === 'A' ? ref.basePos.top > 66 : ref.basePos.top < 34)
            && (ref.basePos.left < 32 || ref.basePos.left > 68)
            && Math.abs(ballScreenPos.left - ref.basePos.left) < 30,
        })
      }
      target = {
        left: target.left + Math.sin(now / 1600 + ref.idlePhase) * 0.2,
        top: target.top + Math.cos(now / 1900 + ref.idlePhase) * 0.18,
      }
      if (activeFlair?.type === 'weave' && activeFlair.actorId === ref.playerId) {
        const dx = target.left - ref.current.left
        const dy = target.top - ref.current.top
        const len = Math.hypot(dx, dy) || 1
        const wobble = Math.sin(activeFlair.elapsedMs / 70) * activeFlair.amp
        target = { left: target.left + (-dy / len) * wobble, top: target.top + (dx / len) * wobble }
      }
      return target
    })

    // 충돌 회피(separation) — 연속 반발을 **목표 지점**에 적용한다. 이전엔 current를 직접
    // 밀어 velocity와 불일치 → 스프링이 당기고 반발이 밀고 하는 톱니 진동("부르르 떨림",
    // ablation으로 반전 9.5→4.8 확인). 목표에 걸면 스프링이 밀린 목표로 임계감쇠 수렴하고,
    // on/off 하드 임계 대신 거리 반비례 연속 힘이라 flicker가 원천 소거된다(advisor 권장).
    // 볼 홀더·셀레머니 군집은 제외(홀더는 볼 지터 방지, 셀레머니는 의도된 몰림).
    separateTargets(targets, holderId)

    // 2패스 — 목표로 스프링 이동.
    steeringRefs.forEach((ref, idx) => {
      const target = targets[idx]
      for (let s = 0; s < substeps; s++) {
        const result = springStep(ref.current, ref.velocity, target, ref.pace, subDt, speed)
        ref.current = result.current
        ref.velocity = result.velocity
      }
    })

    ballState = advanceBall(ballState, frameMs)
    syncFrame(frameMs)
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

  // 슛 비행 — finishType별로 곡선(감아차기)·비행시간(중거리는 더 길게)을 다르게.
  // toTarget이 문자열(gkId)이면 토큰 호밍, 객체({left,top})면 지점.
  // 슛 채널로 다이빙 방향 결정(LEFT/RIGHT/중앙). 스티어링 refs에서 GK id 조회.
  function saveDir(event) {
    return event.channel === 'LEFT' ? -1 : event.channel === 'RIGHT' ? 1 : 0
  }
  function goalkeeperIdOf(team) {
    const gk = steeringRefs.find((r) => r.team === team && r.isGK)
    return gk ? gk.playerId : null
  }

  function shotFlight(event, from, toTarget, baseMs, toToken) {
    const isCurl = event.finishType === 'curl'
    const isLong = event.finishType === 'long_range'
    const ms = isLong ? baseMs * 1.4 : baseMs
    // 중거리는 볼 시작점을 슈터 존점(밴드3)으로 물린다 — ballScreenPos(직전 볼=박스 배달
    // 지점)에서 쏘면 "슈터는 중앙, 볼은 골문 앞" 순간이동 인상이 남는다(렌더만, 판정 무관).
    const start = isLong ? eventPosition(event) : from
    if (toToken) return flightToTokenState(start, toTarget, ms)
    if (isCurl) {
      const bend = (event.channel === 'LEFT' ? 1 : event.channel === 'RIGHT' ? -1 : (event.minute % 2 ? 1 : -1)) * 9
      return flightCurlState(start, toTarget, ms, bend)
    }
    return flightToPointState(start, toTarget, ms)
  }

  // 세트피스 크라우드 판정 — 코너/FK크로스(공 비행)와 그 헤더 종결(via)까지 대형 유지.
  function isSetPieceCrowd(event) {
    return event.type === 'corner_kick'
      || (event.type === 'free_kick' && event.variant === 'cross')
      || event.via === 'header_corner' || event.via === 'header_fk'
  }

  // 세트피스 쇄도 — 공격 지정 인원을 상대 박스로, 수비를 자기 박스로(양팀 같은 박스=공격
  // 진영 골문). 강풀(strongPullIds)로 캡을 키워 먼 선수도 도달. pullOverrides가 매 이벤트
  // clear라 self-expiring(헤더 종결 다음 오픈플레이에서 자연 해제).
  function setPieceCrowd(event) {
    const attackTeam = event.team // 세트피스 event.team = 공격(소유)팀
    const defendTeam = attackTeam === 'A' ? 'B' : 'A'
    const boxTop = screenTop(BAND_Y.BOX, attackTeam) // 양팀 모이는 공격 진영 박스
    const laneX = [CHANNEL_X.LEFT, CHANNEL_X.CENTER, CHANNEL_X.RIGHT, 36, 64]
    const attackers = steeringRefs
      .filter((r) => r.team === attackTeam && !r.isGK && !pullOverrides.has(r.playerId))
      .map((r) => ({ r, fwd: attackTeam === 'A' ? -r.basePos.top : r.basePos.top })) // 전방일수록 큼
      .sort((a, b) => b.fwd - a.fwd) // 전방 선수(공격수·윙어) 우선 박스 쇄도
      .slice(0, 4)
    attackers.forEach(({ r }, i) => {
      pullOverrides.set(r.playerId, { left: laneX[i % laneX.length], top: boxTop })
      strongPullIds.add(r.playerId)
    })
    const defenders = steeringRefs
      .filter((r) => r.team === defendTeam && !r.isGK && !pullOverrides.has(r.playerId))
      .map((r) => ({ r, d: Math.abs(r.basePos.top - boxTop) }))
      .sort((a, b) => a.d - b.d) // 이미 박스 가까운 수비 우선
      .slice(0, 5)
    defenders.forEach(({ r }, i) => {
      pullOverrides.set(r.playerId, { left: laneX[(i + 1) % laneX.length], top: boxTop })
      strongPullIds.add(r.playerId)
    })
  }

  function applyEvent(event, { visualOnly = false } = {}) {
    possessionTeam = possessionTeamOf(event)
    if (!visualOnly) { minuteEl.textContent = `${event.minute}'`; lastMinute = event.minute }

    // 킥 모션 트리거 — 비행 전이 직전의 보유자(볼을 보내는 발).
    const kickerId = ballState.mode === 'held' ? ballState.holderId : null

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
      matchSound('chance')
    } else if (event.type === 'penalty_awarded') {
      ballState = flightToPointState(ballScreenPos, penaltySpotOf(event.team === 'A' ? 'B' : 'A'), flightMs)
    } else if (event.type === 'shot_saved') {
      ballState = shotFlight(event, ballScreenPos, event.gkId, flightMs, true)
    } else if (event.type === 'goal' || event.type === 'shot_off_target') {
      ballState = shotFlight(event, ballScreenPos, goalMouthOf(event.team), flightMs, false)
    }

    if (kickerId && (ballState.mode === 'flight' || ballState.mode === 'flightToPoint' || ballState.mode === 'flightCurl')) {
      // 킥 강도 차등(실플레이 진단: 숏패스도 큰 발차기라 부자연) — 숏패스=가볍게 툭,
      // 롱패스/드리블 터치=중간, 슛/롱킥=강하게. 3D가 kickPower로 스윙 크기를 조절한다.
      const power = event.type === 'pass'
        ? (event.style === 'short' ? 0.35 : event.style === 'long' ? 1 : 0.6)
        : (event.type === 'carry' ? 0.3 : 1)
      backend.applyEventVisual({ kind: 'kick', playerId: kickerId, power })
      if (event.type !== 'pass' || event.style === 'long') matchSound('kick')
    }
    // 패스 수신자 마중 — flight 동안 볼 쪽으로 살짝 나오고 도착 시 트래핑(볼이 알아서
    // 발에 붙던 인상 제거). pass/carry/free_kick의 수신 토큰을 볼 궤적 쪽으로 당긴다.
    const receiverId = event.type === 'pass' ? event.toId
      : (event.type === 'carry' || event.type === 'clearance' || event.type === 'offside') ? event.actorId
      : event.type === 'free_kick' ? event.takerId
      : null
    if (receiverId) backend.applyEventVisual({ kind: 'receive', playerId: receiverId })

    // GK 반응 — 선방(볼 쪽 다이빙)/실점(반대편 헛손질). 볼이 어느 채널로 오는지로 방향.
    if (event.type === 'shot_saved' && event.gkId) {
      backend.applyEventVisual({ kind: 'save', playerId: event.gkId, dir: saveDir(event) })
    } else if (event.type === 'goal') {
      const conceding = goalkeeperIdOf(event.team === 'A' ? 'B' : 'A')
      if (conceding) backend.applyEventVisual({ kind: 'save', playerId: conceding, dir: saveDir(event), beaten: true })
    }

    pullOverrides.clear()
    strongPullIds.clear()
    const eventPos = event.type === 'corner_kick'
      ? cornerSpotOf(event.team, event.side)
      : eventPosition(event)
    const puller = pullActorOf(event)
    if (puller) pullOverrides.set(puller, eventPos)
    // 슛류 — GK를 볼 도착점(골문/세이브 지점) 쪽으로 살짝 당겨 반응하게(제자리 정지 해소).
    if (event.type === 'goal' || event.type === 'shot_off_target' || event.type === 'shot_saved') {
      const concedeTeam = event.type === 'shot_saved' ? null : (event.team === 'A' ? 'B' : 'A')
      const gkTeam = event.type === 'shot_saved' ? (event.team === 'A' ? 'B' : 'A') : concedeTeam
      const gkId = goalkeeperIdOf(gkTeam)
      if (gkId) pullOverrides.set(gkId, goalMouthOf(event.team))
    }

    // 세트피스 크라우드면 압박 대신 박스 쇄도(양팀 박스로) — 데드볼 긴장.
    if (isSetPieceCrowd(event)) {
      setPieceCrowd(event)
    } else {
    const defendingTeam = possessionTeam === 'A' ? 'B' : 'A'
    const pressing = tacticsBySide?.[defendingTeam]?.pressing ?? 0.5
    // 압박은 상시 2인 협응(고압박이면 3인) — 첫째는 볼로 직행, 둘째는 커버 각(볼과 자기 골
    // 사이)을 잡아 겹치지 않는다. 이전엔 pressing>0.66에서만 2명 + 둘 다 같은 점이라 포갬.
    const pursuerCount = pressing > 0.7 ? 3 : 2
    const pursuers = steeringRefs
      .filter((r) => r.team === defendingTeam && !r.isGK && !pullOverrides.has(r.playerId))
      .map((r) => ({ r, d: Math.hypot(r.current.left - eventPos.left, r.current.top - eventPos.top) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, pursuerCount)
    const ownGoalTop = defendingTeam === 'A' ? 0 : 100
    pursuers.forEach(({ r }, i) => {
      if (i === 0) {
        pullOverrides.set(r.playerId, eventPos) // 첫째 — 볼 직접 압박
      } else {
        // 둘째·셋째 — 볼과 자기 골 사이 커버 지점(측면 오프셋으로 스택 방지).
        const side = i === 1 ? 1 : -1
        pullOverrides.set(r.playerId, {
          left: eventPos.left + side * 6,
          top: eventPos.top + (ownGoalTop - eventPos.top) * 0.28,
        })
      }
    })
    }

    if (event.type === 'carry') {
      backend.applyEventVisual({ kind: 'dribble', playerId: event.actorId })
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
        kind: 'miniPop', pos: eventPos, trait: tackleSpecialist,
        text: tackleSpecialist ? '태클 장인!' : event.cause === 'tackle' ? '태클!' : '인터셉트!',
      })
    } else if (event.type === 'foul') {
      backend.applyEventVisual({ kind: 'lunge', playerId: event.actorId })
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: event.dangerous ? '파울! 위험한 위치' : '파울' })
      matchSound('foul')
    } else if (event.type === 'free_kick'
        && resolvePlayer(event.takerId)?.traits?.includes('free_kick_specialist')) {
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: '프리킥 장인', trait: true })
    } else if ((event.type === 'goal' || event.type === 'shot_saved')
        && (event.via === 'header_corner' || event.via === 'header_fk')
        && resolvePlayer(event.actorId)?.traits?.includes('aerial_threat')) {
      backend.applyEventVisual({ kind: 'miniPop', pos: eventPos, text: '공중 지배', trait: true })
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
      // 셀레브레이션(카메라 줌·만세·관중 웨이브)은 본 재생에서만 — 리플레이(visualOnly)가
      // 재점화하면 팔 만세가 루프 정지 시 고착되던 버그의 방아쇠였다.
      if (!visualOnly) {
        celebration = { team: event.team, scorerId: event.actorId, remainingMs: 1400 }
        backend.applyEventVisual({ kind: 'celebrate', playerId: event.actorId })
        matchSound('goal', { homeSide: event.team === 'A' })
      }
      backend.applyEventVisual({ kind: 'flash', variant: 'goal', text: 'GOAL!' })
    } else if (event.type === 'yellow_card') {
      backend.applyEventVisual({ kind: 'flash', variant: 'yellow', text: '' })
      matchSound('card')
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

    if (index === 0) {
      pushLine("0' 킥오프! 경기가 시작된다")
      matchSound('kickoff')
    }
    if (index >= events.length) {
      clearActiveTimer()
      clearActiveRaf()
      pushLine(`90' 경기 종료 — 최종 스코어 ${score.home} - ${score.away}`)
      matchSound('fulltime')
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
    lastMinute = 0
    for (const ref of steeringRefs) {
      ref.current = { ...ref.basePos }
      ref.velocity = { left: 0, top: 0 }
    }
    backend.reset()
    syncFrame()
  }

  return {
    // 재생 중에도 렌더 백엔드만 교체(index/타이머/점수 유지) — 컨트롤러가 다음
    // 프레임부터 새 백엔드에 그린다. 화면 전환의 매끄러움이 목적(사용자 보고).
    swapBackend(nextBackend) {
      backend = nextBackend
      backend.beginPlayback()
      syncFrame(0) // 즉시 1프레임 그려 빈 화면 방지
    },
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
  const speedButtons = [0.5, 1, 2, 4].map((s) => {
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
  // 렌더러 전환 — 재생 중/일시정지/종료/킥오프전 어느 상태에서도 가능(사용자 보고
  // 반영: 이전엔 재생 중 무반응이라 "3D 전환 안 됨"으로 보였다). 재생 중이면 컨트롤러
  // 백엔드만 교체해 index/타이머/점수를 유지하고, 컨트롤러가 없으면(idle/done) 백엔드만
  // 갈아끼운다(done은 '다시보기' 대기).
  async function swapTo(mode) {
    if (swapping) return
    const current = backend.root.classList.contains('match__pitch3d') ? '3d' : '2d'
    if (mode === current) return
    swapping = true
    for (const btn of Object.values(modeBtns)) btn.disabled = true
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
      if (controller) {
        // 재생/일시정지/종료 무관 — 컨트롤러가 새 백엔드로 이어 그린다.
        controller.swapBackend(backend)
      }
      Object.entries(modeBtns).forEach(([key, btn]) => btn.classList.toggle('chip--active', key === mode))
    } catch (err) {
      console.error('3D 렌더러 로드 실패 — 2D 유지:', err)
    } finally {
      swapping = false
      for (const btn of Object.values(modeBtns)) btn.disabled = false
    }
  }

  // 사운드 토글 — AudioContext 시작은 반드시 유저 제스처(이 클릭)에서.
  const soundBtn = document.createElement('button')
  soundBtn.type = 'button'
  soundBtn.className = 'chip' + (isSoundOn() ? ' chip--active' : '')
  soundBtn.textContent = isSoundOn() ? '사운드 켜짐' : '사운드'
  soundBtn.addEventListener('click', async () => {
    if (soundBtn.classList.contains('chip--active')) {
      disableSound()
      soundBtn.classList.remove('chip--active')
      soundBtn.textContent = '사운드'
    } else {
      soundBtn.disabled = true
      await enableSound()
      soundBtn.disabled = false
      soundBtn.classList.add('chip--active')
      soundBtn.textContent = '사운드 켜짐'
    }
  })
  ui.bar.appendChild(soundBtn)
  // 저장된 선호가 on이면 첫 유저 제스처(킥오프 클릭)에서 자동 활성화.
  if (isSoundOn()) {
    ui.kickoffBtn.addEventListener('click', () => { enableSound() }, { once: true })
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
