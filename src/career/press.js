// 기자회견 — 시즌 중 3회(개막 전 / 6라운드 후 / 시즌 종료 후) 트리거되는 1문답
// 텍스트 이벤트. 답변은 보드 신임도에 ±로 반영되고 pressLog로 서사에 축적된다.
// 질문 선택은 순위 맥락 + 결정론 rng(같은 세이브 같은 질문).

import { createRng, deriveSeed } from '../sim/rng.js'
import { computeTable } from './table.js'

const PRESS_SALT = 0x9e55

// 답변 효과: trust(신임도 증감). 문구는 감독 화법 3종(자신감/신중/도발) 고정 패턴.
const QUESTIONS = {
  opening: [
    {
      id: 'opening_target',
      q: '새 시즌 목표를 말해달라는 기자들의 질문입니다.',
      answers: [
        { id: 'title', text: '"우승입니다. 다른 답은 준비하지 않았습니다."', trust: 3, risky: true },
        { id: 'steady', text: '"한 경기씩. 시즌이 끝나면 순위가 말해줄 겁니다."', trust: 1 },
        { id: 'lowkey', text: '"올해는 팀을 만드는 해입니다."', trust: -1 },
      ],
    },
    {
      id: 'opening_squad',
      q: '이번 스쿼드가 우승 전력이냐는 질문이 나왔습니다.',
      answers: [
        { id: 'yes', text: '"제가 뽑은 선수들입니다. 믿습니다."', trust: 2 },
        { id: 'market', text: '"보강이 더 필요합니다. 보드가 지갑을 열어야죠."', trust: -2 },
        { id: 'dodge', text: '"전력은 경기장에서 증명하는 겁니다."', trust: 0 },
      ],
    },
  ],
  mid: [
    {
      id: 'mid_leading',
      when: (rank) => rank === 1,
      q: '선두 질주 중입니다. 우승을 선언할 때가 됐다는 압박이 들어옵니다.',
      answers: [
        { id: 'declare', text: '"이 순위로 시즌을 끝내겠습니다."', trust: 3 },
        { id: 'calm', text: '"6라운드는 아무것도 보장하지 않습니다."', trust: 1 },
      ],
    },
    {
      id: 'mid_struggling',
      when: (rank) => rank >= 3,
      q: '하위권입니다. 감독직이 위태롭다는 보도가 나왔습니다.',
      answers: [
        { id: 'fight', text: '"제 거취보다 다음 경기가 중요합니다. 반등합니다."', trust: 2 },
        { id: 'blame', text: '"선수단 상태가 기대에 못 미친 건 사실입니다."', trust: -3 },
        { id: 'media', text: '"기사가 경기를 뛰는 건 아니죠."', trust: -1 },
      ],
    },
    {
      id: 'mid_neutral',
      when: () => true,
      q: '시즌 중반, 팀의 현재를 평가해달라는 질문입니다.',
      answers: [
        { id: 'up', text: '"상승 곡선입니다. 후반기가 기대됩니다."', trust: 2 },
        { id: 'honest', text: '"보완할 게 많습니다. 훈련장에서 답을 찾겠습니다."', trust: 0 },
      ],
    },
  ],
  closing: [
    {
      id: 'closing_champion',
      when: (rank) => rank === 1,
      q: '우승 감독으로서 소감 한마디가 요청됐습니다.',
      answers: [
        { id: 'players', text: '"선수들이 만든 우승입니다. 저는 자리만 지켰습니다."', trust: 2 },
        { id: 'mine', text: '"제 축구가 옳았다는 증명입니다."', trust: 1 },
      ],
    },
    {
      id: 'closing_general',
      when: () => true,
      q: '시즌을 마친 소회와 다음 시즌 구상을 묻습니다.',
      answers: [
        { id: 'rebuild', text: '"세대교체를 시작합니다. 아카데미를 주목하세요."', trust: 1 },
        { id: 'more', text: '"보강 없이는 같은 성적입니다. 보드가 답할 차례입니다."', trust: -2 },
        { id: 'thanks', text: '"팬들에게 감사합니다. 더 나은 시즌으로 보답하겠습니다."', trust: 1 },
      ],
    },
  ],
}

// 트리거 시점 판정 — finishRound/시즌 전환에서 호출. 반환: 새 pendingPress 또는 null.
export function pressTriggerFor(save) {
  if (save.pendingPress) return null // 답변 대기 중이면 새 트리거 없음
  const round = save.season.currentRound
  const answered = new Set((save.pressLog ?? [])
    .filter((e) => e.season === save.season.number)
    .map((e) => e.slot))
  let slot = null
  if (round === 1 && !answered.has('opening')) slot = 'opening'
  else if (round === 7 && !answered.has('mid')) slot = 'mid'
  else if (round > 12 && !answered.has('closing')) slot = 'closing'
  if (!slot) return null

  const table = computeTable(Object.keys(save.rosters), save.fixtures)
  const myRank = Math.max(1, table.findIndex((r) => r.clubId === save.userClubId) + 1)
  const pool = QUESTIONS[slot].filter((q) => !q.when || q.when(myRank))
  if (pool.length === 0) return null
  const rng = createRng(deriveSeed(save.masterSeed, PRESS_SALT + save.season.number * 100 + round))
  const question = pool[Math.floor(rng() * pool.length)]
  return { slot, questionId: question.id }
}

export function pressQuestionOf(pending) {
  return Object.values(QUESTIONS).flat().find((q) => q.id === pending.questionId) ?? null
}

// 답변 적용 — 신임도 반영 + 로그 적립 + pending 해제.
export function applyPressAnswer(save, answerId) {
  if (!save.pendingPress) return save
  const question = pressQuestionOf(save.pendingPress)
  const answer = question?.answers.find((a) => a.id === answerId)
  if (!answer) return save
  return {
    ...save,
    boardTrust: Math.max(0, Math.min(100, (save.boardTrust ?? 55) + answer.trust)),
    pressLog: [...(save.pressLog ?? []), {
      season: save.season.number,
      slot: save.pendingPress.slot,
      questionId: question.id,
      answerId,
      trustDelta: answer.trust,
    }],
    pendingPress: null,
  }
}
