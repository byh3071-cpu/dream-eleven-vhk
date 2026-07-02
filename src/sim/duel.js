// Elo 승률 공식(1/(1+10^(diff/D)))을 그대로 빌려온다 — 한 줄짜리 공식이면서
// "이만큼 차이나면 대략 이 정도 확률"이라는 직관적 튜닝이 가능하다.
// 단, 체스의 D=400은 1~99 스탯 스케일에 비해 지나치게 평평해서(15점 차이가 겨우 52%)
// 스탯 차이가 체감되지 않는다. divisor는 30~60 범위에서 시작해 검증 하네스로 실측 튜닝한다.
const DEFAULT_DIVISOR = 70
const MIN_CHANCE = 0.1
const MAX_CHANCE = 0.9

export function successChance(offenseScore, defenseScore, divisor = DEFAULT_DIVISOR) {
  const raw = 1 / (1 + Math.pow(10, (defenseScore - offenseScore) / divisor))
  return Math.min(MAX_CHANCE, Math.max(MIN_CHANCE, raw))
}

export function rollSuccess(rng, chance) {
  return rng() < chance
}
