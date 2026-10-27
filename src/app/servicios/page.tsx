import type { Metadata } from 'next';
import Link from 'next/link';
import { Masthead } from '@/components/masthead';
import { ServiciosForm } from '@/components/servicios-form';
import { SiteFooter } from '@/components/site-footer';
import {
  FREE_ROW_CAP,
  PLANS,
  bolivianos,
  isInquiryPlan,
  miles,
  type InquiryPlan,
  type Plan,
} from '@/lib/plans';
import { salesContacts } from '@/lib/servicios';
import { THEME_BOOT } from '@/lib/theme';
import styles from './servicios.module.css';

export const metadata: Metadata = {
  title: 'Planes y servicios',
  description:
    'Acceso completo a los datos de DatosBolivia.com: descargas sin tope, consultas por API e informes a medida. Planes mensuales y anuales en bolivianos.',
  alternates: { canonical: '/servicios' },
};

/** Cada fila de la comparación: qué se mide y cómo se lee en cada plan. */
const COMPARACION: ReadonlyArray<{ rotulo: string; valor: (plan: Plan) => string }> = [
  { rotulo: 'Usuarios', valor: (p) => (p.code === 'gratis' ? '—' : miles(p.usuarios)) },
  { rotulo: 'Filas por archivo descargado', valor: (p) => (p.filasPorArchivo === null ? 'Sin tope' : miles(p.filasPorArchivo)) },
  {
    rotulo: 'Lugares por descarga del mapa',
    valor: (p) => (p.lugaresPorDescarga === null ? 'Completo' : miles(p.lugaresPorDescarga)),
  },
  { rotulo: 'Consultas a la API por mes', valor: (p) => (p.apiPorMes === 0 ? '—' : miles(p.apiPorMes)) },
  { rotulo: 'Llaves de API', valor: (p) => (p.llaves === 0 ? '—' : miles(p.llaves)) },
  { rotulo: 'Preguntas al asistente por día', valor: (p) => miles(p.chatPorDia) },
];

const PREGUNTAS: ReadonlyArray<{ pregunta: string; respuesta: string }> = [
  {
    pregunta: 'Qué sigue siendo gratuito',
    respuesta: `Todo el tablero: cada página, gráfico y mapa, y las imágenes de los gráficos. Las descargas de datos llevan hasta ${miles(FREE_ROW_CAP)} filas por archivo y el asistente contesta 10 preguntas por día desde cada conexión.`,
  },
  {
    pregunta: 'Cambian las cifras con un plan',
    respuesta:
      'No. Los planes dan acceso y volumen, no otra versión de los datos. Las fuentes, las fechas y el método son los mismos para todos y están en la sección Método.',
  },
  {
    pregunta: 'Cómo se paga',
    respuesta:
      'En bolivianos, por código QR o transferencia bancaria. Después de recibir el pedido se envía la propuesta con los datos de pago, y la cuenta se activa el mismo día hábil en que se confirma el pago.',
  },
  {
    pregunta: 'Se emite factura',
    respuesta:
      'Por ahora los planes se cobran sin factura. Si la organización necesita una, conviene indicarlo en el pedido: la razón social y el NIT quedan registrados para cuando la factura esté disponible.',
  },
  {
    pregunta: 'Qué pasa al agotar el cupo del mes',
    respuesta:
      'Al llegar al 80 % del cupo se envía un aviso. Al llegar al 100 %, la cuenta vuelve a los topes gratuitos hasta el mes siguiente o hasta cambiar de plan. Nada se corta sin aviso.',
  },
  {
    pregunta: 'Hay prueba gratuita',
    respuesta:
      'Sí: siete días de Analista o Profesional, a pedido. Basta con indicarlo en el formulario.',
  },
  {
    pregunta: 'Hay descuento para universidades',
    respuesta:
      'Sí: 50 % en Analista y Profesional para universidades, centros de investigación y estudiantes.',
  },
  {
    pregunta: 'Se puede cancelar',
    respuesta:
      'Sí. El plan dura el periodo pagado y no se renueva solo: si no se paga el periodo siguiente, la cuenta pasa a gratuita después de cinco días de gracia.',
  },
];

function Precio({ plan }: { plan: Plan }) {
  if (plan.mensual === 0) {
    return (
      <p className={styles.precio}>
        <span className={styles.monto}>Bs 0</span>
      </p>
    );
  }
  return (
    <p className={styles.precio}>
      {plan.desde ? <span className={styles.desde}>desde </span> : null}
      <span className={styles.monto}>{bolivianos(plan.mensual ?? 0)}</span>
      <span className={styles.periodo}> por mes</span>
      <span className={styles.anual}>
        {plan.anual ? `o ${bolivianos(plan.anual)} por año (dos meses sin costo)` : 'precio anual a convenir'}
      </span>
    </p>
  );
}

/**
 * Planes y servicios: lo que se paga, lo que no y cómo se pide.
 *
 * La página vende sin dejar de ser el sitio: la misma cabecera, la misma voz y
 * ninguna promesa que los datos no cumplan. Las cifras de cada plan salen de
 * `src/lib/plans.ts`, que es también lo que aplican las descargas y el chat, así
 * que lo que se anuncia aquí y lo que el sitio hace no pueden separarse.
 */
