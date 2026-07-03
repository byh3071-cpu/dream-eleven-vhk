// 커리어 모드 화면들 (/career/*) — 홈(구단 선택/시즌 현황), 스쿼드, 전술, 순위표,
// 일정, 매치데이. 편집/전술/재생 UI는 IF와 공유하는 추출 계층(squadEditor,
// tacticsControls, matchPlayback)을 조합하고, 상태는 커리어 스토어(세이브 즉시 저장)다.

import { navigate } from '../../router.js'
import {
  careerPath, careerSquadPath, careerTacticsPath, careerTablePath,
  careerSchedulePath, careerMatchdayPath, homePath,
} from '../../routes.js'
import { CLUBS, findClub } from '../../career/clubs.js'
import { findCareerPlayer } from '../../career/players.js'
import * as store from '../../career/store.js'
import { computeTable } from '../../career/table.js'
import { fixturesOfRound, totalRounds } from '../../career/schedule.js'
import { stateOf, isSuspended } from '../../career/playerState.js'
import { pickBestXI } from '../../career/aiLineup.js'
import { simulateFixture } from '../../career/matchRunner.js'
import { POSITIONS } from '../../data/player-schema.js'
import { FORMATIONS, findFormation } from '../../data/formations.js'
import {
  createEditorState, assignPlayer, unassignSlot, playerMatchesFilter,
} from '../squadEditor/model.js'
import { renderPitch, renderListPanel } from '../squadEditor/view.js'
import { renderMentalitySection, renderSliderSection, SLIDER_FIELDS } from '../tacticsControls.js'
import { clearActivePlayback, buildPlaybackView } from '../matchPlayback.js'

let initialized = false

function ensureInit() {
  if (!initialized) {
    store.initCareer()
    initialized = true
  }
}

// ---------- 공용 조각 ----------

function screenShell(titleText, { backTo = careerPath(), backLabel = '← 커리어 홈' } = {}) {
  const screen = document.createElement('div')
  screen.className = 'screen screen--career'
  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = titleText
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'link-button'
  back.textContent = backLabel
  back.addEventListener('click', () => navigate(backTo))
  topbar.append(title, back)
  screen.appendChild(topbar)
  return screen
}

function clubDot(clubId) {
  const dot = document.createElement('span')
  dot.className = 'career__club-dot'
  dot.style.background = findClub(clubId)?.color ?? 'var(--text-dim)'
  return dot
}

function clubLabel(clubId, { short = false } = {}) {
  const wrap = document.createElement('span')
  wrap.className = 'career__club-label'
  const club = findClub(clubId)
  wrap.append(clubDot(clubId), document.createTextNode(short ? club.short : club.name))
  return wrap
}

function guardNoSave() {
  const save = store.getCareer()
  if (save) return save
  navigate(careerPath())
  return null
}

function navChips(current) {
  const wrap = document.createElement('div')
  wrap.className = 'career__nav'
  const items = [
    ['홈', careerPath()], ['스쿼드', careerSquadPath()], ['전술', careerTacticsPath()],
    ['일정', careerSchedulePath()], ['순위표', careerTablePath()], ['매치데이', careerMatchdayPath()],
  ]
  for (const [label, path] of items) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (path === current ? ' chip--active' : '')
    chip.textContent = label
    chip.addEventListener('click', () => navigate(path))
    wrap.appendChild(chip)
  }
  return wrap
}

function myNextFixture(save) {
  const round = save.season.currentRound
  return save.fixtures
    .map((fixture, index) => ({ fixture, index }))
    .find(({ fixture }) => fixture.round === round
      && (fixture.homeClubId === save.userClubId || fixture.awayClubId === save.userClubId))
}

