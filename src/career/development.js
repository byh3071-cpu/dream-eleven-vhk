// 선수 성장/쇠퇴(에이징) — 저장하지 않는 파생 계산(순위표와 같은 원칙: 세이브엔
// 원본만, 나이·스탯 변화는 시즌 번호에서 매 조회 시 파생 — 드리프트 원천 차단).
// 시즌별 변화량은 deriveSeed(masterSeed, 시즌·선수 해시) 결정론이라 같은 세이브는
// 영원히 같은 성장 궤적을 그린다.

import { createRng, deriveSeed } from '../sim/rng.js'
import { playerOverallRating } from '../sim/teamStrength.js'

const AGING_SALT = 0xa9e5

export const GROWTH_END_AGE = 23 // 이하 성장
export const DECLINE_START_AGE = 30 // 이상 신체 쇠퇴, 34+ 기술도

// 포지션 원형별 "주 스탯" — 성장이 여기에 우선 배분된다. youthGen과 공유.
export const POSITION_CORE_STATS = {
  GK: ['defending', 'physical'],
  CB: ['defending', 'physical'],
  LB: ['pace', 'defending'],
  RB: ['pace', 'defending'],
  DM: ['defending', 'passing'],
  CM: ['passing', 'dribbling'],
  AM: ['passing', 'dribbling'],
  LM: ['pace', 'dribbling'],
  RM: ['pace', 'dribbling'],
  LW: ['pace', 'dribbling'],
  RW: ['pace', 'dribbling'],
  ST: ['shooting', 'physical'],
}

function idHash(id) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash
}

// 성장 상한 — 유스는 생성 시 명시(potential), DB/필러 선수는 id 해시 파생(+4~13).
export function potentialOf(player) {
  if (player.potential) return player.potential
  return Math.min(99, playerOverallRating(player) + 4 + (idHash(player.id) % 10))
}

// base(원본 불변)에 시즌 경과분 에이징을 적용한 새 객체를 돌려준다.
export function developPlayer(base, save) {
  const seasonsPassed = (save?.season?.number ?? 1) - 1
  // 아바타(frozen)는 경로의존(경기로 큰 값이 진실)이라 시즌 파생 에이징을 통째 우회한다.
  // dampenPlayer(피로/폼)는 resolve 체인에서 별도 유지되고, 아바타의 나이·쇠퇴는 선수 모드
  // 성장 스텝이 명시 처리한다(docs/world/PLAYER-MODE-DESIGN.md — frozen은 developPlayer 한정).
  if (base.frozen || seasonsPassed <= 0) return base

  const stats = { ...base.stats }
  const core = POSITION_CORE_STATS[base.positions[0]] ?? ['passing', 'physical']
  const potential = potentialOf(base)

  for (let s = 1; s <= seasonsPassed; s++) {
    const ageAtSeason = base.age + s
    const rng = createRng(deriveSeed(save.masterSeed, AGING_SALT + s * 1009 + (idHash(base.id) % 997)))

    if (ageAtSeason <= GROWTH_END_AGE) {
      // 성장 — potential 도달 전이면 주 스탯 +1~2, 보조 1종 +0~1.
      // 캡 판정은 표시와 같은 "포지션 가중 레이팅"으로(단순 평균은 가중과 어긋나
      // 캡을 뚫는 실측 버그가 있었다).
      const overallNow = playerOverallRating({ ...base, stats })
      if (overallNow < potential) {
        // 성장 배분은 공용 헬퍼(applyGrowthStep)로 — 시즌 파생(여기)과 선수 모드 아바타(활약
        // 트리거)가 같은 배분을 공유한다. focusBoost 미지정 = 기존 rng 순서·동작 그대로 보존.
        Object.assign(stats, applyGrowthStep(stats, core, rng))
      }
    }

    if (ageAtSeason >= DECLINE_START_AGE) {
      // 쇠퇴 — 신체부터, 34+는 기술도.
      stats.pace = Math.max(1, stats.pace - 1 - (rng() < 0.4 ? 1 : 0))
      stats.physical = Math.max(1, stats.physical - 1)
      if (ageAtSeason >= 34) {
        stats.passing = Math.max(1, stats.passing - 1)
        stats.dribbling = Math.max(1, stats.dribbling - 1)
      }
    }
  }

  return { ...base, age: base.age + seasonsPassed, stats }
}

// 성장 1스텝 배분(순수 함수, rng 주입) — core 주 스탯 +2(+60% 확률 +1), side 각 50% +1.
// developPlayer(시즌 파생·NPC)와 선수 모드 아바타(활약→성장, docs/world/PLAYER-MODE-DESIGN.md)가
// 공유한다. 훈련 포커스는 focusBoost로 core 성장 가중(친선 안에서 선택). potential 캡·나이 게이트는
// 호출부 책임. 아바타는 save-구조 독립 입력만 받으므로 나중 world 포팅이 재배선(재작성 X).
export function applyGrowthStep(stats, core, rng, { focusBoost = 0 } = {}) {
  const next = { ...stats }
  for (const key of core) {
    next[key] = Math.min(99, next[key] + 2 + focusBoost + (rng() < 0.6 ? 1 : 0))
  }
  const sideKeys = Object.keys(next).filter((k) => !core.includes(k))
  for (const sideKey of sideKeys) {
    if (rng() < 0.5) next[sideKey] = Math.min(99, next[sideKey] + 1)
  }
  return next
}
