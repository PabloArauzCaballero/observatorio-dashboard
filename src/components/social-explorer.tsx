'use client';

import { useMemo, useState } from 'react';
import { ReachChart, ShareBars } from './charts';
import type { ReachBar, ShareSlice } from './charts';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { SocialAudience, SocialReading } from '@/lib/series';

/**
 * The social register, which is the one section here that reports no measurement.
 *
 * Everything else on this report is a figure somebody measured or a newsroom
 * reporting one. These are readings of what the country expects and feels,
 * compiled by firms that sell the compilation, and the section is built so a
 * reader cannot mistake the two.
 *
 * Every chart is assembled from the catalogue by metric code rather than from
 * numbers typed into this file. A reading added to the seed appears here; one
 * corrected there is corrected here. Where a source did not publish a part, the
 * part is absent from the chart instead of being filled in — which is why the
 * ring tooltips say what the slices actually sum to.
 *
 * The emotional register has four values and not three polarities: in the May
 * 2026 conflict monitoring, posts about the dead drew «me divierte» more than
 * any other reaction, and a polarity scale would file mockery as approval.
 */

const SUBJECT_LABEL: Record<string, string> = {
  AUDIENCE: 'Audiencia',
  TOPIC: 'Temas',
  EMOTION: 'Emociones',
  COMMERCE: 'Compra',
};

const SUBJECT_ICON: Record<string, IconName> = {
  AUDIENCE: 'personas',
  TOPIC: 'etiqueta',
  EMOTION: 'campana',
  COMMERCE: 'tienda',
};

const GRADE_LABEL: Record<string, string> = {
  HIGH: 'Evidencia alta',
  MEDIUM: 'Evidencia media',
  LOW: 'Evidencia baja',
};

/*
 * Read against this report's own convention, not a traffic light. Here --down
 * is green because a falling exchange rate is good news and --up is red because
 * a rising one is not. So a weak grade takes --up: it is the row a reader
 * should slow down on, and painting it green would say the opposite.
 */
const GRADE_TONE: Record<string, string> = {
  HIGH: 'var(--official)',
  MEDIUM: 'var(--parallel)',
  LOW: 'var(--up)',
};

const REGISTER_LABEL: Record<string, string> = {
  MIEDO: 'Miedo',
  INDIGNACION: 'Indignación',
  BURLA: 'Burla',
  RESIGNACION: 'Resignación',
  NINGUNO: 'Sin registro',
};

const COUNTERPART_LABEL: Record<string, string> = {
  PRECIOS: 'Precios',
  CAMBIARIO: 'Tipo de cambio',
  PAGOS: 'Pagos',
  CONSUMO: 'Consumo',
  NINGUNO: '—',
};

const PLATFORM_LABEL: Record<string, string> = {
  TRANSVERSAL: 'Todas',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  WHATSAPP: 'WhatsApp',
  MESSENGER: 'Messenger',
  LINKEDIN: 'LinkedIn',
  X: 'X',
  REDDIT: 'Reddit',
};

function count(value: number): string {
  return value.toLocaleString('es-BO', { maximumFractionDigits: 1 });
}

/** The figure as the compiler published it, in the unit it published it in. */
function figure(reading: SocialReading): string {
  if (reading.unit === 'PERCENT') return `${count(reading.value)} %`;
  if (reading.unit === 'PER_MINUTE') return `${count(reading.value)} por minuto`;
  if (reading.unit === 'BOB') return `Bs ${count(reading.value)}`;
  if (reading.unit === 'USD') return `USD ${count(reading.value)}`;
  // A count of zero is how the catalogue records an absence — TikTok Shop is
  // not available in Bolivia — and printing «0» would read as a measurement
  // that came out empty rather than as a thing that does not exist.
  if (reading.unit === 'COUNT' && reading.value === 0) return 'No disponible';
  return count(reading.value);
}

