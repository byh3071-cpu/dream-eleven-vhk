// 커리어 모드 화면들 (/career/*) — 홈(구단 선택/시즌 현황), 스쿼드, 전술, 순위표,
// 일정, 매치데이. 편집/전술/재생 UI는 IF와 공유하는 추출 계층(squadEditor,
// tacticsControls, matchPlayback)을 조합하고, 상태는 커리어 스토어(세이브 즉시 저장)다.

import { navigate } from '../../router.js'
import {
  careerPath, careerSquadPath, careerTacticsPath, careerTablePath,
  careerSchedulePath, careerMatchdayPath, careerDraftPath, careerRecordsPath, careerTransferPath, homePath,
} from '../../routes.js'
import { CLUBS, findClub } from '../../career/clubs.js'
import { findCareerPlayer } from '../../career/players.js'
import * as store from '../../career/store.js'
import { computeTable } from '../../career/table.js'
import { fixturesOfRound, totalRounds } from '../../career/schedule.js'
import { topScorers } from '../../career/records.js'
import { currentClubOf } from '../../career/draft.js'
import { createPlayerCard } from '../components/playerCard.js'
import { playerOverallRating } from '../../sim/teamStrength.js'
import { stateOf, isSuspended } from '../../career/playerState.js'
import { pickBestXI } from '../../career/aiLineup.js'
import { simulateFixture } from '../../career/matchRunner.js'
import { canBuy, bestSellOffer, priceOf, clubOfPlayer as transferClubOf, MIN_ROSTER } from '../../career/transfers.js'
import { playerValue } from '../../career/value.js'
import { motmOf } from '../../sim/playerRatings.js'
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

// 세이브 없으면 홈으로, 드래프트 진행 중이면(시즌 화면 접근 시) 드래프트로 보낸다.
function guardNoSave({ allowDraftPhase = false } = {}) {
  const save = store.getCareer()
  if (!save) {
    navigate(careerPath())
    return null
  }
  if (!allowDraftPhase && save.phase === 'draft') {
    navigate(careerDraftPath())
    return null
  }
  if (!allowDraftPhase && save.phase === 'transfer') {
    navigate(careerTransferPath())
    return null
  }
  return save
}

