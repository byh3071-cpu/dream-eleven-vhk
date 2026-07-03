// 스네이크 드래프트 — 픽 단위 프리미티브(N4 인터랙티브 드래프트용) + 자동 전체 실행.
// 전부 순수 함수(rng 주입): 드래프트 상태는 세이브에 그대로 저장돼 중단/재개가 된다.
//
// 규칙:
// 1) DB GK 4명을 구단당 1명씩 선배정(주전 GK 보장), 필러 GK 4명을 백업으로 1명씩 —
//    GK가 드래프트 풀에 섞이면 막픽 구단이 GK 없이 끝나는 붕괴 케이스가 생겨서 제외.
// 2) 필드플레이어 68명을 스네이크 순서(1234-4321-...)로 17라운드 픽.
// 3) AI 픽 = "레이팅 + 라인 부족 보너스" 최고(라인 목표 수비6/미드6/공격5) — 어느 구단도
//    특정 라인이 공백이 되지 않게. 사용자 픽은 자유(그 리스크도 감독의 몫).

import { playerOverallRating } from '../sim/teamStrength.js'

const LINE_OF = {
  GK: 'gk', CB: 'def', LB: 'def', RB: 'def',
  DM: 'mid', CM: 'mid', AM: 'mid', LM: 'mid', RM: 'mid',
  LW: 'att', RW: 'att', ST: 'att',
}
const LINE_TARGET = { def: 6, mid: 6, att: 5 } // 필드 17명 기준

function shuffled(items, rng) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 드래프트 시작 상태 — 세이브에 직렬화 가능한 플레인 데이터만 담는다.
export function createDraftState({ clubIds, pool, rng }) {
  const order = shuffled(clubIds, rng)
  const gks = pool.filter((p) => p.positions.includes('GK') && !p.id.startsWith('filler_'))
  const fillerGks = pool.filter((p) => p.positions.includes('GK') && p.id.startsWith('filler_'))
  const outfield = pool.filter((p) => !p.positions.includes('GK'))

  const rosters = Object.fromEntries(clubIds.map((id) => [id, []]))
  const gksByRating = [...gks].sort((a, b) => playerOverallRating(b) - playerOverallRating(a))
  order.forEach((clubId, i) => rosters[clubId].push(gksByRating[i].id))
  order.forEach((clubId, i) => rosters[clubId].push(fillerGks[i].id))

  return {
    order,
    pickIndex: 0,
    totalPicks: outfield.length,
    availableIds: outfield.map((p) => p.id),
    rosters,
    log: [], // [{pickNumber, clubId, playerId}] — 화면 픽 로그용
  }
}

export function isDraftDone(draftState) {
  return draftState.pickIndex >= draftState.totalPicks
}

// 현재 픽 차례인 구단 — 스네이크: 짝수 라운드는 정방향, 홀수 라운드는 역방향.
export function currentClubOf(draftState) {
  if (isDraftDone(draftState)) return null
  const clubCount = draftState.order.length
  const round = Math.floor(draftState.pickIndex / clubCount)
  const offset = draftState.pickIndex % clubCount
  return round % 2 === 0
    ? draftState.order[offset]
    : draftState.order[clubCount - 1 - offset]
}

// 픽 적용(불변) — 차례 구단이 available에서 한 명을 가져간다.
export function applyPick(draftState, playerId) {
  const clubId = currentClubOf(draftState)
  if (!clubId) throw new Error('드래프트가 이미 끝났다')
  if (!draftState.availableIds.includes(playerId)) throw new Error(`픽 불가(이미 지명됨): ${playerId}`)
  return {
    ...draftState,
    pickIndex: draftState.pickIndex + 1,
    availableIds: draftState.availableIds.filter((id) => id !== playerId),
    rosters: {
      ...draftState.rosters,
      [clubId]: [...draftState.rosters[clubId], playerId],
    },
    log: [...draftState.log, { pickNumber: draftState.pickIndex + 1, clubId, playerId }],
  }
}

// AI 픽 후보 — 레이팅 + 라인 부족 보너스(+지터는 rng로, 세이브 재현 가능).
export function aiPickFor(draftState, resolvePlayer, rng) {
  const clubId = currentClubOf(draftState)
  const counts = { def: 0, mid: 0, att: 0 }
  for (const id of draftState.rosters[clubId]) {
    const line = LINE_OF[resolvePlayer(id).positions[0]]
    if (line !== 'gk') counts[line]++
  }
  let bestId = null
  let bestScore = -Infinity
  for (const id of draftState.availableIds) {
    const player = resolvePlayer(id)
    const line = LINE_OF[player.positions[0]]
    const deficit = Math.max(0, LINE_TARGET[line] - counts[line])
    const score = playerOverallRating(player) + deficit * 12 + rng() * 0.01
    if (score > bestScore) { bestScore = score; bestId = id }
  }
  return bestId
}

// 전체 자동 드래프트(N3 자동 배정 경로 + 테스트/AI 시즌 전환용) — 프리미티브 위의 루프.
export function runDraft({ clubIds, pool, rng }) {
  let draftState = createDraftState({ clubIds, pool, rng })
  const byId = new Map(pool.map((p) => [p.id, p]))
  const resolvePlayer = (id) => byId.get(id)
  while (!isDraftDone(draftState)) {
    draftState = applyPick(draftState, aiPickFor(draftState, resolvePlayer, rng))
  }
  return { rosters: draftState.rosters, order: draftState.order }
}
