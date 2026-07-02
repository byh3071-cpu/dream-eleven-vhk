// M1 픽스처 데이터셋 (16~20명 목표 → 전 포지션 최소 커버 + 레전드/현역 혼합).
// 시뮬레이션 엔진 검증(Goal 2)과 최초 수동 플레이용. Goal 6에서 60~100명으로 확장.
//
// 스탯은 실제 대회 기록(득점/우승/수상 이력)과 축구 팬덤 내 통설을 참고해
// 개발자가 상대적으로 매긴 근사치이며, 특정 기관의 공식 평가가 아니다.
// 실사진 대신 이니셜/실루엣 아바타를 쓰므로 초상권 노출 최소화 — assets/avatars 참고.
//
// "호날두"는 크리스티아누 호날두(ronaldo_cr7)와 브라질의 호나우두(ronaldo_r9)가
// 혼용되므로 id/표시명을 명확히 분리한다.

export const PLAYERS = [
  {
    id: 'buffon', name: '잔루이지 부폰', era: 'legend', age: 41,
    positions: ['GK'],
    stats: { pace: 50, shooting: 20, passing: 60, dribbling: 40, defending: 93, physical: 82 },
    traits: ['veteran_declining'],
  },
  {
    id: 'neuer', name: '마누엘 노이어', era: 'active', age: 37,
    positions: ['GK'],
    stats: { pace: 58, shooting: 25, passing: 75, dribbling: 55, defending: 91, physical: 80 },
    traits: [],
  },
  {
    id: 'maldini', name: '파올로 말디니', era: 'legend', age: 40,
    positions: ['CB', 'LB'],
    stats: { pace: 78, shooting: 45, passing: 75, dribbling: 65, defending: 95, physical: 85 },
    traits: ['tackle_specialist', 'veteran_declining'],
  },
  {
    id: 'beckenbauer', name: '프란츠 베켄바우어', era: 'legend', age: 32,
    positions: ['CB'],
    stats: { pace: 75, shooting: 55, passing: 88, dribbling: 78, defending: 90, physical: 78 },
    traits: ['playmaker_vision'],
  },
  {
    id: 'ramos', name: '세르히오 라모스', era: 'active', age: 38,
    positions: ['CB'],
    stats: { pace: 72, shooting: 60, passing: 70, dribbling: 62, defending: 90, physical: 88 },
    traits: ['aerial_threat', 'tackle_specialist'],
  },
  {
    id: 'cafu', name: '카푸', era: 'legend', age: 34,
    positions: ['RB'],
    stats: { pace: 90, shooting: 55, passing: 72, dribbling: 75, defending: 82, physical: 84 },
    traits: [],
  },
  {
    id: 'roberto_carlos', name: '호베르투 카를로스', era: 'legend', age: 31,
    positions: ['LB'],
    stats: { pace: 93, shooting: 82, passing: 75, dribbling: 80, defending: 78, physical: 86 },
    traits: ['left_footed', 'free_kick_specialist'],
  },
  {
    id: 'makelele', name: '클로드 마켈렐레', era: 'legend', age: 30,
    positions: ['DM'],
    stats: { pace: 68, shooting: 40, passing: 72, dribbling: 65, defending: 88, physical: 80 },
    traits: ['tackle_specialist'],
  },
  {
    id: 'casemiro', name: '카세미루', era: 'active', age: 32,
    positions: ['DM'],
    stats: { pace: 65, shooting: 58, passing: 75, dribbling: 68, defending: 87, physical: 85 },
    traits: ['tackle_specialist', 'aerial_threat'],
  },
  {
    id: 'zidane', name: '지네딘 지단', era: 'legend', age: 30,
    positions: ['CM', 'AM'],
    stats: { pace: 72, shooting: 85, passing: 92, dribbling: 93, defending: 66, physical: 78 },
    traits: ['playmaker_vision'],
  },
  {
    id: 'modric', name: '루카 모드리치', era: 'active', age: 38,
    positions: ['CM'],
    stats: { pace: 74, shooting: 72, passing: 90, dribbling: 88, defending: 62, physical: 65 },
    traits: ['playmaker_vision'],
  },
  {
    id: 'xavi', name: '차비 에르난데스', era: 'legend', age: 32,
    positions: ['CM'],
    stats: { pace: 62, shooting: 65, passing: 94, dribbling: 85, defending: 60, physical: 58 },
    traits: ['playmaker_vision'],
  },
  {
    id: 'iniesta', name: '안드레스 이니에스타', era: 'legend', age: 30,
    positions: ['LM', 'AM'],
    stats: { pace: 76, shooting: 74, passing: 89, dribbling: 94, defending: 55, physical: 58 },
    traits: ['dribbler'],
  },
  {
    id: 'beckham', name: '데이비드 베컴', era: 'legend', age: 29,
    positions: ['RM'],
    stats: { pace: 78, shooting: 82, passing: 90, dribbling: 76, defending: 55, physical: 68 },
    traits: ['right_footed', 'free_kick_specialist'],
  },
  {
    id: 'messi', name: '리오넬 메시', era: 'active', age: 36,
    positions: ['RW', 'AM'],
    stats: { pace: 85, shooting: 92, passing: 90, dribbling: 96, defending: 35, physical: 68 },
    traits: ['left_footed', 'dribbler', 'free_kick_specialist'],
  },
  {
    id: 'ronaldo_cr7', name: '크리스티아누 호날두', era: 'active', age: 39,
    positions: ['LW', 'ST'],
    stats: { pace: 88, shooting: 94, passing: 80, dribbling: 88, defending: 35, physical: 88 },
    traits: ['right_footed', 'aerial_threat', 'poacher'],
  },
  {
    id: 'ronaldo_r9', name: '호나우두', era: 'legend', age: 25,
    positions: ['ST'],
    stats: { pace: 96, shooting: 93, passing: 75, dribbling: 92, defending: 30, physical: 82 },
    traits: ['dribbler', 'poacher'],
  },
  {
    id: 'pele', name: '펠레', era: 'legend', age: 29,
    positions: ['ST', 'RW'],
    stats: { pace: 90, shooting: 94, passing: 82, dribbling: 92, defending: 40, physical: 78 },
    traits: ['poacher', 'dribbler'],
  },
  {
    id: 'maradona', name: '디에고 마라도나', era: 'legend', age: 25,
    positions: ['AM', 'CM'],
    stats: { pace: 85, shooting: 87, passing: 88, dribbling: 97, defending: 45, physical: 70 },
    traits: ['left_footed', 'dribbler', 'playmaker_vision'],
  },
  {
    id: 'van_basten', name: '마르코 반 바스텐', era: 'legend', age: 27,
    positions: ['ST'],
    stats: { pace: 82, shooting: 91, passing: 74, dribbling: 83, defending: 35, physical: 78 },
    traits: ['poacher', 'aerial_threat'],
  },
  {
    id: 'mbappe', name: '킬리안 음바페', era: 'active', age: 26,
    positions: ['LW', 'ST'],
    stats: { pace: 97, shooting: 88, passing: 78, dribbling: 90, defending: 38, physical: 78 },
    traits: ['right_footed', 'poacher'],
  },
  // 사용자 피드백 반영 (2026-07-02) — 로스터 리뷰 후 포지션 커버리지 보강용 11명 추가.
  {
    id: 'yashin', name: '레프 야신', era: 'legend', age: 33,
    positions: ['GK'],
    stats: { pace: 55, shooting: 15, passing: 65, dribbling: 45, defending: 94, physical: 80 },
    traits: [],
  },
  {
    id: 'cannavaro', name: '파비오 칸나바로', era: 'legend', age: 33,
    positions: ['CB'],
    stats: { pace: 74, shooting: 40, passing: 72, dribbling: 62, defending: 94, physical: 82 },
    traits: ['tackle_specialist'],
  },
  {
    id: 'nesta', name: '알레산드로 네스타', era: 'legend', age: 28,
    positions: ['CB'],
    stats: { pace: 76, shooting: 35, passing: 74, dribbling: 68, defending: 95, physical: 83 },
    traits: ['tackle_specialist'],
  },
  {
    id: 'lahm', name: '필립 람', era: 'legend', age: 30,
    positions: ['RB', 'LB', 'DM'],
    stats: { pace: 84, shooting: 55, passing: 85, dribbling: 82, defending: 84, physical: 70 },
    traits: ['tackle_specialist', 'playmaker_vision'],
  },
  {
    id: 'matthaus', name: '로타어 마테우스', era: 'legend', age: 29,
    positions: ['CM', 'DM'],
    stats: { pace: 74, shooting: 82, passing: 86, dribbling: 75, defending: 78, physical: 84 },
    traits: ['playmaker_vision', 'tackle_specialist'],
  },
  {
    id: 'cruyff', name: '요한 크루이프', era: 'legend', age: 27,
    positions: ['ST', 'AM'],
    stats: { pace: 88, shooting: 85, passing: 90, dribbling: 93, defending: 45, physical: 65 },
    traits: ['playmaker_vision', 'dribbler'],
  },
  {
    id: 'sneijder', name: '베슬리 스네이더', era: 'legend', age: 26,
    positions: ['AM', 'CM'],
    stats: { pace: 72, shooting: 86, passing: 91, dribbling: 84, defending: 45, physical: 62 },
    traits: ['playmaker_vision', 'free_kick_specialist'],
  },
  {
    id: 'robben', name: '아르연 로벤', era: 'legend', age: 28,
    positions: ['RW', 'RM'],
    stats: { pace: 93, shooting: 87, passing: 78, dribbling: 92, defending: 30, physical: 68 },
    traits: ['left_footed', 'dribbler'],
  },
  {
    id: 'ribery', name: '프랑크 리베리', era: 'legend', age: 30,
    positions: ['LW', 'LM'],
    stats: { pace: 89, shooting: 80, passing: 82, dribbling: 94, defending: 32, physical: 65 },
    traits: ['dribbler'],
  },
  {
    id: 'shevchenko', name: '안드리 셰브첸코', era: 'legend', age: 28,
    positions: ['ST', 'LW'],
    stats: { pace: 88, shooting: 92, passing: 72, dribbling: 85, defending: 32, physical: 80 },
    traits: ['poacher', 'aerial_threat'],
  },
  {
    id: 'van_nistelrooy', name: '루드 반 니스텔로이', era: 'legend', age: 27,
    positions: ['ST'],
    stats: { pace: 80, shooting: 93, passing: 70, dribbling: 75, defending: 30, physical: 82 },
    traits: ['poacher', 'aerial_threat'],
  },
]

export function findPlayer(id) {
  return PLAYERS.find((p) => p.id === id)
}

export function playersByPosition(position) {
  return PLAYERS.filter((p) => p.positions.includes(position))
}
