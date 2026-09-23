'use client';

import { useMemo, useState } from 'react';
import { DivergingBars, ShareBars, WorldLines } from './charts';
import { indexBase, indexed, onOneAxis, trio } from './department-lines';
import { Icon } from './icons';
import {
  ACTIVITY_GROUPS,
  activityMoves,
  activityName,
  activityStructure,
  activityValues,
  branchesOf,
  imputedBankShare,
} from '@/lib/department-activities';
import { placeName } from '@/lib/departments';
import type { DepartmentBoard } from '@/lib/departments-board';

/**
 * De qué vive un departamento, y no sólo cuánto produce.
 *
 * Es lo que le faltaba al capítulo. Las cuentas regionales contestan el tamaño
 * —«Tarija perdió un tercio de su economía»— y esa frase no se puede discutir
 * hasta saber qué perdió. El INE abre el producto de cada departamento en once
 * actividades y en las ramas de cinco de ellas, desde 1988, y con eso la misma
 * década se cuenta entera: lo que cayó fue el petróleo crudo y el gas natural,
 * que pasó del 36 % del producto tarijeño en 2005 al 21 % en 2024, mientras el
 * resto de su economía no se movía.
 *
 * **Tres figuras de estructura y tres de una actividad.** Arriba, el reparto
 * entero del departamento, su distancia con el país actividad por actividad y
 * cuánto creció de verdad cada una en la última década. Abajo, la actividad que
 * se elija, seguida en el tiempo contra Bolivia y contra Santa Cruz.
 *
 * **El denominador se iguala antes de comparar** y ese detalle decide la mitad
 * de las lecturas: el cuadro departamental reparte sobre el producto a precios
 * de mercado y el nacional sobre el valor agregado, que ya excluye los
 * impuestos indirectos. Sin igualarlo, cualquier departamento parece menos
 * industrial que el país por una razón puramente contable.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const signed = (value: number, decimals = 1): string =>
  `${value > 0 ? '+' : ''}${number(value, decimals)}`;

export function DepartmentActivities({ board, place }: { board: DepartmentBoard; place: string }) {
  const name = placeName(place);
  const year = board.activityYear ?? null;
  /*
   * El tablero y el núcleo se despliegan por separado, así que este componente
   * puede recibir un tablero armado por una versión anterior, sin el corpus por
   * actividad dentro. Sin este respaldo la página entera se cae con un
   * «cannot read properties of undefined» en vez de enseñar el capítulo que sí
   * tiene: es exactamente el fallo que la ruta evita devolviendo `null` cuando
   * no reconoce un código.
   */
  const activities = board.activities ?? {};

  const structure = useMemo(
    () => activityStructure(activities, place, year),
    [activities, place, year],
  );
  const country = useMemo(() => activityStructure(activities, 'BOLIVIA', year), [activities, year]);
  const moves = useMemo(() => activityMoves(activities, place, year), [activities, place, year]);
  const imputed = useMemo(
    () => imputedBankShare(activities, place, year),
    [activities, place, year],
  );

  /*
   * La actividad que más pesa abre el panel. Empezar por la primera del
   * catálogo habría abierto siempre en agricultura, que en La Paz o en Oruro no
   * es la lectura; abrir por la mayor hace que la figura de abajo hable de lo
   * que la de arriba acaba de señalar.
   */
  const [chosen, setChosen] = useState<string>('');
  const biggest = [...structure].sort((left, right) => right.value - left.value).at(0);
  const shown = chosen || (biggest?.slug ?? ACTIVITY_GROUPS[0]?.slug ?? '');
  const branches = branchesOf(shown);

  const weight = useMemo(
    () => onOneAxis(trio((one) => activityValues(activities, 'SHARE', one, shown), place)),
    [activities, place, shown],
  );
  const growth = useMemo(
    () => onOneAxis(trio((one) => activityValues(activities, 'GROWTH', one, shown), place)),
    [activities, place, shown],
  );
  const size = useMemo(() => {
    const raw = trio((one) => activityValues(activities, 'VALUE', one, shown), place);
    return { chart: onOneAxis(indexed(raw)), base: indexBase(raw) };
  }, [activities, place, shown]);

  const gap = useMemo(() => {
    const byCountry = new Map(country.map((slice) => [slice.slug, slice.value]));
    return structure
      .map((slice) => ({
        name: slice.name,
        value: slice.value - (byCountry.get(slice.slug) ?? 0),
        meta: `${number(slice.value)} % en ${name}, ${number(byCountry.get(slice.slug) ?? 0)} % en Bolivia`,
      }))
      .filter((row) => Number.isFinite(row.value));
  }, [structure, country, name]);

  if (!structure.length) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>El producto de {name} por actividad económica</h2>
          <p className="panel-sub">
            Todavía no hay cuadros por actividad cargados para {name}. El capítulo se llena solo
            cuando el núcleo haya sembrado los cuadros del INE.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="tile-head">
          <Icon name="fabrica" size={17} />
          <h2>De qué vive {name}</h2>
          <span className="tile-hint">cuentas regionales por actividad</span>
        </div>
        <p className="panel-sub">
          Las once actividades en que el INE abre el producto departamental, desde 1988. La primera
          figura dice la estructura, la segunda en qué se aparta del país y la tercera cuál creció
          de verdad; abajo, cualquiera de ellas seguida en el tiempo contra Bolivia y Santa Cruz.
        </p>
      </div>

      <div className="grid-three">
        <div className="panel">
          <div className="panel-head">
            <h2>
              Reparto del producto de {name} por actividad (% del producto, {year ?? '—'})
            </h2>
            <p className="panel-sub">
              De qué vive el departamento. Las once suman cien; los servicios bancarios imputados
              —el cobro que los bancos no facturan y que la contabilidad resta
              {imputed === null ? '' : ` (${number(Math.abs(imputed))} % del producto de ${name})`}—
              quedan fuera del reparto porque son un descuento y no una actividad. Toca una barra
              para seguirla en el tiempo, abajo.
            </p>
          </div>
          <ShareBars
            data={structure.map((slice) => ({
              name: slice.name,
              value: slice.value,
              pick: slice.slug,
              emphasis: slice.slug === shown,
            }))}
            unit=" %"
            height={300}
            onPick={(pick) => setChosen(pick)}
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>
              Distancia de {name} con Bolivia, por actividad (puntos porcentuales, {year ?? '—'})
            </h2>
            <p className="panel-sub">
              En qué se aparta esta economía de la del país. Cada barra es la diferencia entre el
              peso que la actividad tiene aquí y el que tiene en Bolivia, con el denominador
              igualado: el cuadro departamental reparte sobre el producto a precios de mercado y el
              nacional sobre el valor agregado, y compararlos en crudo haría parecer a cualquier
              departamento menos industrial de lo que es.
            </p>
          </div>
          <DivergingBars data={gap} unit="puntos" height={300} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>
              Crecimiento real por actividad en {name} ({moves.at(0)?.from ?? '—'}–
              {moves.at(0)?.to ?? '—'}, % acumulado)
            </h2>
            <p className="panel-sub">
              Cuál creció y cuál se encogió de verdad. Va sobre el nivel a precios constantes y no
              sobre el reparto, porque el reparto es un juego de suma cero: una actividad puede
              ganar peso sin crecer, sólo porque otra se hundió, y contarlo con el reparto lo
              contaría al revés.
            </p>
          </div>
          <DivergingBars
            data={moves.map((row) => ({
              name: row.name,
              value: row.change,
              meta: `${signed(row.change)} % entre ${row.from} y ${row.to}`,
            }))}
            unit="%"
            height={300}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>{activityName(shown)}</h2>
          <p className="panel-sub">
            Elige la actividad; las tres figuras de abajo hablan de ella en {name}, en Santa Cruz y
            en Bolivia. Las ramas aparecen cuando el INE abre el grupo: son las que dicen si lo que
            se movió fue el gas o el mineral dentro de «minas y canteras».
          </p>
        </div>

        <div className="chips">
          {ACTIVITY_GROUPS.map((one) => (
            <button
              key={one.slug}
              type="button"
              aria-pressed={one.slug === shown}
              className={one.slug === shown ? 'chip chip-on' : 'chip'}
              onClick={() => setChosen(one.slug)}
            >
              {one.name}
            </button>
          ))}
        </div>

        {branches.length ? (
          <div className="chips">
            {branches.map((one) => (
              <button
                key={one.slug}
                type="button"
                aria-pressed={one.slug === shown}
                className={one.slug === shown ? 'chip chip-on' : 'chip'}
                onClick={() => setChosen(one.slug)}
              >
                <Icon name="capas" size={12} /> {one.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid-three">
        <div className="panel">
          <div className="panel-head">
            <h2>
              Peso de {activityName(shown).toLocaleLowerCase('es')} en su economía (% del producto)
            </h2>
            <p className="panel-sub">
              La estructura, año a año. Es la figura en la que se ve un cambio de motor: una línea
              que baja mientras las demás no se mueven es una economía que dejó de vivir de algo.
            </p>
          </div>
          {weight.data.length > 1 ? (
            <WorldLines
              data={weight.data}
              series={weight.series}
              format={(value) => `${number(value)} %`}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <div className="callout">El INE no publica esta actividad para {name}.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Crecimiento anual de {activityName(shown).toLocaleLowerCase('es')} (% anual)</h2>
            <p className="panel-sub">
              La variación que el INE publica sobre el nivel a precios constantes de 1990. Donde el
              cuadro nacional no publica el grupo —sí sus ramas— la línea de Bolivia sale del nivel
              sumado, año contra año anterior: sumar variaciones no da la variación de la suma.
            </p>
          </div>
          {growth.data.length > 1 ? (
            <WorldLines
              data={growth.data}
              series={growth.series}
              format={(value) => `${signed(value)} %`}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <div className="callout">Sin variación publicada para esta actividad.</div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>
              Tamaño real de {activityName(shown).toLocaleLowerCase('es')} (índice,{' '}
              {size.base ?? '—'} = 100)
            </h2>
            <p className="panel-sub">
              En índice y no en bolivianos: el país es la suma de los nueve, así que en la escala de
              Bolivia un departamento chico sería una raya pegada al cero. El nivel en miles de
              bolivianos de 1990 sigue en la tabla de cifras del departamento.
            </p>
          </div>
          {size.chart.data.length > 1 ? (
            <WorldLines
              data={size.chart.data}
              series={size.chart.series}
              format={(value) => number(value)}
              tick={(value) => number(value, 0)}
            />
          ) : (
            <div className="callout">Sin nivel publicado para esta actividad.</div>
          )}
        </div>
      </div>
    </>
  );
}
