# -*- coding: utf-8 -*-
"""Writes the reviewed issue list and one-page summary for the /products audit (2026-11-19).

Inputs are the reviewed results, not raw auto-screening:
  docs/audit/catalog-3d-overview/3d-conclusions.csv   (verdicts from manual-verdicts.json)
  docs/audit/catalog-mismatch-84/mismatch-conclusions.csv
  docs/产品目录_导出与保存批量测试_2026-11-19.csv
Usage: python scripts/audit/catalog-final-report.py
"""
import collections
import csv
import io
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = lambda *a: os.path.join(ROOT, *a)


def load(path):
    return list(csv.DictReader(io.open(path, encoding='utf-8-sig')))


t1 = load(P('docs', '产品目录_导出与保存批量测试_2026-11-19.csv'))
t4 = load(P('docs', 'audit', 'catalog-3d-overview', '3d-conclusions.csv'))
t2 = load(P('docs', 'audit', 'catalog-mismatch-84', 'mismatch-conclusions.csv'))
smoke = load(P('docs', 'audit', 'catalog-page-smoke', 'page-smoke-results.csv'))

CAT = {'gift': '礼盒', 'mailer': '邮寄盒', 'square': '方形盒', 'shipping': '运输箱'}
NO_FOLD_DATA = {'510340', '512220', '603573', '603574', '603610', '603678', '605360'}
by = {r['slug']: r for r in t4}
rows = []
# Taken out of the catalogue after this audit (src/catalog/excludedPresets.js)
DELISTED = {'512220', '605360', '603500', '603650', '181600', '181610', '185000', '36101111'}


def add(r, src, phen, sev, sug):
    if r['category'] == 'gift' and r['num'] in DELISTED:
        sug = '已下架（2026-11-19）'
    rows.append({
        '类目': CAT[r['category']], '编号': r['num'], '名称': r['name'], 'slug': r['slug'],
        '产品页': 'http://localhost/products/' + r['slug'], '来源': src, '现象': phen,
        '严重程度': sev, '建议': sug,
    })


HIGH = ('import-gift-603500', 'import-gift-603650')
add(by['import-gift-603500'], '任务2-对照图 + 任务4-3D',
    '封面图是三片，我方参考数据只有两片（缺一块方片）；3D 不成盒', '高', '重采；采不到则下架')
add(by['import-gift-603650'], '任务4-3D', '登记尺寸为 10×10×0；3D 面片散开', '高', '到来源核对尺寸；确认不了则下架')
for r in t4:
    if r['slug'] in HIGH:
        continue
    note = ('；' + r['notes']) if r['notes'] else ''
    if r['verdict'] == '不成盒':
        if r['num'] in NO_FOLD_DATA:
            add(r, '任务4-3D', '3D 不成盒：' + r['notes'], '中', '没有折叠步骤可修：隐藏 3D，或单独做模型')
        else:
            add(r, '任务4-3D', '3D 不成盒：' + r['notes'], '中', '多片盒需采集装配数据或支持其动作；修不了则隐藏 3D')
    elif r['verdict'] == '成盒但有瑕疵':
        add(r, '任务4-3D', '3D 能成盒，但有面片外露、缺口或轻微错位', '低', '可暂不处理')
    elif r['verdict'] == '看不出':
        add(r, '任务4-3D', '异形盒，单看截图判断不了是否正确' + note, '低', '对照来源效果图')
add(by['import-shipping-201081'], '任务2-对照图', '分段数据里有一条横穿的斜线，只影响缩略图；导出的 SVG / DXF 里没有', '低', '修弧线分段')
for r in t1:
    if r['problems']:
        add(by[r['slug']], '任务1-导出保存', r['problems'], '高', '修导出')
G = {'类目': '全部', '编号': '—', 'slug': '—', '产品页': '—', '来源': '任务3-页面流程', '严重程度': '待定'}
rows.append({**G, '名称': '设计器导出', '严重程度': '已修复', '现象': '导出的 SVG / PDF 里只有刀版，没有图案。已改为把图片、文字、形状画进 SVG / PDF / AI（DXF 是切割文件，不带图案）',
             '建议': '遗留：PDF / AI 里的中文、韩文文字画不出来（会标红框并在导出结果里提示），SVG 不受影响；内面的图案不导出'})
rows.append({**G, '名称': 'PDF / AI 刀线', '严重程度': '已修复', '现象': 'PDF 和 AI 里的切线、压痕、出血线一直被画在页面下方（看不见），文件结构和页面尺寸却都正常，所有盒型都受影响；出血线还会被页边裁掉一点',
             '建议': '已修复并加了“线必须落在页面内”的检查'})
