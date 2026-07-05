// 월드 리그 순위표 화면 — 4개국 리그를 탭으로 전환하며 한 시즌 시뮬 순위표를 본다.
// season.js(순수·결정론)를 그대로 호출 → 같은 시드는 항상 같은 순위표. UI는 렌더만.
// 구단 색은 데이터(club.primary) 변수 참조 — JS hex 리터럴 아님(designLint 무관).

import { navigate } from '../../router.js'
import { LEAGUES } from '../../world/leagues.js'
import { simulateWorldSeason } from '../../world/season.js'
import { worldPath, homePath } from '../../routes.js'

const WORLD_SEED = 20260705

function cell(text, className) {
  const td = document.createElement('td')
  if (className) td.className = className
  td.textContent = text
  return td
}

export function renderWorldLeague(mountEl, params) {
  const league = LEAGUES.find((l) => l.id === params?.leagueId) ?? LEAGUES[0]
  const { table } = simulateWorldSeason(league, WORLD_SEED)
  const clubById = Object.fromEntries(league.clubs.map((c) => [c.id, c]))

  const screen = document.createElement('div')
  screen.className = 'screen screen--world'

  const title = document.createElement('h1')
  title.className = 'world__title'
  title.textContent = `${league.name}`
  const sub = document.createElement('p')
  sub.className = 'world__sub'
  sub.textContent = `${league.country} · 1부 ${league.clubs.length}팀 · ${(league.clubs.length - 1) * league.rounds}R`

  // 플래그십 4개국 탭(주력) + 전체 39개국 드롭다운
  const tabs = document.createElement('div')
  tabs.className = 'world__tabs'
  for (const l of LEAGUES.filter((x) => !x.generated)) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip' + (l.id === league.id ? ' chip--active' : '')
    b.textContent = l.name
    b.addEventListener('click', () => navigate(worldPath(l.id)))
    tabs.appendChild(b)
  }
  const select = document.createElement('select')
  select.className = 'world__select'
  const fgGroup = document.createElement('optgroup')
  fgGroup.label = '플래그십'
  const genGroup = document.createElement('optgroup')
  genGroup.label = '생성 리그 (35개국)'
  for (const l of LEAGUES) {
    const opt = document.createElement('option')
    opt.value = l.id
    opt.textContent = `${l.name} · ${l.country} (${l.clubs.length}팀)`
    if (l.id === league.id) opt.selected = true
    ;(l.generated ? genGroup : fgGroup).appendChild(opt)
  }
  select.append(fgGroup, genGroup)
  select.addEventListener('change', () => navigate(worldPath(select.value)))
  tabs.appendChild(select)

  // 순위표
  const tableEl = document.createElement('table')
  tableEl.className = 'world__table'
  const thead = document.createElement('thead')
  const htr = document.createElement('tr')
  for (const h of ['#', '', '구단', '경기', '승', '무', '패', '득실', '승점']) {
    const th = document.createElement('th')
    th.textContent = h
    htr.appendChild(th)
  }
  thead.appendChild(htr)
  tableEl.appendChild(thead)

  const tbody = document.createElement('tbody')
  table.forEach((r, i) => {
    const club = clubById[r.clubId]
    const tr = document.createElement('tr')
    // 순위 구역 강조: 우승/상위(대륙컵권) / 강등권
    if (i === 0) tr.className = 'world__row--champ'
    else if (i >= table.length - league.relegation) tr.className = 'world__row--releg'

    tr.appendChild(cell(String(i + 1), 'world__rank'))

    const swTd = document.createElement('td')
    const dot = document.createElement('span')
    dot.className = 'world__dot'
    dot.style.background = club?.primary ?? 'var(--text-dim)' // 구단색(변수)
    swTd.appendChild(dot)
    tr.appendChild(swTd)

    tr.appendChild(cell(club?.name ?? r.clubId, 'world__name'))
    tr.appendChild(cell(String(r.played)))
    tr.appendChild(cell(String(r.wins)))
    tr.appendChild(cell(String(r.draws)))
    tr.appendChild(cell(String(r.losses)))
    const gd = r.goalsFor - r.goalsAgainst
    tr.appendChild(cell(`${gd >= 0 ? '+' : ''}${gd}`))
    tr.appendChild(cell(String(r.points), 'world__pts'))
    tbody.appendChild(tr)
  })
  tableEl.appendChild(tbody)

  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'chip'
  back.textContent = '← 홈'
  back.addEventListener('click', () => navigate(homePath()))

  screen.append(title, sub, tabs, tableEl, back)
  mountEl.appendChild(screen)
}
