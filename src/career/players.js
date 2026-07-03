// 커리어 선수 풀 = DB 72명 + 필러 GK 4명. 커멘터리/렌더러가 쓸 통합 리졸버를 제공한다
// — match 재생 계층이 db findPlayer만 쓰면 필러가 등장하는 순간 크래시하기 때문에,
// 커리어의 모든 소비자는 반드시 이 리졸버를 주입받아야 한다.

import { PLAYERS, findPlayer as findDbPlayer } from '../data/players.db.js'
import { FILLER_PLAYERS, findFillerPlayer } from './fillerPlayers.js'

export const CAREER_POOL = [...PLAYERS, ...FILLER_PLAYERS]

export function findCareerPlayer(id) {
  return findDbPlayer(id) ?? findFillerPlayer(id)
}
