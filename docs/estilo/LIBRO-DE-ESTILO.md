# Libro de estilo de DatosBolivia.com

Cómo se escribe todo lo que lee el público en el tablero: títulos, entradillas, pies de figura,
etiquetas de filtros, avisos, botones, metadatos, el informe en PDF y los archivos que se descargan.

La referencia es la prensa económica seria —*The New York Times*, *Financial Times*, *Yahoo Finance*— y
el informe de un banco central. El lector es un economista, un periodista, un funcionario o un
inversor: tiene poco tiempo, sabe leer una cifra y desconfía de los adjetivos.

> **Una regla resume todas las demás: primero el dato, después el contexto, nunca la opinión.**

---

## 1. La marca

- El producto se llama **DatosBolivia.com** (en una frase corrida, **Datos Bolivia**). Su descriptor
  es **Centro de Datos de Bolivia**.
- «Observatorio Económico de Bolivia» fue el nombre en clave del proyecto: **no aparece en ningún
  texto visible**. Las fórmulas viejas se sustituyen así:

  | Antes | Ahora |
  |---|---|
  | Observatorio Económico de Bolivia | DatosBolivia.com |
  | el Observatorio | DatosBolivia / este sitio |
  | Elaboración propia / Observatorio | Elaboración: DatosBolivia.com |
  | Preguntale al Observatorio | Consultar al asistente de DatosBolivia |

- DatosBolivia es **independiente**: no es el Banco Central, ni el INE, ni un ministerio. Nunca se
  escribe nada que lo sugiera («cifra oficial de DatosBolivia» no existe; existe «cifra oficial del
  BCB, recopilada por DatosBolivia»).

## 2. La voz

1. **Tercera persona e impersonal.** Ni tú, ni vos, ni usted en el análisis: «El paralelo subió»,
   no «Mirá cómo subió el paralelo».
2. **Hechos antes que adjetivos.** Se prohíben los juicios que el dato no demuestra:
   «engañosa», «preocupante», «espectacular», «buena noticia», «feo», «increíble», «dramático».
   Si algo importa, se dice por qué con una cifra.
   - ✗ «La cifra nacional es engañosa y conviene decirlo.»
   - ✓ «El promedio nacional oculta la escasez local: el recurso renovable está casi todo en la
     cuenca amazónica y la extracción se concentra en el altiplano y los valles.»
3. **Frases cortas, verbo activo, una idea por frase.** Si una frase lleva dos punto y coma, son dos
   frases.
4. **Precisión en la causalidad.** «Coincide con» no es «se debe a». Se atribuye causa solo cuando la
   fuente la establece.
5. **Sin interpelar al lector para que haga algo** dentro del análisis. Las instrucciones de uso
   («toca una cinta», «elegí los impuestos», «pasa por encima») salen de la entradilla y van a la
   etiqueta del control, a su `aria-label` o al «Cómo leer» (ⓘ), en forma impersonal:
   «Al pasar el cursor sobre una cinta se muestra el año».
6. **Sin jerga interna.** Nada de nombres de scripts, tablas, códigos de serie, columnas de base de
   datos ni rutas de archivo en el texto público (`aggregate-trade.py`, `M_DETAIL`, `WDI`,
   `TAXTOP`). Si el método importa, se describe: «Las importaciones se agregan por partida y mes;
   el detalle y el total mensual no se suman entre sí».
7. **Sin anglicismos evitables.**

   | No | Sí |
   |---|---|
   | Social Info | Indicadores sociales |
   | dashboard | tablero |
   | ranking (en texto corrido) | clasificación (en títulos de figura se admite «ranking» si es el nombre de la fuente) |
   | live / lives | transmisión en vivo / transmisiones en vivo |
   | score | puntaje |
   | insights | hallazgos |
   | post / posts | publicación / publicaciones |
   | engagement | interacción |
   | top 10 | los diez primeros (en el rótulo del control se admite «Top 10») |
   | proveniencia | procedencia |
   | data | datos |

