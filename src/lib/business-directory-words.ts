/** Una palabra frecuente dentro de las razones sociales disponibles. */
export interface BusinessNameTerm {
  term: string;
  label: string;
  value: number;
}

const STOP_WORDS = new Set([
  'a',
  'al',
  'bolivia',
  'boliviana',
  'boliviano',
  'comercial',
  'comerciales',
  'comercializadora',
  'con',
  'de',
  'del',
  'e',
  'el',
  'empresa',
  'empresas',
  'en',
  'industria',
  'industrial',
  'la',
  'las',
  'limitada',
  'los',
  'ltda',
  'para',
  'por',
  'sa',
  'sam',
  'servicio',
  'servicios',
  'sociedad',
  'srl',
  'unipersonal',
  'y',
]);

/** Clave comparable, sin tildes, signos ni mayúsculas. */
export function foldBusinessWord(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function displayWord(value: string): string {
  const lower = value.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}

/** Las palabras con más empresas, no las veces que una misma empresa las repite. */
export function businessNameTerms(names: readonly string[], limit = 40): BusinessNameTerm[] {
  const counts = new Map<string, number>();
  const labels = new Map<string, Map<string, number>>();

  for (const name of names) {
    const seen = new Set<string>();
    const printed = name.match(/[\p{L}\p{M}\d]+/gu) ?? [];
    for (const word of printed) {
      const term = foldBusinessWord(word);
      if (term.length < 3 || /^\d+$/u.test(term) || STOP_WORDS.has(term) || seen.has(term)) continue;
      seen.add(term);
      counts.set(term, (counts.get(term) ?? 0) + 1);
      const variants = labels.get(term) ?? new Map<string, number>();
      variants.set(word, (variants.get(word) ?? 0) + 1);
      labels.set(term, variants);
    }
  }

  return [...counts]
    .sort(([left, leftCount], [right, rightCount]) => rightCount - leftCount || left.localeCompare(right, 'es'))
    .slice(0, Math.min(Math.max(limit, 0), 40))
    .map(([term, value]) => {
      const variant = [...(labels.get(term) ?? [])].sort(
        ([left, leftCount], [right, rightCount]) => rightCount - leftCount || left.localeCompare(right, 'es'),
      )[0]?.[0];
      return { term, label: displayWord(variant ?? term), value };
    });
}
