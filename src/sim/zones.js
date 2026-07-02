// 존 그리드: 길이 5밴드 × 폭 3채널. 폭이 3채널(LEFT/CENTER/RIGHT)이어도 포지션 매핑에서
// 측면(LB/LW/LM)과 중앙(CB/CM/ST)이 이미 구별되므로 "윙어 vs 풀백" 매치업 요구사항은 충족된다.
// 더 세분화된 5채널(하프스페이스 포함)은 검증 후 몰입감을 올리고 싶을 때 넣는 확장 지점.
export const BANDS = ['DEFENSE', 'OWN_MID', 'OPP_MID', 'FINAL_THIRD', 'BOX']
export const CHANNELS = ['LEFT', 'CENTER', 'RIGHT']

// 포지션별 "홈 존" — 포제션 체인이 이 밴드/채널에 도달했을 때 어느 포지션 선수가
// 관여할 가능성이 높은지 결정하는 기준점 (src/sim/possession.js의 pickActor가 사용).
export const POSITION_HOME = {
  GK: { band: -1, channel: 'CENTER' },
  CB: { band: 0, channel: 'CENTER' },
  LB: { band: 0, channel: 'LEFT' },
  RB: { band: 0, channel: 'RIGHT' },
  DM: { band: 1, channel: 'CENTER' },
  CM: { band: 2, channel: 'CENTER' },
  AM: { band: 3, channel: 'CENTER' },
  LM: { band: 2, channel: 'LEFT' },
  RM: { band: 2, channel: 'RIGHT' },
  LW: { band: 3, channel: 'LEFT' },
  RW: { band: 3, channel: 'RIGHT' },
  ST: { band: 3, channel: 'CENTER' },
}

export function zoneDistance(position, targetBandIndex, targetChannel) {
  const home = POSITION_HOME[position]
  if (!home) return 99
  const bandDist = Math.abs(home.band - targetBandIndex)
  let channelDist = 0
  if (home.channel !== targetChannel) {
    channelDist = home.channel === 'CENTER' || targetChannel === 'CENTER' ? 1 : 2
  }
  return bandDist + channelDist
}

// width 지침(0=좁게~1=넓게)에 따라 이번 포제션 체인이 진행될 채널을 고른다.
export function pickChannel(rng, width = 0.5) {
  const sideWeight = Math.min(0.45, width * 0.45)
  const roll = rng()
  if (roll < sideWeight) return 'LEFT'
  if (roll < sideWeight * 2) return 'RIGHT'
  return 'CENTER'
}
