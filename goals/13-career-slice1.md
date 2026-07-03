---
vhk_format: 1
type: goal
id: 13
title: 커리어 모드 슬라이스 1 — 드래프트 판타지 리그 (v2 N3)
status: DONE
priority: P0
---

# Goal 13: 커리어 모드 슬라이스 1 — 드래프트 판타지 리그 (v2 N3)

## 배경
듀얼 모드의 두 번째 축. 가상 구단 4개가 레전드 풀을 드래프트로 나눠 갖고
한 시즌(12라운드)을 지휘한다. 사용자 확정: 드래프트 판타지 모델(실존 클럽 아님).

## 동작
- src/career/: clubs(가상 4구단, 색은 tokens.css --club-*), fillerPlayers(GK 4명 —
  id 'filler_' 프리픽스로 db 충돌 회피), players(통합 리졸버 findCareerPlayer),
  schedule(쿼드러플 RR), draft(GK 선배정+라인 밸런스 스네이크), table(파생 순위표),
  playerState(피로/폼/징계 + 댐프닝 — 기술 스탯에도 걸어야 엔진과 결합됨: 실측 교훈),
  aiLineup(positionFit 폴백 — RM 1명 리스크 해소), matchRunner(시드=deriveSeed(master,
  fixtureIndex) — 관전/즉시결과 동일 보장), persistence(스토리지 주입+버전 엔벨로프),
  store(유일하게 정당화되는 스토어).
- UI 3층 분리(두 번째 소비자 등장 시점 원칙): squadEditor(model/view — pool/resolver/
  cardDecorator/isPickDisabled 주입), tacticsControls, matchPlayback(재생 전체 +
  activeTimer/Raf 단일 소유권 이동, resolvePlayer 주입 — 필러 크래시 방지).
- 화면 6종(/career/*): 홈(구단선택/현황/우승배너), 스쿼드(자동 XI+피로·폼·정지 칩),
  전술, 순위표, 일정, 매치데이(관전=playback 위임 / 즉시 결과, 라인업 가드).

## Completion Check
- `npm test` 통과 (career 17케이스 포함: 드래프트 불변식/일정/순위표/징계 소화/
  댐프닝 비장식 증명/세이브 왕복/관전·즉시 동일성/12라운드 완주)
- Playwright E2E: 새 커리어 → 자동 XI → 라운드1 관전 → 징계 재선발(설계 동작) →
  12라운드 완주 → 우승 배너 → **새로고침 후 이어하기** → 24경기 전부 기록, 에러 0
- IF 모드 무회귀: anti-float 게이트 통과(추출된 matchPlayback 경유)
