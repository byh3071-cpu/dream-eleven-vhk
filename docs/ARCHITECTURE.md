# Architecture — dream-eleven-vhk

> 기술 정본. "어떻게 만드는가"를 담는다. 제품 의도는 docs/PRD.md, 설계 결정 근거·ADR은
> docs/DESIGN.md, 월드 리그 실행은 docs/world/WORLD-ROADMAP.md 참조.

## 설계 철학 (불변식)

1. **의존성 0** — 런타임 npm 의존성 0(devDep에 eslint/jest만). 프레임워크·번들러·게임엔진 없음.
   순수 ES 모듈. 형제 프로젝트 관례 계승. Three.js는 vendored 정적 파일(런타임 fetch 아님).
2. **사전계산 후 리플레이(Precompute-then-Replay)** — 경기는 순수 함수가 이벤트 로그로 미리
   계산하고, 렌더러는 그 로그를 "재생"만. 실시간 조작·상대 AI 없음(양 팀 사전 구성).
3. **결정론** — 같은 세이브·같은 시드 = 같은 결과. `deriveSeed`로 시드를 네임스페이스 파생.
   재현·리플레이·공유 가능.
4. **오프라인 완결** — localStorage만. 서버·계정·백엔드 없음. AI는 선택적 향신료 레이어(격리).
5. **재작성 방지** — 파생 수식/생성 로직 변경이 과거 세계를 소급 붕괴하지 않게 버전 동결·additive
   확장(아래 원칙 + DESIGN.md ADR).

## 핵심 아키텍처: 사전계산 후 리플레이

`simulateMatch(teamA, teamB, seed)`(src/sim/engine.js)는 DOM을 전혀 모르는 순수 함수로, 90분
경기 전체를 **이벤트 로그**로 계산해 반환한다. 렌더러(2D DOM / 3D Three.js)와 텍스트 중계는
이 로그를 공통 인터페이스로 재생만 한다. 이 계약 덕분에 렌더링 기술을 바꿔도 엔진은 안 건드린다.

```
스쿼드·전술·시드 ──▶ simulateMatch() ──▶ MatchEvent[] ──┬──▶ PitchBackend(2D/3D) 재생
   (입력)            (순수·결정론)         (유일 출력)      └──▶ 커멘터리·사운드 재생
```

## 렌더 추상화: PitchBackend

2D(DOM)와 3D(Three.js)가 **동일 인터페이스**(initPitch/renderEvent 계열)로 교체된다. 엔진·
컨트롤러·데이터는 비주얼을 전혀 모른다. 3D 내부 캐릭터는 (1)CharacterFactory (2)모션 파라미터
(locomotion/kick/celebrate "의도"만) (3)앵커(footPos/headTop) 뒤로 격리 → glTF/Synty/외주/AI
에셋으로 **부품 갈이**가 가능(Epic 4 비주얼 마감 대비, DESIGN.md ADR).

## 폴더 구조 (실제)

```
dream-eleven-vhk/
├── index.html                     # SPA 셸
├── package.json                   # "type":"module", 런타임 deps 0
├── css/                           # tokens.css(색 토큰 단일 소스) + components/화면별
├── src/
│   ├── main.js, router.js, routes.js, routeMatcher.js   # 해시 라우터 SPA
│   ├── sim/                       # ★ 결정론 엔진 — DOM 의존 0, 전부 Jest 대상
│   │   ├── engine.js              # simulateMatch (사전계산 진입점)
│   │   ├── possession.js, duel.js, setpieces.js, zones.js, teamStrength.js
│   │   ├── stamina.js, traits.js, tactics-modifiers.js, playerRatings.js
│   │   ├── commentary.js, rng.js(deriveSeed), tunables.js, event-types.js
│   ├── career/                    # 커리어 모드 — 세이브·리그·경영·서사
│   │   ├── store.js, persistence.js(마이그레이션), clubs.js, schedule.js, draft.js
│   │   ├── finance.js, transfers.js, value.js, matchRunner.js, aiLineup.js
│   │   ├── youthGen.js, development.js, players.js(리졸버), playerState.js
│   │   ├── awards.js, narrative.js, press.js, story.js, records.js, retirement.js
│   │   ├── table.js, fillerPlayers.js
│   ├── world/                     # ★ 월드 리그 — additive 신규(커리어·IF 별도)
│   │   ├── leagues.js             # 무제한 나라 = 리그를 데이터로
│   │   └── data/korea.js          # 플래그십 구단 데이터(hex = 콘텐츠, designLint 예외)
│   ├── data/                      # 정적 데이터
│   │   ├── players.db.js, player-schema.js, formations.js
│   └── ui/                        # 렌더·화면 — 테스트 범위 밖
│       ├── screens/               # home, career, match, result, squadBuilder, tactics, styleguide
│       ├── components/            # icons, pitchLines, playerBadge, playerCard
│       ├── squadEditor/           # model, view
│       ├── pitchRenderer.dom.js   # PitchBackend 2D
│       ├── pitchRenderer.three.js # PitchBackend 3D (Three.js)
│       ├── matchPlayback.js, ballFlight.js, steering.js, pitchOverlayFx.js
│       └── soundManager.js, tacticsControls.js, rendererPref.js, tokensParser.js
├── scripts/                       # 검증 게이트 + 튜닝 (아래)
├── tests/                         # Jest (sim 단위 + 몬테카를로 + designLint + 데이터 검증)
└── docs/                          # PRD, ARCHITECTURE, DESIGN, world/, ROADMAP-V3, CREDITS
```

