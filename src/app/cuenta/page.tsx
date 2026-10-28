import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Masthead } from '@/components/masthead';
import { CerrarSesionesBoton, ClaveForm, LlavesPanel, SalirBoton } from '@/components/cuenta/cuenta-forms';
import { EquipoPanel } from '@/components/cuenta/equipo-panel';
import { FacturacionForm } from '@/components/cuenta/facturacion-form';
import { SiteFooter } from '@/components/site-footer';
import { PLANS, membersAllowed, miles } from '@/lib/plans';
import {
  PERIOD_WORDS,
  STATUS_WORDS,
  longDate,
  planFor,
  usageLines,
  usedShare,
  type MemberSummary,
} from '@/lib/cuenta/puro';
import { currentCustomer, freshAccount, listMembers } from '@/lib/cuenta/servidor';
import { THEME_BOOT } from '@/lib/theme';
import styles from './cuenta.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

const INGRESAR = '/cuenta/ingresar?volver=/cuenta';
/** Una página no puede borrar la cookie de una sesión cerrada; esta ruta sí. */
const SESION_CERRADA = '/api/cuenta/vencida?volver=/cuenta';

/**
 * La cuenta del cliente: plan, vigencia, consumo del mes, llaves de API,
 * equipo, facturación y contraseña. Sin una cookie válida se va al ingreso.
 *
 * Lo que se muestra sale del núcleo en cada visita, no de la cookie: la cookie
 * solo dice quién es. La titular administra llaves, equipo y facturación; un
 * miembro ve el plan, el consumo y las llaves, y cambia su propia contraseña.
 * Esconder aquí un control es solo presentación: cada ruta de `/api/cuenta`
 * vuelve a comprobar quién la llama.
 */
