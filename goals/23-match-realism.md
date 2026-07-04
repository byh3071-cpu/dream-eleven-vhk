---
vhk_format: 1
type: goal
id: 23
title: 매치 리얼리즘 & 3D 모션 대개편 (v3 goal 23)
status: IN_PROGRESS
priority: P1
---

# Goal 23: 매치 리얼리즘 & 3D 모션 대개편 (v3)

사용자 실플레이 피드백 다발. 3단계 순차.

## 1단계 (DONE) — 버그 + 튜닝
- **셀레머니 손 고착 수정**: three.js reset()이 celebrateT=0만 하고 팔 rotation 미복원 →
  루프 정지 시(일시정지/종료/리플레이 재점화) 만세 고착. 3중 방어: reset에 팔·다리
  rotation.x=0 복원, celebrateT<0.05 스냅+팔 복원, 리플레이(visualOnly) celebration 재점화
  차단(matchPlayback goal 블록을 !visualOnly 게이트).
- **관중 파묻힘 수정**: 연속 램프가 이산 계단 박스 속으로 파고들던 것 → 3단 계단 각
  윗면(y=3.9/6.3/8.7) 위에 앉히고 박스 0.9→1.1. 야간 스탠드에 관중 점묘 가시.
- **속도**: [1,2,4]→[0.5,1,2,4] + DELAY_MS ~1.25배 상향(숏패스 260→340)으로 x1 완화.
- **주야 명확화**: 주간 밝은 하늘 토큰(--pitch3d-day-sky) — 주간 bg near-black→#6ea8dc,
  야간 조명탑 SpotLight 실광원 + sun 대비(0.7→0.35). applyLighting 토글 즉시 렌더(idle 대응).

## 2단계 (DONE) — 슛 리얼리즘
- **"GK 앞 순간이동" 근본 원인 = 골키퍼 완전 수동**: dive/save fx 신설(three.js — GK가
  볼 채널로 몸 눕히며 다이빙 rotation.z+측면 hop+팔 뻗기, 2D는 lunge 재사용). 슛류 시 GK를
  pullOverride에 넣어 반응 이동(제자리 정지 해소). matchPlayback이 shot_saved/goal 시 gkId 발사.
- **슛 접근 비트**: narrateChain 마무리 직전 shooter carry(style:'approach') 55% 삽입 —
  "받자마자 골" 인상 제거. 불변식(연속성/슛직전=슈터) 유지.
- **finishType(placed/power/long_range/curl/volley)**: possession narrateChain이 narrationRng로
  부여(중거리는 슈터가 박스 대신 밴드3에서 슛 — 볼 시작점 뒤로, 밴드 단조 유지). commentary
  FINISH_LABEL, matchPlayback 비행 분기(중거리 1.4배·감아차기는 ballFlight flightCurl 베지어
  곡선 신설). E2E로 4종 라벨 전부 출현 확인.
- **게이트 무영향 증명**: buildStats가 type 기반 집계라 carry/finishType 무집계 — 핀/몬테
  카를로/리얼리즘/narration 299+20개 전부 무수정 통과(서술 계층 안전성 코드 증명).
## 3단계 (예정) — 3D 모션 디테일(패스/드리블/태클/리액션) + 압박 2인·침투 동선

## Completion Check (1단계)
- npm test 299, anti-float 2D/3D 재통과, E2E(0.5x 버튼/주야간 배경 대비/관중 가시)
