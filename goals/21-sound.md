---
vhk_format: 1
type: goal
id: 21
title: 사운드 — CC0 경기장 에셋 + WebAudio 레이어링 (v3 goal 21)
status: DONE
priority: P1
---

# Goal 21: 사운드 (v3)

## 동작
- **에셋**: Freesound CC0(실제 경기장 녹음) 8소스 → ffmpeg-static으로 컷/페이드/재인코딩
  (mp3 112k) 9파일, 총 1.7MB. assets/audio/. docs/CREDITS.md에 예의상 표기(CC0라 의무 없음).
- **soundManager.js**: Web Audio 레이어링(EA FC 방식) — 베드(관중 앰비언스) 루프 상시
  (loopStart/End로 mp3 패딩 컷, 무결절), 이벤트 원샷(랜덤 피치 ±3%), 골 순간 베드 게인
  스파이크 후 지수 복귀(setTargetAtTime). 홈 골=함성/원정 골=탄식(홈 관중 관점).
- **매치 훅**(컨트롤러 레벨 — 2D/3D 백엔드 공용): 킥오프/종료 휘슬, 파울 휘슬, 롱패스·
  슛·세트피스 킥음(숏패스 제외 — 스팸 방지), 골 함성/탄식, 카드 야유, 코너 스웰.
  리플레이(visualOnly)는 골 사운드 무음(이중 발화 방지).
- **토글**: 컨트롤바 사운드 on/off 칩. AudioContext는 유저 제스처(토글 클릭/킥오프)
  에서만 시작(자동재생 정책). 기본 off. localStorage prefs(sound/soundVolume) 영속 —
  세이브 마이그레이션 체인과 분리된 별도 키(렌더러 선호와 동거).

## Completion Check
- `npm test` 299개(soundManager prefs 기본값/저장/손상 복원/볼륨 클램프 4종 추가)
- E2E: 사운드 토글 on(에셋 로딩) → 4x 재생 골까지 에러 0 → off 토글 → prefs 영속 확인.
  AudioContext 자동재생 정책 준수(제스처 기반).
- 기존 게이트 전부 재통과(anti-float 2D/3D — 사운드는 컨트롤러 훅이라 볼 앵커링 무영향)
