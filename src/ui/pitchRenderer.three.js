// 3D 피치 백엔드 — Three.js r185(assets/vendor 정적 2파일, importmap 'three').
// goal 19 1차 비주얼(사용자 확정): 캡슐 토큰 + 머리 위 이름·등번호 빌보드 + 중계 카메라.
// 캐릭터 모델/애니메이션(Quaternius CC0)은 2차 goal.
//
// 계약(PitchBackend): 타이머/rAF 미소유 — syncFrame 안에서 renderer.render 1회만.
// 프레임은 % 논리 좌표: x=(left-50)·W/100, z=(top-50)·L/100 (top 0=화면 위=홈 골문 쪽).
// held 검증용으로 root에 data-ball-mode/-holder/-held-gap을 미러한다(verify-anti-float-3d).
//
// 색: canvas라 var() 해석 불가 — getComputedStyle 토큰 리더(DESIGN.md가 canvas 렌더러
// 도입 시점에 예정해 둔 헬퍼)를 여기서 처음 도입한다.

import * as THREE from 'three'
import { playerNumberOf } from '../data/player-schema.js'

const FIELD_W = 68
const FIELD_L = 100
const BALL_ARC_HEIGHT = 7
const CAPSULE_RADIUS = 1.15
const CAPSULE_LENGTH = 2.2

// CSS 변수 문자열('var(--accent-gold)') → 실제 색값. 실패 시 폴백.
function resolveCssColor(value, fallback = 'gold') {
  const varMatch = /^var\((--[a-z0-9-]+)\)$/i.exec(value?.trim() ?? '')
  if (!varMatch) return value || fallback
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim()
  return resolved || fallback
}

function tokenOf(varName, fallback = 'white') {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return resolved || fallback
}

// 피치 텍스처 — 잔디 스트라이프 + 라인(캔버스 1회 드로잉).
function makePitchTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 680
  canvas.height = 1000
  const g = canvas.getContext('2d')
  const grassDark = tokenOf('--pitch-grass-dark', 'darkgreen')
  const grassLight = tokenOf('--pitch-grass-light', 'green')
  const line = tokenOf('--pitch-line')
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i % 2 === 0 ? grassDark : grassLight
    g.fillRect(0, i * 100, 680, 100)
  }
  g.strokeStyle = line
  g.lineWidth = 3
  g.strokeRect(10, 10, 660, 980)
  g.beginPath()
  g.moveTo(10, 500)
  g.lineTo(670, 500)
  g.stroke()
  g.beginPath()
  g.arc(340, 500, 80, 0, Math.PI * 2)
  g.stroke()
  // 페널티 박스(양쪽)
  g.strokeRect(170, 10, 340, 140)
  g.strokeRect(170, 850, 340, 140)
  g.strokeRect(255, 10, 170, 55)
  g.strokeRect(255, 935, 170, 55)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// 이름·등번호 빌보드(Sprite + 캔버스 텍스처).
function makeLabelSprite(player, teamColorCss) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 80
  const g = canvas.getContext('2d')
  const text = `${playerNumberOf(player)} ${player.shortName ?? player.name.split(' ').pop()}`
  g.font = '700 40px "Malgun Gothic", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineWidth = 8
  g.strokeStyle = tokenOf('--pitch3d-label-stroke')
  g.strokeText(text, 128, 40)
  g.fillStyle = resolveCssColor(teamColorCss)
  g.fillText(text, 128, 40)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }))
  sprite.scale.set(10, 3.1, 1)
  sprite.position.y = CAPSULE_LENGTH + 2.6
  return sprite
}

function makeGoal() {
  const group = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: tokenOf('--pitch3d-goal') })
  const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 3.2, 8)
  for (const x of [-5.5, 5.5]) {
    const post = new THREE.Mesh(postGeo, mat)
    post.position.set(x, 1.6, 0)
    group.add(post)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 11, 8), mat)
  bar.rotation.z = Math.PI / 2
  bar.position.y = 3.2
  group.add(bar)
  return group
}

