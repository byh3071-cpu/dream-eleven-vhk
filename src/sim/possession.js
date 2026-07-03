import { pickWeighted } from './rng.js'
import { successChance, rollSuccess } from './duel.js'
import { applyTraitHooks } from './traits.js'
import { staminaFactor } from './stamina.js'
import { BANDS, zoneDistance, pickChannel } from './zones.js'
import { primaryPosition } from '../data/player-schema.js'
import { mentalityAttackMult, mentalityDefendMult, pressingDefendMult, tempoAccuracyMult } from './tactics-modifiers.js'

// ============================================================================
// 아웃컴/서술 2계층 (v2 N1)
//
//   resolveChain = narrateChain( resolveChainOutcome(chainRng만), narrationRng만 )
//
// - resolveChainOutcome: 승부를 결정하는 판정부. chainRng의 draw 순서/횟수는 v1과
//   비트 단위로 동일하다(핀 테스트 tests/sim/engine.pin.test.js가 강제). 여기서
//   확률 구조를 바꾸는 건 N2(파울/세트피스)의 일이고, 그때는 몬테카를로 "범위"
//   게이트 재통과가 계약이다.
// - narrateChain: 이미 결정된 결과를 "누가 누구에게 패스해서 어떻게 전진했나"로
//   풀어쓰는 서술부. narrationRng(deriveSeed 0x3)만 소비하고 chainRng는 시그니처에
//   아예 없다 — 서술이 판정을 오염시키는 사고를 구조적으로 차단.
//   홉별 성공 확률을 다시 굴리지 않는 이유: 단계 확률을 곱하면 복리 증폭 문제
//   (실측: 25점 격차가 승률 85%+로 폭주 — 아래 divisor 주석 참고)가 재발한다.
//   "성공/실패 여부"는 아웃컴의 창조 듀얼 1회가 결정하고, 서술은 그걸 몇 개의
//   홉으로 보여줄지만 정한다.
// ============================================================================

// 포제션 체인 = 2번의 순차 판정(창조 -> 마무리)만 거친다.
// 애초 설계는 buildup/creation/onTarget/save 4단계였는데, 4단계가 전부 같은 방향으로
// 복리로 곱해지면 스탯 격차가 실제 경기력 차이보다 훨씬 과장되게 증폭된다
// (25점 격차가 4단계 복리를 거치면 승률 95%+까지 치솟음 — 몬테카를로 게이트로 실측 확인).
// 2단계로 줄여도 여전히 두 스탯 차이가 같은 방향으로 곱해지면 25점 격차가 승률 85%+까지
// 치솟는다("창조" 확률차 × "마무리" 확률차가 곱연산으로 누적되기 때문). 그래서 "민감도"(격차가
// 확률에 얼마나 영향을 주는지, divisor로 조절)와 "기본 난이도"(동률이어도 얼마나 자주 골이
// 나오는지)를 분리했다: divisor는 넉넉하게 잡아 격차 민감도를 완만하게 하고, 마무리 단계는
// "상대 대비 상댓값(느슨한 divisor)"을 구한 뒤 별도 배율(FINISH_BASELINE_SCALE)을 곱해서
// 기본 난이도만 낮춘다 — 배율은 격차와 무관하게 양쪽에 동일하게 적용되므로 민감도를 안 건드린다.
// 파라미터 스윕 스크립트(scripts/tune-*.md 참고 없음, 세션 내 실측)로 확정한 값:
// 동률(75v75) 평균 득점 2.5~3.0골, 격차팀(90v65) 승률 60~75%를 동시에 만족.
const CREATE_DIVISOR = 250
const FINISH_DIVISOR = 150
const FINISH_BASELINE_SCALE = 0.39

const OUTFIELD_POOL_SIZE = 4

// 서술 파라미터 — 승부와 무관, "몇 개의 홉으로 보여줄지"만 좌우.
const TACKLE_NARRATION_CHANCE = 0.5 // 턴오버를 태클로 서술할 확률(나머지는 인터셉트)
// 티키타카(중원 원터치 교환): 템포가 낮을수록(참을성 있는 빌드업) 잦아진다 —
// 전술 슬라이더가 승률만이 아니라 "경기가 어떻게 보이는가"까지 바꾸는 연결점.
const EXCHANGE_BASE_CHANCE = 0.25
const EXCHANGE_TEMPO_SPAN = 0.35 // tempo 0(느림) → +0.35, tempo 1(빠름) → +0

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

