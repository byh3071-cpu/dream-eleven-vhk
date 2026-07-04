// 서클 메서드 라운드로빈 일반화 검증(Epic 1-2a) — 임의 짝수 팀.
// 4구단 회귀는 career.test.js가 이미 잠금(12라운드/24경기, byte-identical). 여기선 8구단
// 확장과 불변식(모든 상대 균등·홈원정 균형·짝수 가드)을 검증한다.

import { generateFixtures, fixturesOfRound, totalRounds } from '../../src/career/schedule.js'

const ids8 = Array.from({ length: 8 }, (_, i) => `c${i}`)

describe('generateFixtures 임의 팀 수', () => {
  test('8구단 rounds=2 → 14라운드·56경기(팀당 14)', () => {
    const fixtures = generateFixtures(ids8, { rounds: 2 })
    expect(totalRounds(fixtures)).toBe(14)
    expect(fixtures).toHaveLength(56)
    for (const id of ids8) {
      const mine = fixtures.filter((f) => f.homeClubId === id || f.awayClubId === id)
      expect(mine).toHaveLength(14)
    }
  })

  test('8구단 rounds=2 → 각 대진 홈1·원정1(더블 라운드로빈)', () => {
    const fixtures = generateFixtures(ids8, { rounds: 2 })
    for (let i = 0; i < ids8.length; i++) {
      for (let j = i + 1; j < ids8.length; j++) {
        const a = ids8[i]; const b = ids8[j]
        const ab = fixtures.filter((f) => f.homeClubId === a && f.awayClubId === b)
        const ba = fixtures.filter((f) => f.homeClubId === b && f.awayClubId === a)
        expect(ab).toHaveLength(1)
        expect(ba).toHaveLength(1)
      }
    }
  })

  test('라운드마다 정확히 N/2 경기(전원 출전, 겹침 없음)', () => {
    const fixtures = generateFixtures(ids8, { rounds: 2 })
    for (let r = 1; r <= 14; r++) {
      const round = fixturesOfRound(fixtures, r)
      expect(round).toHaveLength(4)
      const clubs = round.flatMap((f) => [f.homeClubId, f.awayClubId])
      expect(new Set(clubs).size).toBe(8) // 전원 정확히 1경기
    }
  })

  test('결정론 — 같은 입력 같은 출력', () => {
    expect(generateFixtures(ids8, { rounds: 2 })).toEqual(generateFixtures(ids8, { rounds: 2 }))
  })

  test('홀수/1팀은 거부(짝수 2팀 이상)', () => {
    expect(() => generateFixtures(['a', 'b', 'c'])).toThrow()
    expect(() => generateFixtures(['a'])).toThrow()
  })
})
