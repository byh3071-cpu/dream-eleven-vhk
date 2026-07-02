---
vhk_format: 1
type: goal
id: 5
title: UI 화면 통합 + 다크골드 테마
status: NOT_STARTED
priority: P0
---

# Goal 5: UI 화면 통합 + 다크골드 테마

## 배경
지금까지 만든 엔진+렌더러를 실제로 플레이 가능한 하나의 게임으로 묶는다. 사용자가 제공한 FC 온라인류 스쿼드메이커 레퍼런스를 스쿼드빌더 화면 기준으로 삼되, 이 게임에 없는 시스템(가챠/케미스트리/알림)은 제외한다.

## 동작
- `src/ui/screens/squadBuilder.js` (홈/원정 공용, `side` 파라미터) — 포메이션 칩, 세로형 필드에 11슬롯, 선수 카드(레이팅+포지션+이름+이니셜뱃지), 팀 종합전력 대조, 리스트뷰(검색+포지션 필터)
- `src/ui/screens/tacticsPanel.js` — 멘탈리티(`[총공격][공격적][균형][수비적][침대축구]` 칩)/압박/템포/폭
- `src/ui/screens/matchViewer.js` — Goal 4 렌더러 + 스코어보드 + 커멘터리 통합
- `src/ui/screens/resultScreen.js` — 스코어/팀스탯/이벤트 타임라인/재대결·수정·새경기
- `src/state/persistence.js` — localStorage 스쿼드 저장/불러오기
- `css/theme.css` — 다크(#0b0e14) + 골드(#f0b429) CSS 변수, Pretendard 폰트
- `assets/icons/` — game-icons.net에서 선별 다운로드 + `CREDITS.md`

## Completion Check
- 브라우저에서 양 팀 실제 구성(레전드+현역) → 포메이션/지침 설정 → 킥오프 → 관전 → 결과 화면까지 수동 E2E 1회 완주
- 레퍼런스 이미지 톤(다크+골드)과 비교해서 확인
