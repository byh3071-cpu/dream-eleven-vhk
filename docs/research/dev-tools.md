---
id: research-dev-tools
date: 2026-07-05
tags: [research, tooling, pipeline]
---

# 개발 도구·툴·파이프라인 리서치

> **목적**: dream-eleven-vhk 도입 후보 도구·파이프라인 정리.
> **제약(엄격)**: 런타임 npm 의존성 0(정적 vendored만 — Three.js r185 유일 예외), 순수 ES 모듈,
> 번들러 없음, localStorage(서버 없음), 결정론 시뮬, 스팀/앱스토어/플레이스토어 출시,
> 오프라인 우선 + AI는 선택적 온라인 향신료.
> **조사일**: 2026-07-05. 각 표: 무료여부·제약 적합성·난이도·시점(지금/출시).
> **로드맵 연계**: goal 21(사운드)·26(3D 캐릭터)·29(PWA)·31(E2E)에 직접 대응(ROADMAP-V3.md).

---

## 결론 먼저

**지금 도입(폴리싱 백로그, 배포 선행)**
- **3D 캐릭터(goal 26)**: Quaternius CC0 glTF(모델+애니 동봉) → `three/addons/` importmap 확장으로 vendored GLTFLoader. Mixamo는 **FBX라 변환 필요** — 우회 권장.
- **PWA(goal 29)**: 바닐라 서비스워커 + manifest.json(Workbox는 빌드 도구라 npm0 위반 — 손코딩). Cache API(에셋)와 localStorage(게임 상태)는 **충돌 아님, 상보적**.
- **E2E(goal 31)**: Playwright(devDependency로만, 런타임 0 영향). WebGL 스크린샷은 `--use-gl=swiftshader` + 로드완료 플래그 대기.
- **에셋 최적화**: sharp/cwebp/avifenc(이미지), pyftsubset+glyphhanger(폰트), ffmpeg(오디오) — 전부 CLI, 빌드 산출물만 커밋하므로 런타임 의존성 0.

**출시 때(배포 트랙 — 로드맵상 PWA 이후 별도)**
- **스팀**: Electron 또는 NW.js 래핑 + steamworks.js. 3개 스토어 중 심사 제일 관대.
- **안드로이드**: TWA(Bubblewrap) — PWA 완성 시 거의 공짜. Capacitor는 iOS 겸용/네이티브 플러그인 필요할 때.
- **iOS**: 가장 까다로움. Apple 4.2(최소 기능) 리젝 리스크 — 순수 웹래퍼 금지, 네이티브 요소+오프라인 처리 필수. Capacitor로.
- **분석**: Cloudflare Web Analytics 또는 GoatCounter(쿠키리스, 배너 불필요).

**즉시 고칠 것 2건(이번 리서치 중 발견 — 범위 밖이라 보고만)**
1. `index.html`이 Pretendard를 `cdn.jsdelivr.net`에서 로드 → **오프라인 우선 위반**. 자가호스팅+서브셋으로 교체(5번 항목).
2. `RULES.md`/`CLAUDE.md` 기술 스택이 stale(Next.js·Supabase·Tailwind·shadcn 표기) — **실제는 바닐라 ES + Three.js vendored**. 규칙 문서가 실제와 불일치.

**호스팅 주의**: Vercel Hobby(무료)는 **비상업 전용**. 상업 게임 출시엔 Cloudflare Pages(대역폭 무제한·상업 허용)가 정합.

---

## 1. 3D 파이프라인 (Three.js r185 기반 캐릭터) — goal 26

현재 상태: `assets/vendor/three.module.min.js` + `three.core.min.js` 2파일, importmap `"three"` 1키.
피치 렌더러(`src/ui/pitchRenderer.three.js`)는 **절차적 로우폴리 휴머노이드**(외부 모델 0). glTF 캐릭터는 신규 작업.

