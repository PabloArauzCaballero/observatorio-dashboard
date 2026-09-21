---
name: analisis-macro-cambiario
description: Use al analizar, graficar o redactar sobre el tipo de cambio boliviano, la brecha cambiaria, la inflación o las stablecoins en bolivianos — y antes de añadir cualquier estadística nueva a la sección de tipo de cambio.
---

# Leer el tipo de cambio boliviano como macroeconomía

Una moneda administrada no es un activo que cotiza. Las medidas con las que se describe una
acción —volatilidad anualizada, asimetría, curtosis, VaR— aplicadas a un tipo de cambio fijo
producen cifras correctas que no responden ninguna pregunta económica. Esta skill fija qué se
mide, en qué orden y con qué advertencias.

## Las cuatro preguntas, en este orden

1. **¿Está escaso el dólar?** → brecha cambiaria, siempre contra su propio máximo del periodo,
   nunca sola. Contar las jornadas con brecha negativa: un oficial por encima del mercado es la
   señal de que la corrección se pasó de largo.
2. **¿Qué régimen es este?** → `detectRegimes` en `src/lib/fx-macro.ts`. Se clasifica cada día
   por si la tasa se movió **en la ventana de 30 días anterior**, no por si se movió esa mañana:
   una tasa administrada se queda quieta los fines de semana y la versión día a día parte el
   tramo en decenas de rachas de un día.
3. **¿Está el dólar caro o barato de verdad?** → nivel real, deflactado por la UFV, base 100.
   Esta es la pregunta que el gráfico nominal no puede contestar y en esta serie **invierte** la
   impresión que da: a septiembre de 2026 el paralelo estaba 17 % más alto en bolivianos y 12 %
   más barato en poder de compra.
4. **¿A qué velocidad corren los precios?** → variación interanual de la UFV, anualizada.

## La UFV es el instrumento, y por eso

Es la unidad a la que se indexan contratos y crédito, el Banco Central la calcula del IPC y la
publica **todos los días** desde el 7 de diciembre de 2001, cuando valía exactamente 1. Son más
de 9.000 lecturas diarias. Eso la convierte en un índice de precios de frecuencia diaria:

- deflactar una serie diaria por ella da un **tipo de cambio real diario**;
- su propia variación es **inflación diaria**.

La serie anual del compilador multilateral no puede hacer ninguna de las dos: llega una vez al
año y con retraso. Cuando alguien pida «inflación» en este informe, la respuesta corta es la UFV.

Dos cosas de la UFV que no son defectos y hay que respetar al programar: **baja en deflación** y
**se publica unos quince días por delante de hoy**. Por eso se alinea con relleno hacia adelante
(`alignIndex`) y nunca por interpolación, que inventaría un índice de precios.

## Reglas que no se negocian

- **Nada que cruce un cambio de régimen se promedia.** Una volatilidad sobre toda la historia
  mezcla 706 días de tasa fija con el tramo en movimiento y describe un promedio que no existió.
  Si una estadística no separa regímenes, va detrás de un control con la advertencia escrita.
- **Índices en base 100, y dicho que no se comparan entre sí.** El real del oficial y el real del
  paralelo miden cada uno contra su propio arranque; poner «119,5» al lado de «87,8» sin
  advertirlo invita a leer que el oficial está más alto que el paralelo, que es falso.
- **Mediana discreta, nunca promedio**, para cualquier figura entre plazas o dentro de un libro
  de órdenes: devuelve un precio que alguien cotizó. Y se toma **dos veces** —primero por plaza,
  luego entre plazas— para que una plaza que cotiza tres veces al día no pese el triple.
- **El punto medio resiste, los lados no.** La fuente histórica del paralelo publica `buy` y
  `sell` cuyo orden se invierte a mitad de la serie, así que esos rótulos no llevan la convención
  boliviana. Agrupar siempre sobre el punto medio; publicar lados solo desde fuentes que los
  resuelven contra el campo propio del aviso, y marcarlo (`sides_resolved`).
- **Una prima de «comprar» se mide sobre el lado de venta**, no sobre el punto medio. Un riel
  puede estar en el medio del mercado y ser el caro para comprar: en la lectura del 21-09-2026 la
  prima del USDC era 0,29 % sobre el medio y 1,16 % sobre lo que se paga.
- **Ninguna frase se redacta a mano.** Las conclusiones salen de `fxSnapshot` en
  `src/lib/fx-snapshot.ts`, derivadas de las mismas series que se grafican. Una prosa escrita a
  mano se queda vieja en cuanto el dato se mueve; una generada por un modelo habría que revisarla
  antes de creerla.
- **Nunca prometer historia que no existe.** Las series por moneda (USDT, USDC) empiezan cuando
  el colector empezó a nombrar el instrumento; la carga histórica no registró `instrument`. Solo
  `FX_PARALLEL_USD_BOB` llega hasta julio de 2024.

