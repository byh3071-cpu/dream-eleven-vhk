---
vhk_format: 1
type: research
title: 선수 능력치(어트리뷰트) 모델 벤치마킹 & 확장 방향
status: RESEARCH
---

# 선수 능력치(어트리뷰트) 모델 벤치마킹 & 확장 방향

> 축구 게임 3대 어트리뷰트 모델(FM / EA FC / eFootball)과 오픈소스 데이터 스키마를 벤치마킹하고,
> 우리 6스탯을 어떻게 확장할지 트레이드오프를 분석한다. **실제 선수의 실제 수치를 베끼지 않는다 —
> 모델·스키마·카테고리 구조만 벤치마킹**(라이선스 판단은 후속 에이전트). 구현 근거는 본문 5장.

## 0. 결론 (두괄식)

- **엔진을 슬라이스로 고도화하면서 능력치를 additive로 확장한다.** 순서는 항상 **"엔진 판정 심화 →
  그게 읽는 하위스탯 추가"**이고, 그 반대(스탯 먼저 깔기)나 FM 36개 빅뱅 이식이 아니다. 어디서부터
  뭘 정하며 개발하는지는 §8(결정 게이트 순서).
- **판단 축은 하나: "결정론 엔진이 실제로 소비(consume)하는 능력치인가?"** 엔진이 안 읽는 스탯은
  장식(`traits.js`/`player-schema.js`의 명시 원칙 "반영 위치 없는 특성/스탯 금지" 위반). 따라서
  **능력치 개수는 FM을 베끼는 게 아니라 엔진 판정점의 깊이가 정한다** — 현실 수렴은 6 → 10~15,
  36 아님(그 이상은 몬테카를로 밸런싱 표면 폭증 + 플레이어가 체감 못 하는 granularity).
- **"하드코어 시뮬" ≠ 슬라이더 개수.** FM이 하드코어인 건 매치 엔진이 36개를 **전부 소비**하기
  때문이다. 우리 하드코어함은 결정론 정밀도 + 엔진이 굴리는 깊이 + 서사(traits/press/story)에서 난다.
- **확장 사다리 (각 단 = 결정 1개 + 슬라이스 1개, 상세 §8):**
  1. **traits 확장** — 엔진 변경 0, 이미 Epic 2-2 예정. 제일 싼 깊이+드라마. **여기서 시작.**
  2. **엔진 판정 심화 + 하위스탯**(외과적 B2) — 세부가 진실, 표시 6은 롤업(헥사곤 불변). 슬라이스
     마다 마이그레이션 시드(부모에서) + genVersion 동결로 과거 세계 불변. 첫 파일럿: **공중볼(aerial)**.
  3. **반복** — 판정 하나 깊게 팔 때마다 하위스탯 하나. GK 전용 세트는 GK 판정 신설 후.
  - **안 하는 것:** 빅뱅 C(전면 36 교체) — 결정론 재현성·305+ 테스트·마이그레이션 동시 붕괴.

---

## 1. Football Manager(FM) 어트리뷰트 체계

**모델 요약:** 아웃필더 1명당 **36개** 세부 능력치를 **3범주**(Technical / Mental / Physical)로
나눈다. **1~20 스케일**. 골키퍼는 Technical 14개 대신 **Goalkeeping 세트**를 쓰고 Mental·Physical은
공유한다. 여기에 화면에 안 보이는 **히든/성격(personality) 어트리뷰트**가 별도로 붙는다.