| 도구 | URL | 무료 | 제약 적합성 | 난이도 | 시점 |
|---|---|---|---|---|---|
| GLTFLoader (three/addons) | threejs.org/docs → GLTFLoader | O | **vendored 가능** — jsm 파일 복사 + importmap 키 추가 | 하 | 지금 |
| SkeletonUtils (three/addons) | threejs.org/docs → SkeletonUtils | O | vendored 가능 — `retargetClip`/`clone` 제공 | 중 | 지금 |
| Quaternius (CC0 캐릭터+애니) | quaternius.com | O(CC0) | **glTF 직접 제공** — 변환 불필요, 최적 | 하 | 지금 |
| Poly Pizza (CC0 검색) | poly.pizza | O(대부분 CC0) | glTF 다운로드 → vendored | 하 | 지금 |
| gltf-transform (CLI) | gltf-transform.dev/cli | O | **빌드타임 CLI** — 산출 glTF만 커밋, 런타임 0 | 중 | 지금 |
| Mixamo | mixamo.com | O(가입) | **FBX 출력 — 변환 필요**(아래) | 중 | 선택 |
| Blender + glTF 익스포터 | github.com/KhronosGroup/glTF-Blender-IO | O | 오프라인 변환/리깅. FBX→glTF 정공법 | 상 | 선택 |

**번들러 없이 vendored로 GLTFLoader 쓰는 법(핵심)**
1. r185 릴리스에서 **GLTFLoader.js + 필수 형제 2개**를 폴더 구조 유지해 `assets/vendor/jsm/`에 배치: `loaders/GLTFLoader.js`, `utils/BufferGeometryUtils.js`, `utils/SkeletonUtils.js`.
   - r185 GLTFLoader가 이 둘을 **하드 import**(검증함): `toTrianglesDrawMode`←BufferGeometryUtils, `clone`←SkeletonUtils. 두 형제는 각각 `three`만 import — 추가 형제 없음(3파일이면 완결).
   - Draco 압축 메시를 쓸 때만 `loaders/DRACOLoader.js`+디코더 wasm 추가. **SkeletonUtils가 이미 포함되므로 애니 리타게팅(`retargetClip`)은 공짜로 확보.**
2. importmap에 키 1개 추가:
   ```html
   <script type="importmap">
   { "imports": {
       "three": "./assets/vendor/three.module.min.js",
       "three/addons/": "./assets/vendor/jsm/"
   }}
   </script>
   ```
3. `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'`. 폴더 매핑이라 하위 `loaders/`·`utils/`가 전부 해결. jsm 파일의 `from 'three'`도 importmap이 해결. 별도 빌드 없음.
   - **주의**: three.js addons는 서로 형제 파일을 참조 — "1파일만 복사"는 깨진다. import 에러가 나면 그 파일명을 마저 vendored하거나, 안전하게 `examples/jsm/` 트리 전체 복사. 서드파티(비-three) 의존성은 없고 내부 형제뿐이라 이 방식으로 완결된다.

**Mixamo vs Quaternius(중요 구분)**
- **Mixamo는 FBX만 출력** → glTF로 변환 + Quaternius 스켈레톤에 리타게팅해야 함(2단계). FBX2glTF(facebookincubator)는 **아카이브·미유지** — 권장 안 함. Blender(glTF-Blender-IO) 또는 온라인 병합툴(mixamo2gltf.com 등, 라이선스·품질 검증 후)로.
- **Quaternius는 glTF+애니 동봉** → 변환 없이 바로 vendored. 리타게팅 부담 없음. **로드맵 goal 26이 이미 Quaternius로 명시** — 정답 경로.

**로우폴리 최적화**: gltf-transform CLI가 현 표준(Don McCurdy, 활발히 유지, v4.x). `optimize` 커맨드로 Draco/Meshopt 지오메트리 압축·텍스처 WebP·중복 제거·prune 일괄. 빌드타임 1회 실행 → 산출 glTF만 리포에 커밋하므로 **런타임 의존성 0 유지**.

