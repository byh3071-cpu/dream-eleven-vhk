---
vhk_format: 1
type: goal
id: 6
title: 선수 데이터 확장 (16~20명 → 60~100명)
status: NOT_STARTED
priority: P1
---

# Goal 6: 선수 데이터 확장

## 배경
엔진 검증(Goal 2)과 콘텐츠 제작 리스크를 분리했던 것의 2단계. 스키마 변경 없는 순수 데이터 입력 작업.

## 동작
- `src/data/players.db.js`에 60~100명으로 확장. 포지션당 최소 4~6명(자주 쓰는 CB/CM/ST/W는 8~10명, 드문 DM/LM·RM은 4~5명)

## Completion Check
- 코드 변경 없이 데이터만 추가됐음을 diff로 확인
- `tests/data/players.validate.test.js` 그대로 통과
