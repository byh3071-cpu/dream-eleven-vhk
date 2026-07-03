// 커리어 스토어 — 이 프로젝트에서 유일하게 정당화되는 스토어(다중 소비 화면 + 영속화).
// IF 모드는 기존처럼 화면 모듈 스코프 상태를 유지한다("소비자 하나면 추상화 과함" 원칙).
// 모든 액션은 변경 후 즉시 저장한다(상태 <100KB, 부분 저장 불필요).
//
// 커리어 phase 흐름(N5 확정): 시즌1만 드래프트, 이후는 이적창이 로스터를 잇는다 —
// 전면 재드래프트는 "사고판" 연속성을 부수기 때문에 N5에서 이적창으로 대체됐다.
//   'draft'    — 시즌 1 스네이크 드래프트 (중단/재개 가능)
//   'season'   — 시즌 진행 중
//   'transfer' — 시즌 사이 이적창 (영입/판매/AI 거래 후 다음 시즌 시작)

import { CLUBS } from './clubs.js'
import { CAREER_POOL, findCareerPlayer, resolveCareerPlayer } from './players.js'
import { generateYouth } from './youthGen.js'
import { generateFixtures, totalRounds } from './schedule.js'
import { createDraftState, applyPick, aiPickFor, isDraftDone, currentClubOf } from './draft.js'
import { initialPlayerState } from './playerState.js'
import { finishRound as runnerFinishRound } from './matchRunner.js'
import { topScorers } from './records.js'
import { seasonMvp } from './awards.js'
import { FINANCE } from './finance.js'
import { executeBuy, executeSell, runAiTransfers } from './transfers.js'
import { computeTable } from './table.js'
import { saveCareer, loadCareer, clearCareer } from './persistence.js'
import { createRng, deriveSeed } from '../sim/rng.js'
import { DEFAULT_TACTICS } from '../sim/tactics-modifiers.js'

const DRAFT_SALT = 0xd1af7

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

// 현 세이브 바운드 선수 리졸버 — 화면/러너 주입용(유스+에이징 반영).
export function resolvePlayer(id) {
  return resolveCareerPlayer(current, id)
}

export function isCorrupted() {
  return corrupted
}

function draftRngFor(masterSeed, seasonNumber) {
  // 시즌마다 다른 드래프트 판 — masterSeed 파생이라 세이브 재현은 유지.
  return createRng(deriveSeed(masterSeed, DRAFT_SALT + seasonNumber))
}