**지금 vs 출시**: 캐릭터 도입·최적화·품질 모드(저사양 pixelRatio1·AA off·그림자 off / 고사양)는 goal 26 = **지금**. 출시 때 추가 작업 없음(에셋은 정적).

---

## 2. PWA / 오프라인 / 스토어 래핑 — goal 29(PWA) + 출시 트랙

Cache API(에셋 캐시)와 localStorage(게임 세이브)는 **역할이 다름 — 정합**. 서비스워커는 앱셸/에셋을 캐시해 오프라인 로드를 보장하고, 게임 상태는 계속 localStorage. 충돌 없음.

| 도구 | URL | 무료 | 제약 적합성 | 난이도 | 시점 |
|---|---|---|---|---|---|
| 바닐라 Service Worker + manifest | developer.mozilla.org → PWA | O | **최적** — 손코딩 JS, npm0·번들러없음 정합 | 중 | 지금 |
| Workbox | developer.chrome.com/docs/workbox | O | △ 빌드 도구 전제 — **npm0와 마찰**. 캐시 전략 참고용만 | 중 | (참고) |
| PWABuilder | pwabuilder.com | O | manifest/아이콘 생성·스토어 패키징 보조 | 하 | 지금/출시 |
| Electron | electronjs.org | O | 스팀 래핑. Chromium 번들 → 100MB+, **렌더 일관성 최상** | 중 | 출시 |
| NW.js | nwjs.io | O | 스팀 래핑. 프론트/백 분리 없어 단순, Steam 최다 사용 | 중 | 출시 |
| steamworks.js | github.com/ceifa/steamworks.js | O | Electron/NW.js에 Steamworks API 바인딩(도전과제 등) | 중 | 출시 |
| Tauri v2 | tauri.app | O | 경량(8MB급)이나 **OS별 웹뷰 → WebGL 일관성 리스크** | 중 | 출시(주의) |
| Capacitor | capacitorjs.com | O | 모바일(iOS/Android) 래핑, 네이티브 플러그인. 로드맵상 배포 후 | 중 | 출시 |
| Bubblewrap (TWA) | github.com/GoogleChromeLabs/bubblewrap | O | **PWA 완성 시 안드로이드 최선**(~800KB, 서비스워커 필수) | 하 | 출시 |

**스팀 래핑 — Electron vs Tauri vs NW.js**
- **Electron**: Chromium 동봉 → 용량 큼(100MB+)·메모리 많음. 대신 **모든 OS에서 동일 Chromium 렌더** → Three.js/WebGL 일관성 보장. Figma 데스크톱이 WebGL을 Electron으로 래핑하는 이유.
- **Tauri**: 8MB급·저메모리로 매력적이나 **OS 네이티브 웹뷰 사용**(Win=WebView2, macOS=WKWebView, Linux=WebKitGTK) → WebGL 동작·셰이더 미묘한 차이 가능. 3D 게임엔 크로스플랫폼 리스크. 채택 시 3 OS 전수 테스트 필수.
- **NW.js**: Electron과 유사(Chromium 동봉), 프론트/백 IPC 없이 단순. Steam JS 게임 최다 채택.
- **판단**: 3D WebGL 일관성 우선이면 **Electron/NW.js**. greenworks/steamworks.js 둘 다 이 둘만 공식 지원.

**모바일 — TWA vs Capacitor vs 순수 PWA**
- **TWA(Bubblewrap)**: PWA(HTTPS+manifest+서비스워커, Lighthouse 통과)만 되면 안드로이드 패키징 거의 공짜(~800KB, Chrome 엔진). **안드로이드 전용**.
- **Capacitor**: 서비스워커 없어도 됨, iOS+데스크톱 겸용, 카메라 등 네이티브 플러그인. 용량 큼(~4MB+). **iOS 가려면 이 경로**.
- **판단**: goal 29로 PWA 완성 → 안드로이드는 TWA(저비용), iOS는 Capacitor. 로드맵이 "Capacitor 래핑은 배포 이후 별도 트랙"으로 이미 못박음.

