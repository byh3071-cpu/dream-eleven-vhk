import { registerRoute, startRouter } from './router.js'
import { ROUTE_PATTERNS } from './routes.js'
import { renderHome } from './ui/screens/home.js'
import { renderSquadBuilder } from './ui/screens/squadBuilder.js'
import { renderTactics } from './ui/screens/tactics.js'
import { renderMatch } from './ui/screens/match.js'
import { renderResult } from './ui/screens/result.js'
import { renderStyleguide } from './ui/screens/styleguide.js'
import {
  renderCareerHome, renderCareerSquad, renderCareerTactics,
  renderCareerTable, renderCareerSchedule, renderCareerMatchday,
  renderCareerDraft, renderCareerRecords, renderCareerTransfer, renderCareerFinance,
} from './ui/screens/career.js'

// v2 듀얼 모드: IF 매치는 /if/* 네임스페이스, 커리어(/career/*)는 N3에서 추가.
// 홈(/)은 모드 선택. /styleguide는 어느 모드에도 안 속하는 개발 지그.
registerRoute(ROUTE_PATTERNS.home, renderHome)
registerRoute(ROUTE_PATTERNS.ifSquad, renderSquadBuilder)
registerRoute(ROUTE_PATTERNS.ifTactics, renderTactics)
registerRoute(ROUTE_PATTERNS.ifMatch, renderMatch)
registerRoute(ROUTE_PATTERNS.ifResult, renderResult)
registerRoute(ROUTE_PATTERNS.career, renderCareerHome)
registerRoute(ROUTE_PATTERNS.careerSquad, renderCareerSquad)
registerRoute(ROUTE_PATTERNS.careerTactics, renderCareerTactics)
registerRoute(ROUTE_PATTERNS.careerTable, renderCareerTable)
registerRoute(ROUTE_PATTERNS.careerSchedule, renderCareerSchedule)
registerRoute(ROUTE_PATTERNS.careerMatchday, renderCareerMatchday)
registerRoute(ROUTE_PATTERNS.careerDraft, renderCareerDraft)
registerRoute(ROUTE_PATTERNS.careerRecords, renderCareerRecords)
registerRoute(ROUTE_PATTERNS.careerTransfer, renderCareerTransfer)
registerRoute(ROUTE_PATTERNS.careerFinance, renderCareerFinance)
registerRoute(ROUTE_PATTERNS.styleguide, renderStyleguide)

startRouter(document.getElementById('app'))
