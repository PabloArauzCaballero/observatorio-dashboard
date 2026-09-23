'use client';

import dynamic from 'next/dynamic';
import { OnOpenNotice } from '@/components/on-open';

/**
 * Las pestañas que se leen al abrirse, cargadas también al abrirse.
 *
 * Ya no traían datos en el documento, pero su código sí viajaba: el mapa de
 * lugares, el explorador de prensa, los paneles macro y sus gráficos iban en el
 * mismo `page.js` que el resumen —419 KB sin comprimir, medidos el 2026-09-23—,
 * y el navegador lo descargaba y analizaba entero antes de que «Hoy» respondiera
 * a un clic. Aquí cada una se parte en su propio trozo, que se pide cuando
 * `Tabs` monta la pestaña.
 *
 * Tiene que ser un módulo de cliente. `next/dynamic` llamado desde la página,
 * que es un componente de servidor, compila y no parte nada: el componente sigue
 * siendo una referencia de cliente de la página y viaja en su trozo. Se probó.
 *
 * El contenido no cambia: son los mismos componentes, que en el servidor ya sólo
 * dibujaban su aviso de espera. Mientras llega el trozo se muestra ese mismo
 * aviso, con el texto de cada sección, para que el lector no vea primero un
 * hueco y después la espera.
 */
export const MacroSection = dynamic(
  () => import('@/components/macro-section').then((module) => module.MacroSection),
  { loading: () => <OnOpenNotice what="las medidas anuales" failed={false} /> },
);
export const FilingsSection = dynamic(
  () => import('@/components/filings-section').then((module) => module.FilingsSection),
  {
    loading: () => (
      <OnOpenNotice what="los hechos relevantes de la Bolsa Boliviana de Valores" failed={false} />
    ),
  },
);
export const CitiesSection = dynamic(
  () => import('@/components/cities-section').then((module) => module.CitiesSection),
  { loading: () => <OnOpenNotice what="el catálogo de lugares" failed={false} /> },
);
export const PressSection = dynamic(
  () => import('@/components/press-section').then((module) => module.PressSection),
  { loading: () => <OnOpenNotice what="el archivo de prensa" failed={false} /> },
);
export const SourcesSection = dynamic(
  () => import('@/components/sources-section').then((module) => module.SourcesSection),
  { loading: () => <OnOpenNotice what="las fuentes" failed={false} /> },
);
export const RoadsSection = dynamic(
  () => import('@/components/roads-section').then((module) => module.RoadsSection),
  { loading: () => <OnOpenNotice what="la red vial" failed={false} /> },
);
