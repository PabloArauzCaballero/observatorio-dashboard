# Observatorio económico de Bolivia — tablero

Seguimiento diario del **tipo de cambio oficial**, el **dólar paralelo** y la **brecha cambiaria**,
pensado para lectura analítica: cada cifra indica su unidad, cómo fue medida y de qué fuente sale.

El tablero no calcula indicadores. Lee los modelos de lectura que publica el núcleo del
observatorio (`read_models`), de modo que la mediana entre plazas, la variación diaria y la brecha
son las mismas que ve cualquier otro consumidor de esos datos. Dos lectores no pueden discrepar
sobre cuál fue el paralelo de un día.

## Qué muestra

- **Cifras del día**: oficial (TCO), paralelo compra y venta, brecha cambiaria y UFV, con la
  variación respecto al día anterior.
- **Evolución del tipo de cambio** desde el inicio de la serie. El eje no arranca en cero: en una
  cotización, la escala completa aplanaría movimientos que son grandes en términos económicos.
- **Brecha cambiaria** en porcentaje sobre el oficial, con la paridad como referencia.
- **Dispersión entre plazas**: diferencia entre la cotización más alta y la más baja del mismo día.
  Un diferencial que se abre señala un mercado menos líquido o más fragmentado.
- **Serie en crudo** de los últimos días y descarga completa en CSV (`/api/series.csv`).
- **Fuentes** de cada indicador, con la URL de la que se obtuvo cada lectura.
- **Notas metodológicas**.

## Cuestiones metodológicas que el tablero hace explícitas

**Los dos lados del paralelo no son una horquilla compra/venta.** La fuente publica dos valores
diarios bajo las etiquetas `buy` y `sell`, y **su orden se invierte a mitad de la serie**: `buy` es
mayor durante los primeros 119 días y menor durante los 116 siguientes. Una horquilla de compra y
venta no puede intercambiarse, de modo que esas etiquetas no corresponden a la convención boliviana.
El informe no las traduce, encabeza con el **punto medio** —que no depende de esa distinción— y mide
la brecha contra él. La fecha exacta de la inversión se calcula del propio dato y se muestra en las
notas, no se codifica a mano.

En el tipo de cambio oficial, en cambio, el lado `sell` es mayor o igual al `buy` en toda la serie,
como corresponde a una cotización administrada.

**Mediana discreta, no promedio.** Cuando varias plazas cotizan el mismo día, el valor publicado es
la mediana discreta: resiste que una plaza se desvíe y devuelve un precio efectivamente cotizado,
no un valor intermedio que nadie ofreció.

**Promedio diario frente a lectura puntual.** La serie anterior al inicio de la recolección diaria
es un promedio diario de las cotizaciones intradía; desde que el recolector opera, cada lectura es
el precio en el momento de la consulta. Son estadísticos distintos y el tablero **no los promedia
entre sí**: cuando un día tiene ambos prevalece el observado, la tabla lo indica y el CSV lo trae en
su propia columna.

**Trazabilidad, y dónde tiene un límite.** Ninguna cifra se publica sin evidencia: cada lectura cita
su fuente y conserva el hash del documento del que se obtuvo. En la serie histórica del oficial la
cita es el fragmento literal del que se leyó cada valor. En la del paralelo, cargada antes de esa
mejora, la cita es una reformulación de los valores y no un extracto literal: sigue siendo trazable
hasta el documento y su hash, pero no al nivel de la cita. El informe lo dice en lugar de
reescribirlo, porque la evidencia es inmutable.

**La variación del periodo se mide sobre un solo estadístico.** Comparar un día promediado con un
precio leído en un instante sería justo el empalme que el resto del informe evita, así que la
variación se calcula únicamente sobre el tramo de archivo y declara sus fechas.

**Los errores no se muestran.** Si la base no responde, la página dice que no pudo leerla y no
muestra ninguna cifra. El detalle queda en el registro del servidor: un mensaje de conexión puede
contener el host, el usuario y el puerto.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local        # y completa DASHBOARD_DATABASE_URL
npm run dev
```

`DASHBOARD_DATABASE_URL` debe apuntar al endpoint que **contiene los datos**. Basta con permisos de
lectura: el tablero solo consulta `read_models`.

```bash
npm run build      # compilación de producción
npm run typecheck  # tipos
npm run start      # servir la compilación
```

## Despliegue en Render

El repositorio incluye `render.yaml`. Al crear el servicio desde el blueprint, Render pide
`DASHBOARD_DATABASE_URL`: ese valor vive solo en el panel y **nunca se versiona**.

Las páginas se sirven bajo demanda (`force-dynamic`): un tipo de cambio cacheado sería un tipo de
cambio que ya no está en vigor.

## Ramas

- `main` — lo que se despliega.
- `dev` — integración de cambios antes de pasarlos a `main`.

## Estructura

```
src/app/page.tsx              El informe
src/app/api/series.csv/       Descarga de la serie completa
src/components/charts.tsx     Gráficos (cliente)
src/lib/db.ts                 Conexión de solo lectura, marcada server-only
src/lib/series.ts             Consultas a read_models y armado de series
```

`src/lib/db.ts` importa `server-only` a propósito: cualquier importación accidental desde un
componente de cliente falla en compilación en lugar de enviar una cadena de conexión al navegador.

## Cobertura actual

Tipo de cambio oficial, dólar paralelo y UFV. Bonos soberanos, agregados macroeconómicos y noticias
empresariales están contemplados en el núcleo pero aún no producen mediciones estructuradas, así
que no aparecen aquí.

La serie histórica cargada es la del paralelo. Mientras el tipo de cambio oficial no tenga histórico,
la brecha solo puede calcularse en los días con ambas cotizaciones y el tablero lo dice en lugar de
trazar una línea sobre un único punto.
