import type { WorldLinePoint, WorldLineSeries } from './charts';
import { placeName } from '@/lib/departments';
import type { YearValue } from '@/lib/departments-board';

/**
 * Contra quién se lee un departamento, y por qué siempre son los mismos dos.
 *
 * El capítulo dibujaba las nueve series de cada medida y resaltaba la elegida.
 * Nueve líneas es un peine: se ve que hay dispersión y no se ve ninguna de las
 * nueve, y elegir un departamento no cambiaba nada de lo que había en pantalla.
 * Ahora cada figura tiene exactamente tres líneas —**el país, Santa Cruz y el
 * departamento elegido**— que son las tres que contestan la pregunta que se
 * hace delante de una cifra departamental: cuánto es eso en el país, cuánto en
 * la economía más grande, y cuánto aquí.
 *
 * Santa Cruz como vara y no la mediana de los nueve: la mediana es un
 * departamento que no existe, y una comparación con algo que no existe no se
 * puede ir a comprobar. Santa Cruz es el treinta por ciento del producto
 * nacional y la referencia que cualquiera en Bolivia usa sin que se la
 * expliquen.
 *
 * Los tres colores son los tres primeros de la paleta del informe —azul
 * oficial, púrpura de brecha, naranja de paralelo—, que son los únicos tres que
 * pasan la prueba de separación por pares. No se cambian por gusto.
 */

/** La vara con la que se mide un departamento cuando no es ella misma. */
export const BENCHMARK = 'SANTA_CRUZ';

/** Una serie con nombre y color, lista para compartir eje con otras. */
export interface NamedLine {
  key: string;
  label: string;
  values: readonly YearValue[];
  tone: string;
  emphasis?: boolean;
  dashed?: boolean;
}

const at = (values: readonly YearValue[] | undefined, year: number): YearValue | undefined =>
  values?.find((point) => point.year === year);

/**
 * Varias series anuales sobre un mismo eje de años.
 *
 * Un año sin dato queda en `null` y corta la línea en vez de unirla, porque
 * unir dos años publicados afirma el de en medio, que nadie publicó.
 */
export function onOneAxis(lines: readonly NamedLine[]): {
  data: WorldLinePoint[];
  series: WorldLineSeries[];
} {
  const years = new Set<number>();
  for (const line of lines) for (const point of line.values) years.add(point.year);

  const data: WorldLinePoint[] = [...years]
    .sort((left, right) => left - right)
    .map((year) => {
      const row: WorldLinePoint = { year: String(year) };
      for (const line of lines) row[line.key] = at(line.values, year)?.value ?? null;
      return row;
    });

  const series: WorldLineSeries[] = lines.map((line) => ({
    key: line.key,
    label: line.label,
    tone: line.tone,
    ...(line.emphasis ? { emphasis: true } : {}),
    ...(line.dashed ? { dashed: true } : {}),
  }));

  return { data, series };
}

/**
 * Las tres líneas de una medida: el elegido, Santa Cruz y Bolivia.
 *
 * El elegido va primero y resaltado; las otras dos, discontinuas, porque son
 * el fondo contra el que se lee y no tres cosas del mismo rango. Cuando el
 * elegido **es** Santa Cruz quedan dos líneas y no una repetida, que es lo que
 * saldría de dibujar la vara contra sí misma.
 *
 * `country` dice con qué fila entra el país, o `false` para dejarlo fuera: en
 * una participación la fila de Bolivia es cien por definición y dibujarla
 * aplasta las otras dos contra el eje sin añadir nada que no diga el título. En
 * el comercio exterior el país no se llama `BOLIVIA` sino `NATIONAL`, que es la
 * fila con la que el cuadro del INE cierra los nueve departamentos.
 */
export function trio(
  valuesOf: (place: string) => readonly YearValue[],
  place: string,
  options: { country?: string | false } = {},
): NamedLine[] {
  const lines: NamedLine[] = [
    {
      key: place,
      label: placeName(place),
      values: valuesOf(place),
      tone: 'var(--parallel)',
      emphasis: true,
    },
  ];

  if (place !== BENCHMARK) {
    const bench = valuesOf(BENCHMARK);
    if (bench.length) {
      lines.push({
        key: BENCHMARK,
        label: placeName(BENCHMARK),
        values: bench,
        tone: 'var(--gap)',
        dashed: true,
      });
    }
  }

  const key = options.country ?? 'BOLIVIA';
  if (key !== false) {
    const country = valuesOf(key);
    if (country.length) {
      lines.push({
        key,
        label: 'Bolivia',
        values: country,
        tone: 'var(--official)',
        dashed: true,
      });
    }
  }

  return lines;
}

/**
 * Las mismas series llevadas a índice, con el primer año que todas comparten
 * valiendo cien.
 *
 * Es lo que permite poner a Bolivia y a Pando en un eje sin que Pando sea una
 * raya pegada al cero: el país es la suma de los nueve, así que en bolivianos
 * su línea es diez veces la de un departamento mediano y cincuenta veces la del
 * más chico. El nivel en bolivianos no se pierde —está en la ficha de cifras y
 * en la tabla— y lo que la figura contesta pasa a ser la pregunta que de verdad
 * se hace: quién creció más desde entonces.
 */
export function indexed(lines: readonly NamedLine[]): NamedLine[] {
  const shared = lines
    .map((line) => line.values.at(0)?.year ?? Number.POSITIVE_INFINITY)
    .reduce((latest, year) => Math.max(latest, year), 0);

  return lines.map((line) => {
    const base = at(line.values, shared)?.value;
    if (base === undefined || base === 0) return { ...line, values: [] };
    return {
      ...line,
      values: line.values
        .filter((point) => point.year >= shared)
        .map((point) => ({ year: point.year, value: (point.value / base) * 100 })),
    };
  });
}

/** El año con el que arranca un índice, para decirlo en el título. */
export function indexBase(lines: readonly NamedLine[]): number | null {
  const years = lines.map((line) => line.values.at(0)?.year ?? 0).filter((year) => year > 0);
  return years.length ? Math.max(...years) : null;
}
