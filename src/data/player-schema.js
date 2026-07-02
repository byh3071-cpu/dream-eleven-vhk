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
  gb: '잉글랜드',
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