| 범주 | 개수 | 항목 |
|---|---|---|
| **Technical** (아웃필드) | 14 | Corners, Crossing, Dribbling, Finishing, First Touch, Free Kick Taking, Heading, Long Shots, Long Throws, Marking, Passing, Penalty Taking, Tackling, Technique |
| **Mental** | 14 | Aggression, Anticipation, Bravery, Composure, Concentration, Decisions, Determination, Flair, Leadership, Off the Ball, Positioning, Teamwork, Vision, Work Rate |
| **Physical** | 8 | Acceleration, Agility, Balance, Jumping Reach, Natural Fitness, Pace, Stamina, Strength |
| **Goalkeeping** (GK가 Technical 대체) | 13 | Aerial Reach, Command of Area, Communication, Eccentricity, First Touch, Handling, Kicking, One On Ones, Passing, Punching(Tendency), Reflexes, Rushing Out(Tendency), Throwing |
| **히든/성격** (비표시) | 다수 | Consistency, Important Matches, Injury Proneness, Dirtiness, Versatility + 성격(Ambition, Loyalty, Professionalism, Pressure, Temperament 등) |

- **범주 역할:** Technical = 볼 다루는 기술(득점·패스·세트피스·수비 기술까지 여기 포함, 예:
  Tackling·Marking·Finishing). Mental = 지능·판단·기질(Vision·Composure·Decisions·Work Rate).
  Physical = 신체(Pace·Acceleration 분리, Stamina·Strength·Jumping Reach).
- **왜 세분화가 정당한가:** FM 매치 엔진이 이 36개를 **개별적으로 읽는다**. Composure는 압박 상황
  실책률, Off the Ball은 침투 타이밍, Concentration은 90분 집중 저하처럼 각 항이 판정식의 특정 항에
  물려 있다. **세분화의 값은 "엔진이 그만큼을 소비한다"에서 나온다** — 우리 판단 축과 정확히 동일.
- **드라마/성격 축:** 히든 어트리뷰트(Consistency·Important Matches·Injury Proneness)와 성격
  (Determination·Professionalism)이 "빅매치 사나이", "유리몸", "노력파" 같은 서사를 만든다. 우리
  `traits`가 겨냥하는 게 바로 이 층.

## 2. EA SPORTS FC / FIFA 체계

**모델 요약:** 카드에 **6대 스탯**(PAC·SHO·PAS·DRI·DEF·PHY)만 표시하지만, 그 뒤에 **~35개
세부 스탯**이 있고 **6대 스탯은 세부의 롤업(요약)**이다. **1~99 스케일**. 골키퍼는 6대 대신 **GK 전용
6스탯 카드**를 쓴다. OVR(종합)은 **포지션별 가중합**.

| 6대 face 스탯(표시) | 뒤에 있는 세부 스탯 |
|---|---|
| **Pace** | Acceleration, Sprint Speed |
| **Shooting** | Positioning(Att.), Finishing, Shot Power, Long Shots, Volleys, Penalties |
| **Passing** | Vision, Crossing, FK Accuracy, Short Passing, Long Passing, Curve |
| **Dribbling** | Agility, Balance, Reactions, Ball Control, Dribbling, Composure |
| **Defending** | Interceptions, Heading Accuracy, Defensive Awareness, Standing Tackle, Sliding Tackle |
| **Physical** | Jumping, Stamina, Strength, Aggression |
| **GK 카드(6, 아웃필드 6대 대체)** | GK Diving, GK Handling, GK Kicking, GK Reflexes, GK Positioning, (GK) Speed |

- **핵심 구조 = 롤업.** 진실은 세부 스탯이고, **face 6개는 그걸 가중평균한 표시값**. 예) 화면의
  Pace 90은 Acceleration/Sprint Speed의 롤업. → 이게 우리 옵션 **B2**의 원형(§6).
- **OVR 산출:** 포지션마다 계수 세트가 다르고 **계수 합 = 1**. 수비수는 Tackling·Interceptions·
  Def.Awareness 계수가 크고, 공격수는 Finishing·Positioning이 크다. + 국제 명성 보정. → 우리
  `teamStrength.js`의 `RATING_WEIGHTS`(포지션별 6스탯 가중)와 **같은 발상**. 우리가 이미 이 모델의
  축소판을 쓰고 있다.
