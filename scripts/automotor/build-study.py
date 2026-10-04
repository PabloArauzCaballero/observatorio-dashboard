"""Rebuild the reviewed study. Figures are transcribed from named primary sources.
No price scraping heuristics silently choose among inconsistent advertisements.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
def read(name):
    return json.loads((ROOT / 'src/data' / name).read_text(encoding='utf-8'))

sources = read('automotive-sources.json')
by_source = {s['id']: s for s in sources}
day = '2026-10-04'

dealers = []
def dealer(id, name, brands, cities, positioning, services, caveat, source, status='Red publicada'):
    dealers.append(dict(id=id, name=name, brands=brands.split('|'), cities=cities.split('|') if cities else [], positioning=positioning, services=services, caveat=caveat, sourceIds=source.split('|'), status=status))

dealer('imcruz','Imcruz','Suzuki|Mazda|Subaru|Renault|Changan|JAC','Santa Cruz|La Paz|El Alto|Cochabamba|Sucre|Potosí|Tarija|Montero|Yacuiba',
       'Portafolio multimarca: urbanos, SUV, pickups y utilitarios. Comparar por segmento, no sumar ofertas como participación.',
       'Publica repuestos, talleres, crédito bancario y directo. JAC identifica concesionarios Axel, Rafcar y Go Autos.',
       'La presencia del grupo no prueba que cada sucursal venda todas sus marcas ni que tenga stock. Ciudades observadas en red Suzuki y selector JAC.', 'imcruz|suzuki-network|js4-bo')
dealer('nibol','Nibol / red Nissan','Nissan','Santa Cruz|Montero',
       'SUV, sedanes y pickups; rival por configuración, financiación, entrega y valor de reventa verificable.',
       'La red distingue ventas de centros de repuestos y servicio.',
       'Este recorte corresponde a la división vehículos de la página consultada; no representa toda la cobertura de otras divisiones ni exclusividad nacional.', 'nibol|nissan-bo-frontier')
dealer('autosud','Autosud / red Kia','Kia','Santa Cruz|Montero|La Paz|El Alto|Cochabamba|Tarija|Sucre|Potosí',
       'Urbanos, sedanes y SUV; oferta electrificada publicada. La web presenta precios contradictorios.',
       'Ficha K3: garantía de 3 años o 100.000 km, facilidades de financiación y repuestos. Nombra Rothman, Reese, Autosur y Guty.',
       'Garantía citada para la ficha K3, no extensible a toda la gama. Entrega inmediata es un anuncio, sin comprobación de inventario.', 'kia-brochure|kia-network|kia')
dealer('hansa','Hansa · División Automotriz','Volkswagen|Audi','',
       'Pasajeros y premium; camiones/buses Volkswagen como negocio relacionado.',
       'Publica posventa de vehículos, camiones/buses, repuestos y accesorios.',
       'No se obtuvo lista homogénea por versión, precio o sucursal; no asignar ciudad a partir de la sede corporativa.', 'hansa')
dealer('toyosa','Toyosa','Toyota','Santa Cruz|Montero|La Paz|El Alto|Cochabamba|Potosí|Oruro',
       'Red relevante para SUV y pickups; Prado documenta oferta 4WD.',
       'Ficha oficial disponible; cotización y condiciones actuales deben confirmarse por versión.',
       'Evidencia de red en folleto 2025; requiere actualización de sucursales. No se obtuvo precio público actual comparable.', 'toyosa', 'Documento 2025')
dealer('carmax','Carmax','Hyundai','Santa Cruz|La Paz|El Alto|Cochabamba|Sucre|Tarija',
       'Competidor en SUV compactos; ficha Creta identifica puntos de venta y servicio.',
       'Ficha oficial de marzo de 2026 consultada vía buscador.',
       'La descarga directa devolvió 403: vínculo comprobado en documento indexado, sin archivo local verificable; no se publican precios como confirmados.', 'hyundai', 'Verificación parcial')

# Historical census is deliberately kept apart from a currently verified network.
historical = [
 ('Andar','BMW'),('Autosud','Kia'),('CAM-SA','Ford'),('Carmax','Hyundai'),
 ('Crown','Maxus, Toyota'),('DAZ Import','Chery, Foday, Forlan, Forland, Foton, Golden Dragon, Helmarv, Higer, Soueast'),
 ('Hansa','Volkswagen, Audi'),('Imcruz','Changan, JAC, Suzuki'),
 ('Kingmoiz','Golden Dragon, Keyton, King Long, T-King'),('Nibol','Foton, John Deere, Nissan, UD Trucks, Volvo'),
 ('Ovando','Chery, Fiat, Fuso, Jeep, JMC, Mercedes, MMC, RAM'),('Rodaria','DFM, DFSK, ZNA'),
 ('Sercoa','Great Wall, Haval'),('Sud Americana','Citroën, Peugeot'),('Tayo Motors','Nissan'),('Toyosa','Toyota'),('Viaggio','GAC')]

offers=[]
def offer(id, country, brand, model, version, year, price, currency, kind, source, note='', until=None, status='Vigencia no informada', dealer=None):
    offers.append(dict(id=id,country=country,brand=brand,model=model,version=version,modelYear=year,price=price,currency=currency,priceType=kind,sourceId=source,observedAt=day,validUntil=until,status=status,conditions=note,dealer=dealer,availability='No verificada',taxes='No desglosados en la oferta' if country!='Paraguay' else 'Según oferta; verificar versión'))

# Retain the original dated capture, never pass a recapture of the URL as its old hash.
old=read('vehicle-prices.json')
for i,r in enumerate(old):
    if r['brand']!='Nissan': continue
    sid='nissan-bo-'+r['model'].lower().replace(' ','-')
    offer('bo-nissan-'+str(i),'Bolivia',r['brand'],r['model'],r['version'],r['modelYear'],r['price'],'USD',r['priceType'],sid,
          'Tabla visible de precios por versión; datos antiguos incrustados y cabeceras pueden corresponder a otro año. Confirmar equipamiento, impuestos y entrega antes de comprar.',dealer='Red Nissan')
    # Verify published table amount appears in the current captured body (not only embedded JSON).
    s=by_source[sid]; text=(ROOT/s['archive']).with_suffix('.txt').read_text(encoding='utf-8')
    if f"{r['price']:,}" not in text and f"{r['price']:,}".replace(',','.') not in text:
        raise ValueError(f'Precio Nissan no encontrado en captura: {r}')

for id,model,version,year,price,sid in [
 ('kwid-zen','Kwid','Zen 1.0 MT',2027,13900,'kwid-bo'),('kwid','Kwid','Outsider 1.0 MT',2027,14990,'kwid-bo'),
 ('kardian','Kardian','Evolution 1.6 MT',2027,20600,'kardian-bo'),
 ('duster','Duster','Zen 1.6 Plus MT 4x2',2026,20900,'duster-bo'),
 ('duster-cvt','Duster','Iconic 1.3 Turbo CVT 4x2',2027,28700,'duster-bo'),
 ('duster-4x4','Duster','Iconic 1.3 Turbo MT 4x4',2027,29100,'duster-bo'),
 ('oroch','Oroch','Zen 1.6 MT',2026,20890,'oroch-bo'),
 ('oroch27','Oroch','Zen 1.6 MT 4x2',2027,23190,'oroch-bo'),
 ('oroch4x4','Oroch','Intens 1.3 MT 4x4',2027,28700,'oroch-bo')]:
    offer('bo-'+id,'Bolivia','Renault',model,version,year,price,'USD','Lista',sid,
          'Precio de la captura directa. La ficha técnica contiene campos inconsistentes; equivalencia internacional sin certificar.',dealer='Imcruz')
offer('bo-js4','Bolivia','JAC','JS4','Luxury 1.5 Turbo automática',2026,17990,'USD','Lista','js4-bo','La URL menciona bono; el cuerpo etiqueta precio de lista. Confirmar aplicación del bono y caja exacta.',dealer='Imcruz')
for model,price in [('Jimny 5 puertas',25210),('Jimny 3 puertas',22370),('Fronx Híbrido',20060),('APV',20160),('Baleno',17320),('Carry',18370),('S-Presso',13430),('Alto',11020),('Swift Híbrido',16480)]:
    offer('bo-suzuki-'+model.lower().replace(' ','-'),'Bolivia','Suzuki',model,'No identificada',None,price,'$ sin código','Desde','suzuki',
          'La portada usa $ sin código monetario; no identifica año/versión del piso. Excluido de brechas y de agregación con USD hasta confirmar condiciones.',dealer='Imcruz')
for model,a,b in [('Picanto',16190,13800),('Soluto',15290,15500),('Sonet',20490,20300),('Seltos',23490,21900),('Sorento',40490,43200),('Sportage',29490,28900)]:
    offer('bo-kia-'+model.lower(),'Bolivia','Kia',model,'No identificada',None,a,'USD','Desde','kia',f'En la misma portada aparecen USD {a:,} y USD {b:,}. No se elige un precio válido sin aclaración del vendedor.',status='Conflicto · excluido',dealer='Autosud / red Kia')

for version,price in [('Sense MT',19990),('Advance MT',22090),('Advance CVT',23090)]:
    offer('pe-kicks-'+version,'Perú','Nissan','Kicks Play',version,2026,price,'USD','Lista','kicks-pe','Incluye impuestos; excluye placas. Lista válida del 1 al 31 de julio de 2026.','2026-07-31','Vencida')
for version,price in [('DC S 4x4 MT',37990),('DC XE 4x2 MT',40990),('DC PRO 4x4 AT',46990)]:
    offer('pe-frontier-'+version,'Perú','Nissan','Frontier',version,2026,price,'USD','Lista','frontier-pe','Incluye impuestos; excluye placas. Vigencia agosto de 2026.','2026-08-31','Vencida')
for version,price in [('Comfort MT',15490),('Luxury MT',16990),('Luxury CVT',17590)]:
    offer('pe-js4-'+version,'Perú','JAC','JS4',version,2027,price,'USD','Lista','js4-pe','La lista se separa de precios con crédito Santander; año distinto a Bolivia.')
offer('pe-kwid','Perú','Renault','Kwid','Outsider 1.0 MT',2026,13490,'USD','Lista','kwid-pe','Cuota mensual y TEA son simulación aparte. Año distinto a Bolivia.')
for version,price in [('Sense 2R',23990000),('Sense 3R',24990000),('Exclusive 3R AWD',32490000)]:
    offer('cl-xtrail-'+version,'Chile','Nissan','X-Trail',version,2027,price,'CLP','Con bono y crédito','xtrail-cl','Precio desde con bono de marca y Crédito Inteligente. 2.5 L y CVT en la página; confirmar versión, costo total y cuota final.')
offer('cl-sentra','Chile','Nissan','Sentra','SR Platinum CVT',2026,27990000,'CLP','Con bono y crédito','sentra-cl','Condicionado a bonos; no equivale a lista al contado. Versión distinta a Exclusive de Bolivia.')
offer('py-kardian','Paraguay','Renault','Kardian','No identificada',None,17990,'USD','Desde','renault-py','Gama declara IVA incluido para Kardian; no identifica configuración ni año del piso.')
offer('py-oroch','Paraguay','Renault','Oroch','No identificada',None,18990,'USD','Desde','renault-py','Piso de gama sin versión ni año; no comparar como mismo SKU.')

comparisons=[]
def pair(model,bo,foreign,grade,reason):
    comparisons.append(dict(id=str(len(comparisons)+1),model=model,boliviaId=bo,foreignId=foreign,grade=grade,reason=reason,directGapAllowed=False))
def nissan(model,version):
    return next(o['id'] for o in offers if o['country']=='Bolivia' and o['model']==model and o['version']==version and o['modelYear']==2026)
pair('Kicks Play',nissan('Kicks Play','Sense MT'),'pe-kicks-Sense MT','B','Nombre, año y caja coinciden; falta cerrar ficha técnica y Perú es julio vencido. No mide sobreprecio actual.')
pair('Frontier',nissan('Frontier','PRO-4X TA 4X4'),'pe-frontier-DC PRO 4x4 AT','B','Año y familia 4x4 AT próximos; motor/equipamiento por país sin cerrar, y lista Perú vencida en agosto.')
pair('Kwid','bo-kwid','pe-kwid','B','Outsider 1.0 MT en ambos; Bolivia MY2027 frente a Perú MY2026. Faltan fichas de seguridad y garantía comparables.')
pair('JS4','bo-js4','pe-js4-Luxury CVT','B','Luxury turbo automática en Bolivia MY2026; Luxury CVT Perú MY2027. No se certifica caja/equipamiento iguales.')
pair('X-Trail',nissan('X-Trail','Sense CVT'),'cl-xtrail-Sense 2R','B','Bolivia MY2026, Chile MY2027; filas y equipo deben cotejarse. Chile condiciona el precio a crédito y bonos.')
pair('Sentra',nissan('Sentra','Exclusive'),'cl-sentra','B','Exclusive Bolivia frente a SR Platinum CVT Chile; versión y condiciones de pago diferentes.')
pair('Kardian','bo-kardian','py-kardian','C','Paraguay informa piso sin versión/año y Bolivia presenta especificaciones inconsistentes.')
pair('Oroch','bo-oroch','py-oroch','C','Mismo nombre; Paraguay no identifica configuración del precio desde.')

totals=[443888,493893,536578,601790,699646,842857,905870,961228,1082984,1206751,1326833,1456428,1574552,1711005,1800354,1910127,2013400,2109117,2226662,2346392,2470622,2583283,2672176]
def changes(rows):return [dict(name=n,prior=a,value=b,sourceId='ine-fleet',year=2025,unit='vehículos registrados') for n,a,b in rows]
fleet=dict(sourceId='ine-fleet',definition='Stock de registros municipales RUAT al cierre de cada año. Incluye motocicletas y otras clases; no equivale a ventas nuevas ni parque efectivamente circulante.',
 annual=[dict(year=2003+i,value=n) for i,n in enumerate(totals)],
 departments=changes([('Chuquisaca',95921,99092),('La Paz',579504,597239),('Cochabamba',542145,556256),('Oruro',124008,127285),('Potosí',88873,94113),('Tarija',148210,154373),('Santa Cruz',937799,973537),('Beni',56552,58873),('Pando',10271,11408)]),
 classes=changes([('Motocicleta',872550,931205),('Vagoneta',648966,664126),('Automóvil',386547,389974),('Camioneta',233827,238769),('Camión',147662,151051),('Minibús',136570,138318),('Jeep',66747,67195),('Tracto-camión',32617,33251),('Microbús',18694,18491),('Furgón',17648,18014),('Bus',13189,13230),('Quadra Track',6506,6757),('Ambulancia',1358,1332),('Maquinaria pesada',271,328),('Torpedo',82,78),('Trimóvil-camión',49,57)]),
 ages=[dict(name=n,value=v) for n,v in [('≤1969',17588),('1970–1975',28871),('1976–1980',56103),('1981–1985',78863),('1986–1990',165018),('1991–1995',221872),('1996–2000',292579),('2001–2005',108527),('2006–2010',214670),('2011–2015',473102),('2016–2020',495317),('2021–2025',504770),('2026–2030',14896)]],
 caveats=['Pando tiene cobertura limitada: RUAT requiere importación definitiva y Cobija es zona franca. No interpretar su bajo registro como demanda inexistente.', 'Año modelo no es fecha de venta: el boletín incluye modelos 2026–2030 dentro del stock de 2025.', 'No hay ventas por marca o matriculaciones nuevas en este conjunto. No se calcula cuota de concesionarios.'])

study=dict(version='2026-10-04.1',observedAt=day,title='Mercado automotor boliviano · estudio empresarial',sources=sources,dealers=dealers,
 historicalDealers=[dict(name=n,brands=b,period='enero 2023–junio 2024',sourceId='aemp',status='Padrón histórico; representación actual sin certificar') for n,b in historical],
 offers=offers,comparisons=comparisons,fleet=fleet,trade=read('automotive-trade.json'),
 conflicts=[
 dict(subject='Renault Kardian y Kwid',detail='La captura directa de versiones devuelve Kardian 20.600 y Kwid Zen 13.900 / Outsider 14.990 USD; el buscador devolvió 19.900 y 14.490 / 16.500. Se usa la captura directa fechada, se conserva el desacuerdo y se bloquea una brecha internacional. No se interpreta como cambio temporal confirmado.',sourceIds=['kardian-bo','kwid-bo']),
 dict(subject='Kia · seis modelos',detail='Distintos bloques de una misma página publican distintos precios desde. Todos quedan excluidos de cálculos de posicionamiento.',sourceIds=['kia']),
 dict(subject='Nissan · datos incrustados antiguos',detail='Las páginas conservan JSON y encabezados de años previos junto a listas MY2026/27. Se transcribe la tabla visible por versión; no se toma el mínimo del HTML.',sourceIds=['nissan-bo-frontier','nissan-bo-kicks-play']),
 dict(subject='JAC JS4 · bono en URL',detail='El enlace contiene con bono marca y el texto dice Precio lista. Se registra la etiqueta visible con esta advertencia; sin afirmar precio efectivo al contado.',sourceIds=['js4-bo']),
 dict(subject='Hyundai · archivo bloqueado',detail='Ficha oficial indexada revisada; la descarga directa devolvió HTTP 403. Evidencia parcial, sin hash utilizable de la ficha.',sourceIds=['hyundai'])],
 environment=[
 dict(topic='Financiación y capacidad de compra',fact='ASFI: cartera total 229.576 millones de Bs; consumo 22.666 millones (9,9%), diciembre 2025.',implication='El crédito de consumo contextualiza capacidad financiera; no mide colocaciones para autos. Comparar tasa efectiva, seguros, inicial y cuota final antes de ofrecer una cuota gancho.',sourceIds=['asfi'],status='Dato histórico oficial'),
 dict(topic='ICE de eléctricos e híbridos',fact='DS 5653, 9 de julio de 2026, establece alícuotas por anexo hasta el 31 de diciembre de 2026.',implication='El horizonte de nacionalización importa. Verificar subpartida, tecnología y vigencia de cada vehículo; no aplicar una tasa única por llevar la etiqueta híbrido.',sourceIds=['ds5653'],status='Norma revisada; liquidación por subpartida pendiente'),
 dict(topic='Divisas y nacionalización',fact='El reglamento aduanero distingue valor CIF, tributos y tipo de cambio aplicable. El precio minorista extranjero no es costo CIF.',implication='Separar costo efectivo de conseguir USD, conversión aduanera, impuestos recuperables y gastos. Cotizar flete y despacho antes de comprometer precio de venta.',sourceIds=['aduana','bcb'],status='Marco; sin cotización de importación'),
 dict(topic='Combustible, uso y electrificación',fact='El sitio tiene una serie separada de carburantes; precios publicados no miden disponibilidad física de combustible.',implication='Comparar costo total con kilómetros, consumo, carga, mantenimiento y residual editables. Validar repuestos, batería, garantía y talleres antes de expandir EV/HEV.',sourceIds=['suzuki','kia','nissan-bo-x-trail-e-power'],status='Hipótesis empresarial; consumo local por medir')],
 decisions=[
 dict(title='Posventa: una oportunidad medible sobre el parque',evidence='El stock de modelos hasta 2015 suma 1.657.193 vehículos registrados (62,0%). Incluye todas las clases.',action='Priorizar disponibilidad de repuestos de rotación, diagnóstico y mantenimiento. Estimar el parque atendible por marca, zona y antigüedad antes de abrir taller.',trigger='Órdenes mensuales, recurrencia, horas vendidas y disponibilidad de piezas.',limit='Antigüedad por año modelo no prueba kilometraje, estado mecánico ni demanda pagadora.',sourceIds=['ine-fleet']),
 dict(title='Ciudades: validar densidad y costo de atender',evidence='Santa Cruz, La Paz y Cochabamba concentran 79,6% del registro nacional, incluidos motos y utilitarios.',action='Comparar captación, alquiler, servicio y competencia en estas áreas; atender plazas secundarias con aliados antes de comprometer una sala grande.',trigger='Conversión de cotizaciones, costo por venta y utilización del taller por ciudad.',limit='Departamento no equivale a ciudad. No trasladar participaciones del parque a cuotas de ventas nuevas.',sourceIds=['ine-fleet']),
 dict(title='Portafolio: separar reposición familiar y uso de trabajo',evidence='Vagonetas crecen 2,3% y camionetas 2,1% en stock 2025; automóviles 0,9%. Motocicletas explican gran parte del aumento total.',action='Probar surtido corto por necesidad: urbano de entrada, SUV familiar y pickup de trabajo, con cotizaciones equivalentes y costo de uso documentado.',trigger='Reservas pagadas, tasa de cierre, días de stock y contribución neta por SKU.',limit='Estas variaciones son de stock registrado; no pronostican ventas por modelo.',sourceIds=['ine-fleet']),
 dict(title='Precio: competir por oferta efectiva',evidence='Hay listas, pisos desde, campañas vencidas y bonos de crédito entre las fuentes observadas.',action='Emitir una hoja por versión con precio al contado, costo total financiado, entrega, garantía y servicios. Renovarla al cambiar la campaña.',trigger='Pérdidas de ventas por rival, diferencia de equipamiento y costo financiero total.',limit='Ningún par internacional investigado acredita aún una brecha actual del mismo SKU y condiciones.',sourceIds=['kwid-pe','kicks-pe','xtrail-cl','kia']),
 dict(title='Inventario: proteger caja y reposición',evidence='Sin costos de compra ni stock privado, la rentabilidad real no puede observarse.',action='Usar el simulador para fijar exposición por unidad, plazo de reposición y margen mínimo. Escalonar compras y renegociar condiciones si sube el costo de USD.',trigger='Días de inventario, unidades reservadas, caja comprometida y costo de reposición.',limit='Escenarios ilustrativos; no son márgenes ni utilidades de concesionarios.',sourceIds=['aduana','bcb']),
 dict(title='Electrificados: validar el servicio antes del volumen',evidence='Fuentes bolivianas publican Swift/Fronx híbridos, Kia EV5 y Nissan e-POWER; DS5653 tiene horizonte tributario definido.',action='Pilotear con clientes cuyo recorrido y carga estén medidos; asegurar diagnóstico, repuestos, garantía de batería y valor residual antes de ampliar pedidos.',trigger='Costo/km, acceso a carga, plazo de pieza crítica y reclamos de garantía.',limit='No se dispone de ventas por motorización ni de costos locales homogéneos de batería y reventa.',sourceIds=['suzuki','kia','ds5653'])],
 gaps=['Ventas por marca, concesionario y ciudad: no disponibles en estas fuentes públicas.', 'Costos CIF, márgenes, stock y plazos reales: requieren documentación del negocio.', 'Equivalencia A: no lograda; se publican ocho pares B/C con motivos, sin porcentaje engañoso.', 'Red vigente completa: el padrón AEMP es histórico. Cuatro grupos tienen verificación web actual; Toyosa tiene folleto 2025 y Carmax verificación parcial.', 'Usados, seguros, mantenimiento y depreciación: se incluyen como variables de decisión, sin cifras de transacción verificadas.'])

assert sum(r['value'] for r in fleet['departments'])==totals[-1]
assert sum(r['value'] for r in fleet['classes'])==totals[-1]
assert sum(r['value'] for r in fleet['ages'])==totals[-1]
assert len({o['id'] for o in offers})==len(offers)
assert sum(r['value'] for r in fleet['ages'][:10])==1657193
for o in offers: assert o['sourceId'] in by_source
for p in comparisons: assert all(any(o['id']==p[k] for o in offers) for k in ['boliviaId','foreignId'])
target=ROOT/'src/data/automotive-study.json'
target.write_text(json.dumps(study,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(offers)} ofertas, {len(dealers)} redes, {len(comparisons)} pares, {len(sources)} fuentes')
