---
vhk_format: 1
type: goal
id: 0
title: 프로젝트 스캐폴딩
status: DONE
priority: P0
completed: 2026-07-02
---

# Goal 0: 프로젝트 스캐폴딩

## 배경
바닐라 ES 모듈 프로젝트의 뼈대. 빌드 도구 없이 `npx serve`로 바로 열리는 최소 SPA 셸.

## 동작
- `package.json`(`"type": "module"`), `eslint.config.js`, `vercel.json`
- `index.html` 셸 + `src/main.js`, `src/router.js`(해시 라우터)
- `css/base.css` 기본 리셋

## Completion Check
- `npx serve . -l 5500`로 빈 화면이 에러 없이 로드됨
- `npx eslint .` 통과
