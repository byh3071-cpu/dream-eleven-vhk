# 축구 매니저·육성 게임 벤치마킹 → 우리 PRD 대조

> **목적**: dream-eleven-vhk의 핵심 차별점이 "진짜 빈 곳(white space)"인지 기존 게임으로 **반증(disconfirmation)** 한다.
> 이 문서의 가치는 PRD가 맞다는 확인이 아니라 **어디서 틀렸는지** 짚는 데 있다.
> **대조 기준** = `docs/PRD.md`. **방식** = 웹 리서치(커뮤니티 sentiment 우선, 마케팅 카피 배제), 2026-07 기준.
> **주의**: 아래 "판정"은 마케팅 관점의 차별성이지 개발 우선순위가 아니다. 빈 곳이 아니라도 좋은 기능일 수 있다.

---

## 0. 두괄식 결론 — 6개 차별점 중 진짜 빈 곳은 사실상 1.5개

| 우리 차별점 | 판정 | 한 줄 근거 |
|---|---|---|
| ① 선수-감독 **관계 시스템** | ❌ 차별점 아님 (재프레이밍 필요) | FM은 이미 깊다(4단계 위계·소셜그룹·약속·멘토링). "얕은 사기 %"는 **사실이 아님**. 얇은 건 *수치*가 아니라 *감정 서사 연출* |
| ② **돈 이원화**(감독 개인 돈) | △ 부분 빈 곳 (시한부) | FM엔 없음(확인됨). 단 **FIFA Manager가 2004~14 이미 구현→혹평·사장**, WAF가 라이트로 잠식 중. 개념은 선례 있음, **실행이 차별** |
| ③ **서사 엔진**(자동 라이벌·감동) | △ craft 승부처 (빈 곳 아님) | 채널(뉴스·기자회견·명전)은 FM이 다 가짐. 자동 *라이벌 아크*와 "뿌듯한 authored 스토리"만 얇음. OOTP도 프로즈는 클리셰 |
| ④ **IF What-if** | △ 개념 기존, 패키징만 엣지 | WhatIfSports·OOTP·Diamond Mind가 이미 함. 우리 엣지는 "한 경기·변수 하나" 좁은 패키징뿐 |
| ⑤ **크로스모드 지속성**(선수→감독→가문) | ✅ 가장 깨끗한 빈 곳 | EA FC가 선수→감독 전환은 되나 얕고 버그. **결정론 공유세계 지속성 + 다세대 왕조**는 유저가 EA에 조르는 미점유 영역 |
| ⑥ **결정론 관전형**(실시간 조작 X) | ❌ 차별점 아님 + **리스크** | 매니저 장르 표준(FM도 전술→관전). 오히려 FM이 **더** 인터랙티브(터치라인 샤우트). 액션겜 대비만 차별 |

**가장 중요한 발견 3가지:**

1. **"관전형이 재미있다"는 검증되지 않았다 — 오히려 반례다.** OOTP 유저는 대부분 quick-sim으로 관전을 건너뛰고(재미는 프런트오피스에 있음), FM 베테랑은 전술이 검증되면 하이라이트/즉시결과로 스킵한다. "관전이 정보뿐이면 유저는 그걸 최적화해 없앤다." **관전이 곧 제품인 우리에겐 이게 최대 리스크.** → 오토배틀러 3원칙(§5) 필요.
2. **PRD가 겨냥을 잘못했다.** 관계·서사의 *수치/시스템* 레이어는 FM이 이미 깊다. 얇은 건 **감정 서사 연출(authored delivery)** 레이어다. 차별점은 "FM엔 관계가 없다"가 아니라 "FM은 관계를 *스프레드시트 HR 문제*로 다루지, *뿌듯한 이야기*로 전달하지 않는다"로 재정의해야 한다.
3. **창은 닫히는 중.** FM26(2025.11, Unity 신엔진)이 첫 Unity 사이클 예산을 **감독 정체성·Dynamic Manager Timeline(50+ 이벤트)·Unexpected Events**에 쏟고 있다 — 정확히 우리가 노리는 관계/서사 영역. We Are Football 2027(2026 늦여름)은 감독 개인사 심화. **경쟁자가 우리 쪽으로 오고 있다.**

---

## 1. 대조표 — 우리 기능 × 기존 게임 (핵심 산출)

범례: **●** 있음(깊음) · **◐** 부분/얕음 · **○** 없음 · **–** 해당없음

