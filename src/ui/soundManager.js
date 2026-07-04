// 경기장 사운드 — Web Audio 레이어링(goal 21, EA FC 방식 차용).
// 구조: 베드(관중 앰비언스) 루프 상시 + 이벤트 원샷(랜덤 피치 변형) + 골 순간
// 베드 게인 스파이크 후 지수 복귀. 에셋은 전부 실제 경기장 녹음(Freesound CC0,
// docs/CREDITS.md — 크레딧 의무 없는 CC0지만 예의상 표기).
//
// 브라우저 자동재생 정책: AudioContext는 유저 제스처에서만 시작 — 컨트롤바의
// 사운드 토글(및 킥오프 클릭)이 그 지점이다. 기본 off.
//
// 소유권: 오디오 자원은 이 모듈이 단일 소유(matchPlayback의 타이머 규칙과 동일
// 철학). 화면 전환에도 컨텍스트는 유지하고 베드만 정지한다.

const ASSETS = {
  ambience: './assets/audio/ambience.mp3',
  cheerA: './assets/audio/cheer-goal-a.mp3',
  cheerB: './assets/audio/cheer-goal-b.mp3',
  groan: './assets/audio/groan.mp3',
  whistleKickoff: './assets/audio/whistle-kickoff.mp3',
  whistleFoul: './assets/audio/whistle-foul.mp3',
  whistleFulltime: './assets/audio/whistle-fulltime.mp3',
  kick: './assets/audio/kick.mp3',
  swell: './assets/audio/crowd-swell.mp3',
}

const PREFS_KEY = 'dream-eleven.prefs'
const BED_BASE_GAIN = 0.3
const BED_GOAL_SPIKE = 1.0
const BED_RECOVER_SECONDS = 10

let ctx = null
let masterGain = null
let bedGain = null
let bedSource = null
const buffers = new Map()
let loading = null
let enabled = false

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function isSoundOn() {
  return readPrefs().sound === true
}

export function soundVolume() {
  const v = readPrefs().soundVolume
  return typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 0.8
}

function savePrefs(patch) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }))
  } catch { /* 저장 실패는 치명 아님 */ }
}

// 랜덤 피치 변형(±3%) — 원샷 반복감 제거. 판정과 무관한 순수 연출이라 Math.random 허용.
function detuneRate() {
  return 0.97 + Math.random() * 0.06
}

async function loadBuffer(name) {
  if (buffers.has(name)) return buffers.get(name)
  const res = await fetch(ASSETS[name])
  const raw = await res.arrayBuffer()
  const decoded = await ctx.decodeAudioData(raw)
  buffers.set(name, decoded)
  return decoded
}

async function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.gain.value = soundVolume()
    masterGain.connect(ctx.destination)
    bedGain = ctx.createGain()
    bedGain.gain.value = BED_BASE_GAIN
    bedGain.connect(masterGain)
  }
  if (ctx.state === 'suspended') await ctx.resume()
  // 핵심 버퍼 선로딩(앰비언스+골/휘슬) — 나머지는 첫 사용 시.
  loading ??= Promise.all(['ambience', 'cheerA', 'whistleKickoff', 'kick'].map(loadBuffer))
  await loading
}

function playOneShot(name, { gain = 1, rate = detuneRate() } = {}) {
  if (!enabled || !ctx || !buffers.has(name)) {
    // 미로딩 원샷은 로딩 후 재생 생략(다음 기회) — 이벤트 사운드는 늦으면 의미 없다.
    if (enabled && ctx) loadBuffer(name).catch(() => {})
    return
  }
  const source = ctx.createBufferSource()
  source.buffer = buffers.get(name)
  source.playbackRate.value = rate
  const g = ctx.createGain()
  g.gain.value = gain
  source.connect(g)
  g.connect(masterGain)
  source.start()
}

function startBed() {
  if (bedSource || !buffers.has('ambience')) return
  bedSource = ctx.createBufferSource()
  bedSource.buffer = buffers.get('ambience')
  bedSource.loop = true
  // mp3 인코더 패딩 컷 — 무결절 루프(리서치 실무 팁).
  bedSource.loopStart = 0.15
  bedSource.loopEnd = bedSource.buffer.duration - 0.15
  bedSource.connect(bedGain)
  bedSource.start()
}

function stopBed() {
  if (!bedSource) return
  try { bedSource.stop() } catch { /* 이미 정지 */ }
  bedSource = null
}

// ---------- 공개 API ----------

export async function enableSound() {
  enabled = true
  savePrefs({ sound: true })
  await ensureContext()
  startBed()
}

export function disableSound() {
  enabled = false
  savePrefs({ sound: false })
  stopBed()
}

export function setVolume(volume) {
  savePrefs({ soundVolume: volume })
  if (masterGain) masterGain.gain.value = volume
}

// 매치 이벤트 훅 — matchPlayback 컨트롤러가 호출(2D/3D 공용, 백엔드 무관).
export function matchSound(kind, { homeSide = true } = {}) {
  if (!enabled || !ctx) return
  switch (kind) {
    case 'kickoff':
      playOneShot('whistleKickoff', { gain: 0.7, rate: 1 })
      break
    case 'fulltime':
      playOneShot('whistleFulltime', { gain: 0.7, rate: 1 })
      break
    case 'foul':
      playOneShot('whistleFoul', { gain: 0.55 })
      break
    case 'kick':
      playOneShot('kick', { gain: 0.5 })
      break
    case 'card':
      playOneShot('groan', { gain: 0.5 })
      break
    case 'chance':
      playOneShot('swell', { gain: 0.4 })
      break
    case 'goal': {
      // 홈 골=폭발 환호, 원정 골=탄식(홈 관중 관점) + 베드 스파이크 후 지수 복귀.
      playOneShot(homeSide ? (Math.random() < 0.5 ? 'cheerA' : 'cheerB') : 'groan', { gain: homeSide ? 1 : 0.7 })
      const now = ctx.currentTime
      bedGain.gain.cancelScheduledValues(now)
      bedGain.gain.setValueAtTime(homeSide ? BED_GOAL_SPIKE : BED_BASE_GAIN * 1.5, now)
      bedGain.gain.setTargetAtTime(BED_BASE_GAIN, now + 1.5, BED_RECOVER_SECONDS / 4)
      break
    }
  }
}
