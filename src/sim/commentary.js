// 이벤트 로그 -> 한국어 커멘터리 텍스트. DOM 의존 0, findPlayer만 주입받는 순수 함수라
// Jest로 직접 테스트 가능(실제 players.db.js 없이 스텁 리졸버로도 검증 가능).
//
// 무음 처리(null 반환) 원칙 — 스팸 방지:
// - 서술 이벤트(pass/carry): 한 체인당 3~6개씩 딸려오는 볼 이동 전용.
// - turnover_buildup: 체인의 압도적 다수.
// - 빌드업 파울(dangerous 아님)과 그 재개 FK(variant 'restart'): 경기당 ~20건이라
//   전부 찍으면 도배가 된다. 카드가 나오면 카드 이벤트가 문구를 만든다.

import { NARRATION_TYPES } from './event-types.js'

const TEAM_LABEL = { A: '홈', B: '원정' }

const GOAL_VIA_LABEL = {
  free_kick: ' — 직접 프리킥!',
  header_fk: ' — 프리킥 헤더!',
  header_corner: ' — 코너킥 헤더!',
  penalty: ' — 페널티킥',
}

export function eventCommentary(event, findPlayer) {
  if (NARRATION_TYPES.includes(event.type)) return null
  if (event.type === 'turnover_buildup') return null

  const team = TEAM_LABEL[event.team]
  const actor = event.actorId ? findPlayer(event.actorId) : null

  switch (event.type) {
    case 'goal': {
      const via = GOAL_VIA_LABEL[event.via] ?? ''
      // possession.js가 슈터/어시스터를 독립 추첨해 자가 어시스트가 나올 수 있다 —
      // 커멘터리에서만 걸러준다(스탯 계산에는 안 쓰임).
      const assist = event.assistId && event.assistId !== event.actorId ? findPlayer(event.assistId) : null
      return assist
        ? `${event.minute}' 골! ${team} ${actor.name}의 득점${via} (어시스트: ${assist.name})`
        : `${event.minute}' 골! ${team} ${actor.name}의 득점${via}`
    }
    case 'shot_saved': {
      const gk = findPlayer(event.gkId)
      if (event.via === 'penalty') return `${event.minute}' ${team} ${actor.name}의 페널티킥, ${gk.name} 선방!!`
      return `${event.minute}' ${team} ${actor.name}의 슈팅, ${gk.name} 선방`
    }
    case 'shot_off_target':
      if (event.via === 'free_kick') return `${event.minute}' ${team} ${actor.name}의 직접 프리킥이 빗나갑니다`
      return `${event.minute}' ${team} ${actor.name}의 슈팅이 빗나갑니다`
    case 'foul':
      if (!event.dangerous) return null // 빌드업 파울은 무음(카드 시 카드 이벤트가 말함)
      return `${event.minute}' ${team} ${actor.name}의 파울 — 위험한 위치에서 프리킥`
    case 'free_kick':
      if (event.variant === 'restart') return null
      if (event.variant === 'direct') return `${event.minute}' ${TEAM_LABEL[event.team]} ${findPlayer(event.takerId).name}이 직접 노립니다`
      return `${event.minute}' ${TEAM_LABEL[event.team]} ${findPlayer(event.takerId).name}가 박스 안으로 올립니다`
    case 'corner_kick':
      return `${event.minute}' ${TEAM_LABEL[event.team]} 코너킥 — ${findPlayer(event.takerId).name}`
    case 'yellow_card':
      return `${event.minute}' 경고! ${team} ${actor.name}`
    case 'red_card':
      return `${event.minute}' 퇴장!! ${team} ${actor.name} — ${team}팀은 수적 열세가 됩니다`
    case 'penalty_awarded': {
      const victim = findPlayer(event.victimId)
      return `${event.minute}' 페널티킥! ${team} ${actor.name}이 ${victim.name}을 쓰러뜨렸습니다`
    }
    case 'offside':
      return `${event.minute}' ${team} ${actor.name}, 오프사이드에 걸립니다`
    case 'clearance':
      return `${event.minute}' ${findPlayer(event.actorId).name}가 걷어냅니다`
    default:
      return null
  }
}
