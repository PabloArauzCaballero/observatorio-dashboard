/**
 * What the world board reads, and how each figure is said.
 *
 * The board answers one question the rest of the report cannot: how is the
 * world doing, and where does Bolivia sit in it. Every figure is the World
 * Bank's, on the same definition for the world, for each region and for
 * Bolivia, so the three can share an axis without a conversion nobody
 * published.
 *
 * Twenty-six indicators, and each one is here because the World Bank computes
 * a world figure for it. Government debt, external debt and the current
 * account were candidates and have none; a card with Bolivia's number and no
 * world beside it would be the one comparison this board exists to make,
 * missing.
 *
 * The definitions follow the glossary's rule. They are the observatory's own,
 * written from the standard concept rather than copied from the publisher's
 * metadata, they say what a figure counts and how not to misread it, and none
 * of them is an opinion about Bolivia.
 */

export type WorldTheme =
  'CRECIMIENTO' | 'FINANZAS' | 'COMERCIO' | 'POBLACION' | 'ESTRUCTURA' | 'BIENESTAR';

export const THEME_LABEL: Record<WorldTheme, string> = {
  CRECIMIENTO: 'Crecimiento y tamaño',
  FINANZAS: 'Precios y finanzas',
  COMERCIO: 'Comercio',
  POBLACION: 'Trabajo y población',
  ESTRUCTURA: 'Qué produce la economía',
  BIENESTAR: 'Cómo se vive',
};

/** How a figure is printed; the unit follows from it. */
export type WorldFormat = 'percent' | 'usd' | 'people' | 'years' | 'months' | 'tonnes';

export interface WorldIndicator {
  /** The World Bank's own code, which is what the source address resolves. */
  code: string;
  label: string;
  /** The unit and base, said the way a caption says it. */
  unit: string;
  theme: WorldTheme;
  format: WorldFormat;
  decimals: number;
  what: string;
  howToRead: string;
}

export const WORLD = 'WLD';
export const BOLIVIA = 'BOL';

/** The aggregates the core collects, the world first. */
export const WORLD_PLACES: ReadonlyArray<{ code: string; label: string }> = [
  { code: 'WLD', label: 'Mundo' },
  { code: 'LCN', label: 'América Latina y el Caribe' },
  { code: 'NAC', label: 'América del Norte' },
  { code: 'ECS', label: 'Europa y Asia Central' },
  { code: 'EAS', label: 'Asia oriental y el Pacífico' },
  { code: 'SAS', label: 'Asia meridional' },
  { code: 'MEA', label: 'Oriente Medio y norte de África' },
  { code: 'SSF', label: 'África subsahariana' },
];

export const PLACE_LABEL: Record<string, string> = {
  ...Object.fromEntries(WORLD_PLACES.map((place) => [place.code, place.label])),
  BOL: 'Bolivia',
};

