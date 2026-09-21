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

## Dónde vive cada cosa

- `src/lib/fx-macro.ts` — aritmética pura: `alignIndex`, `realIndex`, `impliedInflation`,
  `detectRegimes`, `gapProfile`.
- `src/lib/fx-snapshot.ts` — el resumen y las frases. Cambiar el texto aquí, nunca en el JSX.
- `src/lib/fx-reader.ts` — `readFxSnapshot()`, una sola lectura para el tablero, la portada y el PDF.
- `src/components/fx-macro-panels.tsx` — conclusiones y gráficos macro.
- `src/components/fx-explorer.tsx` — nivel, velas y la estadística técnica plegada.

## Antes de tocar un color

Los tokens `--series-*` están validados con el comprobador de la skill `dataviz`; solo las tres
primeras casillas pasan la prueba por pares. Reusar `--official`, `--parallel` y `--gap` en vez de
inventar un tono nuevo.

## Límites

Esta skill dice qué medir y cómo, no qué concluir sobre política económica. El informe declara
nivel, referencia y régimen; no dice por qué pasó ni qué va a pasar. Ninguna cifra se publica sin
que su fuente se pueda volver a abrir.
