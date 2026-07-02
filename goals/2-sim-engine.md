---
vhk_format: 1
type: goal
id: 2
title: 시뮬레이션 엔진 코어 + 몬테카를로 검증 게이트
status: NOT_STARTED
priority: P0
---

# Goal 2: 시뮬레이션 엔진 코어 + 몬테카를로 검증 게이트

## 배경
프로젝트에서 가장 리스크가 큰 미검증 영역 — "이 시뮬레이션이 재미있는가"(스탯 차이가 결과를 만드는가)를 여기서 숫자로 검증한다. **이 게이트를 통과하기 전엔 렌더러/UI 작업(Goal 4 이후)으로 넘어가지 않는다.**

## 동작
- `src/sim/rng.js` — mulberry32 시드 PRNG
- `src/sim/zones.js` — 존 그리드 (길이 밴드 × 폭 채널)
- `src/sim/duel.js` — Elo 승률식(`1/(1+10^(diff/D))`) 기반 듀얼 판정
- `src/sim/possession.js` — possession 체인/phase 진행
- `src/sim/stamina.js` — 경기 시간 경과 스태미나 감소
- `src/sim/traits.js` — `TRAIT_HOOKS` 테이블 (왼발/오른발, 프리킥 스페셜리스트, 공중볼 강자, 포처, 플레이메이커, 드리블러, 노쇠화, 태클 특화 — 각각 계산식 특정 항에 연결, 장식용 특성 금지)
- `src/sim/engine.js` — `simulateMatch(teamA, teamB, seed)` 엔트리포인트, DOM 의존 0
- `tests/sim/engine.montecarlo.test.js` — 100판+ 자동 대전 하네스

## Completion Check (하드 게이트 — 수치 기준)
- 경기당 평균 득점 2.5~3.0골
- 확실히 강한 팀(스탯 우위) vs 약한 팀 승률 60~75% (95%+ 또는 55%- 면 실패)
- 특정 전술이 상대 무관하게 항상 지배하지 않음
- 수동 E2E 1회: 고정 테스트 스쿼드 2개로 콘솔 로그 경기를 처음부터 끝까지 지켜보고 결과가 말이 되는지 확인
