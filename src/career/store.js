// 커리어 스토어 — 이 프로젝트에서 유일하게 정당화되는 스토어(다중 소비 화면 + 영속화).
// IF 모드는 기존처럼 화면 모듈 스코프 상태를 유지한다("소비자 하나면 추상화 과함" 원칙).
// 모든 액션은 변경 후 즉시 저장한다(상태 <100KB, 부분 저장 불필요).

import { CLUBS } from './clubs.js'
import { CAREER_POOL } from './players.js'
import { generateFixtures, totalRounds } from './schedule.js'
import { runDraft } from './draft.js'
import { initialPlayerState } from './playerState.js'
import { finishRound as runnerFinishRound } from './matchRunner.js'
import { saveCareer, loadCareer, clearCareer } from './persistence.js'
import { createRng, deriveSeed } from '../sim/rng.js'
import { DEFAULT_TACTICS } from '../sim/tactics-modifiers.js'

let current = null
let corrupted = false

export function initCareer(storage) {
  const loaded = loadCareer(storage)
  current = loaded.save
  corrupted = Boolean(loaded.corrupted)
}

export function getCareer() {
  return current
}

export function isCorrupted() {
  return corrupted
}

export function newCareer({ userClubId, masterSeed, storage }) {
  const clubIds = CLUBS.map((c) => c.id)
  const draftRng = createRng(deriveSeed(masterSeed, 0xd1af7))
  const { rosters, order } = runDraft({ clubIds, pool: CAREER_POOL, rng: draftRng })
  const playerState = {}
  for (const ids of Object.values(rosters)) {
    for (const id of ids) playerState[id] = initialPlayerState()
  }
  current = {
    masterSeed,
    userClubId,
    season: { number: 1, currentRound: 1 },
    rosters,
    draftOrder: order,
    fixtures: generateFixtures(clubIds),
    playerState,
    tactics: { ...DEFAULT_TACTICS },
    lineup: null,
  }
  corrupted = false
  saveCareer(current, storage)
  return current
}

export function updateCareer(mutator, storage) {
  current = mutator(current)
  saveCareer(current, storage)
  return current
}

export function setLineup(lineup, storage) {
  return updateCareer((save) => ({ ...save, lineup }), storage)
}

export function setTactics(tactics, storage) {
  return updateCareer((save) => ({ ...save, tactics }), storage)
}

export function finishRound(options, storage) {
  return updateCareer((save) => runnerFinishRound(save, options), storage)
}

export function resetCareer(storage) {
  clearCareer(storage)
  current = null
  corrupted = false
}

export function seasonDone(save = current) {
  return save != null && save.season.currentRound > totalRounds(save.fixtures)
}
