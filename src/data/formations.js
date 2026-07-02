// 정규화 좌표계: x = 0(왼쪽 터치라인)~100(오른쪽 터치라인), y = 0(자기 골)~100(상대 골).
// 원정팀은 y를 100-y로 미러링해서 서로 마주보게 렌더링한다 (렌더러/시뮬레이션 공용).
// 이 좌표는 스쿼드빌더 위젯, 시뮬레이션 엔진의 존 바이어스, 매치 렌더러 세 곳이
// 공유하는 단일 소스다 — 유저가 짠 포메이션과 실제로 뛰는 포메이션 불일치를 막는다.

export const FORMATIONS = [
  {
    id: '4-4-2', label: '4-4-2',
    slots: [
      { role: 'GK', x: 50, y: 5 },
      { role: 'LB', x: 15, y: 20 }, { role: 'CB', x: 35, y: 18 }, { role: 'CB', x: 65, y: 18 }, { role: 'RB', x: 85, y: 20 },
      { role: 'LM', x: 15, y: 45 }, { role: 'CM', x: 38, y: 42 }, { role: 'CM', x: 62, y: 42 }, { role: 'RM', x: 85, y: 45 },
      { role: 'ST', x: 35, y: 75 }, { role: 'ST', x: 65, y: 75 },
    ],
  },
  {
    id: '4-3-3', label: '4-3-3',
    slots: [
      { role: 'GK', x: 50, y: 5 },
      { role: 'LB', x: 15, y: 20 }, { role: 'CB', x: 35, y: 18 }, { role: 'CB', x: 65, y: 18 }, { role: 'RB', x: 85, y: 20 },
      { role: 'CM', x: 30, y: 40 }, { role: 'CM', x: 50, y: 38 }, { role: 'CM', x: 70, y: 40 },
      { role: 'LW', x: 18, y: 70 }, { role: 'ST', x: 50, y: 78 }, { role: 'RW', x: 82, y: 70 },
    ],
  },
  {
    id: '4-2-3-1', label: '4-2-3-1',
    slots: [
      { role: 'GK', x: 50, y: 5 },
      { role: 'LB', x: 15, y: 20 }, { role: 'CB', x: 35, y: 18 }, { role: 'CB', x: 65, y: 18 }, { role: 'RB', x: 85, y: 20 },
      { role: 'DM', x: 35, y: 35 }, { role: 'DM', x: 65, y: 35 },
      { role: 'LM', x: 20, y: 58 }, { role: 'AM', x: 50, y: 55 }, { role: 'RM', x: 80, y: 58 },
      { role: 'ST', x: 50, y: 80 },
    ],
  },
  {
    id: '3-5-2', label: '3-5-2',
    slots: [
      { role: 'GK', x: 50, y: 5 },
      { role: 'CB', x: 30, y: 18 }, { role: 'CB', x: 50, y: 15 }, { role: 'CB', x: 70, y: 18 },
      { role: 'LB', x: 10, y: 45 }, { role: 'CM', x: 35, y: 40 }, { role: 'DM', x: 50, y: 35 }, { role: 'CM', x: 65, y: 40 }, { role: 'RB', x: 90, y: 45 },
      { role: 'ST', x: 35, y: 78 }, { role: 'ST', x: 65, y: 78 },
    ],
  },
  {
    id: '5-3-2', label: '5-3-2',
    slots: [
      { role: 'GK', x: 50, y: 5 },
      { role: 'LB', x: 10, y: 22 }, { role: 'CB', x: 30, y: 18 }, { role: 'CB', x: 50, y: 15 }, { role: 'CB', x: 70, y: 18 }, { role: 'RB', x: 90, y: 22 },
      { role: 'CM', x: 30, y: 42 }, { role: 'CM', x: 50, y: 38 }, { role: 'CM', x: 70, y: 42 },
      { role: 'ST', x: 35, y: 78 }, { role: 'ST', x: 65, y: 78 },
    ],
  },
  {
    id: '4-1-4-1', label: '4-1-4-1',
    slots: [
      { role: 'GK', x: 50, y: 5 },
      { role: 'LB', x: 15, y: 20 }, { role: 'CB', x: 35, y: 18 }, { role: 'CB', x: 65, y: 18 }, { role: 'RB', x: 85, y: 20 },
      { role: 'DM', x: 50, y: 32 },
      { role: 'LM', x: 15, y: 52 }, { role: 'CM', x: 38, y: 50 }, { role: 'CM', x: 62, y: 50 }, { role: 'RM', x: 85, y: 52 },
      { role: 'ST', x: 50, y: 80 },
    ],
  },
]

export function findFormation(id) {
  return FORMATIONS.find((f) => f.id === id)
}
