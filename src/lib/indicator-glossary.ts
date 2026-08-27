/**
 * What each indicator actually measures, in the words an economist would use
 * with someone who is not one.
 *
 * A report that shows «PIB per cápita 3,14» and nothing else assumes the reader
 * already knows what the number is, which of the several things called "PIB" it
 * is, and what would count as good or bad. Most readers of a Bolivian
 * observatory are not macroeconomists; the ones who are still want to know
 * whether a figure is at constant or current prices before they quote it.
 *
 * Each entry says three things and no more: **what** it counts, **how to read
 * it** — the trap, the unit, the thing people get wrong — and, where it
 * matters, what it does *not* include. Nothing here is an opinion about
 * Bolivia; that belongs to whoever uses the report, not to the report.
 *
 * An indicator with no entry shows its publisher's own name and nothing
 * invented. A definition written to fill a gap is worse than an admitted gap.
 */

export interface Definition {
  /** What the figure counts, in one sentence. */
  what: string;
  /** How to read it: the unit, the trap, the comparison that makes it mean something. */
  howToRead: string;
  /** What it leaves out, when leaving that unsaid would mislead. */
  caveat?: string;
}

export const GLOSSARY: Record<string, Definition> = {
  GDP_CURRENT_USD: {
    what: 'El valor de todo lo que el país produjo en un año, medido en dólares corrientes.',
    howToRead:
      'A precios de cada año, así que crece tanto por producir más como por subir los precios o por moverse el tipo de cambio. Para comparar años, mirá el crecimiento del PIB, que ya descuenta la inflación.',
    caveat: 'No mide bienestar ni cómo se reparte lo producido.',
  },
  GDP_GROWTH_ANNUAL_PCT: {
    what: 'Cuánto creció la producción del país respecto al año anterior, ya descontada la inflación.',
    howToRead:
      'Es la cifra que la gente llama «crecimiento». Negativa significa que el país produjo menos que el año pasado. En Bolivia, un año por debajo del 2 % suele ir acompañado de tensión en el empleo.',
  },
  GDP_PER_CAPITA_USD: {
    what: 'El PIB dividido entre la población: cuánto se produjo por habitante.',
    howToRead:
      'Un promedio, no un ingreso. Sube si la producción crece más rápido que la población y baja si es al revés, aunque nadie en particular gane más ni menos.',
    caveat: 'No dice nada sobre desigualdad: el mismo promedio cabe en repartos muy distintos.',
  },
  GDP_PER_CAPITA_GROWTH_PCT: {
    what: 'Cuánto creció el PIB por habitante respecto al año anterior.',
    howToRead:
      'Es el crecimiento del PIB menos el crecimiento de la población. Puede ser negativo en un año de crecimiento positivo, si la población creció más.',
  },
  GDP_DEFLATOR_PCT: {
    what: 'Cuánto subieron los precios de todo lo que el país produce.',
    howToRead:
      'Es la inflación de la producción, no la del supermercado. Se separa del IPC cuando lo que cambia de precio es lo que se exporta —gas, minerales— y no lo que se consume.',
  },
  CPI_INFLATION_ANNUAL_PCT: {
    what: 'Cuánto subió el costo de la canasta que compra un hogar típico en un año.',
    howToRead:
      'Es la inflación de la que habla la gente. Se mide sobre una canasta fija, así que no capta que un hogar cambie de marca o de producto cuando algo se encarece.',
  },
  CPI_INDEX: {
    what: 'El nivel de precios al consumidor, como índice con un año base en 100.',
    howToRead:
      'El número solo no dice nada; lo que importa es cuánto cambió. Un índice en 180 significa que la canasta cuesta un 80 % más que en el año base.',
  },
  INTERNATIONAL_RESERVES_USD: {
    what: 'Las divisas y el oro que el Banco Central tiene guardados.',
    howToRead:
      'Es con lo que el país paga importaciones y deuda externa cuando no le entran dólares. Su caída es el indicador más vigilado de Bolivia: sostiene el tipo de cambio oficial.',
    caveat: 'Incluye el oro, que se puede vender pero no se usa para pagar directamente.',
  },
  RESERVES_IN_IMPORT_MONTHS: {
    what: 'Cuántos meses de importaciones alcanzarían a cubrir las reservas.',
    howToRead:
      'La referencia habitual son tres meses; por debajo se considera una posición frágil. Convierte un monto en una idea de cuánto tiempo compra.',
  },
  EXTERNAL_DEBT_USD: {
    what: 'Lo que el país debe a acreedores de fuera, sumando sector público y privado.',
    howToRead:
      'Un saldo, no un pago: lo que se paga cada año es el servicio de la deuda. Se lee contra el PIB o contra las exportaciones, que es con lo que se paga.',
  },
  DEBT_SERVICE_PCT_EXPORTS: {
    what: 'Qué porcentaje de lo que el país exporta se va en pagar deuda externa.',
    howToRead:
      'Es la medida de si la deuda es sostenible: dice cuánto de cada dólar que entra por exportar ya está comprometido antes de llegar.',
  },
  CURRENT_ACCOUNT_USD: {
    what: 'La diferencia entre lo que entra y lo que sale del país por comercio, servicios y rentas.',
    howToRead:
      'Negativa significa que el país gasta afuera más de lo que gana afuera, y esa diferencia se financia con deuda o con reservas.',
  },
  TRADE_BALANCE_PCT_GDP: {
    what: 'La diferencia entre exportaciones e importaciones, como porcentaje del PIB.',
    howToRead:
      'Positiva significa que el país vendió al exterior más de lo que compró. En Bolivia depende sobre todo del precio del gas y de los minerales.',
  },
  UNEMPLOYMENT_PCT: {
    what: 'Qué porcentaje de quienes buscan trabajo no lo encuentran.',
    howToRead:
      'Sólo cuenta a quien busca activamente. En economías con mucho empleo informal la cifra sale baja sin que eso signifique que hay buenos empleos.',
    caveat: 'No mide subempleo ni informalidad, que en Bolivia son el grueso del problema.',
  },
  LABOUR_PARTICIPATION_PCT: {
    what: 'Qué parte de la población en edad de trabajar trabaja o busca trabajo.',
    howToRead:
      'Sube cuando más gente entra al mercado laboral. Puede bajar en una crisis si quienes no encuentran trabajo dejan de buscarlo.',
  },
  EXTREME_POVERTY_PCT: {
    what: 'Qué porcentaje de la población vive por debajo del umbral de pobreza extrema.',
    howToRead:
      'Se mide contra un umbral internacional en dólares de paridad, para que sea comparable entre países. Baja con crecimiento y con transferencias.',
  },
  GINI_INDEX: {
    what: 'Cuán desigual es el reparto del ingreso, en una escala de 0 a 100.',
    howToRead:
      'Cero sería que todos ganan lo mismo y cien que uno se lleva todo. Los cambios son lentos: un punto en un año ya es mucho.',
  },
  BROAD_MONEY_GROWTH_PCT: {
    what: 'Cuánto creció el dinero en circulación, contando depósitos además de billetes.',
    howToRead:
      'Crecer mucho más rápido que la producción es la vía clásica a la inflación. Se lee junto al crecimiento del PIB, no solo.',
  },
  LENDING_RATE_PCT: {
    what: 'La tasa de interés promedio que cobran los bancos por prestar.',
    howToRead:
      'Es el precio del crédito para quien invierte o consume a plazo. Se lee contra la inflación: si la inflación la supera, quien presta pierde.',
  },
  DEPOSIT_RATE_PCT: {
    what: 'La tasa de interés promedio que pagan los bancos por los depósitos.',
    howToRead:
      'Lo que gana quien ahorra. Por debajo de la inflación, ahorrar en bolivianos pierde poder de compra, que es lo que empuja hacia el dólar.',
  },
  REAL_INTEREST_RATE_PCT: {
    what: 'La tasa de préstamo una vez descontada la inflación.',
    howToRead:
      'Es el costo verdadero de endeudarse. Negativa significa que la inflación licúa la deuda más rápido de lo que corren los intereses.',
  },
  OFFICIAL_EXCHANGE_RATE_BOB_USD: {
    what: 'Cuántos bolivianos por dólar fija la autoridad monetaria.',
    howToRead:
      'Es un precio administrado, no de mercado. Cuando no se mueve durante años, lo que se mueve es el paralelo, y la distancia entre ambos es la brecha cambiaria.',
  },
  REAL_EFFECTIVE_EXCHANGE_RATE: {
    what: 'El tipo de cambio frente a los socios comerciales, ajustado por inflación.',
    howToRead:
      'Dice si el país se volvió más caro o más barato para el resto del mundo. Subir significa perder competitividad aunque el tipo de cambio nominal no se mueva.',
  },
  PPP_CONVERSION_FACTOR: {
    what: 'Cuántos bolivianos hacen falta acá para comprar lo que un dólar compra en Estados Unidos.',
    howToRead:
      'Sirve para comparar niveles de vida entre países sin que el tipo de cambio distorsione. No es un tipo de cambio con el que se pueda operar.',
  },
  FDI_NET_INFLOWS_USD: {
    what: 'La inversión extranjera directa que entró al país en el año, neta de salidas.',
    howToRead:
      'Capital que compra o monta empresas acá, no dinero que entra y sale de mercados financieros. Puede ser negativa si se retira más de lo que entra.',
  },
  GROSS_CAPITAL_FORMATION_PCT_GDP: {
    what: 'Qué parte del PIB se destinó a invertir en vez de consumir.',
    howToRead:
      'Máquinas, obra, inventarios. Es lo que determina cuánto podrá producir el país dentro de unos años.',
  },
  GROSS_NATIONAL_SAVINGS_PCT_GDP: {
    what: 'Qué parte del ingreso del país no se consumió.',
    howToRead:
      'Lo que queda para financiar inversión sin recurrir a ahorro externo. Si la inversión supera al ahorro, la diferencia entra como deuda o inversión de afuera.',
  },
  REMITTANCES_USD: {
    what: 'El dinero que los bolivianos en el exterior mandan al país.',
    howToRead:
      'Entra como divisas directamente a los hogares, sin pasar por exportaciones. En años de escasez de dólares es una de las fuentes que sostiene el consumo.',
  },
  ENERGY_USE_PER_CAPITA: {
    what: 'Cuánta energía consume el país por habitante.',
    howToRead:
      'Sube con la industrialización y con el ingreso. Una caída brusca suele señalar menos actividad, no más eficiencia.',
  },
  NATURAL_GAS_RENTS_PCT_GDP: {
    what: 'Qué parte del PIB proviene de la renta del gas: lo que se cobra por encima del costo de extraerlo.',
    howToRead:
      'Es la medida de cuánto depende la economía del gas. Cae cuando baja el precio internacional o cuando baja la producción, y arrastra al fisco con ella.',
  },
  MINERAL_RENTS_PCT_GDP: {
    what: 'Qué parte del PIB proviene de la renta minera.',
    howToRead: 'Igual que la del gas, pero para minerales. Sigue de cerca los precios internacionales.',
  },
};

/** Units, said as a reader would say them rather than as the source stores them. */
export const UNIT_MEANING: Record<string, string> = {
  PERCENT: 'porcentaje',
  PERCENT_OF_GDP: 'porcentaje del PIB, para que sea comparable entre años y países',
  USD: 'dólares corrientes de cada año',
  INDEX: 'índice: sólo tiene sentido comparado consigo mismo',
  MONTHS: 'meses',
  PEOPLE: 'personas',
  YEARS: 'años',
};
