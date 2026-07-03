import { pickWeighted } from './rng.js'
import { successChance, rollSuccess } from './duel.js'
import { applyTraitHooks } from './traits.js'
import { staminaFactor } from './stamina.js'
import { BANDS, zoneDistance, pickChannel } from './zones.js'
import { primaryPosition } from '../data/player-schema.js'
import { mentalityAttackMult, mentalityDefendMult, pressingDefendMult, tempoAccuracyMult } from './tactics-modifiers.js'
import { resolveFreeKick, resolveCorner, resolvePenalty } from './setpieces.js'
import { TUNABLES } from './tunables.js'

// ============================================================================
// 아웃컴/서술 2계층 (v2 N1) + 리얼리즘 이벤트 (v2 N2)
//
//   resolveChain = narrateChain( resolveChainOutcome(chainRng만), narrationRng만 )
//
// - resolveChainOutcome: 승부를 결정하는 판정부. N2에서 파울/카드/세트피스/PK/오프사이드
//   분기가 추가돼 chainRng draw 구조가 v1과 달라졌다 — 계약은 이제 비트 동일성이 아니라
//   몬테카를로 "범위" 게이트(engine.montecarlo)+리얼리즘 게이트(engine.realism)이고,
//   핀 테스트는 N2 확정 상수 기준으로 재기록됐다.
// - narrateChain: 이미 결정된 결과를 이벤트 시퀀스로 풀어쓴다. narrationRng(0x3)만
//   소비하고 chainRng는 시그니처에 없다 — 서술이 판정을 오염시키는 사고를 구조적으로 차단.
//   홉별 성공 확률을 다시 굴리지 않는 이유: 단계 확률을 곱하면 복리 증폭 문제
//   (실측: 25점 격차가 승률 85%+로 폭주)가 재발한다.
// ============================================================================

// 민감도/기본 난이도 분리 원칙(v1에서 계승):
// divisor(민감도)는 넉넉하게 잡아 스탯 격차의 체감을 완만하게 하고, 기본 난이도는
// FINISH_BASELINE_SCALE(tunables.js) 같은 배율로 별도 조절한다 — 배율은 양쪽에 동일하게
// 적용되므로 민감도를 안 건드린다. 상세 근거는 git 이력의 v1 주석과 docs/state/learnings.md.
const CREATE_DIVISOR = 250
const FINISH_DIVISOR = 150

const OUTFIELD_POOL_SIZE = 4

// 서술 파라미터 — 승부와 무관, "몇 개의 홉으로 보여줄지"만 좌우.
const TACKLE_NARRATION_CHANCE = 0.5
const EXCHANGE_BASE_CHANCE = 0.25
const EXCHANGE_TEMPO_SPAN = 0.35

function outfieldEntries(squad11) {
  return squad11.filter(({ player }) => !player.positions.includes('GK'))
}

function goalkeeperEntry(squad11) {
  return squad11.find(({ player }) => player.positions.includes('GK'))
}

function pickActor(squad11, bandIndex, channel, statKey, rng) {
  const outfield = outfieldEntries(squad11)
  const ranked = outfield
    .map((entry) => ({ entry, distance: zoneDistance(primaryPosition(entry.player), bandIndex, channel) }))
    .sort((a, b) => a.distance - b.distance)
  const pool = ranked.slice(0, OUTFIELD_POOL_SIZE).map((r) => r.entry)
  return pickWeighted(rng, pool, (e) => Math.max(1, e.player.stats[statKey]))
}

function footChannelOf(channel) {
  if (channel === 'LEFT') return 'left'
  if (channel === 'RIGHT') return 'right'
  return 'center'
}

function progressionScore(stats) {
  return (stats.passing + stats.dribbling) / 2
}

function otherTeam(label) {
  return label === 'A' ? 'B' : 'A'
}

