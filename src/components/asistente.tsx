'use client';

import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * «Preguntale al Observatorio»: el chat que contesta con los datos del tablero.
 *
 * Un botón fijo abre un panel lateral (una hoja a pantalla completa en el
 * teléfono). La conversación vive en `sessionStorage` y viaja con cada
 * pregunta, así el servidor no guarda nada de nadie. Las respuestas traen las
 * pestañas donde ver el detalle, y el botón «Ir a…» cambia la pestaña del
 * tablero con un evento que escucha `Tabs`.
 */

interface Turno {
  rol: 'usuario' | 'asistente';
  texto: string;
  pestanas?: string[];
  fecha?: string;
  error?: boolean;
}

interface RespuestaApi {
  respuesta?: string;
  pestanas?: string[];
  fecha?: string;
  error?: string;
}

const CLAVE = 'observatorio-asistente-v1';
export const EVENTO_PESTANA = 'observatorio:pestana';

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
    sessionStorage.setItem(CLAVE, JSON.stringify(turnos.slice(-30)));
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

  const irA = (pestana: string) => {
    window.dispatchEvent(new CustomEvent(EVENTO_PESTANA, { detail: pestana }));
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
                  Preguntá por el dólar, la inflación, cualquier departamento, la situación política o cómo usar el
                  tablero. Cada respuesta sale de los datos que el Observatorio recoge.
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
              <div key={i} className={`asistente-turno asistente-${t.rol}${t.error ? ' asistente-error' : ''}`}>
                {t.rol === 'asistente' ? <Texto texto={t.texto} /> : <p>{t.texto}</p>}
                {t.pestanas?.length ? (
                  <div className="asistente-ir">
                    {t.pestanas.map((p) => (
                      <button key={p} type="button" className="chip" onClick={() => irA(p)}>
                        Ir a «{p}»
                      </button>
                    ))}
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
            Información general con datos públicos; no es asesoría financiera. No escribas datos personales.
          </p>
        </section>
      ) : null}
    </>
  );
}
