'use client';

import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import { aCsv, aMarkdown, celdaLegible, decimalesPorColumna, nombreDeArchivo, type Tabla } from '@/lib/asistente/tabla';
import { reportDownloadIntent } from '@/lib/analytics';
import { navegar, type Destino } from '@/lib/enlace-tablero';

/**
 * «Preguntale al Observatorio»: el chat que contesta con los datos del tablero.
 *
 * Un botón fijo abre un panel lateral (una hoja a pantalla completa en el
 * teléfono). La conversación vive en `sessionStorage` y viaja con cada
 * pregunta, así el servidor no guarda nada de nadie. Las respuestas traen
 * enlaces reales a la pestaña y la página donde ver el detalle (se pueden
 * copiar o abrir aparte), las tablas con las cifras que se usaron para
 * contestar —con su CSV— y la opción de bajar la respuesta entera.
 */

interface Enlace extends Destino {
  etiqueta: string;
  href: string;
}

interface Turno {
  rol: 'usuario' | 'asistente';
  texto: string;
  /** Las respuestas guardadas antes de los enlaces solo traen la pestaña. */
  pestanas?: string[];
  enlaces?: Enlace[];
  tablas?: Tabla[];
  fecha?: string;
  error?: boolean;
}

interface RespuestaApi {
  respuesta?: string;
  pestanas?: string[];
  enlaces?: Enlace[];
  tablas?: Tabla[];
  fecha?: string;
  error?: string;
}

const CLAVE = 'observatorio-asistente-v1';
/** Solo las últimas respuestas guardan sus tablas: el almacenamiento de la pestaña es chico. */
const TURNOS_CON_TABLAS = 12;
/** Cuántas filas se ven en la vista previa; el CSV lleva todas. */
const FILAS_A_LA_VISTA = 8;

const SUGERENCIAS = [
  '¿Cómo está el dólar hoy?',
  '¿Debería invertir ahora?',
  '¿Qué muestran los datos sobre la situación política?',
  '¿Cómo le va a la economía de Santa Cruz?',
  '¿Cómo están la inflación y las reservas?',
  '¿Cómo descargo los datos?',
];

function leerGuardado(): Turno[] {
  try {
    const bruto = sessionStorage.getItem(CLAVE);
    const valor: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(valor) ? (valor as Turno[]).slice(-30) : [];
  } catch {
    return [];
  }
}

function guardar(turnos: Turno[]): void {
  try {
    const recientes = turnos.slice(-30);
    const livianos = recientes.map((t, i) => {
      if (i >= recientes.length - TURNOS_CON_TABLAS || !t.tablas) return t;
      const { tablas: _descartadas, ...resto } = t;
      return resto;
    });
    sessionStorage.setItem(CLAVE, JSON.stringify(livianos));
  } catch {
    // Sin almacenamiento (ventana privada, bloqueado): la conversación vive solo en memoria.
  }
}

/** Negrita y cursiva de la respuesta, sin interpretar HTML. */
function enLinea(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((parte, i) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length > 4) return <strong key={i}>{parte.slice(2, -2)}</strong>;
    if (parte.startsWith('_') && parte.endsWith('_') && parte.length > 2) return <em key={i}>{parte.slice(1, -1)}</em>;
    return <Fragment key={i}>{parte}</Fragment>;
  });
}

