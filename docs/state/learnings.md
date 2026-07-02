# Learnings

_Append-only. 한 줄 = 한 교훈._

- traits.js 훅을 hand-written ctx로만 단위 테스트하면 훅이 실제 파이프라인이 보내는 ctx 키와
  어긋나도(dribbler가 'creation' vs 실제 'progression') 안 걸린다 — 훅 테스트는 최소 1개는
  실제 호출 경로(resolveChain)가 만드는 ctx로도 검증해야 한다.
- CREATE_DIVISOR=250처럼 몬테카를로 게이트 통과를 위해 완만하게 잡은 divisor는 duel 스코어에
  거는 곱연산 트레이드오프(전술 배율 등)의 체감 효과도 같이 죽인다 — ±20% 배율 스팬은
  승률에 거의 안 잡혔고 ±80%은 돼야 눈에 띄는 회귀 테스트 마진이 나왔다(engine.tactics.test.js).
