// 3D 피치 백엔드 — Three.js r185(assets/vendor 정적 2파일, importmap 'three').
// goal 19 2차: 캡슐 토큰 → 절차적 로우폴리 휴머노이드 + 코드 모션(사용자 지시
// "실제 선수처럼" — 달리기 스윙/이동 방향 회전/킥/골 셀레브레이션 점프).
// 외부 모델·애니메이션 에셋 0(직접 디자인) — CC0 glTF(Quaternius) 교체 경로는
// goals/19 문서에 열어 뒀다. 모션 시계는 frame.dtMs(컨트롤러 전달)라 배속/리플레이
// 슬로모가 자동 반영된다.
//
// 계약(PitchBackend): 타이머/rAF 미소유 — syncFrame 안에서 renderer.render 1회만.
// 프레임은 % 논리 좌표: x=(left-50)·W/100, z=(top-50)·L/100.
// held 검증용으로 root에 data-ball-mode/-holder/-held-gap을 미러한다(verify-anti-float-3d).
//
// 색: canvas라 var() 해석 불가 — getComputedStyle 토큰 리더(DESIGN.md가 canvas 렌더러
// 도입 시점에 예정해 둔 헬퍼). 씬 전용 색은 --pitch3d-* 토큰.

import * as THREE from 'three'
import { playerNumberOf } from '../data/player-schema.js'
import { spawnMiniPop, spawnFlash } from './pitchOverlayFx.js'

const FIELD_W = 68
const FIELD_L = 100
const BALL_ARC_HEIGHT = 7
const BALL_R = 1.15

// 휴머노이드 치수(로우폴리 — 필드 스케일 대비 과장된 머리/컬러 블록 미학)
const LEG_LEN = 1.5
const TORSO_H = 1.7
const HIP_Y = LEG_LEN + 0.15
const SHOULDER_Y = HIP_Y + TORSO_H - 0.15

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
  sprite.position.y = SHOULDER_Y + 2.4
  return sprite
}

function makeGoal(track) {
  const group = new THREE.Group()
  const mat = track(new THREE.MeshBasicMaterial({ color: tokenOf('--pitch3d-goal') }))
  const postGeo = track(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 8))
  for (const x of [-5.5, 5.5]) {
    const post = new THREE.Mesh(postGeo, mat)
    post.position.set(x, 1.6, 0)
    group.add(post)
  }
  const bar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.22, 0.22, 11, 8)), mat)
  bar.rotation.z = Math.PI / 2
  bar.position.y = 3.2
  group.add(bar)

  // 골네트 — 뒤로 기운 반투명 그리드(뒷면·바닥·측면). WireframeGeometry로 그물눈.
  const netMat = track(new THREE.LineBasicMaterial({
    color: tokenOf('--pitch3d-net'), transparent: true, opacity: 0.5,
  }))
  const back = track(new THREE.PlaneGeometry(11, 3.2, 8, 4))
  const backNet = new THREE.LineSegments(track(new THREE.WireframeGeometry(back)), netMat)
  backNet.position.set(0, 1.6, -2.6)
  group.add(backNet)
  const roof = track(new THREE.PlaneGeometry(11, 2.9, 8, 3))
  const roofNet = new THREE.LineSegments(track(new THREE.WireframeGeometry(roof)), netMat)
  roofNet.rotation.x = Math.PI / 2
  roofNet.position.set(0, 3.1, -1.3)
  group.add(roofNet)
  for (const sx of [-5.5, 5.5]) {
    const side = track(new THREE.PlaneGeometry(2.6, 3.2, 2, 4))
    const sideNet = new THREE.LineSegments(track(new THREE.WireframeGeometry(side)), netMat)
    sideNet.rotation.y = Math.PI / 2
    sideNet.position.set(sx, 1.6, -1.3)
    group.add(sideNet)
  }
  return group
}

