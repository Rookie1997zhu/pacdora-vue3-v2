import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { labRoot } from '../paths.ts'

function run(script: string) {
  const r = spawnSync('npx', ['tsx', path.join('src', 'cli', script)], { cwd: labRoot, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status || 1)
}

run('rebuild-inventory.ts')
run('audit.ts')
run('import-offline.ts')
run('normalize-svg.ts')
run('sample-matrix.ts')
run('diff-geometry.ts')
run('match-segments.ts')
// online-collect is opt-in via live_collection; run explicitly when resampling
run('infer-rules.ts')
run('prototype.ts')
run('match-lock-bottom.ts')
run('validate.ts')
run('run-tests.ts')
console.log('all phases complete')