- **개성 레이어:** Weak Foot(1~5★), Skill Moves(1~5★), **PlayStyles**(FC24+, 구버전 Traits) =
  "핀포인트 크로스", "파워 슛" 같은 이산적 특수능력. → 우리 `traits`의 직접 대응물.

## 3. eFootball / 기타 간단 비교

eFootball(구 PES/코나미)은 **FM과 FIFA의 중간** — 세부 스탯 ~30여 개를 펼쳐 보이되(FM처럼) 카테고리는
공격/수비/신체/GK로 넓게 묶고(FIFA처럼), Playing Styles + Player Skills로 개성을 이산화한다.

| 시스템 | 스케일 | 세부 개수 | 범주 | 표시 방식 | 개성 레이어 |
|---|---|---|---|---|---|
| **Football Manager** | 1~20 | ~36(+GK 13, +히든) | Technical/Mental/Physical | 세부 전부 노출 | 히든·성격 어트리뷰트 |
| **EA FC / FIFA** | 1~99 | ~35(+GK 6) | 6대 face 롤업 | face 6 요약(세부는 상세뷰) | PlayStyles, Weak Foot, Skill Moves |
| **eFootball** | ~40~99 | ~30(+GK 5) | 공격/수비/신체/GK | 세부 노출 + 종합 | Playing Styles, Player Skills, Form |
| **우리(현재)** | 1~99 | **6** | (범주 없음, 6평면) | 헥사곤 6축 | `traits`(엔진 훅) |

- eFootball 대표 세부: (공격) Offensive Awareness, Ball Control, Dribbling, Tight Possession,
  Low/Lofted Pass, Finishing, Heading, Set Piece Taking, Curl — (수비) Defensive Awareness,
  Tackling, Aggression, Defensive Engagement — (신체) Speed, Acceleration, Kicking Power,
  Jumping, Physical Contact, Balance, Stamina — (GK) GK Awareness, Catching, Parrying,
  Reflexes, Reach. + **Form(경기별 컨디션), Injury Resistance** 같은 시즌 드라마 축.
- **관찰:** 세 시스템 다 **연속 능력치(수치) + 이산 개성(스타일/특성)**의 2층 구조다. 우리도
  이미 6스탯(연속) + `traits`(이산)로 같은 2층이다. 차이는 연속층의 해상도(6 vs 30~36)뿐.

## 4. 오픈소스 축구 데이터의 능력치 스키마

> 라이선스는 **후속 항목 에이전트가 다룬다** — 여기선 **필드 구조(스키마)만** 정리.

**(a) SoFIFA 파생 Kaggle 데이터셋** (EA FC/FIFA 계열, 예: `stefanoleone992/…complete player dataset`,
FIFA 15→FC 26 연도별). CSV, **90~110 컬럼**. 구조는 `그룹_이름` 접두 네이밍:

| 그룹 | 대표 컬럼 |
|---|---|
| 메타/식별 | `sofifa_id`, `short_name`, `long_name`, `age`, `dob`, `height_cm`, `weight_kg`, `nationality`, `club_name`, `league_name` |
| 종합/가치 | `overall`, `potential`, `value_eur`, `wage_eur`, `international_reputation` |
| 포지션/발 | `player_positions`, `preferred_foot`, `weak_foot`, `skill_moves`, `work_rate`, `body_type` |
| 6대 face | `pace`, `shooting`, `passing`, `dribbling`, `defending`, `physic` |
| 세부(접두 그룹) | `attacking_*`(crossing/finishing/heading_accuracy/short_passing/volleys), `skill_*`(dribbling/curve/fk_accuracy/long_passing/ball_control), `movement_*`(acceleration/sprint_speed/agility/reactions/balance), `power_*`(shot_power/jumping/stamina/strength/long_shots), `mentality_*`(aggression/interceptions/positioning/vision/penalties/composure), `defending_*`(marking/standing_tackle/sliding_tackle), `goalkeeping_*`(diving/handling/kicking/positioning/reflexes/speed) |
| 포지션별 종합 | `ls, st, rs, lw, cf, … cb, lb, gk`(슬롯별 계산된 OVR) |
| 개성(문자열) | `player_traits`, `player_tags` |

