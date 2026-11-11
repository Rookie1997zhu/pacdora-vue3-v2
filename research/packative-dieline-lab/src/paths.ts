import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const labRoot = path.resolve(here, '..')
export const repoRoot = path.resolve(labRoot, '../..')
export const evidenceRoot = path.join(repoRoot, 'docs', 'packative-research', 'evidence')
export const configDir = path.join(labRoot, 'config')
export const dataRaw = path.join(labRoot, 'data', 'raw')
export const dataNormalized = path.join(labRoot, 'data', 'normalized')
export const dataRules = path.join(labRoot, 'data', 'rules')
export const reportsDir = path.join(labRoot, 'reports')
