// 밸런스드 드래프트 — 시즌 시작 시 4구단이 커리어 풀을 나눠 갖는다. 순수 함수(rng 주입).
// N3는 자동 배정(결과 로그만 노출), 인터랙티브 스네이크 드래프트 UI는 N4(goal 14).
//
// 규칙:
// 1) DB GK 4명을 구단당 1명씩 먼저 배정(주전 GK 보장), 필러 GK 4명을 백업으로 1명씩.
// 2) 나머지 필드플레이어 68명을 스네이크 순서(1234-4321-...)로 17라운드 드래프트.
//    각 픽은 "레이팅 + 포지션 필요 보너스" 최고 선수 — 라인(수비/미드/공격) 목표
//    분포(6/6/5)에 모자란 라인의 선수를 우대해 어느 구단도 특정 라인이 공백이 되지 않게.

import { playerOverallRating } from '../sim/teamStrength.js'

const LINE_OF = {
  GK: 'gk', CB: 'def', LB: 'def', RB: 'def',
  DM: 'mid', CM: 'mid', AM: 'mid', LM: 'mid', RM: 'mid',
  LW: 'att', RW: 'att', ST: 'att',
}
const LINE_TARGET = { def: 6, mid: 6, att: 5 } // 필드 17명 기준

export function runDraft({ clubIds, pool, rng }) {
  const rosters = Object.fromEntries(clubIds.map((id) => [id, []]))
  const lineCount = Object.fromEntries(clubIds.map((id) => [id, { def: 0, mid: 0, att: 0 }]))

  const gks = pool.filter((p) => p.positions.includes('GK') && !p.id.startsWith('filler_'))
  const fillerGks = pool.filter((p) => p.positions.includes('GK') && p.id.startsWith('filler_'))
  const outfield = pool.filter((p) => !p.positions.includes('GK'))

  // 드래프트 순번은 rng로 셔플(시즌마다 다른 판) — masterSeed 파생이라 세이브 재현 가능.
  const order = [...clubIds]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  // 1) GK 배정: 레이팅 순 GK를 드래프트 순번대로.
  const gksByRating = [...gks].sort((a, b) => playerOverallRating(b) - playerOverallRating(a))
  order.forEach((clubId, i) => rosters[clubId].push(gksByRating[i].id))
  order.forEach((clubId, i) => rosters[clubId].push(fillerGks[i].id))

  // 2) 필드 스네이크 드래프트.
  const available = new Set(outfield.map((p) => p.id))
  const byId = new Map(outfield.map((p) => [p.id, p]))
  const rounds = Math.ceil(outfield.length / clubIds.length)
  for (let round = 0; round < rounds; round++) {
    const seq = round % 2 === 0 ? order : [...order].reverse()
    for (const clubId of seq) {
      if (available.size === 0) break
      const counts = lineCount[clubId]
      let bestId = null
      let bestScore = -Infinity
      for (const id of available) {
        const player = byId.get(id)
        const line = LINE_OF[player.positions[0]]
        const deficit = Math.max(0, LINE_TARGET[line] - counts[line])
        // 모자란 라인 우대(+12/부족분), 동률은 미세 rng 지터로 결정(스네이크 재미 요소).
        const score = playerOverallRating(player) + deficit * 12 + rng() * 0.01
        if (score > bestScore) { bestScore = score; bestId = id }
      }
      const picked = byId.get(bestId)
      rosters[clubId].push(bestId)
      counts[LINE_OF[picked.positions[0]]]++
      available.delete(bestId)
    }
  }

  return { rosters, order }
}