| 우리 기능 | FM 26 | We Are Football 24 | FIFA Manager (EA·~14 단종) | New Star Soccer | EA FC Player Career | 모바일 매니저(Top11 등) | OOTP·야구시뮬 | **판정** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| ① 선수-감독 관계 (수치·시스템) | ● | ◐ | ◐ | ◐ | ◐ | ○ | ◐ | **이미 있음** — 빈 곳 아님 |
| ① 관계 **감정 서사 연출**(존경·배신·재회 아크) | ◐↑ | ○ | ○ | ◐(창발) | ○(The Journey 사망) | ○ | ○ | **얇음 = 진짜 승부처** |
| ② 감독 **개인 돈=영향력 경제** | ○ | ◐(허영) | ◐(코스메틱·사장) | ○(선수측은§3-2) | ○ | ○ | – | **부분 빈 곳·시한부** |
| ③ 서사 엔진 — **전달 채널** | ● | ◐ | ◐ | – | ◐ | ○ | ● | 이미 있음 |
| ③ 서사 엔진 — **자동 라이벌·감동 아크** | ◐↑ | ○ | ○ | ◐ | ○ | ○ | ◐(스탯기반) | **얇음 = craft 승부처** |
| ④ IF What-if(명경기·변수 하나 재시뮬) | ○ | ○ | ○ | – | ○ | ◐(레전드전) | ●(리플레이) | 개념 기존, 패키징만 엣지 |
| ⑤ 크로스모드 **선수→감독→가문 지속성** | ○ | ◐(자녀→선수) | ○ | ○ | ◐(전환만·버그) | ○ | ◐(역사모드) | **가장 깨끗한 빈 곳** |
| ⑥ 결정론 관전형(실시간 조작 X) | ●(더 인터랙티브) | ● | ● | ○(트위치) | ○(액션) | ●(라이브매치) | ● | 표준 — 차별점 아님 |

> **읽는 법**: ①·⑥ 행이 ●로 도배됐다는 건 "이미 다들 한다 = 차별점 아님". ②·⑤가 ○/◐ 위주 = 빈 곳. ↑ 표시는 "FM26가 지금 침공 중".

---

## 2. 차별점별 정밀 판정 (수치 레이어 vs 연출 레이어 분리)

### ① 선수-감독 관계 — **"얕은 사기 %"는 틀렸다. 재프레이밍하라**
- **수치/시스템 = 이미 깊음(반증됨).** FM은 실제로 이걸 모델링한다: **4단계 라커룸 위계**(Team Leaders→Highly Influential→Influential→Other, 리더 건드리면 스쿼드 전체에 "부정적 충격파"), **소셜 그룹**(재직기간 기반 Core/Secondary/Other, 파벌), **감독 평판으로 게이팅되는 존경/신뢰**(저평판 감독은 스타를 칭찬으로 못 움직임), **favoured/disliked personnel** 플래그(라이벌 팀 가면 미움받음), **약속 시스템**(출전·영입 약속 어기면 불만), **멘토링**(성격·PPM 전수, 궁합 안 맞으면 둘이 *틀어짐*), 라커룸 반란.
- **얇은 레이어 = 감정 서사 연출.** 이 시스템들은 관리 *딜레마*와 뉴스피드 메뉴로 표면화될 뿐, "뿌듯해할 authored 아크"로 전달되지 않는다. FM엔 지속적·이름있는 **선수→감독 스토리**(배신·재회로 전개되는)가 없다. 존경/신뢰는 *사기 입력값*이지 authored 드라마가 아니다.
- **경고**: FM26가 **Dynamic Manager Timeline(50+ 이벤트)·Unexpected Events**(반응형 서사 선택지)로 지금 이 공간에 진입 중.
- **판정**: 수치 = 이미 있음(깊음) / 연출 = 부분·축소 중. **"FM 관계는 얕다"고 주장하지 마라 — 스크린샷 한 장으로 반박당한다.** 우리 차별화 문장을 "관계를 *뿌듯한 이야기*로 전달"로 재정의.

