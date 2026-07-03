// 커리어 모드의 가상 구단 4개 — 실존 구단명을 쓰지 않는 이유는 라이선스 회피
// (fmkorea KBO GM 사례 댓글 중론과 같은 판단) + IF 모드의 "역사적 소속팀" 표기와
// 세계관 충돌 방지. 색은 designLint 규칙(“JS에 hex 금지”)에 따라 tokens.css의
// --club-* 토큰을 var() 문자열로 참조한다.
//
// 4구단 × 18명 = 72명(현재 DB 전원 소진) + 구단당 필러 GK 1명 = 19인 스쿼드.
// 6구단 대안(12인 스쿼드)은 징계/피로 로테이션에 취약해 기각 — 계획 문서 참고.

export const CLUBS = [
  { id: 'aurum', name: '아우룸 FC', short: 'AUR', color: 'var(--club-aurum)' },
  { id: 'obsidian', name: '옵시디언 SC', short: 'OBS', color: 'var(--club-obsidian)' },
  { id: 'crimson', name: '크림슨 유나이티드', short: 'CRI', color: 'var(--club-crimson)' },
  { id: 'glacier', name: '글라시에 시티', short: 'GLA', color: 'var(--club-glacier)' },
]

export function findClub(id) {
  return CLUBS.find((c) => c.id === id)
}
