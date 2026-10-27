'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import styles from '@/app/cuenta/cuenta.module.css';
import type { ApiKeySummary } from '@/lib/cuenta/puro';

/**
 * Los formularios de la cuenta del cliente. Todos hablan con `/api/cuenta/*`,
 * que es quien convierte la cookie en una llamada al núcleo; el navegador nunca
 * ve una credencial del núcleo.
 */

type Estado = { tipo: 'listo' } | { tipo: 'enviando' } | { tipo: 'error'; mensaje: string } | { tipo: 'hecho'; mensaje: string };

async function enviar(url: string, cuerpo?: unknown): Promise<{ ok: true; datos: unknown } | { ok: false; mensaje: string }> {
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    });
    const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const mensaje = (datos as { error?: { message?: string } } | null)?.error?.message;
      return { ok: false, mensaje: mensaje ?? 'No se pudo completar. Intentar de nuevo.' };
    }
    return { ok: true, datos };
  } catch {
    return { ok: false, mensaje: 'Sin conexión con el servidor. Intentar de nuevo.' };
  }
}

function Aviso({ estado }: { estado: Estado }) {
  if (estado.tipo === 'error') {
    return (
      <p className={styles.error} role="alert">
        {estado.mensaje}
      </p>
    );
  }
  if (estado.tipo === 'hecho') {
    return (
      <p className={styles.hecho} role="status">
        {estado.mensaje}
      </p>
    );
  }
  return null;
}

