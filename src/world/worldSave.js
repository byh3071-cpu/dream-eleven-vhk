// 월드 리그 시즌 결과 localStorage 캐시 — 매번 380경기 재시뮬을 피하는 계층.
// career/persistence.js와 무관한 additive 계층(그쪽은 절대 건드리지 않는다).
//
// 절대 원칙 2가지:
//  1) shape-agnostic — season 결과의 구조를 해석하지 않는다. 통째로 직렬화만 한다.
//     세이브가 season 구조에 결합되면 생성/시뮬 로직이 바뀔 때 강제 재작성된다.
//  2) genVersion 태생 — 생성/시뮬 로직이 바뀌면 WORLD_GEN_VERSION을 올린다. 로드 시
//     버전 불일치면 null(재시뮬 유도) — 과거 세이브가 소급 붕괴하지 않게.

// 생성/시뮬 로직 버전. simulateWorldSeason(또는 그 의존 부품)의 결과 구조·수치가 바뀌어
// 과거 캐시를 더 못 믿게 되면 이 값을 올린다 → 옛 세이브는 로드 시 자동 무효화된다.
export const WORLD_GEN_VERSION = 1

// 키 네임스페이스 — (leagueId, seed) 조합마다 독립 슬롯(다른 리그/시드와 충돌 방지).
const KEY_PREFIX = 'dream11_world_season_'

function keyFor(leagueId, seed) {
  return `${KEY_PREFIX}${leagueId}_${seed}`
}

// localStorage 핸들 획득 — 미가용(SSR/Node 테스트)이나 접근 예외(sandbox iframe의
// SecurityError 등)면 null. 접근 자체가 throw할 수 있어 try로 감싼다.
function getStorage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage
    }
  } catch {
    return null
  }
  return null
}

// 저장 — result를 해석하지 않고 통째로 직렬화한다. savedAt은 null 기본(이 모듈은
// Date.now()를 부르지 않는다 — 결정론/테스트 안정성). 타임스탬프가 필요하면 호출부가
// savedAt 인자로 채운다. 반환: 성공 여부(quota 초과 등 실패 시 false, throw 없음).
export function saveWorldSeason(leagueId, seed, result, savedAt = null) {
  const storage = getStorage()
  if (!storage) return false
  const payload = { genVersion: WORLD_GEN_VERSION, savedAt, result }
  try {
    storage.setItem(keyFor(leagueId, seed), JSON.stringify(payload))
    return true
  } catch {
    return false // quota 초과 등 — 캐시 저장 실패는 비치명적(다음 로드가 재시뮬).
  }
}

// 로드 → result | null. 없거나 / genVersion 불일치 / 파싱 실패 / 스토리지 미가용이면
// null(호출부가 재시뮬하도록). result의 구조는 검사하지 않고 통째로 복원해 돌려준다.
export function loadWorldSeason(leagueId, seed) {
  const storage = getStorage()
  if (!storage) return null
  let raw
  try {
    raw = storage.getItem(keyFor(leagueId, seed))
  } catch {
    return null
  }
  if (!raw) return null
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    return null // 손상된 캐시 — 재시뮬 유도.
  }
  if (!payload || payload.genVersion !== WORLD_GEN_VERSION) return null
  return payload.result ?? null
}

// 삭제 — 해당 (leagueId, seed) 슬롯 제거. 미가용/예외는 삼킨다(삭제 실패는 비치명적).
export function clearWorldSeason(leagueId, seed) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(keyFor(leagueId, seed))
  } catch {
    return // sandbox 등 접근 예외 — 삭제 실패는 치명적이지 않으니 삼킨다.
  }
}