### ② 돈 이원화 (감독 개인 돈) — **부분 빈 곳, 그러나 개념 선례 있음·시한부**
- **FM엔 없음(확인됨).** 1차 출처: SI 공식 포럼 스레드 제목이 곧 *"What's the point in human manager salary?"*. 유일한 기능은 **구단측 위약금**(연봉 높으면 경질 비용↑)뿐. 유저는 "그 쓸모없는 숫자"라 부르며 10년치 연봉을 모아 *새 세이브 시작으로 내 구단 사는 척* 롤플레이한다. 자기 코칭·어학 코스에 쓰게 해달라는 요청 반복. → **PRD의 "번 돈 못 씀" 주장은 참.**
- **그러나 개념은 선례가 있다(agent가 놓친 반증, 직접 확인).** **FIFA Manager(EA, 2004~2014)** 는 완전한 **Private Life**를 이미 구현했다 — 개인 재정, 집·차·명품 구매, 결혼·자녀, 사생활 시뮬. "FM과 차별화되는 특징적 요소"로 홍보됐다. **We Are Football 2024**도 라이트 버전 보유(파트너·자녀·반려 기니피그·미신/행운부적[게임효과無]·어학·3D 트로피룸).
- **결정적 뉘앙스**: FIFA Manager의 Private Life는 **코스메틱 허영으로 혹평받고 사장됐다** — "정말 중요한 것 위에 얹힌 산만한 겉치레", "레스토랑 종류가 늘어난 게 major improvement냐"는 조롱. SI(FM)는 "실생활 돈쓰기는 축구 경영 시뮬에 유익하지도 현실적이지도 않다"며 **의도적으로 거부**. → 시장 리더가 비운 자리 + 선례는 죽음.
- **따라서 우리 차별화는 "개념 발명"이 아니라 "실행"이다.** 개인 돈을 *허영 라이프심*이 아니라 **기능적 영향력 경제**(에이전트망→영입 우선권, 사비 유스 후원→구단 예산 밖 전력, 명성→협상 레버리지)로, 그리고 **관계/서사 시스템과 통합**해야 진짜 차별. 단독 "집·차 사기"는 FIFA Manager의 무덤을 반복한다.
- **판정**: 부분 빈 곳(현역 하드코어 시장엔 없음) / **시한부**(WAF 2027이 감독 개인사 심화 중).

### ③ 서사 엔진 — **채널은 기존, 감정 craft가 승부처**
- FM은 전달 **채널**을 다 가짐: 뉴스피드·기자회견·명예의전당·FM26 타임라인·분기형 언론 대화. **하지만 감정 품질이 약점** — 기자회견은 "지루한 체크박스"로 조롱(FM26: "안 해도 페널티 없음", "전부 위임함", 몰입 요소였던 *직접 답변 입력*은 오히려 삭제됨).
- **자동 라이벌 아크**는 FM에서도 오래 요청된 얇은 기능("Finally! Dynamic Rivalries?" 스레드 반복). 내 경쟁사(史)에서 *생성되는* 숙적은 미점유.
- **OOTP 교훈(핵심)**: OOTP는 30시즌 무반복 스토리라인이 있지만 그건 프로즈가 풍부해서가 아니라 스토리라인이 *희귀*해서다. 대부분은 템플릿 스탯이벤트고, 고-리더십 캐릭터는 "뻔한 야구 클리셰를 읊는다". **서사의 힘은 지속 스탯/기록 + 유저가 투영하는 의미에서 나온다, 프로즈 물량이 아니라.**
- **판정**: 빈 곳 아님(채널은 FM 소유). **감정 연출 craft가 wedge.** 설계 순서: 지속 스탯 → 자동 아크 감지(라이벌·연승·복수·언더독을 실제 누적 스탯에 앵커) → 프로즈/기자회견은 그 위의 *스킨*. 스탠스 없는 프로즈 물량은 클리셰로 읽힌다. **급함**(FM26 투자 중).

### ④ IF What-if — **개념은 검증됐고 사랑받음, 발명 아님**
- **WhatIfSports.com**(6개 종목, 시대 초월 매치업·박스스코어), **Diamond Mind**(ESPN이 시즌 시뮬·what-if 트레이드에 사용), **OOTP**(엄격 리플레이 vs 커리어 개변 모드), **Strat-O-Matic** 리플레이 리그(수십 년 취미). **대체역사 스포츠는 독립 콘텐츠 장르.**
- **우리 유일 엣지 = 좁은 패키징**: "실제 한 경기·변수 하나 뒤집어 *같은 경기* 재시뮬". WhatIfSports는 드림 *매치업*을 하지, "그 결승을 되감아 레버 하나 flip"은 아님 — 더 깨끗하고 감정적으로 legible. **개념이 아니라 이 좁음을 차별점으로.**
- **결정론 주의**: 1회 재시뮬 = 고정 답 1개. 깔끔하지만 "1000번 돌려 62% 승"식 분포 대비 자의적으로 느껴질 수 있음. **단일 canonical 재시뮬(스토리) + 선택적 분포(신뢰성) 둘 다 제공** 고려.

