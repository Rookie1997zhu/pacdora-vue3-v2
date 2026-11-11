import { importOffline } from './import-offline.ts'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { labRoot } from '../paths.ts'

function run(script: string) {
  const r = spawnSync('npx', ['tsx', path.join('src', 'cli', script)], { cwd: labRoot, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status || 1)
}

importOffline()
run('normalize-svg.ts')
run('sample-matrix.ts')
run('diff-geometry.ts')
run('online-collect.ts')
console.log('phase2 complete')
