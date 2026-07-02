// 감독 지침 화면. /tactics/:side 공용 — Goal 3의 DEFAULT_TACTICS(mentality/pressing/
// tempo/width)를 그대로 사용자가 조절하는 화면. squadBuilder.js와 마찬가지로 side별
// 독립 상태, 저장은 아직 없음(세션 중에만 유지).

import { DEFAULT_TACTICS } from '../../sim/tactics-modifiers.js'
import { navigate } from '../../router.js'

const SIDE_LABEL = { home: '홈', away: '원정' }

const MENTALITY_OPTIONS = [
  { value: 2, label: '총공격' },
  { value: 1, label: '공격적' },
  { value: 0, label: '균형' },
  { value: -1, label: '수비적' },
  { value: -2, label: '침대축구' },
]

const SLIDER_FIELDS = [
  { key: 'pressing', label: '압박 강도', min: '로우블록', max: '풀압박',
    hint: '올릴수록 상대 창조 단계를 더 강하게 저지하지만, 스태미나가 더 빨리 소모된다.' },
  { key: 'tempo', label: '템포', min: '느림', max: '빠름',
    hint: '올릴수록 경기 전체 기회 수가 늘지만(양팀 공용), 내 팀 창조 정확도는 떨어진다.' },
  { key: 'width', label: '폭', min: '좁게', max: '넓게',
    hint: '넓게 벌릴수록 측면 자원을 많이 쓰는데, 측면 자원이 약하면 오히려 손해다.' },
]

const state = { home: { ...DEFAULT_TACTICS }, away: { ...DEFAULT_TACTICS } }

// match.js가 킥오프 전에 읽는 진입점 — squadBuilder.js의 getSquadState와 같은 패턴.
export function getTacticsState(side) {
  return { ...state[side] }
}

function renderMentalitySection(sideState, onChange) {
  const section = document.createElement('div')
  const label = document.createElement('div')
  label.className = 'tactics__section-label'
  label.textContent = '멘탈리티'
  const chips = document.createElement('div')
  chips.className = 'tactics__mentality-chips'
  for (const opt of MENTALITY_OPTIONS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (sideState.mentality === opt.value ? ' chip--active' : '')
    chip.textContent = opt.label
    chip.addEventListener('click', () => onChange(opt.value))
    chips.appendChild(chip)
  }
  const hint = document.createElement('div')
  hint.className = 'tactics__section-hint'
  hint.textContent = '공격적일수록 창조/마무리는 강해지지만 수비 저지력이 약해진다(반대도 마찬가지).'
  section.append(label, chips, hint)
  return section
}

function renderSliderSection(sideState, field) {
  const section = document.createElement('div')
  const label = document.createElement('div')
  label.className = 'tactics__section-label'
  label.textContent = field.label

  const row = document.createElement('div')
  row.className = 'tactics__slider-row'

  const minEdge = document.createElement('span')
  minEdge.className = 'tactics__slider-edge'
  minEdge.textContent = field.min

  const input = document.createElement('input')
  input.type = 'range'
  input.min = '0'
  input.max = '1'
  input.step = '0.05'
  input.value = String(sideState[field.key])

  const maxEdge = document.createElement('span')
  maxEdge.className = 'tactics__slider-edge tactics__slider-edge--max'
  maxEdge.textContent = field.max

  const value = document.createElement('span')
  value.className = 'tactics__slider-value'
  value.textContent = `${Math.round(sideState[field.key] * 100)}%`

  // 드래그 중 매 input 이벤트마다 화면 전체를 다시 그리면 슬라이더 DOM이 새로 생성되면서
  // 드래그(마우스 캡처)가 끊긴다 — 검색창 포커스 문제와 같은 종류라 같은 방식으로 피한다:
  // 값 텍스트 하나만 직접 갱신하고 전체 재렌더는 하지 않는다.
  input.addEventListener('input', () => {
    const v = Number(input.value)
    sideState[field.key] = v
    value.textContent = `${Math.round(v * 100)}%`
  })

  row.append(minEdge, input, maxEdge, value)

  const hint = document.createElement('div')
  hint.className = 'tactics__section-hint'
  hint.textContent = field.hint

  section.append(label, row, hint)
  return section
}

export function renderTactics(mountEl, params) {
  const side = params.side === 'away' ? 'away' : 'home'
  const sideState = state[side]

  const fullRerender = () => {
    mountEl.replaceChildren()
    renderTactics(mountEl, params)
  }

  const onMentalityChange = (value) => {
    sideState.mentality = value
    fullRerender()
  }

  const screen = document.createElement('div')
  screen.className = 'screen screen--tactics'

  const topbar = document.createElement('div')
  topbar.className = 'topbar'
  const title = document.createElement('div')
  title.className = 'topbar__title'
  title.textContent = `감독 지침 — ${SIDE_LABEL[side]}`
  const back = document.createElement('button')
  back.type = 'button'
  back.className = 'link-button'
  back.textContent = '← 스쿼드로 돌아가기'
  back.addEventListener('click', () => navigate(`/squad/${side}`))
  topbar.append(title, back)

  const body = document.createElement('div')
  body.className = 'tactics__body'
  body.appendChild(renderMentalitySection(sideState, onMentalityChange))
  for (const field of SLIDER_FIELDS) body.appendChild(renderSliderSection(sideState, field))

  // 홈 지침 다음엔 원정 스쿼드로, 원정 지침 다음엔 바로 경기로 — PRD의 화면 흐름
  // (스쿼드(홈)->지침(홈)->스쿼드(원정)->지침(원정)->매치)을 그대로 따라간다.
  // 이 버튼이 없으면 홈 팀을 다 구성한 사용자가 원정 팀으로 갈 방법이 URL 해시를
  // 직접 고치는 것뿐이라 실질적으로 막힌다(실제 플레이스루로 확인한 문제).
  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'chip chip--active'
  if (side === 'home') {
    nextBtn.textContent = '다음: 원정 스쿼드 구성 →'
    nextBtn.addEventListener('click', () => navigate('/squad/away'))
  } else {
    nextBtn.textContent = '경기 시작 →'
    nextBtn.addEventListener('click', () => navigate('/match'))
  }
  body.appendChild(nextBtn)

  screen.append(topbar, body)
  mountEl.appendChild(screen)
}