- **시사점:** 이 스키마가 §2(EA FC)의 **롤업 구조를 그대로 직렬화**한 것 — face 6 + 접두 그룹별
  세부. 우리가 B2로 확장하면 데이터 모델이 이 업계 표준과 자연 정렬된다(향후 데이터 참조·검증 용이,
  단 수치는 안 베낌).

**(b) FM 데이터셋** (예: Kaggle "Football Manager 20xx" ~5만 명): 컬럼이 §1의 **1~20 어트리뷰트 +
성격/히든**을 그대로 펼침, `UID` 식별. 롤업 없이 세부가 곧 원본.

**(c) 대비 — 이벤트 데이터 ≠ 어트리뷰트 데이터:** StatsBomb Open Data, (구)Wyscout 공개분,
openfootball/football.json 등은 **측정된 경기 이벤트(패스·슈팅·xG)나 경기 결과/일정**이지 **디자이너가
매긴 능력치 등급이 아니다**. 우리가 벤치마킹하는 건 (a)(b)의 **디자이너 등급 스키마**. (이벤트→능력치
환산은 별개 파이프라인이고 우리 결정론·오프라인 불변식 밖.)

---

## 5. 우리 현재 모델 (확장 판단의 근거)

구현 사실(파일·심볼)로 고정. 확장 옵션이 여기 어디를 건드리는지가 트레이드오프의 실체.

| 지점 | 파일 | 6스탯 의존 방식 |
|---|---|---|
| 스키마·검증 | `data/player-schema.js` | `STAT_KEYS` 6개, 각 1~99 강제. `TRAIT_KEYS` 9개(전부 훅 연결). |
| 팀 전력 | `sim/teamStrength.js` | 라인별 가중식(`defending*0.5+physical*0.3+…`) + 포지션별 `RATING_WEIGHTS` 6스탯 가중. |
| 개인 종합 | `sim/teamStrength.js` `playerOverallRating` | 포지션 1순위의 6스탯 가중합 → 카드 숫자·헥사곤 근거. |
| 성장/쇠퇴 | `career/development.js` | `POSITION_CORE_STATS`(포지션별 주 2스탯) + `applyGrowthStep`. |
| 성장 배분 | `applyGrowthStep(stats, core, rng)` | **core 주스탯 +2(+60% +1), 나머지는 `Object.keys(next).filter(!core)`로 각 50% +1.** |
| 개성/드라마 | `sim/traits.js` `TRAIT_HOOKS` | `onShot/onDuel/onSetPiece/onStaminaDecay` 훅 → `*Mult`/`*Bonus` 병합. 엔진 판정식에 직접 물림. |
| UI | `ui/components/playerCard.js`, `playerBadge.js` | 6축 헥사곤 뱃지(사용자 5차 확정, 마크업 동결). |

**엔진이 이미 아는 하위 컨텍스트(중요):** `duel.js`/`traits.js`가 이미 `duelType`을 `aerial` /
`progression`으로, `role`을 `defend`로, `zoneBand`를 `BOX`로 구분한다. 즉 **엔진은 이미 "공중볼/전진/
수비/박스"를 안다.** 하위스탯을 여기 묶으면 진짜로 소비된다(장식 아님).

**벤치마크 대비 갭 — GK:** FM·FIFA·eFootball 다 **GK 전용 세트**를 둔다. 우리는 GK가 `defending`
스탯을 재사용(`teamStrength.js`: `gkRating = stats.defending * fit`, `RATING_WEIGHTS.GK =
defending*0.85+physical*0.15`). 별도 GK 스탯 없음 → 확장 논의에서 별도로 다룰 후보(§7).

---