### ⑤ 크로스모드 지속성 — **가장 깨끗한 빈 곳(단, 좁음)**
- **선수→감독 전환 자체는 선례 있음**: EA FC가 은퇴 선수를 같은 커리어 내 감독으로 전환시켜줌 — 그러나 얕고 버그투성이(감독 세이브가 선수 세이브에 덮어써짐, 전환 후 옵션 잠김). 유저들은 "은퇴 후 새 감독으로 계속하기"와 **다세대 왕조**를 EA에 계속 조른다.
- **미점유 = 깊은 결정론 공유세계 지속성 + 다세대(선수→아들→손자) 왕조 + 흔적 영구 각인.** 이건 유저가 명시적으로 원하는데 **현재까지 확인된 게임 중** 아무도 안 준 좁고 진짜인 갭(단, 전수 조사는 아님). 우리 3모드 공유세계의 화룡점정이자 **가장 방어 가능한 독창성**.
- **판정**: ✅ 빈 곳. 단 "선수가 감독 됨" 단독은 이미 있으므로 "지속성·왕조·공유세계"를 전면에.

### ⑥ 결정론 관전형 — **차별점 아님 + 설계 리스크**
- "전술 짜고 관전"은 **매니저 장르 표준**(FM·CM·Football Chairman·WAF 전부 논-트위치). 오히려 **FM이 우리보다 인터랙티브** — 경기 중 터치라인 샤우트·전술 조정·교체(샤우트는 FM26 26.1.0에서 유저 요청으로 재추가). 우리 "실시간 조작 X"는 FM 대비 **에이전시 감소**다. **액션 축구겜(EA FC 플레이) 대비로만** 차별.
- **더 깊은 리스크(§0-1 재강조)**: 관전은 재미의 약한 고리라는 게 반증 증거다. 관전이 곧 제품인 우리는 이걸 정면 설계로 풀어야 함(§5).

---

## 3. 카테고리별 벤치마크 요약 (lean)

### 3-1. 감독 시뮬 — FM / Championship Manager / Football Chairman / We Are Football
- **핵심 루프**: 스쿼드·전술·이적·재정·유스 → 시즌 → 전술 확정 후 **관전**. 진보의 척추 = **명성 상승**(선데이리그 무명→엘리트, 접근 가능한 구단·선수를 게이팅) + **이사회 신뢰/직업 안정성** 긴장.
- **재미**: 깊은 시뮬·데이터·왕조 서사·평판 판타지. **아쉬움(유저 실불만, 확인됨)**: ⓐ 감독 연봉=쓸모없는 숫자(§2-②), ⓑ 기자회견 지루한 체크박스, ⓒ 자동 라이벌 아크 부재, ⓓ 감독 개인사 미개발("FM은 RPG인데 네 감독 이야기가 저개발"—FM26 위시리스트).
- **We Are Football**: 우리 비전과 가장 겹침 — 팀 케미/위계, **감독 개인사(파트너·자녀·반려동물)**, 3D 매치. **단** 심도·매치 리얼리즘 부족으로 혹평, 개인사는 재정 경제 없는 flavor. **2027(2026 늦여름)**이 개인사 심화 예정 = 우리 창 잠식.
- **Football Chairman**: 회장/이사회 심(감독 아님). 감독 고용/해고·이적 승인·시설. 돈은 *구단/오너* 돈이지 감독 개인 명성경제 아님 → ②를 점유 안 함. "돈 굴리고 결과 관전"이 이미 팔리는 장르라는 **수요 증거**.
- **FM 릴리스 상태(직접 확인)**: **FM25 취소**(2025.2, 신엔진 품질 미달) → **FM26 출시 2025.11.4**, 시리즈 **첫 Unity 엔진**·첫 두 자리 명칭·첫 여자축구 완전통합(35,000+ 선수). 함의: SI가 신엔진 첫 사이클을 **감독 정체성·타임라인·미디어 개편**에 투자 = 우리 영역 침공.

