'use client';

import { useState } from 'react';
import { useOnOpen } from '@/components/on-open';
import { SubSections } from '@/components/site-layout';
import { TabHeader } from '@/components/ui/tab-header';
import type { PeopleSummary } from '@/lib/people-types';
import { AttentionPage } from './page-attention';
import { ConversationPage } from './page-conversation';
import { MethodPage } from './page-method';
import { PerceivedPage } from './page-perceived';
import { ProfilesPage } from './page-profiles';
import { PeopleProvider } from './people-context';
import { Skeleton } from './people-ui';
import s from './people.module.css';

/**
 * «Personalidades»: quién pesa en Bolivia, medido de dos maneras.
 *
 * Cinco páginas (`site-map.ts`) que comparten un mismo estado —filtros y persona elegida— para
 * que un recorte en «Atención medible» llegue a la lista de «Fichas» y tocar a alguien en
 * cualquier gráfico abra su ficha. El resumen entra una vez; lo pesado de cada persona
 * (evidencia, cuentas, videos) se pide al abrir su ficha.
 */
export function PeopleSection() {
  const [attempt, setAttempt] = useState(0);
  return (
    <>
      <TabHeader
        id="personalidades"
        title="Personalidades de Bolivia"
        lede="Quién pesa en Bolivia, medido de dos maneras: lo que la gente percibe (Ipsos, 2025) y la atención que ya se puede medir en fuentes abiertas. Ninguna mide mérito."
      />
      <Loader key={attempt} onRetry={() => setAttempt((value) => value + 1)} />
    </>
  );
}

function Loader({ onRetry }: { onRetry: () => void }) {
  const { payload, failed } = useOnOpen<PeopleSummary>('/api/personalidades');
  if (failed) {
    return (
      <div className="callout">
        <div className={s.fail}>
          <span>
            No pudimos leer la investigación de personalidades. El resto del informe sigue al día.
          </span>
          <button type="button" className="chip" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  if (!payload) return <Skeleton rows={6} label="Leyendo la investigación de personalidades…" />;
  return (
    <PeopleProvider summary={payload}>
      <SubSections
        enlace
        labels={[
          'Impacto percibido',
          'Atención medible',
          'Fichas',
          'Conversación',
          'Método y calidad',
        ]}
        icons={['diana', 'barras', 'personas', 'ventana', 'info']}
      >
        <PerceivedPage />
        <AttentionPage />
        <ProfilesPage />
        <ConversationPage />
        <MethodPage />
      </SubSections>
    </PeopleProvider>
  );
}