export function createThreePitchBackend() {
  const root = document.createElement('div')
  root.className = 'match__pitch3d'
  const overlay = document.createElement('div')
  overlay.className = 'match__pitch3d-overlay'

  let renderer = null
  let scene = null
  let camera = null
  let destroyed = false
  const meshById = new Map()
  const labelById = new Map()
  const lungeById = new Map()
  let ballMesh = null
  const disposables = []

  const toX = (left) => ((left - 50) / 100) * FIELD_W
  const toZ = (top) => ((top - 50) / 100) * FIELD_L

  // 씬 좌표 → 오버레이 %(팝 배치용 투영).
  function projectToOverlay(pos3) {
    const v = pos3.clone().project(camera)
    return { left: (v.x * 0.5 + 0.5) * 100, top: (-v.y * 0.5 + 0.5) * 100 }
  }

  function track(resource) {
    disposables.push(resource)
    return resource
  }

  return {
    root,
    extraControls: [],

    mount({ tokens, teamColors }) {
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
      root.appendChild(renderer.domElement)
      root.appendChild(overlay)

      scene = new THREE.Scene()
      scene.background = new THREE.Color(tokenOf('--bg-primary', 'black'))

      camera = new THREE.PerspectiveCamera(42, 68 / 100, 0.1, 500)
      camera.position.set(0, 82, 92)
      camera.lookAt(0, 0, 4)

      scene.add(new THREE.HemisphereLight(tokenOf('--pitch3d-sky'), tokenOf('--pitch3d-ground'), 1.15))
      const sun = new THREE.DirectionalLight(tokenOf('--pitch3d-sun'), 1.4)
      sun.position.set(-30, 60, 20)
      scene.add(sun)

      const pitchTex = track(makePitchTexture())
      const pitchMat = track(new THREE.MeshLambertMaterial({ map: pitchTex }))
      const pitch = new THREE.Mesh(track(new THREE.PlaneGeometry(FIELD_W, FIELD_L)), pitchMat)
      pitch.rotation.x = -Math.PI / 2
      scene.add(pitch)

      // 스탠드 실루엣 — 관중석 암시(낮은 어두운 벽 4면).
      const standMat = track(new THREE.MeshLambertMaterial({ color: tokenOf('--bg-panel', 'black') }))
      const standGeoLong = track(new THREE.BoxGeometry(FIELD_W + 26, 7, 9))
      const standGeoSide = track(new THREE.BoxGeometry(9, 7, FIELD_L + 8))
      for (const [geo, x, z] of [
        [standGeoLong, 0, -(FIELD_L / 2 + 9)], [standGeoLong, 0, FIELD_L / 2 + 9],
        [standGeoSide, -(FIELD_W / 2 + 9), 0], [standGeoSide, FIELD_W / 2 + 9, 0],
      ]) {
        const stand = new THREE.Mesh(geo, standMat)
        stand.position.set(x, 3.5, z)
        scene.add(stand)
      }

      const goalTop = makeGoal()
      goalTop.position.z = -FIELD_L / 2
      scene.add(goalTop)
      const goalBottom = makeGoal()
      goalBottom.position.z = FIELD_L / 2
      scene.add(goalBottom)

      const capsuleGeo = track(new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_LENGTH, 4, 12))
      for (const token of tokens) {
        const color = resolveCssColor(teamColors[token.team])
        const mat = track(new THREE.MeshLambertMaterial({ color, transparent: true }))
        const mesh = new THREE.Mesh(capsuleGeo, mat)
        mesh.position.set(toX(token.basePos.left), CAPSULE_RADIUS + CAPSULE_LENGTH / 2, toZ(token.basePos.top))
        const label = makeLabelSprite(token.player, teamColors[token.team])
        mesh.add(label)
        scene.add(mesh)
        meshById.set(token.playerId, mesh)
        labelById.set(token.playerId, label)
      }

      const ballMat = track(new THREE.MeshLambertMaterial({ color: tokenOf('--pitch3d-ball'), emissive: tokenOf('--pitch3d-ball'), emissiveIntensity: 0.35 }))
      ballMesh = new THREE.Mesh(track(new THREE.SphereGeometry(1.15, 16, 12)), ballMat)
      ballMesh.position.set(0, 1.15, 0)
      scene.add(ballMesh)
    },

    beginPlayback() {
      const width = root.clientWidth || 520
      const height = root.clientHeight || Math.round(width * (100 / 68))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    },

    isLive() {
      return !destroyed && document.contains(root)
    },

    syncFrame({ tokens, ball }) {
      if (destroyed) return
      for (const token of tokens) {
        const mesh = meshById.get(token.playerId)
        if (!mesh) continue
        mesh.position.x = toX(token.current.left)
        mesh.position.z = toZ(token.current.top)
        // 런지 감쇠 스케일(3D 네이티브 — CSS 클래스가 메시에 안 붙는다)
        const lungeT = lungeById.get(token.playerId) ?? 0
        if (lungeT > 0.01) {
          const s = 1 + 0.3 * lungeT
          mesh.scale.set(s, s, s)
          lungeById.set(token.playerId, lungeT * 0.86)
        } else if (mesh.scale.x !== 1) {
          mesh.scale.set(1, 1, 1)
        }
      }
      const ballY = ball.flightT !== null
        ? 1.15 + Math.sin(Math.PI * ball.flightT) * BALL_ARC_HEIGHT
        : 1.15
      ballMesh.position.set(toX(ball.pos.left), ballY, toZ(ball.pos.top))

      // held 검증 미러 — 씬 xz 평면의 % 거리(verify-anti-float-3d 계약).
      root.dataset.ballMode = ball.mode
      root.dataset.holderId = ball.holderId
      if (ball.mode === 'held' && ball.holderId) {
        const holder = meshById.get(ball.holderId)
        if (holder) {
          const dLeft = (ballMesh.position.x - holder.position.x) / FIELD_W * 100
          const dTop = (ballMesh.position.z - holder.position.z) / FIELD_L * 100
          root.dataset.heldGap = Math.hypot(dLeft, dTop).toFixed(2)
        }
      } else {
        root.dataset.heldGap = ''
      }

      renderer.render(scene, camera)
    },

    applyEventVisual(fx) {
      if (fx.kind === 'lunge') {
        lungeById.set(fx.playerId, 1)
        return
      }
      if (fx.kind === 'sendOff') {
        const mesh = meshById.get(fx.playerId)
        if (mesh) mesh.material.opacity = 0.3
        const label = labelById.get(fx.playerId)
        if (label) label.material.opacity = 0.3
        return
      }
      // miniPop/flash — DOM 오버레이 재사용(토큰 색 체계·reduced-motion·자가 제거가 CSS에 있음).
      if (fx.kind === 'miniPop') {
        const pop = document.createElement('div')
        pop.className = 'match__pop'
        pop.textContent = fx.text
        const projected = projectToOverlay(new THREE.Vector3(toX(fx.pos.left), 2.5, toZ(fx.pos.top)))
        pop.style.left = `${projected.left}%`
        pop.style.top = `${projected.top}%`
        pop.addEventListener('animationend', () => pop.remove())
        overlay.appendChild(pop)
      } else if (fx.kind === 'flash') {
        const flash = document.createElement('div')
        flash.className = `match__flash match__flash--${fx.variant}`
        flash.textContent = fx.text
        flash.addEventListener('animationend', () => flash.remove())
        overlay.appendChild(flash)
      }
    },

    reset() {
      for (const mesh of meshById.values()) {
        mesh.scale.set(1, 1, 1)
        mesh.material.opacity = 1
      }
      for (const label of labelById.values()) label.material.opacity = 1
      lungeById.clear()
      overlay.replaceChildren()
    },

    // WebGL 컨텍스트 해제 — 브라우저 컨텍스트 한도 초과가 실사고 지점. 멱등.
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const label of labelById.values()) {
        label.material.map?.dispose()
        label.material.dispose()
      }
      for (const resource of disposables) resource.dispose?.()
      renderer?.dispose()
      renderer?.forceContextLoss()
      renderer = null
      scene = null
    },
  }
}
