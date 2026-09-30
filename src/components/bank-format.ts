/** Las fechas y cifras de los bancos, dichas igual en las tres piezas que las muestran. */

const long = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const short = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** «28 de octubre de 2024». */
export const sayLong = (value: string): string => long.format(new Date(`${value}T12:00:00Z`));

/** «28 oct 2024», para una tarjeta que no da para más. */
export const sayShort = (value: string): string => short.format(new Date(`${value}T12:00:00Z`));

/** Bolivianos con dos decimales, o un guion si ese lado no se anotó. */
export const price = (value: number | null): string =>
  value === null
    ? '—'
    : new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        value,
      );

export const amount = (value: number): string =>
  new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value);
