# Tejido empresarial: directorio, nombres y cierres

## Propósito

La página «Empresas › Tejido empresarial» debe permitir analizar el universo formal de empresas de Bolivia sin confundir tres conjuntos distintos:

1. la base empresarial agregada del SEPREC y del SIIP;
2. los registros nominales que el Observatorio realmente tiene cargados; y
3. el padrón nominal completo que el SEPREC entrega como archivo Excel.

El resultado debe conservar la presentación, los filtros cruzados, las fuentes visibles y las advertencias metodológicas del tablero actual. Una cifra parcial nunca se rotulará como «todas las empresas».

## Resultado para el lector

La cabecera de «Tejido empresarial» mostrará tres accesos claros:

- **Empresas vigentes**, con el stock histórico ya existente.
- **Cierres empresariales**, definidos como cancelaciones de matrícula y separados de la falta de renovación.
- **Directorio de empresas**, con buscador, nube de nombres y descarga en Excel.

Los tres accesos comparten los filtros aplicables de año, departamento, actividad y tipo societario. Cuando una dimensión no exista en una fuente, la interfaz lo dirá en vez de simular el cruce.

## Veracidad y cobertura

### Base agregada

El stock y los flujos provienen de las publicaciones estadísticas del SIIP, FUNDEMPRESA y SEPREC. Esta base permite contar vigentes, inscripciones, renovaciones y cancelaciones, pero no contiene razones sociales individuales.

### Directorio nominal disponible

El repositorio conserva actualmente 8.666 registros nominales procedentes de entregas del SEPREC: 113 del primer lote, 3.707 adicionales y 4.846 establecimientos. Se deduplicarán por identificador registral. La pantalla mostrará el número exacto cargado, la fecha de la entrega y la leyenda «directorio disponible en el Observatorio».

### Padrón nominal completo

El SEPREC ofrece el padrón completo mediante el Trámite 58 y lo entrega en Excel. El importador aceptará ese archivo sin depender del nombre de sus columnas: primero normalizará encabezados conocidos y luego validará los campos obligatorios. El tablero sólo activará la leyenda y el botón «Descargar todas las empresas» cuando la cantidad importada y los metadatos de la entrega acrediten que es el padrón completo.

La publicación o redistribución del archivo completo queda condicionada a los términos de la entrega. Si el archivo puede analizarse pero no redistribuirse, el tablero mostrará los agregados y la nube derivados, pero no servirá el archivo original.

## Descarga en Excel

El botón descargará un archivo `.xlsx`, no una captura de la tabla ni un CSV renombrado. Incluirá:

- una hoja `Empresas` con todas las filas autorizadas;
- una hoja `Metadatos` con fuente, fecha de corte, cobertura, cantidad de filas, licencia o restricción y fecha de generación;
- encabezados congelados, autofiltro y tipos de celda adecuados;
- razón social o nombre, matrícula o identificador público, tipo societario, actividad, departamento, municipio, dirección declarada, estado registral y fecha de corte cuando esos campos existan;
- únicamente información empresarial publicable: no se exportarán teléfonos, correos ni otros datos personales excluidos por los colectores actuales.

La descarga será generada en el servidor para no enviar cientos de miles de filas al navegador. La API aplicará los mismos filtros que se ven en pantalla y tendrá una opción explícita «Todo el directorio». El nombre seguirá el patrón `tejido-empresarial-empresas-AAAA-MM-DD.xlsx`.

## Nube de nombres

La nube se calculará a partir de las razones sociales del recorte nominal activo. Contará palabras completas normalizadas sin acentos y unificará mayúsculas y minúsculas, pero conservará una forma legible para dibujarlas.

Se excluirán:

- formas societarias y variantes: `SA`, `S.A.`, `SRL`, `S.R.L.`, `LTDA`, `UNIPERSONAL`;
- artículos, preposiciones y conectores frecuentes;
- términos que no distinguen empresas, como `EMPRESA`, `COMERCIAL`, `SERVICIOS`, `BOLIVIA` y `NACIONAL`;
- números aislados y palabras de menos de tres letras.

La nube mostrará las 40 palabras más frecuentes. El tamaño dependerá de la frecuencia con una escala acotada para evitar que una palabra tape las demás. Cada palabra tendrá su cantidad accesible y podrá pulsarse para filtrar el directorio. Con menos de diez razones sociales válidas, se mostrará un estado vacío explicativo.

