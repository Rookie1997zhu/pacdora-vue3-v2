/**
 * Bundle Lab Crashlock TS into packages/crashlock-engine/index.mjs for Node/geometry.
 */
import * as esbuild from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'packages', 'crashlock-engine', 'index.mjs')
mkdirSync(dirname(outfile), { recursive: true })

await esbuild.build({
  entryPoints: [join(root, 'scripts', 'crashlock-engine-entry.ts')],
  bundle: true,
  outfile,
  format: 'esm',
  platform: 'neutral',
  target: ['es2022'],
  logLevel: 'info',
})

console.log(`built ${outfile}`)