export function IngresarForm({ volver }: { volver: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/ingresar', {
      email: String(datos.get('email') ?? ''),
      password: String(datos.get('password') ?? ''),
      volver,
    });
    if (!r.ok) {
      setEstado({ tipo: 'error', mensaje: r.mensaje });
      return;
    }
    router.replace((r.datos as { volver?: string } | null)?.volver ?? '/cuenta');
    router.refresh();
  };

  return (
    <form className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate>
      <label className={styles.campo}>
        Correo
        <input name="email" type="email" autoComplete="email" required maxLength={254} />
      </label>
      <label className={styles.campo}>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      <div className={styles.acciones}>
        <button className={styles.primario} type="submit" disabled={estado.tipo === 'enviando'}>
          {estado.tipo === 'enviando' ? 'Ingresando…' : 'Ingresar'}
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

export function ActivarForm({ token, version }: { token: string; version: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const password = String(datos.get('password') ?? '');
    if (password !== String(datos.get('repetida') ?? '')) {
      setEstado({ tipo: 'error', mensaje: 'Las dos contraseñas no coinciden.' });
      return;
    }
    if (datos.get('terminos') !== 'si') {
      setEstado({ tipo: 'error', mensaje: 'Hace falta aceptar los términos de uso.' });
      return;
    }
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/activar', { token, password, terminos: true });
    if (!r.ok) {
      setEstado({ tipo: 'error', mensaje: r.mensaje });
      return;
    }
    router.replace('/cuenta');
    router.refresh();
  };

  return (
    <form className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate>
      <label className={styles.campo}>
        Contraseña nueva (10 caracteres o más)
        <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </label>
      <label className={styles.campo}>
        Repetir la contraseña
        <input name="repetida" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </label>
      <label className={styles.casilla}>
        <input name="terminos" type="checkbox" value="si" required />
        <span>
          Aceptar los{' '}
          <Link href="/terminos" target="_blank">
            términos de uso
          </Link>{' '}
          de DatosBolivia.com (versión del {version}).
        </span>
      </label>
      <div className={styles.acciones}>
        <button className={styles.primario} type="submit" disabled={estado.tipo === 'enviando'}>
          {estado.tipo === 'enviando' ? 'Guardando…' : 'Guardar la contraseña'}
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

const fechaCorta = (valor: string | null): string => {
  if (!valor) return '—';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '—';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${String(fecha.getDate()).padStart(2, '0')}-${meses[fecha.getMonth()]}-${fecha.getFullYear()}`;
};

export function LlavesPanel({
  llaves,
  maximo,
  puedeCrear,
}: {
  llaves: readonly ApiKeySummary[];
  maximo: number;
  puedeCrear: boolean;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });
  const [nueva, setNueva] = useState<{ key: string; prefix: string } | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [revocando, setRevocando] = useState<string | null>(null);

  const activas = llaves.filter((llave) => !llave.revokedAt).length;

  const crear = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const label = String(new FormData(formulario).get('label') ?? '');
    setEstado({ tipo: 'enviando' });
    setCopiada(false);
    const r = await enviar('/api/cuenta/llaves', { label });
    if (!r.ok) {
      setEstado({ tipo: 'error', mensaje: r.mensaje });
      return;
    }
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
      setCopiada(true);
    } catch {
      setCopiada(false);
    }
  };

  const revocar = async (id: string) => {
    if (!window.confirm('La llave dejará de funcionar de inmediato. ¿Revocarla?')) return;
    setRevocando(id);
    const r = await enviar(`/api/cuenta/llaves/${encodeURIComponent(id)}/revocar`);
    setRevocando(null);
    if (!r.ok) {
      setEstado({ tipo: 'error', mensaje: r.mensaje });
      return;
    }
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
              {copiada ? 'Copiada' : 'Copiar la llave'}
            </button>
            <button className={styles.discreto} type="button" onClick={() => setNueva(null)}>
              Ocultar
            </button>
          </div>
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
            <caption className="sr-only">Llaves de API de la cuenta</caption>
            <thead>
              <tr>
                <th scope="col">Prefijo</th>
                <th scope="col">Nombre</th>
                <th scope="col">Creada</th>
                <th scope="col">Último uso</th>
                <th scope="col">
                  <span className="sr-only">Acción</span>
                </th>
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
                    ) : (
                      <button
                        className={styles.discreto}
                        type="button"
                        disabled={revocando === llave.apiKeyId}
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

      {puedeCrear ? (
        activas < maximo ? (
          <form className={styles.formLinea} onSubmit={(e) => void crear(e)}>
            <label className={styles.campo}>
              Nombre de la llave nueva
              <input name="label" type="text" required maxLength={60} placeholder="Por ejemplo: informe mensual" />
            </label>
            <button className={styles.primario} type="submit" disabled={estado.tipo === 'enviando'}>
              {estado.tipo === 'enviando' ? 'Creando…' : 'Crear llave'}
            </button>
          </form>
        ) : (
          <p className={styles.nota}>
            El plan permite {maximo} {maximo === 1 ? 'llave activa' : 'llaves activas'}. Para crear otra, revocar una.
          </p>
        )
      ) : (
        <p className={styles.nota}>Las llaves se pueden crear mientras la cuenta está vigente.</p>
      )}
      <Aviso estado={estado} />
    </>
  );
}

export function ClaveForm() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' });

  const alEnviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const nueva = String(datos.get('nueva') ?? '');
    if (nueva !== String(datos.get('repetida') ?? '')) {
      setEstado({ tipo: 'error', mensaje: 'Las dos contraseñas nuevas no coinciden.' });
      return;
    }
    setEstado({ tipo: 'enviando' });
    const r = await enviar('/api/cuenta/clave', { actual: String(datos.get('actual') ?? ''), nueva });
    if (!r.ok) {
      setEstado({ tipo: 'error', mensaje: r.mensaje });
      return;
    }
    formulario.reset();
    setEstado({ tipo: 'hecho', mensaje: 'La contraseña se cambió.' });
  };

  return (
    <form className={styles.form} onSubmit={(e) => void alEnviar(e)} noValidate>
      <label className={styles.campo}>
        Contraseña actual
        <input name="actual" type="password" autoComplete="current-password" required maxLength={200} />
      </label>
      <label className={styles.campo}>
        Contraseña nueva (10 caracteres o más)
        <input name="nueva" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </label>
      <label className={styles.campo}>
        Repetir la contraseña nueva
        <input name="repetida" type="password" autoComplete="new-password" required minLength={10} maxLength={200} />
      </label>
      <div className={styles.acciones}>
        <button className={styles.secundario} type="submit" disabled={estado.tipo === 'enviando'}>
          {estado.tipo === 'enviando' ? 'Guardando…' : 'Cambiar la contraseña'}
        </button>
      </div>
      <Aviso estado={estado} />
    </form>
  );
}

export function SalirBoton() {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const salir = async () => {
    setOcupado(true);
    await enviar('/api/cuenta/salir');
    router.replace('/cuenta/ingresar');
    router.refresh();
  };
  return (
    <button className={styles.secundario} type="button" disabled={ocupado} onClick={() => void salir()}>
      {ocupado ? 'Cerrando…' : 'Cerrar sesión'}
    </button>
  );
}
