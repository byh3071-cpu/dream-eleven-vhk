---
id: claude-md-dream-eleven-vhk
date: 2026-07-02
tags: [process, documentation]
---

# 기록 규칙 (dream-eleven-vhk)

> 이 파일은 기록/운영 전용. 코딩/디자인 → .cursorrules 참조.
> See also: AGENTS.md (`vhk sync` 로 생성 — Codex/OpenAI 계열 호환).

## 사전 조회 규칙 (Dev Log DB 연동)
기록하기 전에 **먼저 조회**한다 — 과거 경험을 재사용(양방향 루프의 회수 측).
- **새 프로젝트 시작 · 에러 발생 · 기술 선택** 시 Dev Log DB를 먼저 조회한다.
- 관련 기록이 있으면 **핸드오프 스냅샷**을 요청한다.
- 조회 결과는 `docs/state/handoff.md` 에 반영한다.

## 현재 상태
- **Phase:** Phase 1 — MVP
- **블로커:** 없음
- **다음 액션:** [현재 작업 원본 확인](docs/state/next-task.md)
- **마지막 업데이트:** 2026-07-02

## 세션 종료
세션 종료 시 `vhk recap` (한국어: "오늘 한 일 정리해") → 요약 생성 → docs/log/ 저장

<!-- vhk:rules:start -->
> ⚡ 아래 규칙 섹션은 RULES.md에서 자동 생성됨 (vhk sync). 직접 수정 금지.

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

<!-- vhk:rules:end -->
