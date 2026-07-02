// M8: 22명 선수 토큰이 볼 쪽으로 미세하게 쏠리는 애니메이션의 순수 계산부.
// DOM 의존 0 — match.js가 매 rAF 프레임 이 값을 읽어 transform만 바꾼다.
// 포메이션 모양이 무너지면 안 되므로 쏠림은 항상 두 가지로 제한된다:
// 거리 비례(PULL_FRACTION)와 절대 상한(MAX_PULL) — 둘 중 작은 쪽이 이긴다.

const MAX_PULL = 7 // 퍼센트 포인트 (필드 좌표계 0~100 기준)
const PULL_FRACTION = 0.18
const BASE_SPEED = 15 // 퍼센트 포인트/초, pace=1일 때
const PACE_SPEED_RANGE = 45 // pace=99일 때 속도는 BASE_SPEED + 이 값

// 선수의 고정 포메이션 위치(basePos)와 현재 공 위치(ballPos)로 이번 프레임의 목표 지점을 구한다.
export function computeTarget(basePos, ballPos) {
  const dx = ballPos.left - basePos.left
  const dy = ballPos.top - basePos.top
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { left: basePos.left, top: basePos.top }
  const pull = Math.min(dist * PULL_FRACTION, MAX_PULL)
  const ratio = pull / dist
  return { left: basePos.left + dx * ratio, top: basePos.top + dy * ratio }
}

// 현재 위치를 목표 쪽으로 deltaSeconds만큼 이동시킨다. pace가 높을수록 빨리 수렴하고,
// speedMultiplier는 재생 배속(1x/2x/4x)에 맞춰 같이 스케일된다(안 그러면 배속에서 목표가
// 선수보다 훨씬 빨리 움직여 계속 뒤처지는 것처럼 보임).
export function stepToward(current, target, pace, deltaSeconds, speedMultiplier = 1) {
  const dx = target.left - current.left
  const dy = target.top - current.top
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { left: current.left, top: current.top }
  const speed = (BASE_SPEED + (pace / 99) * PACE_SPEED_RANGE) * speedMultiplier
  const maxStep = speed * deltaSeconds
  if (maxStep >= dist) return { left: target.left, top: target.top }
  const ratio = maxStep / dist
  return { left: current.left + dx * ratio, top: current.top + dy * ratio }
}
