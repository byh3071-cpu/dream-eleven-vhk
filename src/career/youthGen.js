// 유스 선수 생성기 — 순수 함수(rng 주입, deriveSeed 결정론). goal 18(N7).
// 생성 선수는 세이브(save.youthPlayers)에만 존재한다 — 세이브에 선수 객체가 들어가는
// 최초이자 유일한 예외(불변 DB 원칙의 의도된 구멍, 필러 스키마 계승).

import { POSITION_CORE_STATS } from './development.js'
import { playerOverallRating } from '../sim/teamStrength.js'

// 국적 16개국(한국 포함) — 성/이름 풀 조합. 국기는 이모지(국기는 이모지가 표준 표기).
const NATIONS = [
  { code: 'kr', first: ['민준', '서준', '도윤', '시우', '지호'], last: ['김', '이', '박', '최', '정'] },
  { code: 'br', first: ['가브리엘', '루카스', '치아구', '카이오'], last: ['실바', '산투스', '올리베이라'] },
  { code: 'ar', first: ['마테오', '티아고', '산티아고'], last: ['고메스', '페르난데스', '로드리게스'] },
  { code: 'fr', first: ['위고', '레오', '루이'], last: ['뒤랑', '모로', '르페브르'] },
  { code: 'de', first: ['레온', '루카', '핀'], last: ['뮐러', '슈미트', '피셔'] },
  { code: 'es', first: ['파블로', '알바로', '마르코스'], last: ['가르시아', '로페스', '토레스'] },
  { code: 'it', first: ['레오나르도', '마르코', '루카'], last: ['로시', '리치', '콜롬보'] },
  { code: 'gb-eng', first: ['해리', '잭', '올리버'], last: ['워커', '베넷', '홀랜드'] },
  { code: 'nl', first: ['다안', '레비', '핀'], last: ['더용', '판다이크', '바커'] },
  { code: 'pt', first: ['주앙', '디오구', '누누'], last: ['페레이라', '코스타', '멘드스'] },
  { code: 'gb-wls', first: ['오언', '리스', '엘리스'], last: ['존스', '데이비스', '에번스'] },
  { code: 'ru', first: ['이반', '드미트리', '아르툠'], last: ['이바노프', '스미르노프', '페트로프'] },
  { code: 'ua', first: ['올렉산드르', '드미트로', '안드리'], last: ['셰우첸코', '코발렌코', '보이코'] },
  { code: 'hu', first: ['벤체', '마르크', '아담'], last: ['너지', '코바치', '서보'] },
  { code: 'cz', first: ['야쿠프', '얀', '토마시'], last: ['노바크', '스보보다', '드보르자크'] },
  { code: 'hr', first: ['이반', '마테오', '루카'], last: ['코바치', '호르바트', '마리치'] },
]

const YOUTH_POSITIONS = ['CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST', 'GK']

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

function between(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

// 유스 1명 생성 — id는 youth_s{season}_{n}(DB/필러와 충돌 불가 네임스페이스).
export function generateYouth({ season, index, rng, position: forcedPosition }) {
  const nation = pick(rng, NATIONS)
  // position 옵셔널(월드 로스터 생성이 포지션 밸런스를 위해 지정) — 없으면 기존대로 랜덤.
  const position = forcedPosition ?? pick(rng, YOUTH_POSITIONS)
  const core = POSITION_CORE_STATS[position]
  const age = between(rng, 15, 17)

  // 포지션 원형: 주 스탯 62~72, 보조 50~62 — 즉시 로테이션급, 성장하면 주전급.
  const stats = {}
  for (const key of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']) {
    stats[key] = core.includes(key) ? between(rng, 62, 72) : between(rng, 50, 62)
  }
  if (position === 'GK') {
    // GK는 defending이 세이브 능력의 근간(엔진 규약) — 필드 스탯 하향.
    stats.shooting = between(rng, 20, 34)
    stats.dribbling = between(rng, 30, 44)
  }

  const overallNow = playerOverallRating({ positions: [position], stats })
  const potential = Math.min(96, overallNow + between(rng, 8, 25))

  return {
    id: `youth_s${season}_${index}`,
    name: `${pick(rng, nation.last)} ${pick(rng, nation.first)}`.trim(),
    era: 'active',
    age,
    positions: [position],
    nationality: nation.code, // 기존 16종 코드(assets/flags/<code>.svg와 1:1)
    club: '유스 아카데미',
    number: between(rng, 26, 45), // 유스 관례 높은 번호
    stats,
    traits: [],
    potential,
  }
}

// 스카우트 별점(★1~5) — 정확한 potential은 은닉하고 근사 등급만 노출(재미 장치).
export function scoutStars(candidate) {
  const gain = candidate.potential - playerOverallRating(candidate)
  if (gain >= 21) return 5
  if (gain >= 16) return 4
  if (gain >= 11) return 3
  if (gain >= 6) return 2
  return 1
}
