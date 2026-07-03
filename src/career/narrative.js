// 경기 전 서사 칩 — 저장된 결과(fixtures)에서 파생 계산. 순수 함수.
// "이 경기에 걸린 맥락"을 킥오프 전에 보여줘 매 경기에 이야기를 붙인다(사용자 요청
// 재미 요소 C). 톤: good(우리 호재)/warn(경계)/info(중립).

import { computeTable } from './table.js'
import { resolveCareerPlayer } from './players.js'
import { findClub } from './clubs.js'

// 클럽의 소화된 경기를 라운드 순으로 [{round, result, scorers}]로 정리.
function playedGamesOf(fixtures, clubId) {
  return fixtures
    .filter((f) => f.result && (f.homeClubId === clubId || f.awayClubId === clubId))
    .sort((a, b) => a.round - b.round)
    .map((f) => {
      const isHome = f.homeClubId === clubId
      const mine = isHome ? f.result.homeGoals : f.result.awayGoals
      const theirs = isHome ? f.result.awayGoals : f.result.homeGoals
      return {
        round: f.round,
        result: mine > theirs ? 'W' : mine < theirs ? 'L' : 'D',
        scorers: f.result.scorers.filter((s) => (s.team === 'A') === isHome),
      }
    })
}

// 최근 경기부터 조건이 연속으로 참인 횟수.
function streakOf(games, predicate) {
  let count = 0
  for (let i = games.length - 1; i >= 0; i--) {
    if (!predicate(games[i])) break
    count++
  }
  return count
}

export function computePreMatchChips(save, fixture) {
  const chips = []
  const clubIds = Object.keys(save.rosters)
  const myClubId = save.userClubId
  const sides = [
    { clubId: fixture.homeClubId, label: '홈' },
    { clubId: fixture.awayClubId, label: '원정' },
  ]

  // ① 팀 스트릭: 3연승+ / 4경기 무패+ (연승이 무패를 포함하므로 연승 우선)
  for (const { clubId } of sides) {
    const games = playedGamesOf(save.fixtures, clubId)
    const wins = streakOf(games, (g) => g.result === 'W')
    const unbeaten = streakOf(games, (g) => g.result !== 'L')
    const mine = clubId === myClubId
    if (wins >= 3) {
      chips.push({ text: `${short(save, clubId)} ${wins}연승 질주`, tone: mine ? 'good' : 'warn' })
    } else if (unbeaten >= 4) {
      chips.push({ text: `${short(save, clubId)} ${unbeaten}경기 무패`, tone: mine ? 'good' : 'warn' })
    }
  }

  // ② 선수 연속 득점(2경기+): 양팀 로스터에서 탐색, 팀당 최고 1명만(칩 스팸 방지)
  for (const { clubId } of sides) {
    const games = playedGamesOf(save.fixtures, clubId)
    if (games.length < 2) continue
    let best = null
    for (const playerId of save.rosters[clubId]) {
      const streak = streakOf(games, (g) => g.scorers.some((s) => s.playerId === playerId))
      if (streak >= 2 && (!best || streak > best.streak)) best = { playerId, streak }
    }
    if (best) {
      chips.push({
        text: `${resolveCareerPlayer(save, best.playerId).name} ${best.streak}경기 연속 골`,
        tone: clubId === myClubId ? 'good' : 'warn',
      })
    }
  }

  // ③ 이번 시즌 상대전적(맞대결 기록이 있을 때만) — 홈팀 관점 표기
  const meetings = save.fixtures.filter((f) => f.result
    && ((f.homeClubId === fixture.homeClubId && f.awayClubId === fixture.awayClubId)
      || (f.homeClubId === fixture.awayClubId && f.awayClubId === fixture.homeClubId)))
  if (meetings.length > 0) {
    let w = 0; let d = 0; let l = 0
    for (const m of meetings) {
      const homeSideGoals = m.homeClubId === fixture.homeClubId ? m.result.homeGoals : m.result.awayGoals
      const otherGoals = m.homeClubId === fixture.homeClubId ? m.result.awayGoals : m.result.homeGoals
      if (homeSideGoals > otherGoals) w++
      else if (homeSideGoals < otherGoals) l++
      else d++
    }
    chips.push({ text: `시즌 상대전적 ${w}승 ${d}무 ${l}패 (${short(save, fixture.homeClubId)} 기준)`, tone: 'info' })
  }

  // ④ 선두 맞대결: 현 순위 1·2위 격돌
  const table = computeTable(clubIds, save.fixtures)
  if (table[0].played > 0) {
    const topTwo = [table[0].clubId, table[1].clubId]
    if (topTwo.includes(fixture.homeClubId) && topTwo.includes(fixture.awayClubId)) {
      chips.push({ text: '선두 맞대결 — 1위와 2위의 격돌', tone: 'info', icon: 'flame' })
    }
  }

  return chips
}

function short(save, clubId) {
  return findClub(clubId)?.short ?? clubId
}
