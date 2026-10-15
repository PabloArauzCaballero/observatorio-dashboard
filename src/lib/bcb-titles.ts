/**
 * El título de los cuadros del BCB cuyo archivo no dice de qué tratan («01_02.xlsx», «03A.xlsx»).
 *
 * Leído de las primeras filas de cada cuadro publicado (la celda «CUADRO N.º …» y la línea de
 * título que la sigue), sin la unidad, que la serie ya lleva aparte. La clave es el informe tal
 * como lo guarda el catálogo (`read_models.bcb_statistic_catalog.workbook`). Un informe nuevo que
 * no esté aquí se sigue llamando por su archivo.
 *
 * Generado el 15-oct-2026 a partir de 157 cuadros descargados de www.bcb.gob.bo.
 */
export const BCB_TITLES: Readonly<Record<string, { title: string; cuadro: string | null }>> = {
  '05_estadisticassemanales/': {
    title: 'Información estadística semanal: saldos de deuda pública',
    cuadro: null,
  },
  'publicacionesbcb/': { title: 'Tasas de interés reales', cuadro: '60' },
  'publicacionesbcb/01': { title: 'Base monetaria', cuadro: '1' },
  'publicacionesbcb/01 02': {
    title: 'Base monetaria, determinantes y componentes',
    cuadro: '1.02',
  },
  'publicacionesbcb/01 03': { title: 'Origen de la liquidez total', cuadro: '1.03' },
  'publicacionesbcb/01 04': { title: 'Origen de la liquidez total: desagregado', cuadro: '1.04' },
  'publicacionesbcb/01 06': { title: 'Agregados monetarios', cuadro: '1.06' },
  'publicacionesbcb/01 07': { title: 'Multiplicadores de la base monetaria', cuadro: '1.07' },
  'publicacionesbcb/01 08': {
    title: 'Factores de expansión y contracción del dinero',
    cuadro: '1.08',
  },
  'publicacionesbcb/02': { title: 'Base monetaria, determinantes y componentes', cuadro: '2' },
  'publicacionesbcb/03 01': {
    title: 'Financiamiento concedido por el sistema bancario, por bancos',
    cuadro: '3.01',
  },
  'publicacionesbcb/03 02': {
    title: 'Financiamiento concedido por el sistema bancario, por sectores económicos',
    cuadro: '3.02',
  },
  'publicacionesbcb/03 05': {
    title: 'Financiamiento concedido por el Banco Central al sistema financiero, por bancos',
    cuadro: '3.05',
  },
  'publicacionesbcb/03 06': {
    title:
      'Financiamiento de corto plazo concedido por el BCB al sistema de intermediación financiera',
    cuadro: '3.06',
  },
  'publicacionesbcb/03 07': {
    title: 'Financiamiento concedido por el Banco Central al sector público',
    cuadro: '3.07',
  },
  'publicacionesbcb/03 08': {
    title: 'Financiamiento concedido por los bancos comerciales, por sectores económicos',
    cuadro: '3.08',
  },
  'publicacionesbcb/03 09': {
    title: 'Financiamiento concedido por bancos en liquidación, por sectores económicos',
    cuadro: '3.09',
  },
  'publicacionesbcb/03 10': {
    title: 'Financiamiento concedido por los bancos múltiples, por sectores económicos',
    cuadro: '3.10',
  },
  'publicacionesbcb/03 11': {
    title: 'Financiamiento concedido por los bancos especializados, por sectores económicos',
    cuadro: '3.11',
  },
  'publicacionesbcb/03 12': {
    title:
      'Financiamiento concedido por entidades financieras de vivienda, por sectores económicos',
    cuadro: '3.12',
  },
  'publicacionesbcb/03 13': {
    title:
      'Financiamiento concedido por las cooperativas de ahorro y crédito, por sectores económicos',
    cuadro: '3.13',
  },
  'publicacionesbcb/04': {
    title: 'Destino del medio circulante y de la liquidez total',
    cuadro: '4',
  },
  'publicacionesbcb/04 15': {
    title: 'Títulos públicos del Tesoro General de la Nación y del Banco Central de Bolivia',
    cuadro: '4.15',
  },
  'publicacionesbcb/04 16': {
    title: 'Deuda interna del Banco Central de Bolivia con el sector privado',
    cuadro: '4.16',
  },
  'publicacionesbcb/04 17': {
    title: 'Deuda interna del sector público no financiero con el sector privado',
    cuadro: '4.17',
  },
  'publicacionesbcb/05': { title: 'Agregados monetarios', cuadro: '5' },
  'publicacionesbcb/05 01': {
    title: 'Tasas de interés pasiva del sistema financiero: caja de ahorro',
    cuadro: '5.01',
  },
  'publicacionesbcb/05 02': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda nacional',
    cuadro: '5.02',
  },
  'publicacionesbcb/05 03': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda extranjera',
    cuadro: '5.03',
  },
  'publicacionesbcb/05 04': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda nacional con mantenimiento de valor',
    cuadro: '5.04',
  },
  'publicacionesbcb/05 05': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda nacional en unidad de fomento de vivienda',
    cuadro: '5.05',
  },
  'publicacionesbcb/05 06': {
    title: 'Tasas de interés activas del sistema financiero por destino de crédito',
    cuadro: '5.06',
  },
  'publicacionesbcb/05 07': {
    title: 'Tasas de interés activas del sistema financiero: moneda nacional',
    cuadro: '5.07',
  },
  'publicacionesbcb/05 08': {
    title: 'Tasas de interés activas del sistema financiero: moneda extranjera',
    cuadro: '5.08',
  },
  'publicacionesbcb/05 09': {
    title:
      'Tasas de interés activas del sistema financiero: moneda nacional con mantenimiento de valor',
    cuadro: '5.09',
  },
  'publicacionesbcb/05 10': {
    title:
      'Tasas de interés activas del sistema financiero: moneda nacional en unidad de fomento de vivienda',
    cuadro: '5.10',
  },
  'publicacionesbcb/05 11': { title: 'Tasas de interés reales', cuadro: '5.11' },
  'publicacionesbcb/05 12': {
    title:
      'Estructura de las tasas de interés para letras del Tesoro (LTs) y bonos del Tesoro (BTs)',
    cuadro: '5.12',
  },
  'publicacionesbcb/06': {
    title: 'Financiamiento concedido por el Banco Central al sector público',
    cuadro: '6',
  },
  'publicacionesbcb/06 01': {
    title: 'Encaje legal del sistema bancario en moneda nacional',
    cuadro: '6.01',
  },
  'publicacionesbcb/06 02': {
    title: 'Encaje legal del sistema bancario en moneda extranjera',
    cuadro: '6.02',
  },
  'publicacionesbcb/06 03': {
    title:
      'Encaje legal del sistema bancario en moneda nacional con mantenimiento de valor respecto al dólar',
    cuadro: '6.03',
  },
  'publicacionesbcb/06 04': {
    title: 'Encaje legal del sistema bancario en moneda nacional con mantenimiento de valor UFV',
    cuadro: '6.04',
  },
  'publicacionesbcb/08 01': { title: 'Reservas y activos externos consolidados', cuadro: '8.01' },
  'publicacionesbcb/08 02': { title: 'Balanza cambiaria', cuadro: '8.02' },
  'publicacionesbcb/08 03': { title: 'Balanza cambiaria: detalle', cuadro: '8.03' },
  'publicacionesbcb/08 04': { title: 'Ingreso de divisas', cuadro: '8.04' },
  'publicacionesbcb/08 05': { title: 'Egreso de divisas', cuadro: '8.05' },
  'publicacionesbcb/09 02': { title: 'Balanza comercial', cuadro: '9.02' },
  'publicacionesbcb/09 03': {
    title: 'Estructura de las exportaciones: valor oficial',
    cuadro: '9.03',
  },
  'publicacionesbcb/09 04': { title: 'Exportación de minerales: valor oficial', cuadro: '9.04' },
  'publicacionesbcb/09 05': { title: 'Exportación de minerales: volumen', cuadro: '9.05' },
  'publicacionesbcb/09 06': { title: 'Exportación de minerales: valor unitario', cuadro: '9.06' },
  'publicacionesbcb/09 07': { title: 'Exportación de minerales: índice de valor', cuadro: '9.07' },
  'publicacionesbcb/09 08': {
    title: 'Exportación de minerales: índice de quántum',
    cuadro: '9.08',
  },
  'publicacionesbcb/09 09': {
    title: 'Exportación de minerales: índice de valor unitario',
    cuadro: '9.09',
  },
  'publicacionesbcb/09 10': { title: 'Exportación de hidrocarburos', cuadro: '9.10' },
  'publicacionesbcb/09 11': {
    title: 'Exportación de productos no tradicionales: valor oficial',
    cuadro: '9.11',
  },
  'publicacionesbcb/09 13': {
    title: 'Exportación de productos no tradicionales: valor unitario',
    cuadro: '9.13',
  },
  'publicacionesbcb/09 14': { title: 'Exportación por zonas económicas', cuadro: '9.14' },
  'publicacionesbcb/09 15': {
    title: 'Importación de bienes según uso o destino económico',
    cuadro: '9.15',
  },
  'publicacionesbcb/09 16': { title: 'Importación por zonas económicas', cuadro: '9.16' },
  'publicacionesbcb/09 17': { title: 'Servicios', cuadro: '9.17' },
  'publicacionesbcb/09 18': { title: 'Ingreso secundario', cuadro: '9.18' },
  'publicacionesbcb/10': {
    title: 'Cuentas monetarias consolidadas de otras sociedades financieras',
    cuadro: '10',
  },
  'publicacionesbcb/10 01': {
    title: 'Deuda externa pública de mediano y largo plazo: saldo adeudado por acreedor',
    cuadro: '10.01',
  },
  'publicacionesbcb/10 02': {
    title: 'Deuda externa pública de mediano y largo plazo: desembolsos por acreedor',
    cuadro: '10.02',
  },
  'publicacionesbcb/10 03': {
    title: 'Deuda externa pública de mediano y largo plazo: servicio de la deuda por acreedor',
    cuadro: '10.03',
  },
  'publicacionesbcb/10 05': {
    title: 'Deuda externa pública de mediano y largo plazo: saldo adeudado por deudor',
    cuadro: '10.05',
  },
  'publicacionesbcb/10 06': {
    title: 'Deuda externa pública de mediano y largo plazo: desembolsos por deudor',
    cuadro: '10.06',
  },
  'publicacionesbcb/10 07': {
    title: 'Deuda externa pública de mediano y largo plazo: servicio de la deuda por deudor',
    cuadro: '10.07',
  },
  'publicacionesbcb/10 09': {
    title: 'Deuda externa privada: saldo adeudado total por acreedor y plazo',
    cuadro: '10.09',
  },
  'publicacionesbcb/10 10': {
    title: 'Deuda externa privada: saldo adeudado total por sector y plazo',
    cuadro: '10.10',
  },
  'publicacionesbcb/10 11': {
    title: 'Deuda externa privada: saldo adeudado total por sector y actividad económica',
    cuadro: '10.11',
  },
  'publicacionesbcb/10 12': {
    title: 'Deuda externa privada: desembolsos totales por acreedor y plazo',
    cuadro: '10.12',
  },
  'publicacionesbcb/10 13': {
    title: 'Deuda externa privada: desembolsos totales por sector y plazo',
    cuadro: '10.13',
  },
  'publicacionesbcb/10 14': {
    title: 'Deuda externa privada: desembolsos totales por sector y actividad económica',
    cuadro: '10.14',
  },
  'publicacionesbcb/10 15': {
    title: 'Deuda externa privada: servicio total de la deuda por acreedor y plazo',
    cuadro: '10.15',
  },
  'publicacionesbcb/10 16': {
    title: 'Deuda externa privada: servicio total de la deuda por sector y plazo',
    cuadro: '10.16',
  },
  'publicacionesbcb/10 17': {
    title: 'Deuda externa privada: servicio total de la deuda por sector y actividad económica',
    cuadro: '10.17',
  },
  'publicacionesbcb/10 18': {
    title: 'Deuda externa privada: transferencia neta por sector',
    cuadro: '10.18',
  },
  'publicacionesbcb/10 23': {
    title: 'Deuda externa total por sector público y privado',
    cuadro: '10.23',
  },
  'publicacionesbcb/10 24': {
    title: 'Deuda externa total por sector institucional',
    cuadro: '10.24',
  },
  'publicacionesbcb/10 25': {
    title: 'Coeficientes de endeudamiento externo público',
    cuadro: '10.25',
  },
  'publicacionesbcb/11': {
    title: 'Fuentes y usos de fondos de otras sociedades de depósito',
    cuadro: '11',
  },
  'publicacionesbcb/11 01': {
    title: 'Cotización de monedas extranjeras en dólares',
    cuadro: '11.01',
  },
  'publicacionesbcb/11 02': {
    title: 'Cotización de monedas extranjeras en bolivianos',
    cuadro: '11.02',
  },
  'publicacionesbcb/11 03': { title: 'Promedio del tipo de cambio oficial', cuadro: '11.03' },
  'publicacionesbcb/11 04': { title: 'Tipo de cambio oficial', cuadro: '11.04' },
  'publicacionesbcb/11 05': {
    title: 'Cotizaciones del boliviano respecto al dólar',
    cuadro: '11.05',
  },
  'publicacionesbcb/12': {
    title: 'Bancos múltiples: crédito al sector privado por departamentos',
    cuadro: '12',
  },
  'publicacionesbcb/12 01': { title: 'Tasas de reporto', cuadro: '12.01' },
  'publicacionesbcb/12 02': { title: 'Tasas interbancarias', cuadro: '12.02' },
  'publicacionesbcb/12 03': { title: 'Tasas de encaje legal', cuadro: '12.03' },
  'publicacionesbcb/12 04': { title: 'Tasa SOFR', cuadro: '12.04' },
  'publicacionesbcb/13': {
    title: 'Bancos múltiples: captaciones en cuenta corriente del sector privado por departamentos',
    cuadro: '13',
  },
  'publicacionesbcb/13 01': {
    title: 'Operaciones consolidadas del sector público',
    cuadro: '13.01',
  },
  'publicacionesbcb/13 02': {
    title: 'Operaciones consolidadas del gobierno general',
    cuadro: '13.02',
  },
  'publicacionesbcb/13 03': {
    title: 'Operaciones consolidadas de empresas públicas',
    cuadro: '13.03',
  },
  'publicacionesbcb/13 04': { title: 'Impuesto a las transacciones financieras', cuadro: '13.04' },
  'publicacionesbcb/13 05': {
    title: 'Recaudación impuestos internos por fuente de ingreso',
    cuadro: '13.05',
  },
  'publicacionesbcb/13 06': {
    title: 'Recaudación impuestos internos por gerencia departamental',
    cuadro: '13.06',
  },
  'publicacionesbcb/13 07': {
    title: 'Número de identificación tributaria por tipo de régimen',
    cuadro: '13.07',
  },
  'publicacionesbcb/14': {
    title: 'Bancos múltiples: captaciones en caja de ahorros del sector privado por departamentos',
    cuadro: '14',
  },
  'publicacionesbcb/15': {
    title:
      'Bancos múltiples: captaciones en depósitos a plazo fijo del sector privado por departamentos',
    cuadro: '15',
  },
  'publicacionesbcb/15 01': { title: 'Índice de precios al consumidor (IPC)', cuadro: '15.01' },
  'publicacionesbcb/15 02': {
    title: 'Variaciones del índice de precios al consumidor (IPC)',
    cuadro: '15.02',
  },
  'publicacionesbcb/15 03': {
    title: 'Variación del índice general de precios al consumidor',
    cuadro: '15.03',
  },
  'publicacionesbcb/15 04': {
    title: 'Tasa acumulativa anual del índice general de precios al consumidor',
    cuadro: '15.04',
  },
  'publicacionesbcb/15 05': {
    title: 'Evolución de la unidad de fomento de vivienda (UFV)',
    cuadro: '15.05',
  },
  'publicacionesbcb/16': {
    title: 'Depósitos a plazo fijo en otras sociedades de depósito',
    cuadro: '16',
  },
  'publicacionesbcb/17': { title: 'Factores de expansión y contracción del dinero', cuadro: '17' },
  'publicacionesbcb/18': {
    title: 'Deuda interna del Banco Central de Bolivia con el sector privado',
    cuadro: '18',
  },
  'publicacionesbcb/19': {
    title: 'Encaje legal del sistema bancario en moneda nacional',
    cuadro: '19',
  },
  'publicacionesbcb/20': {
    title: 'Encaje legal del sistema bancario en moneda extranjera',
    cuadro: '20',
  },
  'publicacionesbcb/21': {
    title:
      'Encaje legal del sistema bancario en moneda nacional con mantenimiento de valor respecto al dólar',
    cuadro: '21',
  },
  'publicacionesbcb/22': {
    title: 'Encaje legal del sistema bancario en moneda nacional con mantenimiento de valor UFV',
    cuadro: '22',
  },
  'publicacionesbcb/24': {
    title: 'Financiamiento concedido por el Banco Central al sistema financiero',
    cuadro: '24',
  },
  'publicacionesbcb/25': { title: 'Exportaciones', cuadro: '25' },
  'publicacionesbcb/26': {
    title: 'Índice de precios de productos básicos de exportación',
    cuadro: '26',
  },
  'publicacionesbcb/27': { title: 'Importaciones', cuadro: '27' },
  'publicacionesbcb/28': {
    title: 'Reservas internacionales del Banco Central de Bolivia',
    cuadro: '28',
  },
  'publicacionesbcb/29': {
    title:
      'Activos externos netos de otras sociedades de depósito e instituciones financieras de desarrollo',
    cuadro: '29',
  },
  'publicacionesbcb/30': {
    title: 'Remesas de trabajadores recibidas según plaza de pago',
    cuadro: '30',
  },
  'publicacionesbcb/31': {
    title: 'Remesas de trabajadores recibidas según país de origen',
    cuadro: '31',
  },
  'publicacionesbcb/33': { title: 'Balanza cambiaria: detalle', cuadro: '33' },
  'publicacionesbcb/35': {
    title: 'Transferencias a través del sistema financiero nacional según sector económico',
    cuadro: '35',
  },
  'publicacionesbcb/36': { title: 'Bolsín: principales indicadores', cuadro: '36' },
  'publicacionesbcb/37': { title: 'Ventas en el día: principales indicadores', cuadro: '37' },
  'publicacionesbcb/38': { title: 'Promedio del tipo de cambio oficial', cuadro: '38' },
  'publicacionesbcb/40': { title: 'Índices de tipo de cambio real', cuadro: '40' },
  'publicacionesbcb/41': { title: 'Ponderadores de comercio internacional', cuadro: '41' },
  'publicacionesbcb/42': { title: 'Cotización de monedas extranjeras en bolivianos', cuadro: '42' },
  'publicacionesbcb/43': { title: 'Índice de precios al consumidor (IPC)', cuadro: '43' },
  'publicacionesbcb/44': {
    title: 'Variaciones del índice de precios al consumidor (IPC)',
    cuadro: '44',
  },
  'publicacionesbcb/45': {
    title: 'Evolución de la unidad de fomento de vivienda (UFV)',
    cuadro: '45',
  },
  'publicacionesbcb/46': { title: 'Tasas de reporto', cuadro: '46' },
  'publicacionesbcb/47': {
    title: 'Tasas de interés pasiva del sistema financiero: caja de ahorro',
    cuadro: '47',
  },
  'publicacionesbcb/48': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda nacional',
    cuadro: '48',
  },
  'publicacionesbcb/49': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda extranjera',
    cuadro: '49',
  },
  'publicacionesbcb/50': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda nacional con mantenimiento de valor',
    cuadro: '50',
  },
  'publicacionesbcb/51': {
    title:
      'Tasas de interés pasiva del sistema financiero: depósitos a plazo fijo en moneda nacional en unidad de fomento de vivienda',
    cuadro: '51',
  },
  'publicacionesbcb/52': {
    title: 'Tasas de interés activas del sistema financiero por destino de crédito',
    cuadro: '52',
  },
  'publicacionesbcb/53': {
    title: 'Tasas de interés activas del sistema financiero: moneda nacional',
    cuadro: '53',
  },
  'publicacionesbcb/54': {
    title: 'Tasas de interés activas del sistema financiero: moneda extranjera',
    cuadro: '54',
  },
  'publicacionesbcb/55': {
    title:
      'Tasas de interés activas del sistema financiero: moneda nacional con mantenimiento de valor',
    cuadro: '55',
  },
  'publicacionesbcb/56': {
    title:
      'Tasas de interés activas del sistema financiero: moneda nacional en unidad de fomento de vivienda',
    cuadro: '56',
  },
  'publicacionesbcb/58': {
    title:
      'Estructura de las tasas de interés para letras del Tesoro (LTs) y bonos del Tesoro (BTs)',
    cuadro: '58',
  },
  'publicacionesbcb/59': { title: 'Tasas de encaje legal', cuadro: '59' },
  'publicacionesbcb/a': { title: 'Balance del Banco Central de Bolivia', cuadro: '3A' },
  'publicacionesbcb/p': {
    title: 'Balance consolidado de instituciones financieras de desarrollo',
    cuadro: '2.14-P',
  },
  'publicacionesbcb/pii': { title: 'Posición de inversión internacional (2025)', cuadro: null },
  'publicacionesbcb/pii t': {
    title: 'Posición de inversión internacional (segundo trimestre de 2026)',
    cuadro: null,
  },
  'tasas_interes/ah m': {
    title: 'Tasas de interés pasiva del sistema financiero: caja de ahorro (cuadro de 2026)',
    cuadro: null,
  },
  'tasas_interes/ahm': {
    title: 'Tasas de interés pasiva del sistema financiero: caja de ahorro (cuadro de 2012)',
    cuadro: null,
  },
  'tasas_interes/dc m': { title: 'Tasas de interés activas por destino del crédito', cuadro: null },
  'tasas_interes/dcm': {
    title: 'Tasas de interés activas anuales por destino del crédito',
    cuadro: null,
  },
};
