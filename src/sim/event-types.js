// 매치 이벤트 스키마의 단일 소스 — sim(생성), 렌더러(소비), 테스트(검증)가 전부
// 여기 정의를 공유한다. 새 이벤트 타입은 반드시 여기 등록하고 헬퍼 3종을 갱신할 것.
//
// 공통 필드: { type, minute, team: 'A'|'B', chainId }
//
// 타입별 필드:
//   pass             fromId, toId, zoneFrom, zoneTo, channelFrom, channelTo, style('ground'|'long')
//   carry            actorId, zoneFrom, zoneTo, channel                  — 드리블 전진
//   turnover_buildup actorId(수비자), victimId(공격측 보유자), cause('tackle'|'interception'),
//                    zoneFrom, zoneTo, channel
//   shot_off_target  actorId(슈터), zoneFrom, zoneTo, channel, via
//   shot_saved       actorId(슈터), gkId, zoneFrom, zoneTo, channel, via
//   goal             actorId(슈터), assistId, zoneFrom, zoneTo, channel, via
//
// via: 'open_play' (N2에서 'penalty'|'header_corner'|'free_kick' 등으로 확장 예정)
// 예약 타입(N2+): foul, yellow_card, red_card, free_kick, corner_kick, offside,
//                penalty_awarded, clearance, kickoff, injury(커리어 전용)

// 체인당 정확히 1개, 항상 마지막 — buildStats의 possessions 카운트 기준.
export const TERMINAL_TYPES = Object.freeze([
  'turnover_buildup', 'shot_off_target', 'shot_saved', 'goal',
])

// 서술 전용(체인당 0~N개) — 커멘터리 무음, 통계 미집계, 볼 이동 렌더에만 쓰임.
export const NARRATION_TYPES = Object.freeze(['pass', 'carry'])

export const ALL_EVENT_TYPES = Object.freeze([...NARRATION_TYPES, ...TERMINAL_TYPES])

export function isTerminal(event) {
  return TERMINAL_TYPES.includes(event.type)
}

// 이 이벤트가 시작되는 순간 볼을 가진 선수. 체인 연속성 불변식
// (endHolderOf(eᵢ) === startHolderOf(eᵢ₊₁))의 왼쪽 항.
export function startHolderOf(event) {
  switch (event.type) {
    case 'pass': return event.fromId
    case 'carry': return event.actorId
    case 'turnover_buildup': return event.victimId
    case 'shot_off_target':
    case 'shot_saved':
    case 'goal': return event.actorId
    default: return null
  }
}

// 이 이벤트가 끝난 순간 볼을 가진 선수 (null = 볼이 선수 소유를 떠남: 골/아웃).
export function endHolderOf(event) {
  switch (event.type) {
    case 'pass': return event.toId
    case 'carry': return event.actorId
    case 'turnover_buildup': return event.actorId // 수비자가 탈취
    case 'shot_saved': return event.gkId
    case 'goal':
    case 'shot_off_target': return null
    default: return null
  }
}

// 이 순간 볼을 소유한 팀. 지금은 전 타입이 event.team(공격팀) 기준이지만,
// N2의 foul/카드류는 team=반칙팀이라 반전이 필요해진다 — 렌더러/스티어링이
// event.team을 직접 읽지 않고 반드시 이 함수를 거치게 해서 그 확장을 준비한다.
export function possessionTeamOf(event) {
  return event.team
}
