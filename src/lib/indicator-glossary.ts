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
 *
 * **These definitions are the observatory's own.** They are written from the
 * standard economic concept, not copied from the publisher's metadata, and the
 * card says so: the figure comes from the source it cites, the explanation
 * comes from here. Letting one link stand for both would suggest the Banco
 * Mundial vouched for wording it has never seen, which is exactly the kind of
 * borrowed authority this report exists to avoid.
 */

/** Who wrote the explanation, as distinct from who published the figure. */
export const DEFINITION_AUTHOR = 'Observatorio Económico de Bolivia';

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
    howToRead:
      'Igual que la del gas, pero para minerales. Sigue de cerca los precios internacionales.',
  },
  EFW_SUMMARY_INDEX: {
    what: 'Índice de libertad económica del Fraser Institute: promedio de cinco áreas, de 0 a 10.',
    howToRead:
      'Diez es la economía más libre. Es una calificación construida por una institución, no una medición; se lee junto con las cinco áreas, que discrepan más de lo que el resumen deja ver.',
  },
  EFW_SIZE_OF_GOVERNMENT: {
    what: 'Área 1 del índice de Fraser: gasto público, transferencias, empresas estatales y tasas impositivas.',
    howToRead:
      'Más alto significa un Estado que ocupa menos espacio en la economía. No juzga si eso es bueno; mide tamaño.',
  },
  EFW_LEGAL_SYSTEM_PROPERTY_RIGHTS: {
    what: 'Área 2 del índice de Fraser: independencia judicial, imparcialidad de los tribunales, protección de la propiedad y cumplimiento de contratos.',
    howToRead: 'Es el área donde Bolivia puntúa más bajo. De 0 a 10.',
  },
  EFW_SOUND_MONEY: {
    what: 'Área 3 del índice de Fraser: crecimiento monetario, inflación y libertad para tener cuentas en moneda extranjera.',
    howToRead:
      'De 0 a 10. Es el área donde Bolivia puntúa más alto; un año de inflación alta la baja con retraso.',
  },
  EFW_FREEDOM_TO_TRADE: {
    what: 'Área 4 del índice de Fraser: aranceles, barreras regulatorias al comercio, controles de capital y de tipo de cambio.',
    howToRead: 'De 0 a 10. Un tipo de cambio administrado con brecha pesa en esta área.',
  },
  EFW_REGULATION: {
    what: 'Área 5 del índice de Fraser: regulación del crédito, del mercado laboral y de los negocios.',
    howToRead: 'De 0 a 10. Más alto es menos regulación restrictiva.',
  },
  FH_TOTAL_SCORE: {
    what: 'Puntaje total de «Freedom in the World» de Freedom House, de 0 a 100.',
    howToRead:
      'Suma de derechos políticos (hasta 40) y libertades civiles (hasta 60). Cada lectura se archiva bajo el año que evalúa, no el de la edición.',
  },
  FH_POLITICAL_RIGHTS_SCORE: {
    what: 'Derechos políticos según Freedom House, de 0 a 40.',
    howToRead:
      'Suma de proceso electoral, pluralismo y participación, y funcionamiento del gobierno.',
  },
  FH_CIVIL_LIBERTIES_SCORE: {
    what: 'Libertades civiles según Freedom House, de 0 a 60.',
    howToRead: 'Suma de expresión y creencia, asociación, estado de derecho y autonomía personal.',
  },
  FH_ELECTORAL_PROCESS_SCORE: {
    what: 'Subcategoría A de Freedom House: si el Ejecutivo y el Legislativo se eligen en elecciones libres y justas.',
    howToRead: 'De 0 a 12. Leerla contra su techo, no contra 100.',
  },
  FH_POLITICAL_PLURALISM_SCORE: {
    what: 'Subcategoría B de Freedom House: derecho a organizar partidos, oposición con posibilidad real, libertad frente a poderes no electos.',
    howToRead: 'De 0 a 16.',
  },
  FH_GOVERNMENT_FUNCTIONING_SCORE: {
    what: 'Subcategoría C de Freedom House: si los electos deciden de verdad, si hay controles a la corrupción y rendición de cuentas.',
    howToRead: 'De 0 a 12.',
  },
  FH_EXPRESSION_BELIEF_SCORE: {
    what: 'Subcategoría D de Freedom House: prensa, religión, academia y conversación privada.',
    howToRead: 'De 0 a 16.',
  },
  FH_ASSOCIATION_RIGHTS_SCORE: {
    what: 'Subcategoría E de Freedom House: reunión, organizaciones civiles y sindicatos.',
    howToRead: 'De 0 a 12.',
  },
  FH_RULE_OF_LAW_SCORE: {
    what: 'Subcategoría F de Freedom House: independencia judicial, debido proceso, protección frente a la fuerza ilegítima, igualdad ante la ley.',
    howToRead: 'De 0 a 16. Es la subcategoría más baja de Bolivia frente a su techo.',
  },
  FH_PERSONAL_AUTONOMY_SCORE: {
    what: 'Subcategoría G de Freedom House: movimiento, propiedad y empresa, libertades sociales, igualdad de oportunidades.',
    howToRead: 'De 0 a 16.',
  },
  FH_POLITICAL_RIGHTS_RATING: {
    what: 'Calificación histórica de derechos políticos de Freedom House, de 1 a 7, publicada desde 1972.',
    howToRead:
      'Aquí 1 es la más libre y 7 la menos: la serie sube cuando la libertad baja. El promedio con la de libertades civiles define el estado «libre», «parcialmente libre» o «no libre».',
  },
  FH_CIVIL_LIBERTIES_RATING: {
    what: 'Calificación histórica de libertades civiles de Freedom House, de 1 a 7, publicada desde 1972.',
    howToRead: 'Aquí 1 es la más libre y 7 la menos. Se lee junto con la de derechos políticos.',
  },
  VDEM_LIBERAL_DEMOCRACY_INDEX: {
    what: 'Índice de democracia liberal de V-Dem, de 0 a 1.',
    howToRead:
      'Elecciones limpias más contrapesos: libertades individuales y control judicial y legislativo del Ejecutivo. La distancia con el índice electoral es cuánto pesan los contrapesos.',
  },
  VDEM_ELECTORAL_DEMOCRACY_INDEX: {
    what: 'Índice de democracia electoral de V-Dem, de 0 a 1.',
    howToRead:
      'Solo la parte electoral: sufragio, elecciones limpias, libertad de expresión y de asociación. Puede ser alto con contrapesos débiles.',
  },
  VDEM_FREEDOM_OF_EXPRESSION_INDEX: {
    what: 'Índice de libertad de expresión de V-Dem, de 0 a 1.',
    howToRead: 'Prensa, discusión académica y privada, censura.',
  },
  VDEM_FREEDOM_OF_ASSOCIATION_INDEX: {
    what: 'Índice de libertad de asociación de V-Dem, de 0 a 1.',
    howToRead: 'Partidos y organizaciones de la sociedad civil.',
  },
  VDEM_JUDICIAL_CONSTRAINTS_INDEX: {
    what: 'Control judicial del Ejecutivo según V-Dem, de 0 a 1.',
    howToRead:
      'Si el Ejecutivo acata a los tribunales y estos son independientes. Es el componente más bajo de la democracia boliviana.',
  },
  VDEM_LEGISLATIVE_CONSTRAINTS_INDEX: {
    what: 'Control legislativo del Ejecutivo según V-Dem, de 0 a 1.',
    howToRead: 'Si el Legislativo investiga y frena al Ejecutivo en la práctica.',
  },
  VDEM_POLITICAL_CORRUPTION_INDEX: {
    what: 'Índice de corrupción política de V-Dem, de 0 a 1.',
    howToRead:
      'Corrupción en el Ejecutivo, el Legislativo, el Judicial y la administración. Aquí más alto es peor, al revés que los demás índices de V-Dem.',
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
