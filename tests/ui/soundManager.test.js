// goal 21 — soundManager 순수 로직(prefs 읽기/기본값). Web Audio는 jsdom에 없어
// 재생 경로는 E2E가 검증하고, 여기선 저장/기본값 계약만 잠근다.

import { jest } from '@jest/globals'

// localStorage 폴리필(node 환경)
const store = new Map()
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

const { isSoundOn, soundVolume } = await import('../../src/ui/soundManager.js')

describe('soundManager prefs', () => {
  beforeEach(() => store.clear())

  test('기본값: 사운드 off, 볼륨 0.8', () => {
    expect(isSoundOn()).toBe(false)
    expect(soundVolume()).toBe(0.8)
  })

  test('저장된 선호를 읽는다', () => {
    localStorage.setItem('dream-eleven.prefs', JSON.stringify({ sound: true, soundVolume: 0.5 }))
    expect(isSoundOn()).toBe(true)
    expect(soundVolume()).toBe(0.5)
  })

  test('손상된 prefs는 안전 기본값', () => {
    localStorage.setItem('dream-eleven.prefs', '{ broken')
    expect(isSoundOn()).toBe(false)
    expect(soundVolume()).toBe(0.8)
  })

  test('볼륨은 0~1로 클램프', () => {
    localStorage.setItem('dream-eleven.prefs', JSON.stringify({ soundVolume: 2.5 }))
    expect(soundVolume()).toBe(1)
    localStorage.setItem('dream-eleven.prefs', JSON.stringify({ soundVolume: -1 }))
    expect(soundVolume()).toBe(0)
  })
})
