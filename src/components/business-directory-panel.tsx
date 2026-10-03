'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  directoryApiUrl,
  directoryExcelUrl,
  directoryUnavailableMessage,
  type BusinessDirectoryFilters,
  type BusinessDirectoryPage,
} from '@/lib/business-directory-contract';
import { Icon } from './icons';
import styles from './business.module.css';

const say = (value: number): string => value.toLocaleString('es-BO');

export function BusinessDirectoryPanel() {
  const [filters, setFilters] = useState<BusinessDirectoryFilters>({ page: 1 });
  const [search, setSearch] = useState('');
  const [result, setResult] = useState<BusinessDirectoryPage | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    void fetch(directoryApiUrl(filters), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Directorio: HTTP ${response.status}`);
        return (await response.json()) as BusinessDirectoryPage;
      })
      .then((payload) => {
        setResult(payload);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [attempt, filters]);

  const submitSearch = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setFilters((current) => ({ ...current, search, page: 1 }));
  };
  const pageCount = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;
  const maxTerm = Math.max(...(result?.terms.map((term) => term.value) ?? [1]));

  return (
    <section className="panel" aria-labelledby="directorio-empresarial-titulo">
      <div className="panel-head panel-head-kind">
        <div>
          <h2 id="directorio-empresarial-titulo">Directorio de empresas disponible</h2>
          <p className="panel-sub">
            Nombres y datos públicos de los registros SEPREC reunidos por el Observatorio. La cobertura es parcial:
            la base oficial completa se solicita mediante el Trámite 58 del SEPREC.
          </p>
        </div>
        <a className="chip" href={directoryExcelUrl(filters)} aria-label="Descargar todas las empresas filtradas en Excel">
          <Icon name="descarga" size={13} /> Excel
        </a>
      </div>

      {status === 'error' ? (
        <div className="callout" role="status">
          {directoryUnavailableMessage()}{' '}
          <button type="button" className="chip" onClick={() => setAttempt((value) => value + 1)}>
            Reintentar
          </button>
        </div>
      ) : null}

      {result ? (
        <>
          <div className={styles.directorySummary}>
            <strong>{say(result.total)} coincidencias</strong>
            <span>
              Cobertura {result.meta.coverage.toLocaleLowerCase('es')} · {say(result.meta.availableRecords)} registros disponibles
            </span>
            <span>{result.meta.cutDate ? `Corte ${new Date(result.meta.cutDate).toLocaleDateString('es-BO')}` : 'Corte no declarado por la fuente'}</span>
          </div>

          <form className={styles.directoryFilters} onSubmit={submitSearch}>
            <label>
              <span>Buscar nombre</span>
              <input
                type="search"
                value={search}
                placeholder="Ej.: Cóndor"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label>
              <span>Departamento</span>
              <select
                value={filters.department ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value, municipality: '', page: 1 }))}
              >
                <option value="">Todos</option>
                {result.meta.departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
            <label>
              <span>Municipio</span>
              <select
                value={filters.municipality ?? ''}
                onChange={(event) => setFilters((current) => ({ ...current, municipality: event.target.value, page: 1 }))}
              >
                <option value="">Todos</option>
                {result.meta.municipalities.map((municipality) => <option key={municipality} value={municipality}>{municipality}</option>)}
              </select>
            </label>
            <button type="submit" className="chip chip-on">Buscar</button>
          </form>

          {result.terms.length ? (
            <div className={styles.wordCloudBlock}>
              <div className={styles.subhead}>Palabras más repetidas en los nombres de empresas</div>
              <div className={styles.wordCloud} aria-label="Nube de palabras de nombres empresariales">
                {result.terms.map((term) => {
                  const selected = filters.word === term.term;
                  const scale = 0.82 + (term.value / maxTerm) * 1.05;
                  return (
                    <button
                      key={term.term}
                      type="button"
                      className={selected ? styles.wordOn : styles.word}
                      style={{ fontSize: `${scale}rem` }}
                      aria-pressed={selected}
                      title={`${say(term.value)} empresas`}
                      onClick={() => setFilters((current) => ({ ...current, word: selected ? '' : term.term, page: 1 }))}
                    >
                      {term.label} <small>{say(term.value)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {status === 'loading' ? <p className={styles.foot}>Actualizando directorio…</p> : null}
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th>Municipio</th>
                  <th>Dirección declarada</th>
                  <th>Categoría disponible</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((company) => (
                  <tr key={company.placeId}>
                    <td>{company.registrationId}</td>
                    <td><strong>{company.name}</strong></td>
                    <td>{company.department ?? '—'}</td>
                    <td>{company.municipality ?? '—'}</td>
                    <td>{company.address ?? '—'}</td>
                    <td>{company.activity ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.rows.length ? <div className="callout">No hay empresas que coincidan con estos filtros.</div> : null}

          <div className={styles.directoryPager} aria-label="Paginación del directorio">
            <button
              type="button"
              className="chip"
              disabled={result.page <= 1}
              onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, result.page - 1) }))}
            >
              Anterior
            </button>
            <span>Página {result.page} de {pageCount}</span>
            <button
              type="button"
              className="chip"
              disabled={result.page >= pageCount}
              onClick={() => setFilters((current) => ({ ...current, page: Math.min(pageCount, result.page + 1) }))}
            >
              Siguiente
            </button>
          </div>
          <p className={styles.foot}>{result.meta.note} {result.meta.licence}.</p>
        </>
      ) : status === 'loading' ? (
        <div className="callout" role="status">Cargando directorio empresarial…</div>
      ) : null}
    </section>
  );
}
