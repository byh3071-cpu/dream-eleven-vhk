// 경로 빌더 — navigate()/registerRoute()에 들어가는 경로 문자열의 단일 소스.
// v1에선 리터럴 10곳이라 참을 만했지만, 커리어 모드가 붙으면 30곳+가 되므로
// 네임스페이스 이전(v2 N0b)과 같은 타이밍에 문자열 산개를 없앤다.
// 패턴(":side" 포함)은 라우트 등록용, 함수는 navigate용.

export const ROUTE_PATTERNS = Object.freeze({
  home: '/',
  ifSquad: '/if/squad/:side',
  ifTactics: '/if/tactics/:side',
  ifMatch: '/if/match',
  ifResult: '/if/result',
  career: '/career',
  careerSquad: '/career/squad',
  careerTactics: '/career/tactics',
  careerTable: '/career/table',
  careerSchedule: '/career/schedule',
  careerMatchday: '/career/matchday',
  styleguide: '/styleguide',
})

export function homePath() {
  return '/'
}

export function ifSquadPath(side) {
  return `/if/squad/${side}`
}

export function ifTacticsPath(side) {
  return `/if/tactics/${side}`
}

export function ifMatchPath() {
  return '/if/match'
}

export function ifResultPath() {
  return '/if/result'
}

export function styleguidePath() {
  return '/styleguide'
}

export function careerPath() {
  return '/career'
}

export function careerSquadPath() {
  return '/career/squad'
}

export function careerTacticsPath() {
  return '/career/tactics'
}

export function careerTablePath() {
  return '/career/table'
}

export function careerSchedulePath() {
  return '/career/schedule'
}

export function careerMatchdayPath() {
  return '/career/matchday'
}