## Las pruebas formales, y qué ventana usa cada una

Las cuatro preguntas de arriba se someten a prueba en `src/lib/fx-econometrics.ts`, y cada
prueba lleva su ventana escrita. La regla es la misma de siempre: nada que cruce el cambio de
régimen se agrupa, salvo la prueba que mide ese cambio.

| Pregunta | Prueba | Ventana |
| --- | --- | --- |
| ¿El paralelo revierte o acumula? | Dickey–Fuller aumentado (rezagos por Schwarz, críticos de MacKinnon al tamaño de muestra) sobre el log del nivel, la variación diaria y el índice real | toda la serie |
| ¿La brecha se cierra sola? | AR(1) con vida media `ln 0,5 / ln ρ`, más ADF de la brecha | toda la serie **y** el tramo en movimiento, por separado |
| ¿Quién sigue a quién? | Engle–Granger (críticos para dos variables) y modelo de corrección de errores en las dos ecuaciones; causalidad de Granger en los dos sentidos | solo el tramo en que el oficial se mueve |
| ¿Dónde se quiebra? | Quandt–Andrews sobre las variaciones diarias (recorte 15 %, críticos de Andrews 2003), Chow y razón de varianzas en la fecha del cambio de régimen | toda la serie, porque la prueba es sobre el cambio |
| ¿La volatilidad viene en rachas? | ARCH-LM, Ljung–Box y GARCH(1,1) por máxima verosimilitud, con la lectura RiskMetrics al lado | variaciones del paralelo, toda la serie, y se dice si la persistencia toca la unidad |
| ¿Cuánto llega a los precios? | inflación mensual UFV sobre depreciación mensual del paralelo y tres rezagos, coeficiente acumulado con su error estándar | los meses que tiene la serie del paralelo, que son pocos y se dice |

Lo que salió en septiembre de 2026 y no hay que volver a descubrir: el paralelo es un camino
aleatorio; la brecha no revertía con el oficial fijo (ρ ≈ 0,998) y desde que se mueve revierte
en unos seis días; oficial y paralelo cointegran desde el 27-06-2026 y es **el oficial el que
corrige** (λ ≈ −0,18, vida media 3,5 días); el quiebre de la media de los retornos cae en el
máximo de la brecha (17-05-2025), no en la fecha en que el oficial se soltó, donde lo que cambia
es la varianza; el GARCH sale integrado (persistencia ≈ 1) porque la muestra junta dos regímenes,
y por eso el nivel de largo plazo se retiene; y el traspaso a precios sale **negativo**, porque
la brecha se cerró mientras la inflación subía. Ese último signo no es un error: es la serie.

Las frases salen de `src/lib/fx-econometrics-reading.ts`, derivadas del mismo objeto que se
tabula. Cada una dice qué se rechaza y a qué nivel; ninguna dice por qué ni qué va a pasar.

## Dónde vive cada cosa

- `src/lib/fx-macro.ts` — aritmética pura: `alignIndex`, `realIndex`, `impliedInflation`,
  `detectRegimes`, `gapProfile`.
- `src/lib/fx-snapshot.ts` — el resumen y las frases. Cambiar el texto aquí, nunca en el JSX.
- `src/lib/fx-reader.ts` — `readFxSnapshot()`, una sola lectura para el tablero, la portada y el PDF.
- `src/lib/stats-distributions.ts` — mínimos cuadrados, las distribuciones χ², F y t, y Nelder–Mead.
  No sabe qué es un tipo de cambio.
- `src/lib/fx-econometrics.ts` — las pruebas; `src/lib/fx-econometrics-reading.ts` — sus frases.
- `src/components/fx-macro-panels.tsx` — conclusiones y gráficos macro.
- `src/components/fx-explorer.tsx` — nivel, velas y la estadística técnica plegada.
- `src/components/fx-econometrics-section.tsx` — lee las series y monta el panel de pruebas
  (`fx-econometrics-panel.tsx`); se monta desde `page.tsx`, después de `FxSection`.
- `src/components/derived-reading.tsx` — la lista de frases derivadas, compartida con los capítulos
  de energía e instituciones.

## Antes de tocar un color

Los tokens `--series-*` están validados con el comprobador de la skill `dataviz`; solo las tres
primeras casillas pasan la prueba por pares. Reusar `--official`, `--parallel` y `--gap` en vez de
inventar un tono nuevo.

## Límites

Esta skill dice qué medir y cómo, no qué concluir sobre política económica. El informe declara
nivel, referencia y régimen; no dice por qué pasó ni qué va a pasar. Ninguna cifra se publica sin
que su fuente se pueda volver a abrir.
