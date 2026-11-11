import assert from 'node:assert/strict'
import test from 'node:test'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {dirname, join} from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcRoot = join(__dirname, '..', '..', '..', 'src')
const {createKnife} = await import(pathToFileURL(join(srcRoot, 'knife.js')).href)
const {TEMPLATES} = await import(pathToFileURL(join(srcRoot, 'templates', 'index.js')).href)

test('mailer-parametric-demo default validates', () => {
  assert.ok(TEMPLATES['mailer-parametric-demo'])
  const knife = createKnife({
    templateId: 'mailer-parametric-demo',
    length: 300,
    width: 200,
    height: 50,
    thickness: 1.5,
    bleed: 3,
    sizeMode: 'inner',
  })
  assert.equal(knife.template, 'mailer-parametric-demo')
  assert.equal(knife.manufacturingReady, false)
  assert.ok(knife.faces.length > 0)
})

test('unknown template must not be silently accepted by TEMPLATES lookup', () => {
  assert.equal(!!TEMPLATES['definitely-missing-template'], false)
})
