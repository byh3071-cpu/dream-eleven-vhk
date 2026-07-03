# Design System — dream-eleven-vhk

코드가 단일 소스다: 토큰은 `css/tokens.css`, 살아있는 스타일가이드는 `#/styleguide`,
규칙 강제는 `tests/design/designLint.test.js`(npm test에 포함 — 어기면 어떤 goal도 못 닫는다).
이 문서는 "왜"를 설명하는 역할이고, "무엇"의 원본은 항상 코드다.

배경: 기능 우선으로 화면을 쌓다가 디자인이 붕괴해 개발을 전면 중단하고 Figma에서
재정립하게 된 실사례(KBO GM 시뮬레이터 개발기)를 보고, 커리어 모드 화면들이 쌓이기
전에 선행한 기반 공사다. 우리는 화면 5장 시점에 시작했으므로 코드-퍼스트로 충분하다.

## 토큰 네이밍 규칙

| 카테고리 | 규칙 | 예 | 이유 |
|---|---|---|---|
| 색 / 모션 / z-index / 보더 / 그림자 | 시맨틱 | `--color-danger`, `--duration-fast` | 테마/의미가 바뀔 수 있는 값 |
| 간격 / radius | 값 인코딩(px) | `--space-16`(=1rem), `--radius-6` | 그리드 구조값은 숫자가 곧 스펙 |
| 타입 | 티셔츠 | `--text-sm` | rem이라 값 인코딩 불가, 의미 티어 실재 |

## 절대 규칙 (designLint가 기계 강제)

1. **색 리터럴(hex/rgb/hsl)은 tokens.css에만.** 다른 CSS는 `var()`만 쓴다.
2. **JS에 hex 색 금지.** 색이 필요하면 `'var(--토큰)'` 문자열 패스스루 — SVG 속성/인라인
   스타일 모두 CSS 변수를 해석한다(squadBuilder 빈 슬롯 뱃지에서 검증된 패턴).
   `getComputedStyle`로 실값을 읽는 헬퍼는 **Canvas 렌더러가 실제로 도입될 때만** 만든다
   (canvas 2D 컨텍스트는 var()를 해석 못 하므로 그때는 필수, 그 전엔 죽은 코드).
3. **tokens.css는 `:root` 선언 전용.** 셀렉터를 넣으면 tokensParser/export 전제가 깨진다.
4. **새 화면/새 컴포넌트 상태를 추가하는 goal은 같은 goal 안에서 `#/styleguide`에도 추가한다.**

## 확정값 잠금 목록 (토큰 미참조 리터럴 — 절대 재유도 금지)

`verify-cards.html`에서 사용자 확인 5차례를 거쳐 확정된 값들. 전역 토큰을 참조하지
않는 것 자체가 보존 장치다(토큰 리튠이 카드를 못 건드리게).

- `css/components.css`의 `designlint-allow-start` ~ `designlint-allow-end` 구간
  (`.player-card` 계열 전체 — 폰트 px, 패딩, clip-path, radius 3/4px, 국기 그림자)
- `src/ui/components/playerBadge.js`의 `FONT_SIZES` 테이블 (px 리터럴)

## 의도적 예외 등록부

| 위치 | 값 | 이유 |
|---|---|---|
| `.chip` gap/padding | `0.4em / 0.4em 0.9em` | em = 폰트 비례 확장이 목적, px 그리드 밖 |
| `.squad-builder__list` gap | `14px` | 카드(196px 고정) 배치 전용 간격, 스케일 무관 |
| `.pitch-slot__role/__name` | `11px / 10px` | 44px 뱃지에 결합된 슬롯 전용 크기 |
| 컴포넌트 고정 폭들 | `52px, 108px, 44px, 196px, 360px, 480px` 등 | 컴포넌트 치수는 토큰 대상 아님(간격만 대상) |

## 모션 주의사항

`--duration-ball-travel`은 `--duration-fast`와 값이 같아도 **반드시 분리 유지**.
match.js의 이벤트 캐던스(180ms)보다 길어지면 볼 transition이 매번 끊겨 기어가는
문제가 실측으로 확인됐다 — 전역 모션 리튠이 볼을 못 건드리게 절연한 것.

## 클래스 소유권 맵

| 파일 | 소유 |
|---|---|
| `css/tokens.css` | `:root` 토큰 선언만 |
| `css/base.css` | 리셋, `html/body`, `.app`, `.screen`, `button/a` 기본 |
| `css/components.css` | 두 화면 이상이 쓰는 전부: `.chip`, `.link-button`, `.topbar` 계열, `.pitch-slot` 계열, `.player-badge` 계열, `.player-card` 계열(잠금) |
| `css/<화면>.css` | 그 화면 전용 클래스만. 공용이 되는 순간 components.css로 이사 |
| `css/styleguide.css` | 스타일가이드 지그 전용 |

## Figma 내보내기

`node scripts/export-tokens.mjs` → Tokens Studio 호환 JSON. 스타일가이드와 같은
파서(`src/ui/tokensParser.js`)를 공유하므로 두 소비자가 어긋날 수 없다.
실행은 Figma 연동이 실제로 필요할 때만.

## 함정 기록

- CSS 주석 안에서 클래스 와일드카드를 `별표+슬래시`로 쓰면 주석이 조기 종료돼
  **파일 전체가 파싱 실패**한다(tokens.css :root가 rules=0이 됐던 실사고).
  주석에선 "계열"로 풀어 쓸 것.

## vendored 정적 파일 예외 (goal 19 ADR — 사용자 승인)

"런타임 npm 의존성 0" 원칙에 단 하나의 예외를 둔다: `assets/vendor/`의 Three.js r185
WebGL 빌드 2파일(three.module.min.js + three.core.min.js — 최신 빌드는 분할이라 1파일이
아님에 주의). 도입 방식은 index.html `importmap`("three" → 로컬 파일)이며 npm/번들러는
여전히 쓰지 않는다. 3D 백엔드(pitchRenderer.three.js)가 dynamic import로만 로드하므로
2D 사용자는 이 파일을 내려받지 않는다. 버전 업데이트는 jsDelivr에서 같은 두 파일을
받아 교체 + verify-anti-float-3d 재통과가 절차다.

## 3D 씬 색 규칙 (goal 19)

canvas/WebGL은 `var()`를 해석하지 못하므로 3D 백엔드는 `getComputedStyle` 토큰 리더
(pitchRenderer.three.js의 `tokenOf`)로 tokens.css 값을 읽는다 — 본 문서가 "canvas
렌더러 도입 시점에만 허용"으로 예정해 둔 헬퍼의 첫 실사용. 씬 전용 색(골대/볼/조명/
라벨 스트로크)은 `--pitch3d-*` 토큰으로 tokens.css에 등록한다(색 리터럴은 여전히
tokens.css 밖에 못 산다 — designLint가 JS hex를 계속 감시).

## 아이콘 규칙 (goal 19-2)

아이콘 단일 소스는 `src/ui/components/icons.js` — Lucide(ISC) 서브셋 인라인 + 자체 제작
(soccer-ball, 동일 24x24 stroke 규격). 새 아이콘이 필요하면 lucide-static에서 path를
가져와 이 파일에만 추가한다(화면 코드에 raw SVG 금지). 전부 currentColor라 색은 토큰을
상속하고, 파싱은 DOMParser(innerHTML 싱크 금지 — 보안 훅 규칙). UI 크롬은 아이콘,
커멘터리 같은 서술 텍스트는 이모지 허용(문장 안에서는 이모지가 자연스럽다).