function navChips(current) {
  const wrap = document.createElement('div')
  wrap.className = 'career__nav'
  const items = [
    ['홈', careerPath()], ['스쿼드', careerSquadPath()], ['전술', careerTacticsPath()],
    ['일정', careerSchedulePath()], ['순위표', careerTablePath()], ['기록', careerRecordsPath()],
    ['매치데이', careerMatchdayPath()],
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
  if (save.phase === 'draft') {
    navigate(careerDraftPath())
    renderCareerDraft(mountEl)
    return
  }
  if (save.phase === 'transfer') {
    navigate(careerTransferPath())
    renderCareerTransfer(mountEl)
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

    const nextSeason = document.createElement('button')
    nextSeason.type = 'button'
    nextSeason.className = 'chip chip--active'
    nextSeason.textContent = `시즌 ${save.season.number} 이적창 열기 →`
    nextSeason.addEventListener('click', () => {
      store.enterTransferWindow()
      squadEditor = null
      navigate(careerTransferPath())
      mountEl.replaceChildren()
      renderCareerTransfer(mountEl)
    })

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'link-button'
    reset.textContent = '커리어 초기화(처음부터)'
    reset.addEventListener('click', () => {
      store.resetCareer()
      squadEditor = null
      mountEl.replaceChildren()
      renderCareerHome(mountEl)
    })
    body.append(renderMiniTable(save), nextSeason, reset)
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

  if (save.history.length > 0) {
    const historyBox = document.createElement('div')
    historyBox.className = 'career__history'
    const heading = document.createElement('div')
    heading.className = 'career__round-heading'
    heading.textContent = '역대 시즌'
    historyBox.appendChild(heading)
    for (const entry of save.history) {
      const line = document.createElement('div')
      line.className = 'career__history-line'
        const scorer = entry.topScorer ? findCareerPlayer(entry.topScorer.playerId) : null
      line.append(
        document.createTextNode(`시즌 ${entry.season} — 우승 `),
        clubLabel(entry.championClubId, { short: true }),
        document.createTextNode(
          `${entry.championClubId === save.userClubId ? ' (내 구단!)' : ''}`
          + ` · 내 순위 ${entry.myClubRank}위`
          + (scorer ? ` · 득점왕 ${scorer.name} ${entry.topScorer.goals}골` : '')),
      )
      historyBox.appendChild(line)
    }
    body.appendChild(historyBox)
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
      // 긴 스크롤 완화 1차: 레이팅 내림차순 - 상위 자원이 먼저 보인다(사용자 지적).
      sortFn: (a, b) => playerOverallRating(b) - playerOverallRating(a),
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

  const homeClub = findClub(fixture.homeClubId)
  const awayClub = findClub(fixture.awayClubId)
  const playback = buildPlaybackView({
    homeSquad11: sim.input.home.squad11,
    homeFormation: sim.input.home.formation,
    awaySquad11: sim.input.away.squad11,
    awayFormation: sim.input.away.formation,
    tacticsBySide: { A: sim.input.home.tactics, B: sim.input.away.tactics },
    // 구단 색/이름으로 팀 구분(사용자 지적) — IF의 홈/원정 기본색 대신 실제 구단 정체성.
    teamColors: { A: homeClub.color, B: awayClub.color },
    teamLabels: { A: homeClub.short, B: awayClub.short },
    resolvePlayer: findCareerPlayer,
    onKickoffRequest: () => playback.setResult(sim.result),
    onPhase: (phase) => {
      if (phase === 'done') {
        finishBtn.hidden = false
        const motm = motmOf({
          events: sim.result.events, score: sim.result.score,
          homeSquad11: sim.input.home.squad11, awaySquad11: sim.input.away.squad11,
        })
        if (motm) {
          const chip = document.createElement('span')
          chip.className = 'chip match__motm'
          chip.textContent = `⭐ MOTM ${findCareerPlayer(motm.playerId).name} ${motm.value.toFixed(1)}`
          playback.controlsBar.appendChild(chip)
        }
      }
    },
  })

  const finishBtn = document.createElement('button')
  finishBtn.type = 'button'
  finishBtn.className = 'chip chip--active'
  finishBtn.textContent = '라운드 마무리 →'
  finishBtn.hidden = true
  finishBtn.addEventListener('click', finish)
  playback.controlsBar.appendChild(finishBtn)

  body.append(playback.scoreboard, playback.stage, playback.controlsBar)
  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/draft ----------

export function renderCareerDraft(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave({ allowDraftPhase: true })
  if (!save) return
  if (save.phase !== 'draft') {
    navigate(careerPath())
    renderCareerHome(mountEl)
    return
  }

  // 진입/재개 시 내 차례까지 AI 픽을 배치로 진행(고아 타이머 없는 즉시 처리 —
  // matchPlayback의 소유권 원칙과 같은 이유로 setTimeout 연출을 쓰지 않는다).
  const current = store.draftCatchUp()
  if (current.phase !== 'draft') {
    // 캐치업만으로 드래프트가 끝났다(내 픽이 마지막 순번이 아니었던 경우) — 시즌으로.
    navigate(careerPath())
    mountEl.replaceChildren()
    renderCareerHome(mountEl)
    return
  }
  const draftState = current.draftState

  const fullRerender = () => {
    mountEl.replaceChildren()
    renderCareerDraft(mountEl)
  }

  const screen = screenShell(`드래프트 — 시즌 ${current.season.number}`, { backTo: homePath(), backLabel: '← 모드 선택' })
  const body = document.createElement('div')
  body.className = 'career__body'

  // 진행 상황: 스네이크 순서 + 현재 픽
  const status = document.createElement('div')
  status.className = 'career__draft-status'
  const pickLabel = document.createElement('div')
  pickLabel.className = 'career__hint'
  pickLabel.textContent = `픽 ${draftState.pickIndex + 1} / ${draftState.totalPicks} — 내 차례: ${findClub(save.userClubId).name}`
  const orderRow = document.createElement('div')
  orderRow.className = 'career__draft-order'
  for (const clubId of draftState.order) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    if (clubId === currentClubOf(draftState)) chip.classList.add('chip--active')
    chip.appendChild(clubLabel(clubId, { short: true }))
    orderRow.appendChild(chip)
  }
  status.append(pickLabel, orderRow)
  body.appendChild(status)

  // 최근 픽 로그 (최신 6개)
  if (draftState.log.length > 0) {
    const logBox = document.createElement('div')
    logBox.className = 'career__draft-log'
    for (const entry of draftState.log.slice(-6).reverse()) {
      const line = document.createElement('div')
      line.className = 'career__history-line'
      const player = findCareerPlayer(entry.playerId)
      line.append(
        document.createTextNode(`${entry.pickNumber}. `),
        clubLabel(entry.clubId, { short: true }),
        document.createTextNode(` → ${player.name} (${player.positions[0]} ${playerOverallRating(player)})`),
      )
      logBox.appendChild(line)
    }
    body.appendChild(logBox)
  }

  // 내 로스터 현황
  const myIds = draftState.rosters[save.userClubId]
  const myLine = document.createElement('p')
  myLine.className = 'career__hint'
  myLine.textContent = `내 로스터 ${myIds.length}명: `
    + myIds.map((id) => findCareerPlayer(id).name).join(', ')
  body.appendChild(myLine)

  // 가용 선수 리스트 — 레이팅 내림차순, 포지션 필터(GK는 선배정이라 제외).
  let positionFilter = null
  const list = document.createElement('div')
  list.className = 'squad-builder__list'

  const refreshList = () => {
    list.replaceChildren()
    const players = draftState.availableIds
      .map(findCareerPlayer)
      .filter((p) => !positionFilter || p.positions.includes(positionFilter))
      .sort((a, b) => playerOverallRating(b) - playerOverallRating(a))
    for (const player of players) {
      list.appendChild(createPlayerCard(player, {
        onClick: () => {
          store.draftPick(player.id)
          fullRerender()
        },
      }))
    }
  }

  const filters = document.createElement('div')
  filters.className = 'squad-builder__position-filters'
  const makeChip = (label, value) => {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (positionFilter === value ? ' chip--active' : '')
    chip.textContent = label
    chip.addEventListener('click', () => {
      positionFilter = value
      fullRerender()
    })
    return chip
  }
  filters.appendChild(makeChip('전체', null))
  for (const pos of POSITIONS.filter((p) => p !== 'GK')) filters.appendChild(makeChip(pos, pos))
  body.append(filters, list)
  refreshList()

  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/records ----------

export function renderCareerRecords(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = guardNoSave()
  if (!save) return

  const screen = screenShell('기록')
  const body = document.createElement('div')
  body.className = 'career__body'
  body.appendChild(navChips(careerRecordsPath()))

  const heading = document.createElement('div')
  heading.className = 'career__round-heading'
  heading.textContent = `시즌 ${save.season.number} 득점왕`
  body.appendChild(heading)

  const scorers = topScorers(save.fixtures)
  if (scorers.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'career__hint'
    empty.textContent = '아직 득점 기록이 없어 — 경기를 치르면 여기 쌓인다.'
    body.appendChild(empty)
  } else {
    const table = document.createElement('div')
    table.className = 'career__table'
    scorers.forEach((row, i) => {
      const el = document.createElement('div')
      el.className = 'career__table-row career__table-row--scorer'
      const player = findCareerPlayer(row.playerId)
      const clubId = Object.keys(save.rosters).find((id) => save.rosters[id].includes(row.playerId))
      if (clubId === save.userClubId) el.classList.add('career__table-row--mine')
      const rank = document.createElement('span')
      rank.textContent = String(i + 1)
      const name = document.createElement('span')
      name.textContent = player.name
      const club = document.createElement('span')
      if (clubId) club.appendChild(clubLabel(clubId, { short: true }))
      const goals = document.createElement('span')
      goals.textContent = `${row.goals}골`
      el.append(rank, name, club, goals)
      table.appendChild(el)
    })
    body.appendChild(table)
  }

  if (save.history.length > 0) {
    const historyHeading = document.createElement('div')
    historyHeading.className = 'career__round-heading'
    historyHeading.textContent = '역대 득점왕'
    body.appendChild(historyHeading)
    for (const entry of save.history) {
      if (!entry.topScorer) continue
      const line = document.createElement('div')
      line.className = 'career__history-line'
      const player = findCareerPlayer(entry.topScorer.playerId)
      line.textContent = `시즌 ${entry.season} — ${player.name} ${entry.topScorer.goals}골`
      body.appendChild(line)
    }
  }

  screen.appendChild(body)
  mountEl.appendChild(screen)
}

// ---------- /career/transfer (N5 이적창) ----------

function transferRow(save, playerId, { action }) {
  const player = findCareerPlayer(playerId)
  const row = document.createElement('div')
  row.className = 'player-row career__transfer-row'

  const rating = document.createElement('span')
  rating.className = 'player-row__rating'
  rating.textContent = String(playerOverallRating(player))
  const pos = document.createElement('span')
  pos.className = 'player-row__pos'
  pos.textContent = player.positions[0]
  const name = document.createElement('span')
  name.className = 'player-row__name'
  name.textContent = player.name
  const club = document.createElement('span')
  const ownerClubId = transferClubOf(save, playerId)
  if (ownerClubId) club.appendChild(clubLabel(ownerClubId, { short: true }))
  const contract = document.createElement('span')
  contract.className = 'career__contract'
  const years = save.contracts?.[playerId] ?? 2
  contract.textContent = years === 0 ? '만료' : `${years}년`
  if (years === 0) contract.classList.add('career__chip--danger')
  row.append(rating, pos, name, club, contract, action)
  return row
}

export function renderCareerTransfer(mountEl) {
  ensureInit()
  clearActivePlayback()
  const save = store.getCareer()
  if (!save) {
    navigate(careerPath())
    return
  }
  if (save.phase !== 'transfer') {
    navigate(careerPath())
    renderCareerHome(mountEl)
    return
  }

  const fullRerender = () => {
    mountEl.replaceChildren()
    renderCareerTransfer(mountEl)
  }

  const screen = screenShell(`이적창 — 시즌 ${save.season.number}`, { backTo: homePath(), backLabel: '← 모드 선택' })
  const body = document.createElement('div')
  body.className = 'career__body'

  const budget = document.createElement('div')
  budget.className = 'career__budget'
  budget.textContent = `내 예산 ${save.budgets[save.userClubId]}M`
  body.appendChild(budget)

  // 이번 창 거래 로그(내 거래 + AI 배경 거래)
  const seasonLog = (save.transferLog ?? []).filter((t) => t.season === save.season.number)
  if (seasonLog.length > 0) {
    const logBox = document.createElement('div')
    logBox.className = 'career__draft-log'
    for (const entry of seasonLog.slice(-6).reverse()) {
      const line = document.createElement('div')
      line.className = 'career__history-line'
      const player = findCareerPlayer(entry.playerId)
      line.append(
        clubLabel(entry.fromClubId, { short: true }),
        document.createTextNode(` → `),
        clubLabel(entry.toClubId, { short: true }),
        document.createTextNode(` ${player.name} (${entry.fee}M)`),
      )
      logBox.appendChild(line)
    }
    body.appendChild(logBox)
  }

  // ---- 영입: 타 구단 선수 (가치 내림차순) ----
  const buyHeading = document.createElement('div')
  buyHeading.className = 'career__round-heading'
  buyHeading.textContent = '영입 — 타 구단 선수'
  body.appendChild(buyHeading)

  const buyList = document.createElement('div')
  buyList.className = 'squad-builder__list squad-builder__list--rows'
  const others = Object.entries(save.rosters)
    .filter(([clubId]) => clubId !== save.userClubId)
    .flatMap(([, ids]) => ids)
    .sort((a, b) => priceOf(save, b) - priceOf(save, a))
  for (const playerId of others) {
    const check = canBuy(save, playerId)
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'chip'
    btn.textContent = `영입 ${priceOf(save, playerId)}M`
    if (!check.ok) {
      btn.disabled = true
      btn.title = check.reason
    } else {
      btn.addEventListener('click', () => {
        store.buyPlayer(playerId)
        fullRerender()
      })
    }
    buyList.appendChild(transferRow(save, playerId, { action: btn }))
  }
  body.appendChild(buyList)

  // ---- 판매: 내 스쿼드 ----
  const sellHeading = document.createElement('div')
  sellHeading.className = 'career__round-heading'
  sellHeading.textContent = `판매 — 내 스쿼드 (${save.rosters[save.userClubId].length}명, 하한 ${MIN_ROSTER}명)`
  body.appendChild(sellHeading)

  const sellList = document.createElement('div')
  sellList.className = 'squad-builder__list squad-builder__list--rows'
  const mine = [...save.rosters[save.userClubId]]
    .sort((a, b) => playerValue(findCareerPlayer(b), save.contracts?.[b] ?? 2)
      - playerValue(findCareerPlayer(a), save.contracts?.[a] ?? 2))
  for (const playerId of mine) {
    const offer = bestSellOffer(save, playerId)
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'chip'
    if (offer) {
      btn.textContent = `판매 ${offer.fee}M`
      btn.title = `${findClub(offer.clubId).name}의 오퍼`
      btn.addEventListener('click', () => {
        store.sellPlayer(playerId)
        fullRerender()
      })
    } else {
      btn.textContent = '오퍼 없음'
      btn.disabled = true
      btn.title = '로스터/GK 하한 또는 구매 여력 있는 구단 없음'
    }
    sellList.appendChild(transferRow(save, playerId, { action: btn }))
  }
  body.appendChild(sellList)

  const startBtn = document.createElement('button')
  startBtn.type = 'button'
  startBtn.className = 'chip chip--active'
  startBtn.textContent = `시즌 ${save.season.number} 개막 →`
  startBtn.addEventListener('click', () => {
    store.startSeasonAfterTransfer()
    squadEditor = null
    navigate(careerPath())
    mountEl.replaceChildren()
    renderCareerHome(mountEl)
  })
  body.appendChild(startBtn)

  screen.appendChild(body)
  mountEl.appendChild(screen)
}