/** A titled chart with the sentence that says how to read it. */
function Plot({
  title,
  icon,
  note,
  children,
}: {
  title: string;
  icon: IconName;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="tile-head">
        <Icon name={icon} size={15} />
        <h3 style={{ font: 'inherit', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>
      {children}
      <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
        {note}
      </p>
    </div>
  );
}

export function SocialExplorer({
  readings,
  audience,
}: {
  readings: SocialReading[];
  audience: SocialAudience[];
}) {
  const [subject, setSubject] = useState<string>('TODOS');
  const [grade, setGrade] = useState<string>('TODOS');
  const [open, setOpen] = useState<string | null>(null);

  /** Every chart below is built from this, so no figure is typed twice. */
  const byMetric = useMemo(() => {
    const index = new Map<string, SocialReading>();
    for (const reading of readings) {
      index.set(`${reading.metric}|${reading.platform}`, reading);
      if (!index.has(reading.metric)) index.set(reading.metric, reading);
    }
    return index;
  }, [readings]);

  const slices = useMemo(
    () =>
      (wanted: Array<{ metric: string; name: string; emphasis?: boolean }>): ShareSlice[] =>
        wanted
          .map((entry) => {
            const reading = byMetric.get(entry.metric);
            if (!reading) return null;
            return {
              name: entry.name,
              value: reading.value,
              ...(entry.emphasis ? { emphasis: true } : {}),
            };
          })
          .filter((slice): slice is ShareSlice => slice !== null),
    [byMetric],
  );

  const composition = slices([
    { metric: 'CONTENT_MISINFORMATION_SHARE', name: 'Desinformación' },
    { metric: 'CONTENT_HATE_SPEECH_SHARE', name: 'Discurso de odio' },
    { metric: 'CONTENT_UNVERIFIABLE_SHARE', name: 'Denuncia no verificable' },
    { metric: 'CONTENT_INFORMATIVE_SHARE', name: 'Informativo' },
  ]);

  const reactions = slices([
    { metric: 'REACTION_LIKE_SHARE', name: 'Me gusta' },
    { metric: 'REACTION_HAHA_SHARE', name: 'Me divierte' },
    { metric: 'REACTION_ANGRY_SHARE', name: 'Me enoja' },
    { metric: 'REACTION_SAD_SHARE', name: 'Me entristece' },
  ]);

  const intent = slices([
    { metric: 'INTENT_HATE_SHARE', name: 'Apelar al odio', emphasis: true },
    { metric: 'INTENT_SPECULATION_SHARE', name: 'Especular' },
    { metric: 'INTENT_INFORM_SHARE', name: 'Informar' },
  ]);

  const fabrication = slices([
    { metric: 'ACCOUNTS_IMPERSONATING_MEDIA_SHARE', name: 'Cuentas que fingen ser medios', emphasis: true },
    { metric: 'CONTENT_AI_GENERATED_SHARE', name: 'Contenido generado con IA', emphasis: true },
    { metric: 'CONTENT_ORIGIN_BOLIVIA_SHARE', name: 'Originado en Bolivia' },
  ]);

  const narratives = slices([
    { metric: 'NARRATIVE_PRESIDENTIAL_RESIGNATION_SHARE', name: 'Renuncia presidencial' },
    { metric: 'NARRATIVE_STRIKE_SHARE', name: 'Paro de la COB' },
    { metric: 'NARRATIVE_BLOCKADE_SHARE', name: 'Bloqueos' },
  ]);

  const creators = slices([
    { metric: 'CREATOR_URBAN_SHARE', name: 'Urbanos' },
    { metric: 'CREATOR_RURAL_SHARE', name: 'Rurales' },
    { metric: 'CREATOR_INDIGENOUS_LANGUAGE_SHARE', name: 'En lenguas indígenas', emphasis: true },
  ]);

  const clothing = slices([
    { metric: 'CLOTHING_CHANNEL_POPULAR_FAIRS', name: 'Ferias populares' },
    { metric: 'CLOTHING_CHANNEL_TRADITIONAL_MARKETS', name: 'Mercados tradicionales' },
    { metric: 'CLOTHING_CHANNEL_SHOPPING_MALLS', name: 'Centros comerciales' },
    { metric: 'CLOTHING_CHANNEL_SUPERMARKETS', name: 'Supermercados' },
    { metric: 'CLOTHING_CHANNEL_CATALOGUES', name: 'Catálogos' },
    { metric: 'CLOTHING_CHANNEL_BOUTIQUES', name: 'Boutiques' },
  ]);

  /*
   * Shares of people only. A growth rate of 131% and a 57% of households are
   * both printed with a per-cent sign and are not the same kind of number; one
   * axis for both would make the rate look like a majority. The QR figures sit
   * in the strip below, as figures, where nothing invites the comparison.
   */
  const friction = slices([
    { metric: 'HOUSEHOLDS_LOW_STRATA_SHARE', name: 'Hogares de estrato bajo y marginal' },
    {
      metric: 'ONLINE_BUYERS_PAYING_OFFLINE_SHARE',
      name: 'No concreta el pago en línea',
      emphasis: true,
    },
  ]);

  const payments = [
    { metric: 'QR_PAYMENTS_PER_MINUTE', label: 'Pagos con QR por minuto', icon: 'pulso' as const },
    {
      metric: 'QR_PAYMENTS_YOY_GROWTH',
      label: 'Crecimiento del QR en el año',
      icon: 'tendencia' as const,
    },
    {
      metric: 'MOBILE_WALLET_PROVIDERS',
      label: 'Billeteras móviles operando',
      icon: 'monedas' as const,
    },
    {
      metric: 'IN_APP_SHOP_AVAILABLE',
      label: 'Tienda dentro de TikTok',
      icon: 'tienda' as const,
    },
  ]
    .map((entry) => {
      const reading = byMetric.get(entry.metric);
      return reading ? { ...entry, reading } : null;
    })
    .filter((entry): entry is typeof entry & { reading: SocialReading } => entry !== null);

  /** Where the conflict content circulated, read off the platform readings. */
  const circulation = useMemo(
    () =>
      readings
        .filter((reading) => reading.metric === 'CONFLICT_CONTENT_SHARE')
        .map((reading) => ({
          name: PLATFORM_LABEL[reading.platform] ?? reading.platform,
          value: reading.value,
        })),
    [readings],
  );

  const reach: ReachBar[] = useMemo(
    () =>
      audience.map((row) => ({
        platform: PLATFORM_LABEL[row.platform] ?? row.platform,
        value: row.value,
        exceeds: row.exceedsInternetUsers,
      })),
    [audience],
  );

  const subjects = useMemo(
    () => [...new Set(readings.map((reading) => reading.subject))].sort(),
    [readings],
  );

  const shown = useMemo(
    () =>
      readings.filter(
        (reading) =>
          (subject === 'TODOS' || reading.subject === subject) &&
          (grade === 'TODOS' || reading.evidenceGrade === grade),
      ),
    [readings, subject, grade],
  );

  const grades = useMemo(() => {
    const tally = new Map<string, number>();
    for (const reading of readings) {
      tally.set(reading.evidenceGrade, (tally.get(reading.evidenceGrade) ?? 0) + 1);
    }
    return tally;
  }, [readings]);

  const compilers = useMemo(
    () => new Set(readings.map((reading) => reading.publisher)).size,
    [readings],
  );

  const ceiling = audience[0]?.internetUsers ?? null;
  const inflated = reach.filter((row) => row.exceeds).length;

  return (
    <>
      <div className="panel">
        <div className="tile-head">
          <Icon name="personas" size={17} />
          <h2>Lo que se publicó sobre las redes</h2>
          <span className="tile-hint">
            {readings.length} lecturas · {compilers} compiladores
          </span>
        </div>
        <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
          Este registro <b>no mide nada</b>. El observatorio no lee redes sociales —no hay vía
          legítima para hacerlo desde Bolivia— así que lo que hay aquí son cifras que terceros
          publicaron, con su compilador, su método y su grado de evidencia al lado. Sirven para
          contrastar lo que el país <i>espera</i> contra lo que las series oficiales miden después,
          nunca para sustituirlas.
        </p>
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">
              <Icon name="escudo" size={12} />
              Evidencia alta
            </span>
            <span className="stat-value">{grades.get('HIGH') ?? 0}</span>
            <span className="stat-hint">método declarado y cifra reproducible</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="info" size={12} />
              Evidencia media
            </span>
            <span className="stat-value">{grades.get('MEDIUM') ?? 0}</span>
            <span className="stat-hint">método parcial o un solo estudio</span>
          </div>
          <div className="stat">
            <span className="stat-label">
              <Icon name="campana" size={12} />
              Evidencia baja
            </span>
            <span className="stat-value">{grades.get('LOW') ?? 0}</span>
            <span className="stat-hint">sin método publicado; indicativa</span>
          </div>
        </div>
      </div>

      {reach.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="barras" size={17} />
            <h2>Audiencia</h2>
            <span className="tile-hint">
              {ceiling === null ? 'sin techo de referencia' : `${count(ceiling)} internautas`}
            </span>
          </div>
          <ReachChart data={reach} ceiling={ceiling} />
          <p className="panel-sub" style={{ marginTop: 'var(--s1)' }}>
            La línea punteada es la cantidad de bolivianos que usan internet. Nadie es alcanzable en
            una red sin ella, así que las barras que la cruzan —{inflated === 1 ? 'una' : inflated}—
            cuentan cuentas, duplicados y atribución geográfica imprecisa, no personas. Son cifras
            que las plataformas declaran en su propia herramienta de publicidad: techo comercial, no
            penetración.
          </p>
        </div>
      ) : null}

      {composition.length || reactions.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="campana" size={17} />
            <h2>Emociones</h2>
            <span className="tile-hint">362 contenidos · conflicto de mayo 2026</span>
          </div>
          <div className="grid-two">
            {composition.length ? (
              <Plot
                title="Qué era el contenido"
                icon="capas"
                note="Siete de cada diez piezas eran desinformación y una de cada cien, información. Las cuatro clases se cuentan sobre el mismo corpus de 362 contenidos y no se excluyen entre sí, así que las barras no reparten un total."
              >
                <ShareBars data={composition} tone="var(--up)" height={200} />
              </Plot>
            ) : null}
            {reactions.length ? (
              <Plot
                title="Cómo reaccionó la gente"
                icon="pulso"
                note="«Me divierte» duplica a «me enoja» y multiplica por veinte a «me entristece». Las publicaciones sobre muertos recibieron sobre todo burla: marca de bando, no diversión — y una escala de polaridad la contaría como aprobación."
              >
                <ShareBars data={reactions} tone="var(--parallel)" height={200} />
              </Plot>
            ) : null}
          </div>
          <div className="grid-two" style={{ marginTop: 'var(--s3)' }}>
            {intent.length ? (
              <Plot
                title="Para qué se publicó"
                icon="diana"
                note="La intención declarada por el monitoreo. El contenido que moviliza emocionalmente precede a la entrega de información."
              >
                <ShareBars data={intent} height={160} />
              </Plot>
            ) : null}
            {fabrication.length ? (
              <Plot
                title="De dónde salió y con qué se hizo"
                icon="escudo"
                note="Ojo con la base: «cuentas que fingen ser medios» es porcentaje de las cuentas difusoras; las otras dos, del contenido monitoreado. Menos de la mitad se originó en el país, un quinto era sintético, y las cuentas que imitaban a Red Uno, Unitel o El Deber eran cuatro de cada diez."
              >
                <ShareBars data={fabrication} height={160} />
              </Plot>
            ) : null}
          </div>
        </div>
      ) : null}

      {circulation.length || narratives.length || creators.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="etiqueta" size={17} />
            <h2>Temas</h2>
            <span className="tile-hint">de qué se habló y quién lo publica</span>
          </div>
          <div className="grid-two">
            {circulation.length ? (
              <Plot
                title="Dónde circuló el conflicto"
                icon="globo"
                note="Facebook sigue siendo la plaza del país pese a que TikTok declara más alcance. Dónde se discute y dónde se declara audiencia son dos preguntas distintas."
              >
                <ShareBars data={circulation} height={190} />
              </Plot>
            ) : null}
            {narratives.length ? (
              <Plot
                title="Qué se pedía"
                icon="ventana"
                note="Las narrativas dominantes del monitoreo, encabezadas por los hashtags #PolloPaz y #RenunciaRodrigo."
              >
                <ShareBars data={narratives} height={190} />
              </Plot>
            ) : null}
          </div>
          {creators.length ? (
            <div style={{ marginTop: 'var(--s3)' }}>
              <Plot
                title="Quién produce el contenido boliviano"
                icon="personas"
                note="Sobre 109 cuentas evaluadas. Tres de cada cuatro creadores son urbanos y el contenido en lenguas indígenas no llega al 2 % — aunque el que existe alcanza más en Bolivia que en el resto de la región."
              >
                <ShareBars data={creators} height={150} />
              </Plot>
            </div>
          ) : null}
        </div>
      ) : null}

      {clothing.length || friction.length ? (
        <div className="panel">
          <div className="tile-head">
            <Icon name="tienda" size={17} />
            <h2>Compra</h2>
            <span className="tile-hint">el embudo se rompe y se cierra fuera de la red</span>
          </div>
          <p className="panel-sub" style={{ marginBottom: 'var(--s2)' }}>
            TikTok Shop no está disponible en Bolivia y el país no figura entre los territorios
            habilitados para monetizar, así que lo que se descubre en la red se negocia por WhatsApp
            y se cobra con QR. Es un embudo partido a la mitad.
          </p>
          <div className="grid-two">
            {clothing.length ? (
              <Plot
                title="Dónde compra ropa el hogar boliviano"
                icon="capas"
                note="Las redes todavía no aparecen con porcentaje propio: el panel las registra como canal en crecimiento en La Paz y Cochabamba, y en hogares de nivel medio y alto."
              >
                <ShareBars data={clothing} height={230} />
              </Plot>
            ) : null}
            {friction.length ? (
              <Plot
                title="Quiénes quedan fuera de la compra en línea"
                icon="balanza"
                note="Un tercio de quienes compran por internet no logra pagar por internet: sin cuenta ni app bancaria terminan pagando en físico. Y más de la mitad de los hogares está en los estratos que menos compran en línea."
              >
                <ShareBars data={friction} height={230} />
              </Plot>
            ) : null}
          </div>
          {payments.length ? (
            <>
              <div className="stat-strip" style={{ marginTop: 'var(--s3)' }}>
                {payments.map((entry) => (
                  <div className="stat" key={entry.metric}>
                    <span className="stat-label">
                      <Icon name={entry.icon} size={12} />
                      {entry.label}
                    </span>
                    <span className="stat-value">{figure(entry.reading)}</span>
                    <span className="stat-hint">{entry.reading.referencePeriod}</span>
                  </div>
                ))}
              </div>
              <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
                Cifras y no barras: un crecimiento interanual y un recuento de billeteras no
                comparten escala con un porcentaje de hogares, y ponerlos en un mismo eje haría
                que la tasa pareciera una mayoría.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="panel">
        <div className="tile-head">
          <Icon name="capas" size={17} />
          <h2>El registro</h2>
          <span className="tile-hint">
            {shown.length} de {readings.length}
          </span>
        </div>

        <div className="chips" style={{ marginBottom: 'var(--s2)' }}>
          <button
            type="button"
            className={subject === 'TODOS' ? 'chip chip-on' : 'chip'}
            onClick={() => setSubject('TODOS')}
          >
            Todo
          </button>
          {subjects.map((key) => (
            <button
              key={key}
              type="button"
              className={subject === key ? 'chip chip-on' : 'chip'}
              onClick={() => setSubject(subject === key ? 'TODOS' : key)}
            >
              <Icon name={SUBJECT_ICON[key] ?? 'cajas'} size={12} />
              {SUBJECT_LABEL[key] ?? key}
            </button>
          ))}
        </div>

        <div className="chips" style={{ marginBottom: 'var(--s2)' }}>
          <button
            type="button"
            className={grade === 'TODOS' ? 'chip chip-on' : 'chip'}
            onClick={() => setGrade('TODOS')}
          >
            Cualquier evidencia
          </button>
          {['HIGH', 'MEDIUM', 'LOW'].map((key) => (
            <button
              key={key}
              type="button"
              className={grade === key ? 'chip chip-on' : 'chip'}
              onClick={() => setGrade(grade === key ? 'TODOS' : key)}
              style={grade === key ? undefined : { borderColor: GRADE_TONE[key] }}
            >
              {GRADE_LABEL[key]} ({grades.get(key) ?? 0})
            </button>
          ))}
        </div>

        {shown.length ? (
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Lectura</th>
                  <th>Cifra</th>
                  <th>Período</th>
                  <th>Compilador</th>
                  <th>Registro</th>
                  <th>Contrasta con</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((reading) => {
                  const key = `${reading.metric}-${reading.platform}-${reading.referencePeriod}`;
                  return (
                    <tr key={key}>
                      <td>
                        <button
                          type="button"
                          className="cell-name"
                          onClick={() => setOpen(open === key ? null : key)}
                          style={{ textAlign: 'left', background: 'none', border: 0, padding: 0 }}
                        >
                          <b>{reading.label}</b>
                          {reading.platform === 'TRANSVERSAL' ? null : (
                            <span className="barlist-aside">
                              {' '}
                              · {PLATFORM_LABEL[reading.platform] ?? reading.platform}
                            </span>
                          )}
                        </button>
                        {open === key ? (
                          <p className="card-note" style={{ marginTop: 'var(--s1)' }}>
                            {reading.statement}
                            <br />
                            <span className="card-note-source">
                              {reading.publication}
                              {reading.method ? ` — ${reading.method}` : ''}{' '}
                              <a href={reading.url} target="_blank" rel="noreferrer noopener">
                                ver la fuente
                              </a>
                            </span>
                          </p>
                        ) : null}
                      </td>
                      <td className="cell-code">{figure(reading)}</td>
                      <td className="cell-code">{reading.referencePeriod}</td>
                      <td>
                        {reading.publisher}
                        <br />
                        <span
                          className="barlist-aside"
                          style={{ color: GRADE_TONE[reading.evidenceGrade] }}
                        >
                          {GRADE_LABEL[reading.evidenceGrade]}
                        </span>
                      </td>
                      <td>
                        {REGISTER_LABEL[reading.emotionalRegister] ?? reading.emotionalRegister}
                      </td>
                      <td>
                        {COUNTERPART_LABEL[reading.officialCounterpart] ??
                          reading.officialCounterpart}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="callout">Ninguna lectura cumple los dos filtros a la vez.</div>
        )}

        <p className="panel-sub" style={{ marginTop: 'var(--s2)' }}>
          «Registro» es la emoción que la lectura nombra. «Contrasta con» es la serie medida contra
          la cual esta lectura puede ponerse — que es para lo único que sirve una expectativa. Tocá
          cualquier fila para ver la afirmación completa y abrir la fuente.
        </p>
      </div>
    </>
  );
}
