# Auditoría editorial y de precios de Transporte — 3 de octubre de 2026

## Criterio de publicación

Los tres tableros nuevos comparten `SubTabs`, riel de filtros cruzados, tarjetas de contexto, tablas y descargas CSV/JSON. Las fichas de fuentes están en Método. Cada registro descargable conserva su URL de origen. Una cifra ausente no se rellena con cero ni con un precio de otra versión, producto o ruta.

| Tablero | Cobertura publicada | Lectura permitida | Límite |
| --- | --- | --- | --- |
| Vehículos 0 km | 36 versiones: Nissan 31, Renault 4, JAC 1; cuatro tipos de carrocería | Comparar ofertas anunciadas del mismo modelo, versión y año | No representa todo el mercado; ofertas sujetas a disponibilidad y cambio |
| Carburantes | 445 observaciones: 17 denominaciones internas y 5 internacionales, 2010–agosto 2026 | Seguir los cortes publicados de cada producto y régimen | Los cierres anuales no fijan la fecha de entrada en vigor; Bs/l, Bs/kg y Bs/m³ no se agregan |
| Pasajes | 155 filas: 88 terrestres, 37 aéreas y 30 ferroviarias; documentos de 2016, 2025 y 2026 | Comparar máximos de la misma ruta y clase, con DUA aéreo incluido en ambos años | Sólo dos rutas del folleto terrestre de 2016 se transcribieron; varios plazos transitorios de 2026 terminaron antes de la consulta |

### Vehículos

Las 14 páginas oficiales usadas por las 36 observaciones tienen URL, fecha de captura, estado HTTP, tamaño y hash SHA-256 en [`vehicle-price-source-hashes-2026-10-03.json`](vehicle-price-source-hashes-2026-10-03.json). El hash corresponde al HTML descargado después de redirecciones; permite detectar cambios posteriores en la página, aunque el sitio pueda variar contenido accesorio entre solicitudes.

El núcleo conserva la misma captura en `boot/vehicle-prices.json` y `boot/vehicle-price-sources.json` del paquete `vehicle-prices`. La migración `0099` expone las observaciones y la última oferta de cada versión y página en `read_models.vehicle_price_observation` y `read_models.vehicle_price_offer`. La API prefiere esa vista; si todavía falta en un entorno, sirve la captura local del 3 de octubre de 2026 y declara `catalogOrigin: snapshot`. La fecha de captura sólo se conoce con precisión de día, no de hora. El estado «No verificada» de disponibilidad y los campos nulos de ciudad, concesionario, motorización y vigencia expresan ausencia de información, no ausencia de oferta.