export const WORLD_INDICATORS: readonly WorldIndicator[] = [
  {
    code: 'NY.GDP.MKTP.KD.ZG',
    label: 'Crecimiento del PIB',
    unit: '% anual, precios constantes',
    theme: 'CRECIMIENTO',
    format: 'percent',
    decimals: 1,
    what: 'Cuánto más —o menos— produjo la economía que el año anterior, sin el efecto de los precios.',
    howToRead:
      'Es una tasa y no un nivel: un 2 % sobre una economía grande agrega más producción que un 5 % sobre una chica.',
  },
  {
    code: 'NY.GDP.PCAP.KD.ZG',
    label: 'Crecimiento del PIB por habitante',
    unit: '% anual, precios constantes',
    theme: 'CRECIMIENTO',
    format: 'percent',
    decimals: 1,
    what: 'El crecimiento de la producción una vez repartida entre la población.',
    howToRead:
      'Una economía que crece 2 % con una población que crece 2 % no mejora el ingreso medio: esta es la cifra que lo dice.',
  },
  {
    code: 'NY.GDP.MKTP.CD',
    label: 'PIB',
    unit: 'dólares corrientes',
    theme: 'CRECIMIENTO',
    format: 'usd',
    decimals: 2,
    what: 'El valor de toda la producción del año, convertido a dólares al tipo de cambio de cada año.',
    howToRead:
      'Mide tamaño, no bienestar ni ritmo: sube con la inflación y con la apreciación de la moneda aunque no se produzca más.',
  },
  {
    code: 'NE.GDI.TOTL.ZS',
    label: 'Inversión bruta',
    unit: '% del PIB',
    theme: 'CRECIMIENTO',
    format: 'percent',
    decimals: 1,
    what: 'Lo que la economía destina a maquinaria, construcción y existencias, como parte del PIB.',
    howToRead:
      'Es la base de la producción futura. Suma inversión pública y privada, y la variación de inventarios puede moverla sin que se haya construido nada.',
  },
  {
    code: 'FP.CPI.TOTL.ZG',
    label: 'Inflación',
    unit: '% anual, precios al consumidor',
    theme: 'FINANZAS',
    format: 'percent',
    decimals: 1,
    what: 'Cuánto más cuesta la canasta típica de los hogares que un año antes.',
    howToRead:
      'La cifra mundial sitúa a Bolivia, pero no dice si su región vive lo mismo: para eso está la línea de la región.',
  },
  {
    code: 'FI.RES.TOTL.MO',
    label: 'Reservas internacionales',
    unit: 'meses de importaciones',
    theme: 'FINANZAS',
    format: 'months',
    decimals: 1,
    what: 'Cuántos meses de importaciones de bienes y servicios alcanzarían a pagar las reservas del banco central, oro incluido.',
    howToRead:
      'Tres meses es la referencia habitual de suficiencia. Mide colchón externo, no riqueza: un país con pocas reservas puede tener crédito externo abundante.',
  },
  {
    code: 'BX.KLT.DINV.WD.GD.ZS',
    label: 'Inversión extranjera directa',
    unit: 'entrada neta, % del PIB',
    theme: 'FINANZAS',
    format: 'percent',
    decimals: 2,
    what: 'Capital que no residentes invierten en empresas del país con intención de control duradero, neto de lo que retiran.',
    howToRead:
      'Puede ser negativa cuando las empresas extranjeras retiran más de lo que invierten, y salta de un año a otro por operaciones puntuales.',
  },
  {
    code: 'NY.GNS.ICTR.ZS',
    label: 'Ahorro bruto',
    unit: '% del PIB',
    theme: 'FINANZAS',
    format: 'percent',
    decimals: 1,
    what: 'La parte del ingreso nacional que no se consume, como proporción del PIB.',
    howToRead:
      'Cuando el ahorro queda por debajo de la inversión, la diferencia la financia el resto del mundo.',
  },
  {
    code: 'NE.TRD.GNFS.ZS',
    label: 'Apertura comercial',
    unit: 'exportaciones más importaciones, % del PIB',
    theme: 'COMERCIO',
    format: 'percent',
    decimals: 1,
    what: 'Exportaciones más importaciones de bienes y servicios, como proporción del PIB.',
    howToRead:
      'Puede pasar de 100 % porque suma dos flujos, y es mayor en economías pequeñas por construcción: no es una nota a la política comercial.',
  },
  {
    code: 'NE.EXP.GNFS.KD.ZG',
    label: 'Crecimiento de las exportaciones',
    unit: '% anual, precios constantes',
    theme: 'COMERCIO',
    format: 'percent',
    decimals: 1,
    what: 'La variación anual del volumen de bienes y servicios vendidos al exterior.',
    howToRead:
      'Mide volumen y no valor: una caída del precio del gas reduce lo que se cobra sin mover esta cifra.',
  },
  {
    code: 'TX.VAL.FUEL.ZS.UN',
    label: 'Combustibles en las exportaciones',
    unit: '% de las exportaciones de mercancías',
    theme: 'COMERCIO',
    format: 'percent',
    decimals: 1,
    what: 'La parte de las exportaciones de bienes que son petróleo, gas y sus derivados.',
    howToRead:
      'Mide dependencia y no tamaño: una proporción alta ata los ingresos por exportaciones al precio internacional de la energía.',
  },
  {
    code: 'SL.UEM.TOTL.ZS',
    label: 'Desempleo',
    unit: '% de la fuerza laboral, estimación de la OIT',
    theme: 'POBLACION',
    format: 'percent',
    decimals: 1,
    what: 'Personas que buscan trabajo y no lo tienen, como parte de quienes trabajan o buscan hacerlo.',
    howToRead:
      'Con mucho empleo informal el desempleo es bajo porque casi nadie puede permitirse no trabajar: una cifra baja no es empleo de calidad.',
  },
  {
    code: 'SL.TLF.CACT.ZS',
    label: 'Participación laboral',
    unit: '% de la población de 15 años o más',
    theme: 'POBLACION',
    format: 'percent',
    decimals: 1,
    what: 'La parte de la población en edad de trabajar que trabaja o busca trabajo.',
    howToRead:
      'Sube tanto cuando se abren oportunidades como cuando más hogares necesitan un segundo ingreso: leerla junto al desempleo.',
  },
  {
    code: 'SP.POP.TOTL',
    label: 'Población',
    unit: 'habitantes a mitad de año',
    theme: 'POBLACION',
    format: 'people',
    decimals: 2,
    what: 'El número de habitantes, sin importar su situación legal ni su ciudadanía.',
    howToRead:
      'Entre dos censos la cifra es una estimación, y se corrige cuando llega un censo nuevo.',
  },
  {
    code: 'SP.POP.GROW',
    label: 'Crecimiento de la población',
    unit: '% anual',
    theme: 'POBLACION',
    format: 'percent',
    decimals: 2,
    what: 'La variación anual del número de habitantes.',
    howToRead: 'Suma nacimientos, defunciones y migración neta, y no separa ninguno de los tres.',
  },
  {
    code: 'SP.URB.TOTL.IN.ZS',
    label: 'Población urbana',
    unit: '% del total',
    theme: 'POBLACION',
    format: 'percent',
    decimals: 1,
    what: 'La parte de la población que vive en áreas que cada país define como urbanas.',
    howToRead:
      'Cada oficina de estadística usa su propia definición de «urbano», así que la comparación entre países es aproximada.',
  },
  {
    code: 'NV.AGR.TOTL.ZS',
    label: 'Agricultura, silvicultura y pesca',
    unit: 'valor agregado, % del PIB',
    theme: 'ESTRUCTURA',
    format: 'percent',
    decimals: 1,
    what: 'Lo que aportan el campo, el bosque y la pesca al PIB.',
    howToRead:
      'Una proporción que baja no significa que el sector produzca menos: suele ser que el resto de la economía crece más rápido.',
  },
  {
    code: 'NV.IND.TOTL.ZS',
    label: 'Industria, con construcción',
    unit: 'valor agregado, % del PIB',
    theme: 'ESTRUCTURA',
    format: 'percent',
    decimals: 1,
    what: 'Lo que aportan minería, manufactura, construcción, electricidad, agua y gas al PIB.',
    howToRead:
      'Incluye la extracción de hidrocarburos y minerales, así que se mueve con los precios internacionales de las materias primas.',
  },
  {
    code: 'NV.SRV.TOTL.ZS',
    label: 'Servicios',
    unit: 'valor agregado, % del PIB',
    theme: 'ESTRUCTURA',
    format: 'percent',
    decimals: 1,
    what: 'Lo que aportan comercio, transporte, finanzas, administración pública y demás servicios al PIB.',
    howToRead:
      'Las tres partes no suman exactamente 100 %: los impuestos sobre los productos y los ajustes estadísticos quedan fuera de las tres.',
  },
  {
    code: 'SI.POV.DDAY',
    label: 'Pobreza extrema',
    unit: '% con menos de USD 3,00 al día, PPA de 2021',
    theme: 'BIENESTAR',
    format: 'percent',
    decimals: 1,
    what: 'La parte de la población que vive por debajo de la línea internacional de pobreza extrema.',
    howToRead:
      'Sale de encuestas de hogares que no se hacen todos los años, así que la serie tiene huecos. La línea cambió al actualizarse la paridad de poder adquisitivo: cifras de otras fuentes pueden usar la anterior.',
  },
  {
    code: 'SP.DYN.LE00.IN',
    label: 'Esperanza de vida al nacer',
    unit: 'años',
    theme: 'BIENESTAR',
    format: 'years',
    decimals: 1,
    what: 'Los años que viviría un recién nacido si se mantuvieran las tasas de mortalidad de su año de nacimiento.',
    howToRead:
      'Resume la mortalidad de todas las edades en ese año y no predice nada: por eso cae en los años de epidemia.',
  },
  {
    code: 'SE.XPD.TOTL.GD.ZS',
    label: 'Gasto público en educación',
    unit: '% del PIB',
    theme: 'BIENESTAR',
    format: 'percent',
    decimals: 1,
    what: 'Lo que gastan en educación todos los niveles de gobierno, como parte del PIB.',
    howToRead:
      'Mide esfuerzo fiscal, no resultados: dos países con el mismo gasto pueden tener aprendizajes muy distintos.',
  },
  {
    code: 'SH.XPD.CHEX.GD.ZS',
    label: 'Gasto corriente en salud',
    unit: '% del PIB',
    theme: 'BIENESTAR',
    format: 'percent',
    decimals: 1,
    what: 'Lo que se gasta en bienes y servicios de salud en el año, público y privado, como parte del PIB.',
    howToRead:
      'Incluye lo que los hogares pagan de su bolsillo: una cifra alta puede ser cobertura pública o gasto privado forzado.',
  },
  {
    code: 'EG.ELC.ACCS.ZS',
    label: 'Acceso a electricidad',
    unit: '% de la población',
    theme: 'BIENESTAR',
    format: 'percent',
    decimals: 1,
    what: 'La parte de la población con acceso a electricidad.',
    howToRead: 'Registra acceso, no calidad ni continuidad del servicio.',
  },
  {
    code: 'IT.NET.USER.ZS',
    label: 'Uso de internet',
    unit: '% de la población',
    theme: 'BIENESTAR',
    format: 'percent',
    decimals: 1,
    what: 'Las personas que usaron internet en los últimos tres meses, desde cualquier dispositivo.',
    howToRead:
      'Cuenta uso y no calidad de la conexión: un uso ocasional desde el celular pesa igual que una conexión fija.',
  },
  {
    code: 'EN.GHG.CO2.PC.CE.AR5',
    label: 'Emisiones de CO₂ por habitante',
    unit: 'toneladas, sin uso de la tierra',
    theme: 'BIENESTAR',
    format: 'tonnes',
    decimals: 2,
    what: 'El dióxido de carbono emitido por habitante, sin contar el uso de la tierra, su cambio y la silvicultura.',
    howToRead:
      'Deja fuera la deforestación y el cambio de uso del suelo, que en países con mucha pérdida de bosque pueden pesar más que la energía.',
  },
];

