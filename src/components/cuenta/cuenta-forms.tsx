'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import styles from '@/app/cuenta/cuenta.module.css';
import type { ApiKeySummary } from '@/lib/cuenta/puro';
import { Aviso, enviar, errorDe, fechaCorta, useFormulario } from './formulario';
import { PASSWORD_MAX, PASSWORD_MIN } from './limites';

/**
 * Los formularios de la cuenta del cliente. Todos hablan con `/api/cuenta/*`,
 * que es quien convierte la cookie en una llamada al núcleo; el navegador nunca
 * ve una credencial del núcleo. Lo que aquí se esconde o se muestra es solo
 * presentación: cada ruta vuelve a decidir quién puede hacer qué.
 */

const RECUPERAR = '/cuenta/recuperar';

const texto = (datos: FormData, nombre: string): string => String(datos.get(nombre) ?? '');

/** Después de un cambio que cerró esta sesión, de vuelta al ingreso. */
function pideReingreso(datos: unknown): boolean {
  return Boolean((datos as { reingresar?: unknown } | null)?.reingresar);
}

export function IngresarForm({ volver }: { volver: string }) {
  const router = useRouter();
  const { formRef, estado, setEstado, enviando, campo, aviso } = useFormulario();

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const email = texto(datos, 'email').trim();
    const password = texto(datos, 'password');
    if (!email) return setEstado({ tipo: 'error', mensaje: 'Escribir el correo de la cuenta.', campo: 'email' });
    if (!password) return setEstado({ tipo: 'error', mensaje: 'Escribir la contraseña.', campo: 'password' });
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/ingresar', { email, password, volver });
    if (!r.ok) return setEstado(errorDe(r));
    router.replace((r.datos as { volver?: string } | null)?.volver ?? '/cuenta');
    router.refresh();
  };

  const rechazado = estado.tipo === 'error' && estado.codigo === 'UNAUTHORIZED';

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate aria-busy={enviando}>
      <label className={styles.campo}>
        Correo
        <input name="email" type="email" autoComplete="email" required maxLength={254} {...campo('email')} />
      </label>
      <label className={styles.campo}>
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX}
          {...campo('password')}
        />
      </label>
      <div className={styles.acciones}>
        <button className={styles.primario} type="submit" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <Link className={styles.enlace} href={RECUPERAR}>
          Recuperar la clave
        </Link>
      </div>
      <Aviso {...aviso}>
        {rechazado ? (
          <Link className={styles.enlace} href={RECUPERAR}>
            Recuperar la clave
          </Link>
        ) : null}
      </Aviso>
    </form>
  );
}

export function RecuperarForm() {
  const { formRef, setEstado, estado, enviando, campo, aviso } = useFormulario();

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const email = texto(new FormData(evento.currentTarget), 'email').trim();
    if (!email) return setEstado({ tipo: 'error', mensaje: 'Escribir el correo de la cuenta.', campo: 'email' });
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/recuperar', { email });
    if (!r.ok) return setEstado(errorDe(r));
    setEstado({
      tipo: 'hecho',
      mensaje:
        'Si el correo corresponde a una cuenta de DatosBolivia.com, en unos minutos llega un enlace para fijar una contraseña nueva. El enlace sirve una sola vez.',
    });
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate aria-busy={enviando}>
      <label className={styles.campo}>
        Correo de la cuenta
        <input name="email" type="email" autoComplete="email" required maxLength={254} {...campo('email')} />
      </label>
      <div className={styles.acciones}>
        <button className={styles.primario} type="submit" disabled={enviando || estado.tipo === 'hecho'}>
          {enviando ? 'Enviando…' : 'Enviar el enlace'}
        </button>
      </div>
      <Aviso {...aviso} />
    </form>
  );
}

