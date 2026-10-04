'use client';

import { useState } from 'react';
import { CompanyLogo } from './company-logo';
import { SOCIAL_SOURCE } from './company-social-source';
import { Pager } from './pager';
import { Panel } from '@/components/ui/panel';
import type { Choice } from '@/lib/choice';
import {
  PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  type SocialCompany,
  type SocialPlatform,
} from '@/lib/company-social-board';
import {
  companyEngagement,
  companyPace,
  companySentiment,
  followersOf,
} from '@/lib/company-social-view';

/**
 * Las empresas, una fila cada una, con sus cuentas en columnas.
 *
 * Una cuenta que la red no dejó leer muestra por qué —«restringida»,
 * «bloqueada»— en su celda, no un cero ni un guion: un guion es «no tiene
 * cuenta», y no es lo mismo. Tocar el nombre aísla la empresa en los gráficos
 * de abajo; con Ctrl/⌘ se suman varias.
 */

type SortKey = 'merco' | 'total' | 'engagement' | 'pace' | 'net' | SocialPlatform;

const PAGE = 20;
const STATUS_LABEL: Record<string, string> = {
  RESTRICTED: 'restringida',
  BLOCKED: 'bloqueada',
  NOT_FOUND: 'no hallada',
  ERROR: 'ilegible',
};
const SORT_LABEL: Record<SortKey, string> = {
  merco: 'Merco',
  total: 'Total',
  engagement: 'Interacción',
  pace: 'Posts/sem.',
  net: 'Sentimiento',
  ...PLATFORM_LABEL,
};

