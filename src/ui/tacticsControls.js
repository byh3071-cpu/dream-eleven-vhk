// 감독 지침 컨트롤 — 무상태 렌더 함수. IF 지침 화면과 커리어 전술 화면이 공유한다.
// (tacticsState, 콜백)만 받아 DOM을 만든다. 슬라이더 드래그 중 전체 재렌더 금지 원칙
// (마우스 캡처 유지)은 여기 내장 — 값 텍스트만 직접 갱신하고 onInput으로 알린다.

const MENTALITY_OPTIONS = [
  { value: 2, label: '총공격' },
  { value: 1, label: '공격적' },
  { value: 0, label: '균형' },
  { value: -1, label: '수비적' },
  { value: -2, label: '침대축구' },
]

export const SLIDER_FIELDS = [
  { key: 'pressing', label: '압박 강도', min: '로우블록', max: '풀압박',
    hint: '올릴수록 상대 창조 단계를 더 강하게 저지하지만, 스태미나가 더 빨리 소모된다.' },
  { key: 'tempo', label: '템포', min: '느림', max: '빠름',
    hint: '올릴수록 경기 전체 기회 수가 늘지만(양팀 공용), 내 팀 창조 정확도는 떨어진다.' },
  { key: 'width', label: '폭', min: '좁게', max: '넓게',
    hint: '넓게 벌릴수록 측면 자원을 많이 쓰는데, 측면 자원이 약하면 오히려 손해다.' },
]

export function renderMentalitySection(current, onChange) {
  const section = document.createElement('div')
  const label = document.createElement('div')
  label.className = 'tactics__section-label'
  label.textContent = '멘탈리티'
  const chips = document.createElement('div')
  chips.className = 'tactics__mentality-chips'
  for (const opt of MENTALITY_OPTIONS) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'chip' + (current === opt.value ? ' chip--active' : '')
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

export function renderSliderSection(field, currentValue, onInput) {
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
  input.value = String(currentValue)

  const maxEdge = document.createElement('span')
  maxEdge.className = 'tactics__slider-edge tactics__slider-edge--max'
  maxEdge.textContent = field.max

  const value = document.createElement('span')
  value.className = 'tactics__slider-value'
  value.textContent = `${Math.round(currentValue * 100)}%`

  input.addEventListener('input', () => {
    const v = Number(input.value)
    value.textContent = `${Math.round(v * 100)}%`
    onInput(v)
  })

  row.append(minEdge, input, maxEdge, value)

  const hint = document.createElement('div')
  hint.className = 'tactics__section-hint'
  hint.textContent = field.hint

  section.append(label, row, hint)
  return section
}
