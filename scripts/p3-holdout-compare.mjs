/**
 * P3 holdout/gates compare — shells into research tsx runner.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lab = path.join(root, 'research', 'packative-dieline-lab')
const runner = path.join(root, 'scripts', '_p3-holdout-compare-runner.ts')
const outJson = path.join(lab, 'reports', 'p3-holdout-gates.json')
const tsxJs = path.join(lab, 'node_modules', 'tsx', 'dist', 'cli.mjs')
if (!fs.existsSync(tsxJs)) {
  console.error('missing research tsx at', tsxJs)
  process.exit(1)
}

const r = spawnSync(process.execPath, [tsxJs, runner, '--out', outJson], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  env: process.env,
  windowsHide: true,
})
if (r.stdout) process.stdout.write(r.stdout)
if (r.stderr) process.stderr.write(r.stderr)
if (r.status !== 0) {
  console.error('p3-holdout-compare failed', r.status)
  process.exit(r.status || 1)
}
if (!fs.existsSync(outJson)) {
  console.error('missing', outJson)
  process.exit(1)
}
console.log('ok wrote', outJson)
