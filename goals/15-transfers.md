---
vhk_format: 1
type: goal
id: 15
title: 이적/계약 — 가치 모델/이적창/AI 거래 (v2 N5)
status: DONE
priority: P0
---

# Goal 15: 이적/계약 (v2 N5)

## 설계 결정
- **시즌 전환 = 이적창(재드래프트 폐지)**: 전면 재드래프트는 "사고판" 로스터 연속성을
  부수므로, 시즌 1만 드래프트하고 이후 시즌 사이는 phase 'transfer'가 잇는다.
  (로드맵 goal 14의 "시즌 전환(재드래프트)"를 본 goal에서 대체 — 사용자 승인 하에.)
- **생성 선수 보충은 하드 가드로 대체**: 어떤 이적도 로스터 15명/GK 2명 밑으로 못
  내려가고 상한 23명 — 보충 없이도 리그가 구조적으로 유지된다. 선수 생성기는
  N7(유스)의 것.

## 동작
- value.js: 가치 = (레이팅/60)^4 × 6M × 나이커브(24~28 피크, 노장 감가 바닥 0.35)
  × 계약 할인(만료 0.5 / 1년 0.8). 절대액이 아니라 서열 정합이 목표(테스트 검증).
- transfers.js(순수): canBuy(사유 문장 반환 — 버튼 툴팁), executeBuy/Sell(이적 =
  새 3년 계약), bestSellOffer(그 라인이 얇고 예산 있는 구단이 오퍼), runAiTransfers
  (창당 1~2건 배경 거래, rng 주입 결정론).
- store: enterTransferWindow(히스토리 적립 + 순위 보상 40/30/25/20M + 계약 -1 +
  AI 거래) / buyPlayer / sellPlayer / startSeasonAfterTransfer(일정 재생성, 컨디션
  리셋, 만료 계약 자동 1년 재계약).
- 세이브 v3: MIGRATIONS[1] (v2→v3: budgets 60M/contracts 2년/transferLog 기본값).
- /career/transfer 화면: 예산 헤더, 거래 로그, 영입 리스트(가치순, 계약연차 표시),
  판매 리스트(최고 오퍼), 개막 버튼. phase 가드 확장(transfer 중 시즌 화면 차단).

## Completion Check
- `npm test` 249개 통과 (가치 서열/영입 거절 사유/왕복 불변식(총원 76·총예산 보존)/
  AI 거래 결정론+가드/v2→v3 마이그레이션 포함)
- E2E: 시즌1 완주 → 이적창(우승 보상 포함 100M, AI 거래 로그 1건) → 김민재 영입 +
  앙리 판매(예산 103M) → 새로고침 재개 → 시즌2 개막 → 로스터 반영(영입 있음/판매
  없음) → R1 소화, 에러 0
