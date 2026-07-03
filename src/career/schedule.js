// 시즌 일정 생성 — 4구단 쿼드러플 라운드로빈(각 상대와 4번: 홈2/원정2) = 12라운드,
// 라운드당 2경기, 총 24경기(팀당 12경기). 순수 함수.

// 4팀 서클 메서드 한 바퀴(3라운드). 반복 회차마다 홈/원정을 뒤집어 균형을 맞춘다.
const BASE_ROUNDS = [
  [[0, 3], [1, 2]],
  [[0, 2], [3, 1]],
  [[0, 1], [2, 3]],
]

export function generateFixtures(clubIds) {
  if (clubIds.length !== 4) throw new Error(`4구단 리그 전용: ${clubIds.length}구단 입력`)
  const fixtures = []
  for (let rep = 0; rep < 4; rep++) {
    const flip = rep % 2 === 1
    BASE_ROUNDS.forEach((pairings, i) => {
      const round = rep * 3 + i + 1
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
