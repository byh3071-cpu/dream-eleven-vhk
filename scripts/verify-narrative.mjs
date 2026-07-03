// goal 20 게이트 — "시즌 종료 서사가 세이브에 축적·열람". 5시즌 자동 플레이(회견
// 자동 답변) 후 판정: ①history 5개 전부 story ≥3문장 ②은퇴 발생 + 로스터 하한 유지
// ③통산 득점 누적 단조 증가 ④pressLog에 시즌당 최대 3건 축적.

import * as store from '../src/career/store.js'
import { pressQuestionOf } from '../src/career/press.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  }
}

const storage = fakeStorage()
store.initCareer(storage)
store.newCareer({ userClubId: 'aurum', masterSeed: 20260704, storage })
let save = store.draftCatchUp(storage)
while (save.phase === 'draft') save = store.draftPick(save.draftState.availableIds[0], storage)

function answerIfPending() {
  if (store.getCareer().pendingPress) {
    const q = pressQuestionOf(store.getCareer().pendingPress)
    save = store.answerPress(q.answers[0].id, storage)
  }
}

let prevTotal = 0
let failures = 0
for (let season = 1; season <= 5; season++) {
  for (let round = 1; round <= 12 && save.phase === 'season'; round++) {
    answerIfPending()
    save = store.finishRound({}, storage)
  }
  if (save.phase === 'gameover') { console.log('✗ 게임오버로 중단'); failures++; break }
  save = store.enterTransferWindow(storage)
  answerIfPending() // closing
  const entry = save.history.at(-1)
  const total = Object.values(save.careerTotals).reduce((a, b) => a + b, 0)
  const rosterMin = Math.min(...Object.values(save.rosters).map((ids) => ids.length))
  const line = `시즌 ${season}: story ${entry.story.length}문장 · 은퇴 누적 ${save.retiredLog.length} · 통산골 ${total} · 최소 로스터 ${rosterMin}`
  const ok = entry.story.length >= 3 && total >= prevTotal && rosterMin >= 15
  console.log(ok ? '✓' : '✗', line)
  if (!ok) failures++
  prevTotal = total
  save = store.startSeasonAfterTransfer(storage)
}

const pressCount = save.pressLog.length
console.log(`\n기자회견 응답 누적 ${pressCount}건 · 은퇴 ${save.retiredLog.length}명 · 서사 시즌 ${save.history.length}개`)
if (failures > 0 || save.retiredLog.length < 3 || pressCount < 8) {
  console.log('❌ narrative 게이트 실패')
  process.exit(1)
}
console.log('✅ narrative 게이트 통과 — 서사가 세이브에 축적된다')
