---
vhk_format: 1
type: goal
id: 10
title: 듀얼 모드 셸 (v2 N0b)
status: DONE
priority: P0
---

# Goal 10: 듀얼 모드 셸 (v2 N0b)

## 배경
v2는 IF 매치(드림매치 단판)와 커리어(감독 모드) 두 모드를 갖는다. 커리어 화면이
쌓이기 전에 라우트 네임스페이스와 홈 정보 구조를 확정한다 — 배포 전(외부 딥링크 0)이
이전 비용의 마지막 최저점.

## 동작
- 기존 라우트 4개를 `/if/*`로 이전 (`/if/squad/:side`, `/if/tactics/:side`, `/if/match`, `/if/result`)
- `src/routes.js` — 경로 빌더 단일 소스 (navigate 호출 12곳 전부 이관, 리터럴 산개 제거)
- 홈(/) = 모드 선택: IF 매치 타일(활성) + 커리어 타일(N3까지 disabled "준비 중")
- `/styleguide`는 모드 네임스페이스 밖 유지

## Completion Check
- `npm test` 통과 (routes 정합 테스트: 빌더↔패턴 매치, 레거시 경로 미매치 포함)
- 자연 플레이스루(버튼 클릭만)로 홈→스쿼드→지침→원정→지침→매치→결과→홈 완주, 전 구간 `#/if/*` URL 확인
- 레거시 경로(`/squad/home` 등)는 404 화면