export function newCareer({ userClubId, masterSeed, storage }) {
  const clubIds = CLUBS.map((c) => c.id)
  current = {
    masterSeed,
    userClubId,
    phase: 'draft',
    season: { number: 1, currentRound: 1 },
    draftState: createDraftState({ clubIds, pool: CAREER_POOL, rng: draftRngFor(masterSeed, 1) }),
    rosters: null, // 드래프트 종료 시 확정
    fixtures: [],
    playerState: {},
    history: [],
    budgets: {},
    contracts: {},
    transferLog: [],
    seasonStats: {},
    boardTrust: 55,
    financeLog: [],
    debtRounds: 0,
    gameOverReason: null,
    youthPlayers: {},
    academyCandidates: [],
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

// ---------- 드래프트 액션 ----------

// 내 픽 1회 적용 후, 다음 내 차례(또는 종료)까지 AI 픽을 즉시 배치로 진행한다.
// setTimeout 연출을 쓰지 않는 이유: 라우터에 unmount 훅이 없어 타이머는 전부 고아
// 위험이다(matchPlayback의 단일 소유권과 같은 문제) — 드래프트는 즉시 배치가 안전하다.
export function draftPick(playerId, storage) {
  return updateCareer((save) => {
    let draftState = applyPick(save.draftState, playerId)
    draftState = advanceAiPicks(save, draftState)
    return finalizeIfDone({ ...save, draftState })
  }, storage)
}

// 커리어 시작/재개 직후: 내 차례가 아니면 AI 픽을 내 차례까지 진행.
export function draftCatchUp(storage) {
  return updateCareer((save) => {
    if (save.phase !== 'draft') return save
    const draftState = advanceAiPicks(save, save.draftState)
    return finalizeIfDone({ ...save, draftState })
  }, storage)
}

function advanceAiPicks(save, draftState) {
  // AI 지터 rng: 진행 상황(pickIndex)에서 파생 — 재개해도 같은 픽(세이브 재현성).
  while (!isDraftDone(draftState) && currentClubOf(draftState) !== save.userClubId) {
    const rng = createRng(deriveSeed(save.masterSeed, DRAFT_SALT + save.season.number * 1000 + draftState.pickIndex))
    draftState = applyPick(draftState, aiPickFor(draftState, findCareerPlayer, rng))
  }
  return draftState
}

function contractYearsFor(playerId, seasonNumber) {
  // 결정론적 1~3년 배정(세이브 재현) — id 해시 + 시즌 번호.
  let hash = seasonNumber
  for (const ch of playerId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return (hash % 3) + 1
}

const INITIAL_BUDGET_M = 60

function finalizeIfDone(save) {
  if (save.phase !== 'draft' || !isDraftDone(save.draftState)) return save
  const clubIds = CLUBS.map((c) => c.id)
  const playerState = {}
  const contracts = {}
  for (const ids of Object.values(save.draftState.rosters)) {
    for (const id of ids) {
      playerState[id] = initialPlayerState()
      contracts[id] = contractYearsFor(id, save.season.number)
    }
  }
  return {
    ...save,
    phase: 'season',
    rosters: save.draftState.rosters,
    draftState: null,
    fixtures: generateFixtures(clubIds),
    playerState,
    contracts,
    budgets: Object.fromEntries(clubIds.map((id) => [id, INITIAL_BUDGET_M])),
    lineup: null,
  }
}

// ---------- 시즌 액션 ----------

export function setLineup(lineup, storage) {
  return updateCareer((save) => ({ ...save, lineup }), storage)
}

export function setTactics(tactics, storage) {
  return updateCareer((save) => ({ ...save, tactics }), storage)
}

export function finishRound(options, storage) {
  return updateCareer((save) => runnerFinishRound(save, options), storage)
}

export function seasonDone(save = current) {
  return save != null && save.phase === 'season'
    && save.season.currentRound > totalRounds(save.fixtures)
}

// 시즌 종료 → 히스토리 적립 + 이적창 개장. 로스터는 유지된다(연속성) —
// 재드래프트는 이적의 의미를 지우기 때문에 N5에서 폐지(시즌 1 드래프트만).
// 순위 보상: 1위 40M, 2위 30M, 3위 25M, 4위 20M (기존 잔액에 가산).
const PRIZE_BY_RANK = [40, 30, 25, 20]

export function enterTransferWindow(storage) {
  return updateCareer((save) => {
    const clubIds = CLUBS.map((c) => c.id)
    const table = computeTable(clubIds, save.fixtures)
    const scorers = topScorers(save.fixtures, { limit: 1 })
    const budgets = { ...save.budgets }
    table.forEach((row, rank) => {
      budgets[row.clubId] = (budgets[row.clubId] ?? 0) + PRIZE_BY_RANK[rank]
    })
    const championTrust = table[0].clubId === save.userClubId ? FINANCE.TRUST_CHAMPION : 0
    const contracts = Object.fromEntries(
      Object.entries(save.contracts).map(([id, years]) => [id, Math.max(0, years - 1)]))
    let next = {
      ...save,
      phase: 'transfer',
      season: { number: save.season.number + 1, currentRound: 1 },
      history: [...save.history, {
        season: save.season.number,
        championClubId: table[0].clubId,
        topScorer: scorers[0] ?? null,
        mvp: seasonMvp(save.seasonStats),
        myClubRank: table.findIndex((row) => row.clubId === save.userClubId) + 1,
      }],
      budgets,
      contracts,
      seasonStats: {}, // 어워드는 history로 박제 — 집계는 시즌 단위로 리셋
      boardTrust: Math.min(100, (save.boardTrust ?? 55) + championTrust),
      debtRounds: 0,
    }
    // AI-AI 배경 거래 — 이적창 개장 시 1~2건(결정론 rng).
    const rng = createRng(deriveSeed(save.masterSeed, 0x7a5f + next.season.number))
    next = runAiTransfers(next, rng)

    // 유스 아카데미(goal 18): 구단별 후보 생성(내 구단 3명, AI 2명 중 최고 1명 자동 영입).
    const youthRng = createRng(deriveSeed(save.masterSeed, 0x70d7 + next.season.number))
    const candidates = []
    let youthIndex = 0
    const youthPlayers = { ...next.youthPlayers }
    const youthRosters = { ...next.rosters }
    const youthContracts = { ...next.contracts }
    const youthState = { ...next.playerState }
    for (const clubId of clubIds) {
      const mine = clubId === next.userClubId
      const count = mine ? 3 : 2
      const clubCandidates = []
      for (let i = 0; i < count; i++) {
        clubCandidates.push(generateYouth({ season: next.season.number, index: youthIndex++, rng: youthRng }))
      }
      if (mine) {
        candidates.push(...clubCandidates.map((c) => ({ ...c, clubId })))
      } else if (youthRosters[clubId].length < 23) {
        // AI는 potential 최고 1명 자동 계약(3년)
        const best = [...clubCandidates].sort((a, b) => b.potential - a.potential)[0]
        youthPlayers[best.id] = best
        youthRosters[clubId] = [...youthRosters[clubId], best.id]
        youthContracts[best.id] = 3
        youthState[best.id] = initialPlayerState()
      }
    }
    return { ...next, academyCandidates: candidates, youthPlayers, rosters: youthRosters, contracts: youthContracts, playerState: youthState }
  }, storage)
}

// 아카데미 후보 계약(무료, 3년) — 이적창에서만. 로스터 상한 가드.
export function signAcademyPlayer(candidateId, storage) {
  return updateCareer((save) => {
    const candidate = save.academyCandidates.find((c) => c.id === candidateId)
    if (!candidate || save.phase !== 'transfer') return save
    if (save.rosters[save.userClubId].length >= 23) return save
    const { clubId: _drop, ...youth } = candidate
    return {
      ...save,
      youthPlayers: { ...save.youthPlayers, [youth.id]: youth },
      rosters: { ...save.rosters, [save.userClubId]: [...save.rosters[save.userClubId], youth.id] },
      contracts: { ...save.contracts, [youth.id]: 3 },
      playerState: { ...save.playerState, [youth.id]: initialPlayerState() },
      academyCandidates: save.academyCandidates.filter((c) => c.id !== candidateId),
    }
  }, storage)
}

export function buyPlayer(playerId, storage) {
  return updateCareer((save) => executeBuy(save, playerId), storage)
}

export function sellPlayer(playerId, storage) {
  return updateCareer((save) => executeSell(save, playerId), storage)
}

// 이적창 닫고 다음 시즌 개막 — 일정 재생성, 컨디션 리셋, 라인업은 재구성 강제.
export function startSeasonAfterTransfer(storage) {
  return updateCareer((save) => {
    const clubIds = CLUBS.map((c) => c.id)
    const playerState = {}
    for (const ids of Object.values(save.rosters)) {
      for (const id of ids) playerState[id] = initialPlayerState()
    }
    // 만료(0년) 계약은 새 시즌 자동 1년 재계약(방출 시스템은 N6 경영에서).
    const contracts = Object.fromEntries(
      Object.entries(save.contracts).map(([id, years]) => [id, years === 0 ? 1 : years]))
    return {
      ...save,
      academyCandidates: [], // 미영입 유스 후보는 개막과 함께 소멸
      phase: 'season',
      fixtures: generateFixtures(clubIds),
      playerState,
      contracts,
      lineup: null,
    }
  }, storage)
}

export function resetCareer(storage) {
  clearCareer(storage)
  current = null
  corrupted = false
}
