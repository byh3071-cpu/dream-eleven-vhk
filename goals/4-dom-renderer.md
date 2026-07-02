---
vhk_format: 1
type: goal
id: 4
title: DOM 렌더러 (pitchRenderer.dom.js)
status: NOT_STARTED
priority: P0
---

# Goal 4: DOM 렌더러

## 배경
"숫자 계산 결과만이 아니라 2D 필드 위에서 선수가 움직이는 모습"이 핵심 요구사항. v1은 신규 의존성 0개인 DOM+CSS로 시작(어드바이저 권고: 얇은 재미 슬라이스 우선, 검증 전 캔버스에 시간 쓰지 않음).

## 동작
- `src/ui/pitchRenderer.dom.js` — `initPitch()`/`renderEvent(evt)` 고정 인터페이스로 Goal 2의 이벤트 로그를 소비
- 필드: 인라인 SVG(라인·센터서클), 선수/공: 절대위치 div
- 이벤트 관여 토큰(2~6개)만 `style.left/top` % 변경 → `transition: left .9s ease`로 트윈
- `src/ui/commentaryLog.js` — 이벤트 로그 → 한국어 텍스트 중계 템플릿
- 재생/일시정지/배속(1x/2x/4x)/스킵 컨트롤

## Completion Check
- 4-3-3 등 포메이션이 화면에 정확히 재현됨
- 고정 테스트 매치 재생 시 끊김 없이 완주, 재생 컨트롤 전부 동작