**지금 vs 출시**: manifest+서비스워커+설치 아이콘/스플래시 = goal 29 **지금**(배포 선행 조건). 네이티브 래핑(Electron/Capacitor/TWA) = **출시**.

---

## 3. AI 향신료 통합 (선택적 온라인)

**핵심 결론(먼저)**: **정적 클라이언트는 API 키를 숨길 수 없다.** 클라 코드·네트워크 탭에서 키는 반드시 추출 가능. Gemini의 HTTP-referrer 제한 등은 **남용 억제일 뿐 보안 아님**(스푸핑 가능). 서버 없는 제약과 정면 충돌 → 3가지 현실 옵션 중 택.

| 옵션 | 도구/API | 무료 | 제약 적합성 | 난이도 | 시점 |
|---|---|---|---|---|---|
| **A. BYOK**(유저 키) | localStorage에 유저가 붙여넣기 | O | 인프라 0·서버없음 유지. 단 키가 localStorage(XSS 유출 위험), 파워유저만 | 하 | 지금(옵트인) |
| **B. 서버리스 프록시** | Cloudflare Workers / Vercel Edge | O(무료티어) | **"서버없음"이 유일하게 굽는 지점** — 상태없는 프록시+레이트리밋. Three.js처럼 "1개 예외" 프레이밍 | 중 | 출시 |
| **C. 로컬 인브라우저 모델** | WebLLM / Transformers.js / wllama | O | **키 0·완전 오프라인**. 단 수백MB 다운로드·WebGPU 필요 | 상 | 선택 |
| 무료 API(프록시 뒤) | Gemini Flash / Groq / OpenRouter / CF Workers AI | O(티어) | B와 조합. 아래 한도 | — | 출시 |

**무료 LLM 티어(2026-07 기준, 변동성 큼)**
- **Google Gemini Flash**: 15 RPM / 1,500 RPD, 컨텍스트 큼. 범용 최강 무료.
- **Groq**(Llama 3.3 70B): 30 RPM / 1,000 RPD, ~320 tok/s — **초저지연**(짧은 회견/멘트에 적합).
- **OpenRouter**: 무료 20 RPM / 50~1,000 RPD, 28+ 무료 모델. $10 1회 충전 시 일 1,000으로 상향(영구).
- **Cloudflare Workers AI**: 무료 10,000 neurons/일(≈Llama 3.1 8B 텍스트 생성 1만 스텝). **프록시(옵션 B)와 같은 CF 인프라라 궁합 최상**.

**결정론 가드(필수 설계)** — RULES.md PAT-003("고위험 작업은 LLM 결정경로에서 제외, 룰+하드리밋")과 직결.
- LLM 출력은 **프레젠테이션 전용**: 기자회견 텍스트·영입 협상 플레이버·결과 스토리텔링. **시뮬 상태·RNG·경기 결과에 절대 되먹임 금지.**
- "IF 편성 자연어"는 유일하게 입력 방향 — AI를 **파서/의도분류기**로만: 자연어 → 후보 구조화 포메이션 → **룰로 검증·정규화** → 그 다음 결정론 시뮬. AI가 시드/결과를 정하지 않음.
- **폴백**: 오프라인·키없음·레이트리밋 시 기존 템플릿 커멘터리로 강등. AI는 순수 점진적 향상(progressive enhancement)이지 의존 경로 아님.

**지금 vs 출시**: 코어(오프라인·결정론)는 AI와 무관하게 완성. AI는 **출시 후 향신료**로 붙임. 굳이 지금이면 옵션 A(BYOK)가 인프라 0라 실험용으로 유일하게 지금 가능.

---

## 4. 테스트 / 품질 — goal 31(E2E 정식화)

현재: Jest + eslint + 커스텀 게이트(`scripts/check-goal-*.mjs`, `verify-*.mjs`). 전부 devDependency/노드 스크립트 → 런타임 0.