// ---------------------------------------------------------------------------
// 아웃컴 계층 — chainRng만 소비. draw 순서(v1 그대로):
// pickChannel(1) → creator(1) → presser(1) → 창조 roll(1)
// → [성공 시] shooter(1) → assister(1) → 골 roll(1) → [노골 시] 궤적 roll(1)
// ---------------------------------------------------------------------------
export function resolveChainOutcome({ possessing, defending, teamLabel, minute, rng, divisor }) {
  const channel = pickChannel(rng, possessing.tactics?.width ?? 0.5)

  // 1단계 "창조" — 자기 진영에서 상대 파이널서드까지 전진해 찬스를 만든다.
  const creator = pickActor(possessing.squad11, 3, channel, 'dribbling', rng)
  const presser = pickActor(defending.squad11, 3, channel, 'defending', rng)

  const creatorStaminaF = staminaFactor(possessing.stamina, creator.player.id)
  const presserStaminaF = staminaFactor(defending.stamina, presser.player.id)

  const createCtx = { duelType: 'progression', zoneBand: BANDS[3], channel, role: 'attack' }
  const presserCtx = { ...createCtx, role: 'defend' }
  const creatorMods = applyTraitHooks(creator.player, 'onDuel', createCtx)
  const presserMods = applyTraitHooks(presser.player, 'onDuel', presserCtx)

  const creatorMentalityMult = mentalityAttackMult(possessing.tactics?.mentality)
  const creatorTempoMult = tempoAccuracyMult(possessing.tactics?.tempo)
  const presserMentalityMult = mentalityDefendMult(defending.tactics?.mentality)
  const presserPressingMult = pressingDefendMult(defending.tactics?.pressing)

  const createScore = progressionScore(creator.player.stats) * creatorStaminaF
    * (creatorMods.scoreMult ?? 1) * creatorMentalityMult * creatorTempoMult
  const defendScore = presser.player.stats.defending * presserStaminaF
    * (presserMods.scoreMult ?? 1) * presserMentalityMult * presserPressingMult

  const createChance = successChance(createScore, defendScore, divisor ?? CREATE_DIVISOR)
  if (!rollSuccess(rng, createChance)) {
    return { teamLabel, minute, channel, creator, presser, createSuccess: false }
  }

  // 2단계 "마무리" — 파이널서드에서 박스 안으로, 슈팅까지.
  const shooter = pickActor(possessing.squad11, 4, channel, 'shooting', rng)
  const assister = pickActor(possessing.squad11, 3, channel, 'passing', rng)
  const gk = goalkeeperEntry(defending.squad11)

  const shooterStaminaF = staminaFactor(possessing.stamina, shooter.player.id)
  const gkStaminaF = staminaFactor(defending.stamina, gk.player.id)

  const shotCtx = { duelType: 'shot', zoneBand: 'BOX', channel, footChannel: footChannelOf(channel) }
  const shotMods = applyTraitHooks(shooter.player, 'onShot', shotCtx)

  const shotQuality = shooter.player.stats.shooting * shooterStaminaF
    * (shotMods.accuracyMult ?? 1) * mentalityAttackMult(possessing.tactics?.mentality)
  const saveScore = gk.player.stats.defending * gkStaminaF

  const rawFinishChance = successChance(shotQuality, saveScore, divisor ?? FINISH_DIVISOR)
  const goalChance = rawFinishChance * FINISH_BASELINE_SCALE
  let finish
  if (rollSuccess(rng, goalChance)) {
    finish = 'goal'
  } else {
    finish = rng() < 0.45 ? 'shot_off_target' : 'shot_saved'
  }

  return { teamLabel, minute, channel, creator, presser, createSuccess: true, shooter, assister, gk, finish }
}

