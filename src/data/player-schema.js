export const POSITIONS = Object.freeze([
  'GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LM', 'RM', 'LW', 'RW', 'ST',
])

export const STAT_KEYS = Object.freeze([
  'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
])

// 각 트레잇은 Goal 2의 TRAIT_HOOKS 테이블에서 계산식 특정 항에 연결된다.
// 여기 없는 값은 유효한 특성이 아니다 — 장식용 특성 나열 금지 원칙.
export const TRAIT_KEYS = Object.freeze([
  'left_footed',
  'right_footed',
  'free_kick_specialist',
  'aerial_threat',
  'poacher',
  'playmaker_vision',
  'dribbler',
  'veteran_declining',
  'tackle_specialist',
  'composure',
])

export const ERAS = Object.freeze(['legend', 'active'])

// 국적 코드(ISO 3166-1 alpha-2) -> 한글 표시명. assets/flags/<code>.svg와 1:1 대응.
// 새 국적을 쓰려면 국기 SVG를 먼저 assets/flags/에 추가하고 여기 등록한다.
export const NATIONALITY_NAMES = Object.freeze({
  fr: '프랑스',
  de: '독일',
  it: '이탈리아',
  es: '스페인',
  nl: '네덜란드',
  pt: '포르투갈',
  br: '브라질',
  ar: '아르헨티나',
  'gb-eng': '잉글랜드',
  'gb-wls': '웨일스',
  hr: '크로아티아',
  ru: '러시아',
  ua: '우크라이나',
  hu: '헝가리',
  cz: '체코',
  kr: '대한민국',
})

export function validatePlayer(player) {
  const errors = []
  if (!player.id || typeof player.id !== 'string') errors.push('id는 비어있지 않은 문자열이어야 함')
  if (!player.name || typeof player.name !== 'string') errors.push('name은 비어있지 않은 문자열이어야 함')
  // shortName(옵션): 뱃지 표기용 한국어 친화 애칭(반니/사비 등). 없으면 성(姓) 추출.
  if (player.shortName !== undefined && (typeof player.shortName !== 'string' || player.shortName.length === 0)) {
    errors.push('shortName은 지정 시 비어있지 않은 문자열이어야 함')
  }
  // number(옵션): 상징 등번호(펠레 10 등). 없으면 포지션 관례 번호로 표시.
  if (player.number !== undefined && (!Number.isInteger(player.number) || player.number < 1 || player.number > 99)) {
    errors.push('number는 지정 시 1~99 정수여야 함')
  }
  // potential/nationality/flag(옵션): 유스 생성 선수(goal 18) 전용 메타.
  if (player.potential !== undefined && (!Number.isInteger(player.potential) || player.potential < 1 || player.potential > 99)) {
    errors.push('potential은 지정 시 1~99 정수여야 함')
  }
  if (!ERAS.includes(player.era)) errors.push(`era는 ${ERAS.join('/')} 중 하나여야 함: ${player.era}`)
  if (!Array.isArray(player.positions) || player.positions.length === 0) {
    errors.push('positions는 비어있지 않은 배열이어야 함')
  } else {
    for (const pos of player.positions) {
      if (!POSITIONS.includes(pos)) errors.push(`알 수 없는 포지션: ${pos}`)
    }
  }
  if (typeof player.age !== 'number' || player.age < 15 || player.age > 45) {
    errors.push(`age는 15~45 사이 숫자여야 함: ${player.age}`)
  }
  if (!player.stats || typeof player.stats !== 'object') {
    errors.push('stats 객체가 필요함')
  } else {
    for (const key of STAT_KEYS) {
      const value = player.stats[key]
      if (typeof value !== 'number' || value < 1 || value > 99) {
        errors.push(`stats.${key}는 1~99 사이 숫자여야 함: ${value}`)
      }
    }
  }
  if (!Array.isArray(player.traits)) {
    errors.push('traits는 배열이어야 함 (없으면 빈 배열)')
  } else {
    for (const trait of player.traits) {
      if (!TRAIT_KEYS.includes(trait)) errors.push(`알 수 없는 특성: ${trait}`)
    }
  }
  if (!Object.keys(NATIONALITY_NAMES).includes(player.nationality)) {
    errors.push(`알 수 없는 국적 코드: ${player.nationality}`)
  }
  if (!player.club || typeof player.club !== 'string') errors.push('club은 비어있지 않은 문자열이어야 함')
  return errors
}

export function primaryPosition(player) {
  return player.positions[0]
}

// 표시용 등번호 — 상징 번호(number)가 없으면 포지션 관례 번호.
// CB만 4/5를 id 해시로 갈라 한 팀에 4번이 몰려 보이는 것을 완화한다.
const DEFAULT_NUMBER = {
  GK: 1, RB: 2, LB: 3, DM: 6, CM: 8, AM: 10, RM: 7, LM: 11, RW: 7, LW: 11, ST: 9,
}

export function playerNumberOf(player) {
  if (player.number) return player.number
  const pos = player.positions[0]
  if (pos === 'CB') {
    let hash = 0
    for (const ch of player.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
    return 4 + (hash % 2)
  }
  return DEFAULT_NUMBER[pos] ?? 8
}
