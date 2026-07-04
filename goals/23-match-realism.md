---
vhk_format: 1
type: goal
id: 23
title: 매치 리얼리즘 & 3D 모션 대개편 (v3 goal 23)
status: DONE
priority: P1
---

# Goal 23: 매치 리얼리즘 & 3D 모션 대개편 (v3)

사용자 실플레이 피드백 + Playwright 직접 관전 전수 진단. Phase 순차, 각 독립 커밋.
득점 빈도 정상 확인(200경기 평균 2.79골/경기, 무득점 5% — EPL 수준. 몬테카를로 게이트가
2.5~3.0골 강제 중).

## Phase A (DONE, 1단계) — 버그 + 튜닝
- **셀레머니 손 고착 수정**: three.js reset()이 celebrateT=0만 하고 팔 rotation 미복원 →
  루프 정지 시(일시정지/종료/리플레이 재점화) 만세 고착. 3중 방어: reset에 팔·다리
  rotation.x=0 복원, celebrateT<0.05 스냅+팔 복원, 리플레이(visualOnly) celebration 재점화
  차단(matchPlayback goal 블록을 !visualOnly 게이트).
- **관중 파묻힘 수정**: 연속 램프가 이산 계단 박스 속으로 파고들던 것 → 3단 계단 각
  윗면(y=3.9/6.3/8.7) 위에 앉히고 박스 0.9→1.1. 야간 스탠드에 관중 점묘 가시.
- **속도**: [1,2,4]→[0.5,1,2,4] + DELAY_MS ~1.25배 상향(숏패스 260→340)으로 x1 완화.
- **주야 명확화**: 주간 밝은 하늘 토큰(--pitch3d-day-sky) — 주간 bg near-black→#6ea8dc,
  야간 조명탑 SpotLight 실광원 + sun 대비(0.7→0.35). applyLighting 토글 즉시 렌더(idle 대응).

## Phase B (DONE, 2단계) — 슛 리얼리즘 1
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
## Phase C (DONE) — 3D 모션 디테일 (three.js + matchPlayback)
진단: 수신자가 공 마중 안 나감("가만히 있다 잡기"), 숏패스도 강한 킥 스윙, GK 선방 모션
0.26초라 안 보임.
- **C1 (HIGH)** 수신자 마중 + 트래핑: flight 중 수신자를 볼 궤적 쪽으로 + 도착 시 트래핑
  모션. [stash 3단계 패치에 초안]
- **C2 (MED)** 킥 강도 차등: 숏패스=가볍게/롱패스·슛=강(kickPower). [초안]
- **C3 (MED)** GK 선방 강화: 死코드 수정이 핵심 — position.y(공중 부양)를 셀레머니 else
  분기가 매 프레임 0으로 덮던 것(정찰 발견)에 save/receive 가드 추가. rise→plateau→fall
  엔벨로프(눕힘 1.1→1.55·hop 2.4→3.6·공중 1.5·지속 260ms→1050ms). 볼 소유 시 다이빙
  즉시 종료(held gap 방지 — anti-float 첫 실패 후 추가).
- **C4 (MED)** 드리블 잔발(케이던스 가속) + 고개 리액션(head userData 노출 후 볼 방향 lerp).

## Phase D (DONE) — 동선 유연화 (steering.js + matchPlayback)
진단: 오프볼 16명 정지(라인 시프트 없음), 양팀 대칭 포지션 겹침, 압박 1명·침투 없음.
- **D1 (HIGH)** 오프볼 라인 시프트: computeTarget에 볼 중앙 이탈 비례 평행이동 항(전원 같은
  벡터 — 대형 보존, pull과 별개). 정찰 지침대로 캡 상향 대신 시프트 항(겹침 악화 회피).
- **D2 (HIGH)** 충돌 회피(separation): 프레임 루프 후처리 231쌍, 근접 시 상호 밀어냄
  (SEP_MIN 4.4%). syncFrame 이전이라 held 볼이 홀더에 재부착(anti-float 안전). 홀더·셀레머니
  군집 제외. 관전 실측: "사비+램파드"·"반니+드사이" 겹침 → 전원 개별 판독 가능으로 해소.
- **D3 (LOW)** 압박 상시 2인(고압박 3인) — 첫째 볼 직행/둘째·셋째 커버 각(볼-자기골 사이
  +측면 오프셋으로 스택 방지). 침투 러너 — 최전방 비홀더 1명이 볼 반대 채널로 배후 대각 런.
- anti-float 2D/3D·테스트 299 통과(steering.test 라인시프트 반영 갱신).

## Phase E (DONE) — 세트피스 + 슛 위치 (matchPlayback)
진단: 코너/FK인데 박스 쇄도 없음(키커+수비 1명만 코너 깃발로, 20명 제자리), 중거리 슛인데
볼이 골문 앞에서 시작.
- **E1 (MED)** 세트피스 박스 쇄도: isSetPieceCrowd(코너/FK크로스/헤더 종결) 시 공격 전방
  4명을 상대 박스로·수비 5명을 자기 박스로(양팀 같은 박스). 정찰이 잡은 캡 함정
  (OVERRIDE_MAX_PULL 16%면 박스 근처도 못 감) → computeOverrideTarget에 maxPull 인자
  추가, 세트피스는 strongPullIds로 70% 강풀. pullOverrides self-expiring(다음 오픈플레이
  이벤트 clear). 관전 실측: 코너 시 박스 밀집 확인.
- **E2 (MED)** 중거리 볼 시작점: Fix B(렌더만) — shotFlight에서 long_range면 볼 시작을
  eventPosition(슈터 밴드3 존점)으로. possession의 hoist(Fix A)는 penalty/blockedCorner
  경로에서 narrationRng 추가 소비 위험이 있어 렌더 계층으로 회피(핀/몬테카를로 100% 무영향).

## 검증 원칙
- Phase C/D: anti-float 2D/3D 재통과가 무손실 증거. 각 Phase 후 3D 직접 관전 재확인
  (프레임 비교 — 정지↓/겹침↓/마중○).
- Phase E: 서술·렌더 계층 유지 → 핀/몬테카를로/리얼리즘 무수정 통과가 판정 무오염 증거.

## Completion Check (DONE)
Phase C·D·E 전부 DONE. 8개 진단 항목: 수신자 마중(C1)·킥 강도(C2)·GK 선방(C3)·
드리블/리액션(C4)·오프볼 정지(D1)·겹침(D2)·압박/침투(D3)·세트피스 쇄도(E1)·중거리(E2) —
각 Phase 관전 실측으로 개선 확인(겹침 해소·박스 쇄도·압박 협응). 테스트 299, anti-float
2D/3D 전부 그린. 서술 계층 변경(finishType 등)은 핀/몬테카를로 무수정 통과로 판정 무오염 증명.
