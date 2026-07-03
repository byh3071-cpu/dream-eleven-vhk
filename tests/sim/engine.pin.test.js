// 아웃컴 핀 테스트 — N1(볼-선수 앵커링) 리팩터링의 안전망.
//
// N1은 resolveChain을 "아웃컴(판정) / 서술(이벤트 생성)" 2계층으로 쪼개는데, 그 계약은
// "서술 계층은 chainRng를 단 한 번도 건드리지 않는다"이다. 이 테스트는 그 계약을
// 실행 가능하게 만든다: 리팩터 전 실측한 score/stats를 리터럴로 고정하고, 같은 seed에서
// 한 자리라도 달라지면 서술이 아웃컴 RNG를 오염시켰다는 뜻이다.
//
// 판정 구조를 또 바꾸는 단계(예: 커리어 피로 네이티브 입력)에서 다시 재기록한다.
//
// 리터럴 출처: 2026-07-03, N2 튜닝 확정(tune-v2.mjs 스윕) 직후 실측 — N2가 chainRng에
// 새 판정 draw(파울/카드/분기/세트피스)를 합법적으로 추가해 N1 리터럴에서 재기록했다.
// 이 시점부터는 "튜닝 상수/판정 구조 무변경" 리팩터의 안전망으로 동작한다.

import { simulateMatch } from '../../src/sim/engine.js'
import { makeSyntheticTeam } from '../fixtures/syntheticTeam.js'

const PINNED = [
  { ra: 75, rb: 75, seed: 11, score: {"home":1,"away":2}, stats: {"A":{"shots":7,"shotsOnTarget":7,"goals":1,"possessions":12,"fouls":11,"yellows":1,"reds":0,"corners":3,"offsides":0},"B":{"shots":10,"shotsOnTarget":6,"goals":2,"possessions":16,"fouls":11,"yellows":2,"reds":0,"corners":3,"offsides":1}} },
  { ra: 75, rb: 75, seed: 22, score: {"home":1,"away":3}, stats: {"A":{"shots":9,"shotsOnTarget":7,"goals":1,"possessions":13,"fouls":15,"yellows":1,"reds":0,"corners":3,"offsides":0},"B":{"shots":8,"shotsOnTarget":7,"goals":3,"possessions":18,"fouls":12,"yellows":1,"reds":0,"corners":3,"offsides":0}} },
  { ra: 75, rb: 75, seed: 33, score: {"home":0,"away":2}, stats: {"A":{"shots":9,"shotsOnTarget":4,"goals":0,"possessions":17,"fouls":7,"yellows":1,"reds":0,"corners":2,"offsides":0},"B":{"shots":8,"shotsOnTarget":6,"goals":2,"possessions":12,"fouls":9,"yellows":2,"reds":0,"corners":0,"offsides":1}} },
  { ra: 75, rb: 75, seed: 44, score: {"home":4,"away":1}, stats: {"A":{"shots":10,"shotsOnTarget":7,"goals":4,"possessions":16,"fouls":8,"yellows":0,"reds":0,"corners":4,"offsides":2},"B":{"shots":8,"shotsOnTarget":8,"goals":1,"possessions":15,"fouls":6,"yellows":1,"reds":0,"corners":5,"offsides":1}} },
  { ra: 75, rb: 75, seed: 55, score: {"home":1,"away":2}, stats: {"A":{"shots":4,"shotsOnTarget":2,"goals":1,"possessions":15,"fouls":7,"yellows":1,"reds":0,"corners":3,"offsides":1},"B":{"shots":9,"shotsOnTarget":5,"goals":2,"possessions":11,"fouls":9,"yellows":1,"reds":0,"corners":1,"offsides":0}} },
  { ra: 90, rb: 65, seed: 11, score: {"home":2,"away":1}, stats: {"A":{"shots":5,"shotsOnTarget":5,"goals":2,"possessions":12,"fouls":12,"yellows":2,"reds":0,"corners":3,"offsides":1},"B":{"shots":6,"shotsOnTarget":2,"goals":1,"possessions":16,"fouls":9,"yellows":1,"reds":0,"corners":4,"offsides":0}} },
  { ra: 90, rb: 65, seed: 22, score: {"home":2,"away":2}, stats: {"A":{"shots":11,"shotsOnTarget":10,"goals":2,"possessions":16,"fouls":13,"yellows":1,"reds":0,"corners":4,"offsides":0},"B":{"shots":5,"shotsOnTarget":4,"goals":2,"possessions":15,"fouls":13,"yellows":1,"reds":0,"corners":4,"offsides":0}} },
  { ra: 90, rb: 65, seed: 33, score: {"home":0,"away":2}, stats: {"A":{"shots":10,"shotsOnTarget":5,"goals":0,"possessions":19,"fouls":6,"yellows":1,"reds":0,"corners":2,"offsides":1},"B":{"shots":7,"shotsOnTarget":5,"goals":2,"possessions":10,"fouls":10,"yellows":2,"reds":0,"corners":0,"offsides":0}} },
  { ra: 90, rb: 65, seed: 44, score: {"home":3,"away":0}, stats: {"A":{"shots":12,"shotsOnTarget":8,"goals":3,"possessions":17,"fouls":9,"yellows":0,"reds":0,"corners":3,"offsides":2},"B":{"shots":4,"shotsOnTarget":4,"goals":0,"possessions":14,"fouls":6,"yellows":1,"reds":0,"corners":5,"offsides":1}} },
  { ra: 90, rb: 65, seed: 55, score: {"home":3,"away":0}, stats: {"A":{"shots":5,"shotsOnTarget":3,"goals":3,"possessions":16,"fouls":12,"yellows":2,"reds":0,"corners":3,"offsides":2},"B":{"shots":5,"shotsOnTarget":2,"goals":0,"possessions":10,"fouls":12,"yellows":3,"reds":0,"corners":0,"offsides":0}} },
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
