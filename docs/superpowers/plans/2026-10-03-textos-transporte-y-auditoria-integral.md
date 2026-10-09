# Textos, precios de transporte y auditoría integral — plan de implementación

> **Para implementar:** ejecutar las etapas en orden, con una revisión del resultado de cada etapa antes de pasar a la siguiente. El usuario pidió plan antes de cambios de producto.

**Objetivo:** corregir primero la redacción y el criterio económico de Variables exógenas; después añadir a Transporte precios de vehículos 0 km, carburantes históricos y pasajes; finalmente revisar todas las pestañas con un diseño homogéneo.

**Arquitectura:** conservar las pestañas, filtros cruzados, riel lateral, gráficos y tablas existentes. Los nuevos datos viajarán con fecha de observación, vigencia, unidad y procedencia. El contenido visible será análisis breve y cifras; el catálogo de fuentes y las reglas de cálculo estarán en Método.

**Tecnología:** Next.js 15, React 19, TypeScript, PostgreSQL y el núcleo `EcomicDataCenter`; pruebas unitarias Node y comprobación visual en navegador.

**Alcance acordado:** autos nuevos 0 km, todas las variedades de carburantes publicadas por ANH, pasajes en Transporte y auditoría de todas las pestañas del sitio. Las tarifas de carga entre ciudades salen de Variables exógenas y no se trasladan a Transporte.

## Reglas editoriales y de diseño

- Cada párrafo responde una pregunta económica concreta: qué mide el dato, por qué importa, qué comparación admite y qué límite tiene. Eliminar instrucciones repetidas, promesas vagas y afirmaciones sin respaldo.
- Distinguir cotización externa, precio local, valor unitario aduanero, precio anunciado, tarifa regulada y precio efectivamente pagado. No convertir uno en otro por redacción.
- Conservar el tono y los patrones ya usados: `SubTabs`, `workspace`, `rail`, `FilterHint`, tarjetas, gráficos y `grid-table`. «Panorama» no sustituye el filtro y el desglose.
- En vistas de datos: título, lectura económica y cifras. Las fuentes, enlaces y metodología se catalogan en Método. La API conserva la procedencia para auditoría.
- Toda cifra muestra su periodo o fecha, unidad y cobertura. No rellenar huecos históricos ni comparar directamente monedas, unidades, rutas o versiones distintas.
- Respetar las modificaciones que ya estaban sin confirmar en el checkout; evitar restaurar archivos completos con Git.

## Etapa 1 — Variables exógenas: textos primero

**Archivos principales:** `src/components/exogenous-explorer.tsx`, `src/components/exogenous-table.tsx`, `src/components/exogenous-section.tsx`, `src/lib/exogenous-board.ts`, `src/lib/exogenous-freight.ts`; notas de catálogo en `../EcomicDataCenter/scripts/exogenous/` si el texto erróneo procede de la semilla.

- [ ] Inventariar todos los textos visibles de las siete familias, gráficos, tarjetas, filtros, estados vacíos y notas que llegan de la API. Registrar para cada afirmación la variable y la operación que la respaldan.
- [ ] Sustituir la introducción genérica por una lectura económica corta que se actualice con la familia elegida. Revisar las siete entradillas y los límites de medición; no presentar índices estadounidenses, cotizaciones mundiales, valores de aduana y precios de mercados bolivianos como una misma clase de precio.
- [ ] Corregir errores conceptuales concretos: «último mes cerrado» debe ser «último dato mensual disponible»; el costo implícito aduanero es `(CIF − FOB) / toneladas`, incluye seguro y cambia con la composición de importaciones; una tarifa publicada de flete no equivale al costo de un importador boliviano.
- [ ] Retirar del render la tabla `FreightReferences` y eliminar las menciones de carga entre ciudades en la familia Fletes. La familia conserva sólo las series internacionales y la medida aduanera pertinente. El archivo sin uso se elimina después de comprobar que ninguna vista lo importa.
- [ ] Quitar el bloque de fuentes y explicaciones metodológicas de la vista. Trasladar su contenido validado a Método mediante el catálogo de fuentes, sin perder procedencia en la API.
- [ ] Comprobar en la URL de Variables exógenas que cambiar producto, ámbito y familia cambia sólo las lecturas correspondientes; la tabla de flete entre ciudades no aparece; fechas, unidades y textos concuerdan con los datos. Ejecutar `npm run typecheck` y la prueba de navegación pública pertinente.