| 도구 | URL | 무료 | 제약 적합성 | 난이도 | 시점 |
|---|---|---|---|---|---|
| Playwright | playwright.dev | O | **devDependency만** — 런타임 0 무영향. E2E 표준 | 중 | 지금 |
| Playwright `toHaveScreenshot` | playwright.dev/docs/test-snapshots | O | 시각 회귀 내장 — 별도 서비스 불필요 | 중 | 지금 |
| pixelmatch / odiff | github.com/mapbox/pixelmatch · github.com/dmtrKovalenko/odiff | O | 이미지 diff 라이브러리(커스텀 게이트에 삽입) | 중 | 선택 |
| Lighthouse CI | github.com/GoogleChrome/lighthouse-ci | O | PWA·성능 예산 게이트(goal 29 검증에 유용) | 중 | 지금/출시 |
| stats.js | github.com/mrdoob/stats.js | O(MIT) | Three.js 저자 제작, FPS/MS/MB 오버레이. vendored 가능 | 하 | 지금 |
| Spector.js | spector.babylonjs.com | O | WebGL 드로우콜 캡처·프레임 디버깅. 개발용만 | 중 | 선택 |
| Chrome DevTools Performance | developer.chrome.com/docs/devtools | O | 무설치 프로파일링·메모리·GPU | 하 | 지금 |

**WebGL E2E 핵심**: Playwright에서 3D 캔버스 스크린샷 시 (1) `--use-gl=swiftshader`로 GPU 없이 소프트웨어 렌더(CI 재현성), (2) 렌더 완료 커스텀 플래그(`window.__renderReady`) 세팅 후 캡처, (3) `animations:'disabled'`+`maxDiffPixelRatio`로 미세 차이 허용. 결정론 시뮬이라 시드 고정 시 프레임 재현성 확보 — **2D/3D 교차 재생 게이트(goal 31)와 결합하면 강력.**

**지금 vs 출시**: Playwright E2E + 시각 회귀 = goal 31 **지금**. Lighthouse CI는 PWA(goal 29) 검증에 **지금**, 스토어 심사 전 재확인 **출시**.

---

## 5. 에셋 파이프라인 (번들러 없이)

전부 **빌드타임 CLI** → 산출물(최적화된 정적 파일)만 리포에 커밋. 런타임 의존성 0 유지. `scripts/`에 mjs 래퍼로 원커맨드화 가능.

| 도구 | URL | 무료 | 제약 적합성 | 난이도 | 시점 |
|---|---|---|---|---|---|
| sharp | sharp.pixelplumbing.com | O | 이미지 WebP/AVIF 일괄. **Squoosh CLI 대체 표준**(활발) | 중 | 지금 |
| cwebp / avifenc | developers.google.com/speed/webp · github.com/AOMediaCodec/libavif | O | 포맷별 정밀 인코더(세밀 제어) | 중 | 선택 |
| Squoosh (웹앱) | squoosh.app | O | 웹앱은 살아있음. **CLI(@squoosh/cli)는 폐기(2023)** — 수동용만 | 하 | (수동) |
| rimage | github.com/SalOne22/rimage | O | Rust CLI, squoosh 대안(배치) | 중 | 선택 |
| pyftsubset (fonttools) | fonttools.readthedocs.io → subset | O | **폰트 서브셋 표준** — Unicode 범위 지정·WOFF2 직출력 | 중 | **지금** |
| glyphhanger | github.com/zachleat/glyphhanger | O | 사이트 실사용 글리프 → Unicode 범위 추출(pyftsubset 입력) | 중 | 지금 |
| ffmpeg | ffmpeg.org | O | 오디오 압축(Opus/AAC)·정규화. 현 `assets/audio/*.mp3` 재인코딩 | 중 | 지금 |
| Leshy SpriteSheet Tool | leshylabs.com/apps/sstool | O | 무료 웹 스프라이트 아틀라스(플래그/UI 아이콘용) | 하 | 선택 |

