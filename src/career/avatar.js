// 선수 모드 아바타 — 커스텀 '나'를 만들고, 친선으로 부트스트랩 성장시킨다.
// docs/world/PLAYER-MODE-DESIGN.md의 척추: 15세 아바타는 리그 XI 미달 → 리그 성장 신호 0.
// 그래서 친선이 1순위 부트스트랩 엔진(아바타를 XI에 강제 포함) → 스탯↑ → 레이팅이 pickBestXI
// 바를 넘으면 리그 출전이 실력으로 언락된다. 아바타는 frozen(경로의존, 세이브에 눌러쓰는 stats).
//
// save-구조 독립: 순수 함수로 avatar 객체·teammates·opponents 배열만 받는다(나중 world 포팅이
// 재배선이지 재작성 아니게 — 39개국 무재작성 원칙 동일).

import { simulateMatch } from '../sim/engine.js'
import { pickBestXI } from './aiLineup.js'
import { ratePlayers } from '../sim/playerRatings.js'
import { findFormation } from '../data/formations.js'
import { DEFAULT_TACTICS } from '../sim/tactics-modifiers.js'
import { playerOverallRating, positionFit } from '../sim/teamStrength.js'
import { POSITION_CORE_STATS, applyGrowthStep } from './development.js'
import { createRng, deriveSeed } from '../sim/rng.js'

const STAT_KEYS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']

function hashId(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
function between(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

// 커스텀 아바타 생성 — 이름·포지션·유형(유스15세/기성) 지정. frozen(경로의존) + 높은 potential.
export function createAvatar({ id = 'me_1', name = '나', position = 'ST', kind = 'youth', nationality = 'kr', seed = 1 } = {}) {
  const rng = createRng(deriveSeed(seed, hashId(id)))
  const core = POSITION_CORE_STATS[position] ?? ['passing', 'physical']
  const lo = kind === 'youth' ? 44 : 64
  const hi = kind === 'youth' ? 58 : 78
  const stats = {}
  for (const key of STAT_KEYS) {
    stats[key] = core.includes(key) ? between(rng, lo + 6, hi) : between(rng, Math.max(20, lo - 4), hi - 8)
  }
  if (position === 'GK') { stats.shooting = between(rng, 20, 34); stats.dribbling = between(rng, 30, 44) }
  const age = kind === 'youth' ? 15 : between(rng, 24, 28)
  const overall = playerOverallRating({ positions: [position], stats })
  return {
    id, name, era: 'active', age, positions: [position], nationality,
    club: '', number: 99, stats, traits: [],
    potential: Math.min(96, overall + between(rng, 22, 36)), // 유스 높은 잠재(무명→스타)
    frozen: true, // 경로의존 — developPlayer 시즌 파생 우회(players.js/development.js)
  }
}

// 친선 XI 빌더 — 아바타를 자기 포지션 적합도 최고 슬롯에 **강제 삽입**(pickBestXI 우회).
// 이게 부트스트랩의 핵심: 15세도 무조건 선발되어 평점이 생겨야 성장 신호가 0이 아니다.
function forceAvatarXI(avatar, teammates, formationId, rosterMap) {
  const formation = findFormation(formationId)
  const base = pickBestXI({ rosterIds: teammates.map((p) => p.id), resolvePlayer: (id) => rosterMap[id], formationId })
  if (!base) return null
  const isGkAvatar = avatar.positions.includes('GK')
  let bestSlot = -1
  let bestFit = -1
  for (const { slotIndex } of base.assignments) {
    const role = formation.slots[slotIndex].role
    if ((role === 'GK') !== isGkAvatar) continue // GK↔필드 교차 금지
    const fit = positionFit(avatar.positions, role)
    if (fit > bestFit) { bestFit = fit; bestSlot = slotIndex }
  }
  if (bestSlot < 0) return null
  const assignments = base.assignments.map((a) =>
    a.slotIndex === bestSlot ? { slotIndex: bestSlot, playerId: avatar.id } : a)
  return {
    squad11: assignments.map((a) => ({ player: rosterMap[a.playerId], slotIndex: a.slotIndex })),
    formation,
    tactics: { ...DEFAULT_TACTICS },
  }
}

// 친선 한 경기 시뮬 → { result, avatarRating }. 아바타 강제 선발이라 항상 평점이 나온다.
export function playFriendly({ avatar, teammates, opponents, formationId = '4-4-2', seed }) {
  const rosterMap = {}
  for (const p of [avatar, ...teammates, ...opponents]) rosterMap[p.id] = p
  const home = forceAvatarXI(avatar, teammates, formationId, rosterMap)
  const awayXI = pickBestXI({ rosterIds: opponents.map((p) => p.id), resolvePlayer: (id) => rosterMap[id], formationId })
  if (!home || !awayXI) return null
  const away = {
    squad11: awayXI.assignments.map((a) => ({ player: rosterMap[a.playerId], slotIndex: a.slotIndex })),
    formation: findFormation(formationId),
    tactics: { ...DEFAULT_TACTICS },
  }
  const result = simulateMatch({ home, away, seed })
  const ratings = ratePlayers({
    events: result.events, score: result.score,
    homeSquad11: home.squad11, awaySquad11: away.squad11,
  })
  const row = ratings.find((r) => r.playerId === avatar.id)
  return { result, avatarRating: row ? row.value : null }
}

// 활약(평점) → 성장. applyGrowthStep 공유(훈련 포커스=focusBoost). potential 캡·안 뛰면 성장 0.
// 평점 7+=호성적 가속, 6미만=저성장. 아바타 stats를 눌러쓴 새 객체 반환(경로의존).
export function growAvatar(avatar, rating, { focusBoost = 0, seed = 1 } = {}) {
  if (rating == null) return avatar // 벤치/미출전 = 성장 신호 없음
  if (playerOverallRating(avatar) >= (avatar.potential ?? 99)) return avatar // 캡
  const core = POSITION_CORE_STATS[avatar.positions[0]] ?? ['passing', 'physical']
  const rng = createRng(deriveSeed(seed, hashId(avatar.id) + Math.round(rating * 10)))
  const perfBoost = rating >= 7 ? 1 : (rating >= 6 ? 0 : -1)
  const stats = applyGrowthStep(avatar.stats, core, rng, { focusBoost: Math.max(0, focusBoost + perfBoost) })
  return { ...avatar, stats }
}
