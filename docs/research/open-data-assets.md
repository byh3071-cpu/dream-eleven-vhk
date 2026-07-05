# 오픈 데이터 & 무료 에셋 리서치

> 목적: **오픈소스 축구 데이터 + 무료 게임 에셋**을 스팀 출시 기준으로 정리.
> 우리 제약: **런타임 npm 의존성 0**(정적 vendored만, Three.js r185 예외) · 순수 ES 모듈 · localStorage · **팀/선수/리그명은 가상 창작**(실 도시명만 사용) · 스팀/앱스토어 출시.
> 작성: 2026-07-05 · 근거: 각 행의 출처 URL(1차 소스 우선 검증).

---

## 결론 (두괄식)

- **라이선스 안전 등급**: `CC0/퍼블릭도메인` > `MIT·ISC·BSD·Apache-2.0·SIL OFL` > `CC-BY`(크레딧 필수) > **`CC-BY-NC·비상업·독자약관·스크레이핑` = 금지**.
- **축구 데이터는 전부 실명** → 우리 가상 원칙과 충돌. **데이터/파생물을 게임에 번들하지 않는다.** 리그 수·승격강등·일정 포맷·포지션 분포 같은 **구조만 개발 참고**. 이 중 **openfootball(CC0)만** 구조 참고로 안전, **StatsBomb은 비상업 → 학습 참고만**.
- **3D 코어 파이프라인 권장**: **Mixamo**(무료·상업OK, 애니메이션) + **Quaternius·Kenney·Poly Haven·ambientCG**(전부 CC0) → glTF로 구워서 `assets/vendor` 정적 내장. **Synty는 유료**(구매 시 상업 가능, 지금은 참고).
- **가상 선수 이름**: **sigpwned/popular-names-by-country(CC0, JSON)** = 국가별 이름·성 풀. 이걸 시드 재조합해 가상 선수 생성. **philipperemy/name-dataset(페북 유출 소스)·Behind the Name(ToS)은 금지**.
- **즉시 조치 2건(코드베이스에서 발견)**: ① Pretendard가 **CDN 로드**(`index.html:15`) → 오프라인/스팀 패키징 위배, **self-host(vendored woff2)로 전환**. ② game-icons.net은 아직 미통합(플랜 문서만) — **통합 시 CC BY 3.0 크레딧 필수**.

---

## 1. 오픈소스 축구 데이터 — 실명이라 "참고용"만

> 원칙: 실제 선수/클럽명은 가상 원칙과 충돌. **셰이핑용 데이터는 절대 번들 금지.** 아래는 "구조·도시·포지션 분포를 개발 중 참고"하는 용도만.