rows.append({**G, '名称': '设计器导出格式', '严重程度': '已修复', '现象': '设计器里只有 SVG / DXF / PDF 三个导出按钮，没有 AI（工作台有）', '建议': '已加上“导出 AI”，页面实测导出成功'})

cols = ['类目', '编号', '名称', 'slug', '产品页', '来源', '现象', '严重程度', '建议']
with io.open(P('docs', '产品目录_问题清单_2026-11-19.csv'), 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

sev = collections.Counter(r['严重程度'] for r in rows)
v3 = collections.Counter(r['verdict'] for r in t4)
c2 = collections.Counter(r['conclusion'] for r in t2)
t1_ok = sum(1 for r in t1 if not r['problems'])

html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>产品目录核实总结 2026-11-19</title>
<style>
body{{font:15px/1.75 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;max-width:900px;margin:40px auto;padding:0 20px 60px;color:#1c2428;background:#f6f8f9}}
h1{{font-size:26px;margin-bottom:4px}} h2{{font-size:18px;margin:30px 0 10px;padding-left:10px;border-left:4px solid #0f6e68}}
.sub{{color:#5d6b72;margin-top:0}} .wrap{{overflow-x:auto}}
table{{border-collapse:collapse;width:100%;margin:10px 0;background:#fff;font-size:14px}} th,td{{border:1px solid #dfe5e8;padding:8px 10px;text-align:left;vertical-align:top}}
th{{background:#eef2f3}} td.n{{white-space:nowrap;font-variant-numeric:tabular-nums}}
.note{{border-radius:8px;padding:10px 14px;margin:12px 0;background:#fff6e5;color:#9a5b00}} .ok{{background:#e9f6ee;color:#17603a}}
code{{background:#eef2f3;border-radius:4px;padding:1px 6px;font-size:13px;word-break:break-all}}
</style></head><body>
<h1>产品目录刀版核实 · 一页总结</h1>
<p class="sub">范围：<code>/products</code> 导入产品 {len(t1)} 个 · 2026-11-19 · 第二版（复核并补做后重写）</p>

<div class="note ok"><b>结论：</b>{len(t1)} 个产品里，刀版确认有问题的是 2 个；导出和保存全部正常；{v3['成盒']} 个的 3D 也正常。另有 {v3['不成盒']} 个 3D 不成盒，除礼盒 603500 外，它们的刀版和封面图对得上。</div>

<div class="note"><b>审计后的处理：</b>3D 不成盒的 {v3['不成盒']} 个产品已全部下架（2026-11-19），其中包括两个刀版有问题的。目录现有 {len(t1) - len(DELISTED)} 个导入产品；下面的数字是下架前 {len(t1)} 个的审计结果。5 个圆筒盒的 3D 已改为卷成圆柱；“有瑕疵”的 8 个里修好 3 个、1 个确认无误，还剩 4 个。</div>

<h2>四项检查的结果</h2>
<div class="wrap"><table>
<tr><th>检查</th><th>覆盖</th><th>结果</th></tr>
<tr><td>导出和保存</td><td class="n">{len(t1)} / {len(t1)}</td><td>{t1_ok} 个通过：四种格式导出、切线范围、压痕不越界、PDF/AI 1:1 和五个图层、按原规格保存、改尺寸被拒</td></tr>
<tr><td>3D（合盖状态）</td><td class="n">{len(t4)} / {len(t4)} 逐个看过</td><td>成盒 {v3['成盒']} · 成盒但有瑕疵 {v3['成盒但有瑕疵']} · 看不出 {v3['看不出']} · 不成盒 {v3['不成盒']}</td></tr>
<tr><td>“与原图不重合”的 {len(t2)} 个</td><td class="n">{len(t2)} / {len(t2)} 逐个看过</td><td>结构一致 {c2['无害']} · 刀版缺片 {c2['刀版有误']}</td></tr>
<tr><td>页面流程</td><td class="n">{len(smoke)} 个</td><td>进设计器、放图片和文字、保存、刷新后还在、导出，全部走通；当时导出文件不含图案，现已修复</td></tr>
</table></div>

<h2>问题清单概览（{len(rows)} 条）</h2>
<div class="wrap"><table>
<tr><th>程度</th><th>数量</th><th>内容</th><th>建议</th></tr>
<tr><td>高</td><td class="n">{sev['高']}</td><td>礼盒 603500：参考数据比封面图少一片。<br>礼盒 603650：登记尺寸 10×10×0，3D 散开。</td><td>重采或核对；不行则下架</td></tr>
<tr><td>中</td><td class="n">{sev['中']}</td><td>3D 不成盒，刀版正常。其中 2 个来源没有给折叠步骤（心形盒、酒盒），4 个是多片盒（3 个异形盒的整件平移/翻转回放不对，1 个缺装配数据）。5 个圆筒盒已用“卷成圆柱”的画法修好。</td><td>见各条建议</td></tr>
<tr><td>低</td><td class="n">{sev['低']}</td><td>3D 有瑕疵 {v3['成盒但有瑕疵']}；异形看不出 {v3['看不出']}；运输箱 201081 缩略图有一条斜线（导出文件没有）。</td><td>可暂不处理</td></tr>
<tr><td>已修复</td><td class="n">{sev['已修复']}</td><td>设计器导出不含图案。<br>PDF / AI 里的切线、压痕、出血线画在页面外，打开看不见（所有盒型）。<br>设计器没有 AI 导出按钮。</td><td>已修复并部署</td></tr>
</table></div>

<h2>与第一版相比改了什么</h2>
<div class="wrap"><table>
<tr><th>项目</th><th>第一版</th><th>复核后</th><th>原因</th></tr>
<tr><td>导出问题</td><td class="n">25 个</td><td class="n">{len(t1) - t1_ok} 个</td><td>10 个是审计脚本的测量错误；15 个是真实的 0.01 mm 残留标记点，已修复并部署</td></tr>
<tr><td>3D 不成盒</td><td class="n">10 个</td><td class="n">{v3['不成盒']} 个</td><td>原规则只比外形尺寸：把细高盒和信封误判成不成盒，又看不出面片散开。改为逐个看截图。第二版一度写成 21 个，其中 7 个是截图工具把面片画成外接矩形造成的误判，按真实轮廓重拍后更正</td></tr>
<tr><td>3D 成盒</td><td class="n">210 个（未看图）</td><td class="n">{v3['成盒']} 个（看过）</td><td>原来只有 71 个产品有截图，现已补齐 {len(t4)} 个</td></tr>
<tr><td>不重合</td><td>无害 71 · 有误 1 · 拿不准 12</td><td>无害 {c2['无害']} · 有误 {c2['刀版有误']}</td><td>原来是自动分类；“有误”的那个（邮寄盒 243010）其实正常，真正有误的是礼盒 603500</td></tr>
<tr><td>页面流程</td><td>放图案失败、导出跳过</td><td>{len(smoke)} 个全部走通</td><td>原来用的账号额度不足，且图案数据格式不对；改用页面按钮实测</td></tr>
</table></div>

<h2>没有做的</h2>
<ul>
<li>3D 看的是合盖状态的截图（面片按真实轮廓画，材质从简），没有逐个对照来源的效果图；“看不出”的 {v3['看不出']} 个需要对照。</li>
<li>页面流程只抽了 {len(smoke)} 个，不是方案里的 16–20 个。</li>
<li>Illustrator 打开 <code>.ai</code> 是否显示为图层，仍需人工看一眼。</li>
<li>下架的 8 个只是从目录移除（数据库里是归档），刀版文件还在，从排除名单删掉对应行即可恢复。</li>
<li>PDF / AI 里的中文、韩文文字画不出来（需要内嵌字体，尚未做）；内面的图案不导出。</li>
</ul>

<h2>文件</h2>
<ul>
<li>问题清单：<code>docs/产品目录_问题清单_2026-11-19.csv</code></li>
<li>导出与保存：<code>docs/产品目录_导出与保存批量测试_2026-11-19.csv</code></li>
<li>3D：<code>docs/audit/catalog-3d-overview/</code>（<code>sheets/</code> 是 7 张总览图，<code>manual-verdicts.json</code> 是逐个看后的结论）</li>
<li>对照图：<code>docs/audit/catalog-mismatch-84/sheets/</code></li>
<li>页面流程：<code>docs/audit/catalog-page-smoke/page-smoke-results.csv</code></li>
<li>本页和问题清单由 <code>scripts/audit/catalog-final-report.py</code> 生成</li>
</ul>
</body></html>'''
with io.open(P('docs', '产品目录_核实总结_2026-11-19.html'), 'w', encoding='utf-8', newline='') as f:
    f.write(html)
print('issues', len(rows), dict(sev), '| 3d', dict(v3), '| mismatch', dict(c2), '| export ok', t1_ok, '/', len(t1), '| smoke', len(smoke))