## 3. Anatomía de una sección (cabecera de pestaña)

Cada sección abre como una nota de portada:

```
ECONOMÍA · TIPO DE CAMBIO                       ← antetítulo (lo pone el componente)
Tipo de cambio                                  ← título: el nombre de la sección
El dólar oficial del Banco Central y el paralelo de los mercados P2P, en bolivianos
y descontada la inflación.                      ← bajada: qué hay y cuánto confiar, 1-2 frases
```

- La **bajada** dice qué contiene la sección y el grado de confianza de sus cifras, en una o dos
  frases y sin adjetivos. No enumera paneles.
- El **antetítulo** se deriva del mapa del sitio (`ECONOMÍA`, `SOCIEDAD`, `TERRITORIO`,
  `INSTITUCIONAL`); no se escribe a mano.

## 4. Anatomía de un panel (figura)

```
Dólar paralelo (Bs por USD)                       ← título: magnitud y unidad
El paralelo cerró septiembre en 9,87 Bs, 42 % por encima del oficial.   ← entradilla: el hallazgo
[ filtros ] [ gráfico ] [ leyenda ]
Fuente: Binance P2P y BCB. Elaboración: DatosBolivia.com · actualizado 14-oct-2026   ← pie
```

1. **Título = magnitud + unidad entre paréntesis.** Nunca una frase evocadora.
   «Generación eléctrica por fuente (% del total)», no «Quién tiene energía». Sin punto final.
   Sin preguntas («¿Qué produce la economía?» → «Peso de cada sector en el PIB (% del PIB)»).
2. **La entradilla es el primer párrafo de una nota**: el hallazgo principal, con cifra y fecha
   cuando el dato lo permite. Una o dos frases, con punto final.
   - Si la cifra cambia cada día y el texto es fijo, la entradilla describe **qué mide** y **cómo
     leerla**, sin inventar un número: «Distancia de cada día al máximo alcanzado hasta esa fecha. Un
     valor de cero indica un nuevo récord».
   - Nunca empieza repitiendo el título.
3. **Pie**: lo pone `Panel` («Fuente: … Elaboración: DatosBolivia.com»). En `source` va solo el
   publicador real de las cifras, con su nombre propio: «Banco Central de Bolivia (BCB)», «Instituto
   Nacional de Estadística (INE)», «Banco Mundial, Indicadores del Desarrollo Mundial». Si el cálculo
   es propio sobre datos de otros: «INE; cálculo de DatosBolivia.com».
4. **Notas** (convención de banco central), en el pie o en el «Cómo leer»:
   `(p)` preliminar · `(e)` estimado · `n.d.` no disponible · `—` sin dato.

## 5. Microtexto de la interfaz

| Elemento | Forma | Ejemplo |
|---|---|---|
| Botón | infinitivo, sin artículo | «Descargar datos», «Ver metodología», «Recargar la página» |
| Etiqueta de filtro | sustantivo | «Impuestos», «Departamento», «Desde», «Hasta» |
| Marcador de búsqueda | infinitivo + objeto | «Buscar empresa» |
| Estado de carga | gerundio, sin «…» repetidos | «Cargando la serie del BCB…» |
| Vacío | qué falta y por qué, sin culpar | «No hay registros para estos filtros.» |
| Error | qué pasó y qué hacer | «No se pudo leer la base. Recargar la página o volver en unos minutos.» |
| Ayuda (ⓘ, `aria-label`) | impersonal | «Al seleccionar un río se aísla en el mapa.» |

- Sin signos de exclamación. Sin emojis. Sin «¡Listo!».
- Los textos de carga no hablan de «armar» ni de cocina interna: «Cargando…», no «Armando el
  resumen».

## 6. Cifras, unidades y fechas

- **Decimales con coma, miles con punto**: 9,87 · 1.250 · 4,2 %. Espacio entre la cifra y `%`.
- **Moneda**: `Bs` y `USD` (nunca `US$`, `$us`, `$` ni «dólares americanos» en títulos).
  En texto corrido: «Bs 9,87», «USD 1.250 millones». En el título de figura: «(Bs por USD)»,
  «(millones de USD)».
