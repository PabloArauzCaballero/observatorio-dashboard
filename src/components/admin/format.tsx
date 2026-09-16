/**
 * How instants and figures read on screen, in one place.
 *
 * The API speaks ISO UTC and the console speaks La Paz, and the zone is always
 * printed: a timestamp with no zone is a timestamp two people will read as two
 * different moments. A figure that was never measured prints as «sin medición»
 * rather than as a zero, everywhere, without each screen having to remember.
 */
const ZONE = 'America/La_Paz';

const INSTANT = new Intl.DateTimeFormat('es-BO', {
  timeZone: ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

const DAY = new Intl.DateTimeFormat('es-BO', { timeZone: ZONE, dateStyle: 'medium' });

const NUMBER = new Intl.NumberFormat('es-BO');

export function instant(value: string | null | undefined): string {
  if (!value) return 'sin registro';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'sin registro' : `${INSTANT.format(parsed)} (La Paz)`;
}

export function day(value: string | null | undefined): string {
  if (!value) return 'sin fecha';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'sin fecha' : DAY.format(parsed);
}

export function count(value: number | null | undefined): string {
  return value === null || value === undefined ? 'sin medición' : NUMBER.format(value);
}

/**
 * A share, always with the population it came from.
 *
 * «80 %» alone is not an answer an operator can act on and «0 de 0» is not a
 * hundred per cent, so the two travel together and a null share prints the
 * reason rather than a number.
 */
export function share(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  percentage: number | null | undefined,
): string {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined ||
    denominator === 0
  ) {
    return 'sin población que medir';
  }
  const rounded = percentage ?? Math.round((numerator / denominator) * 10_000) / 100;
  return `${NUMBER.format(numerator)} de ${NUMBER.format(denominator)} (${rounded} %)`;
}

/** How long ago, for a column where the exact instant is in the title attribute. */
export function elapsed(value: string | null | undefined): string {
  if (!value) return 'nunca';
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) return 'nunca';
  const minutes = Math.round((Date.now() - parsed) / 60_000);
  if (minutes < 1) return 'hace menos de un minuto';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/**
 * A count with its noun in the right number.
 *
 * «1 archivos generados» is the kind of detail that makes a console read as
 * unfinished, and it appears wherever a figure is interpolated into a sentence.
 * One helper is cheaper than remembering at every call site.
 */
export function plural(value: number | null | undefined, one: string, many: string): string {
  if (value === null || value === undefined) return `sin medición ${many}`;
  return `${count(value)} ${value === 1 ? one : many}`;
}