## 6. 확장 옵션 트레이드오프

| 축 | **A. 6스탯 유지 + traits** | **B2. 하위세부(진실) → 6롤업(표시)** | **C. FM식 36개 세분화** |
|---|---|---|---|
| 저장 스키마 | 변경 0 | `stats`에 세부 필드 추가, `SCHEMA_VERSION`+1, 마이그레이션 1개 | 전면 교체(36키+GK세트) |
| 결정론 엔진 | 그대로 | face 롤업만 읽으면 무변경, 소비 시 판정식 확장 | 판정식 전면 재작성 |
| `applyGrowthStep` | 그대로 | 세부키는 `Object.keys(filter!core)`로 **자동 side +1**. 단 성장 **포커스**로 쓰려면 `POSITION_CORE_STATS` 확장 필요 | core 배분 로직 재설계 |
| 헥사곤 UI | 6축 유지 | **6축 유지(롤업)** + 선택적 상세뷰 | 6축 붕괴 → 범주 막대/표로 교체 |
| 마이그레이션/과거세계 | 리스크 0 | 세부를 부모에서 시드(pace90→acc90+spd90, 롤업 동일) → 과거 세계 불변 | genVersion 동결해도 대규모 검증 |
| 305+ 테스트 | 무영향 | 롤업 불변 테스트 추가 | 대량 재작성 |
| "하드코어+드라마" 적합 | 드라마↑(traits), 시뮬 깊이 = 훅 수 | 시뮬 깊이↑(조건부) | 최고 깊이지만 우리 엔진이 소비 못 하면 장식 |
| 구현 비용 | **낮음** | 중(외과적이면 소) | **높음(재작성)** |

### 옵션 A — 6스탯 유지 + `traits`로 개성

- **엔진:** 무변경. `TRAIT_HOOKS`가 이미 판정식에 물려 있어 특성 추가 = 배선 0(아바타가 `.traits`에
  push만 해도 6소비처 자동 발동, `PLAYER-MODE-DESIGN.md` 정찰표 확인).
- **성장(`applyGrowthStep`):** 무변경. 특성은 마일스톤 언락(선수 모드 2-2 슬라이스)으로 붙는다.
- **헥사곤:** 무변경.
- **평가:** 가장 싼 깊이. 단 **연속적 실력 차이의 해상도는 안 올라감**(공중볼 강함/약함을 특성
  on/off로만 표현, 중간값 없음). "하드코어"의 상한이 traits 개수에 걸린다.

### 옵션 B — 하위 세부 (B1은 기각, **B2 채택**)

두 개의 다른 "B"가 있고 **하나만 값이 있다:**

- **B1(기각): 6이 진실, 세부를 6에서 파생.** 세부가 새 정보를 0으로 담고 엔진이 얻는 것도 0 →
  **장식**(우리 명시 원칙 위반). 절대 안 함.
- **B2(채택): 세부가 진실, 6은 세부의 롤업.** §2 FIFA가 실제로 하는 방식. 헥사곤은 롤업된 6으로
  **그대로 유지**, OVR도 롤업 재계산. 마이그레이션은 세부를 부모 스탯에서 시드(레거시 pace90 →
  acceleration90+sprint90, 롤업 결과 동일 → **구 세이브 안전**), `SCHEMA_VERSION`+1.
  - **엔진:** 롤업 6만 읽으면 당장 무변경. **값은 조건부** — 엔진이 세부를 실제로 소비하고 + 나중에
    세부가 서로 갈라질 때(divergence)만 실현. 갈라지기 전엔 B2도 사실상 B1(장식)이므로, **반드시
    소비 지점과 함께 심는다.**
  - **성장:** 세부키는 `applyGrowthStep`의 side 루프가 자동으로 +1 굴려줌(공짜). 다만 특정 세부를
    성장 **포커스**(주 +2)로 만들려면 `POSITION_CORE_STATS`에 그 키를 넣어야 함.
  - **헥사곤:** 6축 유지(롤업). C와 달리 UI 안 깨짐 — B2의 큰 장점.