### 3-2. 선수 육성/커리어 — NSS / New Star Manager / EA FC Career / Score! Hero / Retro Goal
- **⭐ New Star Soccer가 "번 돈 쓰는 축구선수" 판타지를 이미 완전 점유(2012~).** 루프: 경기→연봉·보너스·스폰서(+카지노·경마 도박)→**경쟁하는 소비처**(NRG 에너지드링크=유일 회복·인플레 트레드밀 / 부츠=스킬·마모 / 라이프스타일=집·차·제트스키→Lifestyle 평점→스폰서·연인 유치 / 에이전트·트레이너 계약 만료 / 도박)→**이게 경기 에너지·스킬·사기·기용에 피드백**. **NSS도 이미 이중 통화**(현금+프리미엄 Star Bucks). 관계 풀웹(연인 방치 시 "폭주"→감독 관계 파괴→벤치, 감독 승인이 기용 게이팅, 동료 호불호는 패스 vs 볼욕심).
- **결정적 반증**: NSS 소비 판타지는 **트위치 스킬플레이(직접 슛/프리킥 조준)와 번들**이다. "돈 쓰기" + "그 다음 내가 직접 슛" = 중독의 핵심. **관전전용인 우리는 소비는 복사해도 그 payoff를 상속 못 함.** → 별도 설계 필요.
- **EA FC Player Career**: 경기 평점→스킬포인트→성장, 감독 평점이 출전 게이팅(관계 레버 있으나 얇은 *숫자*). **"The Journey"**(FIFA 17~19, Alex Hunter — 컷신·분기 성격[cool/balanced/fiery]·라이벌)가 시리즈 최고 기능으로 극찬받았으나 **FIFA 19 이후 폐지, 대체 없음.** 약점: 반복적·얕음·FC25 스킬포인트 버그.
- **Score! Hero**: 스크립트 서사를 스와이프-투-스코어 퍼즐로. 온-레일("선택의 환상"), 강점=큐레이트된 드라마 순간, 한계=시뮬/에이전시 0.
- **Retro Bowl/Retro Goal**(NSS와 같은 스튜디오): 극단적 단순함에도 중독 = 마찰 없는 타이트 루프 + 로스터 구성 도파민. 접근성 교훈: 훅은 리얼리즘이 아니라 깔끔한 루프·팀빌딩에서.
- **"한 선수 키우기" 서사 랭킹**: ①The Journey(authored 최고, *사망*) ②Score Hero(순간 드라마 최고, 온-레일) ③NSS(창발 드라마 최고, authored 아님). **셋 다 얇은 곳 = 한 선수의 지속·authored·장기 아크(유스→레전드→은퇴). The Journey 사후 사실상 미점유 = 선수모드 최강 기회.**

### 3-3. 모바일 매니저 — Top Eleven / OSM / Soccer Manager / Champ Man
- **접근성**: 짧은 세션 + "코치 후 관전" 매치 + FM의 스탯/재정 깊이를 슬라이더·%로 은닉. OSM은 sim 속도 조절·수 분 내 시뮬로 가장 캐주얼. Champ Man은 무시간압박(안 켜면 진행 안 됨).
- **리텐션 훅**: Top Eleven **라이브매치**(실시간 관전+제한적 교체/전술, 친구가 "응원"하면 관중 버프)·**Associations**(4~6인 협동 길드, 서로 +4% 팀버프, 디비전 등반)·**일일 상한 소모품**(체력팩 하루 1개 무료, 광고/친구로 추가). OSM **일일 로그인 스트릭→팀부스트**·**레전드전 퀵매치**.
- **수익화(장르 전체 P2W 낙인)**: 이중통화(소프트+하드). Top Eleven 토큰, OSM Boss Coins(가장 부정적 — 시즌 중 가격 폭등), Champ Man "지갑 깊이가 성패 좌우". **전략적 시사**: 장르가 *온-피치 파워 판매*로 P2W 오명 → **라이프스타일/명성/코스메틱 판매(우리 ②)는 신뢰할 만한 안티-P2W 쐐기.**
- **반증(우리 차별점)**: 캐주얼 F2P 매니저엔 ②(감독 개인 돈)·①(관계 서사)·③(자동 라이벌) **전부 부재**. "Be More Than Just a Manager"조차 다중 *역할*(SD/회장/오너)이지 개인사 아님. → F2P 경쟁권에선 우리 차별점 생존. 단 (b)는 FM Mobile이 respect/betrayal 일부 있으니 "캐주얼 F2P에서의 관계 서사"로 프레이밍.

### 3-4. 관전형/시뮬 — OOTP / FM 매치 관전 / Motorsport Manager / 오토배틀러 / 야구 리플레이심
- **관전 재미 유지 기법 — 우리 제약(모든 결정 front-load)에서 *살아남는* 것만:**
  - ✅ **앤티시페이션(셋업→관전 루프 자체)** — 오토배틀러의 정수. "전략 선택→자동 전개 관전→학습". 결과가 *불확실하고 다음 결정에 중요*하기에 관전이 긴장됨.
  - ✅ **개별 선수 감정 투영**(OOTP "들어본 적 없는 선수에 감정 이입"), **장기 왕조/역사 목표**(시즌=챕터), **스탯/기록/연감 payoff**, **"한 판 더" 리듬**, **아이언맨(무르기 없음) 긴장**(결정이 무게를 가짐 — front-load와 궁합).
  - ❌ **경기 중 반응성**(FM 샤우트, Motorsport 피트콜) — 우리가 구조적으로 잃는 것. 최대 경험 격차.
  - ⚠️ **결정론이 서프라이즈를 약화** — 경쟁작은 관전 중 *실시간 롤*이라 리빌이 긴장을 나름. 사전계산 결정론은 결과를 알면 재관전 긴장 0 → **결과를 스포일러로 보호**(첫 관전이 유일한 리빌, 점수 먼저 노출 금지).
