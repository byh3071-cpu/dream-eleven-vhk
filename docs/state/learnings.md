# Learnings

_Append-only. 한 줄 = 한 교훈._

- traits.js 훅을 hand-written ctx로만 단위 테스트하면 훅이 실제 파이프라인이 보내는 ctx 키와
  어긋나도(dribbler가 'creation' vs 실제 'progression') 안 걸린다 — 훅 테스트는 최소 1개는
  실제 호출 경로(resolveChain)가 만드는 ctx로도 검증해야 한다.
- CREATE_DIVISOR=250처럼 몬테카를로 게이트 통과를 위해 완만하게 잡은 divisor는 duel 스코어에
  거는 곱연산 트레이드오프(전술 배율 등)의 체감 효과도 같이 죽인다 — ±20% 배율 스팬은
  승률에 거의 안 잡혔고 ±80%은 돼야 눈에 띄는 회귀 테스트 마진이 나왔다(engine.tactics.test.js).
- CSS 주석 안에서 클래스 와일드카드를 "별표+슬래시" 순서로 쓰면(.player-card* 뒤에 /) 주석이
  조기 종료돼 그 뒤 텍스트가 깨진 셀렉터가 되고, CSS 에러 복구가 다음 중괄호 블록(:root 전체)을
  통째로 삼킨다 — tokens.css가 rules=0으로 조용히 죽었던 실사고. 브라우저 콘솔엔 에러도 안 뜬다.
  document.styleSheets[n].cssRules.length 확인이 가장 빠른 진단.
- check-goal 게이트를 임시 검증 스크립트(.tmp-*.mjs) 정리보다 먼저 돌리면 lint가 임시 파일의
  no-undef를 물고 게이트가 실패한다 — 게이트 실행 전 임시 산출물 정리가 순서상 먼저다.
- Playwright 스크린샷 해시 비교는 CDN 폰트 로딩 타이밍/시뮬 시드 때문에 같은 코드에서도 달라질
  수 있다 — "동일 코드 2회 실행 비교"로 노이즈 여부를 먼저 판별한 뒤 회귀를 논해야 한다.
- 렌더러의 볼을 CSS transition과 rAF 직접 구동으로 이중 제어하면 브라우저가 rAF가 쓴 좌표를
  한 번 더 보간해 고무줄 지연이 생긴다 — 소유자는 하나여야 한다(N1에서 transition 제거).
