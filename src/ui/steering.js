// M8: 22명 선수 토큰이 볼 쪽으로 미세하게 쏠리는 애니메이션의 순수 계산부.
// DOM 의존 0 — match.js가 매 rAF 프레임 이 값을 읽어 transform만 바꾼다.
//
// 참고(한계): 볼 자체가 possession.js의 5밴드×3채널(15칸)을 550ms/speed 간격으로
// 순간이동하는 사전계산 로그를 재생하는 것이라, 여기서 아무리 매끄럽게 따라가도
// "진짜 FM처럼 연속적으로 움직이는 경기"는 안 된다 — 그건 엔진(이벤트 로그) 쪽 한계라
// 렌더러 튜닝으로 못 넘는다. 여기서 하는 건 "그 안에서 최대한 자연스럽게 반응하기".

// ---------- 목표 지점: 포제션에 따라 다르게 반응 ----------
// 볼을 가진 팀은 적극적으로 볼 쪽에 붙으면서 상대 골 쪽으로 살짝 전진(패스 옵션 만들기).
// 안 가진 팀은 볼에 약하게만 반응하고 자기 골 쪽으로 살짝 물러나 라인을 지킨다.
// 예전엔 양 팀이 볼에 대칭적으로 끌려가서 "그냥 다들 공 쫓아다니는" 것처럼 보였던 부분.
const POSSESSION_PULL_FRACTION = 0.22
const POSSESSION_MAX_PULL = 8
const DEFENSE_PULL_FRACTION = 0.12
const DEFENSE_MAX_PULL = 5
const ATTACK_PUSH = 3 // 퍼센트 포인트, 볼 소유 시 상대 골 쪽 전진
const DEFENSE_DROP = 2 // 퍼센트 포인트, 볼 미소유 시 자기 골 쪽 후퇴
// 팀 라인 시프트 — 볼 중앙 이탈에 비례해 전원 같은 벡터로 평행이동(대형 보존, pull과 별개).
const LINE_SHIFT_X = 0.14
const LINE_SHIFT_Y = 0.11
const LINE_SHIFT_MAX = 12

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

// team 'A'는 top=0 방향(위)이 공격 방향, 'B'는 top=100 방향(아래)이 공격 방향
// (match.js screenTop 규약과 동일 — 여기선 부호만 필요해서 다시 정의하지 않고 받는다).
function attackDir(team) {
  return team === 'A' ? -1 : 1
}

export function computeTarget(basePos, ballPos, team, hasPossession) {
  const dx = ballPos.left - basePos.left
  const dy = ballPos.top - basePos.top
  const dist = Math.hypot(dx, dy)
  const pullFraction = hasPossession ? POSSESSION_PULL_FRACTION : DEFENSE_PULL_FRACTION
  const maxPull = hasPossession ? POSSESSION_MAX_PULL : DEFENSE_MAX_PULL
  const pull = dist === 0 ? 0 : Math.min(dist * pullFraction, maxPull)
  const ratio = dist === 0 ? 0 : pull / dist
  const shapeShift = (hasPossession ? ATTACK_PUSH : -DEFENSE_DROP) * attackDir(team)
  // 팀 라인 시프트 — 볼이 중앙에서 벗어난 만큼 전원이 같은 벡터로 밀린다(대형 안 무너짐).
  // "라인이 볼 따라 밀고 당기는" 오프볼 생동감 — 개별 pull(볼로 붕괴)과 달리 유닛 이동.
  const shiftX = clamp((ballPos.left - 50) * LINE_SHIFT_X, -LINE_SHIFT_MAX, LINE_SHIFT_MAX)
  const shiftY = clamp((ballPos.top - 50) * LINE_SHIFT_Y, -LINE_SHIFT_MAX, LINE_SHIFT_MAX)
  return {
    left: basePos.left + dx * ratio + shiftX,
    top: basePos.top + dy * ratio + shapeShift + shiftY,
  }
}

// ---------- 오프볼 유연성(사용자 지적: "자기 포지션에만 도는 느낌") ----------
// 포지션 틀은 유지하되 상황 오프셋을 얹는다:
// - 지원 런: 볼과 가장 가까운 아군 2명이 보유자 앞쪽 대각(패스 옵션)으로 추가 이동.
//   rank 0은 전진 옵션, rank 1은 반대 대각 — 삼각형이 만들어진다.
// - 오버랩: 수비 third의 사이드 자원(풀백)이 같은 사이드 공격 시 측선을 타고 전진.
// 캡을 낮게 유지해 대형 자체는 붕괴하지 않는다(스티어링의 기존 원칙).
const SUPPORT_PULL = 5
const SUPPORT_FORWARD = 4
const OVERLAP_FORWARD = 9
const PENETRATE_FORWARD = 15 // 배후 침투 전진 폭(지원런보다 크게 — 라인 넘기)
const PENETRATE_WIDE = 7

