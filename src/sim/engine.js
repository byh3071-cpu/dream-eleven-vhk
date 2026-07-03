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

function buildStats(events) {
  const stats = {
    A: { shots: 0, shotsOnTarget: 0, goals: 0, possessions: 0 },
    B: { shots: 0, shotsOnTarget: 0, goals: 0, possessions: 0 },
  }
  for (const evt of events) {
    const teamStats = stats[evt.team]
    // 서술 이벤트(pass/carry)는 한 체인에 여러 개가 딸려온다 — possessions는 체인당
    // 정확히 1개인 종료 이벤트만 센다. 거부목록이 아니라 허용목록인 이유: N2에서
    // foul/corner 같은 비종료 이벤트가 늘어날 때마다 여길 고치는 걸 잊으면 통계가
    // 조용히 오염되기 때문(허용목록이면 새 타입은 기본적으로 안 세짐).
    if (TERMINAL_TYPES.includes(evt.type)) teamStats.possessions++
    if (evt.type === 'shot_off_target') teamStats.shots++
    if (evt.type === 'shot_saved') { teamStats.shots++; teamStats.shotsOnTarget++ }
    if (evt.type === 'goal') { teamStats.shots++; teamStats.shotsOnTarget++; teamStats.goals++ }
  }
  return stats
}

// team = { squad11: [{player, slotIndex}], formation, tactics? }
// squad11는 teamStrength.computeTeamRatings와 possession.resolveChain이 공유하는 입력 형태.
// divisor를 명시하지 않으면 possession.js의 단계별 기본값(CREATE_DIVISOR/FINISH_DIVISOR)을 쓴다.
// 테스트에서 특정 divisor로 강제 검증하고 싶을 때만 명시적으로 넘긴다.
export function simulateMatch({ home, away, seed, divisor }) {
  // 구조 판정(체인 수/타이밍/포제션 승자 — 매 체인 정확히 1회 draw)과 체인 내부 판정
  // (가변 길이 draw)을 별도 스트림으로 분리한다 — 이유는 rng.js의 deriveSeed 주석 참고.
  // narrationRng(0x3)는 서술 계층 전용: 서술이 몇 번을 뽑든 chainRng(판정)에 영향 0.
  // (가변 draw여도 단일 스트림을 체인 순서대로 소비하므로 결정론은 유지 — 같은 논리.)
  const structureRng = createRng(deriveSeed(seed, 0x1))
  const chainRng = createRng(deriveSeed(seed, 0x2))
  const narrationRng = createRng(deriveSeed(seed, 0x3))

  const ratingsHome = computeTeamRatings(home.squad11, home.formation)
  const ratingsAway = computeTeamRatings(away.squad11, away.formation)

  const staminaHome = initialStaminaState(home.squad11)
  const staminaAway = initialStaminaState(away.squad11)

  const pressingHome = home.tactics?.pressing ?? 0.5
  const pressingAway = away.tactics?.pressing ?? 0.5
  const tempoDelta = tempoChainDelta(home.tactics?.tempo, away.tactics?.tempo)
  const chainCount = Math.max(10, Math.round(
    BASE_CHAIN_COUNT + (pressingHome + pressingAway) * 3 + tempoDelta + randInt(structureRng, -3, 3),
  ))
  const minutes = distributeMinutes(chainCount, structureRng)

  const events = []
  let lastMinute = 0

  const possessingHomeCtx = () => ({ squad11: home.squad11, stamina: staminaHome, tactics: home.tactics })
  const possessingAwayCtx = () => ({ squad11: away.squad11, stamina: staminaAway, tactics: away.tactics })

  minutes.forEach((minute, chainId) => {
    decayStamina(staminaHome, home.squad11, minute - lastMinute, pressingHome)
    decayStamina(staminaAway, away.squad11, minute - lastMinute, pressingAway)
    lastMinute = minute

    const homeHasBall = decidePossession(ratingsHome.midfieldRating, ratingsAway.midfieldRating, structureRng)
    const chainEvents = resolveChain({
      possessing: homeHasBall ? possessingHomeCtx() : possessingAwayCtx(),
      defending: homeHasBall ? possessingAwayCtx() : possessingHomeCtx(),
      teamLabel: homeHasBall ? 'A' : 'B',
      minute,
      rng: chainRng,
      narrationRng,
      divisor,
    })
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
