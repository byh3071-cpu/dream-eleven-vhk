// 결과 화면. /match에서 킥오프한 결과(match.js의 getLastMatchResult)를 읽기 전용으로
// 보여준다 — 재생 애니메이션 없이 스코어/스탯/전체 타임라인을 한눈에.

import { getLastMatchResult } from './match.js'
import { findPlayer } from '../../data/players.db.js'
import { eventCommentary } from '../../sim/commentary.js'
import { navigate } from '../../router.js'
import { homePath, ifSquadPath, ifMatchPath } from '../../routes.js'

const SIDE_LABEL = { home: '홈', away: '원정' }
const TEAM_TO_SIDE = { A: 'home', B: 'away' }

function renderGuard(mountEl) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--result'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = '결과'
  topbar.appendChild(title)

  const guard = document.createElement('div')
  guard.className = 'match__guard'
  const message = document.createElement('p')
  message.textContent = '아직 경기 기록이 없어. 먼저 경기를 킥오프해줘.'
  const link = document.createElement('button')
  link.type = 'button'
  link.className = 'chip chip--active'
  link.textContent = '경기 관전으로 이동'
  link.addEventListener('click', () => navigate(ifMatchPath()))
  guard.append(message, link)

  screen.append(topbar, guard)
  mountEl.appendChild(screen)
}

function renderScoreboard(result) {
  const wrap = document.createElement('div')
  wrap.className = 'result__scoreboard'
  const score = document.createElement('div')
  score.className = 'result__score'
  score.textContent = `${result.score.home} - ${result.score.away}`
  const labels = document.createElement('div')
  labels.className = 'result__side-labels'
  const homeLabel = document.createElement('span')
  homeLabel.textContent = SIDE_LABEL.home
  const awayLabel = document.createElement('span')
  awayLabel.textContent = SIDE_LABEL.away
  labels.append(homeLabel, awayLabel)
  wrap.append(labels, score)
  return wrap
}

function renderScorers(result) {
  const wrap = document.createElement('div')
  wrap.className = 'result__scorers'
  for (const team of ['A', 'B']) {
    const col = document.createElement('div')
    col.className = 'result__scorers-col'
    const heading = document.createElement('div')
    heading.className = 'result__scorers-heading'
    heading.textContent = `${SIDE_LABEL[TEAM_TO_SIDE[team]]} 득점자`
    col.appendChild(heading)

    const goals = result.events.filter((e) => e.type === 'goal' && e.team === team)
    if (goals.length === 0) {
      const none = document.createElement('div')
      none.className = 'result__scorers-line result__scorers-line--none'
      none.textContent = '득점 없음'
      col.appendChild(none)
    }
    for (const goal of goals) {
      const line = document.createElement('div')
      line.className = 'result__scorers-line'
      line.textContent = `${goal.minute}' ${findPlayer(goal.actorId).name}`
      col.appendChild(line)
    }
    wrap.appendChild(col)
  }
  return wrap
}

const STAT_ROWS = [
  { key: 'shots', label: '슈팅' },
  { key: 'shotsOnTarget', label: '유효 슈팅' },
  { key: 'goals', label: '득점' },
  { key: 'corners', label: '코너킥' },
  { key: 'fouls', label: '파울' },
  { key: 'yellows', label: '경고' },
  { key: 'reds', label: '퇴장' },
  { key: 'offsides', label: '오프사이드' },
]

function renderStatsTable(result) {
  const table = document.createElement('div')
  table.className = 'result__stats'

  for (const row of STAT_ROWS) {
    const line = document.createElement('div')
    line.className = 'result__stats-row'
    const homeVal = document.createElement('span')
    homeVal.className = 'result__stats-value'
    homeVal.textContent = String(result.stats.A[row.key])
    const label = document.createElement('span')
    label.className = 'result__stats-label'
    label.textContent = row.label
    const awayVal = document.createElement('span')
    awayVal.className = 'result__stats-value'
    awayVal.textContent = String(result.stats.B[row.key])
    line.append(homeVal, label, awayVal)
    table.appendChild(line)
  }

  // possessions는 "체인을 몇 번 가져갔는가"를 세는 값(시간 기반 점유율이 아님) — 그래도
  // 두 팀 비중으로 바꾸면 "누가 공을 더 많이 잡았는가"를 직관적으로 보여줄 수 있다.
  const totalChains = result.stats.A.possessions + result.stats.B.possessions
  if (totalChains > 0) {
    const homeShare = Math.round((result.stats.A.possessions / totalChains) * 100)
    const line = document.createElement('div')
    line.className = 'result__stats-row'
    const homeVal = document.createElement('span')
    homeVal.className = 'result__stats-value'
    homeVal.textContent = `${homeShare}%`
    const label = document.createElement('span')
    label.className = 'result__stats-label'
    label.textContent = '점유(체인 비중)'
    const awayVal = document.createElement('span')
    awayVal.className = 'result__stats-value'
    awayVal.textContent = `${100 - homeShare}%`
    line.append(homeVal, label, awayVal)
    table.appendChild(line)
  }

  return table
}

function renderTimeline(result) {
  const wrap = document.createElement('div')
  wrap.className = 'result__timeline'
  for (const event of result.events) {
    const text = eventCommentary(event, findPlayer)
    if (!text) continue
    const line = document.createElement('div')
    line.className = 'match__commentary-line'
    if (event.type === 'goal') line.classList.add('match__commentary-line--goal')
    line.textContent = text
    wrap.appendChild(line)
  }
  return wrap
}

function renderActions() {
  const wrap = document.createElement('div')
  wrap.className = 'match__controls'

  const rematch = document.createElement('button')
  rematch.type = 'button'
  rematch.className = 'chip chip--active'
  rematch.textContent = '재대결하러 가기'
  rematch.addEventListener('click', () => navigate(ifMatchPath()))

  const editHome = document.createElement('button')
  editHome.type = 'button'
  editHome.className = 'chip'
  editHome.textContent = '홈 스쿼드 수정'
  editHome.addEventListener('click', () => navigate(ifSquadPath('home')))

  const editAway = document.createElement('button')
  editAway.type = 'button'
  editAway.className = 'chip'
  editAway.textContent = '원정 스쿼드 수정'
  editAway.addEventListener('click', () => navigate(ifSquadPath('away')))

  const newGame = document.createElement('button')
  newGame.type = 'button'
  newGame.className = 'link-button'
  newGame.textContent = '새 경기(처음으로)'
  newGame.addEventListener('click', () => navigate(homePath()))

  wrap.append(rematch, editHome, editAway, newGame)
  return wrap
}

export function renderResult(mountEl) {
  const result = getLastMatchResult()
  if (!result) {
    renderGuard(mountEl)
    return
  }

  const screen = document.createElement('div')
  screen.className = 'screen screen--result'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = '결과'
  topbar.appendChild(title)

  const body = document.createElement('div')
  body.className = 'result__body'
  body.append(
    renderScoreboard(result),
    renderScorers(result),
    renderStatsTable(result),
    renderTimeline(result),
    renderActions(),
  )

  screen.append(topbar, body)
  mountEl.appendChild(screen)
}
