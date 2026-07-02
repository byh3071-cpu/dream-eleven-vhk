import { zoneDistance, pickChannel, POSITION_HOME } from '../../src/sim/zones.js'
import { createRng } from '../../src/sim/rng.js'

describe('zoneDistance', () => {
  test('홈 밴드/채널과 정확히 일치하면 거리 0', () => {
    const home = POSITION_HOME.ST
    expect(zoneDistance('ST', home.band, home.channel)).toBe(0)
  })

  test('밴드가 멀수록 거리가 커진다', () => {
    const near = zoneDistance('CB', 1, 'CENTER')
    const far = zoneDistance('CB', 4, 'CENTER')
    expect(far).toBeGreaterThan(near)
  })

  test('반대쪽 채널(LEFT vs RIGHT)이 CENTER 경유보다 거리가 크다', () => {
    const oppositeSide = zoneDistance('LB', 0, 'RIGHT')
    const sameSide = zoneDistance('LB', 0, 'LEFT')
    expect(oppositeSide).toBeGreaterThan(sameSide)
  })

  test('알 수 없는 포지션은 매우 큰 거리를 반환한다(크래시 방지)', () => {
    expect(zoneDistance('UNKNOWN', 0, 'CENTER')).toBeGreaterThan(50)
  })
})

describe('pickChannel', () => {
  test('width가 낮으면 대부분 CENTER를 고른다', () => {
    const rng = createRng(1)
    const counts = { LEFT: 0, CENTER: 0, RIGHT: 0 }
    for (let i = 0; i < 300; i++) counts[pickChannel(rng, 0)]++
    expect(counts.CENTER).toBeGreaterThan(counts.LEFT + counts.RIGHT)
  })

  test('width가 높으면 사이드 채널 비중이 늘어난다', () => {
    const rngNarrow = createRng(2)
    const rngWide = createRng(2)
    let sideNarrow = 0
    let sideWide = 0
    for (let i = 0; i < 300; i++) {
      if (pickChannel(rngNarrow, 0.1) !== 'CENTER') sideNarrow++
      if (pickChannel(rngWide, 0.9) !== 'CENTER') sideWide++
    }
    expect(sideWide).toBeGreaterThan(sideNarrow)
  })
})
