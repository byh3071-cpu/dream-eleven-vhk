// 선수 이적 가치 모델 — 순수 함수. 단위: M(밀리언, 게임 내 통화).
//
// 설계: 가치는 레이팅에 지수적으로(슈퍼스타 프리미엄 — 92와 82의 차이는 10점이 아니라
// 몇 배), 나이에 커브로(24~28 피크, 이후 매년 감가), 계약 잔여에 할인으로(만료 임박 =
// 헐값) 반응한다. 절대 금액의 현실성보다 "상대 서열이 축구 상식과 일치"가 목표 —
// tests/career가 단조성/피크/할인을 검증한다.

import { playerOverallRating } from '../sim/teamStrength.js'

const RATING_PIVOT = 60 // 이 레이팅을 1배 기준으로 지수 곡선 시작
const RATING_EXP = 4 // 지수 — 92 vs 75가 ~2.3배 차이 나는 기울기
const BASE_M = 6 // pivot 선수의 기준 가치(M)

export function ageMultiplier(age) {
  if (age <= 20) return 0.9 // 유망주 — 검증 리스크 할인
  if (age <= 23) return 0.98
  if (age <= 28) return 1.05 // 피크
  return Math.max(0.35, 1.05 - 0.07 * (age - 28)) // 노장 감가(바닥 0.35)
}

export function contractMultiplier(contractYears) {
  if (contractYears <= 0) return 0.5 // 만료 — 보스만 임박 헐값
  if (contractYears === 1) return 0.8
  return 1
}

export function playerValue(player, contractYears = 2) {
  const rating = playerOverallRating(player)
  const base = Math.pow(rating / RATING_PIVOT, RATING_EXP) * BASE_M
  return Math.max(1, Math.round(base * ageMultiplier(player.age) * contractMultiplier(contractYears)))
}
