---
vhk_format: 1
type: goal
id: 9
title: 디자인 시스템 기반 공사 (v2 N0a)
status: DONE
priority: P0
---

# Goal 9: 디자인 시스템 기반 공사 (v2 N0a)

## 배경
v2에서 커리어 모드 화면 7장+가 추가되기 전에 토큰/컴포넌트 체계를 선행한다.
기능 우선으로 화면을 쌓다가 디자인이 붕괴해 개발을 전면 중단하게 된 실사례
(KBO GM 시뮬레이터 개발기 — 사용자 직접 공유)가 근거. 규칙 전문: docs/DESIGN.md.

## 동작
- `css/tokens.css` — :root 선언 전용 단일 소스 (색/간격/타입/radius/그림자/인터랙션/모션/z-index/보더)
- `css/components.css` — 공용 컴포넌트 소유권 통합, verify-cards 확정값 잠금 구간(allowlist 마커)
- `#/styleguide` — tokens.css 런타임 파싱(tokensParser.js) + 실제 컴포넌트 함수 호출 지그
- `tests/design/designLint.test.js` — raw 색/토큰 구조 기계 강제 (npm test 편승)
- `scripts/export-tokens.mjs` — Figma Tokens JSON (파서 공유)
- 부수: players.db.js 아스날→아스널 표기 통일

## Completion Check
- `npm test` 통과 (designLint 포함)
- `/styleguide`에서 전 토큰 그룹 + 컴포넌트 상태 매트릭스 렌더 확인
- 기존 화면 CSS의 raw 색 0개, raw rem 0개 (잠금 구간 제외)
- 기존 E2E 플로우(스쿼드→전술→매치→결과) 시각 회귀 없음 (스냅 리스트 ±1.6px 제외)
