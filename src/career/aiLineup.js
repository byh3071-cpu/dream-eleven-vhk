// AI 구단(+내 구단의 "베스트XI 자동") 선발 — 슬롯별 (레이팅 × 포지션 적합도) 최고
// 가용 선수를 그리디로 배치. 순수 함수.
//
// positionFit 폴백이 필수인 이유(계획서 리스크 명시): DB에 RM 주포지션이 1명뿐이라
// 정확 일치만 고집하면 4-4-2 AI 팀 구성이 막힌다 — 인접/같은 라인 선수가 페널티를
// 안고 대신 선다(그 페널티는 teamStrength가 전력에 자연 반영).

import { positionFit, playerOverallRating } from '../sim/teamStrength.js'
import { findFormation } from '../data/formations.js'
import { isSuspended } from './playerState.js'

export function pickBestXI({ rosterIds, resolvePlayer, formationId, playerStates = {} }) {
  const formation = findFormation(formationId)
  const candidates = rosterIds
    .map(resolvePlayer)
    .filter((p) => p && !isSuspended(playerStates, p.id))

  const used = new Set()
  const assignments = []
  // GK 슬롯부터 채워 골키퍼 부재 크래시(엔진 전제)를 구조적으로 방지한 뒤 나머지.
  const slotOrder = [...formation.slots.keys()].sort((a, b) => {
    const gkA = formation.slots[a].role === 'GK' ? 0 : 1
    const gkB = formation.slots[b].role === 'GK' ? 0 : 1
    return gkA - gkB
  })

  for (const slotIndex of slotOrder) {
    const role = formation.slots[slotIndex].role
    let best = null
    let bestScore = -Infinity
    for (const player of candidates) {
      if (used.has(player.id)) continue
      // GK는 GK 슬롯에만, 필드 슬롯에 GK 배치 금지(적합도 0.15여도 수치상 뽑힐 수 있어 명시 차단)
      const isGk = player.positions.includes('GK')
      if ((role === 'GK') !== isGk) continue
      const score = playerOverallRating(player) * positionFit(player.positions, role)
      if (score > bestScore) { bestScore = score; best = player }
    }
    if (!best) return null // 가용 인원 부족(징계 폭탄 등) — 호출부가 처리
    used.add(best.id)
    assignments.push({ slotIndex, playerId: best.id })
  }
  return { formationId, assignments }
}
