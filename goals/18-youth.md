---
vhk_format: 1
type: goal
id: 18
title: 유스 아카데미 + 파생 에이징 (v2 N7)
status: DONE
priority: P0
---

# Goal 18: 유스/선수 생성기 (v2 N7)

## 설계 핵심
- **세이브-바운드 리졸버**: resolveCareerPlayer(save, id) = ①save.youthPlayers ②DB
  ③필러 + developPlayer 오버레이. 유스는 세이브에 선수 객체가 들어가는 최초이자
  유일한 예외(필러 스키마 계승). 정찰 전수표 기반으로 드래프트 문맥 외 전 소비자 교체.
- **에이징은 저장하지 않는다**: developPlayer가 시즌 번호에서 파생(age=base+season-1,
  성장/쇠퇴는 deriveSeed 결정론, potential은 유스 명시·DB는 id 해시 파생) — 순위표와
  같은 "파생 계산, 드리프트 원천 차단" 원칙. 세이브 v5는 youthPlayers/academyCandidates만.
- age 소비처가 value.js 한 곳이라 가치/주급/이적/매도목록이 에이징을 자동 반영.

## 동작
- youthGen: 기존 국적 16종(스키마 화이트리스트, assets/flags SVG 1:1) 성/이름 풀,
  15~17세, 포지션 원형 스탯 커브(가중 레이팅 기준), potential +8~25, ★1~5 스카우트
  등급(정확값 은닉). 성장 시즌당 +2~4(첫 실측 +1~2가 밋밋해 상향), 30+ 신체 쇠퇴,
  34+ 기술 쇠퇴. 은퇴는 N8 서사와 묶음(스코프 밖 명시).
- 아카데미: 이적창 개장 시 내 구단 후보 3명(계약 무료 3년, 로스터 상한 가드),
  AI 구단은 최고 potential 1명 자동 영입. 미계약 후보는 개막과 함께 소멸.

## Completion Check
- `npm test` 284개(생성기 결정론·스키마·포지션 커브 / 에이징 캡·쇠퇴·원본 불변 /
  리졸버 3계층 / 아카데미 흐름 / v4→v5 마이그레이션)
- `node scripts/verify-youth-growth.mjs` — 4시즌 자동: 유스 11명, 성장 8명(+3~4),
  **1군 데뷔 3명** = 로드맵 완료 기준 "생성 유스가 성장해 1군 데뷔"
- E2E: 이적창 아카데미(후보 3명·★등급·국기) → "너지 벤체(17세)" 계약 → 시즌2 스쿼드
  검색 존재 → 유스 포함 리그 R1 소화, 에러 0. 기존 게이트(anti-float 2D/3D·finance) 재통과
