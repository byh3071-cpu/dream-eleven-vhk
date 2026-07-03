---
vhk_format: 1
type: goal
id: 14
title: 커리어 슬라이스 2 — 인터랙티브 드래프트/시즌 전환/기록 (v2 N4)
status: DONE
priority: P0
---

# Goal 14: 커리어 슬라이스 2 (v2 N4)

## 동작
- 인터랙티브 스네이크 드래프트: draft.js를 픽 단위 프리미티브(createDraftState/applyPick/
  aiPickFor/currentClubOf)로 재구성 — runDraft는 그 위의 루프(기존 불변식 테스트 유지).
  드래프트 상태가 세이브에 저장돼 중단/재개 가능(AI 픽은 pickIndex 파생 시드로 재현).
  AI 픽은 즉시 배치(고아 타이머 금지 원칙 — setTimeout 연출 안 씀).
- 시즌 전환: startNextSeason — 우승/득점왕/내 순위를 history에 적립, 시즌 N+1 드래프트
  재진입(시즌별 셔플 시드 = deriveSeed(master, salt+season)).
- 기록: records.js topScorers(fixtures 파생 — 저장 안 함) + /career/records 화면
  (현 시즌 득점왕 톱10 + 역대 득점왕). 홈에 역대 시즌 히스토리.
- 세이브 스키마 v2: SCHEMA_VERSION 2 + MIGRATIONS[0](v1→v2: phase/draftState/history
  기본값) — N3에서 깔아둔 마이그레이션 체인의 첫 실전, v1 픽스처 테스트로 검증.
- phase 가드: 드래프트 중 시즌 화면 접근 시 드래프트로 리다이렉트.

## Completion Check
- `npm test` 242개 통과 (드래프트 프리미티브/중단 재개 재현성/v1→v2 마이그레이션/
  시즌 전환+히스토리+시즌2 완주 포함)
- E2E: 구단 선택 → 드래프트(내 픽 17회, 중간 새로고침 재개 확인) → 시즌1 완주 →
  득점왕 기록 확인 → 시즌2 드래프트 → 시즌2 라운드1 진입 + 히스토리 표시, 에러 0