- **Magnitudes grandes**: «millones», «miles de millones»; nunca «billones» para 10⁹.
- **Variaciones**: «subió 3,2 %» (relativa) frente a «subió 3,2 puntos porcentuales» (diferencia de
  dos porcentajes). Nunca «subió 3,2 %» para un paso de 10 % a 13,2 %.
- **Fechas**: en prosa, «14 de octubre de 2026»; en pies y tablas, la forma corta que ya usa el
  tablero («14-oct-2026»). Meses en minúscula. Gestiones: «gestión 2025» o «2025».
- **Horas**: «10:32 (hora de Bolivia)».
- **Siglas**: se desarrollan la primera vez en cada sección —«Impuesto Directo a los Hidrocarburos
  (IDH)»—, después solo la sigla. Las de uso general (PIB, BCB, INE, FMI) no se desarrollan en
  títulos. Las siglas no llevan plural con «s» («las AFP», no «las AFPs»).
- **Nombres propios de instituciones** con mayúscula inicial; los cargos en minúscula («el
  presidente del BCB»).

## 7. Mayúsculas y tipografía

- **Mayúscula solo al inicio** de títulos, botones y etiquetas: «Tipo de cambio oficial», no «Tipo De
  Cambio Oficial».
- **Versalitas / mayúsculas espaciadas** solo en el antetítulo de sección y en la barra de
  secciones. Ningún otro rótulo va en MAYÚSCULAS.
- **Comillas latinas** «…» en todo el texto; las inglesas “…” solo dentro de una cita ya entrecomillada.
- **Raya** — para incisos, sin espacio hacia dentro: «El paralelo —la cotización P2P— subió».
- **Cursiva** para títulos de publicaciones (*Financial Times*, *Memoria anual del BCB*).

## 8. Glosario fijo

| Término | Uso |
|---|---|
| dólar oficial | el tipo de cambio que publica el BCB |
| dólar paralelo | la cotización en mercados P2P de criptoactivos estables; **nunca** «dólar blue» |
| brecha cambiaria | diferencia porcentual entre paralelo y oficial |
| USDT, USDC | fichas estables; «fichas», no «tokens», en prosa |
| gestión | año fiscal boliviano |
| UFV | Unidad de Fomento de Vivienda; en la primera mención de cada sección |
| deflactado / en términos reales | descontada la inflación |

## 9. Lista de control antes de dar por bueno un texto

- [ ] ¿Aparece «Observatorio»? → «DatosBolivia.com».
- [ ] ¿Hay tú, vos o usted en el análisis? → impersonal.
- [ ] ¿Hay un adjetivo de juicio sin cifra que lo respalde? → fuera.
- [ ] ¿El título del panel lleva la unidad entre paréntesis?
- [ ] ¿La entradilla dice el hallazgo (o qué mide y cómo leerlo, si la cifra es variable)?
- [ ] ¿Hay jerga interna (scripts, códigos, columnas)? → describirla o quitarla.
- [ ] ¿Anglicismos de la tabla del §2? → sustituidos.
- [ ] ¿Monedas en `Bs` / `USD`? ¿Decimales con coma?
- [ ] ¿Siglas desarrolladas la primera vez?
- [ ] ¿Las instrucciones de uso salieron del análisis?

## 10. Lo que NO se cambia al corregir textos

- Los **cálculos**, las cifras que imprime el código y la lógica de los componentes.
- Los **rótulos de sección** del mapa del sitio (son la dirección `?pestana=`). Un rótulo de **página**
  que cambie se añade como alias en `PAGINAS_FUSIONADAS` de `src/lib/site-map.ts` para que los
  enlaces viejos sigan funcionando.
- Las claves (`id`), los nombres de archivo de descarga y los nombres de columnas de CSV.
- Los nombres propios de las fuentes y los nombres oficiales de impuestos, normas y entidades.
