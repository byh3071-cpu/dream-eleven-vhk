// 시즌 서사 — 시즌 종료 시점의 세이브 데이터에서 이야기 문장을 조합한다(순수 함수).
// 결과는 history[].story로 박제되어 명예의 전당에서 열람된다(goal 20 완료 기준:
// "시즌 종료 서사가 세이브에 축적·열람"). 문장은 데이터가 만족할 때만 등장 —
// 억지 문장 0이 원칙(조건 미달이면 그 소재는 침묵).

import { computeTable } from './table.js'
import { topScorers } from './records.js'
import { seasonMvp } from './awards.js'
import { expectedRankOf } from './finance.js'
import { resolveCareerPlayer } from './players.js'
import { findClub } from './clubs.js'

function nameOf(save, playerId) {
  return resolveCareerPlayer(save, playerId)?.name ?? playerId
}

// 시즌 종료 세이브(전환 전)를 받아 서사 문장 배열을 돌려준다.
export function composeSeasonStory(save, { retirees = [] } = {}) {
  const story = []
  const clubIds = Object.keys(save.rosters)
  const table = computeTable(clubIds, save.fixtures)
  const my = save.userClubId
  const myRank = table.findIndex((r) => r.clubId === my) + 1
  const myRow = table[myRank - 1]
  const champion = findClub(table[0].clubId)
  const season = save.season.number

  // 1) 시즌 총평 — 우승/기대 대비
  const expected = expectedRankOf(save, my)
  if (myRank === 1) {
    story.push(`시즌 ${season}, ${champion.name}이(가) 승점 ${myRow.points}점으로 리그를 제패했다. 우리가 그 주인공이다.`)
  } else {
    story.push(`시즌 ${season}의 왕좌는 ${champion.name}에게 돌아갔다. 우리는 ${myRank}위(승점 ${myRow.points})로 마감했다.`)
  }
  if (myRank < expected) {
    story.push(`전력 평가 ${expected}위의 스쿼드로 ${myRank}위 — 보드의 기대를 넘어선 시즌이었다.`)
  } else if (myRank > expected) {
    story.push(`전력 ${expected}위로 평가받고도 ${myRank}위에 그쳤다. 보드룸의 공기가 차갑다.`)
  }

  // 2) 개인 영예 — MVP/득점왕(내 구단이면 강조)
  const mvp = seasonMvp(save.seasonStats)
  if (mvp) {
    const mine = save.rosters[my].includes(mvp.playerId)
    story.push(mine
      ? `리그 MVP는 우리 ${nameOf(save, mvp.playerId)}(평균 평점 ${mvp.avg.toFixed(2)}) — 시즌의 얼굴이 우리 유니폼을 입고 있다.`
      : `리그 MVP는 ${nameOf(save, mvp.playerId)}(평균 ${mvp.avg.toFixed(2)})에게 돌아갔다.`)
  }
  const scorer = topScorers(save.fixtures, { limit: 1 })[0]
  if (scorer) {
    const mine = save.rosters[my].includes(scorer.playerId)
    story.push(`득점왕 ${nameOf(save, scorer.playerId)} — ${scorer.goals}골${mine ? '. 우리 공격의 심장이다' : ''}.`)
  }

  // 3) 이적 하이라이트 — 이번 시즌 최고액 거래
  const seasonDeals = (save.transferLog ?? []).filter((t) => t.season === season)
  if (seasonDeals.length > 0) {
    const biggest = [...seasonDeals].sort((a, b) => b.fee - a.fee)[0]
    story.push(`겨울 시장의 헤드라인: ${nameOf(save, biggest.playerId)}의 ${biggest.fee}M 이적`
      + `(${findClub(biggest.fromClubId).short} → ${findClub(biggest.toClubId).short}).`)
  }

  // 4) 유스 데뷔 — 이번 시즌 출전한 생성 유스
  const debutants = Object.entries(save.seasonStats ?? {})
    .filter(([id, s]) => id.startsWith('youth_') && s.matches > 0)
    .map(([id]) => nameOf(save, id))
  if (debutants.length > 0) {
    story.push(`아카데미의 결실 — ${debutants.join(', ')}이(가) 1군 무대를 밟았다.`)
  }

  // 5) 신임도 위기 — 시즌 중 최저점이 30 미만이었다가 생존
  const trustDips = (save.financeLog ?? [])
    .filter((e) => e.season === season)
    .map((e) => e.trust)
  if (trustDips.length > 0 && Math.min(...trustDips) < 30 && (save.boardTrust ?? 55) > 0) {
    story.push(`한때 신임도 ${Math.min(...trustDips)}까지 몰렸던 감독석 — 결국 살아남았다.`)
  }

  // 6) 은퇴 헌사
  for (const retiree of retirees) {
    story.push(`${retiree.age}세의 ${retiree.name}이(가) 축구화를 벗는다. ${findClub(retiree.clubId)?.name ?? ''} 팬들이 기립박수를 보냈다.`)
  }

  return story
}