// 카드 판정 1회 — 반환: null | 'yellow' | 'red' | 'second_yellow'(경고 누적 퇴장).
// defending.bookings(엔진이 넘겨주는 누적 경고)와 sentOffCount(팀 레드 상한 2)를 존중한다.
function rollCard(rng, fouler, defending, yellowChance) {
  const roll = rng()
  let card = null
  if (roll < TUNABLES.DIRECT_RED_CHANCE) card = 'red'
  else if (roll < TUNABLES.DIRECT_RED_CHANCE + yellowChance) card = 'yellow'
  if (card === 'yellow' && (defending.bookings?.[fouler.player.id] ?? 0) >= 1) {
    // 이미 부킹된 선수 — 주심이 두 번째 경고(=퇴장)를 아끼는 현실을 확률로 반영.
    // 자동 승격이면 파울러 풀(4명)의 중복 부킹 탓에 레드가 실측 0.20/경기까지 폭증했다.
    card = rng() < TUNABLES.SECOND_YELLOW_FACTOR ? 'second_yellow' : null
  }
  if ((card === 'red' || card === 'second_yellow') && (defending.sentOffCount ?? 0) >= 2) {
    // 팀당 퇴장 상한(경기 붕괴 방지) — 그냥 거친 파울로 끝난 것으로 본다.
    card = null
  }
  return card
}

// ---------------------------------------------------------------------------
// 아웃컴 계층 — chainRng만 소비.
// ---------------------------------------------------------------------------
export function resolveChainOutcome({ possessing, defending, teamLabel, minute, rng, divisor }) {
  const channel = pickChannel(rng, possessing.tactics?.width ?? 0.5)

  const creator = pickActor(possessing.squad11, 3, channel, 'dribbling', rng)
  const presser = pickActor(defending.squad11, 3, channel, 'defending', rng)

  // ---- 빌드업 파울 (체인당 2롤, 삽입형 — 체인을 끊지 않고 FK로 재개) ----
  // 압박이 높은 팀일수록 태클 시도가 늘어 파울도 는다. tackle_specialist는 깔끔한
  // 태클러라 파울 위험이 낮다(onFoulRisk 훅 — N2에서 신설).
  const pressingCoupling = 1 + ((defending.tactics?.pressing ?? 0.5) - 0.5) * 0.5
  const fouls = []
  for (const bandIdx of [1, 2]) {
    const fouler = pickActor(defending.squad11, bandIdx, channel, 'defending', rng)
    const riskMult = applyTraitHooks(fouler.player, 'onFoulRisk', {}).riskMult ?? 1
    if (rollSuccess(rng, TUNABLES.FOUL_BASE_CHANCE * pressingCoupling * riskMult)) {
      fouls.push({ fouler, bandIdx, card: rollCard(rng, fouler, defending, TUNABLES.YELLOW_CHANCE) })
    }
  }

  // ---- 창조 듀얼 (v1 구조 그대로) ----
  const creatorStaminaF = staminaFactor(possessing.stamina, creator.player.id)
  const presserStaminaF = staminaFactor(defending.stamina, presser.player.id)

  const createCtx = { duelType: 'progression', zoneBand: BANDS[3], channel, role: 'attack' }
  const presserCtx = { ...createCtx, role: 'defend' }
  const creatorMods = applyTraitHooks(creator.player, 'onDuel', createCtx)
  const presserMods = applyTraitHooks(presser.player, 'onDuel', presserCtx)

  const createScore = progressionScore(creator.player.stats) * creatorStaminaF
    * (creatorMods.scoreMult ?? 1)
    * mentalityAttackMult(possessing.tactics?.mentality)
    * tempoAccuracyMult(possessing.tactics?.tempo)
  const defendScore = presser.player.stats.defending * presserStaminaF
    * (presserMods.scoreMult ?? 1)
    * mentalityDefendMult(defending.tactics?.mentality)
    * pressingDefendMult(defending.tactics?.pressing)

  const base = { teamLabel, minute, channel, creator, presser, fouls }

  const createChance = successChance(createScore, defendScore, divisor ?? CREATE_DIVISOR)
  if (!rollSuccess(rng, createChance)) {
    // 창조 실패 분기: 위험지역 FK(수비가 반칙으로 끊음) / 걷어내다 코너 / 정상 턴오버.
    if (rollSuccess(rng, TUNABLES.P_DANGER_FK)) {
      const dangerFoulCard = rollCard(rng, presser, defending, TUNABLES.YELLOW_CHANCE_DANGER)
      const fk = resolveFreeKick({ possessing, defending, channel, rng })
      return { ...base, createSuccess: false, failMode: 'free_kick', dangerFoulCard, fk }
    }
    if (rollSuccess(rng, TUNABLES.P_FAIL_CORNER)) {
      const corner = resolveCorner({ possessing, defending, channel, rng })
      return { ...base, createSuccess: false, failMode: 'corner', corner }
    }
    return { ...base, createSuccess: false, failMode: 'turnover' }
  }

  // ---- 마무리 (창조 성공) ----
  const shooter = pickActor(possessing.squad11, 4, channel, 'shooting', rng)
  const assister = pickActor(possessing.squad11, 3, channel, 'passing', rng)
  const gk = goalkeeperEntry(defending.squad11)
  const success = { ...base, createSuccess: true, shooter, assister, gk }

  // 침투가 깃발에 걸림 — 슛 기회 자체가 무산.
  if (rollSuccess(rng, TUNABLES.P_OFFSIDE)) {
    return { ...success, offside: true }
  }

  // 박스 반칙 → 페널티킥.
  if (rollSuccess(rng, TUNABLES.P_PENALTY)) {
    const pkFouler = pickActor(defending.squad11, 4, channel, 'defending', rng)
    const card = rollCard(rng, pkFouler, defending, TUNABLES.YELLOW_CHANCE_DANGER)
    const result = resolvePenalty({ shooter, gk, possessing, defending, rng })
    return { ...success, penalty: { fouler: pkFouler, card, result } }
  }

  // 슛이 수비에 막혀 코너로.
  if (rollSuccess(rng, TUNABLES.P_BLOCKED_CORNER)) {
    const corner = resolveCorner({ possessing, defending, channel, rng })
    return { ...success, blockedCorner: corner }
  }

  // 오픈플레이 슛.
  const shooterStaminaF = staminaFactor(possessing.stamina, shooter.player.id)
  const gkStaminaF = staminaFactor(defending.stamina, gk.player.id)
  const shotMods = applyTraitHooks(shooter.player, 'onShot', {
    duelType: 'shot', zoneBand: 'BOX', channel, footChannel: footChannelOf(channel),
  })
  const shotQuality = shooter.player.stats.shooting * shooterStaminaF
    * (shotMods.accuracyMult ?? 1) * mentalityAttackMult(possessing.tactics?.mentality)
  const saveScore = gk.player.stats.defending * gkStaminaF

  const goalChance = successChance(shotQuality, saveScore, divisor ?? FINISH_DIVISOR)
    * TUNABLES.FINISH_BASELINE_SCALE
  let finish
  if (rollSuccess(rng, goalChance)) finish = 'goal'
  else finish = rng() < 0.45 ? 'shot_off_target' : 'shot_saved'
  return { ...success, finish }
}

