// 이벤트 로그 -> 한국어 커멘터리 텍스트. DOM 의존 0, findPlayer만 주입받는 순수 함수라
// Jest로 직접 테스트 가능(실제 players.db.js 없이 스텁 리졸버로도 검증 가능).
//
// turnover_buildup(창조 단계 실패 — 슈팅까지도 못 감)은 체인의 압도적 다수를 차지해서
// 전부 커멘터리에 찍으면 스팸이 된다. progression(볼이 실제로 거쳐가는 경유 밴드 —
// possession.js 참고)은 한 체인당 2~3개씩 딸려오는 서술 전용 이벤트라 더더욱 스팸이 된다.
// 둘 다 null을 반환해서 걸러내고, 호출부(match.js)가 null이면 텍스트는 안 띄우되
// 공 위치 갱신(경유 지점 이동)에는 계속 쓴다.

const TEAM_LABEL = { A: '홈', B: '원정' }

export function eventCommentary(event, findPlayer) {
  if (event.type === 'turnover_buildup' || event.type === 'progression') return null

  const team = TEAM_LABEL[event.team]
  const actor = findPlayer(event.actorId)

  switch (event.type) {
    case 'goal': {
      // possession.js가 슈터/어시스터를 같은 스쿼드에서 독립적으로 뽑기 때문에(서로 배제
      // 안 함) 같은 선수가 두 역할 다 뽑히는 자가 어시스트가 실제로 발생한다 — 스탯 계산에는
      // 안 쓰이는 커멘터리 텍스트뿐이라 여기서만 걸러준다.
      const assist = event.assistId && event.assistId !== event.actorId ? findPlayer(event.assistId) : null
      return assist
        ? `${event.minute}' 골! ${team} ${actor.name}의 득점 (어시스트: ${assist.name})`
        : `${event.minute}' 골! ${team} ${actor.name}의 득점`
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