export function computeFlexTarget(basePos, ballPos, team, hasPossession, flex = {}) {
  const target = computeTarget(basePos, ballPos, team, hasPossession)
  if (!hasPossession) return target
  const dir = attackDir(team)
  if (flex.supportRank === 0 || flex.supportRank === 1) {
    const sideSign = flex.supportRank === 0 ? 1 : -1
    const toBallLeft = ballPos.left - target.left
    target.left += Math.max(-SUPPORT_PULL, Math.min(SUPPORT_PULL, toBallLeft * 0.3))
      + sideSign * 3
    target.top += dir * SUPPORT_FORWARD
  }
  if (flex.overlap) {
    target.top += dir * OVERLAP_FORWARD
  }
  // 침투 — 볼 반대 채널의 빈 공간으로 대각 전진(수비 배후 노림). 캡은 지원런보다만 크게
  // 둬 대형은 유지(anti-float held 게이트가 안전망 — 침투자는 오프볼이라 무관).
  if (flex.penetrate) {
    const awayFromBall = ballPos.left < 50 ? 1 : -1
    target.left += awayFromBall * PENETRATE_WIDE
    target.top += dir * PENETRATE_FORWARD
  }
  return target
}

// ---------- 이벤트 관련자 강풀 (N1 볼-선수 앵커링) ----------
// 현재 이벤트의 주역(패스 수신자, 드리블러, 태클러, 슈터)은 팀 셰이프 유지가 아니라
// "이벤트 지점으로 실제로 가는" 그림이어야 한다 — computeTarget의 완만한 쏠림 대신
// 존 그리드 지점으로 훨씬 강하게 당긴다. 볼이 그 선수를 호밍하므로(ballFlight.js)
// 선수가 지점에 도착하는 만큼 볼-선수 만남 지점도 자연히 그쪽이 된다.
const OVERRIDE_PULL_FRACTION = 0.55
const OVERRIDE_MAX_PULL = 16

export function computeOverrideTarget(basePos, point, maxPull = OVERRIDE_MAX_PULL) {
  const dx = point.left - basePos.left
  const dy = point.top - basePos.top
  const dist = Math.hypot(dx, dy)
  if (dist === 0) return { left: basePos.left, top: basePos.top }
  // 세트피스 쇄도는 강풀(큰 maxPull)로 홈존이 먼 선수도 박스까지 도달시킨다 — 기본 16%
  // 캡이면 슬롯에서 16%만 이동해 박스 근처도 못 간다(정찰 확인한 캡 함정).
  const pull = Math.min(dist * OVERRIDE_PULL_FRACTION, maxPull)
  const ratio = pull / dist
  return { left: basePos.left + dx * ratio, top: basePos.top + dy * ratio }
}

// ---------- 이동: 임계감쇠 스프링 ----------
// 이전엔 "목표까지 최대속도로 직선 이동 후 뚝 멈춤"이라 로봇처럼 보였다. 임계감쇠 스프링은
// 정지 상태에서 가속했다가 목표에 다가가면서 감속해 멈춘다 — 오버슈트/진동 없이 가장 빠르게
// 수렴하는 감쇠비라 부자연스러운 흔들림 없이도 "관성이 있는" 움직임처럼 보인다.
// pace가 높을수록 스프링을 더 뻣뻣하게(stiffness↑) 만들어 더 빨리 반응하게 한다.
const BASE_STIFFNESS = 70 // pace=1일 때
const PACE_STIFFNESS_RANGE = 2200 // pace=99일 때 stiffness는 BASE + 이 값

// deltaSeconds가 크면(프레임 드랍 등) 이 적분식이 발산할 수 있어서, 호출부(match.js)가
// deltaSeconds를 작은 서브스텝으로 쪼개 여러 번 호출하는 걸 전제로 한다 — 한 번에 큰
// deltaSeconds를 넘기지 말 것(MAX_SUBSTEP 참고).
export function springStep(current, velocity, target, pace, deltaSeconds, speedMultiplier = 1) {
  const stiffness = (BASE_STIFFNESS + (pace / 99) * PACE_STIFFNESS_RANGE) * speedMultiplier
  const damping = 2 * Math.sqrt(stiffness) // 임계감쇠
  const ax = (target.left - current.left) * stiffness - velocity.left * damping
  const ay = (target.top - current.top) * stiffness - velocity.top * damping
  const newVelocity = {
    left: velocity.left + ax * deltaSeconds,
    top: velocity.top + ay * deltaSeconds,
  }
  const newCurrent = {
    left: current.left + newVelocity.left * deltaSeconds,
    top: current.top + newVelocity.top * deltaSeconds,
  }
  return { current: newCurrent, velocity: newVelocity }
}

// speedMultiplier=4(4배속) + pace=99 조합에서도 안정적인 상한 — 위 stiffness 최댓값
// 기준으로 여유 있게 잡은 값(계산 근거는 커밋 메시지/PR 설명 참고).
export const MAX_SUBSTEP = 1 / 75
