// 생성 리그 팀 생성기 — 국가 프로필(도시풀)에서 도시별 가상 애칭 구단을 생성한다.
// 플래그십 4개국(한·일·영·스)은 수작업 clubs 데이터, 나머지 35개국은 이 생성기가 채운다.
// 색은 hsl() 문자열로 생성(JS hex 리터럴 금지 — designLint). 결정론: deriveSeed 파생.

import { createRng, deriveSeed } from '../sim/rng.js'

// 팀명 접미 풀 — 도시 + 접미 조합(도시가 유니크라 접미 중복 허용). 여러 나라 톤을 아우르는 중립셋.
const SUFFIXES = [
  'FC', 'SC', 'CF', '유나이티드', '시티', '로버스', '아틀레틱', '스타스',
  '이글스', '라이온스', '유니온', '메트로', '레인저스', '워리어스', '다이너모',
]

function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)]
}

// 국가별 네이밍 톤 — code → 패턴(나라당 2~4개). pre=접두형(AS 파리), suf=접미형(트라브존 스포르).
// 실제 그 나라 축구 관례 반영. 없는 code(cn·vn·ir·eg·sn·ci 등)는 중립 SUFFIXES 폴백 —
// 도시 반복 과다(카이로·다카르·아비장)라 접두 하나로 몰면 동명 대량 발생.
const TONE = {
  fr: [{ pre: '올랭피크' }, { pre: 'AS' }, { pre: 'RC' }, { pre: '스타드' }],
  de: [{ pre: 'FC' }, { pre: 'SV' }, { pre: 'VfB' }, { pre: '보루시아' }],
  it: [{ pre: 'AC' }, { pre: 'SSC' }, { pre: 'US' }, { suf: '칼초' }],
  pt: [{ pre: '스포르팅' }, { pre: '비토리아' }, { pre: 'FC' }, { pre: 'CD' }],
  nl: [{ pre: 'FC' }, { pre: 'SC' }, { pre: 'VV' }],
  be: [{ pre: '로얄' }, { pre: 'KV' }, { pre: 'KRC' }, { pre: 'RSC' }],
  ch: [{ pre: 'FC' }, { pre: 'BSC' }, { pre: 'SC' }],
  at: [{ pre: 'SK' }, { pre: 'FK' }, { pre: 'SV' }],
  ru: [{ pre: 'FK' }, { pre: '스파르타크' }, { pre: '디나모' }, { pre: '로코모티프' }],
  tr: [{ suf: '스포르' }, { suf: '스포르' }, { pre: 'FK' }],
  no: [{ pre: 'FK' }, { pre: 'IK' }, { pre: 'SK' }],
  se: [{ pre: 'IFK' }, { suf: 'IF' }, { suf: 'FF' }, { suf: 'BK' }],
  cz: [{ pre: 'FC' }, { pre: 'SK' }, { pre: '슬로반' }, { pre: '빅토리아' }],
  sco: [{ suf: '시슬' }, { suf: '애슬레틱' }, { pre: '세인트' }, { suf: '카운티' }],
  hr: [{ pre: 'NK' }, { pre: 'HNK' }, { pre: 'GNK' }],
  br: [{ pre: '아틀레치쿠' }, { pre: 'EC' }, { pre: 'SC' }, { pre: 'CR' }],
  ar: [{ pre: '아틀레티코' }, { pre: 'CA' }, { pre: '라싱' }, { suf: '후니오르스' }],
  us: [{ suf: 'FC' }, { suf: 'SC' }, { pre: '스포팅' }, { pre: '인터' }],
  mx: [{ pre: '클루브' }, { pre: 'CF' }, { pre: '데포르티보' }, { pre: '아틀레티코' }],
  co: [{ pre: '아틀레티코' }, { pre: '인데펜디엔테' }, { pre: '데포르티보' }, { pre: '아메리카' }],
  ec: [{ pre: 'CD' }, { pre: 'CS' }, { pre: '리가' }, { pre: '데포르티보' }],
  ca: [{ suf: 'FC' }, { suf: '유나이티드' }, { pre: '아틀레티코' }, { suf: '원더러스' }],
  pa: [{ pre: 'CD' }, { suf: 'FC' }, { pre: '데포르티보' }],
  py: [{ pre: '클루브' }, { pre: '스포르티보' }, { pre: '데포르티보' }, { pre: '아틀레티코' }],
  au: [{ suf: 'FC' }, { suf: '시티' }, { suf: '유나이티드' }, { suf: '원더러스' }],
  sa: [{ pre: '알' }, { pre: '알' }, { suf: 'SC' }, { suf: 'FC' }],
  qa: [{ pre: '알' }, { pre: '알' }, { suf: 'SC' }, { suf: 'FC' }],
  ma: [{ pre: 'AS' }, { pre: 'RS' }, { suf: '아틀레틱' }],
  tn: [{ pre: 'ES' }, { pre: 'CS' }, { pre: 'CA' }, { pre: 'US' }],
}

function applyTone(pattern, city) {
  return pattern.pre ? `${pattern.pre} ${city}` : `${city} ${pattern.suf}`
}

// 국가 프로필 → 생성 구단 배열(korea.js 등 플래그십과 동일 필드 스키마). 도시당 1팀.
// nation: { code, country, leagueName, teams, cities[], strengthTier, style }
export function generateClubs(nation, seed) {
  const rng = createRng(deriveSeed(seed, hashStr(nation.code)))
  const cities = nation.cities.slice(0, nation.teams)
  const tone = TONE[nation.code] // 국가별 톤(없으면 중립 SUFFIXES 폴백)
  return cities.map((city, i) => {
    // 톤 유무 무관하게 pick()로 rng를 정확히 1회 소비 → 뒤 hue draw 위치 불변(색값 보존).
    const name = tone ? applyTone(pick(rng, tone), city) : `${city} ${pick(rng, SUFFIXES)}`
    const hue = Math.floor(rng() * 360)
    return {
      id: `${nation.code}_${i}`,
      name,
      en: '',
      city,
      primary: `hsl(${hue} 62% 46%)`,      // 생성 색(hex 아님 — designLint 무관)
      secondary: `hsl(${hue} 22% 90%)`,
      nickname: '',
      stadium: `${city} 스타디움`,
      generated: true,                      // 생성 팀 마커(플래그십과 구분)
    }
  })
}

// 국가 프로필 → 리그 정의(leagues.js 항목과 동일 형태). 강도티어를 재정/승강 근사에 반영.
// clubs는 generateClubs로 지연 생성하지 않고, 조립 시점에 주입한다(seed 고정).
export function nationToLeague(nation, seed) {
  return {
    id: `${nation.code}_league`,
    name: nation.leagueName,
    country: nation.country,
    tier: 1,
    clubs: generateClubs(nation, seed),
    rounds: 2,                              // 생성 리그 기본 더블 라운드로빈
    tiebreak: ['points', 'goalDiff', 'goalsFor'],
    strengthTier: nation.strengthTier,      // 1~5 — 로스터 강도/재정에 반영(C-4 튜닝)
    style: nation.style,
    promotion: 0, relegation: 3,
    generated: true,
  }
}