// ---------------------------------------------------------------------------
// 서술 계층 — narrationRng만 소비. 보유자 연쇄로 이벤트를 생성하므로
// 연속성 불변식(endHolder(eᵢ)==startHolder(eᵢ₊₁))이 사후 검증이 아니라
// 생성 규칙 자체로 보장된다 (tests/sim/narration.test.js가 전수 확인).
// ---------------------------------------------------------------------------
export function narrateChain(outcome, possessing, narrationRng) {
  const { teamLabel, minute, channel } = outcome
  const events = []
  const base = { minute, team: teamLabel }

  // 밴드 0(자기 진영)에서 시작 보유자 선정 — 전형적으로 CB/풀백.
  let holder = pickActor(possessing.squad11, 0, channel, 'passing', narrationRng)

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

  // 빌드업: 밴드 0 → 1 → 2.
  advance(1, pickActor(possessing.squad11, 1, channel, 'passing', narrationRng))
  advance(2, pickActor(possessing.squad11, 2, channel, 'passing', narrationRng))

  // 티키타카: 중원에서 원터치 교환 2~3회(같은 밴드 안, style 'short' — 렌더러가 빠르게
  // 페이싱). 삼각 패스가 자연스럽게 나온다(A→B→C 또는 A→B→A 리턴).
  const tempo = possessing.tactics?.tempo ?? 0.5
  const exchangeChance = EXCHANGE_BASE_CHANCE + (1 - tempo) * EXCHANGE_TEMPO_SPAN
  if (narrationRng() < exchangeChance) {
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

  // 파이널서드 진입은 아웃컴이 정한 creator에게 — 창조 듀얼이 그 선수 문맥으로 판정됐다.
  advance(3, outcome.creator)

  if (!outcome.createSuccess) {
    // 창조 실패: 파이널서드 문턱에서 presser가 끊는다.
    events.push({
      type: 'turnover_buildup', ...base,
      actorId: outcome.presser.player.id, victimId: outcome.creator.player.id,
      cause: narrationRng() < TACKLE_NARRATION_CHANCE ? 'tackle' : 'interception',
      zoneFrom: BANDS[2], zoneTo: BANDS[3], channel,
    })
    return events
  }

  // 마무리: creator → assister(밴드 3 횡) → shooter(3→4 키패스) → 슛.
  // 동일 인물 중복(creator==assister 등)이면 해당 패스를 생략/carry로 대체 —
  // v1의 자가 어시스트 아티팩트가 서술에서 자연스럽게 흡수된다.
  const { shooter, assister, gk, finish } = outcome
  if (assister.player.id !== holder.player.id) {
    events.push({
      type: 'pass', ...base, fromId: holder.player.id, toId: assister.player.id,
      zoneFrom: BANDS[3], zoneTo: BANDS[3], channelFrom: channel, channelTo: channel,
      style: 'ground',
    })
    holder = assister
  }
  if (shooter.player.id !== holder.player.id) {
    events.push({
      type: 'pass', ...base, fromId: holder.player.id, toId: shooter.player.id,
      zoneFrom: BANDS[3], zoneTo: BANDS[4], channelFrom: channel, channelTo: channel,
      style: 'ground',
    })
    holder = shooter
  } else {
    events.push({ type: 'carry', ...base, actorId: holder.player.id, zoneFrom: BANDS[3], zoneTo: BANDS[4], channel })
  }

  const shotBase = { ...base, actorId: shooter.player.id, zoneFrom: BANDS[4], zoneTo: BANDS[4], channel, via: 'open_play' }
  if (finish === 'goal') {
    events.push({ type: 'goal', ...shotBase, assistId: assister.player.id })
  } else if (finish === 'shot_saved') {
    events.push({ type: 'shot_saved', ...shotBase, gkId: gk.player.id })
  } else {
    events.push({ type: 'shot_off_target', ...shotBase })
  }
  return events
}

// possessing/defending 각각: { squad11, stamina, tactics }
// v1과 같은 진입점 — 반환이 "이벤트 1개"에서 "서술+종료 이벤트 시퀀스"로 확장됐다.
export function resolveChain({ possessing, defending, teamLabel, minute, rng, narrationRng, divisor }) {
  const outcome = resolveChainOutcome({ possessing, defending, teamLabel, minute, rng, divisor })
  return narrateChain(outcome, possessing, narrationRng)
}

export function decidePossession(midfieldRatingA, midfieldRatingB, rng) {
  const total = midfieldRatingA + midfieldRatingB
  if (total <= 0) return rng() < 0.5
  return rng() * total < midfieldRatingA
}
