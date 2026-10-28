'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import styles from '@/app/cuenta/cuenta.module.css';
import type { MemberSummary } from '@/lib/cuenta/puro';
import { Aviso, enviar, errorDe, fechaCorta, useFormulario } from './formulario';

interface Invitacion {
  nombre: string;
  enlace: string;
  enviado: boolean;
}

/**
 * El equipo de la cuenta, para la titular: quiénes entran con su propio correo
 * y contraseña, sumar a alguien y quitarlo. Cada persona ve el plan, el
 * consumo y las llaves, y cambia su propia contraseña; llaves, equipo y
 * facturación quedan en manos de la titular.
 */
export function EquipoPanel({
  miembros,
  maximo,
  puedeSumar,
}: {
  miembros: readonly MemberSummary[];
  /** Personas que el plan permite sumar además de la titular. */
  maximo: number;
  /** Si la cuenta está vigente: fuera de vigencia no se suma a nadie. */
  puedeSumar: boolean;
}) {
  const router = useRouter();
  const { formRef, setEstado, enviando, campo, aviso } = useFormulario();
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null);
  const [copiado, setCopiado] = useState<'si' | 'no' | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);

  const activos = miembros.filter((miembro) => miembro.status === 'ACTIVE');

  const sumar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const fullName = String(datos.get('fullName') ?? '').trim();
    const email = String(datos.get('email') ?? '').trim();
    if (fullName.length < 2) {
      return setEstado({ tipo: 'error', mensaje: 'Escribir el nombre de la persona.', campo: 'fullName' });
    }
    if (!email) return setEstado({ tipo: 'error', mensaje: 'Escribir el correo de la persona.', campo: 'email' });
    setEstado({ tipo: 'enviando' });
    setCopiado(null);
    const r = await enviar('/api/cuenta/miembros', { fullName, email });
    if (!r.ok) return setEstado(errorDe(r));
    const respuesta = r.datos as { miembro: MemberSummary; enlace: string; enviado: boolean };
    setInvitacion({ nombre: respuesta.miembro.fullName, enlace: respuesta.enlace, enviado: respuesta.enviado });
    setEstado({ tipo: 'listo' });
    formulario.reset();
    router.refresh();
  };

  const copiar = async () => {
    if (!invitacion) return;
    try {
      await navigator.clipboard.writeText(invitacion.enlace);
      setCopiado('si');
    } catch {
      setCopiado('no');
    }
  };

  const quitar = async (miembro: MemberSummary) => {
    if (!window.confirm(`${miembro.fullName} dejará de tener acceso a la cuenta de inmediato. ¿Quitar a esta persona?`)) {
      return;
    }
    setQuitando(miembro.memberId);
    const r = await enviar(`/api/cuenta/miembros/${encodeURIComponent(miembro.memberId)}/quitar`);
    setQuitando(null);
    if (!r.ok) return setEstado(errorDe(r));
    setEstado({ tipo: 'hecho', mensaje: `${miembro.fullName} ya no tiene acceso a la cuenta.` });
    router.refresh();
  };

  return (
    <>
      {invitacion ? (
        <div className={styles.llaveNueva} role="status">
          <strong>
            {invitacion.enviado
              ? `Se envió a ${invitacion.nombre} un correo con el enlace para fijar su contraseña.`
              : `Acceso creado para ${invitacion.nombre}. Hacerle llegar este enlace para que fije su contraseña.`}
          </strong>
          <code>{invitacion.enlace}</code>
          <div className={styles.acciones}>
            <button className={styles.secundario} type="button" onClick={() => void copiar()}>
              {copiado === 'si' ? 'Copiado' : 'Copiar el enlace'}
            </button>
            <button className={styles.discreto} type="button" onClick={() => setInvitacion(null)}>
              Ocultar
            </button>
          </div>
          {copiado === 'no' ? (
            <p className={styles.nota}>El navegador no dejó copiarlo. Seleccionar el texto y copiarlo a mano.</p>
          ) : null}
          <p className={styles.nota}>El enlace sirve una sola vez. Quien lo tenga puede fijar la contraseña de esa persona.</p>
        </div>
      ) : null}

      {activos.length === 0 ? (
        <p className={styles.nota}>Por ahora solo la titular entra a esta cuenta.</p>
      ) : (
        <div className={styles.tablaScroll}>
          <table className={styles.tabla}>
            <caption className={styles.srOnly}>Personas con acceso a la cuenta</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Desde</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className={styles.srOnly}>Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {activos.map((miembro) => (
                <tr key={miembro.memberId}>
                  <td>{miembro.fullName}</td>
                  <td>{miembro.email}</td>
                  <td>{fechaCorta(miembro.createdAt)}</td>
                  <td>{miembro.activated ? 'Activo' : 'Sin activar'}</td>
                  <td>
                    <button
                      className={styles.discreto}
                      type="button"
                      disabled={quitando !== null}
                      aria-label={`Quitar a ${miembro.fullName}`}
                      onClick={() => void quitar(miembro)}
                    >
                      {quitando === miembro.memberId ? 'Quitando…' : 'Quitar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!puedeSumar ? (
        <p className={`${styles.nota} ${styles.separadaArriba}`}>
          Se puede sumar personas mientras la cuenta está vigente.
        </p>
      ) : activos.length < maximo ? (
        <form
          ref={formRef}
          className={styles.formLinea}
          onSubmit={(e) => void sumar(e)}
          noValidate
          aria-busy={enviando}
          aria-label="Sumar una persona a la cuenta"
        >
          <label className={styles.campo}>
            Nombre
            <input name="fullName" type="text" autoComplete="off" required maxLength={120} {...campo('fullName')} />
          </label>
          <label className={styles.campo}>
            Correo
            <input name="email" type="email" autoComplete="off" required maxLength={254} {...campo('email')} />
          </label>
          <button className={styles.primario} type="submit" disabled={enviando}>
            {enviando ? 'Sumando…' : 'Sumar a la cuenta'}
          </button>
        </form>
      ) : (
        <p className={`${styles.nota} ${styles.separadaArriba}`}>
          El plan permite {maximo} {maximo === 1 ? 'persona' : 'personas'} además de la titular. Para sumar otra, quitar
          a una.
        </p>
      )}
      <Aviso {...aviso} />
    </>
  );
}