// 계단식 관중석 + 인스턴스드 관중 점묘 + 조명탑 + 전광판(스코어 미러). goal 22.
// 반환 stadium은 syncFrame이 쓰는 갱신 훅(전광판/관중 웨이브)을 노출한다.
function makeStadium(track, scene, teamColors, FIELD_W, FIELD_L) {
  const standMat = track(new THREE.MeshLambertMaterial({ color: tokenOf('--pitch3d-stand') }))
  const railMat = track(new THREE.MeshLambertMaterial({ color: tokenOf('--pitch3d-stand-rail') }))

  // 4면 경사 스탠드(3단 계단) — 안쪽이 낮고 바깥이 높다.
  const TIERS = 3
  const standSpecs = [
    { long: true, z: -(FIELD_L / 2 + 6), dir: -1 }, // 홈 골문 뒤(A 기준)
    { long: true, z: FIELD_L / 2 + 6, dir: 1 },
    { long: false, x: -(FIELD_W / 2 + 6), dir: -1 },
    { long: false, x: FIELD_W / 2 + 6, dir: 1 },
  ]
  for (const spec of standSpecs) {
    const spanLong = spec.long ? FIELD_W + 40 : FIELD_L + 16
    for (let tier = 0; tier < TIERS; tier++) {
      const depth = 5
      const geo = track(new THREE.BoxGeometry(spec.long ? spanLong : 10, 3, spec.long ? 10 : spanLong))
      const step = new THREE.Mesh(geo, tier === 1 ? railMat : standMat)
      const outward = spec.dir * (tier * depth)
      const y = 1.5 + tier * 2.4
      if (spec.long) step.position.set(0, y, spec.z + outward)
      else step.position.set(spec.x + outward, y, 0)
      scene.add(step)
    }
  }

  // 관중 점묘 — InstancedMesh(작은 박스). 스탠드 경사면에 격자 배치, 팀색 반반.
  const isHomeSide = (spec) => spec.z !== undefined ? spec.z < 0 : spec.x < 0
  const homeColor = new THREE.Color(tokenOf('--pitch3d-crowd-home'))
  const awayColor = new THREE.Color(tokenOf('--pitch3d-crowd-away'))
  const perStand = 180
  const total = standSpecs.length * perStand
  const crowdGeo = track(new THREE.BoxGeometry(1.1, 1.7, 1.1))
  const crowdMat = track(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(0x111318) }))
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, total)
  crowd.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3)
  const dummy = new THREE.Object3D()
  const crowdMeta = [] // 인스턴스별 {baseY, side} — 웨이브
  let idx = 0
  // 계단 윗면 y = 1.5 + tier*2.4 + 1.5(박스 절반) = [3.0, 5.4, 7.8]. 관중은 각 계단
  // 윗면 위에 앉힌다(파묻힘 방지 — 이전엔 연속 램프가 이산 계단 박스 속으로 파고들었다).
  const TIER_TOP_Y = [3.0 + 0.9, 5.4 + 0.9, 7.8 + 0.9] // 박스 top + 관중 높이 절반
  const perTier = Math.ceil(perStand / TIERS)
  for (const spec of standSpecs) {
    const home = isHomeSide(spec)
    const spanLong = spec.long ? FIELD_W + 34 : FIELD_L + 12
    const seatCols = Math.ceil(perTier / 1) // 한 계단에 perTier명을 한 줄로
    for (let tier = 0; tier < TIERS; tier++) {
      const y = TIER_TOP_Y[tier]
      const stepZ = spec.z !== undefined ? spec.z + spec.dir * (tier * 5) : undefined
      const stepX = spec.x !== undefined ? spec.x + spec.dir * (tier * 5) : undefined
      for (let s = 0; s < perTier; s++) {
        if (idx >= total) break
        const alongT = (s / (seatCols - 1) - 0.5) * spanLong
        if (spec.long) dummy.position.set(alongT, y, stepZ)
        else dummy.position.set(stepX, y, alongT)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        crowd.setMatrixAt(idx, dummy.matrix)
        const c = home ? homeColor : awayColor
        const jitter = 0.72 + ((idx * 2654435761) % 100) / 360
        crowd.setColorAt(idx, c.clone().multiplyScalar(jitter))
        crowdMeta.push({ baseY: y, home })
        idx++
      }
    }
  }
  crowd.instanceMatrix.needsUpdate = true
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true
  scene.add(crowd)

  // 조명탑 4개(코너) — 기둥 + 발광 헤드.
  const towerMat = track(new THREE.MeshLambertMaterial({ color: tokenOf('--pitch3d-tower') }))
  const lightMat = track(new THREE.MeshBasicMaterial({ color: tokenOf('--pitch3d-floodlight') }))
  const towerGeo = track(new THREE.CylinderGeometry(0.8, 1.2, 34, 6))
  const headGeo = track(new THREE.BoxGeometry(7, 3, 1.5))
  const cornerX = FIELD_W / 2 + 24
  const cornerZ = FIELD_L / 2 + 20
  const towerHeads = []
  const spots = []
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tower = new THREE.Mesh(towerGeo, towerMat)
    tower.position.set(sx * cornerX, 17, sz * cornerZ)
    scene.add(tower)
    const head = new THREE.Mesh(headGeo, lightMat)
    head.position.set(sx * cornerX, 33, sz * cornerZ - sz * 1)
    head.lookAt(0, 0, 0)
    scene.add(head)
    towerHeads.push(head)
    // 실광원 — 야간에 피치로 쏘는 스포트라이트(주간엔 intensity 0).
    const spot = new THREE.SpotLight(tokenOf('--pitch3d-floodlight'), 0, 320, Math.PI / 4, 0.5, 1)
    spot.position.set(sx * cornerX, 33, sz * cornerZ)
    spot.target.position.set(sx * 12, 0, sz * 18)
    scene.add(spot)
    scene.add(spot.target)
    spots.push(spot)
  }

  // 전광판 — 한쪽 스탠드 위 큰 판. 캔버스 텍스처로 스코어/분 미러.
  const boardCanvas = document.createElement('canvas')
  boardCanvas.width = 512
  boardCanvas.height = 160
  const boardTex = track(new THREE.CanvasTexture(boardCanvas))
  boardTex.colorSpace = THREE.SRGBColorSpace
  const boardMat = track(new THREE.MeshBasicMaterial({ map: boardTex }))
  const board = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 9.4)), boardMat)
  board.position.set(0, 20, -(FIELD_L / 2 + 17))
  board.lookAt(0, 12, 0)
  scene.add(board)

  function drawBoard(homeScore, awayScore, minute) {
    const g = boardCanvas.getContext('2d')
    g.fillStyle = tokenOf('--pitch3d-board-bg', 'black')
    g.fillRect(0, 0, 512, 160)
    g.fillStyle = tokenOf('--pitch3d-board-text', 'gold')
    g.font = '800 96px "Cascadia Code", monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(`${homeScore} - ${awayScore}`, 256, 66)
    g.font = '600 40px "Cascadia Code", monospace'
    g.fillText(`${minute}'`, 256, 130)
    boardTex.needsUpdate = true
  }
  drawBoard(0, 0, 0)

  return {
    crowd, crowdMeta,
    towerHeads, lightMat, spots,
    drawBoard,
    lastBoard: '',
  }
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
  const rigById = new Map()
  let ballMesh = null
  let stadium = null
  let hemiLight = null
  let sunLight = null
  let crowdWaveT = 0 // 골 시 관중 웨이브(1→0 감쇠)
  let crowdWaveHome = true
  let night = false
  const disposables = []

  // ---------- 카메라 연출(goal 19-3) — 순수 뷰, 판정/컨트롤러 무영향 ----------
  // 프리셋 3종 + 볼 소프트 팔로우 + 골 줌인. 모든 보간이 dtMs 기반이라
  // 배속/리플레이 슬로모에 자동 연동된다(줌·팬이 함께 느려지는 게 연출 포인트).
  const CAMERA_PRESETS = [
    { name: '중계 캠', pos: [0, 82, 92], look: [0, 0, 4], followPan: 0.3 },
    { name: '사이드 캠', pos: [-105, 42, 0], look: [0, 0, 0], followPan: 0 },
    { name: '골뒤 캠', pos: [0, 26, 132], look: [0, 2, -20], followPan: 0.15 },
  ]
  const cameraRig = {
    presetIndex: 0,
    lookTarget: null, // Vector3 — 볼 위치로 지수 lerp
    zoomT: 0, // 골 줌 펄스(1→0 감쇠, sin π 커브로 in-out 한 사이클)
    zoomFocus: null, // 득점자 위치 스냅샷
  }

  function applyCameraFrame(ballPos3, dtMs) {
    const preset = CAMERA_PRESETS[cameraRig.presetIndex]
    if (!cameraRig.lookTarget) cameraRig.lookTarget = new THREE.Vector3(...preset.look)

    // 볼 소프트 팔로우 — lookAt은 볼 65% + 프리셋 기준 35% 혼합점으로 지수 추적.
    const desiredLook = new THREE.Vector3(
      ballPos3.x * 0.65 + preset.look[0] * 0.35,
      preset.look[1],
      ballPos3.z * 0.65 + preset.look[2] * 0.35,
    )
    const lookAlpha = dtMs > 0 ? Math.min(1, dtMs / 600) : 1
    cameraRig.lookTarget.lerp(desiredLook, lookAlpha)

    // 기본 위치 = 프리셋 + 약한 팬(x축만 — 멀미 방지로 y/z 고정).
    const basePos = new THREE.Vector3(
      preset.pos[0] + ballPos3.x * preset.followPan,
      preset.pos[1],
      preset.pos[2],
    )

    // 골 줌인 — zoomT 1→0 감쇠, sin(π·(1-zoomT))가 0→1→0 펄스를 만든다.
    let pos = basePos
    if (cameraRig.zoomT > 0.02 && cameraRig.zoomFocus) {
      const pulse = Math.sin(Math.PI * (1 - cameraRig.zoomT))
      const zoomPos = new THREE.Vector3(
        cameraRig.zoomFocus.x * 0.75,
        preset.pos[1] * 0.42,
        cameraRig.zoomFocus.z * 0.75 + 34,
      )
      pos = basePos.clone().lerp(zoomPos, pulse * 0.8)
      if (dtMs > 0) cameraRig.zoomT *= Math.exp(-dtMs / 1000)
    } else if (cameraRig.zoomT !== 0) {
      cameraRig.zoomT = 0
    }

    const posAlpha = dtMs > 0 ? Math.min(1, dtMs / 400) : 1
    camera.position.lerp(pos, posAlpha)
    camera.lookAt(cameraRig.lookTarget)
  }

  const crowdWaveDummy = new THREE.Object3D()
  const toX = (left) => ((left - 50) / 100) * FIELD_W
  const toZ = (top) => ((top - 50) / 100) * FIELD_L

  function projectToOverlay(pos3) {
    const v = pos3.clone().project(camera)
    return { left: (v.x * 0.5 + 0.5) * 100, top: (-v.y * 0.5 + 0.5) * 100 }
  }

  function track(resource) {
    disposables.push(resource)
    return resource
  }

  // 절차적 로우폴리 휴머노이드 — 상의(팀색)/하의(팀색 어둡게)/머리(스킨 토큰).
  // 팔다리는 어깨/힙 "피벗 그룹"에 매달아 rotation.x 스윙만으로 관절 모션을 낸다.
  function makeHumanoid(shirtColor, phaseSeed) {
    const group = new THREE.Group()
    const shirt = new THREE.Color(shirtColor)
    const shorts = shirt.clone().multiplyScalar(0.45)
    const shirtMat = track(new THREE.MeshLambertMaterial({ color: shirt, transparent: true }))
    const shortsMat = track(new THREE.MeshLambertMaterial({ color: shorts, transparent: true }))
    const skinMat = track(new THREE.MeshLambertMaterial({ color: tokenOf('--pitch3d-skin'), transparent: true }))

    const torso = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, TORSO_H, 0.95)), shirtMat)
    torso.position.y = HIP_Y + TORSO_H / 2
    group.add(torso)

    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.62, 12, 10)), skinMat)
    head.position.y = SHOULDER_Y + 0.75
    group.add(head)

    const limb = (geoLen, radius, mat) => {
      const pivot = new THREE.Group()
      const mesh = new THREE.Mesh(track(new THREE.CapsuleGeometry(radius, geoLen, 3, 8)), mat)
      mesh.position.y = -(geoLen / 2 + radius)
      pivot.add(mesh)
      return pivot
    }

    const legL = limb(LEG_LEN - 0.55, 0.3, shortsMat)
    legL.position.set(-0.45, HIP_Y, 0)
    const legR = limb(LEG_LEN - 0.55, 0.3, shortsMat)
    legR.position.set(0.45, HIP_Y, 0)
    const armL = limb(1.0, 0.22, shirtMat)
    armL.position.set(-1.05, SHOULDER_Y, 0)
    const armR = limb(1.0, 0.22, shirtMat)
    armR.position.set(1.05, SHOULDER_Y, 0)
    group.add(legL, legR, armL, armR)

    group.userData = {
      legL, legR, armL, armR,
      mats: [shirtMat, shortsMat, skinMat],
      phase: phaseSeed * 1.7, // 대기 스윙 위상 분산 — 2D idlePhase와 같은 결정론 방식
      heading: 0,
      kickT: 0,
      celebrateT: 0,
      prev: null,
    }

    // 발밑 블롭 그림자 — 원반(공중에 뜬 느낌 제거).
    const shadow = new THREE.Mesh(
      track(new THREE.CircleGeometry(1.3, 16)),
      track(new THREE.MeshBasicMaterial({ color: tokenOf('--pitch3d-shadow'), transparent: true, opacity: 0.55 })),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.05
    group.add(shadow)
    group.userData.shadow = shadow

    return group
  }

  // 카메라 프리셋 순환 칩 — 3D 전용 컨트롤(extraControls 소유권 원칙).
  const cameraBtn = document.createElement('button')
  cameraBtn.type = 'button'
  cameraBtn.className = 'chip'
  cameraBtn.textContent = CAMERA_PRESETS[0].name
  cameraBtn.addEventListener('click', () => {
    cameraRig.presetIndex = (cameraRig.presetIndex + 1) % CAMERA_PRESETS.length
    cameraBtn.textContent = CAMERA_PRESETS[cameraRig.presetIndex].name
  })

  // 주간/야간 조명 토글 — 조명탑이 야간에 의미를 갖는다.
  const nightBtn = document.createElement('button')
  nightBtn.type = 'button'
  nightBtn.className = 'chip'
  nightBtn.textContent = '주간'
  nightBtn.addEventListener('click', () => {
    night = !night
    nightBtn.textContent = night ? '야간' : '주간'
    applyLighting()
  })

  function applyLighting() {
    if (!scene) return
    if (night) {
      scene.background = new THREE.Color(tokenOf('--pitch3d-night-sky'))
      if (hemiLight) { hemiLight.color.set(tokenOf('--pitch3d-night-sky')); hemiLight.groundColor.set(tokenOf('--pitch3d-night-ground')); hemiLight.intensity = 0.4 }
      if (sunLight) sunLight.intensity = 0.35 // 달빛 — 조명탑 스포트라이트에 의존
      if (stadium) {
        stadium.lightMat.color.set(tokenOf('--pitch3d-floodlight'))
        stadium.lightMat.emissive?.set?.(tokenOf('--pitch3d-floodlight'))
        for (const sp of stadium.spots) sp.intensity = 1.5 // 조명탑 켜짐
      }
    } else {
      // 주간 — 밝은 하늘(near-black이던 것을 실제 낮으로).
      scene.background = new THREE.Color(tokenOf('--pitch3d-day-sky'))
      if (hemiLight) { hemiLight.color.set(tokenOf('--pitch3d-day-sky')); hemiLight.groundColor.set(tokenOf('--pitch3d-ground')); hemiLight.intensity = 1.3 }
      if (sunLight) sunLight.intensity = 1.5
      if (stadium) {
        stadium.lightMat.color.set(tokenOf('--pitch3d-tower')) // 낮엔 조명탑 꺼짐(어둡게)
        for (const sp of stadium.spots) sp.intensity = 0 // 스포트라이트 off
      }
    }
    // idle(킥오프 전)엔 rAF 루프가 없어 render가 안 불린다 — 토글 즉시 1회 그린다.
    if (renderer && scene && camera) renderer.render(scene, camera)
  }

  return {
    root,
    extraControls: [cameraBtn, nightBtn],

    mount({ tokens, teamColors }) {
      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
      root.appendChild(renderer.domElement)
      root.appendChild(overlay)

      scene = new THREE.Scene()
      scene.background = new THREE.Color(tokenOf('--bg-primary', 'black'))

      camera = new THREE.PerspectiveCamera(42, 68 / 100, 0.1, 500)
      camera.position.set(...CAMERA_PRESETS[0].pos)
      camera.lookAt(...CAMERA_PRESETS[0].look)

      hemiLight = new THREE.HemisphereLight(tokenOf('--pitch3d-sky'), tokenOf('--pitch3d-ground'), 1.15)
      scene.add(hemiLight)
      sunLight = new THREE.DirectionalLight(tokenOf('--pitch3d-sun'), 1.4)
      sunLight.position.set(-30, 60, 20)
      scene.add(sunLight)

      const pitchTex = track(makePitchTexture())
      const pitchMat = track(new THREE.MeshLambertMaterial({ map: pitchTex }))
      const pitch = new THREE.Mesh(track(new THREE.PlaneGeometry(FIELD_W, FIELD_L)), pitchMat)
      pitch.rotation.x = -Math.PI / 2
      scene.add(pitch)

      stadium = makeStadium(track, scene, teamColors, FIELD_W, FIELD_L)

      const goalTop = makeGoal(track)
      goalTop.position.z = -FIELD_L / 2
      scene.add(goalTop)
      const goalBottom = makeGoal(track)
      goalBottom.position.z = FIELD_L / 2
      scene.add(goalBottom)

      for (const token of tokens) {
        const rig = makeHumanoid(resolveCssColor(teamColors[token.team]), rigById.size)
        rig.userData.team = token.team
        rig.userData.isGK = token.player.positions.includes('GK')
        rig.position.set(toX(token.basePos.left), 0, toZ(token.basePos.top))
        rig.add(makeLabelSprite(token.player, teamColors[token.team]))
        scene.add(rig)
        rigById.set(token.playerId, rig)
      }

      applyLighting() // 초기 주간 조명(밝은 하늘) 즉시 적용

      const ballMat = track(new THREE.MeshLambertMaterial({
        color: tokenOf('--pitch3d-ball'),
        emissive: tokenOf('--pitch3d-ball'),
        emissiveIntensity: 0.35,
      }))
      ballMesh = new THREE.Mesh(track(new THREE.SphereGeometry(BALL_R, 16, 12)), ballMat)
      ballMesh.position.set(0, BALL_R, 0)
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

    syncFrame({ tokens, ball, dtMs = 0, score = null, minute = 0 }) {
      if (destroyed) return
      for (const token of tokens) {
        const rig = rigById.get(token.playerId)
        if (!rig) continue
        const u = rig.userData
        const x = toX(token.current.left)
        const z = toZ(token.current.top)

        // 이동 속도(씬 단위/ms) — 모션 진폭·주기의 원천. dtMs가 슬로모/배속을 반영한다.
        let speed = 0
        if (u.prev && dtMs > 0) {
          speed = Math.hypot(x - u.prev.x, z - u.prev.z) / dtMs
        }
        rig.position.x = x
        rig.position.z = z

        // 이동 방향으로 몸통 회전(부드럽게) — "포지션만 지키는 말뚝" 인상 제거.
        if (u.prev && speed > 0.0012) {
          const targetHeading = Math.atan2(x - u.prev.x, z - u.prev.z)
          let delta = targetHeading - u.heading
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          u.heading += delta * Math.min(1, dtMs / 120)
          rig.rotation.y = u.heading
        }
        u.prev = { x, z }

        // 달리기 스윙 — 다리 교차 + 팔 반대 스윙, 진폭은 속도 비례(정지 시 잔잔한 대기).
        const amp = 0.08 + Math.min(0.85, speed * 90)
        u.phase += dtMs * (0.004 + speed * 1.1)
        const swing = Math.sin(u.phase)
        u.legL.rotation.x = swing * amp
        u.legR.rotation.x = -swing * amp
        u.armL.rotation.x = -swing * amp * 0.75
        u.armR.rotation.x = swing * amp * 0.75

        // 킥 — 오른발 앞스윙이 달리기 스윙 위에 덮인다(즉발 후 지수 감쇠).
        if (u.kickT > 0.01) {
          u.legR.rotation.x = -u.kickT * 1.5
          u.armL.rotation.x = u.kickT * 0.8
          if (dtMs > 0) u.kickT *= Math.exp(-dtMs / 130)
        }

        // 골 셀레브레이션 — 점프 + 만세.
        if (u.celebrateT > 0.01) {
          rig.position.y = Math.abs(Math.sin(u.celebrateT * 9)) * 1.4
          u.armL.rotation.x = Math.PI * 0.9
          u.armR.rotation.x = Math.PI * 0.9
          if (dtMs > 0) u.celebrateT *= Math.exp(-dtMs / 700)
          if (u.celebrateT < 0.05) {
            // 셀레머니 종료 — 팔 각도를 명시적으로 놓아준다(루프가 죽어도 고착 안 됨).
            u.celebrateT = 0
            u.armL.rotation.x = 0
            u.armR.rotation.x = 0
            rig.position.y = 0
          }
        } else if (rig.position.y !== 0) {
          rig.position.y = 0
        }
      }

      const ballY = ball.flightT !== null
        ? BALL_R + Math.sin(Math.PI * ball.flightT) * BALL_ARC_HEIGHT
        : BALL_R
      ballMesh.position.set(toX(ball.pos.left), ballY, toZ(ball.pos.top))
      if (dtMs > 0) {
        ballMesh.rotation.x += dtMs * 0.01
        ballMesh.rotation.z += dtMs * 0.004
      }

      applyCameraFrame(ballMesh.position, dtMs)

      // 전광판 미러 — 값 변화 시에만 텍스처 재드로잉(매 프레임 업로드 회피).
      if (stadium && score) {
        const key = `${score.home}-${score.away}-${minute}`
        if (key !== stadium.lastBoard) {
          stadium.drawBoard(score.home, score.away, minute)
          stadium.lastBoard = key
        }
      }
      // 관중 웨이브 — 골 시 득점팀 스탠드가 기립(y 상승) 후 지수 복귀.
      if (stadium && crowdWaveT > 0.01) {
        const dummy = crowdWaveDummy
        for (let i = 0; i < stadium.crowdMeta.length; i++) {
          const meta = stadium.crowdMeta[i]
          if (meta.home !== crowdWaveHome) continue
          stadium.crowd.getMatrixAt(i, dummy.matrix)
          dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale)
          dummy.position.y = meta.baseY + crowdWaveT * 1.4
          dummy.updateMatrix()
          stadium.crowd.setMatrixAt(i, dummy.matrix)
        }
        stadium.crowd.instanceMatrix.needsUpdate = true
        if (dtMs > 0) crowdWaveT *= Math.exp(-dtMs / 600)
      }

      root.dataset.ballMode = ball.mode
      root.dataset.holderId = ball.holderId
      if (ball.mode === 'held' && ball.holderId) {
        const holder = rigById.get(ball.holderId)
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
      if (fx.kind === 'kick') {
        const rig = rigById.get(fx.playerId)
        if (rig) rig.userData.kickT = 1
        return
      }
      if (fx.kind === 'celebrate') {
        const rig = rigById.get(fx.playerId)
        if (rig) {
          rig.userData.celebrateT = 1
          cameraRig.zoomT = 1
          cameraRig.zoomFocus = rig.position.clone()
          // 같은 팀 필드 동료도 점프(컨트롤러가 이미 득점자 쪽으로 모아준다).
          for (const other of rigById.values()) {
            if (other !== rig && other.userData.team === rig.userData.team && !other.userData.isGK) {
              other.userData.celebrateT = 0.85
            }
          }
          // 관중 웨이브 — 득점팀 스탠드 기립.
          crowdWaveT = 1
          crowdWaveHome = rig.userData.team === 'A'
        }
        return
      }
      if (fx.kind === 'lunge') {
        const rig = rigById.get(fx.playerId)
        if (rig) rig.userData.kickT = 0.7 // 태클도 다리 스윙 재사용 — 별도 리깅 없이
        return
      }
      if (fx.kind === 'sendOff') {
        const rig = rigById.get(fx.playerId)
        if (rig) for (const mat of rig.userData.mats) mat.opacity = 0.3
        return
      }
      if (fx.kind === 'miniPop') {
        const projected = projectToOverlay(new THREE.Vector3(toX(fx.pos.left), 2.5, toZ(fx.pos.top)))
        spawnMiniPop(overlay, { ...fx, pos: projected })
      } else if (fx.kind === 'flash') {
        spawnFlash(overlay, fx)
      }
    },

    reset() {
      cameraRig.presetIndex = 0
      cameraRig.zoomT = 0
      cameraRig.zoomFocus = null
      cameraRig.lookTarget = null
      cameraBtn.textContent = CAMERA_PRESETS[0].name
      camera?.position.set(...CAMERA_PRESETS[0].pos)
      crowdWaveT = 0
      for (const rig of rigById.values()) {
        const u = rig.userData
        u.kickT = 0
        u.celebrateT = 0
        rig.position.y = 0
        for (const mat of u.mats) mat.opacity = 1
      }
      overlay.replaceChildren()
    },

    // WebGL 컨텍스트 해제 — 브라우저 컨텍스트 한도 초과가 실사고 지점. 멱등.
    destroy() {
      if (destroyed) return
      destroyed = true
      for (const rig of rigById.values()) {
        rig.traverse((node) => {
          if (node.isSprite) {
            node.material.map?.dispose()
            node.material.dispose()
          }
        })
      }
      for (const resource of disposables) resource.dispose?.()
      renderer?.dispose()
      renderer?.forceContextLoss()
      renderer = null
      scene = null
    },
  }
}
