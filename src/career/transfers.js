// 이적 규칙 — 순수 함수(세이브 in/out). 시즌 사이 이적창(phase 'transfer')에서
// 영입/판매/AI-AI 이적을 처리한다. store가 감싸서 저장한다.
//
// 하드 가드(붕괴 방지): 어떤 이적도 ①로스터를 15명 밑으로 ②GK를 2명 밑으로
// 떨어뜨릴 수 없고, 내 로스터 상한은 23명. "생성 선수 보충" 없이도 리그가 유지되는
// 근거가 이 가드다(로드맵의 생성기 항목을 대체 — goal 문서에 기록).

import { findCareerPlayer } from './players.js'
import { playerValue } from './value.js'
import { CLUBS } from './clubs.js'

export const MIN_ROSTER = 15
export const MAX_ROSTER = 23
const MIN_GK = 2

const LINE_OF = {
  GK: 'gk', CB: 'def', LB: 'def', RB: 'def',
  DM: 'mid', CM: 'mid', AM: 'mid', LM: 'mid', RM: 'mid',
  LW: 'att', RW: 'att', ST: 'att',
}

export function clubOfPlayer(save, playerId) {
  for (const [clubId, ids] of Object.entries(save.rosters)) {
    if (ids.includes(playerId)) return clubId
  }
  return null
}

export function priceOf(save, playerId) {
  return playerValue(findCareerPlayer(playerId), save.contracts?.[playerId] ?? 2)
}

function gkCount(save, clubId) {
  return save.rosters[clubId].filter((id) => findCareerPlayer(id).positions.includes('GK')).length
}

function lineCounts(save, clubId) {
  const counts = { gk: 0, def: 0, mid: 0, att: 0 }
  for (const id of save.rosters[clubId]) counts[LINE_OF[findCareerPlayer(id).positions[0]]]++
  return counts
}

// 판매 측이 이 선수를 놓아줄 수 있는가(구조 가드).
function canRelease(save, clubId, playerId) {
  if (save.rosters[clubId].length - 1 < MIN_ROSTER) return false
  const isGk = findCareerPlayer(playerId).positions.includes('GK')
  if (isGk && gkCount(save, clubId) - 1 < MIN_GK) return false
  return true
}

// 내 구단의 영입 가능 판정 — 실패 사유를 사람이 읽을 문장으로 돌려준다(버튼 툴팁용).
export function canBuy(save, playerId) {
  const fromClubId = clubOfPlayer(save, playerId)
  if (!fromClubId || fromClubId === save.userClubId) return { ok: false, reason: '영입 대상이 아니야' }
  const price = priceOf(save, playerId)
  if ((save.budgets?.[save.userClubId] ?? 0) < price) return { ok: false, reason: `예산 부족 (필요 ${price}M)`, price, fromClubId }
  if (save.rosters[save.userClubId].length + 1 > MAX_ROSTER) return { ok: false, reason: `로스터 상한(${MAX_ROSTER}명)`, price, fromClubId }
  if (!canRelease(save, fromClubId, playerId)) return { ok: false, reason: '상대 구단이 놓아줄 수 없는 선수(로스터/GK 하한)', price, fromClubId }
  return { ok: true, price, fromClubId }
}

function movePlayer(save, playerId, fromClubId, toClubId, fee) {
  return {
    ...save,
    rosters: {
      ...save.rosters,
      [fromClubId]: save.rosters[fromClubId].filter((id) => id !== playerId),
      [toClubId]: [...save.rosters[toClubId], playerId],
    },
    budgets: {
      ...save.budgets,
      [fromClubId]: (save.budgets[fromClubId] ?? 0) + fee,
      [toClubId]: (save.budgets[toClubId] ?? 0) - fee,
    },
    contracts: { ...save.contracts, [playerId]: 3 }, // 이적 = 새 3년 계약
    transferLog: [...(save.transferLog ?? []), {
      season: save.season.number, playerId, fromClubId, toClubId, fee,
    }],
  }
}

export function executeBuy(save, playerId) {
  const check = canBuy(save, playerId)
  if (!check.ok) return save
  return movePlayer(save, playerId, check.fromClubId, save.userClubId, check.price)
}

// 내 선수에 대한 최고 AI 오퍼 — 예산이 충분하고 그 라인이 상대적으로 얇은 구단이 낸다.
export function bestSellOffer(save, playerId) {
  if (clubOfPlayer(save, playerId) !== save.userClubId) return null
  if (!canRelease(save, save.userClubId, playerId)) return null
  const fee = priceOf(save, playerId)
  const line = LINE_OF[findCareerPlayer(playerId).positions[0]]
  const candidates = CLUBS.map((c) => c.id)
    .filter((clubId) => clubId !== save.userClubId)
    .filter((clubId) => (save.budgets?.[clubId] ?? 0) >= fee)
    .filter((clubId) => save.rosters[clubId].length + 1 <= MAX_ROSTER)
  if (candidates.length === 0) return null
  // 그 라인 인원이 가장 적은 구단이 가장 절실 — 동률이면 예산 많은 쪽(결정론).
  candidates.sort((a, b) => {
    const needA = lineCounts(save, a)[line]
    const needB = lineCounts(save, b)[line]
    return needA - needB || (save.budgets[b] ?? 0) - (save.budgets[a] ?? 0) || a.localeCompare(b)
  })
  return { clubId: candidates[0], fee }
}

export function executeSell(save, playerId) {
  const offer = bestSellOffer(save, playerId)
  if (!offer) return save
  return movePlayer(save, playerId, save.userClubId, offer.clubId, offer.fee)
}

// AI-AI 이적 1~2건 — 이적창에 생동감을 주는 배경 거래. rng 주입(세이브 재현 가능).
export function runAiTransfers(save, rng) {
  let next = save
  const deals = rng() < 0.5 ? 1 : 2
  for (let i = 0; i < deals; i++) {
    const aiClubs = CLUBS.map((c) => c.id).filter((id) => id !== next.userClubId)
    // 구매자: 예산 최다 AI 구단. 대상: 다른 AI 구단 선수 중 "구매자의 최빈약 라인" 최고 가치.
    const buyer = [...aiClubs].sort((a, b) => (next.budgets[b] ?? 0) - (next.budgets[a] ?? 0))[0]
    const counts = lineCounts(next, buyer)
    const thinnest = ['def', 'mid', 'att'].sort((a, b) => counts[a] - counts[b])[0]
    const targets = aiClubs.filter((id) => id !== buyer)
      .flatMap((clubId) => next.rosters[clubId]
        .filter((pid) => LINE_OF[findCareerPlayer(pid).positions[0]] === thinnest)
        .filter((pid) => canRelease(next, clubId, pid))
        .map((pid) => ({ pid, clubId, price: priceOf(next, pid) })))
      .filter(({ price }) => price <= (next.budgets[buyer] ?? 0))
      .sort((a, b) => b.price - a.price || a.pid.localeCompare(b.pid))
    if (targets.length === 0) continue
    // 최고가 3명 중 rng로 선택(매 시즌 같은 거래만 반복되는 것 방지, 결정론 유지).
    const pick = targets[Math.floor(rng() * Math.min(3, targets.length))]
    if (next.rosters[buyer].length + 1 > MAX_ROSTER) continue
    next = movePlayer(next, pick.pid, pick.clubId, buyer, pick.price)
  }
  return next
}