export default async function CuentaPage() {
  const customer = await currentCustomer();
  if (!customer) redirect(INGRESAR);

  const fresh = await freshAccount(customer);
  if (!fresh.ok && fresh.revoked) redirect(SESION_CERRADA);

  const detalle = fresh.ok ? fresh.detail : null;
  const miembro = fresh.ok ? fresh.member : null;
  const cuenta = detalle?.account;
  const titular = customer.mid === undefined;
  const plan = planFor(PLANS, cuenta?.planCode ?? customer.planCode);
  const lineas = usageLines(detalle?.usage ?? [], plan);
  const vigente = cuenta?.entitled ?? false;
  const cupoEquipo = plan ? membersAllowed(plan) : 0;

  const equipo = titular && cuenta ? await listMembers(cuenta.subscriberAccountId) : null;
  const miembros: MemberSummary[] | null = equipo?.ok ? (equipo.body?.data?.items ?? []) : null;
  const muestraEquipo = titular && (cupoEquipo > 0 || (miembros?.some((m) => m.status === 'ACTIVE') ?? false));

  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <a className="skip-link" href="#contenido">
        Ir al contenido principal
      </a>
      <Masthead stamp={<span>Cuenta de cliente</span>} />

      <div className={styles.pagina} id="contenido">
        <header className={styles.cabecera}>
          <p className={styles.antetitulo}>Servicios · Cuenta</p>
          <h2 className={styles.titulo}>Mi cuenta</h2>
          <p className={styles.entradilla}>
            {miembro ? (
              <>
                {miembro.fullName} · {miembro.email}
              </>
            ) : cuenta ? (
              <>
                {cuenta.fullName}
                {cuenta.organization ? <>, {cuenta.organization}</> : null} · {cuenta.email}
              </>
            ) : (
              customer.email
            )}
          </p>
          {cuenta ? (
            <p className={styles.rol}>
              {titular
                ? 'Titular de la cuenta.'
                : `Miembro de la cuenta de ${cuenta.organization ?? cuenta.fullName}.`}
            </p>
          ) : null}
        </header>

        {!detalle || !cuenta ? (
          <section className={`${styles.bloque} ${styles.bloquePrincipal}`}>
            <p className={styles.error} role="alert">
              No se pudo leer la cuenta en este momento. Recargar la página o volver en unos minutos.
            </p>
          </section>
        ) : (
          <>
            <section className={`${styles.bloque} ${styles.bloquePrincipal}`} aria-labelledby="plan-titulo">
              <h2 id="plan-titulo" className={styles.subtitulo}>
                Plan
              </h2>
              <dl className={styles.resumen}>
                <div>
                  <dt>Plan</dt>
                  <dd>
                    {plan?.nombre ?? cuenta.planCode}
                    <small>Pago {PERIOD_WORDS[cuenta.billingPeriod] ?? cuenta.billingPeriod}</small>
                  </dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{STATUS_WORDS[cuenta.effectiveStatus] ?? cuenta.effectiveStatus}</dd>
                </div>
                <div>
                  <dt>Vigente hasta</dt>
                  <dd>{longDate(cuenta.paidUntil)}</dd>
                </div>
              </dl>
              {!vigente ? (
                <p className={styles.aviso}>
                  La cuenta no está vigente: las descargas y el asistente funcionan con los topes del plan gratuito.
                  Para renovarla, escribir desde{' '}
                  <Link className={styles.enlace} href="/servicios#contacto">
                    Planes y servicios
                  </Link>
                  .
                </p>
              ) : cuenta.effectiveStatus === 'GRACE' ? (
                <p className={styles.aviso}>
                  El periodo pagado terminó y la cuenta sigue abierta unos días de gracia. Registrar el pago evita la
                  suspensión.
                </p>
              ) : null}
            </section>

            <section className={styles.bloque} aria-labelledby="consumo-titulo">
              <h2 id="consumo-titulo" className={styles.subtitulo}>
                Consumo de este mes
              </h2>
              <ul className={styles.consumo}>
                {lineas.map((linea) => {
                  const fraccion = usedShare(linea.used, linea.monthlyQuota);
                  return (
                    <li key={linea.kind}>
                      <span className={styles.consumoNombre}>{linea.label}</span>
                      <span className={styles.consumoCifra}>{miles(linea.used)}</span>
                      <span className={styles.consumoCupo}>Cupo del plan: {linea.quotaText}</span>
                      {fraccion !== null ? (
                        <span
                          className={styles.barra}
                          role="img"
                          aria-label={`${Math.round(fraccion * 100)} % del cupo mensual usado`}
                        >
                          <span style={{ width: `${fraccion * 100}%` }} />
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {titular ? null : (
                <p className={`${styles.nota} ${styles.separadaArriba}`}>
                  El consumo es de toda la cuenta, sumado entre todas las personas que entran a ella.
                </p>
              )}
            </section>

            <section className={styles.bloque} aria-labelledby="llaves-titulo">
              <h2 id="llaves-titulo" className={styles.subtitulo}>
                Llaves de API
              </h2>
              <p className={`${styles.nota} ${styles.separada}`}>
                Cada llave autoriza consultas a la API a nombre de la cuenta. La documentación está en{' '}
                <Link className={styles.enlace} href="/servicios/api">
                  la página de la API
                </Link>
                .
              </p>
              <LlavesPanel
                llaves={detalle.apiKeys ?? []}
                maximo={plan?.llaves ?? 0}
                puedeCrear={vigente && (plan?.llaves ?? 0) > 0}
                soloLectura={!titular}
              />
            </section>

            {muestraEquipo ? (
              <section className={styles.bloque} aria-labelledby="equipo-titulo">
                <h2 id="equipo-titulo" className={styles.subtitulo}>
                  Equipo
                </h2>
                <p className={`${styles.nota} ${styles.separada}`}>
                  El plan {plan?.nombre ?? ''} incluye {plan ? miles(plan.usuarios) : '—'}{' '}
                  {plan?.usuarios === 1 ? 'usuario' : 'usuarios'}, la titular incluida. Cada persona entra con su
                  correo y su contraseña, ve el plan, el consumo y las llaves, y no puede cambiar nada de la cuenta.
                </p>
                {miembros ? (
                  <EquipoPanel miembros={miembros} maximo={cupoEquipo} puedeSumar={vigente} />
                ) : (
                  <p className={styles.error} role="alert">
                    No se pudo leer el equipo en este momento. Recargar la página o volver en unos minutos.
                  </p>
                )}
              </section>
            ) : null}

            {titular ? (
              <section className={styles.bloque} aria-labelledby="facturacion-titulo">
                <h2 id="facturacion-titulo" className={styles.subtitulo}>
                  Datos de facturación
                </h2>
                <FacturacionForm
                  datos={{ organization: cuenta.organization, legalName: cuenta.legalName, taxId: cuenta.taxId }}
                />
              </section>
            ) : null}

            <section className={styles.bloque} aria-labelledby="clave-titulo">
              <h2 id="clave-titulo" className={styles.subtitulo}>
                Contraseña
              </h2>
              <p className={`${styles.nota} ${styles.separada}`}>
                {titular
                  ? 'Al cambiarla se cierran las sesiones abiertas en otros equipos, también las de los miembros del equipo; esta sigue abierta.'
                  : 'Al cambiarla se cierran las sesiones abiertas en otros equipos; esta sigue abierta.'}
              </p>
              <ClaveForm />
            </section>

            {titular ? (
              <section className={styles.bloque} aria-labelledby="sesiones-titulo">
                <h2 id="sesiones-titulo" className={styles.subtitulo}>
                  Sesiones
                </h2>
                <p className={`${styles.nota} ${styles.separada}`}>
                  Si la cuenta quedó abierta en un equipo ajeno, o se sospecha que alguien más entró, se pueden cerrar
                  todas las sesiones salvo esta. También se cierran las de los miembros del equipo, que deberán volver
                  a ingresar.
                </p>
                <CerrarSesionesBoton />
              </section>
            ) : null}
          </>
        )}

        <div className={styles.pie}>
          <span>
            <Link className={styles.enlace} href="/servicios">
              Planes y servicios
            </Link>{' '}
            ·{' '}
            <Link className={styles.enlace} href="/servicios/api">
              Documentación de la API
            </Link>
          </span>
          <SalirBoton />
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
