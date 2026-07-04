// 볼 상태기계의 순수 계산부 (v2 N1 — 허공답보 제거의 핵심). DOM 의존 0.
//
// 원칙: 볼은 항상 (a) 어떤 선수 발밑(held), (b) 어떤 선수를 향해 비행 중(flight —
// 매 프레임 그 선수의 "그 시점" 토큰 위치로 호밍하므로 t=1에 정의상 반드시 도착),
// (c) 고정 지점을 향해 비행 중(flightToPoint — 슛의 골문), (d) 고정 지점에 정지(rest)
// 중 하나다. 추상 그리드 좌표 사이를 떠다니는 상태가 타입 수준에서 존재하지 않는다.
//
// 호밍(b)이 구조적 해법인 이유: 수신자가 스티어링 스프링으로 움직이는 중이어도
// 보간 목표를 매 프레임 실측 토큰 위치로 다시 잡으므로, 도착 순간 볼 위치와 수신자
// 위치가 오차 없이 일치한다 — "볼과 선수가 만나는 그림"이 계산으로 보장된다.

export function restState(pos) {
  return { mode: 'rest', pos: { ...pos } }
}

export function heldState(holderId) {
  return { mode: 'held', holderId }
}

export function flightToTokenState(fromPos, toId, durationMs) {
  return { mode: 'flight', fromPos: { ...fromPos }, toId, elapsedMs: 0, durationMs }
}

export function flightToPointState(fromPos, toPos, durationMs) {
  return { mode: 'flightToPoint', fromPos: { ...fromPos }, toPos: { ...toPos }, elapsedMs: 0, durationMs }
}

// 감아차기 — 직선이 아니라 제어점을 경유하는 2차 베지어(곡선 슛). bend는 좌우 휨 방향·세기.
export function flightCurlState(fromPos, toPos, durationMs, bend) {
  const mid = { left: (fromPos.left + toPos.left) / 2, top: (fromPos.top + toPos.top) / 2 }
  const dx = toPos.left - fromPos.left
  const dy = toPos.top - fromPos.top
  const len = Math.hypot(dx, dy) || 1
  // 진행 방향의 법선으로 제어점을 밀어 곡선을 만든다.
  const ctrl = { left: mid.left + (-dy / len) * bend, top: mid.top + (dx / len) * bend }
  return { mode: 'flightCurl', fromPos: { ...fromPos }, toPos: { ...toPos }, ctrl, elapsedMs: 0, durationMs }
}

// 시간 전진. 비행이 끝나면 자동으로 held(수신자)/rest(지점)로 전이한다.
export function advanceBall(state, dtMs) {
  if (state.mode !== 'flight' && state.mode !== 'flightToPoint' && state.mode !== 'flightCurl') return state
  const elapsedMs = state.elapsedMs + dtMs
  if (elapsedMs >= state.durationMs) {
    return state.mode === 'flight' ? heldState(state.toId) : restState(state.toPos)
  }
  return { ...state, elapsedMs }
}

// 감속 이징 — 패스가 도착 직전에 살짝 죽는 느낌.
function easeOut(t) {
  return 1 - (1 - t) * (1 - t)
}

function lerp(a, b, t) {
  return { left: a.left + (b.left - a.left) * t, top: a.top + (b.top - a.top) * t }
}

// 현재 렌더 위치. resolveTokenPos(playerId) -> {left, top} | null (토큰 실측 위치 제공자).
// held인데 토큰을 못 찾으면 null을 반환한다 — 호출부가 직전 위치를 유지하는 게 옳다
// (여기서 임의 좌표를 지어내면 그게 곧 허공답보다).
export function ballPosition(state, resolveTokenPos) {
  switch (state.mode) {
    case 'rest':
      return state.pos
    case 'held':
      return resolveTokenPos(state.holderId)
    case 'flight': {
      const target = resolveTokenPos(state.toId)
      if (!target) return null
      const t = easeOut(Math.min(1, state.elapsedMs / state.durationMs))
      return lerp(state.fromPos, target, t)
    }
    case 'flightToPoint': {
      const t = easeOut(Math.min(1, state.elapsedMs / state.durationMs))
      return lerp(state.fromPos, state.toPos, t)
    }
    case 'flightCurl': {
      const t = easeOut(Math.min(1, state.elapsedMs / state.durationMs))
      // 2차 베지어: (1-t)²P0 + 2(1-t)t·C + t²P1
      const u = 1 - t
      const left = u * u * state.fromPos.left + 2 * u * t * state.ctrl.left + t * t * state.toPos.left
      const top = u * u * state.fromPos.top + 2 * u * t * state.ctrl.top + t * t * state.toPos.top
      return { left, top }
    }
    default:
      return null
  }
}

// 비행을 즉시 완료한 최종 상태 (스킵용 — 보간 없이 결과만).
export function settleBall(state) {
  if (state.mode === 'flight') return heldState(state.toId)
  if (state.mode === 'flightToPoint' || state.mode === 'flightCurl') return restState(state.toPos)
  return state
}