**Entrega de la etapa:** una página legible sin prosa de relleno, sin tarifas internas y sin bloque de fuentes fuera de Método.

## Etapa 2 — Auditoría de texto y experiencia en todas las pestañas

**Cobertura:** Hoy, Tipo de cambio, las siete páginas de Macroeconomía, las tres de Empresas, Ciudades, las tres actuales de Transporte, las dos de Prensa y Método. `src/app/page.tsx` define las ocho pestañas principales; los componentes `*-section.tsx` definen las interiores.

- [ ] Levantar una matriz por vista con título, propósito, filtros, unidades, periodos, textos visibles, afirmaciones no verificadas, repetición, estados vacíos y enlaces a Método. Tomar capturas en escritorio y móvil antes de diseñar cambios.
- [ ] Corregir en cada vista frases que describen el código, instrucciones obvias, conclusiones causales no justificadas y agregados incompatibles. Escribir lecturas condicionadas por el recorte real; si no hay comparación válida, mostrar sólo la cifra y su contexto.
- [ ] Uniformar jerarquía: título breve, una lectura económica, filtros a la izquierda cuando hay varias dimensiones, tarjetas de último dato, gráfico o mapa y tabla detallada. No forzar un gráfico cuando el dato es una tarifa puntual o una lista.
- [ ] Revisar accesibilidad y responsive de cada pestaña: foco, selección, nombres de controles, scroll de riel, tablas anchas y enlaces entre pestañas. Reutilizar CSS existente antes de crear variantes.
- [ ] Cerrar la matriz vista por vista con captura posterior, comprobación del dato que sustenta la lectura y una lista explícita de límites todavía abiertos.

**Orden de revisión:** Macroeconomía y Transporte; luego Hoy y Tipo de cambio; después Empresas, Ciudades, Prensa y Método. La revisión transversal se hace por página, no mediante un reemplazo masivo de cadenas.

## Etapa 3 — Transporte: vehículos 0 km por tipo y versión

**Estado al 3 de octubre de 2026:** la vista local contiene 36 ofertas por versión de Nissan, Renault y JAC, con fecha, moneda, clase de precio, URL y hashes de las páginas consultadas. Ya filtra por tipo, marca, modelo, versión, año, transmisión, tracción y rango de precio; muestra cobertura por carrocería y seis diferencias entre años modelo de la misma versión, sin presentarlas como inflación. La auditoría y los casos excluidos están en `docs/transport-prices-audit-2026-10-03.md`. Sigue pendiente ampliar marcas con precios públicos inequívocos y registrar motorización, ciudad, concesionario, vigencia y disponibilidad sólo cuando la fuente los identifique. El conjunto actual no permite calcular un índice de precios ni cuotas del sector.

**Avance de integración:** se añadieron al núcleo el paquete `vehicle-prices`, la migración `0099` y la vista `read_models.vehicle_price_offer`. La API del tablero lee esa vista cuando está disponible; en entornos aún sin la migración usa la captura fechada y lo indica en la página. Falta ejecutar la migración y la carga en el destino de prueba y verificar que la API responda `catalogOrigin: core`. La ampliación de marcas y los campos que las páginas no publican siguen pendientes.

**Datos:** crear en el núcleo un catálogo de ofertas observadas y una vista de lectura. Cada observación lleva `tipo`, `marca`, `modelo`, `versión`, `año-modelo`, `motorización`, `tracción` si consta, `ciudad` si aplica, `concesionario`, `precio`, `moneda`, `clase de precio` (lista, «desde» o promoción), `fecha de captura`, `vigencia` si se publica, URL original y estado de disponibilidad. Una cotización sin precio público no se inventa.