**즉시 조치 — Pretendard 자가호스팅(오프라인 위반 수정)**
현재 `index.html`이 `cdn.jsdelivr.net/gh/orioncactus/pretendard`에서 폰트 로드 → 오프라인 시 폰트 깨짐 + 외부 요청. 수정:
1. glyphhanger로 실제 쓰는 한글/라틴 글리프 범위 추출(한글 전체는 무거움 — 서브셋 필수).
2. `pyftsubset Pretendard.ttf --unicodes=<범위> --flavor=woff2 --layout-features='*'` (kerning/ligature 보존).
3. `assets/fonts/`에 WOFF2 배치 + `@font-face` 자가호스팅. CDN preconnect/link 제거.
   - 한글 폰트는 서브셋+WOFF2(Brotli)로 수 MB→수십~수백KB. 동적 한글(선수명 등) 많으면 범위 넉넉히 or 다이나믹 서브셋 전략 검토.

**지금 vs 출시**: 폰트 자가호스팅은 오프라인 정합상 **지금**(PWA 선행). 이미지/오디오 최적화는 에셋 늘 때 상시. 스프라이트는 UI 아이콘 정리 시.

---

## 6. 배포 / 분석 (프라이버시 존중)

| 도구 | URL | 무료 | 제약 적합성 | 난이도 | 시점 |
|---|---|---|---|---|---|
| **Cloudflare Pages** | pages.cloudflare.com | O | **대역폭 무제한·상업 허용·정적 최적**. 1순위 | 하 | 지금 |
| GitHub Pages | pages.github.com | O | 100GB/월 소프트·리포 1GB. 단순·무계정마찰 | 하 | 지금 |
| Vercel Hobby | vercel.com | O | **비상업 전용** — 상업 게임 부적합(주의). 프리뷰용만 | 하 | (주의) |
| Netlify | netlify.com | O | 100GB/월, 오버리지 비쌈 | 하 | 선택 |
| Cloudflare Web Analytics | cloudflare.com/web-analytics | O | **쿠키리스·배너불필요·스크립트 경량**. CF Pages와 궁합 | 하 | 출시 |
| GoatCounter | goatcounter.com | O(개인/SMB) | 쿠키리스·단일 Go 바이너리(자가호스팅도 쉬움) | 하 | 출시 |
| Plausible CE / Umami | plausible.io · umami.is | O(자가호스팅) | 오픈소스·쿠키리스. **단 자가호스팅=서버 필요**(제약 마찰) | 중 | 선택 |

**스토어 심사 체크리스트(출시)**
- **스팀(제일 관대)**: Steamworks 파트너 가입($100 앱수수료, 매출로 상환). Electron/NW.js 빌드 + steamworks.js. 콘텐츠 심사만, 기능 최소요건 없음. Steam Deck 호환(Proton/Linux 빌드) 별도 검증 권장.
- **Google Play(TWA)**: 개발자 계정 $25(1회). Bubblewrap로 PWA→AAB. **서비스워커+manifest+Lighthouse 통과가 전제** → goal 29 완료가 곧 자격. Digital Asset Links(assetlinks.json) 검증 필요.
- **Apple App Store(제일 까다로움)**: 개발자 $99/년. **가이드라인 4.2 "최소 기능" 리젝 리스크** — 순수 풀스크린 웹뷰(URL만 로드, 오프라인 시 백지)는 리젝. 대응: 네이티브 내비/오프라인 상태 화면/앱다운 콘텐츠 임베드. **Capacitor + 오프라인 완성도**가 관문. HTML5 게임은 "바이너리에 임베드된 미니게임"으로는 허용되나 웹래퍼로 오해받지 않게 설계.

**지금 vs 출시**: 배포 호스팅(Cloudflare Pages)은 PWA 나오면 **지금**(로드맵상 배포는 최종 보류지만 스테이징엔 유용). 스토어 제출·분석은 **출시**.

---

## 부록 A — 도입 우선순위 한눈에

