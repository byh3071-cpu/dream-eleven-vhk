// localStorage 어댑터 + 버전 엔벨로프 + 마이그레이션 체인. 스토리지를 주입받는 이유:
// Jest(node 환경)에 localStorage가 없어서 — 테스트는 Map 기반 페이크를 넣는다.

const STORAGE_KEY = 'dream-eleven.career'
export const SCHEMA_VERSION = 4

// v(n) 세이브 -> v(n+1) 세이브 순수 변환 목록. 스키마가 바뀔 때마다 여기 추가하고
// tests/career에 이전 버전 세이브 픽스처를 고정해 회귀를 방어한다.
const MIGRATIONS = [
  // v1 -> v2 (N4): 드래프트 단계/히스토리 도입. v1 세이브는 전부 "시즌 진행 중"이었다.
  (save) => ({
    ...save,
    phase: 'season',
    draftState: null,
    history: [],
  }),
  // v2 -> v3 (N5): 이적/계약 도입 — 기존 세이브엔 기본 예산(60M)과 전원 2년 계약 부여.
  (save) => ({
    ...save,
    budgets: Object.fromEntries(Object.keys(save.rosters ?? {}).map((clubId) => [clubId, 60])),
    contracts: Object.fromEntries(
      Object.values(save.rosters ?? {}).flat().map((playerId) => [playerId, 2])),
    transferLog: [],
  }),
  // v3 -> v4 (goal 16/17): 시즌 평점 집계 + 경영(신임도/재정 로그). 기존 세이브의
  // seasonStats는 빈 값으로 시작 — 지난 경기 events가 없어 소급 불가(이후 경기부터 적립).
  (save) => ({
    ...save,
    seasonStats: {},
    boardTrust: 55,
    financeLog: [],
  }),
]

function defaultStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null
}

export function saveCareer(save, storage = defaultStorage()) {
  if (!storage) return false
  const envelope = { schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString(), save }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope))
    return true
  } catch {
    return false // quota 초과 등 — 호출부(store)가 사용자에게 알린다
  }
}

// 반환: { save } | { save: null, corrupted?: true }
export function loadCareer(storage = defaultStorage()) {
  if (!storage) return { save: null }
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return { save: null }
  let envelope
  try {
    envelope = JSON.parse(raw)
  } catch {
    return { save: null, corrupted: true }
  }
  if (!envelope || typeof envelope.schemaVersion !== 'number' || !envelope.save) {
    return { save: null, corrupted: true }
  }
  let { save, schemaVersion } = envelope
  while (schemaVersion < SCHEMA_VERSION) {
    const migrate = MIGRATIONS[schemaVersion - 1]
    if (!migrate) return { save: null, corrupted: true }
    save = migrate(save)
    schemaVersion++
  }
  return { save }
}

export function clearCareer(storage = defaultStorage()) {
  if (storage) storage.removeItem(STORAGE_KEY)
}