## 데이터 모델

| 계층 | 엔티티 | 설명 |
|---|---|---|
| **정적** | Player(players.db) | id·name·era·positions[]·6각 스탯·traits[] |
| | Formation / Tactics | 슬롯 좌표(0~100) / 멘탈리티·압박·템포·폭 |
| **엔진 출력** | MatchEvent | minute·type·team·zoneFrom/To·actorId — 렌더러/커멘터리 공통 입력 |
| **커리어 세이브** | Save | 로스터·예산·계약·유스·이력·순위·시즌 상태(localStorage) |
| **월드(신규)** | League / Club | leagues.js 배열(팀수·rounds·타이브레이크·규칙) / 구단 데이터 |

**파생 vs 저장** — aging/youth/retire는 순수 `f(base, season, seed)`(development.js)라 구단이
수백 개여도 **저장 비용 0**(로드 시 재계산). 경로의존 상태(경기로 키운 '나')만 저장 예외
(youthPlayers 선례 + frozen 플래그 계획).

## 결정론 시스템

- **deriveSeed**(sim/rng.js) — 마스터 시드에서 네임스페이스 파생. 다국가·다리그로 확장 시
  `deriveSeed(deriveSeed(master, nation), league)…` **튜플 체이닝**으로 범위 충돌 방지.
- **genVersion / frozen**(계획, DESIGN.md ADR) — 생성 수식은 로드마다 재계산이라 수식 변경이
  과거 세계를 소급 붕괴 → 세이브에 버전 필드로 동결. 파생 분기 시 **같은 커밋에 가드 필드**.
- **타이브레이크 최종키** — 실제 규칙의 추첨·중립 PO는 결정론과 모순 → 시드/id 고정 순서로 치환.

## 세이브 / 마이그레이션

- persistence.js `MIGRATIONS` **append 패턴** + `SCHEMA_VERSION`. 구 세이브 로드 시 순차 변환.
- 월드는 **신규 세이브 타입**(additive) — 4팀 커리어→84팀 마이그레이션을 통째 회피, 돌아가는
  커리어·IF 보호. 신규 세이브는 태생부터 genVersion 보유.
- 엔진/데이터 변경 시 **마이그레이션 왕복**(구 세이브 로드) + **genVersion 동결로 과거 세계
  불변** 확인이 필수 게이트.

## AI 레이어 (하이브리드)

| 레이어 | 성격 | 위치 |
|---|---|---|
| 코어(sim/career/world) | 오프라인·결정론 **불변** | 의존성 0 유지 |
| AI 향신료(선택) | 온라인, 켜고 끄기, 폴백 필수 | IF 편성·기자회견·협상·중계 |

AI는 코어 밖 격리 레이어. 없으면 템플릿 폴백으로 게임 완결. 결정론·오프라인 불변식을 침범 못 함.

## 검증 게이트 (하드 게이트 — 걸리면 커밋 불가)

| 게이트 | 대상 |
|---|---|
| `npm test` (Jest 305+) | sim 순수함수 + 몬테카를로(평균 2.5~3.0골·강팀 60~75%) + designLint + 데이터 검증 |
| `eslint .` | 린트 |
| verify-anti-float(.mjs) / -3d | held 불변식(held 볼 = 보유자 좌표) 2D·3D |
| verify-jitter | 진동(부르르 떨림) median 게이트 |
| verify-narrative / verify-youth-growth | 서사·유스 성장 회귀 |
| tune-finance / tune-v2 | 재정·엔진 밸런스 튜닝 |
| check-goal-N | goal별 완료 조건 |

## 배포

- 개발: `npx serve . -l 5500`(ES 모듈은 file://로 안 열림).
- 정적 배포(Vercel/GitHub Pages) → 출시 시 PWA(오프라인 캐시) → 스팀(래핑)·모바일.
- 순수 정적 사이트라 서버·DB 불필요(AI 향신료만 선택적 외부 호출).

## 재작성 방지 원칙 (요약 — 상세 DESIGN.md ADR)

1. 파생 수식/stateful producer 분기는 **같은 커밋에 가드 필드**(genVersion/frozen). 미리 심지 말 것.
2. 영구 ID는 네임스페이스 할당자(`youth_`/`gen_`/`me_`…), 세이브 상주 단조 카운터.
3. deriveSeed 튜플 체이닝으로 시드 범위 격리.
4. 렌더 추상화 3경계로 비주얼 교체 대비.
5. 신규 대형 시스템은 교체가 아니라 **additive**(월드 모듈이 선례).
