# Plan de correcciones e investigación: mercado automotor boliviano

**Fecha de corte del plan:** 4 de octubre de 2026. **Audiencia:** propietario, importador o concesionario que decide portafolio, precio, inventario y red comercial. **Alcance inicial:** vehículos nuevos de pasajeros y utilitarios livianos en Bolivia. Usados, buses, camiones y repuestos se estudian como mercados relacionados, con métricas separadas.

## 1. Diagnóstico verificable

El tablero actual contiene 36 precios anunciados de 14 modelos en 14 páginas fuente, todos capturados el 3 de octubre de 2026: Nissan 31, Renault 4 y JAC 1. No registra concesionario, ciudad ni motorización por oferta. Por ello, el recuento de ofertas **no mide ventas, cuota de mercado ni cobertura nacional**. La comparación actual entre años modelo de una misma versión describe dos anuncios simultáneos; tampoco es una serie de inflación.

La [auditoría de precios existente](transport-prices-audit-2026-10-03.md) documenta precios contradictorios dentro de Renault, importes «desde» sin versión identificada en otras marcas y disponibilidad no verificada. La [AEMP](https://www.autoridadempresas.gob.bo/wp-content/uploads/2024/competencia/Monitoreo%20precios/Veh%C3%ADculos%20Automotores%20en%20Bolivia%20-%20ene2023-jun2024.pdf) ofrece una lista histórica de empresas y marcas para iniciar la búsqueda, pero su ventana enero de 2023 a junio de 2024 no sirve como mapa vigente ni como precio actual.

**Decisiones que debe responder el estudio:** en qué segmentos y ciudades competir, contra qué oferta concreta, a qué precio efectivo, con qué capital y riesgo de inventario, y qué ventajas sostener mediante entrega, financiación, garantía y posventa.

## 2. Correcciones prioritarias

| Prioridad | Corrección | Entregable y criterio de cierre |
| --- | --- | --- |
| P0 | Rotular los recuentos como **ofertas observadas** y mostrar cobertura por marca, ciudad y fuente junto a cada conclusión. | Ninguna tarjeta ni texto atribuye cuota, ventas o liderazgo al conjunto de 36 anuncios. |
| P0 | Separar precio de lista al contado, promoción, bono condicionado a crédito, reserva y cotización individual. Conservar inicio y fin de vigencia. | Cada precio muestra condiciones, moneda, impuestos declarados, fecha y URL; una oferta vencida deja de figurar como vigente. |
| P0 | Identificar representante, grupo importador, concesionario y sucursal por separado; registrar quién publica y quién vende. | La matriz competitiva muestra fuente y nivel de identidad. La ausencia queda como «no informado», nunca como concesionario inexistente. |
| P0 | Resolver o excluir discrepancias del mismo vendedor/modelo/versión, empezando por Renault; no escoger silenciosamente el menor precio. | Registro de conflictos con ambas capturas, decisión y fecha. Sin resolución, precio excluido de comparaciones cuantitativas. |
| P0 | Hacer la siembra de vehículos independiente de la reconstrucción masiva de prensa. | Un despliegue automotor termina con estado de siembra verificable sin bloquear otras consultas del sitio; las vistas de prensa se reconstruyen en trabajo propio y con control de duración. |
| P1 | Ampliar la captura a las redes y marcas principales verificadas hoy, no solo a las que publican tabla de precios. | Inventario de redes consultadas y motivos de inclusión o ausencia; las marcas sin precio público figuran como brecha, sin precio inventado. |
| P1 | Agregar identidad técnica para comparar versiones: generación, código comercial, motor, combustible, transmisión, tracción, carrocería, equipamiento y año modelo. | Cada par nacional o internacional recibe nivel de comparabilidad A/B/C y explicación. |
| P1 | Guardar observaciones históricas y cambios de precio con fuente archivada o hash. | Series temporales usan el **mismo SKU**, vendedor, moneda y clase de precio; cambios de versión no aparecen como inflación. |
| P2 | Añadir costos de uso y posventa por versión o segmento cuando exista dato verificable. | Separar precio de compra de combustible, seguro, mantenimiento, repuestos y depreciación estimada; cada supuesto queda visible. |

## 3. Programa de investigación

### A. Competencia boliviana y oferta real

1. Construir el padrón actual de importadores, representantes, concesionarios y sucursales. Partir del [monitoreo de AEMP](https://www.autoridadempresas.gob.bo/estructura/defensa-de-la-competencia-y-desarrollo/monitoreo-de-precios/) y comprobar cada vínculo en la web oficial de la marca y de la empresa. Priorizar Santa Cruz, La Paz/El Alto y Cochabamba; extender a los demás departamentos donde haya red demostrable.
2. Capturar por versión el precio al contado y cualquier promoción, condiciones de financiación, disponibilidad, plazo de entrega, garantía, servicios incluidos y fuente. Registrar también los modelos sin precio público para medir la cobertura de la investigación.
3. Construir escalones de precio por segmento y motorización, densidad de competidores por ciudad, cobertura de servicio y piezas, y sustitutos relevantes: usados, importación individual y nuevas tecnologías. Tratar anuncios de terceros como una categoría de evidencia distinta a la oferta oficial.

### B. El mismo modelo en otros países

1. Formar una cesta piloto con modelos presentes en Bolivia y en al menos otro mercado oficial: Frontier/Navara, Kicks, Sentra, X-Trail, Kwid, Kardian, Duster y JS4, según disponibilidad real de fichas. Buscar primero Chile, Perú, Colombia, Argentina y Paraguay; escoger el mercado por **coincidencia de versión**, no solo por vecindad.
2. Emparejar **marca + generación + año modelo + motor + combustible + transmisión + tracción + versión/equipamiento**. Nivel A: mismo SKU o ficha técnicamente equivalente; B: misma familia con diferencias documentadas; C: solo nombre de modelo. Solo A admite una brecha de precio directa. B lleva tabla de diferencias; C queda fuera del cálculo.
3. Capturar precio local en moneda original, fecha, impuestos incluidos, condiciones de bono, financiación y vigencia. Ejemplo de riesgo: [Nissan Chile](https://www.nissan.cl/vehiculos/nuevos/x-trail.html) publica importes con bonos y crédito; esa cifra no equivale automáticamente a un precio al contado boliviano. También hay que verificar motor, filas de asientos y tracción antes de llamar «igual» a dos X-Trail.
4. Convertir con la cotización de la fecha y fuente del banco central correspondiente. Mostrar dos lecturas separadas: **precio minorista anunciado comparable** y **escenario de costo puesto en Bolivia**. Este último requiere CIF, clasificación arancelaria, GA, ICE, IVA, gastos y régimen aplicable; no es el margen del concesionario. Para Bolivia, verificar tipo de cambio y reglas aduaneras vigentes en [BCB](https://www.bcb.gob.bo/tiposDeCambioHistorico/pdf.php?anio=2026) y [Aduana](https://www.aduana.gob.bo/rlga_view).
5. Publicar cada par con enlaces a ambas ofertas, ficha de equivalencia, fecha y motivo de inclusión. Si faltan versiones idénticas, informar el vacío sin fabricar una comparación.

### C. Tamaño y evolución del mercado boliviano

1. Separar **parque registrado**, **altas nuevas**, **importaciones**, **ventas de concesionarios** y **precios anunciados**. El [INE explica que el parque proviene del RUAT](https://www.ine.gob.bo/index.php/estadisticas-economicas/transportes/parque-automotor-introduccion/); su [boletín 2025](https://www.ine.gob.bo/index.php/publicaciones/boletin-estadistico-parque-automotor-2025/) es la base anual inicial, no una cifra de ventas de 0 km.
2. Reutilizar y contrastar los datos de [COMEX del INE](https://www.ine.gob.bo/comex/) por partida 8702, 8703 y 8704, país de origen, valor CIF, mes y departamento. Comprobar si hay **unidades** en la fuente accesible; valor y peso no se convertirán a unidades mediante un promedio supuesto. Separar vehículos nuevos/usados y eléctricos/híbridos si la clasificación lo permite.
3. Investigar crédito de consumo/automotor, tasas y condiciones efectivas en fuentes de [ASFI](https://www.asfi.gob.bo/), y cambios de costo por divisas, flete, seguros, combustible y disponibilidad. El crédito de consumo total será solo contexto si no existe desglose automotor.
4. Revisar por fecha y subpartida las normas de importación, homologación, ICE y GA, especialmente híbridos y eléctricos; usar circular y texto normativo de [Aduana](https://www.aduana.gob.bo/NOR_circulares). Etiquetar vigencia y escenario, no aplicar una tasa genérica a todos los vehículos.

### D. Lectura empresarial y escenarios

1. Elaborar una matriz por segmento y ciudad: precio efectivo, rival directo, diferenciación técnica, red de venta, garantía, posventa, disponibilidad y financiación.
2. Calcular, con **supuestos editables**, capital inmovilizado por inventario, costo financiero, tiempo de reposición, margen bruto objetivo y sensibilidad a tipo de cambio/flete/tributos. No presentar utilidades reales de empresas sin sus costos verificados.
3. Entregar escenarios base, presión de divisas y expansión de híbridos/eléctricos, cada uno con señales observables, posibles respuestas comerciales y límites de evidencia.
4. Cerrar con recomendaciones concretas de portafolio, precio, ciudades, inventario y posventa, distinguiendo hecho, estimación e hipótesis.

## 4. Modelo de evidencia e implementación

**Grano de la oferta:** país, ciudad, vendedor, marca, modelo, generación, versión, año modelo, configuración técnica, clase de precio, condiciones, moneda, impuestos declarados, vigencia, instante de captura y URL. Conservar fuente, hash/copia, extractor y estado de verificación. Una tabla de equivalencias enlaza versiones entre países con grado A/B/C y razones; otra guarda series macro con unidad, población y denominador.

En el núcleo, crear catálogos y vistas de lectura independientes para red comercial, ofertas internacionales, equivalencias y métricas de mercado. En el tablero, añadir: (1) mapa competitivo nacional; (2) comparación internacional por versión; (3) evolución de mercado y demanda; (4) escenarios de costo; (5) síntesis ejecutiva. Mantener CSV/JSON y fichas de método. Las gráficas deberán conservar tabla accesible y escala/moneda explícita.

## 5. Secuencia de entrega y controles

1. **Inventario y correcciones P0.** Publicar matriz de cobertura y conflictos; corregir rótulos y separar la siembra pesada. Criterio: sitio sano y ninguna cifra de muestra presentada como mercado.
2. **Red y precios bolivianos.** Verificar identidad de grupos y sucursales, ampliar marcas, capturar condiciones y probar deduplicación. Criterio: toda cifra visible tiene fecha, versión, precio y procedencia; los vacíos se ven.
3. **Piloto internacional.** Investigar primero cinco modelos con candidatos A; documentar también los descartados. Criterio: cero brechas de precio directas para pares B/C o bonos incompatibles.
4. **Mercado y entorno.** Integrar INE/RUAT, COMEX, BCB, ASFI, Aduana y combustible con periodos y definiciones. Criterio: parque, importación y ventas nunca comparten denominador ni título.
5. **Informe ejecutivo y despliegue.** Redactar decisiones, escenarios y riesgos; revisar cálculos contra las filas fuente; probar filtros, descargas y navegación real en Contabo. Criterio: cada afirmación decisiva puede rastrearse a datos y cada limitación material aparece junto al resultado.

**Cadencia propuesta:** captura de precios semanal y tras cambios de campaña; revisión normativa al publicarse nuevas disposiciones; mercado mensual cuando la fuente lo permita y parque anual. Mostrar fecha de última verificación en cada panel. No prometer actualización automática de sitios que bloqueen la extracción o exijan cotización privada.

## 6. Datos que mejorarían el análisis, si el negocio los tiene

Facturas o listas de compra CIF, costos de nacionalización, cotizaciones al contado por concesionario, inventario y días de stock, ventas por modelo y ciudad, costos de garantía/servicio, tasas efectivas de financiación y precios de reventa. Son insumos para estimar rentabilidad y cuota propios; el estudio público funcionará sin ellos, con escenarios y límites explícitos.
