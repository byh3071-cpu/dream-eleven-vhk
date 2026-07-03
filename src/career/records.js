// 개인 기록 — 저장된 경기 결과(fixtures[].result.scorers)에서 파생 계산. 순수 함수.
// 순위표와 같은 원칙: 기록을 따로 저장하지 않아 결과와 어긋날 수 없다.

export function topScorers(fixtures, { limit = 10 } = {}) {
  const goals = new Map()
  for (const fixture of fixtures) {
    if (!fixture.result) continue
    for (const scorer of fixture.result.scorers) {
      goals.set(scorer.playerId, (goals.get(scorer.playerId) ?? 0) + 1)
    }
  }
  return [...goals.entries()]
    .map(([playerId, count]) => ({ playerId, goals: count }))
    .sort((a, b) => b.goals - a.goals || a.playerId.localeCompare(b.playerId))
    .slice(0, limit)
}

// 선수 -> 소속 구단 (rosters 역인덱스).
export function clubOfPlayer(rosters, playerId) {
  for (const [clubId, ids] of Object.entries(rosters)) {
    if (ids.includes(playerId)) return clubId
  }
  return null
}
