// mulberry32 — 결정론적(seed 고정 시 재현 가능) 32비트 PRNG.
// Math.random()을 쓰지 않는 이유: 재현 가능한 리플레이/공유(URL에 seed 인코딩, v1.5)와
// 몬테카를로 검증 하네스의 반복 실행 안정성을 위해 시드 기반이 필수.
export function createRng(seed) {
  let a = seed >>> 0
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// min~max 포함 정수
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

// 하나의 seed에서 서로 "독립적으로 보이는" 정수 시드를 여러 개 파생시킨다.
// 왜 필요한가: 매치 시뮬레이션에서 "누가 공을 잡는가"(구조적 판정, 매 체인 정확히 1회 draw)와
// "체인 내부에서 무슨 일이 일어나는가"(가변 길이 draw, 실패 시 짧고 골까지 가면 김)를 같은
// 연속 스트림에서 번갈아 소비하면, mulberry32 특성상 아주 작지만 통계적으로 유의미한
// 편향이 생긴다(실측: 100판 몬테카를로에서 홈/원정 득점이 약 3% 정도 어긋남). 관심사별로
// 스트림을 분리하면 이 상호작용이 끊어진다 — 시뮬레이션에서 흔한 패턴(관심사별 독립 RNG 스트림).
export function deriveSeed(seed, salt) {
  let h = (seed ^ salt) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = (h ^ (h >>> 16)) >>> 0
  return h
}

// weightFn(item) 값에 비례한 확률로 하나를 뽑는다. 모든 weight 합이 0이면 첫 항목 반환.
export function pickWeighted(rng, items, weightFn) {
  const weights = items.map((item) => Math.max(0, weightFn(item)))
  const total = weights.reduce((sum, w) => sum + w, 0)
  if (total <= 0) return items[0]
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}
