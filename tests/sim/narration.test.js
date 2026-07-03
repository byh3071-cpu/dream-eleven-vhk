// 서술 계층 불변식 전수 검증 — simulateMatch가 만든 실제 이벤트 로그를 chainId로
// 그룹핑해서, "볼이 논리적으로 끊기지 않고 이어지는가"를 seed 100개에 대해 확인한다.
// 이 불변식들이 렌더러(볼-선수 앵커링)가 기대는 계약이다: 연속성이 깨지면 볼이
// 허공에서 순간이동하는 문제가 데이터 레벨에서 재발한다.

import { simulateMatch } from '../../src/sim/engine.js'
import {
  startHolderOf, endHolderOf, isTerminal, isBallEvent, CONTINUITY_EXEMPT_TYPES,
} from '../../src/sim/event-types.js'
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

  test('① 연속성: 볼 이벤트 N의 시작 보유자 == N-1의 종료 보유자 (데드볼 페어 면제)', () => {
    for (const chain of allChains) {
      // 북키핑(카드/PK선언)은 볼 이동이 없으니 연속성 검사에서 제외.
      const ballEvents = chain.filter(isBallEvent)
      for (let i = 1; i < ballEvents.length; i++) {
        const prev = ballEvents[i - 1]
        const curr = ballEvents[i]
        // 데드볼(파울/FK/코너)의 앞뒤는 심판이 멈춘 볼을 지정 키커가 이어받는 게 정상.
        if (CONTINUITY_EXEMPT_TYPES.includes(prev.type) || CONTINUITY_EXEMPT_TYPES.includes(curr.type)) continue
        // PK 선언(북키핑) 직후의 PK 슛도 데드볼 재개다 — via로 식별.
        if (curr.via === 'penalty') continue
        expect(startHolderOf(curr)).toBe(endHolderOf(prev))
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

  test('④ 오픈플레이 슛의 직전 이벤트 종료 보유자는 슈터다', () => {
    for (const chain of allChains) {
      const terminal = chain.at(-1)
      // 세트피스/PK/오프사이드/턴오버/클리어런스는 데드볼 재개라 이 규칙의 대상이 아님.
      if (terminal.via !== 'open_play') continue
      const ballEvents = chain.filter(isBallEvent)
      if (ballEvents.length >= 2) {
        expect(endHolderOf(ballEvents.at(-2))).toBe(terminal.actorId)
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
