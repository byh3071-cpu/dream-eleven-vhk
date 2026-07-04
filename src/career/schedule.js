// 시즌 일정 생성 — 서클 메서드 라운드로빈(임의 짝수 팀). 순수 함수.
// rounds회 반복하며 회차마다 홈/원정을 뒤집어 균형을 맞춘다.
//   4구단 rounds=4(기본) → 쿼드러플 12라운드, 팀당 12경기 (기존 동작 그대로 — 서클 메서드가
//     옛 BASE_ROUNDS와 동일 순서를 재현함이 검증됨).
//   8구단 rounds=2 → 더블 14라운드, 팀당 14경기 (리그 확장 목표).

// 서클 메서드 한 바퀴 = N-1 라운드, 각 라운드 N/2 경기(모든 팀이 모든 상대와 정확히 1번).
// arr[0]을 고정하고 나머지를 매 라운드 순환시킨다.
function circleRounds(n) {
  const rounds = []
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let r = 0; r < n - 1; r++) {
    const pairings = []
    for (let i = 0; i < n / 2; i++) pairings.push([arr[i], arr[n - 1 - i]])
    rounds.push(pairings)
    arr.splice(1, 0, arr.pop())
  }
  return rounds
}

export function generateFixtures(clubIds, { rounds = 4 } = {}) {
  const n = clubIds.length
  if (n < 2 || n % 2 !== 0) throw new Error(`짝수 2팀 이상 필요: ${n}구단 입력`)
  const base = circleRounds(n)
  const fixtures = []
  for (let rep = 0; rep < rounds; rep++) {
    const flip = rep % 2 === 1
    base.forEach((pairings, i) => {
      const round = rep * base.length + i + 1
      for (const [h, a] of pairings) {
        fixtures.push({
          round,
          homeClubId: clubIds[flip ? a : h],
          awayClubId: clubIds[flip ? h : a],
          result: null,
        })
      }
    })
  }
  return fixtures
}

export function fixturesOfRound(fixtures, round) {
  return fixtures.filter((f) => f.round === round)
}

export function totalRounds(fixtures) {
  return fixtures.reduce((max, f) => Math.max(max, f.round), 0)
}
