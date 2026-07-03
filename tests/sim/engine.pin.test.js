// 아웃컴 핀 테스트 — N1(볼-선수 앵커링) 리팩터링의 안전망.
//
// N1은 resolveChain을 "아웃컴(판정) / 서술(이벤트 생성)" 2계층으로 쪼개는데, 그 계약은
// "서술 계층은 chainRng를 단 한 번도 건드리지 않는다"이다. 이 테스트는 그 계약을
// 실행 가능하게 만든다: 리팩터 전 실측한 score/stats를 리터럴로 고정하고, 같은 seed에서
// 한 자리라도 달라지면 서술이 아웃컴 RNG를 오염시켰다는 뜻이다.
//
// N2(파울/카드/세트피스)는 chainRng에 새 draw를 합법적으로 추가하므로 이 리터럴은
// 그때 재기록한다(몬테카를로 "범위" 게이트가 그 시점의 계약).
//
// 리터럴 출처: 2026-07-03, N1 착수 직전 커밋에서 실측 (스크립트로 추출).

import { simulateMatch } from '../../src/sim/engine.js'
import { makeSyntheticTeam } from '../fixtures/syntheticTeam.js'

const PINNED = [
  { ra: 75, rb: 75, seed: 11, score: { home: 1, away: 1 }, stats: { A: { shots: 5, shotsOnTarget: 3, goals: 1, possessions: 12 }, B: { shots: 6, shotsOnTarget: 5, goals: 1, possessions: 16 } } },
  { ra: 75, rb: 75, seed: 22, score: { home: 1, away: 2 }, stats: { A: { shots: 8, shotsOnTarget: 4, goals: 1, possessions: 13 }, B: { shots: 10, shotsOnTarget: 6, goals: 2, possessions: 18 } } },
  { ra: 75, rb: 75, seed: 33, score: { home: 3, away: 0 }, stats: { A: { shots: 8, shotsOnTarget: 6, goals: 3, possessions: 17 }, B: { shots: 3, shotsOnTarget: 3, goals: 0, possessions: 12 } } },
  { ra: 75, rb: 75, seed: 44, score: { home: 0, away: 0 }, stats: { A: { shots: 9, shotsOnTarget: 3, goals: 0, possessions: 16 }, B: { shots: 9, shotsOnTarget: 5, goals: 0, possessions: 15 } } },
  { ra: 75, rb: 75, seed: 55, score: { home: 0, away: 2 }, stats: { A: { shots: 8, shotsOnTarget: 8, goals: 0, possessions: 15 }, B: { shots: 7, shotsOnTarget: 6, goals: 2, possessions: 11 } } },
  { ra: 90, rb: 65, seed: 11, score: { home: 2, away: 0 }, stats: { A: { shots: 9, shotsOnTarget: 9, goals: 2, possessions: 12 }, B: { shots: 2, shotsOnTarget: 1, goals: 0, possessions: 16 } } },
  { ra: 90, rb: 65, seed: 22, score: { home: 4, away: 0 }, stats: { A: { shots: 11, shotsOnTarget: 9, goals: 4, possessions: 16 }, B: { shots: 3, shotsOnTarget: 2, goals: 0, possessions: 15 } } },
  { ra: 90, rb: 65, seed: 33, score: { home: 3, away: 0 }, stats: { A: { shots: 8, shotsOnTarget: 6, goals: 3, possessions: 19 }, B: { shots: 3, shotsOnTarget: 3, goals: 0, possessions: 10 } } },
  { ra: 90, rb: 65, seed: 44, score: { home: 2, away: 0 }, stats: { A: { shots: 8, shotsOnTarget: 5, goals: 2, possessions: 17 }, B: { shots: 6, shotsOnTarget: 3, goals: 0, possessions: 14 } } },
  { ra: 90, rb: 65, seed: 55, score: { home: 2, away: 0 }, stats: { A: { shots: 11, shotsOnTarget: 10, goals: 2, possessions: 16 }, B: { shots: 2, shotsOnTarget: 2, goals: 0, possessions: 10 } } },
]

describe('아웃컴 핀 — 서술 리팩터가 판정 RNG를 오염시키지 않는다', () => {
  test.each(PINNED.map((c) => [`${c.ra}v${c.rb} seed=${c.seed}`, c]))(
    '%s 의 score/stats가 리팩터 전 실측과 동일',
    (_label, pinned) => {
      const teamA = makeSyntheticTeam(pinned.ra)
      const teamB = makeSyntheticTeam(pinned.rb)
      const result = simulateMatch({
        home: { squad11: teamA.squad11, formation: teamA.formation, tactics: {} },
        away: { squad11: teamB.squad11, formation: teamB.formation, tactics: {} },
        seed: pinned.seed,
      })
      expect(result.score).toEqual(pinned.score)
      expect(result.stats).toEqual(pinned.stats)
    },
  )
})