- **외과적 B2(권장 형태):** 36개로 안 간다. **엔진이 이미 구분하는 컨텍스트에만** 쪼갠다 —
  `defending`을 (태클/수비위치/공중볼)로, `shooting`을 (결정력/중거리)로. `duelType aerial`,
  `role defend`가 이미 있으니 즉시 소비된다.

### 옵션 C — FM식 완전 세분화 (~36) : 공정한 청문 후 기각

- **공정한 청문:** 사용자가 정체성을 "**하드코어 시뮬**"로 잡았고, 하드코어의 벤치마크는 FM이며,
  FM의 하드코어함은 정확히 이 36개에서 온다. **가장 순진한(naive) 경로는 C가 맞다.** 깊이·시뮬레이션
  충실도만 보면 C가 최고점이다. 이 긴장을 무시하지 않는다.
- **그런데 왜 코어로는 안 되나(엔진 소비 + 재작성 방지가 승부를 가른다):**
  1. **엔진이 6만 읽는다.** 36개를 붙이면 (a)엔진이 안 읽어 **30개가 장식**(우리 명시 원칙 정면
     위반) 이거나 (b)엔진 판정식을 36 소비로 **전면 재작성** — 둘 다 불변식 위반. FM은 엔진이 36을
     소비하니 정당하지만, 우리 엔진은 그렇게 안 생겼다.
  2. **재작성 방지 위반 규모:** `RATING_WEIGHTS`(12포지션×가중), `POSITION_CORE_STATS`,
     `applyGrowthStep` 배분, 헥사곤(6축→붕괴), `SCHEMA_VERSION`+대형 마이그레이션, 305+ 테스트,
     designLint까지 동시 재작성. genVersion 동결로도 "과거 세계 불변"을 값싸게 지키기 어렵다.
  3. **의존성 0·단순성:** 36 슬라이더 튜닝은 몬테카를로 밸런싱 표면을 폭증시킨다(현재 게이트: 평균
     2.5~3.0골·강팀 60~75%).
- **회수 가능한 부분:** C의 **아이디어**(Composure·Vision·Positioning·Off the Ball)는 버리지
  않는다 — 전부 **traits로 매핑**(§7 부록)해서 A/B2 사다리 안에서 흡수한다.

---

## 7. 추천 (요약)

**정체성 판정 — "하드코어 시뮬 + 드라마"에 가장 맞는 건 엔진 주도 additive 확장이다.** 지금은
`traits`(무비용 깊이+드라마), 엔진 판정을 깊게 팔 때마다 하위스탯 하나(외과적 B2, 헥사곤 불변). 우리
하드코어함은 안 읽히는 슬라이더 개수가 아니라 결정론 정밀도·엔진 깊이·서사(traits/press/story)에서
난다. C(전면 36 빅뱅)만 안 한다. 사다리 개요는 §0, **어디서부터 뭘 하나씩 정하며 개발하는지는 §8.**

- **개성 아이디어는 버리지 않는다:** FM/FIFA의 Composure·Vision·Positioning 등은 전부 `traits`로
  매핑(부록 A) → A/B2 사다리 안에서 흡수. 선수 모드 2-2 "마일스톤→trait push"와 결합.
- **GK 갭(벤치마크 대비):** 우리 GK는 `defending` 재사용이라 3사가 다 갖춘 GK 전용 축이 없다. GK
  전용 소형 세트(reflexes/handling/command)는 B2와 별개 검토 대상이되, `gkRating`이 단일값이라
  **GK 판정에 소비 지점을 먼저 신설**한 뒤에만(§8 Step 4c) — "판정 먼저" 규칙 동일.

---

## 8. 개발 순서 — 어디서부터 뭘 하나씩 정하나 (결정 게이트)

