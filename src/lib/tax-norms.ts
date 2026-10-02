/**
 * Los impuestos que fijan las normas, y lo que pesan sobre un precio.
 *
 * No es una serie de tiempo: es legislación, y por eso vive aquí y no en la base. Cada fila
 * dice qué norma la fija, cuánto cobra hoy, quién la recauda y a dónde va, y —lo que más
 * importa en un año como 2026, en que casi cada trimestre cambió una alícuota— **cómo se
 * confirmó**: `primaria` quiere decir que se leyó el texto de la norma en una fuente
 * oficial; `secundaria`, que solo se vio en prensa o en un portal tributario; `pendiente`,
 * que hay una norma aprobada que todavía no rige.
 *
 * Verificado el {@link NORMS_AS_OF}. Una alícuota que cambie después se corrige aquí y en
 * ningún otro lugar: las calculadoras de abajo leen estas mismas constantes.
 */

export const NORMS_AS_OF = '2026-10-01';

export type NormGroup =
  | 'consumo'
  | 'renta'
  | 'comercio'
  | 'hidrocarburos'
  | 'patrimonio'
  | 'trabajo'
  | 'reparto';

export const NORM_GROUP_LABEL: Record<NormGroup, string> = {
  consumo: 'Consumo y ventas',
  renta: 'Renta y utilidades',
  comercio: 'Comercio exterior',
  hidrocarburos: 'Hidrocarburos y minería',
  patrimonio: 'Patrimonio',
  trabajo: 'Trabajo y seguridad social',
  reparto: 'Reparto y referencias',
};

export type Confirmation = 'primaria' | 'secundaria' | 'pendiente';

export const CONFIRMATION_LABEL: Record<Confirmation, string> = {
  primaria: 'Texto de la norma leído',
  secundaria: 'Solo en prensa o portal tributario',
  pendiente: 'Aprobada, todavía no rige',
};

export interface TaxNorm {
  readonly id: string;
  readonly group: NormGroup;
  readonly name: string;
  readonly rate: string;
  readonly base: string;
  readonly norm: string;
  readonly collector: string;
  readonly confirmation: Confirmation;
  readonly source: string;
  readonly note?: string;
}

const LEXIVOX_843 = 'https://www.lexivox.org/norms/BO-L-843R2.html';

