// css/tokens.css -> Figma Tokens(Tokens Studio) 호환 JSON.
// 스타일가이드와 같은 파서(src/ui/tokensParser.js)를 쓰므로 두 소비자가 어긋날 수 없다.
// 사용: node scripts/export-tokens.mjs [출력경로]  (기본: design-tokens.figma.json)
// N0 시점엔 스크립트만 상비 — Figma 연동이 실제로 필요해질 때 실행하면 된다.

import fs from 'fs'
import path from 'path'
import { parseTokens, toFigmaTokens } from '../src/ui/tokensParser.js'

const cssPath = path.resolve('css/tokens.css')
const outPath = path.resolve(process.argv[2] ?? 'design-tokens.figma.json')

const tokens = parseTokens(fs.readFileSync(cssPath, 'utf-8'))
const figma = toFigmaTokens(tokens)

fs.writeFileSync(outPath, JSON.stringify(figma, null, 2) + '\n')
console.log(`✅ ${tokens.length}개 토큰 -> ${outPath}`)
