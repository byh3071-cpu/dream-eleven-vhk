// goal 18 완료 기준 게이트 — "생성 유스가 성장해 1군 데뷔(3시즌 연속)".
// 4시즌 자동 플레이: 시즌1 종료 이적창부터 유스가 생기고, 이후 시즌마다
// ①내 유스 최고 후보 계약 ②전 유스의 성장(가중 레이팅 상승) ③1군 출전
// (seasonStats.matches>0) 여부를 실측한다. 판정: 성장 실증 + 데뷔 유스 ≥ 1.

import * as store from '../src/career/store.js'
import { resolveCareerPlayer } from '../src/career/players.js'
import { scoutStars } from '../src/career/youthGen.js'
import { playerOverallRating } from '../src/sim/teamStrength.js'

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
store.newCareer({ userClubId: 'aurum', masterSeed: 20260703, storage })
let save = store.draftCatchUp(storage)
while (save.phase === 'draft') save = store.draftPick(save.draftState.availableIds[0], storage)

const firstSeen = new Map() // youthId -> {rating, season}
let debuted = new Set()

for (let season = 1; season <= 4; season++) {
  for (let round = 1; round <= 12 && save.phase === 'season'; round++) {
    save = store.finishRound({}, storage)
  }
  // 이번 시즌 유스 출전 집계
  for (const [id, stat] of Object.entries(save.seasonStats)) {
    if (id.startsWith('youth_') && stat.matches > 0) debuted.add(id)
  }
  if (season === 4) break
  save = store.enterTransferWindow(storage)
  // 내 유스: 별점 최고 후보 계약
  const best = [...save.academyCandidates].sort((a, b) => scoutStars(b) - scoutStars(a))[0]
  if (best) save = store.signAcademyPlayer(best.id, storage)
  save = store.startSeasonAfterTransfer(storage)

  // 성장 추적
  for (const id of Object.keys(save.youthPlayers)) {
    const now = playerOverallRating(resolveCareerPlayer(save, id))
    if (!firstSeen.has(id)) firstSeen.set(id, { rating: now, season })
  }
}

let grown = 0
let eligible = 0 // 성장 기회(영입 후 ≥1시즌 경과)가 있었던 유스만 성장률 분모로 —
// 은퇴 도입 후 AI가 마지막 시즌에도 유스를 영입해 "기회 0" 개체가 분모를 오염시켰다.
for (const [id, first] of firstSeen) {
  const now = playerOverallRating(resolveCareerPlayer(save, id))
  const age = resolveCareerPlayer(save, id).age
  const delta = now - first.rating
  if (first.season < 3) {
    eligible++
    if (delta > 0) grown++
  }
  console.log(`${id.padEnd(14)} 영입 S${first.season} ${first.rating} → S${save.season.number} ${now} (${delta >= 0 ? '+' : ''}${delta}) · ${age}세${debuted.has(id) ? ' · 1군 출전 ✓' : ''}`)
}

console.log(`\n유스 총 ${firstSeen.size}명(성장 기회 ${eligible}) · 성장 ${grown}명 · 1군 데뷔 ${debuted.size}명`)
if (firstSeen.size < 6 || eligible === 0 || grown < eligible * 0.7 || debuted.size < 1) {
  console.log('❌ youth-growth 게이트 실패')
  process.exit(1)
}
console.log('✅ youth-growth 게이트 통과 — 생성 유스가 성장해 1군에 데뷔한다')