export const NORMS: readonly TaxNorm[] = [
  {
    id: 'iva',
    group: 'consumo',
    name: 'Impuesto al Valor Agregado (IVA)',
    rate: '13 %',
    base: 'Precio de la factura, con el IVA ya incluido: equivale a 14,94 % del precio sin IVA.',
    norm: 'Ley 843, art. 15',
    collector: 'SIN → coparticipación tributaria',
    confirmation: 'primaria',
    source: LEXIVOX_843,
  },
  {
    id: 'iva-por-fuera',
    group: 'consumo',
    name: 'IVA «por fuera» (cambio aprobado)',
    rate: '13 % sobre el precio sin IVA, mostrado aparte en la factura',
    base: 'Rige el primer día del mes siguiente a la publicación de un decreto reglamentario. Al 19-sep-2026 ese decreto no existía.',
    norm: 'Ley 1733 (27-may-2026)',
    collector: 'SIN',
    confirmation: 'pendiente',
    source: 'https://www.impuestos.gob.bo/wp-content/uploads/2026/05/L17332051NCPP.pdf',
    note: 'Con el IVA por fuera, el impuesto pasa de 13 % a 11,5 % del precio facturado.',
  },
  {
    id: 'it',
    group: 'consumo',
    name: 'Impuesto a las Transacciones (IT)',
    rate: '3 %',
    base: 'Ingreso bruto de cada venta. No se descuenta entre eslabones: se acumula en cascada. Los dependientes están exentos.',
    norm: 'Ley 843, art. 75',
    collector: 'SIN → coparticipación tributaria',
    confirmation: 'primaria',
    source: LEXIVOX_843,
    note: 'Lo pagado por IT se puede acreditar contra el IUE, así que para una empresa con utilidades no es carga neta.',
  },
  {
    id: 'ice',
    group: 'consumo',
    name: 'Impuesto a los Consumos Específicos (ICE)',
    rate: 'Bebidas no alcohólicas Bs 0,60–6,78 por litro; cerveza Bs 5,08 por litro más 1 %; singani y pisco 5 %; alcoholes y whisky 10 %',
    base: 'Tasas específicas en bolivianos por litro, actualizadas por la UFV; las de cigarrillos y vehículos son porcentajes por tabla.',
    norm: 'Ley 843, art. 79; RND 102500000049 (18-dic-2025)',
    collector: 'SIN → coparticipación tributaria',
    confirmation: 'primaria',
    source: 'https://www.impuestos.gob.bo/wp-content/uploads/2025/12/RND-102500000049.pdf',
    note: 'El DS 5563 moderó el ajuste (de unos 22,5 % a unos 8,5 %); las tasas finales y las de cigarrillos y vehículos no se pudieron confirmar.',
  },
  {
    id: 'iue',
    group: 'renta',
    name: 'Impuesto sobre las Utilidades de las Empresas (IUE)',
    rate: '25 % de la utilidad neta; beneficiarios del exterior, 12,5 % efectivo (25 % sobre el 50 % presunto)',
    base: 'Utilidad neta de la empresa. El DS 5563 (2-mar-2026) baja el IUE a beneficiarios del exterior a 3,125 % si reinvierten 75 % o más.',
    norm: 'Ley 843, arts. 50 y 51; DS 5563',
    collector: 'SIN → TGN',
    confirmation: 'primaria',
    source: LEXIVOX_843,
    note: 'El texto de la ley está leído; el DS 5563 solo se vio en un portal tributario.',
  },
  {
    id: 'aa-iue-financiero',
    group: 'renta',
    name: 'Alícuota adicional del IUE a bancos y financieras',
    rate: '25 % adicional',
    base: 'Utilidad de entidades financieras cuando su rentabilidad sobre el patrimonio pasa de 6 %.',
    norm: 'Ley 843, art. 51 ter (mod. Ley 771); RND 10-0034-16',
    collector: 'SIN',
    confirmation: 'secundaria',
    source:
      'https://impuestos.com.bo/iue-impuesto-sobre-las-utilidades-alicuota-adicional-financiero/',
  },
  {
    id: 'aa-iue-minero',
    group: 'hidrocarburos',
    name: 'Alícuota adicional del IUE minero',
    rate: '12,5 %',
    base: 'Utilidad extraordinaria cuando los precios son altos. Hay un proyecto de Código Minero que la eliminaría: no es ley.',
    norm: 'Ley 3787 (2007); Ley 843, art. 51 bis',
    collector: 'SIN',
    confirmation: 'secundaria',
    source:
      'https://eldeber.com.bo/economia/bolivia-ofrecera-estabilidad-contratos-alivio-fiscal-captar-capitales-mineros_1778511791',
    note: 'La tasa de 12,5 % no se pudo leer en el texto de la ley.',
  },
  {
    id: 'rc-iva',
    group: 'renta',
    name: 'Régimen Complementario al IVA (RC-IVA)',
    rate: '13 %',
    base: 'Ingreso menos 2 salarios mínimos (Bs 6.600 con el de 2026). Se descuenta el 13 % de las facturas presentadas; sin factura, el empleador retiene 13 %.',
    norm: 'Ley 843, art. 34; DS 21531',
    collector: 'SIN → TGN',
    confirmation: 'secundaria',
    source: 'https://siatinfo.impuestos.gob.bo/index.php/impuesto-asunto/rc-iva',
    note: 'Los 4 salarios mínimos son el umbral para presentar el formulario con facturas, no el mínimo no imponible.',
  },
  {
    id: 'gravamen',
    group: 'comercio',
    name: 'Gravamen arancelario (aranceles de importación)',
    rate: 'Escala de 0 % a 35 %: todas las alícuotas bajaron 5 puntos el 6-jul-2026, hasta el 31-dic-2027',
    base: 'Valor CIF de la mercadería. Maquinaria y equipos de industria, minería y textil pagan 0 % hasta el 31-dic-2026.',
    norm: 'Arancel 2026 (RM 557); DS 5646 (29-jun-2026); DS 5516, art. 24',
    collector: 'Aduana Nacional → TGN',
    confirmation: 'secundaria',
    source: 'https://abi.bo/decreto-5646-reduce-en-5-las-alicuotas-del-gravamen-arancelario-para-importaciones-hasta-finales-de-2027/',
    note: 'El texto del DS 5646 no se pudo bajar de la Gaceta; se leyó en prensa y en un agregador normativo.',
  },
  {
    id: 'iva-importacion',
    group: 'comercio',
    name: 'IVA a la importación',
    rate: '13 %, que sobre la base equivale a 14,94 %',
    base: 'Valor CIF más el gravamen arancelario y otros gastos de despacho.',
    norm: 'Ley 843; Ley 1990 y su reglamento',
    collector: 'Aduana Nacional → TGN y coparticipación',
    confirmation: 'secundaria',
    source: 'https://www.aduana.gob.bo/lga-view',
    note: 'Es crédito fiscal para el importador. La verificación de valor en frontera no se pudo confirmar.',
  },
  {
    id: 'idh',
    group: 'hidrocarburos',
    name: 'Impuesto Directo a los Hidrocarburos (IDH) y regalías',
    rate: 'IDH 32 %; regalía departamental 11 %; compensatoria 1 % (Beni y Pando)',
    base: 'Valor de la producción en el punto de medición. La nueva Ley de Hidrocarburos (hasta 50 %) está en debate, sin aprobar.',
    norm: 'Ley 3058 (2005), arts. 52 y 55; DS 28421',
    collector: 'YPFB y SIN → gobernaciones, municipios, universidades y TGN',
    confirmation: 'secundaria',
    source: 'https://www.lexivox.org/norms/BO-L-3058.html',
    note: 'Los porcentajes de reparto vigentes del IDH no se pudieron confirmar.',
  },
  {
    id: 'iehd',
    group: 'hidrocarburos',
    name: 'Impuesto Especial a los Hidrocarburos y sus Derivados (IEHD)',
    rate: 'Bs 0 por litro para derivados de crudo importado, hasta el 31-dic-2030',
    base: 'Litro de combustible. El monto por litro de la gasolina y el diésel de la cadena de precios no se pudo confirmar.',
    norm: 'Ley 843, tít. IV; DS 5701 (7-sep-2026); DS 5716',
    collector: 'SIN y YPFB → TGN y gobernaciones',
    confirmation: 'secundaria',
    source:
      'https://eju.tv/2026/09/el-gobierno-autoriza-a-las-refinerias-a-importar-crudo-vender-derivados-sin-subvencion-y-fija-en-cero-el-iehd/',
  },
  {
    id: 'regalia-minera',
    group: 'hidrocarburos',
    name: 'Regalía minera',
    rate: 'Oro 7 % si el precio pasa de US$ 700 por onza; resto de minerales de 1 % a 7 %; otros 2,5 %',
    base: 'Valor bruto de venta. En el mercado interno se paga el 60 % de la alícuota.',
    norm: 'Ley 535, arts. 227 y 229',
    collector: 'Autoridad minera → 85 % gobernación productora, 15 % municipios productores',
    confirmation: 'primaria',
    source:
      'https://www.autoridadminera.gob.bo/wp-content/uploads/2025/11/Ley-535-de-mineri%CC%81a-y-metalurgia.pdf',
  },
  {
    id: 'itf',
    group: 'consumo',
    name: 'Impuesto a las Transacciones Financieras (ITF)',
    rate: '0 %. Era 0,30 %',
    base: 'Abrogado: la Ley 1717 lo eliminó y la RND 102600000013 derogó su reglamentación.',
    norm: 'Ley 3446 (2006), abrogada por la Ley 1717 (10-abr-2026)',
    collector: '—',
    confirmation: 'primaria',
    source: 'https://bolivia.infoleyes.com/articulo/109206',
  },
  {
    id: 'igf',
    group: 'patrimonio',
    name: 'Impuesto a las Grandes Fortunas (IGF)',
    rate: '1,4 % (Bs 30–40 millones), 1,9 % (40–50 millones), 2,4 % (más de 50 millones)',
    base: 'Patrimonio neto superior a Bs 30 millones, con deducciones fijas. El intento de eliminarlo fracasó en la comisión de Diputados en febrero de 2026.',
    norm: 'Ley 1357 (2020)',
    collector: 'SIN → TGN',
    confirmation: 'secundaria',
    source:
      'https://larazon.bo/economia-y-empresa/2026/02/11/comision-rechaza-abrogar-el-impuesto-a-las-grandes-fortunas/',
  },
  {
    id: 'aporte-laboral',
    group: 'trabajo',
    name: 'Aportes laborales a pensiones',
    rate: '12,71 % del sueldo, más un aporte solidario de 1,15 % sobre lo que pase de Bs 13.000, 5,74 % sobre lo que pase de Bs 25.000 y 11,48 % sobre lo que pase de Bs 35.000',
    base: 'Total ganado del trabajador: 10 % de cotización, 1,71 % de riesgo común, 0,5 % solidario del asegurado y 0,5 % de comisión.',
    norm: 'Ley 065 (Pensiones), arts. 87 y 91',
    collector: 'Gestora Pública de la Seguridad Social',
    confirmation: 'secundaria',
    source: 'https://misalariobo.com/aportes-laborales-y-patronales-bolivia/',
    note: 'El 10 % y el 0,5 % están en el texto de la ley; la suma de 12,71 % y la escala solidaria solo se vieron en un portal laboral.',
  },
  {
    id: 'aporte-patronal',
    group: 'trabajo',
    name: 'Aportes patronales',
    rate: '7,21 % a la Gestora (riesgo profesional 1,71 %, vivienda 2 % y solidario 3,5 %) más 10 % de salud a corto plazo',
    base: 'Total ganado del trabajador. El sector minero metalúrgico paga además 2,3 % solidario. El solidario patronal subió de 3 % a 3,5 % con la Ley 1582 (1-oct-2024).',
    norm: 'Ley 065; Ley 1582',
    collector: 'Gestora Pública y Cajas de Salud',
    confirmation: 'secundaria',
    source: 'https://www.lexivox.org/norms/BO-L-N1582.xhtml',
    note: 'El 3,5 % está en la Ley 1582; el 1,71 %, el 2 % y el 10 % de salud solo se vieron en una fuente secundaria.',
  },
  {
    id: 'coparticipacion',
    group: 'reparto',
    name: 'Coparticipación tributaria',
    rate: '75 % TGN, 20 % municipios, 5 % universidades',
    base: 'De los impuestos nacionales coparticipables. Las gobernaciones piden 15 % directo (Agenda 50/50).',
    norm: 'Ley 031, disposiciones transitorias 3.ª y 4.ª',
    collector: 'Tesoro General de la Nación',
    confirmation: 'secundaria',
    source:
      'https://plataformaurbana.cepal.org/es/instrumentos/financiamiento/impuestos-de-coparticipacion-tributaria-municipal',
    note: 'No se pudo confirmar qué impuestos entran en la lista, incluido el IEHD.',
  },
  {
    id: 'salario-minimo',
    group: 'reparto',
    name: 'Salario mínimo nacional',
    rate: 'Bs 3.300 por mes',
    base: 'Subió 20 % sobre los Bs 2.750 de 2025, con efecto desde el 1-ene-2026.',
    norm: 'DS 5516 (13-ene-2026), art. 23',
    collector: '—',
    confirmation: 'primaria',
    source: 'https://s1.boliviaimpuestos.com/img/2026/01/24154524/Decreto_Supremo_5516.pdf',
  },
  {
    id: 'combustibles',
    group: 'hidrocarburos',
    name: 'Precio de los combustibles (con IVA)',
    rate: 'Gasolina especial Bs 6,96 por litro; diésel Bs 17,95 por litro; gasolina premium Bs 11,00; GNV Bs 2,73 por m³; GLP Bs 2,25 por kg',
    base: 'El diésel dejó de subvencionarse el 18-sep-2026 (antes Bs 9,80) y se reajusta con una banda de ±5 % sobre la cotización internacional. La gasolina especial sigue a precio fijo.',
    norm: 'DS 5516 (13-ene-2026), art. 2; DS 5716 (18-sep-2026)',
    collector: 'YPFB y ANH',
    confirmation: 'primaria',
    source: 'https://eju.tv/wp-content/uploads/2026/09/Decreto-Supremo-5716-que-fija-el-nuevo-precio-del-diesel.pdf',
  },
];

