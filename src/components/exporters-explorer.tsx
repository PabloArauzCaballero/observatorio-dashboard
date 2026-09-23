'use client';

import { useMemo } from 'react';
import { ShareBars } from './charts';
import { concentration } from '@/lib/exporters-board';
import type { ExportersBoard } from '@/lib/exporters-board';

/**
 * Quién exporta más: el ránking de las cien primeras, con su cuota.
 *
 * Era el primero de cuatro paneles en una sola página con la reputación y el
 * cruce entre ambas; ahora es una página por sí solo y la reputación es la de
 * al lado (`reputation-explorer.tsx`). Se separaron porque miden cosas
 * distintas con métodos distintos y un lector que las viera en el mismo scroll
 * supondría que una explica a la otra: el orden de exportación sale de
 * registros aduaneros y la reputación de encuestas de percepción, y no hay una
 * fila de aquí que se deduzca de una de allá. El cruce —las ocho que están en
 * las dos listas— vive en la página de reputación, porque es la reputación la
 * que hace la pregunta; aquí sólo se marcan las barras y se remite.
 *
 * **Por qué no hay dólares en ninguna barra.** Bolivia no publica sus
 * exportaciones por empresa: la declaración aduanera individual está amparada
 * por reserva, y lo comprobamos en el INE, en la Aduana Nacional, en el portal
 * de comercio exterior del Ministerio de Desarrollo Productivo y en el Anuario
 * de Minería. La única lista completa con nombres es la de un agregador
 * comercial, y su total de 2024 no cuadra con el del INE sin que la fuente
 * declare sobre qué base está calculado. El orden y la cuota son consistentes
 * consigo mismos y se publican; los dólares no se sostienen y no se publican.
 * El aviso de arriba lo dice en el tablero, no sólo aquí.
 *
 * **Esta página contesta quién, no qué ni a dónde.** Qué producto vende el
 * país, con qué fuente oficial y en qué dólares —los que aquí faltan— está en
 * «Comercio exterior», la pestaña de al lado: mismo capítulo de «Empresas»,
 * pregunta distinta y método distinto. Ninguna fila de una explica una fila
 * de la otra: una es un orden sin dólares y la otra son dólares sin nombre de
 * empresa.
 */

const number = (value: number, decimals = 1): string =>
  value.toLocaleString('es-BO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** La cuota, con una decimal y el signo separado como se escribe en Bolivia. */
export const percent = (value: number): string => `${number(value, 1)} %`;

/** Cuántas exportadoras entran en la figura sin que deje de leerse. */
const SHOWN = 20;

export function ExportersExplorer({ board }: { board: ExportersBoard }) {
  const bars = useMemo(
    () =>
      board.exporters.slice(0, SHOWN).map((row) => ({
        name: `${row.rank}. ${row.name}`,
        value: row.share,
        ...(board.crossings.some((cross) => cross.slug === row.slug) ? { emphasis: true } : {}),
      })),
    [board],
  );

  const marked = bars.filter((bar) => 'emphasis' in bar).length;
  const topTen = concentration(board, 10);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Las mayores exportadoras de Bolivia</h2>
        <p className="panel-sub">
          Orden y cuota de las cien primeras en la gestión {board.exportYear ?? '—'}. Las diez
          primeras concentran el {percent(topTen)} de lo exportado.
        </p>
      </div>
      {/*
        El aviso va arriba del gráfico y no en un pie, porque es la condición
        bajo la cual hay que leer todo lo que sigue. Un lector que llegue a la
        figura sin él creerá que está viendo cifras oficiales.
      */}
      <div className="callout">
        <strong>Bolivia no publica sus exportaciones por empresa.</strong> El INE llega a producto,
        departamento y país de destino; la Aduana Nacional publica agregados; el Anuario de Minería
        separa por actor productivo —estatal, privado, cooperativo— pero nunca por razón social,
        porque la declaración aduanera individual está amparada por reserva. Esta lista viene de un
        agregador comercial de registros aduaneros, y de ella se publica{' '}
        <strong>el orden y la cuota, no los dólares</strong>: el total que esa misma fuente declara
        para {board.exportYear ?? 'la gestión'} no cuadra con el del INE y no dice sobre qué base
        está calculado.
      </div>
      <ShareBars data={bars} unit="%" height={520} />
      {/*
        El recuento dice cuántas de las barras DIBUJADAS van marcadas, y
        aparte cuántas hay en toda la lista. Decir sólo lo segundo dejaba al
        lector contando una marca en pantalla contra una promesa de ocho.
      */}
      <p className="panel-sub">
        Se dibujan las {Math.min(SHOWN, board.exporters.length)} primeras de{' '}
        {board.exporters.length}. Las barras marcadas son las que además están medidas por el
        monitor de reputación: {marked} aquí, {board.crossings.length} en la lista entera. El cruce
        completo está en la pestaña «Reputación empresarial»; qué producto vende el país y a qué
        país, con fuentes oficiales y en dólares, está en «Comercio exterior».
      </p>
    </div>
  );
}
