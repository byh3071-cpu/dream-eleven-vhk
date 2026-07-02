import { findFormation } from '../../src/data/formations.js'

// 몬테카를로 검증용 합성 팀 — 11명 전원 6개 스탯이 flat하게 targetOverall이고
// 슬롯마다 포지션이 정확히 일치(fit=1.0)하도록 만든다. 실제 선수 데이터가 섞이면
// "포지션 적합도" 노이즈까지 끼어들어 "스탯 차이 -> 승률" 관계를 순수하게 검증하기 어려움.
export function makeSyntheticTeam(targetOverall, formationId = '4-3-3') {
  const formation = findFormation(formationId)
  const squad11 = formation.slots.map((slot, index) => ({
    player: {
      id: `synthetic-${formationId}-${targetOverall}-${index}`,
      name: `Synthetic ${targetOverall}`,
      era: 'active',
      age: 27,
      positions: [slot.role],
      stats: {
        pace: targetOverall,
        shooting: targetOverall,
        passing: targetOverall,
        dribbling: targetOverall,
        defending: targetOverall,
        physical: targetOverall,
      },
      traits: [],
    },
    slotIndex: index,
  }))
  return { squad11, formation }
}
