import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Masthead } from '@/components/masthead';
import { ClaveForm, LlavesPanel, SalirBoton } from '@/components/cuenta/cuenta-forms';
import { SiteFooter } from '@/components/site-footer';
import { PLANS, miles } from '@/lib/plans';
import {
  PERIOD_WORDS,
  STATUS_WORDS,
  longDate,
  planFor,
  usageLines,
  usedShare,
} from '@/lib/cuenta/puro';
import { currentCustomer, readAccount } from '@/lib/cuenta/servidor';
import { THEME_BOOT } from '@/lib/theme';
import styles from './cuenta.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mi cuenta',
  robots: { index: false, follow: false },
};

const INGRESAR = '/cuenta/ingresar?volver=/cuenta';

/**
 * La cuenta del cliente: plan, vigencia, consumo del mes, llaves de API y
 * contraseña. Sin una cookie válida se va al ingreso. Lo que se muestra sale
 * del núcleo en cada visita, no de la cookie: la cookie solo dice quién es.
 */
export default async function CuentaPage() {
  const customer = await currentCustomer();
  if (!customer) redirect(INGRESAR);

  const result = await readAccount(customer.accountId);
  // Una cuenta que el núcleo ya no reconoce no tiene nada que mostrar: al ingreso.
  if (!result.ok && (result.status === 401 || result.status === 403 || result.status === 404)) {
    redirect(INGRESAR);
  }

  const detalle = result.ok ? result.body.data : null;
  const cuenta = detalle?.account;
  const plan = planFor(PLANS, cuenta?.planCode ?? customer.planCode);
  const lineas = usageLines(detalle?.usage ?? [], plan);
  const vigente = cuenta?.entitled ?? false;

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
            {cuenta ? (
              <>
                {cuenta.fullName}
                {cuenta.organization ? <>, {cuenta.organization}</> : null} · {cuenta.email}
              </>
            ) : (
              customer.email
            )}
          </p>
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
              <LlavesPanel llaves={detalle.apiKeys} maximo={plan?.llaves ?? 0} puedeCrear={vigente && (plan?.llaves ?? 0) > 0} />
            </section>

            <section className={styles.bloque} aria-labelledby="clave-titulo">
              <h2 id="clave-titulo" className={styles.subtitulo}>
                Contraseña
              </h2>
              <ClaveForm />
            </section>
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
