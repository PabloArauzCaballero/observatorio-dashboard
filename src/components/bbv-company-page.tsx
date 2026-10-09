'use client';

import { useState } from 'react';
import { AbiNewsExplorer } from './abi-news-explorer';
import { FilingExplorer } from './filing-explorer';
import { OnOpenNotice, useOnOpen } from './on-open';
import type { CompanyFiling } from '@/lib/series';

export function BbvCompanyPage() {
  const [news, setNews] = useState(false);
  const [issuer, setIssuer] = useState('');
  return <>
    <div className="pager" role="group" aria-label="Información de los emisores">
      <button type="button" aria-pressed={!news} onClick={() => setNews(false)}>Hechos relevantes BBV</button>
      <button type="button" aria-pressed={news} onClick={() => { setIssuer(''); setNews(true); }}>Noticias ABI</button>
    </div>
    {news ? <AbiNewsExplorer key={issuer} initialIssuer={issuer} /> : <Filings onReadNews={code => { setIssuer(code); setNews(true); }} />}
  </>;
}
function Filings({ onReadNews }: { onReadNews: (code: string) => void }) {
  const { payload, failed } = useOnOpen<{ filings: CompanyFiling[] }>('/api/empresas');
  if (!payload) return <OnOpenNotice what="los hechos relevantes de la Bolsa Boliviana de Valores" failed={failed} />;
  if (!payload.filings.length) return <div className="callout">Todavía no hay hechos relevantes cargados.</div>;
  return <FilingExplorer filings={payload.filings} onReadNews={onReadNews} />;
}
