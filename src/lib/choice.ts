/**
 * Una elección de categorías, que puede ser más de una.
 *
 * Todo el informe filtraba con una cadena por dimensión: un rubro, un tono, un
 * año. Eso alcanza para «mostrame Santa Cruz» y no alcanza para la pregunta que
 * sigue, que es «mostrame Santa Cruz y Tarija» — y un lector que quiere dos
 * departamentos con un filtro de uno solo tiene que mirar dos tableros y sumar
 * de cabeza, que es exactamente el trabajo que un tablero existe para evitar.
 *
 * Aquí una dimensión guarda un conjunto. Vacío quiere decir «todas», y es lo
 * mismo que decía el viejo centinela `TODOS`; con uno adentro se comporta igual
 * que antes; con varios, la dimensión pasa a ser una disyunción —A o B— y el
 * resto del tablero se recuenta contra ella sin más ceremonia.
 *
 * Las reglas del gesto están en {@link toggle} y son dos:
 *
 *  - Clic normal: la categoría tocada reemplaza a lo que hubiera. Tocarla otra
 *    vez cuando ya era la única, la quita. Es el gesto que el informe ya tenía
 *    y no cambia para nadie.
 *  - Ctrl/⌘/Mayús + clic: suma o resta esa categoría a lo elegido. Quitar la
 *    última vuelve al valor por omisión en lugar de dejar un recorte vacío, que
 *    no es un filtro sino una pantalla en blanco.
 *
 * Los filtros entre dimensiones distintas siempre se acumularon —elegir un año
 * no borra el tono— y eso sigue igual: lo que se agrega es acumular dentro de
 * una misma dimensión.
 */

/** Una elección: el conjunto vacío quiere decir «sin filtrar». */
export type Choice = ReadonlySet<string>;

/**
 * Sin filtrar, y siempre el mismo objeto.
 *
 * Compartido a propósito: dos dimensiones sin filtro apuntan al mismo conjunto,
 * de modo que comparar por identidad basta y ningún `useEffect` se dispara por
 * un vacío recién construido. Nadie lo muta porque nada aquí muta una elección
 * —`toggle` y `without` copian— y no porque `Object.freeze` lo impida: sobre un
 * `Set`, congelar las propiedades propias no cierra `add`.
 */
export const ANY: Choice = new Set<string>();

export const choiceOf = (...values: readonly string[]): Choice => new Set(values);

/** Si dos elecciones dicen lo mismo, sin importar el orden. */
export function same(one: Choice, other: Choice): boolean {
  if (one === other) return true;
  if (one.size !== other.size) return false;
  for (const value of one) if (!other.has(value)) return false;
  return true;
}

/**
 * Si un valor sobrevive a la elección.
 *
 * El conjunto vacío acepta todo, que es lo que hace que «sin filtro» no tenga
 * que escribirse como un caso aparte en cada tablero.
 */
export const accepts = (choice: Choice, value: string): boolean =>
  choice.size === 0 || choice.has(value);

/** Si el lector eligió explícitamente este valor: lo que se pinta encendido. */
export const picked = (choice: Choice, value: string): boolean => choice.has(value);

/**
 * La misma elección, con la misma identidad.
 *
 * Un `Set` se compara por referencia, de modo que devolver uno nuevo con el
 * mismo contenido vuelve a disparar cada `useEffect` que lo vigila: en el mapa
 * eso es una consulta de cuatro mil lugares por volver a tocar la ciudad que ya
 * estaba puesta. Si el contenido no cambió, no cambia nada.
 */
export const settle = (current: Choice, next: Choice): Choice =>
  same(current, next) ? current : next;

/**
 * La elección después del clic.
 *
 * `base` es el valor por omisión de esa dimensión, que casi siempre es «todas»
 * pero no siempre: en prensa el tema arranca en «sólo económicos», que es un
 * recorte real y es a donde hay que volver al deshacer. Mientras la dimensión
 * esté en su valor por omisión, Ctrl+clic se comporta como un clic normal —
 * sumarle una categoría a «todas» no querría decir nada.
 */
export function toggle(
  current: Choice,
  value: string,
  additive: boolean,
  base: Choice = ANY,
): Choice {
  if (!additive || same(current, base)) {
    return settle(current, current.size === 1 && current.has(value) ? base : choiceOf(value));
  }
  const next = new Set(current);
  if (!next.delete(value)) next.add(value);
  return settle(current, next.size ? next : base);
}

/** Quitar una categoría concreta, que es lo que hace la × de cada pastilla. */
export function without(current: Choice, value: string, base: Choice = ANY): Choice {
  const next = new Set(current);
  next.delete(value);
  return settle(current, next.size ? next : base);
}

/**
 * Si este gesto suma en lugar de reemplazar.
 *
 * Ctrl es el que se anuncia; ⌘ va porque en un Mac Ctrl+clic es el menú
 * contextual y el sistema entero usa ⌘ para esto; Mayús va porque es el otro
 * modificador que cualquiera prueba y castigar el intento con «te borré lo que
 * tenías» no le enseña nada a nadie.
 */
export const additive = (event: {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): boolean => Boolean(event.ctrlKey || event.metaKey || event.shiftKey);

/** Los valores elegidos, en orden estable para que una URL no baile. */
export const list = (choice: Choice): string[] => [...choice].sort();

/** Cuántos filtros cuenta una dimensión: uno, esté con uno o con cinco valores. */
export const counts = (choice: Choice, base: Choice = ANY): number =>
  same(choice, base) ? 0 : 1;

/**
 * Cómo viaja una elección en una dirección web.
 *
 * Separadas por coma. Ningún código de este informe —rubro, tono, tema,
 * familia, departamento— lleva una coma adentro, así que no hace falta un
 * escape que después habría que recordar en los dos extremos.
 */
export const param = (choice: Choice): string | undefined =>
  choice.size ? list(choice).join(',') : undefined;

/**
 * Cómo se nombra la selección de una dimensión en una sola línea.
 *
 * Con dos o más, listar todos los nombres desborda el encabezado de cualquier
 * panel, y «5 seleccionados» no dice cuáles. El primero más el resto contado es
 * el compromiso que cabe y no miente: el detalle está en las pastillas.
 */
export function describe(
  choice: Choice,
  label: (value: string) => string,
  all: string,
): string {
  const values = list(choice);
  const [first] = values;
  if (first === undefined) return all;
  if (values.length === 1) return label(first);
  return `${label(first)} +${values.length - 1}`;
}

/** Lo que dice el tablero sobre el gesto, en un solo lugar para que no derive. */
export const MULTI_HINT = 'Ctrl+clic (⌘ en Mac) para elegir varias a la vez.';

/** Lo mismo, para el `title` de un botón de categoría. */
export const multiTitle = (name: string, on: boolean): string =>
  on
    ? `${name} — clic para quitarlo, Ctrl+clic para quitarlo de la selección`
    : `${name} — clic para filtrar, Ctrl+clic para sumarlo a la selección`;
