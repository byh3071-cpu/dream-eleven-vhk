---
vhk_format: 1
type: goal
id: 1
title: 선수 스키마 + 픽스처 데이터 + 포메이션
status: NOT_STARTED
priority: P0
---

# Goal 1: 선수 스키마 + 픽스처 데이터 + 포메이션

## 배경
엔진 검증(Goal 2)에 필요한 최소 데이터셋. 콘텐츠 확장(Goal 6)과 분리해서 먼저 스키마와 소량 픽스처만 확정한다.

## 동작
- `src/data/player-schema.js` — 12포지션(GK/CB/LB/RB/DM/CM/AM/LM/RM/LW/RW/ST), 6각 스탯(pace/shooting/passing/dribbling/defending/physical), traits[]
- `src/data/players.db.js` — 16~20명 픽스처 (레전드+현역 혼합, 전 포지션 최소 커버). "호날두"는 `ronaldo_cr7`/`ronaldo_r9`로 id 분리
- `src/data/formations.js` — 프리셋 5~7종(4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2 등), 11슬롯 `{role,x,y}` 정규화 좌표
- `src/sim/teamStrength.js` — `computeTeamRatings(squad11, formation, tactics)`, positionFit 가중

## Completion Check
- `npm test`로 두 팀 전력 비교 테스트 통과
- `tests/data/players.validate.test.js` — 스키마 검증(포지션 값 유효성, 스탯 범위 1~99 등)
