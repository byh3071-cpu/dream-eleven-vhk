// 커리어 전용 필러 골키퍼 — DB의 GK가 4명뿐이라(구단당 1명) 백업 GK 없이는
// 징계/로테이션이 성립하지 않는다. players.db.js에 넣지 않는 이유: IF 모드의
// 큐레이션 풀(레전드/현역)을 무명 필러로 오염시키지 않기 위해 — 커리어 풀 합성은
// 커리어 계층의 책임이다. id는 'filler_' 프리픽스로 DB와 충돌 불가.
// 스키마는 player-schema.js를 그대로 따른다(tests/career가 validatePlayer로 검증).

export const FILLER_PLAYERS = [
  {
    id: 'filler_gk_1', name: '한도현', era: 'active', age: 19,
    nationality: 'kr', club: '리그 유스',
    positions: ['GK'],
    stats: { pace: 52, shooting: 15, passing: 48, dribbling: 35, defending: 62, physical: 66 },
    traits: [],
  },
  {
    id: 'filler_gk_2', name: '서민혁', era: 'active', age: 20,
    nationality: 'kr', club: '리그 유스',
    positions: ['GK'],
    stats: { pace: 50, shooting: 14, passing: 52, dribbling: 33, defending: 60, physical: 64 },
    traits: [],
  },
  {
    id: 'filler_gk_3', name: '노윤성', era: 'active', age: 18,
    nationality: 'kr', club: '리그 유스',
    positions: ['GK'],
    stats: { pace: 54, shooting: 16, passing: 46, dribbling: 36, defending: 61, physical: 63 },
    traits: [],
  },
  {
    id: 'filler_gk_4', name: '배준서', era: 'active', age: 19,
    nationality: 'kr', club: '리그 유스',
    positions: ['GK'],
    stats: { pace: 51, shooting: 15, passing: 50, dribbling: 34, defending: 63, physical: 65 },
    traits: [],
  },
]

export function findFillerPlayer(id) {
  return FILLER_PLAYERS.find((p) => p.id === id)
}