/* ───────────────────────── Constantes que usan las calculadoras ───────────────────────── */

export const IVA_RATE = 0.13;
/** El IVA sobre el precio sin IVA: 13 / 87. */
export const IVA_ON_NET = IVA_RATE / (1 - IVA_RATE);
export const IT_RATE = 0.03;

/** Escala arancelaria vigente desde el 6-jul-2026 (DS 5646): cada tramo bajó 5 puntos. */
export const TARIFF_NOW = [0, 5, 10, 15, 20, 25, 30, 35] as const;
export const TARIFF_SHIFT: ReadonlyArray<{ before: number; now: number }> = [
  { before: 40, now: 35 },
  { before: 35, now: 30 },
  { before: 30, now: 25 },
  { before: 25, now: 20 },
  { before: 20, now: 15 },
  { before: 15, now: 10 },
  { before: 10, now: 5 },
  { before: 5, now: 0 },
];

/** Aportes del trabajador a pensiones y los del empleador (Ley 065 y Ley 1582). */
export const WORKER_PENSION_RATE = 0.1271;
export const SOLIDARITY_BANDS: ReadonlyArray<{ from: number; rate: number }> = [
  { from: 13_000, rate: 0.0115 },
  { from: 25_000, rate: 0.0574 },
  { from: 35_000, rate: 0.1148 },
];
export const EMPLOYER_PENSION_RATE = 0.0721;
export const EMPLOYER_HEALTH_RATE = 0.1;

