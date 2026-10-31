import assert from 'node:assert/strict'
import {createKnife} from '../src/knife.js'

function assertTopology(label, dims){
  const k=createKnife(dims)
  const {faces,hinges,topology,schema,productionReady,manufacturingReady,validation}=k
  assert.equal(schema,'boxcraft.knife.v3',`${label}: schema`)
  assert.equal(validation?.ok,true,`${label}: validation.ok`)
  assert.equal(productionReady,true,`${label}: productionReady`)
  assert.equal(manufacturingReady,false,`${label}: manufacturingReady`)
  assert.equal(faces.length,19,`${label}: faceCount`)
  assert.equal(hinges.length,18,`${label}: hingeCount`)
  assert.equal(topology.faceCount,19,`${label}: topology.faceCount`)
  assert.equal(topology.hingeCount,18,`${label}: topology.hingeCount`)
  assert.equal(topology.faceOrder?.length,19,`${label}: topology.faceOrder`)

  const names=faces.map(f=>f.name)
  assert.equal(new Set(names).size,names.length,`${label}: unique names`)

  const byName=Object.fromEntries(faces.map(f=>[f.name,f]))
  const roots=faces.filter(f=>!f.parent)
  assert.equal(roots.length,1,`${label}: single root`)
  assert.equal(roots[0].name,'base',`${label}: root is base`)

  for(const f of faces){
    if(!f.parent)continue
    assert.ok(byName[f.parent],`${label}: parent exists for ${f.name}`)
    assert.ok(['top','bottom','left','right'].includes(f.side),`${label}: side for ${f.name}`)
  }

  // acyclic: walk parent chain
  for(const f of faces){
    const seen=new Set()
    let cur=f
    while(cur.parent){
      assert.ok(!seen.has(cur.name),`${label}: cycle at ${cur.name}`)
      seen.add(cur.name)
      cur=byName[cur.parent]
      assert.ok(cur,`${label}: broken parent chain from ${f.name}`)
    }
  }

  const hingeChildren=hinges.map(h=>h.child).sort()
  const nonRoots=faces.filter(f=>f.parent).map(f=>f.name).sort()
  assert.deepEqual(hingeChildren,nonRoots,`${label}: hinges cover non-roots`)

  assert.ok(k.cutPath.includes('M '),`${label}: cutPath`)
  assert.ok(k.bleedPath.includes('M '),`${label}: bleedPath`)
  console.log(`ok ${label} faces=${faces.length} hinges=${hinges.length}`)
}

assertTopology('default',{length:315,width:202,height:62,thickness:1.5,bleed:5})
assertTopology('min',{length:80,width:70,height:20,thickness:.5,bleed:0})
console.log('check-topology: all passed')
