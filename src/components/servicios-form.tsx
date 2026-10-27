'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { INQUIRY_PLANS, type InquiryPlan } from '@/lib/plans';
import styles from '@/app/servicios/servicios.module.css';

/**
 * Un UUID v4. `crypto.randomUUID` solo existe en contextos seguros, y el sitio
 * también se sirve por http a la IP cruda del servidor cuando el dominio está
 * bloqueado: ahí `getRandomValues`, que sí existe, arma el mismo formato.
 */
function nuevoUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type Estado =
  | { tipo: 'listo' }
  | { tipo: 'enviando' }
  | { tipo: 'enviado'; mensaje: string }
  | { tipo: 'error'; mensaje: string; campo: string | null };

/**
 * El formulario de pedido de un plan o de un informe a medida.
 *
 * Lleva dos defensas que una persona no ve: un campo trampa (`sitio_web`) que
 * solo llena un robot, y el instante en que se dibujó el formulario, porque
 * nadie escribe nombre, correo y mensaje en menos de tres segundos. El
 * identificador del pedido se fija al abrir: si la conexión falla y se reenvía,
 * el núcleo reconoce el mismo pedido y no lo guarda dos veces.
 */
export function ServiciosForm({ planInicial }: { planInicial: InquiryPlan }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });
  const [plan, setPlan] = useState<InquiryPlan>(planInicial);
  const abierto = useRef(0);
  const pedido = useRef('');

  useEffect(() => {
    abierto.current = Date.now();
    pedido.current = nuevoUuid();
  }, []);

  // Un enlace «Pedir este plan» más abajo en la página cambia la elección sin recargar.
  useEffect(() => setPlan(planInicial), [planInicial]);

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const campo = (nombre: string): string => String(datos.get(nombre) ?? '');
    setEstado({ tipo: 'enviando' });
    try {
      const respuesta = await fetch('/api/servicios/contacto', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          requestId: pedido.current,
          abierto: abierto.current,
          sitio_web: campo('sitio_web'),
          fullName: campo('fullName'),
          email: campo('email'),
          organization: campo('organization'),
          phone: campo('phone'),
          planCode: plan,
          message: campo('message'),
          sourceRoute: `${location.pathname}${location.search}`,
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as {
        mensaje?: string;
        error?: string;
        campo?: string | null;
      };
      if (respuesta.ok) {
        setEstado({ tipo: 'enviado', mensaje: cuerpo.mensaje ?? 'Pedido recibido.' });
        return;
      }
      setEstado({
        tipo: 'error',
        mensaje: cuerpo.error ?? 'No se pudo enviar el pedido. Volver a intentar en unos minutos.',
        campo: cuerpo.campo ?? null,
      });
    } catch {
      setEstado({
        tipo: 'error',
        mensaje: 'Sin conexión con el servidor. Comprobar la red y volver a intentar.',
        campo: null,
      });
    }
  };

  if (estado.tipo === 'enviado') {
    return (
      <p className={styles.enviado} role="status">
        {estado.mensaje}
      </p>
    );
  }

  const invalido = (nombre: string) =>
    estado.tipo === 'error' && estado.campo === nombre ? true : undefined;
  const enviando = estado.tipo === 'enviando';

  return (
    <form className={styles.form} onSubmit={(evento) => void enviar(evento)} noValidate>
      <div className={styles.fila}>
        <label className={styles.campo}>
          <span>Nombre</span>
          <input name="fullName" autoComplete="name" required minLength={2} maxLength={120} aria-invalid={invalido('fullName')} />
        </label>
        <label className={styles.campo}>
          <span>Correo</span>
          <input name="email" type="email" autoComplete="email" required maxLength={200} aria-invalid={invalido('email')} />
        </label>
      </div>
      <div className={styles.fila}>
        <label className={styles.campo}>
          <span>
            Organización <em>(opcional)</em>
          </span>
          <input name="organization" autoComplete="organization" maxLength={160} aria-invalid={invalido('organization')} />
        </label>
        <label className={styles.campo}>
          <span>
            Teléfono o WhatsApp <em>(opcional)</em>
          </span>
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} aria-invalid={invalido('phone')} />
        </label>
      </div>
      <label className={styles.campo}>
        <span>Plan</span>
        <select
          name="planCode"
          value={plan}
          onChange={(evento) => setPlan(evento.target.value as InquiryPlan)}
          aria-invalid={invalido('planCode')}
        >
          {INQUIRY_PLANS.map((opcion) => (
            <option key={opcion.code} value={opcion.code}>
              {opcion.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.campo}>
        <span>Qué datos o qué informe se necesita</span>
        <textarea
          name="message"
          rows={5}
          required
          minLength={10}
          maxLength={4000}
          aria-invalid={invalido('message')}
          placeholder="Por ejemplo: series del tipo de cambio por API para un reporte semanal, o un estudio de comercio exterior de un rubro."
        />
      </label>
      {/* La trampa: fuera de la vista y del teclado. Una persona no la ve; un robot la llena. */}
      <label className={styles.trampa} aria-hidden="true">
        Sitio web
        <input name="sitio_web" tabIndex={-1} autoComplete="off" />
      </label>
      {estado.tipo === 'error' ? (
        <p className={styles.error} role="alert">
          {estado.mensaje}
        </p>
      ) : null}
      <div className={styles.acciones}>
        <button type="submit" className={styles.enviar} disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar pedido'}
        </button>
        <span className={styles.nota}>
          Los datos del formulario se usan solo para contestar el pedido.
        </span>
      </div>
    </form>
  );
}
