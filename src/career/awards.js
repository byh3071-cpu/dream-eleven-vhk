// 시즌 어워드 — seasonStats(라운드 정산 때 적립된 평점 집계)에서 파생 계산. 순수 함수.
// fixture.result에 events를 저장하지 않으므로(용량), 평점은 finishRound가 경기 시뮬
// 직후(전체 이벤트를 쥔 유일한 시점)에 적립한 것을 쓴다 — 소급 계산 불가가 설계 근거.

import { resolveCareerPlayer } from './players.js'
import { topScorers } from './records.js'

const MIN_MATCHES_MVP = 6
const MIN_MATCHES_XI = 4
const XI_SHAPE = { GK: 1, def: 4, mid: 4, att: 2 } // 4-4-2

const LINE_OF = {
  GK: 'GK', CB: 'def', LB: 'def', RB: 'def',
  DM: 'mid', CM: 'mid', AM: 'mid', LM: 'mid', RM: 'mid',
  LW: 'att', RW: 'att', ST: 'att',
}

function averagedRows(seasonStats, minMatches) {
  return Object.entries(seasonStats ?? {})
    .filter(([, s]) => s.matches >= minMatches)
    .map(([playerId, s]) => ({
      playerId,
      avg: Math.round((s.ratingSum / s.matches) * 100) / 100,
      matches: s.matches,
      motm: s.motm,
    }))
    .sort((a, b) => b.avg - a.avg || b.motm - a.motm || a.playerId.localeCompare(b.playerId))
}

export function seasonMvp(seasonStats) {
  return averagedRows(seasonStats, MIN_MATCHES_MVP)[0] ?? null
}

// 라인별 평균 평점 상위로 4-4-2를 채운다. 인원이 모자란 라인은 있는 만큼만.
export function seasonBestXI(seasonStats, save = null) {
  const rows = averagedRows(seasonStats, MIN_MATCHES_XI)
  const byLine = { GK: [], def: [], mid: [], att: [] }
  for (const row of rows) {
    const line = LINE_OF[resolveCareerPlayer(save, row.playerId).positions[0]]
    byLine[line].push(row)
  }
  return {
    GK: byLine.GK.slice(0, XI_SHAPE.GK),
    def: byLine.def.slice(0, XI_SHAPE.def),
    mid: byLine.mid.slice(0, XI_SHAPE.mid),
    att: byLine.att.slice(0, XI_SHAPE.att),
  }
}

export function seasonAwards(save) {
  return {
    mvp: seasonMvp(save.seasonStats),
    bestXI: seasonBestXI(save.seasonStats, save),
    topScorer: topScorers(save.fixtures, { limit: 1 })[0] ?? null,
  }
}
