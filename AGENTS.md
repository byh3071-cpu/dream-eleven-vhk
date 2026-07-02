# dream-eleven-vhk — AGENTS.md (에이전트 작동 규약)

> ⚡ 이 파일은 RULES.md에서 자동 생성됨 (vhk sync). 직접 수정 금지.

## Loop Protocol
- 루프: `context → goal next → 작업 → goal check → goal done`
- 작업 시작 시 `.vhk/HARD_STOP` 확인 — 있으면 모든 자동화 즉시 중단.
- active goal 만 작업. `docs/state`(next-task/blockers)는 append-only.
- 교훈·결정·실패·성공은 `vhk memory`(memory v2 4버킷, 단일 출처).
- 게이트(tsc / test:run / build) 통과해야만 `vhk goal done`.

## Ecosystem (cross-repo)

> Contract SoT: yohan-brain `memory/core/ecosystem-contract.yaml` (obey when status=active).

- **Tier:** yohan-brain `memory/core/inheritance-registry.yaml`
- **Cursor:** `.cursor/rules/ecosystem.mdc` (vhk inject-bootstrap)
- **금지:** AGENTS.md 손수 편집 → `RULES.md` + `vhk sync`

## 기술 스택
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Vercel

## 코딩 규칙
- TypeScript strict (any 금지)
- try-catch 필수, 빈 catch 금지
- console.log 프로덕션 제거
- 파일명은 kebab-case

## 커밋 컨벤션
- feat: / fix: / refactor: / docs: / chore:

## 기록 규칙
- 세션 종료 시 docs/log/YYYY-MM-DD-{작업명}.md 생성
- 기술 선택 시 docs/adr/ADR-{번호}-{제목}.md 생성
- 기능 완성 / 에러 해결 / ADR / 세션 종료 시 Notion "바이브코딩 Dev Log" DB에 1행 적재 (Notion MCP)
- 적재 직전 Dev Log DB 상단 "AI 적재 규칙" 콜아웃 확인 — 제목: (YYYY-MM-DD) 프로젝트명 - 제목
- 태그는 기존 옵션만 사용, 같은 작업 중복 적재 금지(SoT Key)

## 기타 규칙
> RULES.md 의 비표준 H2 섹션 — 표준 매핑 외이지만 보존 위해 전파(직접 수정은 RULES.md 에서).

### 프로젝트 정체성
- 한 줄 설명: 레전드/현역 축구선수로 베스트일레븐을 구성해 감독처럼 포메이션·전술을 짜고 2D로 경기를 시뮬레이션하는 드림매치 게임
- 스택: Next.js + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel

### 안전 규칙
- 고위험 작업(매매·송금·발송·삭제·배포·publish)은 LLM 결정경로에서 제외 — 룰+하드리밋으로 구현 (PAT-003)
- MCP 고위험 도구(save/undo 등 상태변경)는 confirm:true 명시 전 실제 실행 금지 (기본 미리보기 — 옵트인)
- publish · main 직접 push 는 사람 승인 후에만