function renderMiniTable(save, { rows = 4 } = {}) {
  const table = document.createElement('div')
  table.className = 'career__table'
  const header = document.createElement('div')
  header.className = 'career__table-row career__table-row--head'
  for (const h of ['#', '구단', '경기', '승점', '득실']) {
    const cell = document.createElement('span')
    cell.textContent = h
    header.appendChild(cell)
  }
  table.appendChild(header)
  computeTable(CLUBS.map((c) => c.id), save.fixtures).slice(0, rows).forEach((row, i) => {
    const el = document.createElement('div')
    el.className = 'career__table-row'
    if (row.clubId === save.userClubId) el.classList.add('career__table-row--mine')
    const rank = document.createElement('span')
    rank.textContent = String(i + 1)
    const club = document.createElement('span')
    club.appendChild(clubLabel(row.clubId))
    const played = document.createElement('span')
    played.textContent = String(row.played)
    const points = document.createElement('span')
    points.textContent = String(row.points)
    const diff = document.createElement('span')
    const gd = row.goalsFor - row.goalsAgainst
    diff.textContent = gd > 0 ? `+${gd}` : String(gd)
    el.append(rank, club, played, points, diff)
    table.appendChild(el)
  })
  return table
}

// ---------- /career (홈: 구단 선택 or 시즌 현황) ----------

function renderNewCareer(mountEl) {
  const screen = screenShell('커리어 시작 — 구단 선택', { backTo: homePath(), backLabel: '← 모드 선택' })
  const body = document.createElement('div')
  body.className = 'career__body'

  if (store.isCorrupted()) {
    const warn = document.createElement('p')
    warn.className = 'career__hint'
    warn.textContent = '저장된 커리어를 읽지 못했어(손상됨) — 새 커리어를 시작하면 덮어써져.'
    body.appendChild(warn)
  }

  const hint = document.createElement('p')
  hint.className = 'career__hint'
  hint.textContent = '4개 가상 구단이 레전드 풀 76명(필러 GK 포함)을 드래프트로 나눠 갖는다. 맡을 구단을 골라줘.'
  body.appendChild(hint)

  const tiles = document.createElement('div')
  tiles.className = 'career__club-tiles'
  for (const club of CLUBS) {
    const tile = document.createElement('button')
    tile.type = 'button'
    tile.className = 'career__club-tile'
    tile.style.borderColor = club.color
    const name = document.createElement('div')
    name.className = 'career__club-tile-name'
    name.append(clubDot(club.id), document.createTextNode(club.name))
    const pick = document.createElement('div')
    pick.className = 'career__hint'
    pick.textContent = '이 구단으로 시작'
    tile.append(name, pick)
    tile.addEventListener('click', () => {
      // masterSeed는 시작 시각 — sim 밖(앱 계층)이라 Date 사용 가능. 같은 세이브는
      // 이후 영원히 같은 전개(모든 경기 시드가 여기서 파생).
      store.newCareer({ userClubId: club.id, masterSeed: Date.now() })
      navigate(careerPath())
      mountEl.replaceChildren()
      renderCareerHome(mountEl)
    })
    tiles.appendChild(tile)
  }
  body.appendChild(tiles)
  screen.appendChild(body)
  mountEl.appendChild(screen)
}

