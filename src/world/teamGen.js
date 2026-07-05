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

// 국가 프로필 → 생성 구단 배열(korea.js 등 플래그십과 동일 필드 스키마). 도시당 1팀.
// nation: { code, country, leagueName, teams, cities[], strengthTier, style }
export function generateClubs(nation, seed) {
  const rng = createRng(deriveSeed(seed, hashStr(nation.code)))
  const cities = nation.cities.slice(0, nation.teams)
  return cities.map((city, i) => {
    const suffix = pick(rng, SUFFIXES)
    const hue = Math.floor(rng() * 360)
    return {
      id: `${nation.code}_${i}`,
      name: `${city} ${suffix}`,
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
