// 선수 카드 (레이팅+포지션+에라뱃지+헥사곤 뱃지+국적+소속팀). verify-cards.html에서
// 사용자 확인을 5차례 거쳐 확정된 마크업을 그대로 옮긴 것 — DOM 구조/클래스명을 임의로
// 바꾸지 말 것 (css/squad-builder.css의 .player-card* 셀렉터와 1:1로 맞물려 있음).

import { NATIONALITY_NAMES } from '../../data/player-schema.js'
import { playerOverallRating } from '../../sim/teamStrength.js'
import { createPlayerBadge } from './playerBadge.js'
import { playerNumberOf } from '../../data/player-schema.js'

// player: PLAYERS의 선수 객체. options.onClick(player)이 있으면 카드 전체가 버튼처럼 동작.
// options.assigned: 이미 다른 슬롯에 배정된 선수면 흐리게 표시(리스트에서 중복 배정 방지 신호).
export function createPlayerCard(player, { onClick, assigned = false } = {}) {
  const card = document.createElement('div')
  card.className = 'player-card' + (assigned ? ' player-card--assigned' : '')
  if (onClick) {
    card.setAttribute('role', 'button')
    card.setAttribute('tabindex', '0')
    card.addEventListener('click', () => onClick(player))
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(player) }
    })
  }

  const top = document.createElement('div')
  top.className = 'player-card__top'

  const left = document.createElement('div')
  const rating = document.createElement('div')
  rating.className = 'player-card__rating'
  rating.textContent = String(playerOverallRating(player))
  const pos = document.createElement('div')
  pos.className = 'player-card__pos'
  pos.textContent = player.positions[0]
  left.append(rating, pos)

  const era = document.createElement('div')
  era.className = 'player-card__era' + (player.era === 'legend' ? ' player-card__era--legend' : '')
  era.textContent = player.era === 'legend' ? 'LEGEND' : 'ACTIVE'

  top.append(left, era)

  const badge = createPlayerBadge(player, { size: 'lg' })

  // 풀네임 대신 상징 등번호 — 뱃지가 이미 이름을 보여줘서 풀네임은 중복이었다(사용자 지적).
  const nickname = document.createElement('div')
  nickname.className = 'player-card__nickname'
  nickname.textContent = `No.${playerNumberOf(player)}`

  const meta = document.createElement('div')
  meta.className = 'player-card__meta'

  const natRow = document.createElement('div')
  natRow.className = 'player-card__meta-row'
  const flagWrap = document.createElement('span')
  flagWrap.className = 'lead flag'
  const flagImg = document.createElement('img')
  flagImg.src = `./assets/flags/${player.nationality}.svg`
  flagImg.alt = player.nationality
  flagWrap.appendChild(flagImg)
  const natText = document.createElement('span')
  natText.textContent = NATIONALITY_NAMES[player.nationality] ?? player.nationality
  natRow.append(flagWrap, natText)

  const clubRow = document.createElement('div')
  clubRow.className = 'player-card__meta-row'
  const clubLead = document.createElement('span')
  clubLead.className = 'lead'
  const clubText = document.createElement('span')
  clubText.textContent = player.club
  clubRow.append(clubLead, clubText)

  meta.append(natRow, clubRow)
  card.append(top, badge, nickname, meta)
  return card
}
