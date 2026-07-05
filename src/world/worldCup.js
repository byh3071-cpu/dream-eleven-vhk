// 대륙컵 "글로리 컵" — 4개국 플래그십 리그(한·일·영·스)의 상위팀이 겨루는 크로스 대회.
// 챔스/ACL 아날로그로, 4개 리그를 하나로 묶는 최상위 목표(docs/world/league-rules.md 스펙).
//
// 완전 additive — 기존 부품만 조립하고 아무 파일도 수정하지 않는다:
//   simulateWorldSeason(season.js)로 각국 리그를 시뮬 → 최종 순위 상위 topN 선발,
//   generateFixtures(schedule.js)로 8팀 더블 라운드로빈,
//   simulateMatch(engine.js)로 각 경기, computeTable(table.js)로 순위 → 1위=챔피언.
//
// 결정론: 모든 rng는 seed에서 deriveSeed로 파생 — 같은 seed = 같은 챔피언(같은 순위표).
// 로스터 일관성: 참가 구단의 로스터는 그 리그를 시뮬할 때 season.js가 만든 것(season.rosters)을
//   그대로 재사용한다 → "동일 방식/시드"가 재생성 없이 구성상 보장된다.

import { deriveSeed } from '../sim/rng.js'
import { generateFixtures } from '../career/schedule.js'
import { simulateMatch } from '../sim/engine.js'
import { computeTable } from '../career/table.js'
import { pickBestXI } from '../career/aiLineup.js'
import { findFormation } from '../data/formations.js'
import { DEFAULT_TACTICS } from '../sim/tactics-modifiers.js'
import { LEAGUES } from './leagues.js'
import { simulateWorldSeason } from './season.js'

// 컵 리그페이즈 포메이션 — season.js의 시뮬 기본값과 동일(4-4-2)해 XI 선발 방식이 일관.
const FORMATION_ID = '4-4-2'

// season.js/teamGen.js와 동일한 로컬 문자열 해시(둘 다 export 안 함). 리그·컵 시드 파생용.
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// buildSide — season.js의 동명 private 함수 재구성(export 안 돼 있어 불가피한 최소 중복).
// 로스터 → simulateMatch 입력({squad11, formation, tactics}). pickBestXI로 베스트11 선발.
function buildSide(roster, rosterMap, formationId) {
  const xi = pickBestXI({
    rosterIds: roster.map((p) => p.id),
    resolvePlayer: (id) => rosterMap[id],
    formationId,
  })
  if (!xi) return null
  return {
    squad11: xi.assignments.map(({ slotIndex, playerId }) => ({ player: rosterMap[playerId], slotIndex })),
    formation: findFormation(formationId),
    tactics: { ...DEFAULT_TACTICS },
  }
}

// 글로리 컵 한 대회 시뮬 → { participants, fixtures(+result), table, champion }. 순수·결정론.
// topN: 각 플래그십 리그에서 뽑는 상위 팀 수(기본 2 → 4개국 × 2 = 8팀, 짝수 보장).
export function simulateGloryCup(seed, { topN = 2 } = {}) {
  // 1) 플래그십 4개국(!generated) — 각 리그를 season.js로 시뮬해 최종 순위 산출 후 상위 topN 선발.
  //    리그 시드는 seed에서 리그별 고정 salt로 파생(리그마다 독립 스트림, 재현 가능).
  const flagships = LEAGUES.filter((l) => !l.generated)

  const participants = []
  const rosters = {}   // clubId → 선수[]  (해당 리그 시즌이 쓴 로스터를 그대로 재사용)
  const clubMeta = {}  // clubId → { clubName, leagueName }  (champion 조립용 역참조)

  for (const league of flagships) {
    const leagueSeed = deriveSeed(seed, hashStr(league.id))
    const season = simulateWorldSeason(league, leagueSeed, { formationId: FORMATION_ID })
    for (const row of season.table.slice(0, topN)) {
      const club = league.clubs.find((c) => c.id === row.clubId)
      participants.push({
        clubId: club.id,
        clubName: club.name,
        leagueId: league.id,
        leagueName: league.name,
      })
      rosters[club.id] = season.rosters[club.id]
      clubMeta[club.id] = { clubName: club.name, leagueName: league.name }
    }
  }

  // 2) 참가 8팀 전체를 flat 선수맵으로(player.id → player). clubId가 도시 기반이라 리그 간
  //    유니크하고, player.id는 `${clubId}_p{n}` 네임스페이스라 전역 충돌이 없다.
  const rosterMap = {}
  for (const clubId of Object.keys(rosters)) {
    for (const p of rosters[clubId]) rosterMap[p.id] = p
  }

  // 3) 리그페이즈 = 더블 라운드로빈(rounds:2). 8팀 → 14R × 4경기 = 56경기, 팀당 14경기.
  //    컵 매치 시드는 리그 시드와 겹치지 않게 별도 컵 시드에서 파생(독립·결정론).
  const clubIds = participants.map((p) => p.clubId)
  const cupSeed = deriveSeed(seed, hashStr('glory_cup'))
  const fixtures = generateFixtures(clubIds, { rounds: 2 })
  fixtures.forEach((fx, i) => {
    const home = buildSide(rosters[fx.homeClubId], rosterMap, FORMATION_ID)
    const away = buildSide(rosters[fx.awayClubId], rosterMap, FORMATION_ID)
    if (!home || !away) return
    const result = simulateMatch({ home, away, seed: deriveSeed(cupSeed, i) })
    fx.result = { homeGoals: result.score.home, awayGoals: result.score.away }
  })

  // 4) 최종 순위 = computeTable(결정론 타이브레이크: 승점→골득실→다득점→clubId). 1위=챔피언.
  //    별도 결승전 없음 — API 스펙이 "최종 순위 1위 = 챔피언"이며 결승 매치용 필드가 없다.
  const table = computeTable(clubIds, fixtures)
  const top = table[0]
  const champion = {
    clubId: top.clubId,
    clubName: clubMeta[top.clubId].clubName,
    leagueName: clubMeta[top.clubId].leagueName,
  }

  return {
    participants,
    fixtures: fixtures.map((fx) => ({
      homeClubId: fx.homeClubId,
      awayClubId: fx.awayClubId,
      round: fx.round,
      result: fx.result,
    })),
    table,
    champion,
  }
}
