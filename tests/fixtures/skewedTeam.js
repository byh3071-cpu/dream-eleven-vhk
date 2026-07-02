import { findFormation } from '../../src/data/formations.js'

// width(폭) 지침 검증 전용 픽스처. syntheticTeam.js(flat 스탯)로는 width를 검증할 수 없다 —
// 채널이 바뀌어도 pickActor 풀에 들어오는 선수 스탯이 다 똑같으면 결과가 항상 동일하기
// 때문. 측면(LB/RB/LW/RW)과 중앙 포지션의 스탯을 의도적으로 갈라놓아야
// "넓게 vs 좁게"가 실제로 다른 선수를 기용하게 만들고, 그 차이가 결과에 드러난다.
const WIDE_ROLES = new Set(['LB', 'RB', 'LW', 'RW'])

export function makeSkewedTeam(wideStat, centralStat, formationId = '4-3-3') {
  const formation = findFormation(formationId)
  const squad11 = formation.slots.map((slot, index) => {
    const stat = WIDE_ROLES.has(slot.role) ? wideStat : centralStat
    return {
      player: {
        id: `skewed-${formationId}-${wideStat}-${centralStat}-${index}`,
        name: `Skewed ${slot.role}${index}`,
        era: 'active',
        age: 27,
        positions: [slot.role],
        stats: {
          pace: stat, shooting: stat, passing: stat, dribbling: stat, defending: stat, physical: stat,
        },
        traits: [],
      },
      slotIndex: index,
    }
  })
  return { squad11, formation }
}
