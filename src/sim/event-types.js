// 매치 이벤트 스키마의 단일 소스 — sim(생성), 렌더러(소비), 테스트(검증)가 전부
// 여기 정의를 공유한다. 새 이벤트 타입은 반드시 여기 등록하고 헬퍼들을 갱신할 것.
//
// 공통 필드: { type, minute, team, chainId, zoneFrom, zoneTo, channel(류) }
//
// 볼 이동 이벤트:
//   pass             fromId, toId, channelFrom/To, style('ground'|'long'|'short')
//   carry            actorId — 드리블 전진
//   turnover_buildup actorId(수비자), victimId(공격측 보유자), cause('tackle'|'interception')
//   clearance        actorId(수비자) — 크로스/세트피스를 걷어내 체인 종료
//   offside          actorId(깃발에 걸린 침투자), fromId(패서) — 체인 종료
//   shot_off_target / shot_saved(gkId) / goal(assistId) — via 필드로 경로 구분
//   free_kick        takerId, variant('direct'|'cross'|'restart') — 데드볼 재개
//   corner_kick      takerId, side('LEFT'|'RIGHT') — 데드볼 재개
//   foul             actorId(파울러, team=반칙팀), victimId, dangerous(bool)
//
// 북키핑 이벤트(볼 이동 없음 — 연속성 검사에서 제외):
//   yellow_card / red_card   actorId(대상), team=반칙팀
//   penalty_awarded          actorId(파울러), victimId, team=반칙팀
//
// via: 'open_play' | 'free_kick' | 'header_fk' | 'header_corner' | 'penalty'
// 예약 타입(커리어 전용): injury

// 체인을 끝내는 이벤트 — 항상 체인의 마지막, 정확히 1개.
export const TERMINAL_TYPES = Object.freeze([
  'turnover_buildup', 'shot_off_target', 'shot_saved', 'goal', 'clearance', 'offside',
])

// 서술 전용(커멘터리 무음) 볼 이동.
export const NARRATION_TYPES = Object.freeze(['pass', 'carry'])

// 볼 이동이 없는 북키핑 — 보유자 연속성 검사에서 아예 건너뛴다.
export const BOOKKEEPING_TYPES = Object.freeze(['yellow_card', 'red_card', 'penalty_awarded'])

// 데드볼 재개/유발 — 이 이벤트의 앞뒤 페어는 보유자 연속성 요구가 면제된다
// (심판이 멈춘 볼을 지정 키커가 이어받는 게 규칙상 정상이라서).
export const CONTINUITY_EXEMPT_TYPES = Object.freeze(['foul', 'free_kick', 'corner_kick'])

export const ALL_EVENT_TYPES = Object.freeze([
  ...NARRATION_TYPES, ...TERMINAL_TYPES, ...BOOKKEEPING_TYPES, ...CONTINUITY_EXEMPT_TYPES,
])

export function isTerminal(event) {
  return TERMINAL_TYPES.includes(event.type)
}

export function isBallEvent(event) {
  return !BOOKKEEPING_TYPES.includes(event.type)
}

// 이 이벤트가 시작되는 순간 볼을 가진 선수.
export function startHolderOf(event) {
  switch (event.type) {
    case 'pass': return event.fromId
    case 'carry': return event.actorId
    case 'turnover_buildup': return event.victimId
    case 'foul': return event.victimId
    case 'free_kick':
    case 'corner_kick': return event.takerId
    case 'offside': return event.fromId
    case 'clearance': return null // 공중 경합에서 나옴 — 직전이 데드볼이라 연속성 면제 구간
    case 'shot_off_target':
    case 'shot_saved':
    case 'goal': return event.actorId
    default: return null
  }
}

// 이 이벤트가 끝난 순간 볼을 가진 선수 (null = 선수 소유를 떠남: 골/아웃/데드).
export function endHolderOf(event) {
  switch (event.type) {
    case 'pass': return event.toId
    case 'carry': return event.actorId
    case 'turnover_buildup': return event.actorId
    case 'foul': return event.victimId // 반칙 당한 쪽이 FK로 소유 유지
    case 'free_kick':
    case 'corner_kick': return event.takerId
    case 'clearance': return event.actorId
    case 'shot_saved': return event.gkId
    case 'goal':
    case 'shot_off_target':
    case 'offside': return null
    default: return null
  }
}

// 이 순간 볼을 소유한 팀. foul/카드/PK선언은 event.team이 "반칙팀"이라 소유는 반대다 —
// 렌더러/스티어링/통계가 event.team을 직접 읽지 않고 반드시 이 함수를 거쳐야 하는 이유.
const FOULING_SIDE_TYPES = new Set(['foul', 'yellow_card', 'red_card', 'penalty_awarded'])

export function possessionTeamOf(event) {
  if (FOULING_SIDE_TYPES.has(event.type)) return event.team === 'A' ? 'B' : 'A'
  return event.team
}
