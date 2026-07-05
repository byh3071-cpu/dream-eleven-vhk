// 월드 리그 한 시즌 시뮬레이션 — 로스터 생성 + 매치 시뮬 + 순위표.
// 기존 커리어 부품(generateYouth/pickBestXI/simulateMatch/computeTable/generateFixtures)을
// save 의존 없이 조립한다(additive — world 독립, 돌아가는 커리어·IF 무영향).
// 결정론: 모든 rng는 시드에서 deriveSeed로 파생 — 같은 (league, seed) = 같은 시즌.

import { generateYouth } from '../career/youthGen.js'
import { pickBestXI } from '../career/aiLineup.js'
import { simulateMatch } from '../sim/engine.js'
import { computeTable } from '../career/table.js'
import { generateFixtures } from '../career/schedule.js'
import { findFormation } from '../data/formations.js'
import { DEFAULT_TACTICS } from '../sim/tactics-modifiers.js'
import { createRng, deriveSeed } from '../sim/rng.js'
import { leagueClubIds } from './leagues.js'

// 구단 로스터 포지션 쿼터(19명) — pickBestXI가 어떤 포메이션도 채우게 GK 2 + 전 라인 커버.
const ROSTER_QUOTA = [
  'GK', 'GK',
  'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB',
  'DM', 'CM', 'CM', 'AM', 'LM', 'RM',
  'ST', 'ST', 'LW', 'RW',
]

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

// 구단 로스터 생성 — generateYouth 재활용(포지션 지정으로 밸런스). id는 world 네임스페이스
// (`${clubId}_p{n}`)로 다구단 충돌 방지. 결정론: 구단마다 deriveSeed(seed, hash(clubId)).
export function generateRoster(clubId, seed) {
  const rng = createRng(deriveSeed(seed, hashStr(clubId)))
  return ROSTER_QUOTA.map((position, i) => ({
    ...generateYouth({ season: 0, index: i, rng, position }),
    id: `${clubId}_p${i}`,
    club: clubId,
  }))
}

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

// 한 시즌 전체 시뮬 → { rosters, fixtures(+result), table }. 순수·결정론.
// fixture 시드는 로스터 시드와 범위가 겹치지 않게 큰 오프셋으로 파생.
export function simulateWorldSeason(league, seed, { formationId = '4-4-2' } = {}) {
  const clubIds = leagueClubIds(league)
  const rosters = Object.fromEntries(clubIds.map((id) => [id, generateRoster(id, seed)]))
  const rosterMap = {}
  for (const id of clubIds) for (const p of rosters[id]) rosterMap[p.id] = p

  const fixtures = generateFixtures(clubIds, { rounds: league.rounds })
  fixtures.forEach((fx, i) => {
    const home = buildSide(rosters[fx.homeClubId], rosterMap, formationId)
    const away = buildSide(rosters[fx.awayClubId], rosterMap, formationId)
    if (!home || !away) return
    const result = simulateMatch({ home, away, seed: deriveSeed(seed, 1_000_000 + i) })
    fx.result = { homeGoals: result.score.home, awayGoals: result.score.away }
  })

  return { rosters, fixtures, table: computeTable(clubIds, fixtures) }
}
