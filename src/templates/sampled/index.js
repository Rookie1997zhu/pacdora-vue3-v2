import sampledData from '../../catalog/sampledTemplates.js'
import SAMPLED_INDEX from '../../catalog/sampledIndex.js'
import {createSampledTemplate} from './sampledTemplate.js'

const qualityOf=d=>{
  const e=SAMPLED_INDEX[`${d.cat}-${d.num}`]
  return e&&typeof e==='object'?e.quality:(e?'verified':null)
}
export const SAMPLED_TEMPLATES=Object.freeze((sampledData||[]).map(d=>createSampledTemplate({...d,quality:qualityOf(d)})))
