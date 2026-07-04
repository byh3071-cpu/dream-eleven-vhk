---
vhk_format: 1
type: goal
id: 25
title: 리그 확장 + 이적시장 활성화 (Epic 1 세계 기반)
status: IN_PROGRESS
priority: P1
---

# Goal 25: 리그 확장 + 이적시장 활성화 (Epic 1)

완전 공유 세계(다국가 1~4부 가상 리그)의 무대. 정찰 확정: 생성기·재정·국적은 재활용,
generateFixtures 재작성 + CLUBS 리그 계층이 유일한 구조 작업. docs/DESIGN.md "지속 세계
데이터 원칙" 준수(동커밋 가드, 실 세이브 왕복 byte-identical).

## Phase 1-2a (DONE) — generateFixtures 임의 팀 수
schedule.js를 4구단 하드코딩(BASE_ROUNDS+throw)에서 서클 메서드 임의 짝수팀으로 일반화.
rounds 옵션(기본 4=4구단 쿼드러플 12라운드 = 기존 byte-identical 보존, 서클 메서드가
BASE_ROUNDS와 동일 순서 재현 검증). 8구단 rounds=2=14라운드. schedule.test 5종(8구단
56경기·각 대진 홈1원정1·라운드당 전원출전·결정론·홀수거부). 순수 함수라 세이브 무관.

## Phase 1-2b (예정) — CLUBS 리그 계층 + 8구단
CLUBS 상수→세이브 상주 leagues/clubs 엔티티. 드래프트/재정/순위/UI 8구단 확장. 세이브
마이그레이션 v7(기존 4구단 세계 호환) + **실 세이브 왕복 byte-identical 테스트**(genVersion
동결 증거). ⚠️ 커리어 세이브 대공사 — 신중히, 브라우저 UI 검증 포함.

## Phase 1-3 (예정) — 프로시저럴 다국가
generateYouth를 국가프로필→리그→성인로스터 생성으로 일반화(genVersion 가드 동커밋).
1~2개국 검증 → 다국가·다부 확장, 승강제.
