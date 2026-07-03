// 매치 렌더러 선호(2D/3D) — 기기/취향 설정이라 커리어 세이브가 아닌 별도 키에 둔다:
// IF 모드에도 적용돼야 하고, 세이브 스키마 마이그레이션 체인을 오염시키지 않기 위해.

const KEY = 'dream-eleven.prefs'

export function getRendererPref() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return parsed.renderer === '3d' ? '3d' : '2d'
  } catch {
    return '2d'
  }
}

export function setRendererPref(renderer) {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    localStorage.setItem(KEY, JSON.stringify({ ...parsed, renderer }))
  } catch {
    localStorage.setItem(KEY, JSON.stringify({ renderer }))
  }
}
