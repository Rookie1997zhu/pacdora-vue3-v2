/**
 * Ensure geometry-engine facade loads in pure Node (no DOM / Vue / Three).
 */
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {dirname, join, relative} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const facade = join(root, 'packages/geometry-engine/index.js')

const FORBIDDEN = [
  /\bfrom\s+['"]vue['"]/,
  /\bfrom\s+['"]vue\//,
  /\bfrom\s+['"]three['"]/,
  /\bfrom\s+['"]three\//,
  /\bfrom\s+['"]@vue\//,
  // DOM globals only (avoid matching identifiers like tuckWindow / pairWindow)
  /(?<![\w$])window\s*[.[\(=]/,
  /(?<![\w$])document\s*[.[\(=]/,
  /(?<![\w$])localStorage\b/,
  /(?<![\w$])sessionStorage\b/,
  /(?<![\w$])globalThis\s*\.\s*window\b/,
]

/** Source roots that must stay DOM-free when imported by the facade */
const SCAN_DIRS = [
  'src/knife.js',
  'src/knifeContract.js',
  'src/foldStages.js',
  'src/dimAnnotations.js',
  'src/foldSim.js',
  'src/templates',
  'src/crashlock',
  'packages/geometry-engine',
  'packages/crashlock-engine',
]

function walk(fileOrDir, out = []) {
  const st = statSync(fileOrDir)
  if (st.isFile()) {
    if (/\.(js|mjs|cjs)$/.test(fileOrDir)) out.push(fileOrDir)
    return out
  }
  for (const name of readdirSync(fileOrDir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    walk(join(fileOrDir, name), out)
  }
  return out
}

const files = SCAN_DIRS.flatMap((rel) => walk(join(root, rel)))
let violations = 0
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  // Skip comments-only matches by stripping // and /* */ roughly
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const re of FORBIDDEN) {
    if (re.test(stripped)) {
      console.error(`FORBIDDEN ${re} in ${relative(root, file)}`)
      violations++
    }
  }
}
if (violations) {
  console.error(`check-engine-purity: ${violations} violation(s)`)
  process.exit(1)
}

const mod = await import(pathToFileURL(facade).href)
if (!mod.ENGINE_VERSION) throw new Error('ENGINE_VERSION missing')
if (typeof mod.createKnife !== 'function') throw new Error('createKnife missing')
if (typeof mod.getTemplate !== 'function') throw new Error('getTemplate missing')

const knife = mod.createKnife({
  templateId: 'mailer-parametric-demo',
  length: 315,
  width: 202,
  height: 62,
  thickness: 1.5,
  bleed: 3,
  sizeMode: 'inner',
})
if (!knife?.faces?.length) throw new Error('createKnife returned empty faces')
if (typeof globalThis.window !== 'undefined') {
  // Should not happen in Node, but guard
  throw new Error('window unexpectedly defined')
}

console.log(`check-engine-purity: ok (ENGINE_VERSION=${mod.ENGINE_VERSION}, faces=${knife.faces.length})`)