export function renderCareerHome(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = store.getCareer()
  if (!save) {
    renderNewCareer(mountEl)
    return
  }

  const club = findClub(save.userClubId)
  const screen = screenShell(`커리어 — ${club.name}`, { backTo: homePath(), backLabel: '← 모드 선택' })
  const body = document.createElement('div')
  body.className = 'career__body'
  body.appendChild(navChips(careerPath()))

  if (store.seasonDone(save)) {
    const tableRows = computeTable(CLUBS.map((c) => c.id), save.fixtures)
    const champion = findClub(tableRows[0].clubId)
    const banner = document.createElement('div')
    banner.className = 'career__champion'
    banner.textContent = tableRows[0].clubId === save.userClubId
      ? `🏆 시즌 ${save.season.number} 우승! ${champion.name}`
      : `시즌 ${save.season.number} 종료 — 우승: ${champion.name}`
    body.appendChild(banner)

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'chip'
    reset.textContent = '커리어 초기화(새 드래프트)'
    reset.addEventListener('click', () => {
      store.resetCareer()
      mountEl.replaceChildren()
      renderCareerHome(mountEl)
    })
    body.append(renderMiniTable(save), reset)
  } else {
    const next = myNextFixture(save)
    const card = document.createElement('div')
    card.className = 'career__next-card'
    const roundLabel = document.createElement('div')
    roundLabel.className = 'career__hint'
    roundLabel.textContent = `라운드 ${save.season.currentRound} / ${totalRounds(save.fixtures)}`
    const matchup = document.createElement('div')
    matchup.className = 'career__next-matchup'
    matchup.append(
      clubLabel(next.fixture.homeClubId),
      document.createTextNode(' vs '),
      clubLabel(next.fixture.awayClubId),
    )
    const go = document.createElement('button')
    go.type = 'button'
    go.className = 'chip chip--active'
    go.textContent = '매치데이로 →'
    go.addEventListener('click', () => navigate(careerMatchdayPath()))
    card.append(roundLabel, matchup, go)
    body.append(card, renderMiniTable(save))
  }

  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/squad ----------

// 라인업 편집 상태는 화면 진입 시 세이브에서 복원하고, 변경 즉시 세이브에 반영한다.
let squadEditor = null

function suspensionChip(player, save) {
  const state = stateOf(save.playerState, player.id)
  const wrap = document.createElement('div')
  wrap.className = 'career__player-chips'
  const fatigue = document.createElement('span')
  fatigue.className = 'career__chip'
  if (state.fatigue >= 60) fatigue.classList.add('career__chip--danger')
  else if (state.fatigue >= 30) fatigue.classList.add('career__chip--warn')
  fatigue.textContent = `피로 ${Math.round(state.fatigue)}`
  const form = document.createElement('span')
  form.className = 'career__chip'
  if (state.form > 0) form.classList.add('career__chip--good')
  if (state.form < 0) form.classList.add('career__chip--danger')
  form.textContent = `폼 ${state.form > 0 ? '+' : ''}${state.form}`
  wrap.append(fatigue, form)
  if (state.suspendedFor > 0) {
    const ban = document.createElement('span')
    ban.className = 'career__chip career__chip--danger'
    ban.textContent = `정지 ${state.suspendedFor}`
    wrap.appendChild(ban)
  }
  return wrap
}

export function renderCareerSquad(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave()
  if (!save) return

  if (!squadEditor) {
    squadEditor = createEditorState(save.lineup?.formationId ?? FORMATIONS[0].id)
    squadEditor.assignments = [...(save.lineup?.assignments ?? [])]
  }
  const formation = findFormation(squadEditor.formationId)
  const rosterPlayers = save.rosters[save.userClubId].map(findCareerPlayer)

  const persist = () => {
    store.setLineup({ formationId: squadEditor.formationId, assignments: [...squadEditor.assignments] })
  }

  const fullRerender = () => {
    mountEl.replaceChildren()
    renderCareerSquad(mountEl)
  }

  const onSlotClick = (slotIndex) => {
    const isFilled = squadEditor.assignments.some((a) => a.slotIndex === slotIndex)
    if (isFilled) {
      unassignSlot(squadEditor, slotIndex)
      squadEditor.selectedSlotIndex = null
    } else if (squadEditor.selectedSlotIndex === slotIndex) {
      squadEditor.selectedSlotIndex = null
    } else {
      squadEditor.selectedSlotIndex = slotIndex
      squadEditor.positionFilter = formation.slots[slotIndex].role
    }
    persist()
    fullRerender()
  }

  const onPlayerPick = (player) => {
    if (isSuspended(save.playerState, player.id)) return // 정지자는 배정 불가
    if (squadEditor.selectedSlotIndex != null) {
      assignPlayer(squadEditor, squadEditor.selectedSlotIndex, player.id)
      squadEditor.selectedSlotIndex = null
    } else {
      const targetRole = squadEditor.positionFilter ?? player.positions[0]
      const emptySlotIndex = formation.slots.findIndex((slot, i) =>
        slot.role === targetRole && !squadEditor.assignments.some((a) => a.slotIndex === i))
      if (emptySlotIndex === -1) return
      assignPlayer(squadEditor, emptySlotIndex, player.id)
    }
    persist()
    fullRerender()
  }

  const screen = screenShell('스쿼드 — 선발 XI')
  const body = document.createElement('div')
  body.className = 'career__body'
  body.appendChild(navChips(careerSquadPath()))

  const autoBtn = document.createElement('button')
  autoBtn.type = 'button'
  autoBtn.className = 'chip'
  autoBtn.textContent = '베스트 XI 자동 선발'
  autoBtn.addEventListener('click', () => {
    const auto = pickBestXI({
      rosterIds: save.rosters[save.userClubId],
      resolvePlayer: findCareerPlayer,
      formationId: squadEditor.formationId,
      playerStates: save.playerState,
    })
    if (!auto) return
    squadEditor.assignments = auto.assignments
    persist()
    fullRerender()
  })
  body.appendChild(autoBtn)

  const editorBody = document.createElement('div')
  editorBody.className = 'squad-builder__body'
  editorBody.append(
    renderPitch(squadEditor, formation, onSlotClick, { resolvePlayer: findCareerPlayer }),
    renderListPanel(squadEditor, rosterPlayers, {
      onPlayerPick,
      onFilterChange: (value) => {
        squadEditor.positionFilter = value
        fullRerender()
      },
    }, {
      positions: POSITIONS,
      filterFn: playerMatchesFilter,
      cardDecorator: (card, player) => card.appendChild(suspensionChip(player, save)),
      isPickDisabled: (player) => isSuspended(save.playerState, player.id),
    }))

  body.appendChild(editorBody)
  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/tactics ----------

export function renderCareerTactics(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave()
  if (!save) return

  const screen = screenShell('전술')
  const body = document.createElement('div')
  body.className = 'career__body tactics__body'
  body.appendChild(navChips(careerTacticsPath()))

  const current = { ...save.tactics }
  const persist = () => store.setTactics({ ...current })

  body.appendChild(renderMentalitySection(current.mentality, (value) => {
    current.mentality = value
    persist()
    mountEl.replaceChildren()
    renderCareerTactics(mountEl)
  }))
  for (const field of SLIDER_FIELDS) {
    body.appendChild(renderSliderSection(field, current[field.key], (v) => {
      current[field.key] = v
      persist()
    }))
  }

  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/table ----------

export function renderCareerTable(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave()
  if (!save) return
  const screen = screenShell('리그 순위표')
  const body = document.createElement('div')
  body.className = 'career__body'
  body.append(navChips(careerTablePath()), renderMiniTable(save, { rows: 4 }))
  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/schedule ----------

export function renderCareerSchedule(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave()
  if (!save) return
  const screen = screenShell('시즌 일정')
  const body = document.createElement('div')
  body.className = 'career__body'
  body.appendChild(navChips(careerSchedulePath()))

  for (let round = 1; round <= totalRounds(save.fixtures); round++) {
    const section = document.createElement('div')
    section.className = 'career__round'
    if (round === save.season.currentRound) section.classList.add('career__round--current')
    const heading = document.createElement('div')
    heading.className = 'career__round-heading'
    heading.textContent = `라운드 ${round}`
    section.appendChild(heading)
    for (const fixture of fixturesOfRound(save.fixtures, round)) {
      const row = document.createElement('div')
      row.className = 'career__fixture'
      const isMine = fixture.homeClubId === save.userClubId || fixture.awayClubId === save.userClubId
      if (isMine) row.classList.add('career__fixture--mine')
      const home = clubLabel(fixture.homeClubId, { short: true })
      const score = document.createElement('span')
      score.className = 'career__fixture-score'
      score.textContent = fixture.result
        ? `${fixture.result.homeGoals} - ${fixture.result.awayGoals}`
        : 'vs'
      const away = clubLabel(fixture.awayClubId, { short: true })
      row.append(home, score, away)
      section.appendChild(row)
    }
    body.appendChild(section)
  }
  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/matchday ----------

function lineupProblems(save) {
  const problems = []
  const lineup = save.lineup
  if (!lineup || lineup.assignments.length === 0) {
    problems.push('선발 XI가 아직 없어 — 스쿼드에서 구성하거나 자동 선발을 눌러줘')
    return problems
  }
  const formation = findFormation(lineup.formationId)
  if (lineup.assignments.length < formation.slots.length) {
    problems.push(`선발이 ${lineup.assignments.length}/${formation.slots.length}명뿐이야`)
  }
  const players = lineup.assignments.map(({ playerId }) => findCareerPlayer(playerId))
  if (!players.some((p) => p.positions.includes('GK'))) {
    problems.push('골키퍼가 없어')
  }
  const banned = players.filter((p) => isSuspended(save.playerState, p.id))
  if (banned.length > 0) {
    problems.push(`출전 정지 선수가 선발에 있어: ${banned.map((p) => p.name).join(', ')}`)
  }
  return problems
}

export function renderCareerMatchday(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave()
  if (!save) return

  const screen = screenShell('매치데이')
  const body = document.createElement('div')
  body.className = 'career__body'
  body.appendChild(navChips(careerMatchdayPath()))

  if (store.seasonDone(save)) {
    const done = document.createElement('p')
    done.className = 'career__hint'
    done.textContent = '시즌이 끝났어 — 커리어 홈에서 결과를 확인해줘.'
    body.appendChild(done)
    screen.appendChild(body)
    mountEl.appendChild(screen)
    return
  }

  const { fixture, index: fixtureIndex } = myNextFixture(save)
  const matchup = document.createElement('div')
  matchup.className = 'career__next-matchup'
  matchup.append(
    clubLabel(fixture.homeClubId),
    document.createTextNode(' vs '),
    clubLabel(fixture.awayClubId),
  )
  body.appendChild(matchup)

  const problems = lineupProblems(save)
  if (problems.length > 0) {
    for (const message of problems) {
      const row = document.createElement('div')
      row.className = 'match__guard-row'
      const text = document.createElement('span')
      text.textContent = message
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'chip'
      link.textContent = '스쿼드로 이동'
      link.addEventListener('click', () => navigate(careerSquadPath()))
      row.append(text, link)
      body.appendChild(row)
    }
    screen.appendChild(body)
    mountEl.appendChild(screen)
    return
  }

  // 결과는 고정 시드 사전계산 — "관전"과 "즉시 결과"가 반드시 같다.
  const sim = simulateFixture(save, fixtureIndex)

  const finish = () => {
    store.finishRound({ precomputedMine: { fixtureIndex, result: sim.result, input: sim.input } })
    squadEditor = null // 정지자 정리 반영을 위해 다음 진입 시 세이브에서 재복원
    navigate(careerPath())
  }

  const actions = document.createElement('div')
  actions.className = 'match__controls'
  const instant = document.createElement('button')
  instant.type = 'button'
  instant.className = 'chip'
  instant.textContent = `즉시 결과 (${sim.result.score.home} - ${sim.result.score.away} 확정)`
  // 스코어 스포일러를 피하려면 관전을 누르면 된다 — 즉시 버튼에만 결과를 미리 보여준다.
  instant.addEventListener('click', finish)
  actions.appendChild(instant)
  body.appendChild(actions)

  const playback = buildPlaybackView({
    homeSquad11: sim.input.home.squad11,
    homeFormation: sim.input.home.formation,
    awaySquad11: sim.input.away.squad11,
    awayFormation: sim.input.away.formation,
    tacticsBySide: { A: sim.input.home.tactics, B: sim.input.away.tactics },
    resolvePlayer: findCareerPlayer,
    onKickoffRequest: () => playback.setResult(sim.result),
    onPhase: (phase) => {
      if (phase === 'done') finishBtn.hidden = false
    },
  })

  const finishBtn = document.createElement('button')
  finishBtn.type = 'button'
  finishBtn.className = 'chip chip--active'
  finishBtn.textContent = '라운드 마무리 →'
  finishBtn.hidden = true
  finishBtn.addEventListener('click', finish)
  playback.controlsBar.appendChild(finishBtn)

  body.append(playback.scoreboard, playback.pitch, playback.commentary, playback.controlsBar)
  screen.appendChild(body)
  mountEl.appendChild(screen)
}
