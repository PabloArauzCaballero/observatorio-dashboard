"""Aggregate the core's INE annual import cube once; preserve upstream provenance.
Run: python scripts/automotor/aggregate-trade.py <core-repository>
"""
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

root = Path(__file__).resolve().parents[2]
core = Path(sys.argv[1])
annual, origins, sources = [], [], []
names = {'215':'China','399':'Japón','361':'India','365':'Indonesia','249':'Estados Unidos','493':'México','105':'Brasil','190':'Corea del Sur'}
for year in range(2019, 2027):
    file = core / f'src/database/seeds/boot/ine-trade/imports-{year}.json'
    raw = file.read_bytes()
    seed = json.loads(raw)
    assert seed['columns']['detail'] == ['nandina', 'country', 'usd', 'fobUsd', 'kg']
    sums = defaultdict(lambda: [0, 0])
    countries = defaultdict(int)
    for nandina, country, usd, fob, kg in seed['detail']:
        heading = str(nandina)[:4]
        if heading not in ['8702','8703','8704']:
            continue
        sums[heading][0] += usd
        sums[heading][1] += kg
        if year == 2025 and heading == '8703': countries[str(country)] += usd
    sources.append(dict(year=year, **seed['provenance'], seedSha256=hashlib.sha256(raw).hexdigest(), months=seed['months'], provisional=seed['provisional']))
    for heading, (usd, kg) in sums.items():
        annual.append(dict(year=year,heading=heading,usd=usd,kg=kg,months=seed['months'],provisional=seed['provisional']))
    for code, usd in sorted(countries.items(),key=lambda p:-p[1])[:8]:
        origins.append(dict(year=year,heading='8703',code=code,name=names.get(code,code),usd=usd))

result=dict(annual=annual,origins=origins,sources=sources,grain='M_DETAIL',unit='USD CIF frontera',observedAt='2026-10-04',
 definition='Suma del cubo anual por NANDINA y país de origen. Unidades físicas no disponibles. 2024, 2025 y 2026 son provisionales; 2026 comprende enero–agosto y se muestra separado.')
(root/'src/data/automotive-trade.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(len(annual),'agregados anuales; origen 2025:',len(origins))
