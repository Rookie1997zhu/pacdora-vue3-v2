import {spawnSync} from 'node:child_process'
import {dirname,join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=dirname(fileURLToPath(import.meta.url))
const steps=[
  'check-topology.mjs',
  'check-fold.mjs',
  'check-contract.mjs',
  'check-export.mjs',
  'check-arcs.mjs',
  'check-golden.mjs',
  'check-templates.mjs',
  'check-rea-golden.mjs',
  'check-catalog.mjs',
  'check-geom-assembly.mjs',
  'check-outbox.mjs',
  'check-net-masks.mjs',
  'check-engine-purity.mjs',
  'check-size-modes.mjs',
  'check-stats.mjs',
  'check-param-constraints.mjs',
  'check-workbench-templates.mjs',
  'check-workbench-url.mjs',
  'check-spec-chunks.mjs',
  'check-fold3d.mjs',
]

for(const file of steps){
  const script=join(root,file)
  console.log(`\n==> ${file}`)
  const r=spawnSync(process.execPath,[script],{stdio:'inherit',cwd:join(root,'..')})
  if(r.status!==0){
    console.error(`check-all failed at ${file}`)
    process.exit(r.status||1)
  }
}
console.log('\ncheck-all: all passed')
