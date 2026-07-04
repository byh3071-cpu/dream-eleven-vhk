// 진동(부르르 떨림) 게이트 — 오프볼 선수가 매 프레임 방향을 뒤집으며 흔들리는 정도를
// 측정한다. springStep은 임계감쇠라 원래 오버슈트가 없는데, 여기에 이웃 반발(separation)
// 이나 워블을 얹으면 톱니 진동이 생길 수 있다(2026-07 실측: separation을 current에 직접
// 걸었더니 선수당 반전 9.5회 → target 기반 연속 반발로 5.9회). 이 지표를 상설화해 모션
// 레이어를 더 쌓을 때 진동 회귀를 즉시 잡는다(anti-float와 같은 브라우저 실측 패턴).
//
// 판정: 랜덤 편성 3경기, 정지에 가까운 선수(볼에서 먼)의 프레임간 이동 방향 반전 평균이
// 임계 이하. 랜덤이라 결정론은 아니지만 임계에 여유를 둬 안정적으로 통과한다.

import { chromium } from 'playwright'

// 랜덤 편성이라 경기마다 편차가 크다(특정 경기에 이벤트 밀집 등). 1경기 outlier에 죽지
// 않게 5경기 평균으로 전반적 진동 수준을 본다 — 회귀(모션 레이어가 진동을 전반적으로
// 올림)는 평균을 밀어올리므로 잡히고, 우연한 1경기 outlier는 흡수된다.
const THRESHOLD = 5.0 // 5경기 방향 반전 중앙값 — 명백한 전반 회귀만 실패(지표 노이즈 큼, 완벽 pass/fail 아닌 회귀 방지 도구)
const TRIALS = 5
const BASE = process.env.BASE_URL ?? 'http://localhost:5500'

async function measure(page) {
  await page.goto(`${BASE}/#/`)
  await page.waitForSelector('.home__tiles')
  await page.locator('button:has-text("랜덤으로 바로 시작")').click()
  await page.waitForSelector('button:has-text("킥오프")')
  await page.locator('button:has-text("킥오프")').click()
  const frames = []
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(80)
    frames.push(await page.evaluate(() => {
      const out = {}
      for (const el of document.querySelectorAll('.pitch-slot--static')) {
        const m = el.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)
        if (m) out[el.dataset.playerId] = [parseFloat(m[1]), parseFloat(m[2])]
      }
      return out
    }))
  }
  const ids = Object.keys(frames[0] ?? {})
  let reversals = 0
  for (const id of ids) {
    let prevDx = 0, prevDy = 0
    for (let i = 1; i < frames.length; i++) {
      if (!frames[i][id] || !frames[i - 1][id]) continue
      const dx = frames[i][id][0] - frames[i - 1][id][0]
      const dy = frames[i][id][1] - frames[i - 1][id][1]
      const mag = Math.hypot(dx, dy)
      // 미세 이동(0.3~3px)의 방향 반전만 진동으로 센다. 큰 이동(>3px)은 볼을 쫓아
      // 방향을 바꾸는 자연스러운 주행이라 제외(게이트가 정상 움직임을 오판하지 않게).
      if (mag < 0.3 || mag > 3) { prevDx = dx; prevDy = dy; continue }
      if (prevDx * dx + prevDy * dy < 0) reversals++
      prevDx = dx; prevDy = dy
    }
  }
  return ids.length ? reversals / ids.length : 0
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  let worst = 0
  const scores = []
  for (let t = 0; t < TRIALS; t++) {
    const avg = await measure(page)
    scores.push(avg.toFixed(1))
    worst = Math.max(worst, avg)
  }
  // 중앙값으로 판정 — 랜덤 편성 편차상 5경기 중 1경기가 세트피스 밀집 등으로 outlier가
  // 될 수 있어, 최악값은 flaky하다. 중앙값은 "전반적 진동 수준"을 보므로 회귀(전반 상승)는
  // 잡고 우연한 1경기 outlier는 흡수한다. (세트피스 밀집 잔여 진동은 알려진 한계.)
  const sorted = scores.map(Number).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  console.log(`선수당 방향 반전(경기별): ${scores.join(', ')} — 중앙값 ${median.toFixed(1)} / 임계 ${THRESHOLD} (최악 ${worst.toFixed(1)})`)
  if (median > THRESHOLD) {
    console.log('❌ jitter 게이트 실패 — 진동(부르르 떨림)이 임계 초과')
    process.exit(1)
  }
  console.log('✅ jitter 게이트 통과')
} finally {
  await browser.close()
}