- [ ] Definir taxonomía estable de tipo de vehículo: urbano/hatchback, sedán, SUV/vagoneta, camioneta/pickup, utilitario/van y otras clases presentes en el catálogo. Separar tipo de carrocería de tamaño comercial y de motorización; conservar ambos cuando existan.
- [ ] Levantar precios públicos de distintos concesionarios oficiales, priorizando páginas con versión y monto verificables. Comparar la cobertura con el monitoreo de AEMP; usar este último para contexto histórico, nunca como precio actual de una versión. Guardar una captura o hash y fecha para cada observación.
- [ ] Validar duplicados, promociones vencidas, montos contradictorios y moneda ambigua. Cuando el mismo sitio publique dos precios para el mismo modelo sin versión o vigencia que los distinga, no elegir uno arbitrariamente: marcar el caso para revisión y no incluirlo en resúmenes.
- [ ] Añadir subpestaña «Vehículos 0 km» a `src/components/transport-section.tsx`, con API y explorador propios. Usar riel cruzado **tipo → marca → modelo → versión**, más motorización, ciudad y rango de precio donde haya cobertura. Tabla final por versión con precio y fecha; comparación sólo entre ofertas compatibles. Sin una portada «Panorama» que oculte el desglose.
- [ ] En Método, documentar universo observado, definición de tipo, precio de lista frente a promoción, monedas y frecuencia de actualización. Probar que el filtro de tipo cambia los modelos y la tabla, que una versión sin precio no aparece como cero y que dos monedas no se ordenan en una escala común sin conversión explícita.

