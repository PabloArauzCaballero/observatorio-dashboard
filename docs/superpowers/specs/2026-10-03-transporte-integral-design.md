# Transporte integral de Bolivia — diseño

## Propósito

Convertir la pestaña Transporte en un capítulo económico y operativo completo, no sólo cartográfico. Debe responder cuántos vehículos tiene Bolivia y cómo cambió su composición, cuánto puede costar viajar entre ciudades, qué lugar ocupan buses, microbuses y minibuses, qué se sabe del precio del flete y de dónde sale cada cifra.

## Alcance verificable

La entrega incorpora:

- parque automotor del INE, 2003–2025, por departamento y tipo de servicio;
- parque automotor del INE, 2003–2025, por tipo de servicio y clase de vehículo;
- capacidad de carga del parque por servicio, clase y banda, 2003–2025;
- conversiones a GNV y recalificaciones de cilindros, con las aperturas anuales y trimestrales que contienen los libros oficiales;
- buses, microbuses, minibuses y demás clases como series seleccionables, no como una cifra suelta;
- bandas tarifarias interdepartamentales por ruta y categoría de bus, con el nivel de 2013 y el ajuste publicado en 2025, distinguiendo mínimo de máximo y vigencia normativa;
- flete internacional, aéreo e implícito aduanero mediante la familia ya existente en Variables exógenas, además de referencias fechadas del flete pesado nacional;
- tablas, gráficos, filtros, metodología, enlaces de fuente y descargas CSV/JSON.

No se publican cifras que los archivos oficiales no contienen de forma verificable. Al 3 de octubre de 2026, los libros del INE enlazados para modelo, cilindrada y ocho de nueve aperturas municipales descargan hojas sin celdas de datos. El tablero debe mostrar esos enlaces como cobertura pendiente, no inventar valores ni presentar la imagen decorativa del libro como una tabla.

## Fuentes y significado

1. **INE / RUAT — parque automotor.** La unidad es número de vehículos registrados. Un vehículo se cuenta por departamento de registro, servicio y clase; no equivale a vehículos efectivamente circulando.
2. **INE / entidad competente de GNV.** Conversiones y recalificaciones son eventos del período, no el stock vigente de vehículos a GNV.
3. **ATT — transporte interdepartamental.** Los valores son bandas regulatorias en bolivianos por pasajero y viaje, no precios observados de mercado. `NORMAL`, `SEMICAMA` y `CAMA` se conservan como categorías distintas. Un cero en la tabla de 2025 para semicama o cama se interpreta como categoría no publicada, no como pasaje gratuito.
4. **Fletes.** El flete implícito aduanero es `(CIF - FOB) / peso bruto` e incluye seguro y mezcla de productos; no es una tarifa. Los índices internacionales tampoco son precios en dólares. Las referencias nacionales aisladas conservan ruta, fecha, unidad y fuente y no se unen en una falsa serie.

Cada lectura conserva URL, fecha de recuperación, hash SHA-256 y nombre de tabla o resolución. Las revisiones se agregan; las vistas escogen la lectura más reciente por clave sin borrar evidencia anterior.

## Arquitectura

### Núcleo

El catálogo `bolivia-transport-network` gana un archivo `road-transport.json`. Un recolector reproducible lee los libros XLSX del INE y las tablas tarifarias capturadas de la ATT y genera tres arreglos tipados: `fleetPoints`, `gnvPoints` y `fareBands`.

El cargador reutiliza el módulo profundo `writeTransportRows(...)`: valida una vez, crea artefactos por archivo fuente y escribe observación, afirmación y evidencia. La migración 0098 expone tres modelos estables: `read_models.vehicle_fleet`, `read_models.gnv_activity` y `read_models.intercity_fare_band`.

### Dashboard

El seam público es `readRoadTransport(): Promise<RoadTransportData>`. Oculta las tres consultas y devuelve arreglos vacíos sólo para modelos ausentes o sin permiso, igual que las otras páginas de Transporte. `buildRoadTransportBoard(data)` agrupa series, calcula últimos valores y variaciones y convierte ceros tarifarios no publicados en `null`.

`/api/transporte-terrestre` entrega el tablero al abrir la subpestaña. `RoadTransportExplorer` mantiene filtros de dimensión, territorio, servicio, clase, ruta, categoría y período en el navegador. El exportador usa las mismas filas de lectura, no una copia estática.

La subpestaña `Fletes` pide `/api/exogenas` sólo al abrirse y presenta `ExogenousExplorer` fijado a `FREIGHT`; así reutiliza las series y referencias existentes y evita dos fuentes de verdad.

## Experiencia de uso

Transporte tendrá cinco subpestañas: `Automotor y pasajes`, `Carreteras`, `Ferrocarriles`, `Ríos y puertos` y `Fletes`.

La primera muestra:

- indicadores del último año: parque total, participación pública, buses+microbuses+minibuses y conversiones GNV;
- selector de vista: departamentos y servicio, clase de vehículo, capacidad de carga, GNV o tarifas;
- gráfico histórico con hasta seis series legibles;
- tabla completa filtrable y paginada;
- bloque metodológico que explica registro, evento, banda regulada y ausencias de la fuente;
- enlaces oficiales y descargas.

Las tarifas permiten comparar 2013 con 2025 por ruta y categoría. La interfaz rotula explícitamente la vigencia formal del ajuste transitorio (2 de enero a 30 de junio de 2026) y que la página de Tarifas Online de la ATT seguía publicándolo como tarifario al 3 de octubre de 2026; no lo llama “tarifa vigente” sin ese matiz.

## Errores y degradación

- Si falta la migración o el rol no puede leer un modelo, la página sigue abierta y explica qué conjunto falta.
- Si una familia está vacía, sus otros bloques continúan disponibles.
- Valores no numéricos, negativos o años fuera del rango validado se rechazan antes de sembrar.
- Las categorías tarifarias no ofrecidas son `null`; nunca se grafican como cero.
- La descarga declara fuente y dimensión en cada fila y no recorta silenciosamente.

## Verificación

- pruebas de esquema y de invariantes del snapshot oficial;
- pruebas de la transformación del tablero (agregación, variación, ceros tarifarios, períodos preliminares);
- typecheck, lint, pruebas completas y build en ambos repositorios;
- comprobación visual y responsive con navegador real;
- migración y seed en el entorno de prueba, despliegue de las ramas `test` y verificación HTTP y funcional en `https://test.datosbolivia.com`.