- [Nissan Bolivia](https://www.nissan.com.bo/vehiculos/nuevos-vehiculos.html) publica importes por versión y año modelo. Se capturaron páginas de Frontier, Kicks, Pathfinder, Sentra, Versa y X-Trail.
- [Renault Bolivia](https://www.renault.com.bo/busqueda) publica precios de lista por versión. Se conservaron Kwid Outsider, Kardian Evolution, Duster Zen y Oroch Zen. [Kardian Evolution 2027](https://www.renault.com.bo/auto/kardian) se actualizó a US$ 19.900, importe que coincide en su [ficha de versiones](https://www.renault.com.bo/auto/kardian/versiones).
- [JAC Bolivia](https://www.jac.com.bo/cotizacion?id=4379&year=con+bono+marca) publica el precio de lista de JS4 Luxury automática 2026. Otras páginas del propio sitio muestran importes distintos para el mismo modelo o sólo un «desde» sin versión, por lo que no se usaron.
- [AEMP](https://www.autoridadempresas.gob.bo/wp-content/uploads/2024/competencia/Monitoreo%20precios/Veh%C3%ADculos%20Automotores%20en%20Bolivia%20-%20ene2023-jun2024.pdf) sirvió para contrastar segmentos e importadores. Su estudio de 2023–2024 no se trató como precio actual. También se revisaron catálogos de Kia, Suzuki, Hyundai y Changan; se excluyeron montos ambiguos, marcadores vacíos o modelos sin precio público de versión.

**Verificación adicional del 3 de octubre de 2026.** [Nissan Qashqai](https://www.nissan.com.bo/vehiculos/nuevos-vehiculos/25-qashqai.html) anuncia Sense MT a US$ 34.990 y Advance MT a US$ 36.990, pero no identifica el año modelo en esa página ni en su ficha técnica; queda pendiente para una tabla que distingue años. El [catálogo público de Suzuki](https://www.suzuki.com.bo/) muestra precios «desde» por modelo, mientras [su página de cotización](https://www.suzuki.com.bo/formulario/cotizacion/) muestra otros importes; las páginas individuales listan versiones sin asociar un precio visible a cada una. Por eso no se asignó el mínimo del modelo a una versión. [Hyundai Bolivia](https://www.hyundai.com.bo/nuestros-modelos/) muestra marcadores «$ 00,000». [Changan Deepal G318](https://www.changan.com.bo/vehiculo/deepal-g318-suv-hibrida-4x4/) identifica versión Luxury y $ 70.000, pero la página consultable no explicita el año modelo ni la moneda con un código inequívoco. Estos casos requieren confirmación antes de entrar en el conjunto comparable.

**Conflictos dentro de Renault.** El [buscador de Renault](https://www.renault.com.bo/busqueda) muestra Koleos Techno 2026 a US$ 35.500 y Esprit Alpine 2027 a US$ 45.990, mientras la [página de Koleos](https://www.renault.com.bo/auto/koleos) y su [ficha de versiones](https://www.renault.com.bo/auto/koleos/versiones) muestran US$ 34.900 y US$ 43.990. El mismo buscador muestra Kwid Zen 2027 a US$ 13.900, pero la [página de Kwid](https://www.renault.com.bo/auto/kwid) y su [ficha](https://www.renault.com.bo/auto/kwid/versiones) muestran US$ 13.600. Ninguna de esas tres versiones entra al tablero hasta que el representante aclare cuál precio rige. La ficha de Kardian también mezcla especificaciones que no coinciden con el nombre de la versión; por ello su transmisión y tracción sólo se consignan cuando aparecen en el nombre, sin extrapolar la ficha.

**Análisis publicable de la muestra.** El tablero cuenta versiones por carrocería y deja visible el anuncio de cada fila. En el conjunto completo hay 18 SUV/vagonetas, 10 camionetas, 7 sedanes y 1 urbano/hatchback. Seis pares comparten marca, modelo, versión, moneda, clase de precio y fecha de captura, pero difieren en año modelo: cuatro Frontier y dos X-Trail. Sus diferencias van de US$ 500 a US$ 3.000. Ambas ofertas de cada par se observaron el mismo día: la diferencia describe el año modelo ofertado, no una subida en el tiempo. Como Nissan aporta 31 de las 36 filas, los recuentos tampoco miden composición ni cuotas del mercado boliviano. La página de [Frontier](https://www.nissan.com.bo/vehiculos/nuevos-vehiculos/23-frontier.html) y la [ficha de Kardian](https://www.renault.com.bo/auto/kardian/versiones) se volvieron a consultar al revisar estas reglas.

### Carburantes

Se transcribieron los dos cuadros históricos de [ANH, precios finales al consumidor](https://www.anh.gob.bo/w2019/contenido.php?s=13). La fecha de cada fila es la fecha que aparece en el cuadro, no una fecha de cambio inferida. Los productos internacionales tienen denominación y régimen propios. Las celdas vacías quedan fuera del conjunto.

### Pasajes

Los datos de [ATT terrestre](https://tarifas.att.gob.bo/index.php/tarifaspizarra/tarifasRutasDepartamentalesTerrestre), [ATT aéreo](https://tarifas.att.gob.bo/index.php/tarifaspizarra/tarifasRutasDepartamentalesAereo), [anexo ferroviario](https://web.att.gob.bo/uploaded/multimedia/RAR%20Ratificaci%C3%B3n%20Tarifaria%20FCA%20Pasajeros.pdf), [folleto terrestre histórico](https://www.att.gob.bo/sites/default/files/archivos_portada/2021-08/Tarifario%20ATT%20T.%20Transporte.pdf) y [texto aéreo de 2025](https://portal.att.gob.bo/sites/default/files/archivos_listados_pdf/2025-03-06/Informe%20Rendici%C3%B3n%20P%C3%BAblica%20de%20Cuentas%20Final%202024.pdf) se etiquetan como bandas o máximos de referencia, nunca como precios efectivamente pagados. La resolución terrestre 32/2025 termina formalmente el 30 de junio de 2026, la aérea 2/2026 el 24 de julio de 2026 y la ferroviaria 25/2025 en septiembre de 2026. Se exponen como historia publicada; no se presume prórroga.

## Revisión transversal de textos

| Sección | Corrección aplicada |
| --- | --- |
| Hoy | La portada explica que sus señales usan fechas distintas; eliminó enlaces de fuente en las tarjetas y texto sobre el mecanismo de generación. |
| Tipo de cambio | El contador se expresa como observaciones disponibles; el estado sin datos evita jerga interna. |
| Macroeconomía | Variables exógenas distingue cotización, índice, precio local y valor aduanero. Se retiró el flete interno. Los estados vacíos de BCB, comercio, energía, recursos y ambiente describen la cobertura sin hablar de migraciones. |
| Empresas | Estados vacíos de reputación y redes sociales expresan ausencia de lecturas, sin instrucciones de carga. |
| Ciudades | Estados vacíos de cuentas departamentales y actividades indican exactamente qué dato falta. |
| Transporte | Carreteras presenta el significado de longitud y superficie; las tres nuevas vistas muestran filtros y unidades explícitos. |
| Prensa | Estados vacíos de temas, comercio y medios de pago hablan de cobertura, no de modelos de base. |
| Método | Se concentran aquí procedencia, límites, fechas de consulta y reglas de comparación de los tableros nuevos. |

La revisión conserva cifras y estructuras existentes que no tenían un error económico demostrado. Los textos de datos incorporados desde sistemas externos conservan el idioma y precisión de su fuente original.