- **반증(관전 = 약한 고리)**: OOTP 매력은 프런트오피스지 관전 아님("개별 경기 순간이 거의 기억 안 남"). FM 풀매치 관전은 명시적 선택이고 베테랑은 스킵(모드 선택은 결과에 영향 0). **관전이 정보뿐이면 최적화로 제거됨.**
- **오토배틀러 3원칙(우리 정확한 루프의 해답)**: ⓐ 관전이 **다음 결정에 피드**돼야(스펙터클 아닌 정보) ⓑ **짧게**(90분 결정론 관전은 FM 풀매치처럼 스킵됨 — 하이라이트 우선+확장 옵션) ⓒ **가독성 > 충실도**(결과의 *인과 스토리*를 읽게, 모션만 보여주지 말고).

---

## 4. 놓친 재미 요소 — 우리 PRD에 없는데 좋은 것 (발굴)

우선순위순. 관전전용·결정론과 궁합 좋은 것 위주.

1. **유스 인테이크 데이(FM)** — "FM 캘린더에서 가장 설레는 날"로 사랑받는 *연례 의식*. 1년에 한 번 뉴젠(regen) 무더기가 인박스에 떨어지고 유스시설/HoYD가 품질을 좌우. **앤티시페이션이 내장된 감정적 반복 이벤트** — 싸고 payoff 큰 루프. (우리 유스 시스템에 "인테이크 데이" 연출 이식)
2. **데이터 허브/머니볼 분석(FM)** — xG·xA·산점도·상대 분석·최근5경기 트렌드. 관전자를 *분석가로* 만듦 — **관전이 핵심 동사인 결정론 시뮬에 최적 궁합.** 경기 사이 메타게임.
3. **NSS 라이프스타일-vs-체력 에너지 긴장** — 경제가 "재미로 쓰기"가 아니라 *긴장 엔진*. 모든 오프피치 쾌락(쇼핑·파티·연애)이 경기에 필요한 에너지를 소모. **이게 진짜 중독 코어** — 단순 "번 돈 쓰기" 프레임엔 없음. 감독 개인 돈에도 트레이드오프 긴장을 넣어라.
4. **리빙 월드 뉴스(OOTP)** — 내 구단 밖 리그 전체 스토리라인(라이벌 결과·타 구단 드라마). 싼 몰입 배수기, 결정론 매치 주변 세계를 살아있게.
5. **지속 역사 연감/기록 보관소(OOTP Almanac)** — 시즌 아카이브를 "거닐 수" 있게 자동 보존. **1회성 결정론 결과를 영구 왕조사로 전환 → "결과 알면 재플레이 가치 0" 리스크를 정면 상쇄**(기록 자체가 keepsake).
6. **세이브 공유/커뮤니티 리그 + 자기부과 챌린지(FM)** — FM 최대 장수 엔진(같은 리그를 여럿이, 트래시토크). **트위치 스킬을 못 주는 우리에겐 소셜 경쟁·제약이 재플레이성 제조법.** 39개국 월드 리그 비전과 강한 궁합.
7. **Top Eleven 라이브매치 + 협동 Association** — "코치 후 관전"에 제한적 실시간 레버 + 소셜 응원 버프. 결정론을 해치지 않고 관전을 *스펙터블·소셜*하게(경기 중 레버 소수만). 협동 길드는 월드 리그에 매핑.
8. **일일 저부담 모드(OSM/Champ Man)** — 로그인 스트릭·레전드 퀵매치·주간 챌린지. 풀매치 없이 60초 앱 열 이유. + **무진행-부재 페이싱**(안 켜면 리그가 앞서가지 않음 = 캐주얼 이탈 방지).
9. **아이언맨 모드** — front-load 결정 + 무르기 없음은 자연스러운 고긴장 선택 레이어. 캐릭터가 "강렬하게 진짜"로 느껴짐.
10. **Score! Hero식 "명장면 재현" 스크립트 비트** — 큐레이트된 하이라이트 시나리오를 서사 전달로. **결정론/관전 시뮬과 호환**(IF What-if과 연결).

---

## 5. 전략 함의 & 권고

