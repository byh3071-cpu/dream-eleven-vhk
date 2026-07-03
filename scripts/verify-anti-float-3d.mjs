// 3D 백엔드 볼-보유자 앵커링 게이트 — 2D verify-anti-float의 3D판.
// DOM 측정 대신 백엔드가 root에 미러하는 씬 좌표 거리(data-held-gap, % 단위)를 검사한다.
// 임계 2.0%: 룰렛 오프셋 최대 1.4%를 덮고, 2D의 14px(≈520px 폭의 2.7%)보다 엄격 —
// 씬 좌표엔 DOM 측정 노이즈가 없어 더 조일 수 있다(설계 문서 근거).
// 추가 검사: 전환 반복 20회 후 WebGL 컨텍스트 경고 0(destroy 누수 방어).

import { chromium } from 'playwright'

const BASE = 'http://localhost:5500'
const HELD_GAP_LIMIT = 2.0

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  // 성능 잡음(GPU stall 등)은 headless 드라이버 특성이라 제외 — 누수 시그니처만 잡는다:
  // "Too many active WebGL contexts" / "Oldest context will be lost"가 destroy 미이행의 증거.
  if (m.type() === 'error') errors.push(`[error] ${m.text()}`)
  else if (/too many active webgl|oldest context will be lost|context lost/i.test(m.text())) {
    errors.push(`[leak] ${m.text()}`)
  }
})

async function fill(side, last) {
  await page.goto(`${BASE}/#/if/squad/${side}`)
  await page.waitForSelector('.squad-builder__pitch')
  for (let i = 0; i < 11; i++) {
    const slot = page.locator('.pitch-slot--empty').first()
    if (await slot.count() === 0) break
    await slot.click()
    const cards = page.locator('.player-card:not(.player-card--assigned)')
    await (last ? cards.nth(await cards.count() - 1) : cards.first()).click()
  }
}
await fill('home', false)
await fill('away', true)
await page.goto(`${BASE}/#/if/match`)
await page.waitForSelector('button:has-text("3D")')

// 전환 내구성: 2D<->3D 20회 반복(각 전환이 destroy를 반드시 부른다)
for (let i = 0; i < 10; i++) {
  await page.locator('button:has-text("3D")').click()
  await page.waitForSelector('.match__pitch3d', { timeout: 8000 })
  await page.locator('button:has-text("2D")').last().click()
  await page.waitForSelector('.match__pitch', { timeout: 8000 })
}
console.log('전환 20회 내구성: 통과 (컨텍스트 경고 0 여부는 최종 에러 카운트로)')

// 3D로 재생 — held 샘플링
await page.locator('button:has-text("3D")').click()
await page.waitForSelector('.match__pitch3d')
await page.locator('button:has-text("킥오프")').click()
await page.locator('button:has-text("4x")').click()

let samples = 0
let heldSamples = 0
let violations = 0
for (let i = 0; i < 260; i++) {
  await page.waitForTimeout(90)
  const data = await page.evaluate(() => {
    const el = document.querySelector('.match__pitch3d')
    if (!el) return null
    return { mode: el.dataset.ballMode ?? '', gap: el.dataset.heldGap ?? '' }
  })
  if (!data) break
  samples++
  if (data.mode === 'held') {
    heldSamples++
    const gap = parseFloat(data.gap)
    if (!Number.isFinite(gap) || gap > HELD_GAP_LIMIT) {
      violations++
      console.log(`  위반: held인데 gap=${data.gap}`)
    }
  }
  const done = await page.locator('button:has-text("다시보기")').isVisible().catch(() => false)
  if (done) break
}

console.log(`샘플 ${samples}개 (held ${heldSamples})`)
console.log(`held 위반(>${HELD_GAP_LIMIT}% 또는 gap 미기록): ${violations}`)
console.log(`콘솔/페이지 에러: ${errors.length}`)
errors.slice(0, 5).forEach((e) => console.log(' -', e))
await browser.close()

if (violations > 0 || errors.length > 0 || heldSamples < 10) {
  console.log('❌ anti-float-3d 게이트 실패')
  process.exit(1)
}
console.log('✅ anti-float-3d 게이트 통과')
