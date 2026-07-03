// 경기 평점 + MOTM — 이벤트 로그에서 파생 계산(순수 함수, 저장 안 함).
// FM식 6점대 베이스에 기여/실책 가감. 절대 정확성보다 "골 넣은 선수가 높고
// 퇴장당한 선수가 낮다"는 서열 정합이 목표(테스트 검증 대상).

const BASE = 6.4
const DELTA = {
  goal: 1.1, assist: 0.7, save: 0.25, shotOnTarget: 0.2, shotOff: 0.05,
  tackle: 0.15, clearance: 0.15, foul: -0.08, yellow: -0.3, red: -1.2, offside: -0.05,
}
const WIN_BONUS = 0.3
const DRAW_BONUS = 0.1

export function ratePlayers({ events, score, homeSquad11, awaySquad11 }) {
  const ratings = new Map()
  const init = (squad11, team) => {
    for (const { player } of squad11) ratings.set(player.id, { playerId: player.id, team, value: BASE })
  }
  init(homeSquad11, 'A')
  init(awaySquad11, 'B')

  const add = (playerId, delta) => {
    const row = ratings.get(playerId)
    if (row) row.value += delta
  }

  for (const event of events) {
    switch (event.type) {
      case 'goal':
        add(event.actorId, DELTA.goal)
        if (event.assistId) add(event.assistId, DELTA.assist)
        break
      case 'shot_saved':
        add(event.actorId, DELTA.shotOnTarget)
        if (event.gkId) add(event.gkId, DELTA.save)
        break
      case 'shot_off_target':
        add(event.actorId, DELTA.shotOff)
        break
      case 'turnover_buildup':
        if (event.cause === 'tackle') add(event.actorId, DELTA.tackle)
        break
      case 'clearance':
        add(event.actorId, DELTA.clearance)
        break
      case 'foul':
        add(event.actorId, DELTA.foul)
        break
      case 'yellow_card':
        add(event.actorId, DELTA.yellow)
        break
      case 'red_card':
        add(event.actorId, DELTA.red)
        break
      case 'offside':
        add(event.actorId, DELTA.offside)
        break
    }
  }

  const winner = score.home > score.away ? 'A' : score.away > score.home ? 'B' : null
  for (const row of ratings.values()) {
    row.value += winner === null ? DRAW_BONUS : row.team === winner ? WIN_BONUS : 0
    row.value = Math.round(Math.min(10, Math.max(5, row.value)) * 10) / 10
  }
  return [...ratings.values()].sort((a, b) => b.value - a.value || a.playerId.localeCompare(b.playerId))
}

// Man of the Match — 최고 평점(동률이면 득점 수, 그다음 id 사전순 — 결정론).
export function motmOf(args) {
  const rated = ratePlayers(args)
  if (rated.length === 0) return null
  const top = rated[0]
  const goalsOf = (id) => args.events.filter((e) => e.type === 'goal' && e.actorId === id).length
  const contenders = rated.filter((r) => r.value === top.value)
  contenders.sort((a, b) => goalsOf(b.playerId) - goalsOf(a.playerId) || a.playerId.localeCompare(b.playerId))
  return contenders[0]
}
