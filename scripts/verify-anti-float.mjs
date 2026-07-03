// anti-float 회귀 게이트 — "볼이 허공에서 떠다니지 않는다"의 기계 검증.
//
// 재생 중 볼의 dataset(mode/holderId/toId)과 실측 좌표를 주기적으로 샘플링해서:
//   (a) held 상태면 볼이 보유자 토큰과 임계 거리 안에 있어야 하고
//   (b) 어떤 프레임도 "held인데 토큰 없음" 같은 정의 불가 상태가 아니어야 하며
//   (c) 콘솔/페이지 에러가 0이어야 한다
// 를 assert한다. 하나라도 어긋나면 exit 1 — 허공답보가 회귀하면 여기서 잡힌다.
//
// Playwright는 devDependency가 아니라 수동 게이트다(런타임 의존성 0 원칙 + 브라우저
// 바이너리 ~130MB). 실행 전 1회: npm install playwright --no-save
//                             && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
// 사용: (npx serve . -l 5500 띄운 상태에서) node scripts/verify-anti-float.mjs

import { chromium } from 'playwright'

const BASE = 'http://localhost:5500'
const HELD_THRESHOLD_PX = 14
const SAMPLE_INTERVAL_MS = 90
const SAMPLE_DURATION_MS = 20000

async function fillSquad(page, side, pickFrom) {
  await page.goto(`${BASE}/#/if/squad/${side}`)
  await page.waitForSelector('.squad-builder__pitch')
  for (let i = 0; i < 11; i++) {
    const emptySlot = page.locator('.pitch-slot--empty').first()
    if ((await emptySlot.count()) === 0) break
    await emptySlot.click()
    const candidates = page.locator('.player-card:not(.player-card--assigned)')
    const n = await candidates.count()
    if (n === 0) continue
    await (pickFrom === 'last' ? candidates.nth(n - 1) : candidates.first()).click()
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await fillSquad(page, 'home', 'first')
await fillSquad(page, 'away', 'last')
await page.goto(`${BASE}/#/if/match`)
await page.waitForSelector('.match__pitch')
await page.locator('button:has-text("킥오프")').first().click()

const samples = []
const started = Date.now()
while (Date.now() - started < SAMPLE_DURATION_MS) {
  const sample = await page.evaluate(() => {
    const ball = document.querySelector('.match__ball')
    if (!ball) return null
    const ballRect = ball.getBoundingClientRect()
    const ballCenter = { x: ballRect.x + ballRect.width / 2, y: ballRect.y + ballRect.height / 2 }
    const mode = ball.dataset.mode
    const relevantId = mode === 'held' ? ball.dataset.holderId : ball.dataset.toId
    let tokenDist = null
    if (relevantId) {
      const token = document.querySelector(`.pitch-slot--static[data-player-id="${relevantId}"]`)
      if (token) {
        const r = token.getBoundingClientRect()
        // 토큰 기준점: 뱃지 중심(슬롯 상단부) — 슬롯 박스에는 이름 라벨이 포함돼 있어
        // 중심이 아래로 치우친다. 뱃지(44px)의 중심 근사로 상단+22px를 쓴다.
        const tokenCenter = { x: r.x + r.width / 2, y: r.y + 22 }
        tokenDist = Math.hypot(ballCenter.x - tokenCenter.x, ballCenter.y - tokenCenter.y)
      }
    }
    return { mode, relevantId, tokenDist, done: document.querySelector('.match__controls button')?.textContent === '다시보기' }
  })
  if (sample) samples.push(sample)
  if (sample?.done) break
  await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS))
}

const heldSamples = samples.filter((s) => s.mode === 'held')
const heldViolations = heldSamples.filter((s) => s.tokenDist === null || s.tokenDist > HELD_THRESHOLD_PX)
const undefinedStates = samples.filter((s) => !['held', 'flight', 'flightToPoint', 'rest'].includes(s.mode))

console.log(`샘플 ${samples.length}개 (held ${heldSamples.length} / flight ${samples.filter((s) => s.mode === 'flight').length} / rest·shot ${samples.filter((s) => s.mode === 'rest' || s.mode === 'flightToPoint').length})`)
console.log(`held 위반(>${HELD_THRESHOLD_PX}px 또는 토큰 미해결): ${heldViolations.length}`)
if (heldViolations.length > 0) {
  console.log('  예시:', JSON.stringify(heldViolations.slice(0, 3)))
}
console.log(`정의 불가 상태 프레임: ${undefinedStates.length}`)
console.log(`콘솔/페이지 에러: ${errors.length}`)
errors.forEach((e) => console.log(' -', e))

await browser.close()

const heldEnough = heldSamples.length >= 10 // 표본이 너무 적으면 검증 자체가 무의미
const pass = heldEnough && heldViolations.length === 0 && undefinedStates.length === 0 && errors.length === 0
if (!heldEnough) console.log(`❌ held 표본 부족(${heldSamples.length} < 10) — 재생이 안 됐거나 볼이 held 상태에 못 들어감`)
console.log(pass ? '✅ anti-float 게이트 통과' : '❌ anti-float 게이트 실패')
process.exit(pass ? 0 : 1)
