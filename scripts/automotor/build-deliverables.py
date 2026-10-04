"""Write the standalone report and an executed, inspectable stdlib notebook."""
import contextlib
import html
import io
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
study = json.loads((ROOT/'src/data/automotive-study.json').read_text(encoding='utf-8'))
sources = {s['id']: s for s in study['sources']}
esc = lambda value: html.escape(str(value))
fmt = lambda value: f'{value:,.2f}'
def evidence(ids):
    return ' · '.join(f'<a href="{esc(sources[id]["url"])}">{esc(sources[id]["title"])}</a>' for id in ids)
def table(headers, rows):
    return '<div class="scroll"><table><thead><tr>'+''.join(f'<th>{esc(v)}</th>' for v in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{esc(v)}</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table></div>'
parts = [f'<h1>{esc(study["title"])}</h1><p class="lead">Corte de investigación: {study["observedAt"]}. Decisiones de portafolio, precio, inventario, red comercial y posventa.</p>',
 '<p>Este informe distingue hechos publicados, interpretación empresarial y supuestos. Las ofertas no son ventas ni acreditan stock. La investigación pública no permite conocer costos privados, rentabilidad por empresa ni cuotas de mercado.</p>',
 '<h2>1. Situación del mercado y lectura empresarial</h2>']
total = study['fleet']['annual'][-1]['value']; prior=study['fleet']['annual'][-2]['value']
moto=next(r for r in study['fleet']['classes'] if r['name']=='Motocicleta')
parts += [f'<p>El parque registrado llega a <strong>{total:,} vehículos</strong> en 2025, +{(total/prior-1)*100:.2f}%. Sin motocicletas, crece {((total-moto["value"])/(prior-moto["prior"])-1)*100:.2f}%. Las motos explican {(moto["value"]-moto["prior"])/(total-prior)*100:.1f}% del aumento neto. El parque es un stock administrativo y no mide ventas nuevas.</p>',evidence(['ine-fleet'])]
for d in study['decisions']:
    parts += [f'<h3>{esc(d["title"])}</h3><p><b>Evidencia:</b> {esc(d["evidence"])}</p><p><b>Acción:</b> {esc(d["action"])}</p><p><b>Medir:</b> {esc(d["trigger"])}</p><p class="note">{esc(d["limit"])}</p>',evidence(d['sourceIds'])]
parts += ['<h2>2. Parque, ubicación y antigüedad</h2>',f'<p>{esc(study["fleet"]["definition"])}</p>']
for group,title in [('departments','Departamentos'),('classes','Clases'),('ages','Año modelo')]:
    parts += [f'<h3>{title}</h3>',table(['Grupo','Registros 2025','% del total'],[(r['name'],f'{r["value"]:,}',f'{r["value"]/total*100:.2f}%') for r in study['fleet'][group]])]
parts += ['<p class="note">'+esc(note)+'</p>' for note in study['fleet']['caveats']]
parts += ['<h2>3. Importaciones y abastecimiento</h2>',f'<p>{esc(study["trade"]["definition"])}</p>']
for heading,title in [('8702','Transporte de 10 o más personas'),('8703','Principalmente pasajeros'),('8704','Mercancías')]:
    rows=sorted([r for r in study['trade']['annual'] if r['heading']==heading],key=lambda r:r['year'])
    a=next(r for r in rows if r['year']==2024);b=next(r for r in rows if r['year']==2025)
    parts += [f'<h3>{heading} · {title}</h3><p>2025: USD {b["usd"]/1e6:.2f} millones CIF, {(b["usd"]/a["usd"]-1)*100:.2f}% respecto de 2024. Peso: {(b["kg"]/a["kg"]-1)*100:.2f}%. Ambas gestiones son provisionales; valor y peso no equivalen a unidades.</p>',table(['Año','Período','USD CIF','kg','Provisional'],[(r['year'],'ene–dic' if len(r['months'])==12 else 'ene–ago',fmt(r['usd']),fmt(r['kg']),'Sí' if r['provisional'] else 'No marcado') for r in rows])]
parts += ['<p><b>Interpretación:</b> la contracción de importaciones de pasajeros, junto con un parque acumulado grande, favorece investigar reposición selectiva y posventa. No identifica por sí sola si la causa es menor cantidad, cambio de precios o mezcla de productos. Proteger caja exige medir costo de reposición y días de inventario propios.</p>',
 table(['Origen 8703, 2025','USD CIF'],[(r['name'],fmt(r['usd'])) for r in study['trade']['origins']]),
 '<p>El origen es la procedencia aduanera, no la nacionalidad de la marca ni la participación del concesionario.</p>']
for s in study['trade']['sources']:
    parts += [f'<p class="note"><a href="{esc(s["sourceUrl"])}">{esc(s["title"])}</a> · captura {esc(s["retrievedAt"])} · SHA-256 fuente <code>{esc(s["upstreamSha256"])}</code></p>']
parts += ['<h2>4. Competidores, red y propuesta comercial</h2>']
for d in study['dealers']:
    parts += [f'<h3>{esc(d["name"])} · {esc(d["status"])}</h3><p><b>Marcas:</b> {esc(", ".join(d["brands"]))}. <b>Ciudades publicadas:</b> {esc(", ".join(d["cities"]) or "No verificadas")}.</p><p>{esc(d["positioning"])} {esc(d["services"])}</p><p class="note">{esc(d["caveat"])}</p>',evidence(d['sourceIds'])]
parts += ['<h3>Universo histórico para seguimiento</h3><p>AEMP, enero 2023–junio 2024. Las representaciones actuales requieren verificación.</p>',table(['Empresa','Marcas históricas'],[(d['name'],d['brands']) for d in study['historicalDealers']]),evidence(['aemp'])]
parts += ['<h2>5. Comparación internacional del mismo modelo</h2><p>A exige equivalencia técnica, año y condiciones verificadas; B admite diferencias documentadas; C coincide solo en nombre. No se obtuvo un par A vigente. No se calcula una brecha porcentual y no se interpreta el precio minorista extranjero como CIF o margen del importador.</p>']
offers={o['id']:o for o in study['offers']}
for pair in study['comparisons']:
    bo,other=offers[pair['boliviaId']],offers[pair['foreignId']]
    parts += [f'<h3>{esc(pair["model"])} · comparabilidad {pair["grade"]}</h3>',table(['Mercado','Versión / año','Precio','Clase / estado'],[(o['country'],f'{o["version"]} / {o["modelYear"] or "no informado"}',f'{o["currency"]} {fmt(o["price"])}',f'{o["priceType"]} / {o["status"]}') for o in [bo,other]]),f'<p><b>Límite:</b> {esc(pair["reason"])}</p>']
    for o in [bo,other]:parts += [f'<p>{esc(o["country"])}: {esc(o["conditions"])}</p>',evidence([o['sourceId']])]
parts += ['<h2>6. Entorno externo, escenarios y control del negocio</h2>']
for d in study['environment']:
    parts += [f'<h3>{esc(d["topic"])}</h3><p>{esc(d["fact"])}</p><p>{esc(d["implication"])}</p><p class="note">{esc(d["status"])}</p>',evidence(d['sourceIds'])]
parts += ['<h3>Escenarios editables del tablero</h3><p>Se prueban: costo de USD +20%, inventario +60 días y financiación +5 puntos porcentuales. Son sensibilidades, no pronósticos. El escenario de divisas mantiene tributos en Bs constantes y por tanto es parcial.</p><p>Costo económico = (FOB + flete + seguro) × Bs/USD + tributos no recuperables + gastos locales. Caja por unidad = costo económico + tributos recuperables adelantados. Costo financiero = caja × tasa anual × días/365. Precio neto objetivo = (costo económico + financiación)/(1 − margen sobre venta). Punto de equilibrio = costos fijos mensuales/contribución unitaria.</p>',
 '<p>Ejemplo hipotético: FOB USD 15.000, flete/seguro USD 1.000, cambio 7 Bs/USD, tributos no recuperables Bs 28.000, gastos locales Bs 3.000, 10 unidades, 90 días, tasa 15%, margen 18% y costos fijos Bs 40.000/mes. El costo económico es Bs 143.000 por unidad, la caja del lote Bs 1.430.000, el interés Bs 5.289,04 por unidad y el precio neto objetivo Bs 180.840,29; cubrir costos fijos requiere 2 unidades/mes a esos supuestos. No son costos observados ni una liquidación tributaria.</p>',
 '<p>Costo de uso = compra − reventa + años × (km/año × consumo/100 × precio de energía + seguros/mantenimiento/otros). Comparar tecnologías con igual recorrido y horizonte. Añadir financiación, cargador, batería y reparaciones según el caso; no se dispone de valores locales homogéneos para esos componentes.</p>',
 '<h3>Control comercial recomendado</h3><ul><li>Precio efectivo: contado y desembolso total financiado por versión.</li><li>Inventario: días desde pago hasta cobro, reservas, edad por año modelo y caja comprometida.</li><li>Venta: conversión de cotización a reserva y venta, motivo de pérdida y rival concreto.</li><li>Posventa: recurrencia, horas productivas, plazo de pieza crítica y costo de garantía.</li><li>Abastecimiento: costo de reposición, lead time, exposición por proveedor/moneda y escenario tributario.</li></ul>',
 '<h2>7. Registro completo de precios y calidad</h2>']
parts += [table(['País','Marca/modelo/versión','Año','Precio','Tipo / estado','Condiciones','Fuente'],[(o['country'],f'{o["brand"]} {o["model"]} {o["version"]}',o['modelYear'] or 'No informado',f'{o["currency"]} {fmt(o["price"])}',f'{o["priceType"]} / {o["status"]}',o['conditions'],sources[o['sourceId']]['url']) for o in study['offers']])]
for c in study['conflicts']:parts += [f'<h3>{esc(c["subject"])}</h3><p>{esc(c["detail"])}</p>',evidence(c['sourceIds'])]
parts += ['<h2>8. Alcance pendiente de evidencia privada o adicional</h2><ul>'+''.join(f'<li>{esc(g)}</li>' for g in study['gaps'])+'</ul><p>Para cerrar esas brechas se requieren cotizaciones equivalentes, facturas CIF, inventario, ventas por ciudad y versión, términos de garantía y costos de taller. El informe público funciona con límites explícitos y no transforma esos vacíos en ceros.</p>',
 '<h2>Fuentes y trazabilidad</h2><p>Capturas directas con SHA-256; originales conservados en el archivo de trabajo. Las respuestas fallidas se registran y no certifican una oferta. La fecha de captura no implica vigencia comercial. Los precios no fueron confirmados mediante contacto privado.</p>']
for s in study['sources']:
    parts += [f'<p class="note"><a href="{esc(s["url"])}">{esc(s["title"])}</a> · HTTP {s["httpStatus"]} · {esc(s["capturedAt"])}<br /><code>{s["sha256"]}</code></p>']

document='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Estudio automotor Bolivia · 4 octubre 2026</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#15202b;max-width:1100px;margin:3rem auto;padding:0 1.5rem}h1{font-size:2.4rem;line-height:1.2}h2{margin-top:3rem;border-bottom:2px solid #15202b;padding-bottom:.5rem}h3{margin-top:2rem}.lead{font-size:1.2rem}.note{font-size:.85rem;color:#394854}a{color:#175397}code{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:.8rem}th,td{border-bottom:1px solid #c4ccd2;padding:.6rem;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eef3f7}.scroll{overflow:auto}@media print{body{margin:0;font-size:10pt;max-width:none}.scroll{overflow:visible}h2{break-before:page}tr{break-inside:avoid}a{color:inherit}table{font-size:7pt}}</style><body>'+''.join(parts)+'</body></html>'
report=ROOT/'public/reports/automotor-2026-10-04.html';report.parent.mkdir(parents=True,exist_ok=True);report.write_text(document,encoding='utf-8')

code='''import json, hashlib
from pathlib import Path
root = Path.cwd()
if not (root / "src/data/automotive-study.json").exists(): root = root.parent.parent
s = json.loads((root / "src/data/automotive-study.json").read_text(encoding="utf-8"))
total = s["fleet"]["annual"][-1]["value"]
for key in ["departments", "classes", "ages"]:
    assert sum(r["value"] for r in s["fleet"][key]) == total
ids = {o["id"] for o in s["offers"]}
assert len(ids) == len(s["offers"])
for p in s["comparisons"]:
    assert p["boliviaId"] in ids and p["foreignId"] in ids
    assert p["grade"] == "A" or not p["directGapAllowed"]
print("Parque reconciliado:", total)
print("Ofertas:", len(ids), "Pares:", len(s["comparisons"]))
for heading in ["8702","8703","8704"]:
    rows = {r["year"]:r for r in s["trade"]["annual"] if r["heading"] == heading}
    assert len(rows[2024]["months"]) == len(rows[2025]["months"]) == 12
    print(heading, "CIF 2025:", rows[2025]["usd"], "Cambio %:", round((rows[2025]["usd"] / rows[2024]["usd"] - 1)*100, 3))
verified = 0
for source in s["sources"]:
    file = root / source["archive"]
    if file.exists():
        assert hashlib.sha256(file.read_bytes()).hexdigest() == source["sha256"]
        verified += 1
print("Archivos locales con hash verificado:", verified, "de", len(s["sources"]))
'''
output=io.StringIO()
with contextlib.redirect_stdout(output): exec(compile(code,'automotive-audit','exec'), {'__name__':'__main__'})
notebook=dict(nbformat=4,nbformat_minor=5,metadata={'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'}},cells=[
 dict(cell_type='markdown',metadata={},source=['# Auditoría del estudio automotor\n','Ejecutar desde la raíz del tablero o docs/analysis. Usa biblioteca estándar. Los originales en output/automotor no se distribuyen públicamente; si faltan, el contador lo informa. Revisar las condiciones comerciales en el JSON y el informe HTML.']),
 dict(cell_type='code',metadata={},execution_count=1,source=code.splitlines(keepends=True),outputs=[dict(output_type='stream',name='stdout',text=output.getvalue().splitlines(keepends=True))])])
target=ROOT/'docs/analysis/automotive-audit-2026-10-04.ipynb';target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(notebook,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(output.getvalue())
print(report)
