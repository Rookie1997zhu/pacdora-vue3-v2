import mailerFlip from './mailerFlip.js'
import fefco0201 from './fefco0201.js'
import fefco0427 from './fefco0427.js'
import productboxCrashlock from './productboxCrashlock.js'
import tuckEndStraight from './tuckEndStraight.js'
import tuckEndReverse from './tuckEndReverse.js'
import autoLockBottom from './autoLockBottom.js'
import lidBase from './lidBase.js'
import sleeve from './sleeve.js'
import drawerTray from './drawerTray.js'
import tuckWindow from './tuckWindow.js'
import mailerAircraft from './mailerAircraft.js'
import hangingTuck from './hangingTuck.js'
import pizzaClamshell from './pizzaClamshell.js'
import handleBox from './handleBox.js'
import magneticRigid from './magneticRigid.js'
import displayPdq from './displayPdq.js'
import zipperTuck from './zipperTuck.js'
import polygonTray from './polygonTray.js'
import cylinderBox from './cylinderBox.js'
import sleeveDrawer from './sleeveDrawer.js'
import {REA_TEMPLATES} from './rea/index.js'
import {SPEC_TEMPLATES} from './spec/index.js'

/**
 * 模板注册表。内置与 REA 模板始终在；结构规格模板（spec-*）在 Node 端启动时全量注册，
 * 在浏览器端按需注册（见 ./lazy.js），所以这里不冻结。
 */
export const TEMPLATES=Object.fromEntries(
  [
    mailerFlip,fefco0427,fefco0201,productboxCrashlock,tuckEndStraight,tuckEndReverse,autoLockBottom,lidBase,
    sleeve,drawerTray,sleeveDrawer,cylinderBox,tuckWindow,mailerAircraft,hangingTuck,pizzaClamshell,
    handleBox,magneticRigid,displayPdq,zipperTuck,polygonTray,
    ...REA_TEMPLATES,
    ...SPEC_TEMPLATES
  ].map(t=>[t.id,t])
)

/** 注册一个模板（已存在则保留原对象，保证同一 id 始终是同一个模板） */
export function registerTemplate(t){
  if(!t?.id)return null
  if(!TEMPLATES[t.id])TEMPLATES[t.id]=t
  return TEMPLATES[t.id]
}
export const TEMPLATE_LIST=Object.freeze(Object.values(TEMPLATES))
export const DEFAULT_TEMPLATE_ID=mailerFlip.id

/** 未知 id 回落到默认模板，调用方可通过 knife.template 确认实际使用的模板 */
export function getTemplate(id){
  return TEMPLATES[id]||TEMPLATES[DEFAULT_TEMPLATE_ID]
}
