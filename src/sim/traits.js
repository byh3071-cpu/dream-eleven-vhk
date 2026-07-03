// TRAIT_HOOKS — "특성·강점·약점이 실제 결과에 반영"이라는 핵심 요구사항의 구현 지점.
// 원칙: 여기 반영 위치가 명시되지 않는 특성은 만들지 않는다 (장식용 특성 나열 금지).
// 모든 훅은 (player, ctx) => modifier 형태이며, modifier 키 접미사로 병합 방식이 정해진다:
//   *Mult  → 곱연산으로 누적 (기본값 1)
//   *Bonus → 덧셈으로 누적 (기본값 0)
export const TRAIT_HOOKS = {
  left_footed: {
    onShot: (player, ctx) => (ctx.footChannel === 'right' ? { accuracyMult: 0.88 } : null),
  },
  right_footed: {
    onShot: (player, ctx) => (ctx.footChannel === 'left' ? { accuracyMult: 0.88 } : null),
  },
  // v2 N2부터 실전 발동: setpieces.js의 직접 프리킥(onSetPiece)과 크로스 공중볼
  // (duelType 'aerial' — 공격/수비 양쪽 모두)에서 실제 호출 경로가 생겼다.
  free_kick_specialist: {
    onSetPiece: (player, ctx) => (ctx.setPieceType === 'free_kick' ? { successBonus: 0.12 } : null),
  },
  aerial_threat: {
    onDuel: (player, ctx) => (ctx.duelType === 'aerial' ? { scoreMult: 1.15 } : null),
  },
  poacher: {
    onShot: (player, ctx) => (ctx.zoneBand === 'BOX' ? { accuracyMult: 1.12 } : null),
  },
  playmaker_vision: {
    onDuel: (player, ctx) => (ctx.duelType === 'progression' ? { scoreMult: 1.1 } : null),
  },
  dribbler: {
    onDuel: (player, ctx) => (ctx.duelType === 'progression' ? { scoreMult: 1.12 } : null),
  },
  veteran_declining: {
    onStaminaDecay: () => ({ rateMult: 1.3 }),
  },
  tackle_specialist: {
    onDuel: (player, ctx) => (ctx.role === 'defend' ? { scoreMult: 1.12 } : null),
  },
}

function mergeModifiers(a, b) {
  const merged = { ...a }
  for (const key of Object.keys(b)) {
    if (key.endsWith('Mult')) merged[key] = (merged[key] ?? 1) * b[key]
    else if (key.endsWith('Bonus')) merged[key] = (merged[key] ?? 0) + b[key]
    else merged[key] = b[key]
  }
  return merged
}

export function applyTraitHooks(player, hookName, ctx) {
  let result = {}
  for (const trait of player.traits ?? []) {
    const hook = TRAIT_HOOKS[trait]?.[hookName]
    if (!hook) continue
    const output = hook(player, ctx)
    if (output) result = mergeModifiers(result, output)
  }
  return result
}
