---
vhk_format: 1
type: meta
project: dream-eleven-vhk
version: v0.1
---

# Common Gates

1. `npm test` — Jest: `src/sim/` 순수 함수 유닛테스트 + 몬테카를로 검증 하네스
2. `npx eslint .` — 린트 통과

## Forbidden Actions (전역)

- 런타임 의존성 추가 금지 (프레임워크/게임엔진 포함) — 폴더 구조·기술스택은 `docs/ARCHITECTURE.md` 기준, 바뀌면 ADR 먼저
- `src/sim/`에 DOM 참조 추가 금지 (엔진은 순수 함수 유지 — precompute-then-replay 계약)
- 실제 선수 사진/AI 생성 인물 이미지 추가 금지 (이니셜/실루엣 뱃지만)

## Goal 파일 스키마 (필독 — VHK-021)

`vhk goal list/next/check/done` 는 `goals/*.md`(이 `_meta.md` 제외) 중 아래
frontmatter 를 만족하는 파일만 goal 로 인식한다. **하나라도 어긋나면 조용히 무시**되며
`vhk goal list` 가 경고로 알려준다.

| 필드 | 필수 | 값 |
| --- | --- | --- |
| `type` | ✅ | `goal` (문자열 그대로) |
| `id` | ✅ | **숫자만** (`1`, `2` … — `G1` 같은 문자열 ❌) |
| `status` | ✅ | `NOT_STARTED` | `IN_PROGRESS` | `DONE` | `BLOCKED` |
| `priority` | 권장 | `P0` | `P1` | `P2` |
| `title` | 권장 | 한 줄 제목 |

파일명 규칙: `goals/<id>-<name>.md` (예: `goals/1-login.md`).

### 새 goal 템플릿 (복붙)

```markdown
---
vhk_format: 1
type: goal
id: 1
title: 로그인 기능
status: NOT_STARTED
priority: P0
---

# Goal 1: 로그인 기능

## 배경 / 동작 / Completion Check ...
```

게이트 스크립트는 `vhk goal sync` 로 `scripts/check-goal-<id>.mjs` 를 백필한다.
