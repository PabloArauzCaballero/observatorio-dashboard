'use client';

import { OnOpenNotice, useOnOpen } from './on-open';
import type { AutomotiveStudy, AutomotiveOffer } from '@/lib/automotive-analysis';
import type { ReactNode, ComponentProps } from 'react';
import { ShareBars, ChartLegend } from './charts';

export const num = (value: number, decimals = 0) => value.toLocaleString('es-BO', { maximumFractionDigits: decimals });
export const price = (offer: AutomotiveOffer) => `${offer.currency} ${num(offer.price)}`;
export const studyDownloads = [
  { etiqueta: 'Informe empresarial imprimible (HTML)', href: '/reports/automotor-2026-10-04.html' },
  { etiqueta: 'Estudio completo y fuentes (JSON)', href: '/api/transporte/estudio' },
  { etiqueta: 'Precios y condiciones (CSV)', href: '/api/transporte/estudio?formato=csv&conjunto=offers' },
  { etiqueta: 'Red comercial (CSV)', href: '/api/transporte/estudio?formato=csv&conjunto=dealers' },
];

export function StudyBars(props: ComponentProps<typeof ShareBars>) {
  return <><ShareBars {...props} /><ChartLegend items={[{ color: props.tone ?? 'var(--official)', label: `Valores publicados (${props.unit ?? '%'})` }]} /></>;
}

export function StudyLoader({ children }: { children: (study: AutomotiveStudy) => ReactNode }) {
  const { payload, failed } = useOnOpen<{ study: AutomotiveStudy; catalogOrigin: string }>('/api/transporte/estudio');
  if (!payload) return <OnOpenNotice what="el estudio automotor" failed={failed} />;
  return <div className="automotive-study">{children(payload.study)}</div>;
}

export function Evidence({ study, ids }: { study: AutomotiveStudy; ids: string[] }) {
  return <span className="automotive-evidence">{ids.map(id => {
    const source = study.sources.find(row => row.id === id);
    return source ? <a key={id} href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : null;
  })}</span>;
}

export function StudyCaveat({ study }: { study: AutomotiveStudy }) {
  return <div className="callout"><strong>Corte: {study.observedAt}.</strong> Ofertas observadas y registros oficiales con períodos distintos. Los anuncios no acreditan stock, precio final ni ventas. <a href="/api/transporte/estudio">Descargar evidencia y condiciones</a>.</div>;
}
