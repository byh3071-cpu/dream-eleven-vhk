// 라운드 오케스트레이션 — 내 경기 입력 준비 + AI 경기 일괄 시뮬 + 결과/상태 반영.
// 경기 시드 = deriveSeed(masterSeed, fixtureIndex): 같은 세이브는 같은 시즌 전개이고,
// "관전"과 "즉시 결과"가 반드시 같은 결과를 낸다(둘 다 같은 시드의 사전계산).

import { simulateMatch } from '../sim/engine.js'
import { deriveSeed } from '../sim/rng.js'
import { findFormation } from '../data/formations.js'
import { DEFAULT_TACTICS } from '../sim/tactics-modifiers.js'
import { pickBestXI } from './aiLineup.js'
import { dampenPlayer, applyRound, stateOf } from './playerState.js'
import { findCareerPlayer } from './players.js'

// AI 구단 전술/포메이션 — 구단별 개성(N4에서 확장 여지).
const AI_FORMATIONS = { aurum: '4-3-3', obsidian: '4-4-2', crimson: '4-2-3-1', glacier: '4-4-2' }

function lineupToSquad11(lineup, playerStates) {
  return lineup.assignments.map(({ slotIndex, playerId }) => ({
    player: dampenPlayer(findCareerPlayer(playerId), playerStates),
    slotIndex,
  }))
}

export function buildLineupFor(save, clubId) {
  if (clubId === save.userClubId && save.lineup) return save.lineup
  return pickBestXI({
    rosterIds: save.rosters[clubId],
    resolvePlayer: findCareerPlayer,
    formationId: AI_FORMATIONS[clubId] ?? '4-4-2',
    playerStates: save.playerState,
  })
}

export function buildMatchInput(save, fixture) {
  const homeLineup = buildLineupFor(save, fixture.homeClubId)
  const awayLineup = buildLineupFor(save, fixture.awayClubId)
  if (!homeLineup || !awayLineup) return null
  const tacticsOf = (clubId) =>
    clubId === save.userClubId ? (save.tactics ?? { ...DEFAULT_TACTICS }) : { ...DEFAULT_TACTICS }
  return {
    home: {
      squad11: lineupToSquad11(homeLineup, save.playerState),
      formation: findFormation(homeLineup.formationId),
      tactics: tacticsOf(fixture.homeClubId),
    },
    away: {
      squad11: lineupToSquad11(awayLineup, save.playerState),
      formation: findFormation(awayLineup.formationId),
      tactics: tacticsOf(fixture.awayClubId),
    },
    lineups: { home: homeLineup, away: awayLineup },
  }
}

export function seedForFixture(save, fixtureIndex) {
  return deriveSeed(save.masterSeed, fixtureIndex)
}

export function simulateFixture(save, fixtureIndex) {
  const fixture = save.fixtures[fixtureIndex]
  const input = buildMatchInput(save, fixture)
  if (!input) return null
  const result = simulateMatch({
    home: input.home, away: input.away, seed: seedForFixture(save, fixtureIndex),
  })
  return { fixture, input, result }
}

function toStoredResult(result) {
  return {
    homeGoals: result.score.home,
    awayGoals: result.score.away,
    scorers: result.events
      .filter((e) => e.type === 'goal')
      .map((e) => ({ playerId: e.actorId, minute: e.minute, team: e.team })),
  }
}

// 현재 라운드 전 경기를 확정하고 선수 상태를 갱신한 "다음 save"를 반환한다(불변).
// precomputedMine: 관전 플로우가 이미 시뮬한 내 경기 {fixtureIndex, result} — 같은 시드라
// 재시뮬해도 동일하지만, 계산 낭비를 피하고 "본 것이 곧 기록"임을 코드로 보장.
export function finishRound(save, { precomputedMine = null } = {}) {
  const round = save.season.currentRound
  const cards = []
  const playedIds = []
  const resultByClub = {}
  const clubOfMap = {}
  for (const [clubId, ids] of Object.entries(save.rosters)) {
    for (const id of ids) clubOfMap[id] = clubId
  }

  const fixtures = save.fixtures.map((f) => ({ ...f }))
  save.fixtures.forEach((fixture, index) => {
    if (fixture.round !== round || fixtures[index].result) return
    let result
    let input
    if (precomputedMine && precomputedMine.fixtureIndex === index) {
      result = precomputedMine.result
      input = precomputedMine.input
    } else {
      const sim = simulateFixture(save, index)
      result = sim.result
      input = sim.input
    }
    fixtures[index].result = toStoredResult(result)

    for (const side of ['home', 'away']) {
      for (const { playerId } of input.lineups[side].assignments) playedIds.push(playerId)
    }
    const { home, away } = { home: result.score.home, away: result.score.away }
    resultByClub[fixture.homeClubId] = home > away ? 'W' : home < away ? 'L' : 'D'
    resultByClub[fixture.awayClubId] = away > home ? 'W' : away < home ? 'L' : 'D'
    for (const evt of result.events) {
      if (evt.type === 'yellow_card') cards.push({ playerId: evt.actorId, type: 'yellow' })
      if (evt.type === 'red_card') cards.push({ playerId: evt.actorId, type: 'red' })
    }
  })

  const allIds = Object.values(save.rosters).flat()
  const playerState = applyRound(save.playerState, {
    allIds, playedIds, resultByClub, clubOf: (id) => clubOfMap[id], cards,
  })

  // 내 라인업에 새로 정지된 선수가 있으면 비워서 다음 라운드에 교체를 강제한다.
  let lineup = save.lineup
  if (lineup) {
    const cleaned = lineup.assignments.filter(({ playerId }) => stateOf(playerState, playerId).suspendedFor === 0)
    if (cleaned.length !== lineup.assignments.length) lineup = { ...lineup, assignments: cleaned }
  }

  return {
    ...save,
    fixtures,
    playerState,
    lineup,
    season: { ...save.season, currentRound: round + 1 },
  }
}
