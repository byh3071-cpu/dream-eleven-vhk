// goal 16 재정 밸런싱 게이트 — 4구단 각각을 유저로 3시즌 자동 플레이(이적 없음,
// 자동 XI). 판정: ①파산/경질 0 ②시즌 말 유저 잔고가 [-20, 350]M(폭증/폭락 방지)
// ③신임도가 [5, 100] 유지. 상수(FINANCE)는 이 게이트를 통과하는 값으로 확정한다.

import * as store from '../src/career/store.js'
import { CLUBS } from '../src/career/clubs.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

let failures = 0
const SEASONS = 3

for (const club of CLUBS) {
  const storage = fakeStorage()
  store.initCareer(storage)
  store.newCareer({ userClubId: club.id, masterSeed: 20260703, storage })
  let save = store.draftCatchUp(storage)
  while (save.phase === 'draft') {
    save = store.draftPick(save.draftState.availableIds[0], storage)
  }

  for (let season = 1; season <= SEASONS; season++) {
    for (let round = 1; round <= 12; round++) {
      if (save.phase === 'gameover') break
      save = store.finishRound({}, storage)
    }
    const balance = save.budgets[club.id]
    const trust = save.boardTrust
    const dead = save.phase === 'gameover'
    const balanceOk = balance >= -20 && balance <= 350
    const trustOk = trust >= 5 && trust <= 100
    const line = `${club.id.padEnd(9)} 시즌${season}: 잔고 ${String(balance).padStart(4)}M · 신임도 ${String(trust).padStart(3)}`
      + (dead ? ` · 게임오버(${save.gameOverReason})` : '')
    if (dead || !balanceOk || !trustOk) {
      failures++
      console.log('✗', line, dead ? '' : !balanceOk ? '(잔고 범위 이탈)' : '(신임도 범위 이탈)')
    } else {
      console.log('✓', line)
    }
    if (dead) break
    if (season < SEASONS) {
      store.enterTransferWindow(storage)
      save = store.startSeasonAfterTransfer(storage)
    }
  }
}

if (failures > 0) {
  console.log(`\n❌ tune-finance 게이트 실패 (${failures}건) — FINANCE 상수 재튜닝 필요`)
  process.exit(1)
}
console.log('\n✅ tune-finance 게이트 통과 — 파산/경질 0, 잔고·신임도 건전 범위')