export const WORLD_CODES: readonly string[] = WORLD_INDICATORS.map((indicator) => indicator.code);
export const WORLD_PLACE_CODES: readonly string[] = [
  ...WORLD_PLACES.map((place) => place.code),
  BOLIVIA,
];

const plain = (value: number, decimals: number): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/**
 * A figure written out, in the unit it was published in.
 *
 * Money and people are scaled to the word a caption uses — «billones» is the
 * Spanish 10¹², not the English one — so a world GDP is not printed as fifteen
 * digits nobody can read at a glance.
 */
export function sayWorldFigure(value: number, indicator: WorldIndicator): string {
  switch (indicator.format) {
    case 'percent':
      return `${plain(value, indicator.decimals)} %`;
    case 'usd':
      if (Math.abs(value) >= 1e12) return `${plain(value / 1e12, 2)} billones US$`;
      if (Math.abs(value) >= 1e9) return `${plain(value / 1e9, 1)} mil M US$`;
      return `${plain(value / 1e6, 0)} M US$`;
    case 'people':
      if (Math.abs(value) >= 1e9) return `${plain(value / 1e9, 2)} mil M`;
      return `${plain(value / 1e6, 2)} M`;
    case 'years':
      return `${plain(value, indicator.decimals)} años`;
    case 'months':
      return `${plain(value, indicator.decimals)} meses`;
    case 'tonnes':
      return `${plain(value, indicator.decimals)} t`;
  }
}

/** The same figure, short enough for an axis tick. */
export function sayWorldTick(value: number, indicator: WorldIndicator): string {
  switch (indicator.format) {
    case 'usd':
      return Math.abs(value) >= 1e12
        ? `${plain(value / 1e12, 0)} bll`
        : `${plain(value / 1e9, 0)} mM`;
    case 'people':
      return Math.abs(value) >= 1e9 ? `${plain(value / 1e9, 1)} mM` : `${plain(value / 1e6, 0)} M`;
    default:
      return plain(value, Math.abs(value) < 10 ? 1 : 0);
  }
}
