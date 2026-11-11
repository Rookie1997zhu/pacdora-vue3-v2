import fs from 'node:fs'
import path from 'node:path'
import { configDir, reportsDir } from '../paths.ts'

/** Stub: never collects while live_collection=false. */
export function runOnlineCollect() {
  const scope = JSON.parse(fs.readFileSync(path.join(configDir, 'access-scope.json'), 'utf8'))
  const result = {
    generated_at: new Date().toISOString(),
    live_collection: scope.live_collection,
    paid_actions: scope.paid_actions,
    collected: 0,
    message:
      scope.live_collection === true
        ? 'live_collection true but adapter not implemented this round'
        : '本轮在线采集 0 条（live_collection=false）',
  }
  fs.writeFileSync(path.join(reportsDir, 'online-collect-log.json'), JSON.stringify(result, null, 2))
  console.log(result.message)
  return result
}

runOnlineCollect()
