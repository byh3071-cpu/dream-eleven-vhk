// fixtures(+result) -> 리그 순위표. 순수 함수 — 순위표는 세이브에 저장하지 않고
// 항상 여기서 파생 계산한다(저장본과 경기 결과가 어긋나는 드리프트를 원천 차단).

export function computeTable(clubIds, fixtures) {
  const rows = new Map(clubIds.map((id) => [id, {
    clubId: id, played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0,
  }]))

  for (const fixture of fixtures) {
    if (!fixture.result) continue
    const home = rows.get(fixture.homeClubId)
    const away = rows.get(fixture.awayClubId)
    const { homeGoals, awayGoals } = fixture.result
    home.played++; away.played++
    home.goalsFor += homeGoals; home.goalsAgainst += awayGoals
    away.goalsFor += awayGoals; away.goalsAgainst += homeGoals
    if (homeGoals > awayGoals) { home.wins++; away.losses++; home.points += 3 }
    else if (homeGoals < awayGoals) { away.wins++; home.losses++; away.points += 3 }
    else { home.draws++; away.draws++; home.points++; away.points++ }
  }

  return [...rows.values()].sort((a, b) =>
    b.points - a.points
    || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    || b.goalsFor - a.goalsFor
    || a.clubId.localeCompare(b.clubId)) // 완전 동률 시 결정론적 순서 고정
}