/* ───────────────────────── Calculadoras ───────────────────────── */

export interface Slice {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

export interface Breakdown {
  /** Lo que queda para quien produce y vende: el precio menos todo impuesto. */
  readonly kept: number;
  readonly total: number;
  readonly taxes: readonly Slice[];
  readonly taxTotal: number;
  /** Cuánto del total es impuesto, en %. */
  readonly taxShare: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

function finish(total: number, taxes: readonly Slice[]): Breakdown {
  const taxTotal = taxes.reduce((sum, slice) => sum + slice.value, 0);
  return {
    kept: round2(total - taxTotal),
    total: round2(total),
    taxes: taxes.map((slice) => ({ ...slice, value: round2(slice.value) })),
    taxTotal: round2(taxTotal),
    taxShare: total > 0 ? round2((taxTotal / total) * 100) : 0,
  };
}

/**
 * Un bien vendido en el mercado interno a `price` (con IVA incluido), que pasó por `steps`
 * ventas desde que se produjo hasta que llegó al consumidor.
 *
 * El IVA no depende del número de eslabones: cada uno resta el crédito fiscal del anterior,
 * así que en toda la cadena se paga el 13 % del precio final. El IT sí: se cobra sobre cada
 * venta y no se descuenta. Se supone que cada eslabón agrega la misma parte del precio, de
 * modo que las ventas son `price × k / steps`; es un supuesto de ilustración, y por eso el
 * número de eslabones lo elige el lector.
 */
export function domesticSale(price: number, steps: number): Breakdown {
  const stages = Math.max(1, Math.floor(steps));
  let sales = 0;
  for (let stage = 1; stage <= stages; stage += 1) sales += (price * stage) / stages;
  return finish(price, [
    { key: 'iva', label: 'IVA (13 % del precio)', value: price * IVA_RATE },
    { key: 'it', label: `IT (3 % de cada venta, ${stages} ${stages === 1 ? 'venta' : 'ventas'})`, value: sales * IT_RATE },
  ]);
}

/**
 * Una mercadería importada de valor CIF `cif` que paga un arancel de `tariff` %.
 *
 * El IVA de importación se calcula sobre CIF más arancel y es crédito fiscal del
 * importador: se paga en la frontera y se recupera al vender. Aquí se muestra lo que se
 * paga al entrar, porque es lo que el comprador de afuera financia antes de vender nada.
 * El total es el costo de la mercadería ya nacionalizada.
 */
export function importedGood(cif: number, tariff: number): Breakdown {
  const duty = cif * (tariff / 100);
  const vat = (cif + duty) * IVA_ON_NET;
  return finish(cif + duty + vat, [
    { key: 'ga', label: `Gravamen arancelario (${tariff} % del CIF)`, value: duty },
    { key: 'iva-imp', label: 'IVA de importación (14,94 % sobre CIF + arancel)', value: vat },
  ]);
}

export interface Payroll {
  readonly gross: number;
  readonly workerPension: number;
  readonly solidarity: number;
  readonly net: number;
  readonly employerPension: number;
  readonly employerHealth: number;
  /** Lo que cuesta el trabajador a quien lo emplea. */
  readonly employerCost: number;
  /** Aportes de las dos partes como parte del costo del empleador, en %. */
  readonly wedge: number;
}

/**
 * Lo que un sueldo bruto de `gross` bolivianos paga en aportes a pensiones y salud, del
 * lado del trabajador y del empleador. No incluye el RC-IVA, que depende de las facturas
 * que presente cada persona, ni el IUE de la empresa.
 */
export function payroll(gross: number): Payroll {
  const solidarity = SOLIDARITY_BANDS.reduce((sum, band, index) => {
    const ceiling = SOLIDARITY_BANDS[index + 1]?.from ?? Number.POSITIVE_INFINITY;
    return sum + Math.max(0, Math.min(gross, ceiling) - band.from) * band.rate;
  }, 0);
  const workerPension = gross * WORKER_PENSION_RATE;
  const employerPension = gross * EMPLOYER_PENSION_RATE;
  const employerHealth = gross * EMPLOYER_HEALTH_RATE;
  const employerCost = gross + employerPension + employerHealth;
  return {
    gross: round2(gross),
    workerPension: round2(workerPension),
    solidarity: round2(solidarity),
    net: round2(gross - workerPension - solidarity),
    employerPension: round2(employerPension),
    employerHealth: round2(employerHealth),
    employerCost: round2(employerCost),
    wedge: employerCost > 0
      ? round2(((workerPension + solidarity + employerPension + employerHealth) / employerCost) * 100)
      : 0,
  };
}
