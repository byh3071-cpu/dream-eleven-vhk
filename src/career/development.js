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
        // 성장 속도는 potential 스팬(+8~25)에 맞춘다 — 첫 실측(+1~2/3시즌)은 유망주
        // 서사가 밋밋했다. 가중 레이팅 기준 시즌당 +2~4 수준.
        for (const key of core) {
          stats[key] = Math.min(99, stats[key] + 2 + (rng() < 0.6 ? 1 : 0))
        }
        const sideKeys = Object.keys(stats).filter((k) => !core.includes(k))
        for (const sideKey of sideKeys) {
          if (rng() < 0.5) stats[sideKey] = Math.min(99, stats[sideKey] + 1)
        }
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
