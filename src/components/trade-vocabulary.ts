/**
 * How the trade models are spelled for a reader.
 *
 * The database files a reading as `FERIA_POPULAR` because a code survives a
 * translation and a label does not. The three trade sections share this map so
 * a form of business is called the same thing in all of them — a reader who
 * learns «feria popular» on one tab should not meet «feria» on the next.
 */

export const FORM_LABEL: Record<string, string> = {
  FERIA_POPULAR: 'Feria popular',
  MERCADO_TRADICIONAL: 'Mercado tradicional',
  TIENDA_BARRIO: 'Tienda de barrio',
  SUPERMERCADO: 'Supermercado',
  CENTRO_COMERCIAL: 'Centro comercial',
  BOUTIQUE: 'Boutique',
  VENTA_CATALOGO: 'Venta por catálogo',
  COMERCIO_SOCIAL: 'Comercio en redes',
  COMERCIO_ELECTRONICO: 'Comercio electrónico',
  CONTRABANDO: 'Contrabando',
  CUENTA_PROPIA: 'Cuenta propia',
  NINGUNA: 'Sin forma declarada',
};

/**
 * Read as «does this trade leave a record anywhere», not as «is this legal».
 *
 * A neighbourhood shop is informal because it invoices nothing, not because it
 * hides. Trade in social networks is mixed because the shop window is a
 * platform and the payment is usually cash at the door.
 */
export const REGIME_LABEL: Record<string, string> = {
  INFORMAL: 'Informal',
  MIXTO: 'Mixto',
  FORMAL: 'Formal',
  NINGUNO: 'Sin régimen',
};

export const REGIME_TONE: Record<string, string> = {
  INFORMAL: 'var(--up)',
  MIXTO: 'var(--parallel)',
  FORMAL: 'var(--official)',
  NINGUNO: 'var(--ink-faint)',
};

export const TERRITORY_LABEL: Record<string, string> = {
  NACIONAL: 'País',
  URBANO: 'Ciudades',
  RURAL: 'Rural',
  EL_ALTO: 'El Alto',
  LA_PAZ: 'La Paz',
  SANTA_CRUZ: 'Santa Cruz',
  COCHABAMBA: 'Cochabamba',
  ORURO: 'Oruro',
  POTOSI: 'Potosí',
  TARIJA: 'Tarija',
  CHUQUISACA: 'Chuquisaca',
};

export const GOODS_LABEL: Record<string, string> = {
  ROPA: 'Ropa',
  ALIMENTOS: 'Alimentos',
  TECNOLOGIA: 'Tecnología',
  SERVICIOS: 'Servicios',
  TRANSVERSAL: 'Toda la canasta',
};

export const SETTLEMENT_LABEL: Record<string, string> = {
  QR: 'Código QR',
  BILLETERA_MOVIL: 'Billetera móvil',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia bancaria',
  PASARELA: 'Pasarela de pago',
  CONTRA_ENTREGA: 'Efectivo contra entrega',
  EFECTIVO: 'Efectivo',
  NINGUNO: 'Sin medio declarado',
};

export const SIDE_LABEL: Record<string, string> = {
  DEMANDA: 'Quién compra',
  OFERTA: 'Quién vende',
  INFRAESTRUCTURA: 'Con qué se paga',
  FRICCION: 'Qué cuesta comerciar',
  NINGUNO: 'Sin lado declarado',
};

/** The figure as its compiler published it, in the unit it was published in. */
export function tradeFigure(value: number, unit: string): string {
  const count = (decimals = 1): string =>
    value.toLocaleString('es-BO', { maximumFractionDigits: decimals });
  if (unit === 'PERCENT') return `${count()} %`;
  if (unit === 'PER_MINUTE') return `${count(0)} por minuto`;
  if (unit === 'BOB') return `Bs ${count(0)}`;
  if (unit === 'USD') return `USD ${count(0)}`;
  if (unit === 'PERSONS') return `${count(0)} personas`;
  // A count of zero is how the catalogue records an absence — TikTok Shop does
  // not operate in Bolivia — and «0» would read as a measurement that came out
  // empty rather than as a thing that does not exist.
  if (unit === 'COUNT' && value === 0) return 'No disponible';
  return count(0);
}
