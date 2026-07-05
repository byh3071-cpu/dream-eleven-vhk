// 세트피스 판정 (v2 N2) — 프리킥(직접/크로스), 코너킥, 페널티킥.
// 전부 chainRng를 소비하는 아웃컴 계층이다(서술 아님).
//
// 휴면 특성 2종이 여기서 처음 실전 발동한다:
// - free_kick_specialist: onSetPiece 훅 (직접 FK successBonus)
// - aerial_threat: onDuel duelType 'aerial' (크로스 공중볼 — 공격/수비 양쪽 모두 적용:
//   공중볼 강한 CB가 코너 수비에서도 저절로 강해지는 창발이 의도된 동작)

import { successChance, rollSuccess } from './duel.js'
import { applyTraitHooks } from './traits.js'
import { staminaFactor } from './stamina.js'
import { pickWeighted } from './rng.js'
import { zoneDistance } from './zones.js'
import { primaryPosition } from '../data/player-schema.js'
import { TUNABLES } from './tunables.js'

function outfieldEntries(squad11) {
  return squad11.filter(({ player }) => !player.positions.includes('GK'))
}

function goalkeeperEntry(squad11) {
  return squad11.find(({ player }) => player.positions.includes('GK'))
}

function pickAerial(squad11, channel, rng) {
  const outfield = outfieldEntries(squad11)
  const ranked = outfield
    .map((entry) => ({ entry, distance: zoneDistance(primaryPosition(entry.player), 4, channel) }))
    .sort((a, b) => a.distance - b.distance)
  const pool = ranked.slice(0, 4).map((r) => r.entry)
  return pickWeighted(rng, pool, (e) => Math.max(1, e.player.stats.physical))
}

// FK 키커: 슈팅+패스 평균 최고 — 결정론적(rng 불필요), "우리 팀 키커는 정해져 있다".
export function freeKickTaker(squad11) {
  return outfieldEntries(squad11).reduce((best, entry) => {
    const score = (entry.player.stats.shooting + entry.player.stats.passing) / 2
    const bestScore = (best.player.stats.shooting + best.player.stats.passing) / 2
    return score > bestScore ? entry : best
  })
}

// 크로스 → 공중볼 듀얼 → 헤더슛. FK 크로스와 코너킥이 공유하는 루틴.
// 반환: { attacker, defender, result: 'goal' | 'shot_saved' | 'clearance' }
export function resolveCross({ possessing, defending, channel, rng }) {
  const attacker = pickAerial(possessing.squad11, channel, rng)
  const defender = pickAerial(defending.squad11, channel, rng)
  const gk = goalkeeperEntry(defending.squad11)

  const attackMods = applyTraitHooks(attacker.player, 'onDuel', { duelType: 'aerial', role: 'attack' })
  const defendMods = applyTraitHooks(defender.player, 'onDuel', { duelType: 'aerial', role: 'defend' })

  const attackScore = attacker.player.stats.physical
    * staminaFactor(possessing.stamina, attacker.player.id) * (attackMods.scoreMult ?? 1)
  const defendScore = defender.player.stats.physical
    * staminaFactor(defending.stamina, defender.player.id) * (defendMods.scoreMult ?? 1)

  const duelChance = successChance(attackScore, defendScore, TUNABLES.AERIAL_DIVISOR)
  if (!rollSuccess(rng, duelChance)) {
    return { attacker, defender, gk, result: 'clearance' }
  }
  // 헤더가 골문으로 — GK와의 마무리 판정(기본 난이도는 HEADER_SCALE로 별도 조절).
  const headerChance = successChance(
    attacker.player.stats.shooting * staminaFactor(possessing.stamina, attacker.player.id),
    gk.player.stats.defending * staminaFactor(defending.stamina, gk.player.id),
    TUNABLES.AERIAL_DIVISOR,
  ) * TUNABLES.HEADER_SCALE
  if (rollSuccess(rng, headerChance)) return { attacker, defender, gk, result: 'goal' }
  return { attacker, defender, gk, result: 'shot_saved' }
}

// 위험지역 프리킥: 중앙이면 직접슛 확률, 아니면 크로스.
// 반환: { taker, variant: 'direct'|'cross', ...variant별 결과 }
export function resolveFreeKick({ possessing, defending, channel, rng }) {
  const taker = freeKickTaker(possessing.squad11)
  const gk = goalkeeperEntry(defending.squad11)
  const direct = channel === 'CENTER' && rng() < TUNABLES.FK_DIRECT_CHANCE

  if (direct) {
    // free_kick_specialist의 onSetPiece 훅이 여기서 발동 — successBonus는 확률에 가산.
    const mods = applyTraitHooks(taker.player, 'onSetPiece', { setPieceType: 'free_kick' })
    const chance = successChance(
      taker.player.stats.shooting * staminaFactor(possessing.stamina, taker.player.id),
      gk.player.stats.defending * staminaFactor(defending.stamina, gk.player.id),
    ) * TUNABLES.FK_SCALE + (mods.successBonus ?? 0)
    let result
    if (rollSuccess(rng, Math.min(0.9, chance))) result = 'goal'
    else result = rng() < 0.5 ? 'shot_saved' : 'shot_off_target'
    return { taker, gk, variant: 'direct', result }
  }

  const cross = resolveCross({ possessing, defending, channel, rng })
  return { taker, gk, variant: 'cross', cross }
}

// 코너킥: 키커는 패스 최고(결정론), 크로스 루틴 공유.
export function resolveCorner({ possessing, defending, channel, rng }) {
  const taker = outfieldEntries(possessing.squad11).reduce((best, entry) =>
    entry.player.stats.passing > best.player.stats.passing ? entry : best)
  const cross = resolveCross({ possessing, defending, channel, rng })
  return { taker, cross }
}

// 페널티킥: 기본 0.75, 키커 슈팅/GK 수비로 미세 보정 후 클램프.
export function resolvePenalty({ shooter, gk, possessing, defending, rng }) {
  // composure 특성이 여기서 발동(ADR-001) — 압박의 정점인 PK 전환율에 successBonus를 가산한다.
  // 클램프 안쪽이라 PK_MAX가 상한을 유지하고, applyTraitHooks는 rng를 소비하지 않아 draw 수·핀
  // 구조는 불변(특성 없는 선수는 successBonus 0 → 기존 결과 비트 동일).
  const mods = applyTraitHooks(shooter.player, 'onSetPiece', { setPieceType: 'penalty' })
  const chance = Math.min(TUNABLES.PK_MAX, Math.max(TUNABLES.PK_MIN,
    TUNABLES.PK_BASE
    + (shooter.player.stats.shooting * staminaFactor(possessing.stamina, shooter.player.id) - 75) * 0.002
    - (gk.player.stats.defending * staminaFactor(defending.stamina, gk.player.id) - 75) * 0.002
    + (mods.successBonus ?? 0),
  ))
  return rollSuccess(rng, chance) ? 'goal' : 'shot_saved'
}