## Cierres empresariales

La medida principal se llamará **Cierres (cancelaciones de matrícula)**. La explicación dejará claro que una cancelación registral puede corresponder a cierre de operaciones, transformación, fusión, fallecimiento u otra causa y que no renovar una matrícula no equivale por sí solo a cerrar.

La serie histórica de FUNDEMPRESA se conservará. Se incorporarán las memorias oficiales del SEPREC para completar 2022 y 2023, con total nacional y los desgloses que cada memoria sostenga. Años o dimensiones no publicados permanecerán como ausentes, nunca como cero. Si se localiza una publicación oficial posterior con la misma definición, se añadirá mediante el mismo colector y sus pruebas de suma.

La vista de cierres incluirá:

- total del último año completo;
- variación respecto del año anterior comparable;
- línea anual;
- barras por departamento, tipo societario o actividad cuando la fuente lo publique;
- descarga de la serie mostrada;
- fuente y fecha de corte junto al gráfico.

## Arquitectura y flujo de datos

### Núcleo de datos (`EcomicDataCenter`)

1. Un lector de directorio normaliza entregas nominales existentes y el Excel completo opcional a una forma común.
2. La semilla conserva procedencia, cobertura y permiso de redistribución junto con cada entrega.
3. Una vista de lectura expone únicamente campos empresariales publicables y metadatos de cobertura.
4. El colector de flujos incorpora las cancelaciones de las memorias 2022 y 2023 y valida los totales contra sus desgloses.

### Tablero (`observatorio-dashboard`)

1. La API de tejido sigue sirviendo rápidamente los agregados para la visualización inicial.
2. Una API paginada sirve el directorio nominal para búsqueda y tabla.
3. Una API de términos devuelve la nube calculada en el servidor sobre el mismo filtro.
4. Una API de exportación genera el `.xlsx` por flujo para que el tamaño del padrón no agote la memoria del proceso.
5. El explorador incorpora los paneles «Directorio y nombres» y «Cierres empresariales» dentro de la experiencia existente.

Las respuestas llevarán la cantidad total, el tipo de cobertura (`PARCIAL` o `COMPLETA`), la fecha de corte y la procedencia. La interfaz tomará sus rótulos de esos metadatos, no de suposiciones en el componente.

## Errores y estados límite

- Sin padrón completo: se ofrece el directorio parcial con su cifra exacta y se desactiva cualquier texto que prometa totalidad.
- Archivo oficial con columnas desconocidas: la carga falla antes de escribir y enumera los encabezados faltantes.
- Duplicados: se concilian por identificador registral; si dos filas incompatibles comparten identificador, la carga falla.
- Restricción de redistribución: no se habilita el Excel público aunque el análisis agregado sí pueda actualizarse.
- Exportación sin filas: responde con un error legible y no crea un libro vacío.
- Cierres sin desglose: el total se conserva y el control de esa dimensión se deshabilita para ese año.
- Fuente inaccesible: el tablero conserva la última entrega válida y muestra su fecha de corte.

## Pruebas y aceptación

El trabajo se considera terminado cuando pruebas automatizadas demuestren que:

1. el importador conserva nombre y campos autorizados, elimina contactos personales y rechaza encabezados o duplicados inválidos;
2. la cobertura sólo es `COMPLETA` con metadatos que la acrediten;
3. la nube unifica variantes, elimina términos vacíos y devuelve frecuencias correctas;
4. pulsar una palabra aplica el mismo filtro a directorio, total y descarga;
5. el libro generado abre como `.xlsx`, contiene las hojas `Empresas` y `Metadatos` y no pierde tildes ni ceros iniciales de matrículas;
6. los cierres de 2022 y 2023 coinciden con los totales oficiales y no convierten faltantes en ceros;
7. los filtros de cierres y del directorio producen el mismo conjunto en pantalla y en la descarga;
8. la suite unitaria, el chequeo de tipos y la compilación del tablero terminan sin errores.

## Fuera de alcance

- Comprar o tramitar el Excel ante el SEPREC en nombre del usuario.
- Extraer masivamente el directorio web saltando el trámite oficial.
- Publicar teléfonos, correos u otros datos personales de empresas unipersonales.
- Interpretar una cancelación de matrícula como quiebra o insolvencia.
