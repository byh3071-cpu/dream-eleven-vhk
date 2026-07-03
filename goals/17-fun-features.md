---
vhk_format: 1
type: goal
id: 17
title: 재미 요소 A/B/C — 시즌 어워드/골 리플레이/서사 칩
status: DONE
priority: P1
---

# Goal 17: 재미 요소 A/B/C

## 동작
- **A. 시즌 어워드**: finishRound가 경기 시뮬 직후(전체 events를 쥔 유일한 시점 —
  저장 result엔 scorers만 남음) ratePlayers/motmOf를 돌려 save.seasonStats에 적립.
  awards.js(순수): MVP(평균 평점 최고, 최소 6경기), 베스트 XI(4-4-2 라인별 상위),
  득점왕(topScorers 재사용). 시즌 종료 홈에 결산 카드, enterTransferWindow가 history에
  mvp 박제 후 seasonStats 리셋. 세이브 v4(MIGRATIONS[3-1]: seasonStats/boardTrust/
  financeLog — N6 필드 선포함으로 마이그레이션 1회 통합).
- **B. 골 리플레이**: tick이 goal 적용 후 같은 chainId 구간(최대 4이벤트)을
  timeScale 0.4로 visualOnly 재적용(점수/분/커멘터리 불변 — 볼·토큰 연출만).
  REPLAY 플래시, 시작점은 구간 첫 이벤트의 From 좌표. 스킵/다시보기가 리플레이
  상태도 정리. 스킵 종료 시에도 종료 라인 push(검증 중 발견 수정).
- **C. 서사 칩**: narrative.js(순수) — 연승/무패 스트릭, 선수 연속 골(팀당 1명),
  시즌 상대전적, 선두 맞대결. 매치데이 경기 전 카드에 톤별(good/warn/info) 칩.

## Completion Check
- `npm test` 262개 통과(적립 재현성/MOTM 총합=경기 수/MVP 최소출전/베스트XI 형태/
  서사 칩 조건별/v3→v4 마이그레이션)
- E2E: 드래프트→4라운드→5라운드 매치데이 칩 3종 노출→시즌 완주→결산 카드
  (MVP 손흥민 7.95)→이적창 진입 시 history.mvp, 에러 0
- 리플레이 실증(전용 스크립트): 골 경기 강제 확보 → "골!" 직후 "📺 골 리플레이"
  라인 + REPLAY 연출, 스코어 이중집계 없음, anti-float 통과
