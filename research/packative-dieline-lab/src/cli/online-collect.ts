import fs from 'node:fs'
import path from 'node:path'
import { fetchWhitelistSvgs, type CollectTarget } from '../collect/cdnSvgFetch.ts'
import { configDir, reportsDir } from '../paths.ts'

export async function runOnlineCollect() {
  const scope = JSON.parse(fs.readFileSync(path.join(configDir, 'access-scope.json'), 'utf8'))
  const whitelistPath = path.join(configDir, 'collect-whitelist.json')

  if (scope.paid_actions === true) {
    const blocked = {
      generated_at: new Date().toISOString(),
      collected: 0,
      message: 'refused: paid_actions must stay false',
    }
    fs.writeFileSync(path.join(reportsDir, 'online-collect-log.json'), JSON.stringify(blocked, null, 2))
    console.log(blocked.message)
    return blocked
  }

  if (scope.live_collection !== true) {
    const result = {
      generated_at: new Date().toISOString(),
      live_collection: false,
      paid_actions: false,
      collected: 0,
      message: '本轮在线采集 0 条（live_collection=false）',
    }
    fs.writeFileSync(path.join(reportsDir, 'online-collect-log.json'), JSON.stringify(result, null, 2))
    console.log(result.message)
    return result
  }

  const wl = JSON.parse(fs.readFileSync(whitelistPath, 'utf8'))
  const targets = wl.targets as CollectTarget[]
  const { attempts, successCount, getCount } = await fetchWhitelistSvgs({
    tenant: wl.tenant_uuid_from_local_meta,
    product: wl.product,
    targets,
    maxGets: wl.max_gets ?? 10,
    minIntervalMs: wl.min_interval_ms ?? 5000,
    skipExistingValid: wl.skip_existing_valid !== false,
  })

  const result = {
    generated_at: new Date().toISOString(),
    live_collection: true,
    paid_actions: false,
    product: wl.product,
    tenant_uuid_source: 'local_meta_only',
    max_gets: wl.max_gets ?? 10,
    get_count: getCount,
    collected: successCount,
    attempts,
    message: `online collect finished: ${successCount} written, ${getCount} GETs`,
  }
  fs.writeFileSync(path.join(reportsDir, 'online-collect-log.json'), JSON.stringify(result, null, 2))
  console.log(result.message)
  return result
}

await runOnlineCollect()
