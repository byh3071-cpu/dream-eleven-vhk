import { createRng, randInt, pickWeighted } from '../../src/sim/rng.js'

describe('createRng', () => {
  test('같은 seed면 같은 시퀀스를 재현한다', () => {
    const rngA = createRng(42)
    const rngB = createRng(42)
    const seqA = Array.from({ length: 10 }, () => rngA())
    const seqB = Array.from({ length: 10 }, () => rngB())
    expect(seqA).toEqual(seqB)
  })

  test('다른 seed면 다른 시퀀스를 만든다', () => {
    const rngA = createRng(1)
    const rngB = createRng(2)
    const seqA = Array.from({ length: 5 }, () => rngA())
    const seqB = Array.from({ length: 5 }, () => rngB())
    expect(seqA).not.toEqual(seqB)
  })

  test('0 이상 1 미만 값을 반환한다', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('randInt', () => {
  test('min~max 범위(포함) 안의 정수만 반환한다', () => {
    const rng = createRng(123)
    for (let i = 0; i < 500; i++) {
      const value = randInt(rng, 3, 7)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(7)
    }
  })
})

describe('pickWeighted', () => {
  test('weight가 0인 항목은 (다른 항목이 있으면) 거의 뽑히지 않는다', () => {
    const rng = createRng(9)
    const items = ['a', 'b']
    const counts = { a: 0, b: 0 }
    for (let i = 0; i < 200; i++) {
      counts[pickWeighted(rng, items, (item) => (item === 'a' ? 100 : 0.0001))]++
    }
    expect(counts.a).toBeGreaterThan(counts.b)
  })

  test('전체 weight 합이 0이면 첫 항목을 반환한다', () => {
    const rng = createRng(1)
    expect(pickWeighted(rng, ['x', 'y'], () => 0)).toBe('x')
  })
})