export function ActivarForm({ token, version }: { token: string; version: string }) {
  const router = useRouter();
  const { formRef, estado, setEstado, enviando, campo, aviso } = useFormulario();
  const enlaceVencido = estado.tipo === 'error' && estado.codigo === 'INVALID_TOKEN';

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const password = texto(datos, 'password');
    if (password.length < PASSWORD_MIN) {
      return setEstado({
        tipo: 'error',
        mensaje: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`,
        campo: 'password',
      });
    }
    if (password !== texto(datos, 'repetida')) {
      return setEstado({ tipo: 'error', mensaje: 'Las dos contraseñas no coinciden.', campo: 'repetida' });
    }
    if (datos.get('terminos') !== 'si') {
      return setEstado({ tipo: 'error', mensaje: 'Hace falta aceptar los términos de uso.', campo: 'terminos' });
    }
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/activar', { token, password, terminos: true });
    if (!r.ok) return setEstado(errorDe(r));
    router.replace((r.datos as { volver?: string } | null)?.volver ?? '/cuenta');
    router.refresh();
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate aria-busy={enviando}>
      <label className={styles.campo}>
        Contraseña nueva ({PASSWORD_MIN} caracteres o más)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          {...campo('password')}
        />
      </label>
      <label className={styles.campo}>
        Repetir la contraseña
        <input
          name="repetida"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          {...campo('repetida')}
        />
      </label>
      <label className={styles.casilla}>
        <input name="terminos" type="checkbox" value="si" required {...campo('terminos')} />
        <span>
          Aceptar los{' '}
          <Link href="/terminos" target="_blank" rel="noopener">
            términos de uso
          </Link>{' '}
          de DatosBolivia.com (versión del {version}).
        </span>
      </label>
      <div className={styles.acciones}>
        <button className={styles.primario} type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar la contraseña'}
        </button>
      </div>
      <Aviso {...aviso}>
        {enlaceVencido ? (
          <Link className={styles.enlace} href={RECUPERAR}>
            Pedir un enlace nuevo
          </Link>
        ) : null}
      </Aviso>
    </form>
  );
}

/**
 * Las llaves de la cuenta. La titular las crea y revoca; un miembro las ve
 * (`soloLectura`), porque usa las mismas para consultar la API.
 */
export function LlavesPanel({
  llaves,
  maximo,
  puedeCrear,
  soloLectura = false,
}: {
  llaves: readonly ApiKeySummary[];
  maximo: number;
  puedeCrear: boolean;
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const { formRef, setEstado, enviando, campo, aviso } = useFormulario();
  const [nueva, setNueva] = useState<{ key: string; prefix: string } | null>(null);
  const [copiada, setCopiada] = useState<'si' | 'no' | null>(null);
  const [revocando, setRevocando] = useState<string | null>(null);

  const activas = llaves.filter((llave) => !llave.revokedAt).length;

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const label = texto(new FormData(formulario), 'label').trim();
    if (!label) return setEstado({ tipo: 'error', mensaje: 'Escribir un nombre para la llave.', campo: 'label' });
    setEstado({ tipo: 'enviando' });
    setCopiada(null);
    const r = await enviar('/api/cuenta/llaves', { label });
    if (!r.ok) return setEstado(errorDe(r));
    const datos = r.datos as { key: string; prefix: string };
    setNueva({ key: datos.key, prefix: datos.prefix });
    setEstado({ tipo: 'listo' });
    formulario.reset();
    router.refresh();
  };

  const copiar = async () => {
    if (!nueva) return;
    try {
      await navigator.clipboard.writeText(nueva.key);
      setCopiada('si');
    } catch {
      setCopiada('no');
    }
  };

  const revocar = async (id: string) => {
    if (!window.confirm('La llave dejará de funcionar de inmediato. ¿Revocarla?')) return;
    setRevocando(id);
    const r = await enviar(`/api/cuenta/llaves/${encodeURIComponent(id)}/revocar`);
    setRevocando(null);
    if (!r.ok) return setEstado(errorDe(r));
    setEstado({ tipo: 'listo' });
    router.refresh();
  };

  return (
    <>
      {nueva ? (
        <div className={styles.llaveNueva} role="status">
          <strong>Llave creada. Copiarla ahora: no se vuelve a mostrar.</strong>
          <code>{nueva.key}</code>
          <div className={styles.acciones}>
            <button className={styles.secundario} type="button" onClick={() => void copiar()}>
              {copiada === 'si' ? 'Copiada' : 'Copiar la llave'}
            </button>
            <button className={styles.discreto} type="button" onClick={() => setNueva(null)}>
              Ocultar
            </button>
          </div>
          {copiada === 'no' ? (
            <p className={styles.nota}>El navegador no dejó copiarla. Seleccionar el texto y copiarlo a mano.</p>
          ) : null}
          <p className={styles.nota}>
            DatosBolivia.com guarda solo el prefijo ({nueva.prefix}) para reconocerla. Si se pierde, revocarla y crear
            otra.
          </p>
        </div>
      ) : null}

      {llaves.length === 0 ? (
        <p className={styles.nota}>Todavía no hay llaves en esta cuenta.</p>
      ) : (
        <div className={styles.tablaScroll}>
          <table className={styles.tabla}>
            <caption className={styles.srOnly}>Llaves de API de la cuenta</caption>
            <thead>
              <tr>
                <th scope="col">Prefijo</th>
                <th scope="col">Nombre</th>
                <th scope="col">Creada</th>
                <th scope="col">Último uso</th>
                <th scope="col">{soloLectura ? 'Estado' : <span className={styles.srOnly}>Acción</span>}</th>
              </tr>
            </thead>
            <tbody>
              {llaves.map((llave) => (
                <tr key={llave.apiKeyId} className={llave.revokedAt ? styles.revocada : undefined}>
                  <td>
                    <code>{llave.prefix}…</code>
                  </td>
                  <td>{llave.label ?? '—'}</td>
                  <td>{fechaCorta(llave.createdAt)}</td>
                  <td>{llave.lastUsedAt ? fechaCorta(llave.lastUsedAt) : 'Sin uso'}</td>
                  <td>
                    {llave.revokedAt ? (
                      `Revocada el ${fechaCorta(llave.revokedAt)}`
                    ) : soloLectura ? (
                      'Activa'
                    ) : (
                      <button
                        className={styles.discreto}
                        type="button"
                        disabled={revocando !== null}
                        aria-label={`Revocar la llave ${llave.prefix}${llave.label ? ` (${llave.label})` : ''}`}
                        onClick={() => void revocar(llave.apiKeyId)}
                      >
                        {revocando === llave.apiKeyId ? 'Revocando…' : 'Revocar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {soloLectura ? (
        <p className={`${styles.nota} ${styles.separadaArriba}`}>
          Las llaves las crea y revoca la persona titular de la cuenta.
        </p>
      ) : puedeCrear ? (
        activas < maximo ? (
          <form
            ref={formRef}
            className={styles.formLinea}
            onSubmit={(e) => void crear(e)}
            noValidate
            aria-busy={enviando}
          >
            <label className={styles.campo}>
              Nombre de la llave nueva
              <input
                name="label"
                type="text"
                required
                maxLength={60}
                placeholder="Por ejemplo: informe mensual"
                {...campo('label')}
              />
            </label>
            <button className={styles.primario} type="submit" disabled={enviando}>
              {enviando ? 'Creando…' : 'Crear llave'}
            </button>
          </form>
        ) : (
          <p className={`${styles.nota} ${styles.separadaArriba}`}>
            El plan permite {maximo} {maximo === 1 ? 'llave activa' : 'llaves activas'}. Para crear otra, revocar una.
          </p>
        )
      ) : (
        <p className={`${styles.nota} ${styles.separadaArriba}`}>
          Las llaves se pueden crear mientras la cuenta está vigente.
        </p>
      )}
      <Aviso {...aviso} />
    </>
  );
}

export function ClaveForm() {
  const router = useRouter();
  const { formRef, setEstado, enviando, campo, aviso } = useFormulario();

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const actual = texto(datos, 'actual');
    const nueva = texto(datos, 'nueva');
    if (!actual) return setEstado({ tipo: 'error', mensaje: 'Escribir la contraseña actual.', campo: 'actual' });
    if (nueva.length < PASSWORD_MIN) {
      return setEstado({
        tipo: 'error',
        mensaje: `La contraseña nueva debe tener al menos ${PASSWORD_MIN} caracteres.`,
        campo: 'nueva',
      });
    }
    if (nueva !== texto(datos, 'repetida')) {
      return setEstado({ tipo: 'error', mensaje: 'Las dos contraseñas nuevas no coinciden.', campo: 'repetida' });
    }
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/clave', { actual, nueva });
    if (!r.ok) return setEstado(errorDe(r));
    formulario.reset();
    if (pideReingreso(r.datos)) {
      router.replace('/cuenta/ingresar?listo=1');
      router.refresh();
      return;
    }
    setEstado({ tipo: 'hecho', mensaje: 'La contraseña se cambió. Las sesiones abiertas en otros equipos se cerraron.' });
  };

  return (
    <form ref={formRef} className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate aria-busy={enviando}>
      <label className={styles.campo}>
        Contraseña actual
        <input
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          maxLength={PASSWORD_MAX}
          {...campo('actual')}
        />
      </label>
      <label className={styles.campo}>
        Contraseña nueva ({PASSWORD_MIN} caracteres o más)
        <input
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          {...campo('nueva')}
        />
      </label>
      <label className={styles.campo}>
        Repetir la contraseña nueva
        <input
          name="repetida"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          {...campo('repetida')}
        />
      </label>
      <div className={styles.acciones}>
        <button className={styles.secundario} type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Cambiar la contraseña'}
        </button>
      </div>
      <Aviso {...aviso} />
    </form>
  );
}

/** Cierra las sesiones de la cuenta en los demás equipos; esta sigue abierta. Solo para la titular. */
export function CerrarSesionesBoton() {
  const router = useRouter();
  const { setEstado, enviando, aviso } = useFormulario();

  const cerrar = async () => {
    if (!window.confirm('Se cerrarán las sesiones de la cuenta en todos los demás equipos, también las de los miembros. ¿Seguir?')) {
      return;
    }
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/sesiones/cerrar');
    if (!r.ok) return setEstado(errorDe(r));
    if (pideReingreso(r.datos)) {
      router.replace('/cuenta/ingresar?motivo=sesion');
      router.refresh();
      return;
    }
    setEstado({ tipo: 'hecho', mensaje: 'Las demás sesiones se cerraron. Esta sigue abierta.' });
  };

  return (
    <div className={styles.grupo}>
      <div className={styles.acciones}>
        <button className={styles.secundario} type="button" disabled={enviando} onClick={() => void cerrar()}>
          {enviando ? 'Cerrando…' : 'Cerrar las demás sesiones'}
        </button>
      </div>
      <Aviso {...aviso} />
    </div>
  );
}

export function SalirBoton() {
  const router = useRouter();
  const { setEstado, enviando, aviso } = useFormulario();
  const salir = async () => {
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/salir');
    if (!r.ok) return setEstado(errorDe(r));
    router.replace('/cuenta/ingresar');
    router.refresh();
  };
  return (
    <div className={styles.grupo}>
      <button className={styles.secundario} type="button" disabled={enviando} onClick={() => void salir()}>
        {enviando ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
      <Aviso {...aviso} />
    </div>
  );
}
