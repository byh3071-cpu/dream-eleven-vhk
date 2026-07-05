// 월드 리그 정의 — "무제한 나라" 구조의 핵심. 각 리그가 팀수·rounds·타이브레이크·규칙을
// 전부 데이터로 들고 있어서, 나라 추가 = 이 배열에 항목 추가(코드 재작성 0 = 갈아엎기 없음).
// 플래그십 4개국(한·일·영·스)은 수작업 clubs를 참조하고, 나머지 35개국은 국가 프로필 기반
// 생성기가 채운다(추후). 규칙은 docs/world/league-rules.md 스펙 반영 — 리그마다 실제로 다름.
//
// 기존 커리어(src/career, 4구단 드래프트)·IF 모드와 완전 별도(additive). 세이브 타입도 신규라
// 4팀→84팀 마이그레이션이 없다(advisor 권고 — 돌아가는 커리어·IF 보호).

import { KOREA_CLUBS } from './data/korea.js'
import { JAPAN_CLUBS } from './data/japan.js'
import { ENGLAND_CLUBS } from './data/england.js'
import { SPAIN_CLUBS } from './data/spain.js'

export const LEAGUES = [
  {
    id: 'k_star',
    name: 'K 스타리그',
    country: '한국',
    tier: 1,
    clubs: KOREA_CLUBS,                 // 수작업 12팀(플래그십)
    rounds: 3,                          // 트리플 라운드로빈: 12팀 → 33R (+ 스플릿)
    split: { groupSize: 6, extraRounds: 5 }, // 파이널 A/B(1~6 / 7~12), 승점 승계 — 한국 특유
    tiebreak: ['points', 'goalsFor', 'goalDiff', 'wins'], // 다득점 우선(K리그, 세계 유일)
    foreignCap: 5,                      // 매치데이 출전 외국인 상한
    financeCapRatio: 0.7,               // 선수비용 ≤ 구단 수입 70%(비율캡)
    promotion: 0, relegation: 1,        // 1부: 승격 없음, 자동강등 1(+승강PO는 추후)
  },
  {
    id: 'j_glory',
    name: 'J 글로리',
    country: '일본',
    tier: 1,
    clubs: JAPAN_CLUBS,                 // 수작업 20팀(플래그십)
    rounds: 2,                          // 더블 라운드로빈: 20팀 → 38R
    tiebreak: ['points', 'goalDiff', 'goalsFor', 'wins'], // 골득실 우선(J리그)
    foreignCap: 5,                      // + 제휴국 무제한(C-4에서 메커닉화)
    financeCapRatio: 0.75,              // 라이선스 게이트 근사
    promotion: 0, relegation: 3,        // 자동강등 3(+승강PO는 C-4)
  },
  {
    id: 'e_premier',
    name: 'E 프리미어',
    country: '영국',
    tier: 1,
    clubs: ENGLAND_CLUBS,               // 수작업 20팀(플래그십)
    rounds: 2,                          // 38R
    tiebreak: ['points', 'goalDiff', 'goalsFor'], // 골득실 우선(EPL)
    homegrown: 8,                       // 25인 중 자국 육성 최소(C-4에서 강제)
    promotion: 0, relegation: 3,
  },
  {
    id: 's_liga',
    name: 'S 리가',
    country: '스페인',
    tier: 1,
    clubs: SPAIN_CLUBS,                 // 수작업 20팀(플래그십)
    rounds: 2,                          // 38R
    tiebreak: ['points', 'headToHead', 'goalDiff', 'goalsFor'], // 승자승 우선(라리가)
    foreignCap: 3,                      // 비EU 쿼터
    salaryCap: true,                    // 클럽별 샐러리캡(C-4에서 등록 차단형)
    promotion: 0, relegation: 3,
  },
  // 35개국은 국가 프로필(리그명·도시풀·강도·스타일) + 생성기로 추가(C-3 후속).
]

export function findLeague(id) {
  return LEAGUES.find((l) => l.id === id)
}

export function leagueClubIds(league) {
  return league.clubs.map((c) => c.id)
}

// 리그 팀 수 → 실제 라운드 수(스플릿 전 정규 라운드). 12팀 rounds:3 = 11×3 = 33R.
export function regularRounds(league) {
  return (league.clubs.length - 1) * league.rounds
}
