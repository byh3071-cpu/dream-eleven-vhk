---
vhk_format: 1
type: goal
id: 22
title: 3D 스타디움 완전체 (v3 goal 22)
status: DONE
priority: P1
---

# Goal 22: 3D 스타디움 완전체 (v3)

## 동작 (전부 pitchRenderer.three.js 내부 — 판정/2D 무영향)
- **골네트**: 골대에 WireframeGeometry 반투명 그물(뒷면/지붕/측면 3면).
- **선수 그림자**: 각 rig 발밑 CircleGeometry 블롭(공중 부양감 제거).
- **계단식 관중석**: 4면 3단 경사 스탠드(안쪽 낮음). 벽 4면 → 실제 스탠드.
- **점묘 관중**: InstancedMesh 720명(스탠드당 180), 팀색 반반 + 좌석 색 지터,
  살짝 발광. 골 시 득점팀 스탠드 기립 웨이브(y 상승 후 지수 복귀).
- **전광판**: 스탠드 위 판 + CanvasTexture로 스코어/분 실시간 미러(값 변화 시에만
  재드로잉 — frame에 score/minute 추가, 2D 백엔드는 무시).
- **조명탑**: 코너 4개 기둥 + 발광 헤드. **야간/주간 토글**(extraControls) — 조명
  색·강도·배경 스왑, 야간에 조명탑이 의미.
- **동료 셀레브레이션**: celebrate fx 시 득점팀 필드 동료도 점프(컨트롤러가 이미
  득점자 쪽으로 모아줌).
- WebGL dispose 목록에 신규 지오메트리/텍스처 전부 track — 컨텍스트 누수 방어.

## 동반 수정 (사용자 보고 2건)
- **피치 세로 폭발 버그**: 와이드 스테이지 `align-items: stretch`가 피치 aspect-ratio를
  깨 세로로 늘어남 → flex-start + 피치 flex:0 0 auto로 종횡비 1.47 복구. 커멘터리만 stretch.
- **재생 중 3D 전환 무반응**: swapTo가 playing/paused에서 금지돼 "전환 안 됨"으로 보임
  → controller.swapBackend(백엔드만 교체, index/타이머/점수 유지)로 어느 상태에서도 전환.

## Completion Check
- `npm test` 299개, anti-float 2D/3D 재통과(스타디움은 순수 뷰라 볼 앵커링 무영향)
- E2E: 2D 종횡비 1.47 확인 / 재생 중 3D 전환 성공 / 주간·야간 스크린샷(골네트·그림자·
  전광판·스탠드·조명탑), 에러 0
