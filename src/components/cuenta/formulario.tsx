'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import styles from '@/app/cuenta/cuenta.module.css';

/**
 * Lo que comparten los formularios de la cuenta: el envío a `/api/cuenta/*`,
 * el estado de cada formulario y la forma de mostrar un error.
 *
 * Un error marca su campo con `aria-invalid`, lo enlaza con el mensaje por
 * `aria-describedby` y le pasa el foco; si el error no es de un campo, el foco
 * va al mensaje. Así quien navega con teclado o lector de pantalla llega al
 * problema sin buscarlo.
 */

export type Estado =
  | { tipo: 'listo' }
  | { tipo: 'enviando' }
  | { tipo: 'error'; mensaje: string; campo?: string; codigo?: string }
  | { tipo: 'hecho'; mensaje: string };

export type Envio =
  | { ok: true; status: number; datos: unknown }
  | { ok: false; status: number; mensaje: string; codigo?: string; campo?: string };

/** Manda un POST con JSON y devuelve lo que contestó el servidor, sin lanzar nunca. */
export async function enviar(url: string, cuerpo?: unknown): Promise<Envio> {
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
    const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const error = (datos as { error?: { message?: unknown; code?: unknown; field?: unknown } } | null)?.error;
      return {
        ok: false,
        status: respuesta.status,
        mensaje: typeof error?.message === 'string' ? error.message : 'No se pudo completar. Intentar de nuevo.',
        ...(typeof error?.code === 'string' ? { codigo: error.code } : {}),
        ...(typeof error?.field === 'string' ? { campo: error.field } : {}),
      };
    }
    return { ok: true, status: respuesta.status, datos };
  } catch {
    return { ok: false, status: 0, mensaje: 'Sin conexión con el servidor. Intentar de nuevo.' };
  }
}

/** El estado de error que corresponde a un envío fallido. */
export const errorDe = (envio: Extract<Envio, { ok: false }>): Estado => ({
  tipo: 'error',
  mensaje: envio.mensaje,
  ...(envio.campo ? { campo: envio.campo } : {}),
  ...(envio.codigo ? { codigo: envio.codigo } : {}),
});

/**
 * El estado de un formulario y las piezas para mostrarlo bien.
 *
 * `campo(nombre)` da los atributos de accesibilidad de un control: se esparcen
 * sobre el `<input>`. `aviso` va en el `<Aviso>` del mismo formulario.
 */
export function useFormulario() {
  const formRef = useRef<HTMLFormElement>(null);
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const avisoId = useId();
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });

  useEffect(() => {
    if (estado.tipo !== 'error') return;
    const control = estado.campo ? formRef.current?.elements.namedItem(estado.campo) : null;
    if (control instanceof HTMLElement) control.focus();
    else avisoRef.current?.focus();
  }, [estado]);

  const campo = useCallback(
    (nombre: string): { 'aria-invalid'?: true; 'aria-describedby'?: string } =>
      estado.tipo === 'error' && estado.campo === nombre ? { 'aria-invalid': true, 'aria-describedby': avisoId } : {},
    [estado, avisoId],
  );

  return {
    formRef,
    estado,
    setEstado,
    enviando: estado.tipo === 'enviando',
    campo,
    aviso: { estado, id: avisoId, avisoRef },
  };
}

/**
 * El mensaje de un formulario: un error se anuncia en cuanto aparece; lo hecho,
 * con cortesía. Recibe el foco cuando el error no es de un campo.
 */
export function Aviso({
  estado,
  id,
  avisoRef,
  children,
}: {
  estado: Estado;
  id: string;
  avisoRef: RefObject<HTMLParagraphElement | null>;
  /** Algo más que acompaña al error, como un enlace para seguir. */
  children?: ReactNode;
}) {
  if (estado.tipo === 'error') {
    return (
      <p className={styles.error} role="alert" id={id} ref={avisoRef} tabIndex={-1}>
        {estado.mensaje}
        {children ? <> {children}</> : null}
      </p>
    );
  }
  if (estado.tipo === 'hecho') {
    return (
      <p className={styles.hecho} role="status" id={id} ref={avisoRef} tabIndex={-1}>
        {estado.mensaje}
      </p>
    );
  }
  return null;
}

/** Fecha corta en hora de Bolivia (UTC−4 todo el año): igual en el servidor y en el navegador. */
export const fechaCorta = (valor: string | null): string => {
  if (!valor) return '—';
  const instante = new Date(valor).getTime();
  if (Number.isNaN(instante)) return '—';
  const fecha = new Date(instante - 4 * 60 * 60 * 1000);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(fecha.getUTCDate()).padStart(2, '0')}-${meses[fecha.getUTCMonth()]}-${fecha.getUTCFullYear()}`;
};
