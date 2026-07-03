import { createRng, randInt, deriveSeed } from './rng.js'
import { computeTeamRatings } from './teamStrength.js'
import { initialStaminaState, decayStamina } from './stamina.js'
import { resolveChain, decidePossession } from './possession.js'
import { tempoChainDelta } from './tactics-modifiers.js'
import { TERMINAL_TYPES } from './event-types.js'

const BASE_CHAIN_COUNT = 26
const MATCH_MINUTES = 90

function distributeMinutes(chainCount, rng) {
  const minutes = []
  for (let i = 0; i < chainCount; i++) minutes.push(randInt(rng, 1, MATCH_MINUTES))
  minutes.sort((a, b) => a - b)
  return minutes
}

function emptyTeamStats() {
  return {
    shots: 0, shotsOnTarget: 0, goals: 0, possessions: 0,
    fouls: 0, yellows: 0, reds: 0, corners: 0, offsides: 0,
  }
}

function buildStats(events) {
  const stats = { A: emptyTeamStats(), B: emptyTeamStats() }
  for (const evt of events) {
    const teamStats = stats[evt.team]
    // possessions는 체인당 정확히 1개인 종료 이벤트만 센다(허용목록 — 새 비종료 타입이
    // 늘어도 통계가 조용히 오염되지 않게). foul/카드류는 event.team이 반칙팀이라
    // 그대로 그 팀에 귀속되는 게 맞다.
    if (TERMINAL_TYPES.includes(evt.type)) teamStats.possessions++
    switch (evt.type) {
      case 'shot_off_target': teamStats.shots++; break
      case 'shot_saved': teamStats.shots++; teamStats.shotsOnTarget++; break
      case 'goal': teamStats.shots++; teamStats.shotsOnTarget++; teamStats.goals++; break
      case 'foul': teamStats.fouls++; break
      case 'penalty_awarded': teamStats.fouls++; break // PK 반칙도 파울 집계에 포함
      case 'yellow_card': teamStats.yellows++; break
      case 'red_card': teamStats.reds++; break
      case 'corner_kick': teamStats.corners++; break
      case 'offside': teamStats.offsides++; break
    }
  }
  return stats
}

// team = { squad11: [{player, slotIndex}], formation, tactics? }
// divisor를 명시하지 않으면 possession.js의 단계별 기본값(CREATE_DIVISOR/FINISH_DIVISOR)을 쓴다.
export function simulateMatch({ home, away, seed, divisor }) {
  // 구조 판정(체인 수/타이밍/포제션 승자 — 매 체인 정확히 1회 draw)과 체인 내부 판정
  // (가변 길이 draw)을 별도 스트림으로 분리한다 — 이유는 rng.js의 deriveSeed 주석 참고.
  // narrationRng(0x3)는 서술 계층 전용: 서술이 몇 번을 뽑든 chainRng(판정)에 영향 0.
  const structureRng = createRng(deriveSeed(seed, 0x1))
  const chainRng = createRng(deriveSeed(seed, 0x2))
  const narrationRng = createRng(deriveSeed(seed, 0x3))

  const staminaHome = initialStaminaState(home.squad11)
  const staminaAway = initialStaminaState(away.squad11)

  // 카드 상태(v2 N2): 경고 누적/퇴장을 엔진이 보유하고, 체인 판정에는 읽기 전용으로
  // 넘긴다(2번째 경고→퇴장 판정, 팀 레드 상한). 퇴장자는 이후 체인의 스쿼드에서
  // 빠지고(10인), 그 팀 미드필드 레이팅을 재계산해 점유 싸움이 유기적으로 불리해진다.
  const bookings = { A: {}, B: {} }
  const sentOff = { A: new Set(), B: new Set() }
  const activeSquad = (squad11, label) =>
    sentOff[label].size === 0 ? squad11 : squad11.filter((e) => !sentOff[label].has(e.player.id))

  let ratingsHome = computeTeamRatings(home.squad11, home.formation)
  let ratingsAway = computeTeamRatings(away.squad11, away.formation)

  const pressingHome = home.tactics?.pressing ?? 0.5
  const pressingAway = away.tactics?.pressing ?? 0.5
  const tempoDelta = tempoChainDelta(home.tactics?.tempo, away.tactics?.tempo)
  const chainCount = Math.max(10, Math.round(
    BASE_CHAIN_COUNT + (pressingHome + pressingAway) * 3 + tempoDelta + randInt(structureRng, -3, 3),
  ))
  const minutes = distributeMinutes(chainCount, structureRng)

  const events = []
  let lastMinute = 0

  const teamCtx = (label) => {
    const side = label === 'A'
      ? { team: home, stamina: staminaHome }
      : { team: away, stamina: staminaAway }
    return {
      squad11: activeSquad(side.team.squad11, label),
      stamina: side.stamina,
      tactics: side.team.tactics,
      bookings: bookings[label],
      sentOffCount: sentOff[label].size,
    }
  }

  const applyCardEvents = (chainEvents) => {
    let anyRed = false
    for (const evt of chainEvents) {
      if (evt.type === 'yellow_card') {
        bookings[evt.team][evt.actorId] = (bookings[evt.team][evt.actorId] ?? 0) + 1
      } else if (evt.type === 'red_card') {
        sentOff[evt.team].add(evt.actorId)
        anyRed = true
      }
    }
    if (anyRed) {
      // 10인 페널티는 별도 전역 배율이 아니라 "선수가 실제로 빠진" 스쿼드로 레이팅을
      // 다시 계산하는 방식 — 어디가 빠졌는지에 따라 영향이 달라지는 유기적 페널티.
      ratingsHome = computeTeamRatings(activeSquad(home.squad11, 'A'), home.formation)
      ratingsAway = computeTeamRatings(activeSquad(away.squad11, 'B'), away.formation)
    }
  }

  minutes.forEach((minute, chainId) => {
    decayStamina(staminaHome, home.squad11, minute - lastMinute, pressingHome)
    decayStamina(staminaAway, away.squad11, minute - lastMinute, pressingAway)
    lastMinute = minute

    const homeHasBall = decidePossession(ratingsHome.midfieldRating, ratingsAway.midfieldRating, structureRng)
    const attacking = homeHasBall ? 'A' : 'B'
    const chainEvents = resolveChain({
      possessing: teamCtx(attacking),
      defending: teamCtx(attacking === 'A' ? 'B' : 'A'),
      teamLabel: attacking,
      minute,
      rng: chainRng,
      narrationRng,
      divisor,
    })
    applyCardEvents(chainEvents)
    // chainId: 서술 불변식 테스트(체인 경계 그룹핑)와 렌더러의 체인 전환 인식용.
    for (const evt of chainEvents) events.push({ ...evt, chainId })
  })

  const stats = buildStats(events)
  return {
    events,
    score: { home: stats.A.goals, away: stats.B.goals },
    stats,
    ratings: { home: ratingsHome, away: ratingsAway },
  }
}
