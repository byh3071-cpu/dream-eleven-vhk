---
vhk_format: 1
type: goal
id: 11
title: 매치엔진 v2 — 볼-선수 앵커링 (v2 N1)
status: DONE
priority: P0
---

# Goal 11: 매치엔진 v2 — 볼-선수 앵커링 (v2 N1)

## 배경
사용자 핵심 불만: "공이 선수들한테 가는 게 아니라 허공에서 돌아다닌다."
볼이 추상 그리드 좌표 사이를 이동하고 어떤 선수도 볼 위치에 실제로 없던 문제를
엔진(서술 계층)과 렌더러(호밍 비행) 양쪽에서 구조적으로 제거한다.

## 동작
- 아웃컴/서술 2계층: `resolveChain = narrateChain(resolveChainOutcome(chainRng), narrationRng)`.
  판정 draw 비트 보존은 핀 테스트(engine.pin.test.js)가 강제.
- `src/sim/event-types.js`: pass/carry/turnover(+victimId,cause)/슛(+via) 스키마 단일 소스,
  chainId, startHolderOf/endHolderOf/possessionTeamOf 헬퍼.
- 서술 불변식 5종(연속성/종료1개/밴드 단조/슈터 도착/결정론)을 seed 0..99 전수 검증.
- `src/ui/ballFlight.js`: 볼 상태기계(held/flight 호밍/flightToPoint/rest) — 허공 상태가
  타입 수준에서 부재. 호밍은 매 프레임 수신자 실측 토큰 위치로 재보간(도착 보장).
- match.js: refsById 토큰 해석, 이벤트 주역 강풀(computeOverrideTarget), 타입별 페이싱,
  CSS transition 제거(rAF 직접 구동), dataset(mode/holderId/toId/playerId) 노출.
- `scripts/verify-anti-float.mjs` 상설 게이트.

## Completion Check
- `npm test` 통과 (핀/서술 불변식/ballFlight 포함, 몬테카를로 무수정 통과)
- `node scripts/verify-anti-float.mjs` 통과 (첫 실측: 샘플 193, held 위반 0, 에러 0)
- 수동 관전에서 "볼이 선수에게 가는가" 체감 확인 (재생 영상 아티팩트로 사용자 공유)