1. **①·⑥은 리터럴 차별점에서 내리거나 재프레이밍.** FM 관계 *수치*는 깊고, FM은 관전 시뮬보다 *더* 인터랙티브. ①은 **"authored 감정 아크"**로, 마케팅은 "관계를 뿌듯한 이야기로"로. ⑥은 "액션겜 대비 판단형"으로만.
2. **②는 유일에 가까운 생존 차별점 — 단 시한부·실행이 전부.** FIFA Manager의 무덤(코스메틱 허영→혹평→사장)을 피하려면 개인 돈을 **기능적 영향력 경제**로(선택지·전력·협상을 여는 열쇠) + **관계/서사와 통합** + **트레이드오프 긴장**(§4-3). 마케팅 훅으로 조기 선점(WAF 2027 오기 전).
3. **관전형 리스크를 정면 설계.** 오토배틀러 3원칙(피드·짧게·가독성) + **스포일러 보호**(점수 먼저 노출 금지) + **고부담 경기만 리치 관전**(더비·결승), 저부담은 스킵/요약. 관전은 즉시결과가 못 주는 *감정·이야기*를 줘야 존재 이유가 생김.
4. **서사 엔진: 지속 스탯·아크 감지 먼저, 프로즈는 스킨.** OOTP 교훈 — 물량 프로즈는 클리셰. 자동 라이벌/복수/언더독 아크를 실제 누적 스탯에 앵커한 뒤 AI 향신료로 살 붙이기.
5. **④ What-if: "한 경기·변수 하나" 좁은 패키징을 전면 + 분포(1000회) 옵션**으로 결정론의 자의성 보완.
6. **⑤ 크로스모드를 최우선 독창성으로.** 가장 깨끗한 빈 곳이자 방어 가능. "선수→감독" 단독이 아니라 **지속성·다세대 왕조·공유세계 각인**을 훅으로.
7. **수익화(향후 F2P): 온-피치 파워 아닌 라이프스타일/명성/코스메틱 판매 = 안티-P2W 쐐기.** ②가 곧 수익 표면이 됨.
8. **시급성**: FM26가 감독 정체성·Dynamic Manager Timeline으로 ①/③ 침공 중, WAF 2027이 ② 잠식 중. **관계·서사·개인사 슬라이스를 빨리 세워 선점하라.**

---

## 6. 주요 출처 (검증 근거)

**감독 시뮬 / FM**
- SI 공식: "What's the point in human manager salary?" — https://community.sports-interactive.com/forums/topic/427864-whats-the-point-in-human-manager-salary/
- FM26 Dynamic Manager Timeline — https://www.footballmanager.com/features/dynamic-manager-timeline
- FM Dynamics 가이드 — https://www.givemesport.com/football-manager-2024-dynamics-guide/ · 모럴/관계 — https://www.guidetofm.com/squad/morale-relationships/ · https://www.fmscout.com/a-morale-and-relationships-in-football-manager.html
- 멘토링(궁합 실패 시 틀어짐) — https://twoplaymakers.com/the-complete-guide-for-player-mentoring-in-football-manager/
- FM26 기자회견 불만(Steam) — https://steamcommunity.com/app/3551340/discussions/0/691997051773290819/
- 다이나믹 라이벌 요청 — https://community.sports-interactive.com/forums/topic/562564-dynamic-rivalries-your-experiences/
- FM26 릴리스·Unity·FM25 취소 — https://en.wikipedia.org/wiki/Football_Manager_26 · https://www.thexboxhub.com/football-manager-26-is-officially-unveiled-ushering-in-a-new-unity-engine-era-after-fm25s-cancellation/
- FM26 26.1.0 샤우트 재추가 — https://www.thesixthaxis.com/2025/12/09/football-manager-26-update-26-1-0-brings-back-shouts/
- FM26 위시리스트(감독 개인 돈·개인사) — https://www.footballmanagerblog.org/2025/08/fm26-features-wishlist.html
- 유스 인테이크 — https://www.footballmanager.com/the-dugout/developing-and-maximising-your-youth-intakes-fm26 · 데이터 허브 — https://gamerant.com/football-manager-22-data-hub-guide/ · 평판 — https://footballmanager.fandom.com/wiki/Reputation
- Football Chairman — https://www.football-chairman.com/

