// 커리어 선수 풀 = DB 72명 + 필러 GK 4명. 커멘터리/렌더러가 쓸 통합 리졸버를 제공한다
// — match 재생 계층이 db findPlayer만 쓰면 필러가 등장하는 순간 크래시하기 때문에,
// 커리어의 모든 소비자는 반드시 이 리졸버를 주입받아야 한다.

import { PLAYERS, findPlayer as findDbPlayer } from '../data/players.db.js'
import { FILLER_PLAYERS, findFillerPlayer } from './fillerPlayers.js'
import { developPlayer } from './development.js'

export const CAREER_POOL = [...PLAYERS, ...FILLER_PLAYERS]

export function findCareerPlayer(id) {
  return findDbPlayer(id) ?? findFillerPlayer(id)
}

// 세이브-바운드 리졸버(goal 18) — ①유스(세이브 저장) ②DB ③필러 순서로 찾고,
// 에이징(developPlayer — 시즌 파생, 저장 0)을 얹어 돌려준다. 유스 id는 DB에 없으므로
// 드래프트 문맥(시즌1, CAREER_POOL만) 외의 모든 소비자는 반드시 이걸 써야 한다.
export function resolveCareerPlayer(save, id) {
  const base = save?.youthPlayers?.[id] ?? findDbPlayer(id) ?? findFillerPlayer(id)
  if (!base) return undefined
  return developPlayer(base, save)
}

// 주입용 커링 — resolvePlayer(id) 시그니처를 기대하는 소비자(aiLineup/squadEditor/
// matchPlayback 등)에 넘긴다.
export function resolverFor(save) {
  return (id) => resolveCareerPlayer(save, id)
}