각 단계 = **결정 1개 + 슬라이스 1개 + 게이트 통과**. 다음 단계로 넘어가는 조건 = "몬테카를로 밸런스
게이트(평균 2.5~3.0골·강팀 60~75%) 통과 + 구 세이브 재현 확인". 빅뱅 없이 additive로만.

| Step | 결정할 것 | 건드리는 곳 | 왜 이 순서 |
|---|---|---|---|
| **0. 규칙 ADR** ✅ 완료 | "새 스탯은 그걸 읽는 판정과 **같은 슬라이스**에서만 추가 + 엔진 변경 슬라이스는 genVersion 동결" 확정 | **`docs/adr/ADR-001`**(accepted) | 아래 전부의 전제. 없으면 장식 스탯·빅뱅으로 샌다 |
| **1. traits 확장** ✅ 첫 삽 완료 | `composure` 특성 = 기존 훅에 식 1줄. **PK successBonus로 배선**(오픈플레이 슛 accuracyMult는 poacher가, progression scoreMult는 playmaker/dribbler가 이미 점유 → 중복 회피로 빈 PK 경로 선택) | `traits.js` `TRAIT_HOOKS`, `player-schema.js` `TRAIT_KEYS`, `setpieces.js` `resolvePenalty` | 리스크 0(stats 스키마·마이그레이션 불변, 기존 결과 비트 동일). 단위+소비 테스트 2종 추가, 316 green |
| **2. 첫 판정 심화(파일럿)** ✅ 완료 | 공중볼(aerial) | `setpieces.js`(resolveCross/pickAerial `aerial ?? physical`), `youthGen` seed(=physical·마지막 키), `player-schema` optional 검증, `playerState` 댐프닝 | `physical` 단일 입력이라 블라스트 반경 최소. **optional+폴백**이라 마이그레이션·SCHEMA_VERSION 불필요(구 선수 키 없음→physical→비트 동일). 소비 테스트 2종 + 유스 그로스 게이트 유지. 공중볼 특화 세대 편성은 후속 튜닝 |
| **3. 롤업 공용화** | 하위스탯→face 6 롤업 공식 규약 | `teamStrength.js` 공용 함수 추출 | 이후 모든 분할이 이 함수 재사용 → 슬라이스가 점점 싸진다 |
| **4a. 태클/수비위치** | `defending` 분할(tackling / positioning) | `role 'defend'`(이미 있음) | 가치순 반복 |
| **4b. 결정력/중거리** | `shooting` 분할(finishing / long_range) | `zoneBand 'BOX'`(이미 있음) | 가치순 반복 |
| **4c. GK 세트** | GK 1v1/크로스 **판정 먼저 신설** → GK 하위스탯(reflexes/handling/command) | `gkRating`이 단일 스칼라라 판정부터 | 소비할 판정이 아직 없어 뒤로(규칙: 판정 먼저) |

**Step 1이 진짜 첫 삽.** `composure` 같은 특성 하나를 기존 훅(`onShot`/`onDuel`의 accuracyMult)에
물려, 스키마·엔진 안 건드리고 "벤치마크→우리 모델" 왕복을 무비용으로 한 번 돌린다. 그 다음 **Step 2
공중볼 파일럿**이 엔진 확장의 첫 슬라이스 — 여기서 B2 전체 절차를 최소 표면에서 검증하고, 되면 4a·4b가
같은 패턴 복제라 저렴해진다.

**공통 규율(매 슬라이스 체크리스트):**
1. 세부가 진실, 표시 6은 롤업(**헥사곤 6축 불변**).
2. 과거 세계 불변은 **수단 무관 목표**: **optional 서브스탯**은 엔진 폴백(`aerial ?? physical`)으로 마이그레이션 없이 달성(구 선수 키 없음), **required 승격**만 부모 시드 마이그레이션+`SCHEMA_VERSION`+1. 어느 쪽이든 stats 새 키는 **마지막에**(applyGrowthStep rng 스트림 보존).
3. **genVersion 동결**(엔진 바뀌면 경기 결과 바뀌니 과거 세계 재현 보호).
4. `applyGrowthStep`은 새 키를 side 루프로 자동 +1. 성장 **포커스**로 쓰려면 그 슬라이스에서
   `POSITION_CORE_STATS`에 키 추가.
