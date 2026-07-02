import { applyTraitHooks } from './traits.js'

const BASE_DECAY_PER_MINUTE = 0.32 // 90분 내내 압박 없이 뛰면 대략 100 -> 71
const MIN_STAMINA_FACTOR = 0.55 // 완전히 지쳐도(스태미나 0) 이 배율 밑으로는 안 떨어짐

export function initialStaminaState(squad11) {
  const state = {}
  for (const { player } of squad11) state[player.id] = 100
  return state
}

export function decayStamina(staminaState, squad11, minutesElapsed, pressingIntensity = 0.5) {
  if (minutesElapsed <= 0) return
  for (const { player } of squad11) {
    const mods = applyTraitHooks(player, 'onStaminaDecay', {})
    const rateMult = mods.rateMult ?? 1
    const pressingMult = 1 + pressingIntensity * 0.4
    const decay = BASE_DECAY_PER_MINUTE * rateMult * pressingMult * minutesElapsed
    const current = staminaState[player.id] ?? 100
    staminaState[player.id] = Math.max(0, current - decay)
  }
}

export function staminaFactor(staminaState, playerId) {
  const stamina = staminaState[playerId] ?? 100
  return MIN_STAMINA_FACTOR + (1 - MIN_STAMINA_FACTOR) * (stamina / 100)
}
