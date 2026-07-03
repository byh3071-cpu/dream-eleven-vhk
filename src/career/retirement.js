// 은퇴 — 시즌 전환 시 파생 나이 기준 판정(순수 함수, rng 주입 결정론). goal 20.
// 34세부터 확률 상승, 37세+ 강제. 구조 가드: 은퇴로 로스터가 15명/GK 2명 밑으로
// 내려가면 그 선수는 "한 시즌 더" 잔류한다(가드가 곧 서사 — 노장의 마지막 헌신).
// 은퇴자는 로스터에서만 빠지고 youthPlayers/기록은 보존된다(명예의 전당 열람).

import { resolveCareerPlayer } from './players.js'

const RETIRE_BASE_AGE = 34
const RETIRE_FORCE_AGE = 37
const MIN_ROSTER = 15
const MIN_GK = 2

function retireChance(age) {
  if (age >= RETIRE_FORCE_AGE) return 1
  if (age < RETIRE_BASE_AGE) return 0
  return (age - RETIRE_BASE_AGE + 1) * 0.25 // 34:25% 35:50% 36:75%
}

// save는 이미 새 시즌 번호(전환 후) — 파생 나이가 +1 된 시점 기준으로 판정한다.
export function rollRetirements(save, rng) {
  const retirees = []
  const rosters = {}

  for (const [clubId, ids] of Object.entries(save.rosters)) {
    const resolved = ids.map((id) => ({ id, player: resolveCareerPlayer(save, id) }))
    // 나이 많은 순으로 판정 — 가드에 걸리면 젊은 쪽이 아니라 노장이 남는 게 자연스러움
    const ordered = [...resolved].sort((a, b) => b.player.age - a.player.age)
    const keep = new Set(ids)
    let gkCount = resolved.filter((r) => r.player.positions.includes('GK')).length

    for (const { id, player } of ordered) {
      if (retireChance(player.age) <= 0) break // 정렬상 이후는 전부 더 젊다
      if (rng() >= retireChance(player.age)) continue
      const isGk = player.positions.includes('GK')
      if (keep.size - 1 < MIN_ROSTER) continue // 하한 유예 — 한 시즌 더
      if (isGk && gkCount - 1 < MIN_GK) continue
      keep.delete(id)
      if (isGk) gkCount--
      retirees.push({
        playerId: id,
        name: player.name,
        age: player.age,
        clubId,
        season: save.season.number - 1, // "지난 시즌을 끝으로" 은퇴
      })
    }
    rosters[clubId] = ids.filter((id) => keep.has(id))
  }

  return { retirees, rosters }
}
