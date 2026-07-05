// 선수 모드 화면 — 커스텀 아바타를 만들고 친선으로 부트스트랩 성장시켜 리그 진입까지 본다.
// avatar.js(순수 로직) 위의 얇은 UI. 색은 tokens.css var()만(designLint), 숫자는 textContent(XSS).
// 슬라이스 2-1 UI: 생성 → 친선 반복 → 스탯 성장·리그 진입권 시각화. 세이브/관전은 후속.

import { navigate } from '../../router.js'
import { homePath } from '../../routes.js'
import { createAvatar, playFriendly, growAvatar } from '../../career/avatar.js'
import { generateRoster } from '../../world/season.js'
import { playerOverallRating } from '../../sim/teamStrength.js'

const SEED = 20260705
const POSITIONS = ['ST', 'LW', 'RW', 'AM', 'CM', 'DM', 'CB', 'LB', 'RB', 'GK']
const STAT_LABELS = { pace: '스피드', shooting: '슛', passing: '패스', dribbling: '드리블', defending: '수비', physical: '피지컬' }

export function renderPlayerMode(mountEl) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--player'
  const state = {
    avatar: null,
    count: 0,
    logs: [],
    teammates: generateRoster('my_club', SEED),
    opponents: generateRoster('rival_club', SEED + 1),
  }
  state.weakest = Math.min(...state.teammates.filter((p) => !p.positions.includes('GK')).map(playerOverallRating))

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function paintCreate() {
    screen.append(el('h1', 'player__title', '선수 모드'))
    screen.append(el('p', 'player__sub', '나만의 선수를 만들어 무명에서 1군까지 — 친선으로 성장한다.'))

    const form = el('div', 'player__form')
    const nameIn = el('input', 'player__input')
    nameIn.type = 'text'; nameIn.placeholder = '선수 이름'; nameIn.value = '노뚝이'; nameIn.maxLength = 12

    const posSel = el('select', 'player__select')
    for (const p of POSITIONS) { const o = el('option', null, p); o.value = p; posSel.append(o) }

    const kindWrap = el('div', 'player__kinds')
    let kind = 'youth'
    for (const [val, label] of [['youth', '유스 (15세, 무명→스타)'], ['pro', '기성 (바로 프로)']]) {
      const b = el('button', 'chip' + (val === kind ? ' chip--active' : ''), label)
      b.type = 'button'
      b.addEventListener('click', () => {
        kind = val
        for (const c of kindWrap.children) c.className = 'chip'
        b.className = 'chip chip--active'
      })
      kindWrap.append(b)
    }

    const start = el('button', 'chip chip--active player__start', '커리어 시작 →')
    start.type = 'button'
    start.addEventListener('click', () => {
      state.avatar = createAvatar({
        name: nameIn.value.trim() || '나', position: posSel.value, kind, seed: SEED,
      })
      paint()
    })

    form.append(labeled('이름', nameIn), labeled('포지션', posSel), labeled('시작 유형', kindWrap), start)
    screen.append(form)
    screen.append(backBtn())
  }

  function labeled(label, node) {
    const row = el('div', 'player__field')
    row.append(el('label', 'player__label', label), node)
    return row
  }

  function paintCareer() {
    const a = state.avatar
    const ovr = playerOverallRating(a)
    const inLeague = ovr >= state.weakest

    screen.append(el('h1', 'player__title', a.name))
    const meta = el('p', 'player__sub', `${a.age}세 · ${a.positions[0]} · 오버롤 ${ovr} (잠재 ${a.potential})`)
    screen.append(meta)

    // 리그 진입권 배지
    const badge = el('div', 'player__badge' + (inLeague ? ' player__badge--in' : ''),
      inLeague ? '⚽ 1군 진입권 — 실력으로 리그 XI 등장 가능!' : `🌱 성장 중 — 1군까지 오버롤 ${state.weakest} 필요`)
    screen.append(badge)

    // 스탯 바
    const stats = el('div', 'player__stats')
    for (const key of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']) {
      const row = el('div', 'player__stat')
      row.append(el('span', 'player__stat-label', STAT_LABELS[key]))
      const bar = el('div', 'player__bar')
      const fill = el('div', 'player__bar-fill')
      fill.style.width = `${a.stats[key]}%`
      bar.append(fill)
      row.append(bar, el('span', 'player__stat-val', String(a.stats[key])))
      stats.append(row)
    }
    screen.append(stats)

    // 친선 버튼 + 로그
    const play = el('button', 'chip chip--active player__play', `친선 경기 ▶ (${state.count}경기)`)
    play.type = 'button'
    play.addEventListener('click', () => {
      const fr = playFriendly({ avatar: a, teammates: state.teammates, opponents: state.opponents, seed: SEED + 1000 + state.count })
      state.count += 1
      const before = ovr
      state.avatar = growAvatar(a, fr?.avatarRating, { seed: state.count })
      const after = playerOverallRating(state.avatar)
      state.logs.unshift(`친선 ${state.count}: 평점 ${fr?.avatarRating?.toFixed(1) ?? '-'} · 오버롤 ${before}→${after}${after >= state.weakest && before < state.weakest ? ' 🎉 1군 진입!' : ''}`)
      paint()
    })
    screen.append(play)

    if (state.logs.length) {
      const log = el('div', 'player__log')
      for (const line of state.logs.slice(0, 8)) log.append(el('div', 'player__log-line', line))
      screen.append(log)
    }
    screen.append(backBtn())
  }

  function backBtn() {
    const b = el('button', 'chip player__back', '← 홈')
    b.type = 'button'
    b.addEventListener('click', () => navigate(homePath()))
    return b
  }

  function paint() {
    screen.replaceChildren()
    if (!state.avatar) paintCreate()
    else paintCareer()
  }

  paint()
  mountEl.appendChild(screen)
}
