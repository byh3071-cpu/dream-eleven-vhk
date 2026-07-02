---
vhk_format: 1
type: goal
id: 8
title: Canvas 연속 스티어링 렌더러 (스트레치)
status: NOT_STARTED
priority: P2
---

# Goal 8: Canvas 연속 스티어링 렌더러 (스트레치)

## 배경
DOM 렌더러(Goal 4)로 게임이 재미있다고 검증된 뒤에만 착수하는 몰입감 업그레이드. 22명 전원이 매 프레임 포메이션 셰이프를 유지하며 볼 방향으로 쏠리는 연속 애니메이션은 CSS transition으로는 부드럽게 안 나와서 캔버스가 필요.

## 동작
- `src/ui/pitchRenderer.canvas.js` — Goal 4와 동일한 `initPitch()`/`renderEvent()` 인터페이스
- `computeFormationTarget`(슬롯좌표+팀셰이프 오프셋) + `steerToward`(pace 스탯 비례 속도)

## Completion Check
- 엔진(`src/sim/`)·데이터 무변경 확인 (diff로 증명)
- 렌더러 파일 교체만으로 동일 매치가 재생됨