| 시점 | 항목 | 관련 goal |
|---|---|---|
| **지금** | Playwright E2E + 시각회귀 | 31 |
| **지금** | 바닐라 서비스워커 + manifest | 29 |
| **지금** | Pretendard 자가호스팅+서브셋(오프라인 수정) | 29 선행 |
| **지금** | Quaternius glTF + vendored GLTFLoader + gltf-transform | 26 |
| **지금** | stats.js / Lighthouse CI(성능·PWA 게이트) | 26·29 |
| **지금** | sharp/ffmpeg 에셋 최적화(상시) | 21 등 |
| **출시** | Electron/NW.js + steamworks.js(스팀) | 배포 트랙 |
| **출시** | TWA(안드로이드) / Capacitor(iOS) | 배포 트랙 |
| **출시** | Cloudflare Web Analytics / GoatCounter | 배포 트랙 |
| **출시 후 향신료** | LLM(서버리스 프록시 or BYOK, 결정론 가드) | 신규 |

## 부록 B — 이번 리서치 중 발견한 정합성 이슈(범위 밖, 보고만)

1. **Pretendard CDN 로드**(`index.html`) → 오프라인 우선 위반. 5번 항목대로 자가호스팅.
2. **규칙 문서 stale**: `RULES.md`/`CLAUDE.md`가 Next.js·TypeScript·Tailwind·shadcn·Supabase·Vercel 표기 — 실제 스택(바닐라 ES 모듈 + Three.js vendored + localStorage + Jest)과 불일치. 규칙 SoT 갱신 필요.
3. **Vercel Hobby 비상업 조항** — 상업 출시 목표와 충돌. Cloudflare Pages로.
4. **폐기 도구 회피**: `@squoosh/cli`(2023 폐기), `FBX2glTF`(아카이브) — 각각 sharp, Blender/Quaternius 직행으로 대체.

## 부록 C — 출처(주요)

- Three.js 설치/importmap: https://threejs.org/docs/#manual/en/introduction/Installation · https://threejs.org/manual/
- glTF Transform: https://gltf-transform.dev/cli · https://github.com/donmccurdy/glTF-Transform
- Quaternius(CC0): https://quaternius.com/ · Poly Pizza: https://poly.pizza/
- Mixamo→glTF 논의: https://discourse.threejs.org/ (FBX 변환·리타게팅)
- Tauri vs Electron: https://tauri.app/ · https://www.electronjs.org/ · https://nwjs.io/
- Steam 래핑: https://github.com/ceifa/steamworks.js · https://github.com/greenheartgames/greenworks
- TWA/Bubblewrap: https://github.com/GoogleChromeLabs/bubblewrap · https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- Capacitor: https://capacitorjs.com/
- 무료 LLM 티어: https://ai.google.dev/ · https://groq.com/ · https://openrouter.ai/ · https://developers.cloudflare.com/workers-ai/
- 인브라우저 LLM: https://github.com/mlc-ai/web-llm · https://huggingface.co/docs/transformers.js · https://github.com/ngxson/wllama
- Playwright 시각회귀: https://playwright.dev/docs/test-snapshots
- 성능: https://github.com/GoogleChrome/lighthouse-ci · https://github.com/mrdoob/stats.js · https://spector.babylonjs.com/
- 이미지: https://sharp.pixelplumbing.com/ · https://squoosh.app/ · https://github.com/SalOne22/rimage
- 폰트 서브셋: https://fonttools.readthedocs.io/en/stable/subset/ · https://github.com/zachleat/glyphhanger · https://github.com/orioncactus/pretendard
- 오디오: https://ffmpeg.org/ · https://opus-codec.org/
- 호스팅: https://pages.cloudflare.com/ · https://pages.github.com/ · https://vercel.com/
- 분석: https://www.cloudflare.com/web-analytics/ · https://www.goatcounter.com/ · https://plausible.io/ · https://umami.is/
- 스토어 정책: https://developer.apple.com/app-store/review/guidelines/ · https://partner.steamgames.com/doc/home
