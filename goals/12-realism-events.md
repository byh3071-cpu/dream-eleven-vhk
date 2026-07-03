---
vhk_format: 1
type: goal
id: 12
title: 매치엔진 v2 — 리얼리즘 이벤트 + 생동감 (v2 N2)
status: DONE
priority: P0
---

# Goal 12: 매치엔진 v2 — 리얼리즘 이벤트 + 생동감 (v2 N2)

## 배경
사용자 피드백 2건 반영: ① "선수들이 너무 정적, 압박도 티키타카도 없다" ② 파울/카드/
세트피스 같은 실제 축구 사건 부재. 휴면 특성 2종(free_kick_specialist, aerial_threat)이
이 goal에서 처음 실전 발동한다.

## 동작
- 생동감: 압박 추격(비소유팀 1~2명 볼 추격, pressing 연동), 티키타카(중원 원터치 교환,
  tempo 연동, style 'short' 260ms), 잔발 드리블 위브(dribbling 비례)+마르세유턴(볼 오빗),
  대기 흔들림, 골 셀레브레이션(GOAL 플래시+동료 수렴).
- 리얼리즘: 빌드업 파울(삽입형)+옐로/레드(경고 누적 확률 승격 SECOND_YELLOW_FACTOR,
  팀 레드 상한 2, 10인 시 스쿼드 필터+레이팅 재계산), 위험 FK(직접=specialist 발동/
  크로스=aerial 듀얼 양측 발동), 코너킥(크로스 루틴 공유), PK(0.62~0.85 클램프),
  오프사이드, clearance. 데드볼 연속성 면제 규약(event-types.js).
- 튜닝: src/sim/tunables.js + scripts/tune-v2.mjs 그리드 스윕(2차, 8/24셀 전체 게이트
  통과 셀에서 확정). 몬테카를로 TRIALS 200→400(시드 윈도우 편향 실측 후 표본 강화).

## Completion Check
- `npm test` 통과: 몬테카를로 5종(득점 2.79/강팀 65.5%/동률 37.0%), 리얼리즘 7종
  (파울 20.2/옐로 3.19/레드 0.143/코너 5.3/오프사이드 1.40/PK 0.35/FK골 0.06),
  서술 불변식(신규 이벤트 포함), 특성 실호출 경로(learnings 교훈 적용), 핀 재기록.
- `node scripts/verify-anti-float.mjs` 통과 (신규 이벤트 유형 포함 볼-토큰 거리 위반 0).
- 실경기 커멘터리에서 코너/걷어내기/위험 파울→직접 FK→선방 시퀀스 확인.