5. 밸런스 게이트 재통과 + 구 세이브 왕복 확인.

**멈추는 지점:** 판정을 더 심화해도 플레이어가 체감 못 하거나 밸런스 게이트가 흔들리기 시작하면 거기서
멈춘다(아마 10~15개 언저리). **개수 목표를 미리 안 박는 게 핵심 — 엔진 깊이가 정하게 둔다.**

---

## 부록 A. FM/FIFA 세부 항목 → 우리 6스탯·trait 매핑

C의 아이디어를 A/B2 사다리로 흡수하는 표(수치 아님, **개념 매핑**).

| 벤치마크 항목(FM/FIFA) | 우리 처리 | 형태 |
|---|---|---|
| Acceleration / Sprint Speed | `pace`에 롤업(B2 후보 아님, 이미 단일로 충분) | 스탯 |
| Finishing / Long Shots / Volleys | `shooting` → B2 2단계 분할 후보(결정력/중거리) | 스탯(나중) |
| Heading / Jumping(공중) | `aerial_threat` 특성 + B2 공중볼 분할 후보 | 특성→스탯 |
| Tackling / Marking | `defending` → B2 분할(태클/위치) + `tackle_specialist` | 특성→스탯 |
| Vision / Passing range | `passing` + `playmaker_vision` 특성 | 특성 |
| Composure | 특성(압박 정확도 훅) 후보 — `onShot`/`onDuel` accuracyMult | 특성(신규 후보) |
| Off the Ball / Positioning(공격) | `poacher`(zoneBand BOX) 계열 특성 | 특성 |
| Free Kick / Penalties / Corners | `free_kick_specialist`(onSetPiece) + 세트피스 특성 확장 | 특성 |
| Weak Foot / Preferred Foot | `left_footed`/`right_footed`(footChannel 훅) | 특성(이미 있음) |
| Stamina / Natural Fitness | `physical` + `veteran_declining`(onStaminaDecay) | 스탯+특성 |
| PlayStyles / Player Skills(이산 특수능력) | `traits` 전반 | 특성 |
| Consistency / Important Matches / Injury(히든) | 서사·컨디션 축(press/story, form) 후보 | 드라마 레이어 |
| GK Diving/Handling/Reflexes | 현재 `defending` 재사용 → 별건 GK 세트 검토 | 스탯(별건) |

## 부록 B. 참고 소스 (구조·스키마 확인용, 수치 미사용)

- FM 어트리뷰트 3범주·GK 세트: fifplay.com/football-manager-2024-player-attributes, sortitoutsi.net FM24 attributes guide, passion4fm.com player attributes
- EA FC 6대 face → 세부 롤업·GK 카드·OVR 포지션 가중: fifplay.com/fc-24-player-attributes, fifauteam.com FC attributes guide, earlygame.com FIFA ratings explained
- eFootball 스탯·플레이스타일: fifplay.com/efootball-2024-player-stats, gamingonphone.com efootball attributes guide
- 오픈소스 스키마(컬럼 구조): Kaggle `stefanoleone992/fifa-23-complete-player-dataset`(SoFIFA 파생, 연도별), Kaggle "Football Manager" 데이터셋
- (대비) 이벤트 데이터: StatsBomb Open Data, openfootball/football.json — 어트리뷰트 아님

> **라이선스/이용조건은 후속 항목 에이전트가 판정.** 이 문서는 모델·카테고리·스키마 구조만 벤치마킹했고
> 어떤 실제 선수의 실제 수치도 옮기지 않았다.
