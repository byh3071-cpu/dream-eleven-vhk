---
vhk_format: 1
type: goal
id: 19
title: 2D/3D 듀얼 렌더러 1차 — PitchBackend 포트 + Three.js 백엔드
status: DONE
priority: P1
---

# Goal 19(1차): 2D/3D 듀얼 렌더러

## 설계 (플랜 승인분)
- matchPlayback = 컨트롤러(이벤트/타이머/물리, % 논리 좌표) + PitchBackend(피치 안
  그리기). HUD는 셸 잔류. 백엔드는 타이머/rAF 미소유(syncFrame에서 render 1회).
- 룰렛 오프셋 컨트롤러 잔류(ballScreenPos 피드백), 아크는 flightT 데이터화(2D 스케일
  / 3D 실제 높이 y=sin(πt)·H로 갈라지는 이음새).
- clearActivePlayback이 activeBackend.destroy까지 소유(고아 방어 확장) — 3D destroy는
  dispose+forceContextLoss(WebGL 컨텍스트 한도 초과가 실사고 지점).
- **ADR: "런타임 의존성 0" → vendored 정적 파일 예외(사용자 승인)** — Three.js r185
  WebGL 빌드 2파일(assets/vendor/three.module.min.js + three.core.min.js, 최신 빌드는
  분할됨) + index.html importmap. npm/번들러 여전히 0. 3D 모듈은 선택 시에만 dynamic
  import — 2D 사용자 다운로드 비용 0.
- rendererPref는 localStorage 별도 키 dream-eleven.prefs(세이브 마이그레이션 체인
  비오염, IF에도 적용).

## 동작
- [2D|3D] 세그먼트 칩(컨트롤바 — 셸 내부라 IF/커리어 자동). 킥오프 전/종료 후에만
  전환, done 전환 시 같은 이벤트 로그로 컨트롤러 재생성('다시보기' 대기). 로드 실패
  시 2D 유지. 선호 저장/복원.
- 3D 1차 비주얼(사용자 확정): 캡슐 토큰(팀색) + 등번호·이름 빌보드 스프라이트 +
  잔디 스트라이프 캔버스 텍스처 피치 + 골대 + 스탠드 실루엣 + 중계 카메라. 씬 색은
  전부 디자인 토큰에서 getComputedStyle로 해석(--pitch3d-* 신설 — designLint 통과,
  DESIGN.md가 canvas 시점에 예정한 토큰 리더 첫 도입). miniPop/flash는 3D 투영 좌표의
  DOM 오버레이(토큰 체계·reduced-motion 재사용), lunge만 3D 네이티브(메시 스케일).
- 2차(후속): Quaternius CC0 캐릭터 + Universal Animation Library, 카메라 프리셋.

## Completion Check
- 포트 추출 커밋(2fdcf07)에서 **기존 verify-anti-float 무수정 통과** = 2D 무손실 증명
- `node scripts/verify-anti-float-3d.mjs`: 2D↔3D 전환 20회 내구(누수 시그니처 0) +
  3D 재생 held 119샘플 gap≤2.0% 위반 0, 에러 0
- `npm test` 272개(designLint의 3D 토큰 검사 포함) + 스크린샷 실측(전 필드/골대/
  빌보드/오프사이드 팝 투영 정상), 소비자(match.js/career.js) 수정 0