const count = (value: number): string =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString('es-BO', { maximumFractionDigits: 2 })} M`
    : value >= 10_000
      ? `${(value / 1_000).toLocaleString('es-BO', { maximumFractionDigits: value >= 100_000 ? 0 : 1 })} mil`
      : value.toLocaleString('es-BO');

export function CompanySocialTable({
  companies,
  platforms,
  focus,
  onFocus,
}: {
  companies: readonly SocialCompany[];
  platforms: Choice;
  focus: Choice;
  onFocus: (slug: string, additive: boolean) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; down: boolean }>({ key: 'total', down: true });
  const [offset, setOffset] = useState(0);
  const shownPlatforms = SOCIAL_PLATFORMS.filter(
    (platform) => platforms.size === 0 || platforms.has(platform),
  );

  const valueOf = (company: SocialCompany, key: SortKey): number | null => {
    if (key === 'merco') return company.mercoRank === null ? null : -company.mercoRank;
    if (key === 'total') return followersOf(company, platforms);
    if (key === 'engagement') return companyEngagement(company, platforms);
    if (key === 'pace') return companyPace(company, platforms);
    if (key === 'net') return companySentiment(company, platforms)?.net ?? null;
    return company.accounts.find((account) => account.platform === key)?.followers ?? null;
  };
  const rows = [...companies].sort((left, right) => {
    const a = valueOf(left, sort.key);
    const b = valueOf(right, sort.key);
    if (a === null && b === null) return left.name.localeCompare(right.name, 'es');
    if (a === null) return 1;
    if (b === null) return -1;
    return sort.down ? b - a : a - b;
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const page = Math.min(pages, Math.floor(offset / PAGE) + 1);
  const shown = rows.slice((page - 1) * PAGE, page * PAGE);

  const head = (key: SortKey, numeric = true) => {
    const active = sort.key === key;
    return (
      <th
        key={key}
        className={numeric ? 'num' : undefined}
        aria-sort={active ? (sort.down ? 'descending' : 'ascending') : 'none'}
      >
        <button
          type="button"
          className={active ? 'roads-sort roads-sort-on' : 'roads-sort'}
          onClick={() => {
            setSort((current) => ({ key, down: current.key === key ? !current.down : true }));
            setOffset(0);
          }}
        >
          {SORT_LABEL[key]}
          <span aria-hidden="true">{active ? (sort.down ? ' ↓' : ' ↑') : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <Panel
      id="empresas-redes-tabla"
      title="Seguidores por red y empresa (cuentas declaradas; interacción en %, sentimiento en puntos)"
      lede={`${rows.length} empresas con los filtros puestos.`}
      source={SOCIAL_SOURCE}
      data={() => ({
        unidad: 'seguidores',
        columnas: [
          'Empresa',
          'Puesto Merco',
          ...shownPlatforms.map((platform) => `${PLATFORM_LABEL[platform]} (seguidores)`),
          'Total de seguidores',
          'Interacción por post (%)',
          'Posts por semana',
          'Sentimiento neto (puntos)',
          'Comentarios clasificados',
        ],
        filas: rows.map((company) => {
          const sentiment = companySentiment(company, platforms);
          return [
            company.name,
            company.mercoRank,
            ...shownPlatforms.map((platform) => {
              const account = company.accounts.find((one) => one.platform === platform);
              if (!account) return null;
              if (account.status !== 'OK') return STATUS_LABEL[account.status] ?? account.status;
              return account.followers;
            }),
            followersOf(company, platforms),
            companyEngagement(company, platforms),
            companyPace(company, platforms),
            sentiment ? Math.round(sentiment.net) : null,
            sentiment ? sentiment.analyzed : null,
          ];
        }),
      })}
    >
      <details className="panel-note">
        <summary>Cómo leerlo</summary>
        <p>
          «Interacción» es la mediana de interacciones por post sobre seguidores; «Sentimiento», %
          de comentarios positivos menos % negativos. Toca un encabezado para ordenar y una empresa
          para aislarla abajo.
        </p>
      </details>
      <Pager
        page={page}
        pages={pages}
        first={rows.length ? (page - 1) * PAGE + 1 : 0}
        last={(page - 1) * PAGE + shown.length}
        total={rows.length}
        pageSize={PAGE}
        onGo={setOffset}
        where="arriba"
        noun="empresas"
      />
      {rows.length === 0 ? (
        <div className="callout">Ninguna empresa coincide con los filtros.</div>
      ) : (
        <div className="table-wrap">
          <table className="grid-table social-table">
            <thead>
              <tr>
                <th>Empresa</th>
                {head('merco')}
                {shownPlatforms.map((platform) => head(platform))}
                {head('total')}
                {head('engagement')}
                {head('pace')}
                {head('net')}
              </tr>
            </thead>
            <tbody>
              {shown.map((company) => {
                const on = focus.has(company.slug);
                const sentiment = companySentiment(company, platforms);
                const engagement = companyEngagement(company, platforms);
                const pace = companyPace(company, platforms);
                const total = followersOf(company, platforms);
                return (
                  <tr key={company.slug} className={on ? 'roads-row-on' : undefined}>
                    <td>
                      <button
                        type="button"
                        className="social-company"
                        aria-pressed={on}
                        onClick={(event) =>
                          onFocus(company.slug, event.ctrlKey || event.metaKey || event.shiftKey)
                        }
                      >
                        <CompanyLogo slug={company.slug} name={company.name} size={24} />
                        <span>{company.name}</span>
                      </button>
                    </td>
                    <td className="num">{company.mercoRank ?? '—'}</td>
                    {shownPlatforms.map((platform) => {
                      const account = company.accounts.find((one) => one.platform === platform);
                      if (!account)
                        return (
                          <td key={platform} className="num social-none">
                            —
                          </td>
                        );
                      if (account.status !== 'OK') {
                        return (
                          <td
                            key={platform}
                            className="num social-unread"
                            title={account.note ?? ''}
                          >
                            {STATUS_LABEL[account.status] ?? account.status}
                          </td>
                        );
                      }
                      return (
                        <td key={platform} className="num">
                          <a
                            href={account.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`@${account.handle}`}
                          >
                            {account.followers === null ? 's/d' : count(account.followers)}
                          </a>
                        </td>
                      );
                    })}
                    <td className="num">
                      <b>{total === null ? '—' : count(total)}</b>
                    </td>
                    <td className="num">
                      {engagement === null
                        ? '—'
                        : `${engagement.toLocaleString('es-BO', { maximumFractionDigits: 2 })} %`}
                    </td>
                    <td className="num">
                      {pace === null
                        ? '—'
                        : pace.toLocaleString('es-BO', { maximumFractionDigits: 1 })}
                    </td>
                    <td
                      className="num"
                      title={
                        sentiment
                          ? `${sentiment.analyzed} comentarios`
                          : 'sin comentarios clasificados'
                      }
                    >
                      {sentiment
                        ? `${sentiment.net > 0 ? '+' : ''}${Math.round(sentiment.net)} (${sentiment.analyzed})`
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