| 출처 | 무엇을 | 라이선스 | 상업 가능 | 우리 사용 적합성 |
|---|---|---|---|---|
| [openfootball](https://github.com/openfootball) (github) | 리그/클럽/시즌/경기 일정 **구조**, 스타디움·도시, `clubs.db` | **CC0-1.0**(퍼블릭도메인) | O (무제한) | **가장 안전.** 리그 구조·승격강등·일정 포맷·도시명 참고 최적. 실 클럽명은 가상화. CC0라 기술적 번들도 가능하나 클럽명은 리네임. |
| [StatsBomb Open Data](https://github.com/statsbomb/open-data) | 이벤트·포지션·xG·**360 트래킹**(일부 대회) | **독자 "StatsBomb Public Data User Agreement"** — 크레딧+로고, **공개·비상업 용도**(주의: 아래) | **X (비상업)** | 포지션/이벤트 분포·전술 히트맵을 **개발 학습 참고만**. 데이터·파생 번들 금지. |
| [football-data.org](https://www.football-data.org/) | 경기·결과·순위표 (REST API) | 무료티어 = **비상업 + 크레딧**("Football data provided by the Football-Data.org API"), 상업은 유료 | 유료 플랜만 | **안 씀.** 실명 + **런타임 API 호출은 npm0/오프라인/결정론 원칙 위배**. |
| [Kaggle: European Soccer Database](https://www.kaggle.com/datasets/hugomathien/soccer) (H. Mathien) | 25k+ 경기, 선수/팀 속성(FIFA 파생) | ODbL 태그지만 **제작자가 "상업 사용 금지" 명시** | **X** | **금지.** 태그만 믿지 말 것 — 제작자 문구가 우선. |
| Kaggle FIFA/**sofifa 파생** 데이터셋 다수 | 선수 능력치(0–99) | 대부분 **sofifa 스크레이핑** → 원본 ToS 위반 소지, 라이선스 불명 | **X (위험)** | 능력치 **분포의 감**만 참고. 값/이름 번들 금지. |

**StatsBomb 주의(정확도)**: 위 "비상업" 특성은 GitHub의 실제 `LICENSE.pdf` 본문이 아니라 **2차 요약(검색·커뮤니티) 기반**이다. 실제로 의존하기 전 [LICENSE.pdf](https://github.com/statsbomb/open-data) 원문을 직접 확인할 것. 다만 **결론은 원문과 무관하게 동일**: 실명 데이터라 우리는 어차피 번들하지 않고 개발 참고만 → 보수적으로 "비상업·크레딧" 취급이 안전.

**데이터 결론**: 실제로 게임에 넣을 데이터는 **openfootball(CC0)의 리그/일정 구조**를 참고해 **우리가 가상 리그/클럽/도시 배치로 재구성**하는 것. 나머지는 개발 중 눈으로만 보는 참고 자료.

---

## 2. 무료 3D 캐릭터/스타디움 에셋 — glTF 파이프라인

> 파이프라인: 소스 → (필요 시 Blender에서 glTF/`.glb` 변환·최적화) → `assets/vendor`/`assets/models`에 **정적 내장** → Three.js r185 `GLTFLoader`. 런타임 다운로드 없음(오프라인).

| 출처 | 무엇을 | 라이선스 | 상업 가능 | 크레딧 | 우리 사용 적합성 |
|---|---|---|---|---|---|
| [Mixamo](https://www.mixamo.com/) (Adobe) | **리깅 캐릭터 + 애니메이션**(달리기·슈팅·세리머니 등) | Adobe 무료 서비스, **로열티프리** | **O** (개인·상업·비영리) | **불필요** | **선수 애니메이션 코어.** raw FBX/캐릭터 **단독 재배포 금지** → **glTF로 구워 게임 내장은 허용**("프로젝트에 통합"). Adobe 계정 필요. |
| [Quaternius](https://quaternius.com/) | 로우폴리 **캐릭터/애니멀/환경**, 애니 포함 | **CC0-1.0** | **O** | **불필요**(감사 표기 환영) | **vendored 완벽.** 관중/선수/오브젝트 로우폴리. Patreon 있음(선택). |
| [Kenney](https://kenney.nl/) | **40k+** 3D/오디오/아이콘/UI/폰트 (Sports·Mini Characters 등) | **CC0** | **O** | **불필요**(로고는 사용 금지) | **vendored 완벽.** 필드 오브젝트·미니 캐릭터·UI·SFX 등 만능. |
| [Poly Haven](https://polyhaven.com/) | **HDRI**·PBR 텍스처·3D 모델 | **CC0** | **O** | **불필요** | 스타디움 **조명(HDRI)** + 잔디/콘크리트/금속 텍스처. |
| [ambientCG](https://ambientcg.com/) | 2000+ **PBR 텍스처**·HDRI·모델 | **CC0** | **O** | **불필요** | 잔디·관중석·광고판·트랙 텍스처. |
| [Sketchfab](https://sketchfab.com/) (→ Fab/Epic) | 유저 업로드 3D 모델 | **모델별 CC**(대부분 CC-BY=크레딧, 일부 CC0) | 대부분 O | CC0만 불필요 | **CC0 필터 후 개별 라이선스 확인.** 스타디움 단품 모델 등. |
| [poly.pizza](https://poly.pizza/) | 로우폴리 모델(구 Google Poly 아카이브 포함) | **모델별** CC-BY 3.0(다수) 또는 CC0 | O | CC-BY는 필수 | [CC0 필터](https://poly.pizza/search/CC0) 사용 시 무크레딧. 그 외 크레딧 관리 필요. |
| [Synty POLYGON](https://syntystore.com/) | 스타일라이즈 캐릭터/**스타디움/군중 팩** | **유료 EULA**(일회 구매 or 구독), 로열티프리 | 구매 시 **O** | 불필요 | **지금은 참고**(유료). 구매 시 스팀 출시 OK. **소스 에셋 재판매 금지**, 편집은 허용. **NFT/블록체인/메타버스/AI 학습 데이터셋 금지.** 게임 판매 시 라이선스 양도 가능. |

**3D 결론**: **Mixamo(애니) + Quaternius/Kenney(CC0 메시)** 로 선수·관중을, **Poly Haven/ambientCG(CC0)** 로 스타디움 환경·조명·텍스처를 구성 → 전부 glTF/텍스처로 구워 정적 내장. 스타일 통일 원하고 예산 되면 **Synty 구매**가 지름길(상업 안전).

---

## 3. 무료 사운드

> 현행: 이미 Freesound CC0 사운드를 가공해 `assets/audio/*.mp3`로 내장 중(`docs/CREDITS.md` 참조).

| 출처 | 무엇을 | 라이선스 | 상업 가능 | 크레딧 | 우리 사용 적합성 |
|---|---|---|---|---|---|
| [Freesound.org](https://freesound.org/) | 관중 함성·휘슬·킥·앰비언스 | **사운드별**: CC0 / CC-BY / **CC-BY-NC** | CC0·CC-BY만 O, **NC 금지** | CC0 불필요 / CC-BY 필수 | **이미 사용(CC0).** 검색 시 **라이선스 필터**로 CC0(무크레딧) 또는 "Free Cultural Works"(=CC0+CC-BY)만 노출. **NC는 상업 출시 불가**. |
| [Kenney Audio](https://kenney.nl/assets?q=audio) | UI/임팩트/디지털 SFX | **CC0** | **O** | 불필요 | vendored. UI 클릭·전환·알림음. |
| [OpenGameArt.org](https://opengameart.org/) | 혼합 사운드/음악 | **에셋별**(CC0/CC-BY/CC-BY-SA/GPL) | 개별 확인 | 라이선스별 | **CC0만 무조건 안전.** GPL/CC-BY-SA는 카피레프트 주의. |

**사운드 결론**: 현행 **Freesound CC0 유지**가 최선. 추가 SFX는 Kenney Audio(CC0). CC-BY-NC와 GPL/SA는 피한다.

---

## 4. 무료 아이콘 / 폰트

### 아이콘

| 출처 | 무엇을 | 라이선스 | 상업 | 크레딧 | 우리 사용 |
|---|---|---|---|---|---|
| [Lucide](https://lucide.dev/) *(사용중)* | UI 아이콘 | **ISC** | O | **불필요** | 서브셋 인라인(`src/ui/components/icons.js`). 이상적. |
| [game-icons.net](https://game-icons.net/) *(플랜)* | 게임 아이콘(축구·카드·능력) | **CC BY 3.0** | O | **필수** | **통합 시 크레딧 의무.** 아래 §6 체크리스트 참고. |
| [Kenney Game Icons](https://kenney.nl/assets/game-icons) | UI/게임패드/보드 | **CC0** | O | 불필요 | game-icons 대체 무크레딧 옵션. |
| [Tabler Icons](https://tabler.io/icons) | UI 아이콘(5000+) | **MIT** | O | 불필요 | vendored 서브셋. |
| [Phosphor Icons](https://phosphoricons.com/) | UI 아이콘 | **MIT** | O | 불필요 | vendored 서브셋. |
| [Material Symbols](https://fonts.google.com/icons) | UI 아이콘 | **Apache-2.0** | O | 불필요 | vendored 서브셋. |

### 폰트

| 출처 | 무엇을 | 라이선스 | 상업/임베드 | 우리 사용 |
|---|---|---|---|---|
| [Pretendard](https://github.com/orioncactus/pretendard) *(사용중)* | 한글+라틴 본문 | **SIL OFL 1.1** | O (게임 임베드 O) | **⚠ 현재 CDN 로드**(`index.html:15`) → **self-host(woff2 vendored)로 전환 필요**(오프라인/스팀). OFL이라 vendoring 합법. |
| [Google Fonts](https://fonts.google.com/) | 다국어 본문/헤드라인 | 대부분 **SIL OFL** 일부 **Apache-2.0** | O (임베드 O) | Inter·Oswald·Bebas Neue·Barlow·Rajdhani(스포츠 헤드라인) 등. **woff2 정적 내장**. |
| [Noto Sans/Sans KR/CJK](https://fonts.google.com/noto) | 다국어(CJK 포함) | **SIL OFL 1.1** | O | 39개국 세계관 다국어 폴백. 서브셋(`unicode-range`). |

**OFL 주의(스팀)**: OFL 폰트는 **게임 내 임베드/번들 허용**, 단 **① 폰트 파일을 단독 유료 판매 금지**, **② "예약 폰트 이름(Reserved Font Name)"이 있으면 개조판은 리네임**. 게임에 넣는 것은 전부 허용이라 실무상 문제 없음. **자체 호스팅(vendored)** 이 우리 원칙(npm0/오프라인)과 정합 — CDN 링크(`fonts.googleapis.com` 포함) 금지.

---

## 5. 무료 이름 생성 소스 — 가상 선수 생성용

> **⚠ 해석 전제(먼저 합의 필요)**: 이 섹션은 **"실존 인기 이름 풀을 국가별로 모아 이름+성을 재조합 → 특정 실존 인물이 아닌 가상 선수 생성"** 을 우리 가상 원칙에 부합하는 것으로 보고 추천한다. (FM 리젠, 여느 축구게임과 동일한 방식. "실 도시명만 사용" 카브아웃도 실세계 유래 **일반명**은 OK, 실 **정체성**만 금지라는 신호.)
> 만약 의도가 **완전 창작/합성 이름(실명 리스트 자체를 안 씀)** 이라면 이 섹션 추천은 달라진다 → **사람이 명시적으로 선택할 것.** 어느 쪽이든 **유명인 동명이인 회피(dedup) 로직**은 권장.

| 출처 | 무엇을 | 라이선스 | 상업 | 우리 사용 적합성 |
|---|---|---|---|---|
| [sigpwned/popular-names-by-country-dataset](https://github.com/sigpwned/popular-names-by-country-dataset) | **이름 2,370(106개국) + 성 2,278(75개국)**, CSV/**JSON**/txt | **CC0** | O | **최적.** vendored JSON → 국가별 이름·성 풀 재조합. 출처=Wikipedia 인기명 리스트(2023-07). 풀은 실명이나 **조합은 특정 실존인 아님** → 가상 원칙 부합. |
| [ozdemirburak/full-name-generator](https://github.com/ozdemirburak/full-name-generator) | 25개국 **정부 통계** 이름/성 | **코드 MIT + 데이터는 각국 오픈데이터**(출처표기 조건 다수) | O | 데이터 **출처별 라이선스 개별 확인**. sigpwned 보완용. |
| [faker (faker-js) locale 데이터](https://github.com/faker-js/faker) | 다국어 이름 배열(`first_name`/`last_name`) | **MIT** | O | **JSON 데이터만 추출해 vendored**(런타임 npm 아님 → 원칙 OK). 로케일 다양. |
| [GeoNames](https://www.geonames.org/) | **실 도시명**(인구·좌표) | **CC BY 4.0** | O | 실 도시명은 우리 원칙 허용. 도시 풀 생성용. **크레딧 필수**(§6). |
| ~~[philipperemy/name-dataset](https://github.com/philipperemy/name-dataset)~~ | 방대한 이름 DB | 소스가 **Facebook 유출** | — | **금지.** 프라이버시/법적 리스크. |
| ~~[Behind the Name](https://www.behindthename.com/)~~ | 이름 어원/국가별 | **ToS: 대량사용·스크레이핑 금지** | — | **금지(자동 수집).** 어원 개념 참고만. |

**이름 결론**: **sigpwned(CC0) JSON**을 `assets/data/names/`에 vendored → 국가별 풀에서 **결정론 시드**로 이름+성 조합해 가상 선수 생성(genVersion 동결과 정합). 부족한 국가는 faker(MIT) 데이터로 보완. 도시는 GeoNames(CC BY, 크레딧).

---

## 6. 스팀 출시 라이선스 체크리스트 (액션)

### 등급별 취급

| 라이선스 | 스팀 안전 | 의무 | 예 |
|---|---|---|---|
| **CC0 / 퍼블릭도메인** | ✅ 무조건 | 없음(크레딧 불필요) | openfootball, Quaternius, Kenney, Poly Haven, ambientCG, sigpwned names, CC0 Freesound |
| **MIT / ISC / BSD** | ✅ | **라이선스 텍스트 동봉** | Three.js(MIT), Lucide(ISC), flag-icons(MIT), Tabler/Phosphor(MIT), faker 데이터(MIT) |
| **Apache-2.0** | ✅ | 라이선스+NOTICE 동봉 | Material Symbols |
| **SIL OFL 1.1** | ✅ | 임베드 OK, 파일 단독판매 금지, 예약명 리네임 | Pretendard, Google/Noto 폰트 |
| **CC-BY (3.0/4.0)** | ✅ | **크레딧 필수(게임 내 표기)** | **game-icons.net**, **GeoNames**, CC-BY Freesound, poly.pizza CC-BY 모델 |
| **CC-BY-SA** | ⚠ | 크레딧 + 파생물 동일 라이선스(카피레프트) | 일부 OGA — 에셋 개조 시 전염 주의(게임 **코드**엔 영향 없음) |
| **CC-BY-NC / 비상업 / 독자약관** | ❌ | 상업 출시 불가 | StatsBomb, Kaggle Mathien, CC-NC Freesound, football-data.org 무료티어 |
| **스크레이핑 데이터**(sofifa 등) | ❌ | ToS 위반 소지 | FIFA 능력치 파생 |
| **Mixamo / Synty**(특수) | ✅(조건) | 프로젝트 내장 OK, **raw 재배포 금지** | 캐릭터·애니 |

### "게임 내 크레딧 필수" 목록 — `docs/CREDITS.md`와 대조

현재 `docs/CREDITS.md`는 **사운드(CC0)·Lucide(ISC)·Three.js(MIT)** 기재, `assets/flags/CREDITS.md`는 flag-icons(MIT) 기재. 아래는 **채택 시 추가로 크레딧이 필요**한 항목:

- [ ] **game-icons.net (CC BY 3.0)** — 플랜(`goals/5-ui-integration.md`)엔 있으나 **`docs/CREDITS.md`·`assets/icons/CREDITS.md`에 없음**. 통합하면 **작가별 크레딧 필수**. (무크레딧 원하면 Kenney/Tabler로 대체.)
- [ ] **Pretendard (OFL)** — CREDITS 미기재 + **CDN 로드 중** → self-host 전환 + 크레딧 표기(예의). OFL 라이선스 텍스트 동봉.
- [ ] **GeoNames (CC BY 4.0)** — 도시 데이터 쓰면 크레딧 필수.
- [ ] **Google/Noto 폰트(OFL)** — 쓰면 라이선스 텍스트 동봉.
- [ ] **flag-icons(MIT)** — 이미 기재 O(라이선스 텍스트 동봉 확인).
- [ ] **Mixamo** — 크레딧 불필요하나 **raw FBX/캐릭터를 배포 파일에 노출 금지**(구운 glTF만).

### 즉시 조치 (원칙 위배 발견)

1. **Pretendard CDN → self-host**: `index.html:15`의 `cdn.jsdelivr.net` 링크 제거, `assets/fonts/pretendard-*.woff2` vendored + `@font-face`. 사유: 오프라인/결정론·스팀 패키징·npm0(외부 런타임 의존 제거).
2. **game-icons 통합 시 크레딧 파이프라인**: `assets/icons/CREDITS.md` 생성 규칙(플랜에 이미 명시) 준수, 아니면 CC0(Kenney) 대체.

---

## 부록 — 소스 URL 요약

- 축구 데이터: openfootball(github.com/openfootball, CC0) · StatsBomb(github.com/statsbomb/open-data) · football-data.org · Kaggle
- 3D: mixamo.com · quaternius.com · kenney.nl · polyhaven.com · ambientcg.com · sketchfab.com · poly.pizza · syntystore.com
- 사운드: freesound.org · kenney.nl · opengameart.org
- 아이콘/폰트: lucide.dev · game-icons.net · tabler.io/icons · phosphoricons.com · fonts.google.com · github.com/orioncactus/pretendard
- 이름: github.com/sigpwned/popular-names-by-country-dataset(CC0) · github.com/ozdemirburak/full-name-generator · github.com/faker-js/faker · geonames.org
