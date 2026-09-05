# Observatorio económico de Bolivia — tablero

Seguimiento diario del **tipo de cambio oficial**, el **dólar paralelo** y la **brecha cambiaria**,
pensado para lectura analítica: cada cifra indica su unidad, cómo fue medida y de qué fuente sale.

Las series diarias, la mediana entre plazas, la variación diaria y la brecha las publica el núcleo
del observatorio (`read_models`); el tablero las lee, no las recalcula, de modo que dos lectores no
pueden discrepar sobre cuál fue el paralelo de un día. Lo poco que sí deriva —el punto medio de los
dos lados publicados y la variación del periodo— queda dicho donde aparece.

## Qué muestra

- **Cifras del día**: tipo de cambio oficial, punto medio del paralelo, brecha cambiaria y su
  máximo del periodo, y UFV.
- **Evolución del tipo de cambio** desde el inicio de la serie. El eje no arranca en cero: en una
  cotización, la escala completa aplanaría movimientos que son grandes en términos económicos.
- **Brecha cambiaria** en porcentaje sobre el oficial, con la paridad como referencia.
- **Dispersión entre plazas**: diferencia entre la cotización más alta y la más baja del mismo día.
  Un diferencial que se abre señala un mercado menos líquido o más fragmentado.
- **Serie en crudo** de los últimos días y descarga completa en CSV (`/api/series.csv`).
- **Fuentes** de cada indicador, con la URL de la que se obtuvo cada lectura.
- **Contexto macroeconómico**: series anuales (inflación, PIB, reservas, cuenta corriente, deuda
  externa, desempleo, tasa activa) que permiten distinguir si una brecha que se abre es un mercado
  moviéndose o una economía bajo tensión.
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

## Despliegue

El tablero corre como contenedor en **Coolify**, en el servidor `pablo-h310`, junto a la API del
observatorio y a la base que ambos leen.

```
push a dev  ->  GitHub Actions  ->  tailnet  ->  Coolify  ->  docker compose  ->  contenedor
```

**Auto deploy.** `.github/workflows/deploy.yml` se dispara con cada push a `dev`. Coolify no está
publicado en internet, así que el runner entra a la tailnet con
`PABLO_H310_TAILSCALE_AUTHKEY` y llama al webhook del recurso por la dirección privada del servidor
(`PABLO_H310_COOLIFY_WEBHOOK`, `PABLO_H310_COOLIFY_TOKEN`). La red es la frontera: el panel de
administración de Coolify nunca escucha fuera de ella.

**Imagen.** `Dockerfile` compila el bundle `standalone` de Next y lo sirve con `node server.js`
como usuario sin privilegios. `docker-compose.coolify.yml` describe el servicio: sistema de archivos
de solo lectura, sin capacidades, sin privilegios nuevos, y en la red `coolify` —que es donde el
hostname interno de la base resuelve—. En la UI del recurso hay que dejar activado **Connect To
Predefined Network** y definir `DASHBOARD_DATABASE_URL`; esa credencial vive solo ahí y **nunca se
versiona**.

**URL pública.** El servidor no tiene puertos abiertos hacia afuera y su IP doméstica cambia, así
que la publicación va por Tailscale Funnel: `infra/tailscale-funnel.sh`, que se corre **una vez** en
el servidor y deja el tablero en `https://pablo-h310.taila8f993.ts.net`. La configuración queda en
el estado de `tailscaled` y sobrevive a reinicios, así que ningún despliegue posterior la repite.
La API vecina **no** se publica por ahí: hoy corre con la autenticación desactivada.

`render.yaml` queda en el repositorio para el despliegue anterior en Render, que lee la base de Neon.

## Ramas

- `dev` — la rama que Coolify despliega. Un push aquí actualiza el tablero en producción.
- `main` — integración estable; no dispara ningún despliegue.

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

Diario: tipo de cambio oficial, dólar paralelo y UFV. Anual: once series macroeconómicas
(2000-2025). Bonos soberanos y noticias empresariales están contemplados en el núcleo pero aún no
producen mediciones estructuradas.

Las frecuencias no se mezclan: una cifra anual y un precio cotizado a diario viven en modelos de
lectura distintos, de modo que ningún gráfico puede ponerlas en el mismo eje ni promediarlas.

Ambas series tienen histórico desde el 1 de enero de 2026, así que la brecha se grafica sobre el año
completo. Si en algún momento un día no tuviera ambas cotizaciones, el tablero lo dice en lugar de
trazar una línea sobre un único punto.