**We Are Football / FIFA Manager (돈·개인사 선례)**
- WAF 2024 리뷰(개인사=flavor, 재정경제 없음) — https://fullerfm.com/2024/04/24/review-we-are-football-2024/ · https://www.handy-games.com/en/games/we-are-football-2024/
- WAF 2027(개인사 심화) — https://www.gameswirtschaft.de/marketing-pr/we-are-football-2027-winning-streak-240326/
- FIFA Manager Private Life(집·차·가족·개인재정) — https://gamesread.com/video-game-tactics/fifa-manager-14-advice-adding-money-in-your/ · FM 유저 "make it more like fifa manager" — https://steamcommunity.com/app/1263850/discussions/0/2838914020266929522/ · 혹평(산만한 겉치레) — https://www.gamegrin.com/reviews/fifa-manager-10-review/

**선수 육성/커리어**
- NSS 루프·소비·관계 — http://www.theaveragegamer.com/2013/12/02/new-star-soccer/ · https://www.pocketgamer.com/new-star-soccer/review/ · https://new-star-soccer.fandom.com/wiki/Life
- New Star Manager — https://www.nintendolife.com/reviews/switch-eshop/new_star_manager
- EA "The Journey"(폐지) — https://easportsfc.fandom.com/wiki/Alex_Hunter · FC25 커리어 버그 — https://forums.ea.com/discussions/fc-25-game-modes-en/player-career-mode-bug-%E2%80%93-incorrect-overall-rating--more/12075187
- 선수→감독 전환/왕조 요청 — https://forums.ea.com/discussions/fc-25-game-modes-en/manager-career-overwritten-by-player-career/7858056 · https://forums.ea.com/discussions/fc-26-feedback-en/career-mode-feature-request-continue-with-a-new-manager-after-retirement/13482381
- Score! Hero(온-레일) — https://www.gbhbl.com/game-review-score-hero-mobile-free-to-play/ · Retro Goal — https://www.nintendolife.com/reviews/switch-eshop/retro-goal

**모바일 매니저**
- Top Eleven 라이브매치 — https://nordeus.helpshift.com/hc/en/3-top-eleven-be-a-soccer-manager/section/62-live-match/ · Associations — https://top-eleven.fandom.com/wiki/Associations · 체력팩 — https://top-eleven.fandom.com/wiki/Health_Packs · P2W 논쟁 — https://forum.topeleven.com/top-eleven-general-discussion/84497-people-ranting-about-game-being-pay-win-3.html
- OSM — https://www.onlinesoccermanager.com/ · Boss Coins 불만 — https://support.onlinesoccermanager.com/hc/en-us/categories/4406270607761-Payment-Boss-Coins
- Champ Man 17(지갑 깊이) — https://www.fourfourtwo.com/features/review-championship-manager-17 · Soccer Manager 2024 — https://en.wikipedia.org/wiki/Soccer_Manager_2024
- New Star Manager Steam(구단재정 전부) — https://store.steampowered.com/app/883130/New_Star_Manager/

**관전형/시뮬**
- OOTP 감정투영·프런트오피스 — https://defector.com/playing-a-baseball-simulator-made-me-a-fanatic-again · 스토리라인 희귀 — https://forums.ootpdevelopments.com/showthread.php?t=244033 · 매니저뉴스 — https://manuals.ootpdevelopments.com/index.php?man=ootp18&page=manager_news · 연감 — https://manuals.ootpdevelopments.com/index.php?man=ootp16&page=open_almanac
- FM 풀매치 vs 하이라이트(스킵) — https://steamcommunity.com/app/872790/discussions/0/1742227264187754385/
- 오토배틀러 루프 — https://www.cbr.com/super-auto-pets-autobattler-tft-hearthstone-battlegrounds/ · 가독성>충실도 — https://cjleo.com/blog/hearthstone-battlegrounds-a-card-based-auto-battler-experiment-in-game-design/
- WhatIfSports — https://www.whatifsports.com/locker/simulations.shtm · Diamond Mind — https://en.wikipedia.org/wiki/Diamond_Mind · OOTP 역사모드 — https://wiki.ootpdevelopments.com/index.php?title=OOTP_Baseball%3ACreating_Games%2FHistorical_Games
- 세이브 공유(장수 엔진) — https://community.sports-interactive.com/forums/topic/499196-sharing-saves-with-mates/

---

> **방법론 주석**: 커뮤니티 sentiment(Reddit·Steam·공식 포럼·App Store)를 마케팅 카피보다 우선했다. FM 릴리스 상태·FIFA Manager 개인사·WAF 개인사·FM 관계 깊이·감독 연봉 무용론은 직접 웹 확인. P2W 세부·포럼 인용은 개별 스레드 수준(공식 통계 아님)이므로 하드 스탯으로 굳히기 전 원 스레드 재확인 권장. 4개 리서치 축(감독·선수·모바일·관전) 병렬 조사 후 대조.
