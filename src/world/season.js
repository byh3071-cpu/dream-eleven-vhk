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

// fixtures 배열의 각 경기를 시뮬해 result를 채운다(제자리 변경). seedBase로 시드 범위 분리.
function playFixtures(fixtures, rosters, rosterMap, formationId, seed, seedBase) {
  fixtures.forEach((fx, i) => {
    const home = buildSide(rosters[fx.homeClubId], rosterMap, formationId)
    const away = buildSide(rosters[fx.awayClubId], rosterMap, formationId)
    if (!home || !away) return
    const result = simulateMatch({ home, away, seed: deriveSeed(seed, seedBase + i) })
    fx.result = { homeGoals: result.score.home, awayGoals: result.score.away }
  })
}

// 스플릿 최종 순위: 파이널A(상위 그룹) 전원이 파이널B 위에 고정, 그룹 내는 전체 승점순
// (정규+스플릿 누적). 한국 K리그 스플릿 규약.
function splitFinalTable(clubIds, allFixtures, groupA, groupB) {
  const full = computeTable(clubIds, allFixtures)
  const byId = Object.fromEntries(full.map((r) => [r.clubId, r]))
  const rank = Object.fromEntries(full.map((r, i) => [r.clubId, i]))
  const sortByRank = (ids) => ids.map((id) => byId[id]).sort((a, b) => rank[a.clubId] - rank[b.clubId])
  return [...sortByRank(groupA), ...sortByRank(groupB)]
}

// 한 시즌 전체 시뮬 → { rosters, fixtures(+result·phase), table }. 순수·결정론.
// 반환 계약 고정: {rosters, fixtures, table}. 스플릿도 이 형태 안에서(fixtures에 phase 태그,
// table은 최종 순위) — 세이브/대륙컵이 이 계약에 의존하므로 형태를 바꾸지 않는다(advisor).
export function simulateWorldSeason(league, seed, { formationId = '4-4-2' } = {}) {
  const clubIds = leagueClubIds(league)
  const rosters = Object.fromEntries(clubIds.map((id) => [id, generateRoster(id, seed)]))
  const rosterMap = {}
  for (const id of clubIds) for (const p of rosters[id]) rosterMap[p.id] = p

  const fixtures = generateFixtures(clubIds, { rounds: league.rounds })
  fixtures.forEach((f) => { f.phase = 'regular' })
  playFixtures(fixtures, rosters, rosterMap, formationId, seed, 1_000_000)

  // 한국식 스플릿: 정규 라운드 후 상·하위 그룹 분할 → 각 그룹 내 라운드로빈(승점 승계).
  if (league.split) {
    const size = league.split.groupSize
    const ranked = computeTable(clubIds, fixtures).map((r) => r.clubId)
    const groupA = ranked.slice(0, size)
    const groupB = ranked.slice(size)
    const roundOffset = (clubIds.length - 1) * league.rounds
    const splitFx = [
      ...generateFixtures(groupA, { rounds: 1 }).map((f) => ({ ...f, round: f.round + roundOffset, phase: 'finalA' })),
      ...generateFixtures(groupB, { rounds: 1 }).map((f) => ({ ...f, round: f.round + roundOffset, phase: 'finalB' })),
    ]
    playFixtures(splitFx, rosters, rosterMap, formationId, seed, 2_000_000)
    fixtures.push(...splitFx)
    return { rosters, fixtures, table: splitFinalTable(clubIds, fixtures, groupA, groupB) }
  }

  return { rosters, fixtures, table: computeTable(clubIds, fixtures) }
}