// ---------------------------------------------------------------------------
// 서술 계층 — narrationRng만 소비.
// ---------------------------------------------------------------------------
export function narrateChain(outcome, possessing, narrationRng) {
  const { teamLabel, minute, channel } = outcome
  const events = []
  const base = { minute, team: teamLabel }
  const foulTeam = otherTeam(teamLabel)

  let holder = pickActor(possessing.squad11, 0, channel, 'passing', narrationRng)

  // 파울(있다면)을 해당 밴드 도달 직후에 삽입: foul(+카드) → FK 재개(피해자가 킥).
  const emitFoul = (foul, bandIdx) => {
    const zone = { zoneFrom: BANDS[bandIdx], zoneTo: BANDS[bandIdx], channel }
    events.push({
      type: 'foul', ...base, team: foulTeam, actorId: foul.fouler.player.id,
      victimId: holder.player.id, dangerous: false, ...zone,
    })
    emitCards(foul.card, foul.fouler, zone)
    events.push({ type: 'free_kick', ...base, takerId: holder.player.id, variant: 'restart', ...zone })
  }

  const emitCards = (card, fouler, zone) => {
    if (!card) return
    if (card === 'yellow' || card === 'second_yellow') {
      events.push({ type: 'yellow_card', ...base, team: foulTeam, actorId: fouler.player.id, ...zone })
    }
    if (card === 'red' || card === 'second_yellow') {
      events.push({ type: 'red_card', ...base, team: foulTeam, actorId: fouler.player.id, ...zone })
    }
  }

  const advance = (toBandIdx, candidate) => {
    const fromBand = BANDS[toBandIdx - 1]
    const toBand = BANDS[toBandIdx]
    if (candidate.player.id === holder.player.id) {
      events.push({ type: 'carry', ...base, actorId: holder.player.id, zoneFrom: fromBand, zoneTo: toBand, channel })
    } else {
      events.push({
        type: 'pass', ...base, fromId: holder.player.id, toId: candidate.player.id,
        zoneFrom: fromBand, zoneTo: toBand, channelFrom: channel, channelTo: channel,
        style: 'ground',
      })
      holder = candidate
    }
  }

  // 빌드업: 밴드 0 → 1 → 2 (+ 밴드별 파울 삽입).
  advance(1, pickActor(possessing.squad11, 1, channel, 'passing', narrationRng))
  const foulAtBand1 = outcome.fouls.find((f) => f.bandIdx === 1)
  if (foulAtBand1) emitFoul(foulAtBand1, 1)

  advance(2, pickActor(possessing.squad11, 2, channel, 'passing', narrationRng))
  const foulAtBand2 = outcome.fouls.find((f) => f.bandIdx === 2)
  if (foulAtBand2) emitFoul(foulAtBand2, 2)

  // 티키타카: 중원 원터치 교환(템포 낮을수록 잦음 — 전술이 화면에 보이는 연결점).
  const tempo = possessing.tactics?.tempo ?? 0.5
  if (narrationRng() < EXCHANGE_BASE_CHANCE + (1 - tempo) * EXCHANGE_TEMPO_SPAN) {
    const hops = narrationRng() < 0.4 ? 3 : 2
    for (let i = 0; i < hops; i++) {
      const mate = pickActor(possessing.squad11, 2, channel, 'passing', narrationRng)
      if (mate.player.id === holder.player.id) continue
      events.push({
        type: 'pass', ...base, fromId: holder.player.id, toId: mate.player.id,
        zoneFrom: BANDS[2], zoneTo: BANDS[2], channelFrom: channel, channelTo: channel,
        style: 'short',
      })
      holder = mate
    }
  }

  // 파이널서드 진입은 아웃컴이 정한 creator에게.
  advance(3, outcome.creator)

  const band3 = { zoneFrom: BANDS[3], zoneTo: BANDS[3], channel }
  const boxZone = { zoneFrom: BANDS[4], zoneTo: BANDS[4], channel }

  // 크로스 계열(FK 크로스/코너) 공통 종결 — via로 경로 구분.
  const emitCrossTerminal = (cross, via) => {
    if (cross.result === 'goal') {
      events.push({ type: 'goal', ...base, actorId: cross.attacker.player.id, via, ...boxZone })
    } else if (cross.result === 'shot_saved') {
      events.push({ type: 'shot_saved', ...base, actorId: cross.attacker.player.id, gkId: cross.gk.player.id, via, ...boxZone })
    } else {
      events.push({ type: 'clearance', ...base, actorId: cross.defender.player.id, ...boxZone })
    }
  }

  const emitCorner = (corner, via) => {
    const side = channel === 'CENTER'
      ? (narrationRng() < 0.5 ? 'LEFT' : 'RIGHT')
      : channel
    events.push({ type: 'corner_kick', ...base, takerId: corner.taker.player.id, side, ...boxZone })
    emitCrossTerminal(corner.cross, via)
  }

  if (!outcome.createSuccess) {
    if (outcome.failMode === 'free_kick') {
      // 위험지역 파울: presser가 creator를 반칙으로 끊음 → FK(직접/크로스).
      events.push({
        type: 'foul', ...base, team: foulTeam, actorId: outcome.presser.player.id,
        victimId: outcome.creator.player.id, dangerous: true, ...band3,
      })
      emitCards(outcome.dangerFoulCard, outcome.presser, band3)
      const fk = outcome.fk
      events.push({ type: 'free_kick', ...base, takerId: fk.taker.player.id, variant: fk.variant, ...band3 })
      if (fk.variant === 'direct') {
        const shotZone = { zoneFrom: BANDS[3], zoneTo: BANDS[4], channel }
        if (fk.result === 'goal') {
          events.push({ type: 'goal', ...base, actorId: fk.taker.player.id, via: 'free_kick', ...shotZone })
        } else if (fk.result === 'shot_saved') {
          events.push({ type: 'shot_saved', ...base, actorId: fk.taker.player.id, gkId: fk.gk.player.id, via: 'free_kick', ...shotZone })
        } else {
          events.push({ type: 'shot_off_target', ...base, actorId: fk.taker.player.id, via: 'free_kick', ...shotZone })
        }
      } else {
        emitCrossTerminal(fk.cross, 'header_fk')
      }
      return events
    }
    if (outcome.failMode === 'corner') {
      // 걷어내다 코너 — 진입 시도가 굴절돼 라인 아웃.
      emitCorner(outcome.corner, 'header_corner')
      return events
    }
    // 정상 턴오버.
    events.push({
      type: 'turnover_buildup', ...base,
      actorId: outcome.presser.player.id, victimId: outcome.creator.player.id,
      cause: narrationRng() < TACKLE_NARRATION_CHANCE ? 'tackle' : 'interception',
      zoneFrom: BANDS[2], zoneTo: BANDS[3], channel,
    })
    return events
  }

  // ---- 성공 분기 ----
  const { shooter, assister, gk } = outcome

  // 오프사이드: 어시스터까지 간 뒤 침투 패스가 깃발에 걸린다.
  if (outcome.offside) {
    if (assister.player.id !== holder.player.id) {
      events.push({
        type: 'pass', ...base, fromId: holder.player.id, toId: assister.player.id,
        zoneFrom: BANDS[3], zoneTo: BANDS[3], channelFrom: channel, channelTo: channel, style: 'ground',
      })
      holder = assister
    }
    events.push({
      type: 'offside', ...base, actorId: shooter.player.id, fromId: holder.player.id,
      zoneFrom: BANDS[3], zoneTo: BANDS[4], channel,
    })
    return events
  }

  // 마무리 빌드업: creator → assister(밴드3 횡) → shooter(3→4 키패스/carry).
  if (assister.player.id !== holder.player.id) {
    events.push({
      type: 'pass', ...base, fromId: holder.player.id, toId: assister.player.id,
      zoneFrom: BANDS[3], zoneTo: BANDS[3], channelFrom: channel, channelTo: channel, style: 'ground',
    })
    holder = assister
  }
  if (shooter.player.id !== holder.player.id) {
    events.push({
      type: 'pass', ...base, fromId: holder.player.id, toId: shooter.player.id,
      zoneFrom: BANDS[3], zoneTo: BANDS[4], channelFrom: channel, channelTo: channel, style: 'ground',
    })
    holder = shooter
  } else {
    events.push({ type: 'carry', ...base, actorId: holder.player.id, zoneFrom: BANDS[3], zoneTo: BANDS[4], channel })
  }

  // 페널티킥.
  if (outcome.penalty) {
    const pk = outcome.penalty
    events.push({
      type: 'penalty_awarded', ...base, team: foulTeam,
      actorId: pk.fouler.player.id, victimId: shooter.player.id, ...boxZone,
    })
    emitCards(pk.card, pk.fouler, boxZone)
    if (pk.result === 'goal') {
      events.push({ type: 'goal', ...base, actorId: shooter.player.id, via: 'penalty', ...boxZone })
    } else {
      events.push({ type: 'shot_saved', ...base, actorId: shooter.player.id, gkId: gk.player.id, via: 'penalty', ...boxZone })
    }
    return events
  }

  // 슛이 막혀 코너.
  if (outcome.blockedCorner) {
    emitCorner(outcome.blockedCorner, 'header_corner')
    return events
  }

  // 오픈플레이 슛.
  const shotBase = { ...base, actorId: shooter.player.id, ...boxZone, via: 'open_play' }
  if (outcome.finish === 'goal') {
    events.push({ type: 'goal', ...shotBase, assistId: assister.player.id })
  } else if (outcome.finish === 'shot_saved') {
    events.push({ type: 'shot_saved', ...shotBase, gkId: gk.player.id })
  } else {
    events.push({ type: 'shot_off_target', ...shotBase })
  }
  return events
}

// possessing/defending 각각: { squad11, stamina, tactics, bookings?, sentOffCount? }
export function resolveChain({ possessing, defending, teamLabel, minute, rng, narrationRng, divisor }) {
  const outcome = resolveChainOutcome({ possessing, defending, teamLabel, minute, rng, divisor })
  return narrateChain(outcome, possessing, narrationRng)
}

export function decidePossession(midfieldRatingA, midfieldRatingB, rng) {
  const total = midfieldRatingA + midfieldRatingB
  if (total <= 0) return rng() < 0.5
  return rng() * total < midfieldRatingA
}
