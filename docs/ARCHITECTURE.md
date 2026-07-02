# Architecture — dream-eleven-vhk

## 기술 스택
- 프레임워크/게임엔진 없음 (바닐라 JavaScript, ES 모듈, 번들러 없음) — 형제 프로젝트(hamster-damagochi, haruchi-game) 관례 계승
- Phaser/PixiJS는 의도적으로 배제: 상대 AI가 없고 "사전계산 후 재생(precompute-then-replay)" 구조라 게임엔진의 핵심 가치(물리/씬그래프)가 거의 안 쓰임
- 로컬 개발: `npx serve . -l 5500` (ES 모듈은 `file://`로 안 열림)
- 테스트: Jest — `src/sim/`(엔진) 순수 함수만 대상, DOM/렌더링은 테스트 범위 밖
- 저장: localStorage만 (서버/백엔드 없음)
- 배포: Vercel 정적 배포 또는 GitHub Pages

## 핵심 아키텍처: 사전계산 후 리플레이 (Precompute-then-Replay)
`simulateMatch(teamA, teamB, seed)`는 DOM을 전혀 모르는 순수 함수로, 90분 경기 전체를 이벤트 로그로 미리 계산해서 반환한다. 렌더러(v1: DOM, 업그레이드: Canvas)와 텍스트 중계는 이 로그를 `initPitch()`/`renderEvent(evt)` 인터페이스로 "재생"만 한다. 이 계약 덕분에 렌더링 기술을 나중에 바꿔도 엔진 코드는 안 건드려도 된다.

## 폴더 구조
```
dream-eleven-vhk/
├── index.html                 # SPA 셸
├── package.json                # "type": "module"
├── eslint.config.js / vercel.json
├── css/                          # squad-builder, tactics, match-view 등
├── src/
│   ├── main.js, router.js        # 해시 라우터 (#/squad/home, #/tactics/away, #/match, #/result)
│   ├── state/                     # store.js, persistence.js (localStorage)
│   ├── data/                      # player-schema.js, players.db.js, formations.js, tactics-presets.js
│   ├── sim/                       # engine.js, zones.js, possession.js, duel.js, shooting.js,
│   │                               # stamina.js, traits.js, tactics-modifiers.js, rng.js, commentary.js
│   │                               # ← DOM 의존 0, 전부 Jest로 단위 테스트
│   ├── ui/
│   │   ├── screens/                # squad-builder, tactics, match-view, result
│   │   ├── components/             # player-card 등
│   │   ├── pitchRenderer.dom.js    # v1 렌더러
│   │   └── pitchRenderer.canvas.js # 업그레이드 렌더러(스트레치) — 동일 인터페이스로 교체만
│   └── utils/                      # random.js(mulberry32 시드 RNG), sleep.js
├── assets/avatars/                 # 이니셜/실루엣 뱃지 (실사진 없음)
├── assets/icons/                   # game-icons.net에서 선별, CREDITS.md에 출처 표기
└── tests/
    ├── sim/                        # duel, possession, engine.montecarlo (검증 게이트)
    └── data/players.validate.test.js
```

## 데이터 모델
| 엔티티 | 핵심 필드 | 설명 |
|--------|----------|------|
| Player | id, name, era(legend/active), positions[], stats{pace,shooting,passing,dribbling,defending,physical}, traits[] | 12개 포지션 분류(GK/CB/LB/RB/DM/CM/AM/LM/RM/LW/RW/ST), FIFA식 6각 표시 스탯 |
| Formation | id, label, slots[{role,x,y}] (11개, 정규화 좌표 0~100) | 프리셋 5~7종 + 슬롯 미세조정 |
| Tactics | formationId, mentality, pressing, tempo, width | 팀별 감독 지침, 계산식에 직접 반영 |
| Squad | teamName, formationId, slots{slotIndex: playerId}, tactics | localStorage 저장 단위 |
| MatchEvent | minute, type, team, zoneFrom, zoneTo, actorId, assistId? | 시뮬레이션 엔진의 유일한 출력 — 렌더러/커멘터리의 공통 입력 |
| MatchResult | events[], score, stats | simulateMatch()의 반환값 |

## 외부 서비스
| 서비스 | 용도 |
|--------|------|
| (없음) | 서버/백엔드/DB 전부 불필요 — localStorage만으로 완결되는 순수 정적 사이트 |
| game-icons.net | 아이콘 소스 (CC-BY 3.0, 정적 SVG 다운로드, 런타임 의존성 아님) |
| Vercel 또는 GitHub Pages | 정적 배포 |