/** Párrafos y viñetas «- », que es toda la forma que el asistente usa. */
function Texto({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  let vinetas: string[] = [];
  const cerrar = () => {
    if (vinetas.length) {
      bloques.push(
        <ul key={`ul-${bloques.length}`}>
          {vinetas.map((v, i) => (
            <li key={i}>{enLinea(v)}</li>
          ))}
        </ul>,
      );
      vinetas = [];
    }
  };
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (/^[-*•]\s+/.test(limpia)) {
      vinetas.push(limpia.replace(/^[-*•]\s+/, ''));
      continue;
    }
    cerrar();
    if (limpia) bloques.push(<p key={`p-${bloques.length}`}>{enLinea(limpia.replace(/^#+\s*/, ''))}</p>);
  }
  cerrar();
  return <>{bloques}</>;
}

/** Baja un archivo armado en el navegador, sin volver a pedirle nada al servidor. */
function bajar(nombre: string, contenido: string, tipo: string): void {
  reportDownloadIntent(`asistente-${nombre.split('.').pop() ?? 'archivo'}`);
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** La respuesta entera como Markdown: la pregunta, el texto, los enlaces y las tablas. */
function respuestaComoMarkdown(pregunta: string | undefined, turno: Turno): string {
  const origen = window.location.origin;
  const partes = [
    '# Observatorio Económico de Bolivia',
    pregunta ? `**Pregunta:** ${pregunta}` : '',
    turno.fecha ? `**Datos al:** ${turno.fecha}` : '',
    turno.texto,
    turno.enlaces?.length
      ? ['## Dónde verlo en el tablero', ...turno.enlaces.map((e) => `- [${e.etiqueta}](${origen}${e.href})`)].join('\n')
      : '',
    turno.tablas?.length ? ['## Datos consultados', ...turno.tablas.map(aMarkdown)].join('\n\n') : '',
  ];
  return `${partes.filter(Boolean).join('\n\n')}\n`;
}

function VistaPrevia({ tabla, fecha }: { tabla: Tabla; fecha: string }) {
  const visibles = tabla.filas.slice(0, FILAS_A_LA_VISTA);
  const resto = tabla.filas.length - visibles.length;
  const decimales = decimalesPorColumna(tabla);
  return (
    <details className="asistente-datos">
      <summary>
        {tabla.titulo} <em>{tabla.filas.length === 1 ? '1 fila' : `${tabla.filas.length} filas`}</em>
      </summary>
      <div className="asistente-tabla" tabIndex={0} role="region" aria-label={`Vista previa: ${tabla.titulo}`}>
        <table>
          <thead>
            <tr>
              {tabla.columnas.map((c, j) => (
                <th key={j} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className={typeof celda === 'number' ? 'num' : undefined}>
                    {celdaLegible(celda, decimales[j] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="asistente-fuente">
        Fuente: {tabla.fuente}.{resto > 0 ? ` La vista muestra ${visibles.length}; el CSV trae las ${tabla.filas.length}.` : ''}
      </p>
      <div className="asistente-ir">
        <button
          type="button"
          className="chip"
          onClick={() => bajar(nombreDeArchivo(tabla.id, fecha, 'csv'), aCsv(tabla, fecha), 'text/csv;charset=utf-8')}
        >
          Descargar CSV
        </button>
        {tabla.completa ? (
          <a className="chip" href={tabla.completa.href} download>
            {tabla.completa.etiqueta} (CSV)
          </a>
        ) : null}
      </div>
    </details>
  );
}

function Burbuja() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M8.5 10.5h7M8.5 13.5h4.5" />
    </svg>
  );
}

export function Asistente() {
  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [borrador, setBorrador] = useState('');
  const [esperando, setEsperando] = useState(false);
  const [activo, setActivo] = useState<boolean | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const titulo = useId();

  useEffect(() => setTurnos(leerGuardado()), []);

  useEffect(() => {
    if (!abierto || activo !== null) return;
    fetch('/api/asistente', { cache: 'no-store' })
      .then((r) => r.json() as Promise<{ activo?: boolean }>)
      .then((e) => setActivo(Boolean(e.activo)))
      .catch(() => setActivo(true));
  }, [abierto, activo]);

  useEffect(() => {
    if (abierto) entrada.current?.focus();
  }, [abierto]);

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' });
  }, [turnos, esperando]);

  useEffect(() => {
    if (!abierto) return;
    const alEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', alEscape);
    return () => window.removeEventListener('keydown', alEscape);
  }, [abierto]);

  const preguntar = useCallback(
    async (pregunta: string) => {
      const texto = pregunta.trim();
      if (!texto || esperando) return;
      const previos = turnos.filter((t) => !t.error);
      const conPregunta: Turno[] = [...turnos, { rol: 'usuario', texto }];
      setTurnos(conPregunta);
      guardar(conPregunta);
      setBorrador('');
      setEsperando(true);
      let nuevo: Turno;
      try {
        const r = await fetch('/api/asistente', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            pregunta: texto,
            historial: previos.slice(-6).map((t) => ({ rol: t.rol, texto: t.texto })),
          }),
        });
        const datos = (await r.json().catch(() => ({}))) as RespuestaApi;
        nuevo =
          r.ok && datos.respuesta
            ? {
                rol: 'asistente',
                texto: datos.respuesta,
                ...(datos.pestanas ? { pestanas: datos.pestanas } : {}),
                ...(datos.enlaces?.length ? { enlaces: datos.enlaces } : {}),
                ...(datos.tablas?.length ? { tablas: datos.tablas } : {}),
                ...(datos.fecha ? { fecha: datos.fecha } : {}),
              }
            : { rol: 'asistente', texto: datos.error ?? 'No se pudo responder. Probá de nuevo.', error: true };
      } catch {
        nuevo = { rol: 'asistente', texto: 'No hay conexión con el servidor. Revisá tu red y probá de nuevo.', error: true };
      }
      const final = [...conPregunta, nuevo];
      setTurnos(final);
      guardar(final);
      setEsperando(false);
    },
    [esperando, turnos],
  );

  /*
   * El enlace es un <a> de verdad: se copia, se abre en otra pestaña con la
   * rueda o Ctrl+clic, y quien lo recibe llega al mismo lugar. El clic simple
   * no recarga la página: cambia la dirección y el tablero la sigue.
   */
  const irA = (destino: Destino, evento?: MouseEvent<HTMLAnchorElement>) => {
    if (evento && (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey)) return;
    evento?.preventDefault();
    navegar(destino);
    if (window.matchMedia('(max-width: 720px)').matches) setAbierto(false);
    document.querySelector('nav.tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const reiniciar = () => {
    setTurnos([]);
    guardar([]);
    entrada.current?.focus();
  };

  const ultimaPregunta = [...turnos].reverse().find((t) => t.rol === 'usuario')?.texto;

  return (
    <>
      {!abierto ? (
        <button type="button" className="asistente-lanzador" onClick={() => setAbierto(true)} aria-haspopup="dialog">
          <Burbuja />
          <span>Preguntale al Observatorio</span>
        </button>
      ) : null}

      {abierto ? (
        <section className="asistente-panel" role="dialog" aria-modal="false" aria-labelledby={titulo}>
          <header className="asistente-cabecera">
            <span className="asistente-marca" aria-hidden="true">
              <Burbuja />
            </span>
            <div>
              <h2 id={titulo}>Preguntale al Observatorio</h2>
              <p>Responde con los datos del tablero, con su fecha</p>
            </div>
            {turnos.length ? (
              <button type="button" className="asistente-accion" onClick={reiniciar}>
                Nueva
              </button>
            ) : null}
            <button type="button" className="asistente-cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar el asistente">
              ×
            </button>
          </header>

          <div className="asistente-lista" ref={lista} aria-live="polite">
            {turnos.length === 0 ? (
              <div className="asistente-vacio">
                <p>
                  Preguntá por el dólar, la inflación, la economía de cualquier departamento, las instituciones o cómo
                  usar el tablero. Solo contesta temas económicos de Bolivia, con los datos que el Observatorio recoge.
                </p>
                <div className="asistente-sugerencias">
                  {SUGERENCIAS.map((s) => (
                    <button key={s} type="button" className="chip" onClick={() => void preguntar(s)} disabled={activo === false}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {turnos.map((t, i) => (
              <div
                key={i}
                className={`asistente-turno asistente-${t.rol}${t.error ? ' asistente-error' : ''}${t.tablas?.length ? ' asistente-ancho' : ''}`}
              >
                {t.rol === 'asistente' ? <Texto texto={t.texto} /> : <p>{t.texto}</p>}
                {t.enlaces?.length ? (
                  <div className="asistente-ir">
                    {t.enlaces.map((e) => (
                      <a key={e.href} className="chip" href={e.href} onClick={(ev) => irA(e, ev)}>
                        Ir a «{e.etiqueta}»
                      </a>
                    ))}
                  </div>
                ) : t.pestanas?.length ? (
                  <div className="asistente-ir">
                    {t.pestanas.map((p) => (
                      <button key={p} type="button" className="chip" onClick={() => irA({ pestana: p })}>
                        Ir a «{p}»
                      </button>
                    ))}
                  </div>
                ) : null}
                {t.tablas?.length ? (
                  <div className="asistente-consultados">
                    <p className="asistente-rotulo">Datos consultados para esta respuesta</p>
                    {t.tablas.map((tabla) => (
                      <VistaPrevia key={tabla.id} tabla={tabla} fecha={t.fecha ?? ''} />
                    ))}
                  </div>
                ) : null}
                {t.rol === 'asistente' && !t.error && t.fecha ? (
                  <div className="asistente-ir">
                    <button
                      type="button"
                      className="chip"
                      onClick={() =>
                        bajar(
                          nombreDeArchivo('respuesta', t.fecha ?? '', 'md'),
                          respuestaComoMarkdown(
                            turnos
                              .slice(0, i)
                              .reverse()
                              .find((x) => x.rol === 'usuario')?.texto,
                            t,
                          ),
                          'text/markdown;charset=utf-8',
                        )
                      }
                    >
                      Descargar respuesta
                    </button>
                  </div>
                ) : null}
                {t.error && i === turnos.length - 1 && ultimaPregunta ? (
                  <button type="button" className="chip" onClick={() => void preguntar(ultimaPregunta)}>
                    Reintentar
                  </button>
                ) : null}
              </div>
            ))}

            {esperando ? (
              <div className="asistente-turno asistente-asistente asistente-leyendo">
                <span className="asistente-puntos" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Leyendo los datos del tablero…
              </div>
            ) : null}
          </div>

          {activo === false ? (
            <p className="asistente-aviso">El asistente todavía no está disponible en este servidor.</p>
          ) : null}

          <form
            className="asistente-form"
            onSubmit={(e) => {
              e.preventDefault();
              void preguntar(borrador);
            }}
          >
            <label htmlFor={`${titulo}-pregunta`} className="asistente-oculto">
              Tu pregunta
            </label>
            <textarea
              id={`${titulo}-pregunta`}
              ref={entrada}
              value={borrador}
              maxLength={1000}
              rows={2}
              placeholder="Ej.: ¿cómo está el dólar hoy?"
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void preguntar(borrador);
                }
              }}
              disabled={activo === false}
            />
            <button type="submit" className="asistente-enviar" disabled={esperando || !borrador.trim() || activo === false}>
              Preguntar
            </button>
          </form>
          <p className="asistente-pie">
            Información general con datos públicos; no es asesoría financiera. No escribas datos personales ni contraseñas.
          </p>
        </section>
      ) : null}
    </>
  );
}
