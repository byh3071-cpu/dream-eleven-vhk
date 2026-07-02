import { eventCommentary } from '../../src/sim/commentary.js'

const STUB_PLAYERS = {
  mbappe: { name: '킬리안 음바페' },
  iniesta: { name: '안드레스 이니에스타' },
  buffon: { name: '잔루이지 부폰' },
}
const findPlayer = (id) => STUB_PLAYERS[id]

describe('eventCommentary', () => {
  test('turnover_buildup은 null(스팸 방지 — 26개 중 평균 11개로 압도적 다수)', () => {
    expect(eventCommentary({ type: 'turnover_buildup', minute: 10, team: 'A', actorId: 'mbappe' }, findPlayer))
      .toBeNull()
  })

  test('goal은 팀 라벨/득점자/어시스트를 모두 포함한다', () => {
    const text = eventCommentary(
      { type: 'goal', minute: 12, team: 'A', actorId: 'mbappe', assistId: 'iniesta' }, findPlayer)
    expect(text).toContain('12')
    expect(text).toContain('홈')
    expect(text).toContain('킬리안 음바페')
    expect(text).toContain('안드레스 이니에스타')
  })

  test('원정팀(B) 이벤트는 "원정"으로 표기한다', () => {
    const text = eventCommentary(
      { type: 'shot_off_target', minute: 33, team: 'B', actorId: 'mbappe' }, findPlayer)
    expect(text).toContain('원정')
  })

  test('shot_saved은 골키퍼 이름을 포함한다', () => {
    const text = eventCommentary(
      { type: 'shot_saved', minute: 50, team: 'A', actorId: 'mbappe', gkId: 'buffon' }, findPlayer)
    expect(text).toContain('잔루이지 부폰')
  })

  test('알 수 없는 타입은 null', () => {
    expect(eventCommentary({ type: 'unknown_type', minute: 1, team: 'A' }, findPlayer)).toBeNull()
  })
})
