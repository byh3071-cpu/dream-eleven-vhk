// 이벤트 로그 -> 한국어 커멘터리 텍스트. DOM 의존 0, findPlayer만 주입받는 순수 함수라
// Jest로 직접 테스트 가능(실제 players.db.js 없이 스텁 리졸버로도 검증 가능).
//
// turnover_buildup(창조 단계 실패 — 슈팅까지도 못 감)은 26개 이벤트 중 평균 11개(약 42%,
// engine.js 실측)로 압도적 다수라 전부 커멘터리에 찍으면 스팸이 된다. null을 반환해서
// 걸러내고, 호출부(match.js)가 null이면 텍스트는 안 띄우되 공 위치 갱신에는 계속 쓴다.

const TEAM_LABEL = { A: '홈', B: '원정' }

export function eventCommentary(event, findPlayer) {
  if (event.type === 'turnover_buildup') return null

  const team = TEAM_LABEL[event.team]
  const actor = findPlayer(event.actorId)

  switch (event.type) {
    case 'goal': {
      const assist = findPlayer(event.assistId)
      return `${event.minute}' 골! ${team} ${actor.name}의 득점 (어시스트: ${assist.name})`
    }
    case 'shot_saved': {
      const gk = findPlayer(event.gkId)
      return `${event.minute}' ${team} ${actor.name}의 슈팅, ${gk.name} 선방`
    }
    case 'shot_off_target':
      return `${event.minute}' ${team} ${actor.name}의 슈팅이 빗나갑니다`
    default:
      return null
  }
}