export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const pedido = typeof parametros['plan'] === 'string' ? parametros['plan'] : '';
  const planInicial: InquiryPlan = isInquiryPlan(pedido) ? pedido : 'analista';
  const { whatsapp, correo } = salesContacts();
  const mensajeWhatsapp = encodeURIComponent(
    'Hola, quiero información sobre los planes de datos de DatosBolivia.com.',
  );

  return (
    <main>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <a className="skip-link" href="#contenido">
        Ir al contenido principal
      </a>
      <Masthead stamp={<span>Planes de acceso a los datos</span>} />

      <div className={styles.pagina} id="contenido">
        <header className={styles.cabecera}>
          <p className={styles.antetitulo}>Servicios · Acceso a los datos</p>
          <h2 className={styles.titulo}>Planes y servicios</h2>
          <p className={styles.entradilla}>
            El tablero es gratuito y lo seguirá siendo. Los planes son para quien necesita la
            base completa: descargas sin tope, consultas por API e informes a medida, con las
            mismas fuentes y fechas que el sitio publica.
          </p>
        </header>

        <section className={styles.planes} aria-label="Planes">
          {PLANS.map((plan) => (
            <article key={plan.code} className={styles.plan} data-destacado={plan.code === 'profesional' ? '' : undefined}>
              <h3 className={styles.nombre}>{plan.nombre}</h3>
              <Precio plan={plan} />
              <p className={styles.resumen}>{plan.resumen}</p>
              <ul className={styles.incluye}>
                {plan.incluye.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
              {plan.code === 'gratis' ? (
                <Link className={styles.secundario} href="/">
                  Ir al tablero
                </Link>
              ) : (
                <a className={styles.primario} href={`?plan=${plan.code}#contacto`}>
                  {plan.code === 'institucional' ? 'Pedir una cotización' : 'Pedir este plan'}
                </a>
              )}
            </article>
          ))}
        </section>

        <section className={styles.bloque} aria-labelledby="comparacion">
          <h2 id="comparacion" className={styles.subtitulo}>
            Comparación de los planes
          </h2>
          <div className={styles.tablaScroll} tabIndex={0} role="region" aria-label="Comparación desplazable">
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th scope="col">Qué incluye</th>
                  {PLANS.map((plan) => (
                    <th scope="col" key={plan.code}>
                      {plan.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARACION.map((fila) => (
                  <tr key={fila.rotulo}>
                    <th scope="row">{fila.rotulo}</th>
                    {PLANS.map((plan) => (
                      <td key={plan.code}>{fila.valor(plan)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.bloque} aria-labelledby="como">
          <h2 id="como" className={styles.subtitulo}>
            Cómo se contrata
          </h2>
          <ol className={styles.pasos}>
            <li>
              <strong>Pedido.</strong> Se envía el formulario de abajo, o se escribe por WhatsApp o
              correo, con el plan o el informe que se necesita.
            </li>
            <li>
              <strong>Propuesta.</strong> En un día hábil llega la respuesta con el detalle del plan
              y los datos de pago. Se puede pedir una prueba de siete días.
            </li>
            <li>
              <strong>Pago.</strong> En bolivianos, por código QR o transferencia.
            </li>
            <li>
              <strong>Activación.</strong> La cuenta se activa el mismo día hábil en que se
              confirma el pago.
            </li>
          </ol>
        </section>

        <section className={styles.bloque} id="contacto" aria-labelledby="contacto-titulo">
          <h2 id="contacto-titulo" className={styles.subtitulo}>
            Pedir un plan o un informe
          </h2>
          <div className={styles.contacto}>
            <ServiciosForm planInicial={planInicial} />
            {whatsapp || correo ? (
              <aside className={styles.directo} aria-label="Contacto directo">
                <h3>Contacto directo</h3>
                {whatsapp ? (
                  <a
                    className={styles.secundario}
                    href={`https://wa.me/${whatsapp}?text=${mensajeWhatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Escribir por WhatsApp
                  </a>
                ) : null}
                {correo ? (
                  <a className={styles.secundario} href={`mailto:${correo}?subject=${encodeURIComponent('Planes de DatosBolivia.com')}`}>
                    Escribir a {correo}
                  </a>
                ) : null}
              </aside>
            ) : null}
          </div>
        </section>

        <section className={styles.bloque} aria-labelledby="preguntas">
          <h2 id="preguntas" className={styles.subtitulo}>
            Preguntas frecuentes
          </h2>
          <div className={styles.preguntas}>
            {PREGUNTAS.map((item) => (
              <details key={item.pregunta}>
                <summary>{item.pregunta}</summary>
                <p>{item.respuesta}</p>
              </details>
            ))}
          </div>
          <p className={styles.legal}>
            El uso de los datos y de la API se rige por los <Link href="/terminos">términos de uso</Link>.
          </p>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