**Investigación inicial:** [AEMP, monitoreo enero de 2023 a junio de 2024](https://www.autoridadempresas.gob.bo/wp-content/uploads/2024/competencia/Monitoreo%20precios/Veh%C3%ADculos%20Automotores%20en%20Bolivia%20-%20ene2023-jun2024.pdf) clasifica empresas y carrocerías; [Nissan Bolivia](https://www.nissan.com.bo/vehiculos/nuevos-vehiculos/kicks-play.html) publica versiones y precios; [Kia Bolivia](https://www.kia.com.bo/) publica precios «desde», pero su misma página contiene valores repetidos y discrepantes, por lo que exige control de calidad. Ampliar a los importadores del listado de AEMP sólo cuando exista precio público comprobable.

## Etapa 4 — Transporte: historia de carburantes

**Dato base:** precio final al consumidor con vigencia, producto exacto, unidad y régimen (mercado interno o precio internacional aplicable). Una observación normativa sólo permanece vigente hasta la siguiente resolución demostrada; «sin dato» no es cero.

- [ ] Inventariar todas las variedades de ANH desde 2010, incluidos cambios de nombre y presentaciones, gasolina, diésel, GNV, GLP, biocombustibles y combustibles de aviación donde exista precio final verificable. Registrar unidades originales: Bs/l, Bs/m³, Bs/kg o Bs/garrafa según corresponda.
- [ ] Extraer y validar la historia interna. La ANH muestra parte del mercado interno en imágenes: usar resolución/anuario como respaldo y doble verificación de la transcripción; guardar la imagen o PDF y la tabla reconstruida. Las tablas internacionales de la misma web forman una serie **separada**.
- [ ] Crear un modelo de tramos de vigencia y una tabla de cambios. El gráfico de precios regulados usa escalones, no interpolación. Permitir filtros por variedad, régimen, periodo y unidad; los productos de unidades distintas no comparten eje de nivel.
- [ ] Poner en Método las reglas de vigencia, equivalencias de nombres y lagunas históricas. Verificar fechas de quiebre, cifras duplicadas, cambios de unidad y ausencia de «meses estimados».

**Investigación inicial:** [ANH, precios finales e historial por año](https://www.anh.gob.bo/w2019/contenido.php?s=13) ofrece 2010–2026 y separa mercado interno e internacional; la [página 2026](https://www.anh.gob.bo/w2019/contenido.php?Y=2026&s=13) incluye nuevas variedades y algunas celdas sin precio. Las resoluciones de ANH sirven para fijar el inicio de vigencia cuando la página anual sólo dice «a partir de su publicación».

## Etapa 5 — Transporte: pasajes por medio, ruta y vigencia

**Dato base:** guardar mínimo y máximo regulado, monto publicado por operador si existe y monto efectivamente pagado sólo si hay fuente propia que lo mida. Cada uno es una métrica distinta. La ruta es direccional cuando el tarifario la distingue.

- [ ] Reunir tarifarios de ATT para autobús interdepartamental, aviación doméstica y ferrocarril; examinar resoluciones y anexos para historia y vigencia. Para transporte urbano, añadir sólo ciudades cuyo municipio publique un tarifario verificable; no extrapolar de La Paz a Bolivia.
- [ ] Modelar `medio`, `ruta_origen`, `ruta_destino`, `clase/servicio`, `operador` si aplica, `tipo_tarifa`, `mínimo`, `máximo`, `moneda`, `fecha_inicio`, `fecha_fin` y documento de respaldo. Mantener DUA y otros cargos separados cuando el cuadro los separa.
- [ ] Crear «Pasajes» como subpestaña de Transporte con filtros por medio → ruta → clase/operador → vigencia. Mostrar banda regulada y, cuando exista, oferta observada con rótulos inequívocos. Vista histórica por escalones para tarifas regulatorias; tabla de rutas para comparar destinos de la misma modalidad.
- [ ] En Método, explicar cobertura territorial, diferencia entre máximo y precio cobrado, vigencias transitorias y costo total del billete. Probar una ruta terrestre, una aérea y una ferroviaria, además de la retirada de una tarifa vencida.

**Investigación inicial:** [ATT, banda terrestre por ruta](https://tarifas.att.gob.bo/index.php/tarifaspizarra/tarifasRutasDepartamentalesTerrestre), [ATT, máximos aéreos y DUA](https://tarifas.att.gob.bo/index.php/tarifaspizarra/tarifasRutasDepartamentalesAereo), [resolución terrestre transitoria 2025/2026](https://www.att.gob.bo/en/resolucion-administrativa-regulatoria-att-dj-rar-tr-lp-322025) y [resolución ferroviaria](https://www.att.gob.bo/en/resolucion-administrativa-regulatoria-att-dj-rar-tr-lp-252025-de-3-de-septiembre-de-2025). La ATT publica bandas o máximos: no describirlos como precio pagado.

## Etapa 6 — Integración y cierre

- [ ] Añadir las tres subpestañas nuevas sin romper los enlaces existentes de Carreteras, Ferrocarriles y Ríos y puertos. Conservar el patrón visual y de carga al abrir de `TransportSection`.
- [ ] Extender Método para que cada familia nueva tenga institución, URL, fecha de captura/actualización, cobertura, unidad, tratamiento de faltantes y limitaciones. Quitar listados de fuentes de los paneles de datos una vez estén aquí.
- [ ] Ejecutar pruebas de parseo de fuentes, filtros, vigencias y reglas de comparación; `npm run typecheck`, `npm run build` y navegación real de todas las pestañas en ancho de escritorio y móvil. Revisar textos contra datos visibles, no sólo compilación.
- [ ] Cerrar con matriz de cobertura: fuentes consultadas, marcas y versiones efectivamente publicables, años/variedades de ANH, medios/rutas de ATT, pestañas revisadas y vacíos que permanezcan. Desplegar a `test.datosbolivia.com` únicamente cuando haya procedimiento y autorización de despliegue identificados.

## Riesgos de revisión

1. Precio «desde» de auto sin versión identificable: excluir de comparación por versión o rotularlo sólo como mínimo anunciado del modelo.
2. Precio viejo todavía indexado por buscadores: prevalece la página vigente capturada; fecha y cambio documentados.
3. ANH usa imágenes y celdas vacías: transcripción auditada; ausencia no se interpola.
4. Resolución de pasajes con plazo transitorio: cerrar la vigencia y buscar acto posterior antes de llamarla actual.
5. Comparaciones entre unidades, monedas o clases de tarifa: exigir recorte homogéneo o separarlas visualmente.
