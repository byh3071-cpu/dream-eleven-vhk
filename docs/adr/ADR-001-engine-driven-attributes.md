---
id: ADR-001
date: 2026-07-06
status: accepted
tags: [attributes, engine, anti-rewrite]
---

# ADR-001: 능력치 확장은 "엔진 판정과 같은 슬라이스"로만 (engine-driven, additive)

## 맥락 (Context)
선수 능력치 확장(docs/research/player-attributes.md)에서 FM식 ~36개 세분화의 유혹이 있다. 두 실패 모드:
- **장식 스탯** — 엔진(sim)이 안 읽는 능력치를 추가. `traits.js`/`player-schema.js`의 명시 원칙
  "반영 위치 없는 특성/스탯 금지" 위반. 헥사곤·OVR 숫자만 늘고 경기 결과는 안 바뀜.
- **빅뱅 재작성** — 6→36 통째 교체. 결정론 재현성·genVersion·305+ 테스트·마이그레이션을 동시
  붕괴시켜 과거 세계를 소급 파괴(ARCHITECTURE.md 재작성 방지 불변식 위반).

## 결정 (Decision)
능력치(스탯·특성)는 **그것을 실제로 읽는 엔진 판정과 같은 슬라이스(커밋 범위)에서만** 추가한다.
1. **소비 우선** — 스탯을 먼저 깔고 배선을 나중에 하지 않는다. 순서는 "판정 심화 → 그 판정이 읽는 하위스탯".
2. **롤업 불변** — 하위세부가 진실, 표시 6(헥사곤·OVR)은 롤업(FIFA식). 세분화해도 6각형 UI 유지.
3. **과거 세계 불변(목표) — 상황에 맞는 additive-safe 수단으로 달성.** 핵심은 "구 세이브 결과 비트
   동일"이지 특정 수단이 아니다. **optional 서브스탯**(예: aerial)은 엔진 폴백(`aerial ?? physical`)으로
   달성 — 구 선수는 키가 없어 부모 스탯을 읽어 결과 불변, 마이그레이션 불필요. **required 스탯 승격**만
   SCHEMA_VERSION 마이그레이션으로 시드. (⚠️ `genVersion` 동결은 `world/` 경로 전용 — 커리어 세이브는
   SCHEMA_VERSION 마이그레이션 또는 폴백으로 불변을 보장.) 어느 쪽이든 stats에 키를 추가하면
   applyGrowthStep의 side-key rng 스트림이 밀리므로 **새 키는 반드시 마지막에** 둔다(안 그러면 기존
   6스탯 성장 궤적이 바뀌어 과거 세계가 깨진다 — Step 2 실측 교훈).
4. **총량 무목표** — 36 같은 개수를 미리 못 박지 않는다. 엔진이 소비하는 만큼이 상한(현실 수렴 6→10~15).
5. **밸런스 게이트** — 매 슬라이스는 몬테카를로(평균 2.5~3.0골·강팀 60~75%) 재통과 + 구 세이브 왕복.

**첫 적용(같은 방향의 무비용 슬라이스, Step 1):** `composure` 특성을 `resolvePenalty`(setpieces.js)의
`onSetPiece` 훅에 배선(successBonus). 오픈플레이 슛 accuracyMult는 poacher가, progression
scoreMult는 playmaker_vision/dribbler가 이미 점유 → 중복을 피해 **훅이 비어 있던 PK 경로**를 택했다
("소비 우선 · 중복 회피"의 실례). 스탯 스키마·마이그레이션 변경 0.

## 대안 (Alternatives)
- **A. FM식 36 선(先)추가(빅뱅)** — 기각. 재작성 규모(teamStrength 가중·POSITION_CORE_STATS·
  applyGrowthStep·헥사곤·테스트·마이그레이션) + 소비 없으면 장식.
- **B1. 6에서 세부 파생(6이 진실)** — 기각. 세부가 새 정보 0 → 장식.
- **C. 무확장(6 영구)** — 부분 기각. traits로 개성·드라마는 가능하나 연속 실력 해상도 상한(강/약 이산).

## 결과 (Consequences)
- (+) 매 슬라이스가 additive·검증가능·롤백가능. 헥사곤/OVR/마이그레이션 안정.
- (+) "장식 금지"·"재작성 방지" 두 불변식과 정합.
- (+) 업계 표준 스키마(SoFIFA 롤업 구조)와 자연 정렬(향후 데이터 참조 용이).
- (−) 깊이 확장이 점진적 — 한 번에 큰 도약 없음(의도된 마찰).
- (−) 각 슬라이스가 엔진 판정 작업을 요구 — "스탯만 추가하는 값싼 길" 봉쇄(의도).

참고: docs/research/player-attributes.md §6~§8(옵션 트레이드오프·개발 순서), docs/ARCHITECTURE.md(재작성 방지).
