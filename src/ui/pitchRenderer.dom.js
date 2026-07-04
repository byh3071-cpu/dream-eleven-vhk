// 2D DOM 피치 백엔드 — matchPlayback 컨트롤러의 PitchBackend 구현(goal 19 분리).
// 기존 DOM 렌더 코드의 무손실 이동: 클래스/데이터셋/스타일 산출물이 분리 전과 동일해야
// 하고, 그 계약은 scripts/verify-anti-float.mjs(볼 dataset + 토큰 data-player-id 셀렉터)가
// 기계 검증한다. 백엔드는 타이머/rAF를 소유하지 않는다 — syncFrame 안에서 그리기만.

import { createPlayerBadge } from './components/playerBadge.js'
import { renderPitchLines } from './components/pitchLines.js'
import { spawnMiniPop, spawnFlash } from './pitchOverlayFx.js'

export function createDomPitchBackend() {
  const root = document.createElement('div')
  root.className = 'match__pitch'

  const elById = new Map()
  const baseById = new Map()
  let ballEl = null
  let pitchWidth = 0
  let pitchHeight = 0
  let destroyed = false

  // 틸트(유사 3D) 토글 — 2D 전용 연출이라 백엔드 소속. 3D 백엔드에선 카메라가 대체.
  const tiltBtn = document.createElement('button')
  tiltBtn.type = 'button'
  tiltBtn.className = 'chip'
  tiltBtn.textContent = '입체 뷰'
  tiltBtn.addEventListener('click', () => {
    const on = root.classList.toggle('match__pitch--tilt')
    tiltBtn.classList.toggle('chip--active', on)
  })

  function mountToken({ playerId, player, basePos }, teamColor) {
    const el = document.createElement('div')
    el.className = 'pitch-slot pitch-slot--static'
    el.dataset.playerId = playerId
    el.style.left = `${basePos.left}%`
    el.style.top = `${basePos.top}%`
    el.appendChild(createPlayerBadge(player, { size: 'sm', strokeColor: teamColor }))
    const name = document.createElement('div')
    name.className = 'pitch-slot__name'
    name.style.color = teamColor
    name.textContent = player.shortName ?? player.name
    el.appendChild(name)
    elById.set(playerId, el)
    baseById.set(playerId, basePos)
    root.appendChild(el)
  }

  return {
    root,
    extraControls: [tiltBtn],

    mount({ tokens, teamColors }) {
      root.appendChild(renderPitchLines())
      for (const token of tokens) mountToken(token, teamColors[token.team])
      ballEl = document.createElement('div')
      ballEl.className = 'match__ball'
      ballEl.style.left = '50%'
      ballEl.style.top = '50%'
      root.appendChild(ballEl)
    },

    // 크기 실측 — %→px 변환 기준. start/resume/skip 직전 1회(레이아웃 확정 후).
    beginPlayback() {
      pitchWidth = root.offsetWidth
      pitchHeight = root.offsetHeight
    },

    isLive() {
      return document.contains(root)
    },

    syncFrame({ tokens, ball }) {
      for (const token of tokens) {
        const el = elById.get(token.playerId)
        const base = baseById.get(token.playerId)
        if (!el || !base) continue
        const dxPx = ((token.current.left - base.left) / 100) * pitchWidth
        const dyPx = ((token.current.top - base.top) / 100) * pitchHeight
        el.style.transform = `translate(-50%, -50%) translate(${dxPx}px, ${dyPx}px)`
      }
      ballEl.style.left = `${ball.pos.left}%`
      ballEl.style.top = `${ball.pos.top}%`
      // 비행 아크: 포물선 느낌의 스케일(뜸->내려앉음) — flightT는 컨트롤러가 계산.
      if (ball.flightT !== null) {
        const arc = 1 + Math.sin(Math.PI * ball.flightT) * 0.45
        ballEl.style.transform = `translate(-50%, -50%) scale(${arc.toFixed(3)})`
      } else {
        ballEl.style.transform = 'translate(-50%, -50%)'
      }
      // 디버그/게이트 계약 — verify-anti-float가 읽는다.
      ballEl.dataset.mode = ball.mode
      ballEl.dataset.holderId = ball.holderId
      ballEl.dataset.toId = ball.toId
    },

    applyEventVisual(fx) {
      if (fx.kind === 'miniPop') {
        spawnMiniPop(root, fx)
      } else if (fx.kind === 'flash') {
        spawnFlash(root, fx)
      } else if (fx.kind === 'lunge' || fx.kind === 'save') {
        // 2D는 GK 다이빙을 lunge 몸짓으로 재사용(3D만 방향성 다이빙).
        const el = elById.get(fx.playerId)
        if (!el) return
        el.classList.add('pitch-slot--lunge')
        el.addEventListener('animationend', () => el.classList.remove('pitch-slot--lunge'), { once: true })
      } else if (fx.kind === 'sendOff') {
        const el = elById.get(fx.playerId)
        if (el) el.style.opacity = 'var(--opacity-disabled)'
      }
    },

    // 킥오프/다시보기 초기화 — sendOff 흐림·이동 transform 해제.
    reset() {
      for (const el of elById.values()) {
        el.style.transform = 'translate(-50%, -50%)'
        el.style.opacity = ''
      }
    },

    // 멱등 — clearActivePlayback이 화면 진입/전환마다 호출한다. 2D는 브라우저가
    // DOM과 함께 자원을 회수하므로 no-op에 가깝다(3D는 WebGL dispose가 실작업).
    destroy() {
      destroyed = true
      void destroyed
    },
  }
}
