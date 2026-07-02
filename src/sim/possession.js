import { pickWeighted } from './rng.js'
import { successChance, rollSuccess } from './duel.js'
import { applyTraitHooks } from './traits.js'
import { staminaFactor } from './stamina.js'
import { BANDS, zoneDistance, pickChannel } from './zones.js'
import { primaryPosition } from '../data/player-schema.js'

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

function makeEvent(type, fields) {
  return { type, ...fields }
}

function progressionScore(stats) {
  return (stats.passing + stats.dribbling) / 2
}

// possessing/defending 각각: { squad11, stamina, tactics }
export function resolveChain({ possessing, defending, teamLabel, minute, rng, divisor }) {
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

  const createScore = progressionScore(creator.player.stats) * creatorStaminaF * (creatorMods.scoreMult ?? 1)
  const defendScore = presser.player.stats.defending * presserStaminaF * (presserMods.scoreMult ?? 1)

  const createChance = successChance(createScore, defendScore, divisor ?? CREATE_DIVISOR)
  if (!rollSuccess(rng, createChance)) {
    return [makeEvent('turnover_buildup', {
      minute, team: teamLabel, actorId: presser.player.id,
      zoneFrom: BANDS[0], zoneTo: BANDS[3], channel,
    })]
  }

  // 2단계 "마무리" — 파이널서드에서 박스 안으로, 슈팅까지.
  const shooter = pickActor(possessing.squad11, 4, channel, 'shooting', rng)
  const assister = pickActor(possessing.squad11, 3, channel, 'passing', rng)
  const gk = goalkeeperEntry(defending.squad11)

  const shooterStaminaF = staminaFactor(possessing.stamina, shooter.player.id)
  const gkStaminaF = staminaFactor(defending.stamina, gk.player.id)

  const shotCtx = { duelType: 'shot', zoneBand: 'BOX', channel, footChannel: footChannelOf(channel) }
  const shotMods = applyTraitHooks(shooter.player, 'onShot', shotCtx)

  const shotQuality = shooter.player.stats.shooting * shooterStaminaF * (shotMods.accuracyMult ?? 1)
  const saveScore = gk.player.stats.defending * gkStaminaF

  const rawFinishChance = successChance(shotQuality, saveScore, divisor ?? FINISH_DIVISOR)
  const goalChance = rawFinishChance * FINISH_BASELINE_SCALE
  if (rollSuccess(rng, goalChance)) {
    return [makeEvent('goal', {
      minute, team: teamLabel, actorId: shooter.player.id, assistId: assister.player.id,
      zoneFrom: BANDS[3], zoneTo: BANDS[4], channel,
    })]
  }

  const outcomeType = rng() < 0.45 ? 'shot_off_target' : 'shot_saved'
  const fields = {
    minute, team: teamLabel, actorId: shooter.player.id,
    zoneFrom: BANDS[3], zoneTo: BANDS[4], channel,
  }
  if (outcomeType === 'shot_saved') fields.gkId = gk.player.id
  return [makeEvent(outcomeType, fields)]
}

export function decidePossession(midfieldRatingA, midfieldRatingB, rng) {
  const total = midfieldRatingA + midfieldRatingB
  if (total <= 0) return rng() < 0.5
  return rng() * total < midfieldRatingA
}
