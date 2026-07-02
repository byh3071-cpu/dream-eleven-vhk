// 감독 지침 4종(멘탈리티/압박/템포/폭)을 duel 스코어와 체인 밀도에 연결한다.
// 원칙(공짜 이득 금지): 한 스탯이 오르면 반드시 다른 쪽이 내려가는 트레이드오프여야
// 지침 선택이 실제 판단이 된다. 각 지침의 트레이드오프 축:
//   멘탈리티 — 같은 팀 안에서 공격 스코어↑면 수비 스코어↓ (공격/수비 시점이 갈리므로
//              possession.js에서 "내가 공격 중이면 내 멘탈리티로 attackMult,
//              내가 수비 중이면 내 멘탈리티로 defendMult"를 각각 적용해서 실현)
//   압박 강도 — 수비 가중은 즉시 효과, 대가(스태미나 소모 가속)는 engine.js의
//              decayStamina(pressingHome/Away)가 이미 담당 → 시간축 분리형 트레이드오프
//   템포     — 체인 밀도(양팀 공용, 상대에게도 기회가 늘어남)는 즉시 효과,
//              대가(자기 팀 창조 정확도 하락)는 possession.js에서 개별 적용
//   폭       — zones.pickChannel이 이미 채널 선택을 편향시키고, possession.js의
//              pickActor가 zoneDistance로 채널에 안 맞는 포지션을 페널티하므로
//              "와이드 세팅인데 측면 자원이 약하면 손해"라는 트레이드오프가 이미 성립
//              (별도 모디파이어 불필요 — 이 파일은 멘탈리티/압박/템포만 다룬다)
export const DEFAULT_TACTICS = {
  mentality: 0, // -2(초수비) ~ 0(균형) ~ +2(초공격)
  pressing: 0.5, // 0(로우블록) ~ 1(풀압박)
  tempo: 0.5, // 0(느림) ~ 1(빠름)
  width: 0.5, // 0(좁게) ~ 1(넓게) — zones.pickChannel이 직접 소비
}

const MENTALITY_MIN = -2
const MENTALITY_MAX = 2
const MENTALITY_STEP = 0.06 // 멘탈리티 1스텝당 공격/수비 스코어 ±6%

function clampMentality(mentality) {
  return Math.max(MENTALITY_MIN, Math.min(MENTALITY_MAX, mentality ?? 0))
}

// 공격 중일 때(볼 소유 팀) 자기 멘탈리티로 창조/마무리 스코어에 곱하는 배율.
export function mentalityAttackMult(mentality) {
  return 1 + clampMentality(mentality) * MENTALITY_STEP
}

// 수비 중일 때(비소유 팀) 자기 멘탈리티로 압박/저지 스코어에 곱하는 배율.
// 공격적 멘탈리티(+)일수록 수비 스코어는 낮아진다 — 라인이 높아지며 뒷공간을 내주는 셈.
export function mentalityDefendMult(mentality) {
  return 1 - clampMentality(mentality) * MENTALITY_STEP
}

// divisor(CREATE_DIVISOR=250)가 완만해서 승률에 눈에 띄게 잡히려면 스팬을 크게 잡아야 했다
// (±10%는 200경기 몬테카를로에서 승률 변화가 거의 0 — engine.tactics.test.js 실측 근거로 확정).
const PRESSING_DEFEND_SPAN = 0.80 // pressing 0~1 -> defendScore -40%~+40%

// 수비 중일 때 자기 압박 강도로 창조 단계 저지 스코어에 곱하는 배율.
// 대가(스태미나 소모 가속)는 engine.js의 decayStamina가 별도로 담당한다.
export function pressingDefendMult(pressing) {
  const p = pressing ?? 0.5
  return 1 + (p - 0.5) * PRESSING_DEFEND_SPAN
}

const TEMPO_CHAIN_SPAN = 6 // 양팀 평균 tempo 0~1 -> 체인 수 -3~+3
const TEMPO_ACCURACY_SPAN = 0.16 // 자기 tempo 0~1 -> 창조 스코어 -8%~+8%

// 양팀 tempo 평균으로 90분 전체 체인 수 보정값을 구한다 — 빠른 템포는 양쪽 다
// 기회가 늘어나는 공용 효과(내 템포만 올린다고 나만 유리해지지 않음).
export function tempoChainDelta(tempoHome, tempoAway) {
  const avg = ((tempoHome ?? 0.5) + (tempoAway ?? 0.5)) / 2
  return (avg - 0.5) * TEMPO_CHAIN_SPAN
}

// 공격 중일 때 자기 템포로 창조 스코어에 곱하는 배율 — 빠를수록 정확도가 떨어지는
// 개인 대가(패스가 거칠어짐)이므로 possessing 쪽에만 적용한다.
export function tempoAccuracyMult(tempo) {
  const t = tempo ?? 0.5
  return 1 - (t - 0.5) * TEMPO_ACCURACY_SPAN
}
