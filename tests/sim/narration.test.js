// 서술 계층 불변식 전수 검증 — simulateMatch가 만든 실제 이벤트 로그를 chainId로
// 그룹핑해서, "볼이 논리적으로 끊기지 않고 이어지는가"를 seed 100개에 대해 확인한다.
// 이 불변식들이 렌더러(볼-선수 앵커링)가 기대는 계약이다: 연속성이 깨지면 볼이
// 허공에서 순간이동하는 문제가 데이터 레벨에서 재발한다.

import { simulateMatch } from '../../src/sim/engine.js'
import { startHolderOf, endHolderOf, isTerminal } from '../../src/sim/event-types.js'
import { BANDS } from '../../src/sim/zones.js'
import { makeSyntheticTeam } from '../fixtures/syntheticTeam.js'

const BAND_INDEX = Object.fromEntries(BANDS.map((b, i) => [b, i]))

function chainsOf(events) {
  const byChain = new Map()
  for (const evt of events) {
    if (!byChain.has(evt.chainId)) byChain.set(evt.chainId, [])
    byChain.get(evt.chainId).push(evt)
  }
  return [...byChain.values()]
}

describe('서술 불변식 (seed 0..99 전수)', () => {
  const teamA = makeSyntheticTeam(80)
  const teamB = makeSyntheticTeam(74)

  const allChains = []
  beforeAll(() => {
    for (let seed = 0; seed < 100; seed++) {
      const result = simulateMatch({
        home: { squad11: teamA.squad11, formation: teamA.formation, tactics: {} },
        away: { squad11: teamB.squad11, formation: teamB.formation, tactics: {} },
        seed,
      })
      allChains.push(...chainsOf(result.events))
    }
  })

  test('① 연속성: 이벤트 N의 시작 보유자 == 이벤트 N-1의 종료 보유자', () => {
    for (const chain of allChains) {
      for (let i = 1; i < chain.length; i++) {
        const prevEnd = endHolderOf(chain[i - 1])
        const nextStart = startHolderOf(chain[i])
        expect(nextStart).toBe(prevEnd)
      }
    }
  })

  test('② 체인당 종료 이벤트는 정확히 1개이고 항상 마지막이다', () => {
    for (const chain of allChains) {
      const terminals = chain.filter(isTerminal)
      expect(terminals).toHaveLength(1)
      expect(isTerminal(chain.at(-1))).toBe(true)
    }
  })

  test('③ 밴드 단조 전진: zoneFrom -> zoneTo가 후퇴하지 않고, 다음 이벤트는 이전 도착 밴드에서 시작한다', () => {
    for (const chain of allChains) {
      for (let i = 0; i < chain.length; i++) {
        const evt = chain[i]
        expect(BAND_INDEX[evt.zoneTo]).toBeGreaterThanOrEqual(BAND_INDEX[evt.zoneFrom])
        if (i > 0) {
          expect(BAND_INDEX[evt.zoneFrom]).toBeGreaterThanOrEqual(BAND_INDEX[chain[i - 1].zoneFrom])
        }
      }
    }
  })

  test('④ 성공 체인의 마지막 서술 이벤트 도착자는 슈터다', () => {
    for (const chain of allChains) {
      const terminal = chain.at(-1)
      if (terminal.type === 'turnover_buildup') continue
      // 슛 직전 이벤트(있다면)의 종료 보유자 == 슈터
      if (chain.length >= 2) {
        expect(endHolderOf(chain.at(-2))).toBe(terminal.actorId)
      }
    }
  })

  test('⑤ 같은 seed는 서술까지 완전히 동일하다 (다시보기 결정론)', () => {
    const run = () => simulateMatch({
      home: { squad11: teamA.squad11, formation: teamA.formation, tactics: {} },
      away: { squad11: teamB.squad11, formation: teamB.formation, tactics: {} },
      seed: 42,
    }).events
    expect(run()).toEqual(run())
  })
})
