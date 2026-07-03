// 경기 평점/MOTM — 서열 정합(골>무기여, 퇴장<베이스) + 클램프 + 결정론.

import { ratePlayers, motmOf } from '../../src/sim/playerRatings.js'

const squadOf = (ids) => ids.map((id) => ({ player: { id }, slotIndex: 0 }))

const baseArgs = {
  homeSquad11: squadOf(['h1', 'h2', 'h3']),
  awaySquad11: squadOf(['a1', 'a2']),
  score: { home: 1, away: 0 },
  events: [
    { type: 'goal', team: 'A', actorId: 'h1', assistId: 'h2' },
    { type: 'yellow_card', team: 'B', actorId: 'a1' },
    { type: 'red_card', team: 'B', actorId: 'a2' },
  ],
}

describe('playerRatings', () => {
  test('골 > 어시스트 > 무기여 > 카드 순 서열', () => {
    const rated = ratePlayers(baseArgs)
    const of = (id) => rated.find((r) => r.playerId === id).value
    expect(of('h1')).toBeGreaterThan(of('h2'))
    expect(of('h2')).toBeGreaterThan(of('h3'))
    expect(of('h3')).toBeGreaterThan(of('a1'))
    expect(of('a1')).toBeGreaterThan(of('a2'))
  })

  test('승리 보너스가 패배팀 무기여자보다 승리팀 무기여자를 높인다', () => {
    const rated = ratePlayers({ ...baseArgs, events: [] })
    const of = (id) => rated.find((r) => r.playerId === id).value
    expect(of('h3')).toBeGreaterThan(of('a1'))
  })

  test('클램프 5~10 + 소수 1자리', () => {
    const spam = Array.from({ length: 20 }, () => ({ type: 'goal', team: 'A', actorId: 'h1' }))
    const rated = ratePlayers({ ...baseArgs, events: spam })
    const top = rated.find((r) => r.playerId === 'h1')
    expect(top.value).toBe(10)
    for (const r of rated) expect(Math.round(r.value * 10) / 10).toBe(r.value)
  })

  test('MOTM은 최고 평점(동률이면 득점자 우선), 결정론', () => {
    expect(motmOf(baseArgs).playerId).toBe('h1')
    expect(motmOf(baseArgs)).toEqual(motmOf(baseArgs))
  })
})
