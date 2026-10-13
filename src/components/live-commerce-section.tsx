'use client';

import { useMemo, useState } from 'react';
import { ChartLegend, DatedLines, HeatGrid, ShareBars, TermCloud, YearStackBars } from './charts';
import { FilterHint, PickedCount } from './filters';
import { Icon } from './icons';
import { OnOpenNotice, useOnOpen } from './on-open';
import { Panel } from '@/components/ui/panel';
import { ViewToggle } from '@/components/ui/view-toggle';
import { additive, picked, toggle, type Choice } from '@/lib/choice';
import { productName, readable } from '@/lib/live-words';
import {
  EMOTION_LABEL,
  NO_FILTERS,
  PAYMENT_LABEL,
  QUESTIONS,
  SIGNAL_LABEL,
  SIZE_LABEL,
  SLOT_LABEL,
  STATUS_LABEL,
  WEEKDAY_LABEL,
  byRubro,
  filterRooms,
  heat,
  interactionPerHour,
  priceIndex,
  viewerCurve,
  optionsFor,
  perThousand,
  priceTable,
  share,
  sumCounts,
  total,
  weekly,
  type Dimension,
  type LiveCommerceBoard,
  type LiveFilters,
} from '@/lib/live-commerce-board';

/**
 * «Empresas › Ventas en vivo»: el mercado de los lives de venta de TikTok en
 * Bolivia (ADR 0030 del núcleo).
 *
 * La unidad es el mercado. No hay vendedores ni compradores: hay rubros, precios,
 * ciudades, horas y lo que el chat pide. Todo se recorta con los filtros del riel,
 * que se cruzan: cada opción dice cuántos lives quedarían con los demás filtros.
 */

const SOURCE =
  'Lives públicos de TikTok observados por el Observatorio sin iniciar sesión, desde una conexión en Bolivia (chat, voz del vendedor y texto en pantalla)';
const MIN_APT = 30;
const MIN_MESSAGES = 50;
const MIN_PRICES = 3;

const count = (value: number): string => value.toLocaleString('es-BO');

const decimal = (value: number | null, digits = 1): string =>
  value === null ? '—' : value.toLocaleString('es-BO', { maximumFractionDigits: digits });
const barsKey = (label: string) => <ChartLegend items={[{ color: 'var(--official)', label }]} />;
const slices = (counts: Record<string, number>, labels: Record<string, string>, keep?: readonly string[]) => {
  const whole = Object.entries(counts)
    .filter(([key]) => !keep || keep.includes(key))
    .reduce((sum, [, value]) => sum + value, 0);
  return Object.entries(counts)
    .filter(([key, value]) => value > 0 && (!keep || keep.includes(key)))
    .map(([key, value]) => ({ name: labels[key] ?? key, value: share(value, whole) ?? 0, parts: [{ name: 'Mensajes', value }] }));
};

const DIMENSION_LABEL: Record<Dimension, { title: string; icon: 'capas' | 'mapa' | 'personas' | 'reloj' | 'calendario' | 'tienda' }> = {
  status: { title: 'Clase de live', icon: 'tienda' },
  rubro: { title: 'Rubro', icon: 'capas' },
  city: { title: 'Departamento del vendedor', icon: 'mapa' },
  size: { title: 'Audiencia del live', icon: 'personas' },
  slot: { title: 'Franja horaria', icon: 'reloj' },
  weekday: { title: 'Día de la semana', icon: 'calendario' },
};

export function LiveCommerceExplorer({ board }: { board: LiveCommerceBoard }) {
  const [filters, setFilters] = useState<LiveFilters>(NO_FILTERS);
  const [measure, setMeasure] = useState<'enthusiasm' | 'friction' | 'distrust'>('enthusiasm');
  const [scope, setScope] = useState<'AUDIENCE' | 'SELLER'>('AUDIENCE');
  const [reaction, setReaction] = useState<'gifts' | 'follows' | 'shares'>('gifts');

  const labelOf = (dimension: Dimension, value: string): string => {
    switch (dimension) {
      case 'status':
        return STATUS_LABEL[value] ?? value;
      case 'rubro':
        return board.rubros[value] ?? (value === 'SIN_IDENTIFICAR' ? 'Sin rubro identificado' : value === 'MIXTO' ? 'Varios rubros' : value);
      case 'city':
        return board.departments[value] ?? 'Sin dato';
      case 'size':
        return SIZE_LABEL[value] ?? value;
      case 'slot':
        return SLOT_LABEL[value] ?? value;
      case 'weekday':
        return WEEKDAY_LABEL[Number(value)] ?? value;
    }
  };

  const rooms = useMemo(() => filterRooms(board.rooms, filters), [board, filters]);
  const roomKeys = useMemo(() => new Set(rooms.map((room) => room.key)), [rooms]);
  const messages = total(rooms, 'messages');
  const minutes = total(rooms, 'minutes');
  const signals = sumCounts(rooms, 'signals');
  const emotions = sumCounts(rooms, 'emotions');
  const payments = sumCounts(rooms, 'payments');
  const destinations = sumCounts(rooms, 'destinations');
  const weeks = weekly(rooms);
  const rubros = byRubro(rooms);
  const prices = priceTable(board.prices, roomKeys, MIN_PRICES);
  const apt = emotions.apt ?? 0;
  const ironic = emotions.ironic ?? 0;
  const rubroFilter = filters.rubro;
  const phrases = board.phrases
    .filter((phrase) => rubroFilter.size === 0 || rubroFilter.has(phrase.rubro))
    .slice(0, 25);
  const termTotals = new Map<string, number>();
  for (const term of board.terms) {
    if (term.scope !== scope || (rubroFilter.size && !rubroFilter.has(term.rubro))) continue;
    termTotals.set(term.term, (termTotals.get(term.term) ?? 0) + term.mentions);
  }
  const cloud = [...termTotals.entries()].map(([term, value]) => ({ term, label: readable(term), value, adverse: null }));
  const coverage = board.coverage;
  const seen = coverage.reduce((sum, night) => sum + night.messages, 0);
  const signaled = coverage.reduce((sum, night) => sum + night.messagesWithSignal, 0);
  const days = [...new Set(board.rooms.map((room) => room.date))].sort();
  const curve = viewerCurve(rooms);
  const interaction = interactionPerHour(rooms);
  const dollarTalk = rooms.reduce((sum, room) => sum + room.dollarTalk, 0);
  const index = priceIndex(board.prices, roomKeys, board.ufv);
  const indexed = index.filter((row) => row.lives !== null);

  const set = (dimension: Dimension, value: string, add: boolean): void =>
    setFilters((current) => ({ ...current, [dimension]: toggle(current[dimension] as Choice, value, add) }));
  const reset = (): void => setFilters(NO_FILTERS);
  const active =
    (['rubro', 'city', 'size', 'slot', 'weekday'] as const).filter((dimension) => filters[dimension].size).length +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.status.size === 1 && filters.status.has('VENTA') ? 0 : 1);

  if (!board.rooms.length) {
    return (
      <Panel id="ventas-en-vivo-vacio" title="Lives de venta observados (cantidad)" source={SOURCE}>
        <div className="callout">
          Todavía no hay noches de captura publicadas. La página se llena cuando el núcleo siembra la primera lectura
          de lives.
        </div>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        id="ventas-en-vivo-resumen"
        title="Lives de venta observados y mensajes leídos (cantidad)"
        lede={`${count(days.length)} ${days.length === 1 ? 'noche' : 'noches'} de captura, del ${days[0]} al ${days[days.length - 1]}. Cada cifra describe lo que se vio en esos lives, no todo el comercio en vivo del país.`}
        source={SOURCE}
        {...(board.analyzedAt ? { updated: board.analyzedAt.slice(0, 10) } : {})}
      >
        <div className="stat-strip">
          <div className="stat">
            <span className="stat-label">Lives en el recorte</span>
            <span className="stat-value">{count(rooms.length)}</span>
            <span className="stat-hint">de {count(board.rooms.length)} observados</span>
          </div>
          <div className="stat">
            <span className="stat-label">Horas observadas</span>
            <span className="stat-value">{decimal(minutes / 60)}</span>
            <span className="stat-hint">voz transcrita completa y pantalla cada 10 s</span>
          </div>
          <div className="stat">
            <span className="stat-label">Mensajes del chat</span>
            <span className="stat-value">{count(messages)}</span>
            <span className="stat-hint">{count(total(rooms, 'authors'))} personas distintas por live, sumadas</span>
          </div>
          <div className="stat">
            <span className="stat-label">Pedidos por cada 1.000 mensajes</span>
            <span className="stat-value">{decimal(perThousand(signals.COMPRA ?? 0, messages))}</span>
            <span className="stat-hint">«mío», «sepárame», «quiero 2»: intención, no venta</span>
          </div>
        </div>
        <ul className="social-coverage" aria-label="Cobertura de la captura">
          <li>
            <b>Clasificado</b> {decimal(share(signaled, seen))} % de los {count(seen)} mensajes tiene alguna señal de
            compra, pregunta o reclamo; el resto es saludo, emoji o charla.
          </li>
          <li>
            <b>Lives</b> {count(coverage.reduce((sum, night) => sum + night.roomsOpened, 0))} abiertos ·{' '}
            {count(coverage.reduce((sum, night) => sum + night.roomsBlocked, 0))} con muro ·{' '}
            {count(coverage.reduce((sum, night) => sum + night.roomsNoCommerce, 0))} sin venta ·{' '}
            {count(coverage.reduce((sum, night) => sum + night.roomsForeign, 0))} de otro país
          </li>
        </ul>
        <details className="panel-note">
          <summary>Cómo leerlo</summary>
          <p>
            Los lives salen del feed de TikTok visto desde Bolivia, sin iniciar sesión, en las noches de captura. El
            chat se lee mientras ocurre; la voz del vendedor se transcribe entera y el texto en pantalla se lee cada
            10 segundos, en memoria. No se guarda quién comenta ni se publica a ningún vendedor. Un «mío» es una
            intención declarada: el pago se cierra fuera de TikTok y no se ve.
          </p>
        </details>
      </Panel>

      <div className="workspace">
        <aside className="rail" id="ventas-en-vivo-filtros">
          <div className="rail-top">
            <Icon name="filtro" size={15} />
            <span className="rail-title">Filtros</span>
            <span className="rail-count">{active ? `${active} activo${active === 1 ? '' : 's'}` : 'sin filtro'}</span>
          </div>
          <div className="rail-sec">
            <div className="rail-head">
              <Icon name="calendario" size={13} /> Fechas
            </div>
            <div className="rail-field">
              <select
                aria-label="Desde"
                value={filters.from}
                onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              >
                <option value="">Desde el inicio</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    Desde {day}
                  </option>
                ))}
              </select>
              <select
                aria-label="Hasta"
                value={filters.to}
                onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              >
                <option value="">Hasta hoy</option>
                {days.map((day) => (
                  <option key={day} value={day}>
                    Hasta {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {(['status', 'rubro', 'city', 'size', 'slot', 'weekday'] as const).map((dimension) => (
            <div className="rail-sec" key={dimension}>
              <div className="rail-head">
                <Icon name={DIMENSION_LABEL[dimension].icon} size={13} /> {DIMENSION_LABEL[dimension].title}{' '}
                <PickedCount choice={filters[dimension]} />
              </div>
              {dimension === 'rubro' ? <FilterHint /> : null}
              <div className={dimension === 'rubro' ? 'rail-list rail-list-cut' : 'rail-list'}>
                {optionsFor(board.rooms, filters, dimension).map((option) => {
                  const on = picked(filters[dimension], option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={on ? 'rail-item rail-item-on' : 'rail-item'}
                      aria-pressed={on}
                      disabled={!on && option.count === 0}
                      onClick={(event) => set(dimension, option.value, additive(event))}
                    >
                      <span className="rail-name">{labelOf(dimension, option.value)}</span>
                      <span className="rail-n">{option.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {active ? (
            <div className="rail-sec">
              <button type="button" className="chip" onClick={reset}>
                Limpiar todo
              </button>
            </div>
          ) : null}
        </aside>

        <div className="workspace-main">
          <Panel
            id="ventas-en-vivo-tendencia"
            title="Pedidos y preguntas en el chat por semana (mensajes por cada 1.000)"
            lede={
              weeks.length > 1
                ? 'La tendencia del recorte, semana a semana. Las tasas se calculan sobre los mensajes de cada semana, así que una semana con menos noches de captura no parece una caída.'
                : 'Por ahora hay una sola semana de captura: la línea se arma a medida que se suman noches.'
            }
            source={SOURCE}
          >
            <ViewToggle
              chart={
                <>
                  <DatedLines
                    data={weeks.map((row) => ({
                      date: row.week,
                      compra: row.buyPerThousand,
                      preguntas: row.questionsPerThousand,
                    }))}
                    series={[
                      { key: 'compra', label: 'Pedidos («mío», «sepárame») por cada 1.000 mensajes', tone: 'var(--series-1)', emphasis: true },
                      { key: 'preguntas', label: 'Preguntas (precio, talla, envío, pago…) por cada 1.000 mensajes', tone: 'var(--series-2)' },
                    ]}
                    unit="por cada 1.000"
                  />
                </>
              }
              table={
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>Semana (lunes)</th>
                      <th>Lives</th>
                      <th>Horas</th>
                      <th>Mensajes</th>
                      <th>Mensajes por hora</th>
                      <th>Pedidos ‰</th>
                      <th>Preguntas ‰</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((row) => (
                      <tr key={row.week}>
                        <td>{row.week}</td>
                        <td>{count(row.lives)}</td>
                        <td>{decimal(row.hours)}</td>
                        <td>{count(row.messages)}</td>
                        <td>{row.messagesPerHour === null ? '—' : count(row.messagesPerHour)}</td>
                        <td>{decimal(row.buyPerThousand)}</td>
                        <td>{decimal(row.questionsPerThousand)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          </Panel>

          <div className="grid-pair">
            <Panel
              id="ventas-en-vivo-oferta"
              title="Qué se vende: rubros por tiempo en vivo (% de las horas observadas)"
              lede="La oferta: cuánto del tiempo observado dedicó cada rubro. Un clic en una barra filtra la página."
              source={SOURCE}
            >
              <ShareBars
                data={rubros.map((row) => ({
                  name: labelOf('rubro', row.rubro),
                  value: row.offerShare ?? 0,
                  pick: row.rubro,
                  emphasis: filters.rubro.has(row.rubro),
                  parts: [
                    { name: 'Lives', value: row.lives },
                    { name: 'Minutos', value: row.minutes },
                  ],
                }))}
                unit="%"
                height={Math.max(200, rubros.length * 30)}
                onPick={(value, add) => set('rubro', value, add)}
              />
              {barsKey('Parte de las horas observadas que fue de ese rubro, en %')}
            </Panel>
            <Panel
              id="ventas-en-vivo-demanda"
              title="Qué se pide: rubros por pedidos en el chat (% de los pedidos)"
              lede="La demanda: de todos los «mío» y «sepárame» del recorte, cuántos fueron en cada rubro."
              source={SOURCE}
            >
              <ShareBars
                data={rubros
                  .filter((row) => row.buyIntent > 0)
                  .map((row) => ({
                    name: labelOf('rubro', row.rubro),
                    value: row.demandShare ?? 0,
                    pick: row.rubro,
                    emphasis: filters.rubro.has(row.rubro),
                    parts: [
                      { name: 'Pedidos', value: row.buyIntent },
                      { name: 'Por cada 1.000 mensajes', value: row.buyPerThousand ?? 0 },
                    ],
                  }))}
                unit="%"
                height={Math.max(200, rubros.length * 30)}
                onPick={(value, add) => set('rubro', value, add)}
              />
              {barsKey('Parte de los pedidos del chat que fue de ese rubro, en %')}
            </Panel>
          </div>

          <Panel
            id="ventas-en-vivo-precios"
            title="Precio mediano por producto (Bs)"
            lede={`Precios que el vendedor dijo en voz, mostró en pantalla o escribió en el chat. Solo productos con ${MIN_PRICES} precios o más; al pasar sobre la barra se ven el cuartil bajo y el alto.${board.usdRate ? ` Los dichos en dólares se pasan a Bs con el paralelo del Observatorio (${decimal(board.usdRate, 2)} Bs por USD).` : ''}`}
            source={SOURCE}
          >
            {prices.length ? (
              <ViewToggle
                chart={
                  <>
                    <ShareBars
                      data={prices.slice(0, 20).map((row) => ({
                        name: productName(row.product),
                        value: row.median,
                        parts: [
                          { name: 'Cuartil bajo (Bs)', value: row.p25 },
                          { name: 'Cuartil alto (Bs)', value: row.p75 },
                          { name: 'Precios', value: row.n },
                        ],
                      }))}
                      unit="Bs"
                      height={Math.max(200, Math.min(prices.length, 20) * 28)}
                    />
                    {barsKey('Precio mediano del producto, en bolivianos')}
                  </>
                }
                table={
                  <table className="grid-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Rubro</th>
                        <th>Precios</th>
                        <th>Mediana (Bs)</th>
                        <th>Cuartil bajo</th>
                        <th>Cuartil alto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prices.map((row) => (
                        <tr key={row.product}>
                          <td>{productName(row.product)}</td>
                          <td>{labelOf('rubro', row.rubro)}</td>
                          <td>{count(row.n)}</td>
                          <td>{decimal(row.median, 2)}</td>
                          <td>{decimal(row.p25, 2)}</td>
                          <td>{decimal(row.p75, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              />
            ) : (
              <div className="callout">Ningún producto del recorte junta {MIN_PRICES} precios todavía.</div>
            )}
          </Panel>


          <div className="grid-pair">
            <Panel
              id="ventas-en-vivo-espectadores"
              title="Espectadores durante el live (mediana por tramo de 10 minutos desde el inicio)"
              lede="Cuánta gente sostiene un live a medida que avanza. Cada tramo junta al menos 3 lives; el minuto cero es el inicio del live, no el de la captura."
              source={SOURCE}
            >
              {curve.length ? (
                <YearStackBars
                  data={curve.map((row) => ({ year: row.label, mediana: row.median }))}
                  parts={[{ key: 'mediana', label: 'Mediana de espectadores en ese tramo' }]}
                  unit="espectadores"
                  height={240}
                />
              ) : (
                <div className="callout">Todavía no hay tramos con 3 lives o más en el recorte.</div>
              )}
            </Panel>
            <Panel
              id="ventas-en-vivo-interaccion"
              title="Regalos, seguidores nuevos y compartidos por rubro (por hora de live)"
              lede="Lo que el público hace además de escribir. Los regalos se cuentan, no se convierten en dinero: TikTok no publica cuánto vale cada uno para el vendedor."
              source={SOURCE}
            >
              <div className="rail-pills">
                {(
                  [
                    ['gifts', 'Regalos'],
                    ['follows', 'Seguidores nuevos'],
                    ['shares', 'Compartidos'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={reaction === value ? 'chip chip-on' : 'chip'}
                    aria-pressed={reaction === value}
                    onClick={() => setReaction(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {interaction.some((row) => row[reaction] > 0) ? (
                <>
                  <ShareBars
                    data={interaction.filter((row) => row[reaction] > 0).map((row) => ({
                      name: labelOf('rubro', row.rubro),
                      value: row[reaction],
                      pick: row.rubro,
                      parts: [{ name: 'Horas observadas', value: row.hours }],
                    }))}
                    unit="por hora"
                    height={Math.max(200, interaction.length * 30)}
                    onPick={(value, add) => set('rubro', value, add)}
                  />
                  {barsKey('Cantidad por hora de live observada, por rubro')}
                </>
              ) : (
                <div className="callout">Nadie lo hizo en los lives del recorte (o ningún rubro junta media hora observada).</div>
              )}
            </Panel>
          </div>

          <Panel
            id="ventas-en-vivo-precio-ufv"
            title="Precio en los lives frente a la UFV (índice, base 100 = primera semana)"
            lede={
              indexed.length > 1
                ? 'Encadenado semana a semana sobre los productos que tienen precio en las dos semanas, para que un cambio de mezcla no parezca inflación. La UFV es el índice diario de precios del Banco Central.'
                : 'Hace falta una segunda semana con productos en común para dibujar la comparación; hoy hay una. La línea se arma sola a medida que se suman noches.'
            }
            source={`${SOURCE}; UFV: Banco Central de Bolivia`}
          >
            {indexed.length > 1 ? (
              <DatedLines
                data={index.map((row) => ({ date: row.week, lives: row.lives, ufv: row.ufv }))}
                series={[
                  { key: 'lives', label: 'Precio en los lives (índice)', tone: 'var(--series-1)', emphasis: true },
                  { key: 'ufv', label: 'UFV (índice)', tone: 'var(--series-2)', dashed: true },
                ]}
                unit="índice"
                referenceLine={100}
              />
            ) : (
              <div className="callout">
                Semana con precios: {index.map((row) => `${row.week} (${row.products} productos)`).join(' · ') || 'ninguna'}.
              </div>
            )}
          </Panel>

          <div className="grid-three">
            <Panel
              id="ventas-en-vivo-preguntas"
              title="Qué pregunta o pide el comprador (% de las preguntas y pedidos del chat)"
              lede="Lo que el chat le pregunta o le pide al vendedor antes de comprar: precio, talla, envío, rebaja…"
              source={SOURCE}
            >
              <ShareBars data={slices(signals, SIGNAL_LABEL, QUESTIONS)} unit="%" height={260} />
              {barsKey('Parte de las preguntas del recorte, en %')}
            </Panel>
            <Panel
              id="ventas-en-vivo-pagos"
              title="Cómo se habla de pagar (% de las menciones de pago)"
              lede={`Menciones de medios de pago en el chat. Además, ${count(dollarTalk)} mensajes del recorte hablan del dólar, del paralelo o del tipo de cambio.`}
              source={SOURCE}
            >
              {Object.keys(payments).length ? (
                <>
                  <ShareBars data={slices(payments, PAYMENT_LABEL)} unit="%" height={240} />
                  {barsKey('Parte de las menciones de pago del recorte, en %')}
                </>
              ) : (
                <div className="callout">Nadie mencionó un medio de pago en el recorte.</div>
              )}
            </Panel>
            <Panel
              id="ventas-en-vivo-envios"
              title="A dónde piden envío (% de las menciones de destino)"
              lede="Departamentos que el chat nombra al preguntar por envíos o entregas."
              source={SOURCE}
            >
              {Object.keys(destinations).length ? (
                <>
                  <ShareBars data={slices(destinations, board.departments)} unit="%" height={240} />
                  {barsKey('Parte de las menciones de destino del recorte, en %')}
                </>
              ) : (
                <div className="callout">Ningún pedido de envío nombró un departamento en el recorte.</div>
              )}
            </Panel>
          </div>

          <Panel
              id="ventas-en-vivo-horas"
              title="Cuándo se vende: lives por día y hora (cantidad, hora de La Paz)"
              lede="Solo cubre las horas en que hubo captura; una casilla vacía puede ser una hora sin observar."
              source={SOURCE}
            >
              <HeatGrid
                rows={WEEKDAY_LABEL.slice(1)}
                columns={[...new Set(rooms.map((room) => room.hour))]
                  .sort((left, right) => left - right)
                  .map((hour) => `${String(hour).padStart(2, '0')} h`)}
                cells={heat(rooms)}
                unit="lives"
              />
              <ChartLegend items={[{ color: 'var(--official)', label: 'Lives que empezaron en esa hora y día' }]} />
            </Panel>

          <div className="grid-pair">
            <Panel
              id="ventas-en-vivo-emociones"
              title="Emociones en el chat (% de los mensajes con texto suficiente)"
              lede={
                apt >= MIN_APT
                  ? `${count(apt)} mensajes con tres palabras o más, o solo emojis con valor claro; ${decimal(share(ironic, apt))} % irónicos, contados aparte y no sumados a la alegría.`
                  : `Hacen falta ${MIN_APT} mensajes con texto suficiente para mostrar porcentajes; el recorte tiene ${count(apt)}.`
              }
              source={`${SOURCE}. Modelo: pysentimiento (RoBERTuito)`}
            >
              {apt >= MIN_APT ? (
                <>
                  <ShareBars
                    data={Object.entries(EMOTION_LABEL)
                      .filter(([key]) => (emotions[key] ?? 0) > 0)
                      .map(([key, label]) => ({ name: label, value: share(emotions[key] ?? 0, apt) ?? 0 }))}
                    unit="%"
                    height={240}
                  />
                  {barsKey('Parte de los mensajes aptos con esa emoción, en %')}
                </>
              ) : (
                <div className="callout">Muestra insuficiente para este recorte.</div>
              )}
            </Panel>
            <Panel
              id="ventas-en-vivo-indices"
              title="Entusiasmo, fricción y desconfianza por rubro (mensajes por cada 1.000)"
              lede={`Entusiasmo = alegría + pedidos; fricción = «caro», enojo y disgusto; desconfianza = «estafa», «no llegó», «réplica». Solo rubros con ${MIN_MESSAGES} mensajes o más.`}
              source={SOURCE}
            >
              <div className="rail-pills">
                {(
                  [
                    ['enthusiasm', 'Entusiasmo'],
                    ['friction', 'Fricción'],
                    ['distrust', 'Desconfianza'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={measure === value ? 'chip chip-on' : 'chip'}
                    aria-pressed={measure === value}
                    onClick={() => setMeasure(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <ShareBars
                data={rubros
                  .filter((row) => row.messages >= MIN_MESSAGES && row[measure] !== null)
                  .map((row) => ({
                    name: labelOf('rubro', row.rubro),
                    value: row[measure] ?? 0,
                    pick: row.rubro,
                    parts: [{ name: 'Mensajes', value: row.messages }],
                  }))}
                unit="‰"
                height={Math.max(200, rubros.length * 28)}
                onPick={(value, add) => set('rubro', value, add)}
              />
              {barsKey('Mensajes de ese tipo por cada 1.000 mensajes del rubro')}
            </Panel>
          </div>

          <div className="grid-pair">
            <Panel
              id="ventas-en-vivo-frases"
              title="Comentarios más repetidos (personas distintas que lo escribieron)"
              lede="Frases dichas por al menos 5 personas distintas en al menos 3 lives. Nunca una cita de alguien: la frase es de muchos."
              source={SOURCE}
            >
              {phrases.length ? (
                <>
                  <ShareBars
                    data={phrases.map((row) => ({
                      name: `«${readable(row.phrase)}»`,
                      value: row.people,
                      parts: [
                        { name: 'Lives', value: row.lives },
                        ...(row.emotion ? [{ name: EMOTION_LABEL[row.emotion] ?? row.emotion, value: 1 }] : []),
                      ],
                      ...(row.signal && SIGNAL_LABEL[row.signal] ? { note: SIGNAL_LABEL[row.signal] as string } : {}),
                    }))}
                    unit="personas"
                    decimals={0}
                    height={Math.max(220, phrases.length * 26)}
                  />
                  {barsKey('Personas distintas que escribieron esa frase')}
                </>
              ) : (
                <div className="callout">
                  Ninguna frase llega todavía a 5 personas en 3 lives distintos. Se publican a medida que se suman noches.
                </div>
              )}
            </Panel>
            <Panel
              id="ventas-en-vivo-palabras"
              title="Palabras más repetidas (menciones)"
              lede="Lo que más se repite en el chat o en la voz del vendedor, según el rubro elegido."
              source={SOURCE}
            >
              <div className="rail-pills">
                {(
                  [
                    ['AUDIENCE', 'En el chat'],
                    ['SELLER', 'En la voz del vendedor'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={scope === value ? 'chip chip-on' : 'chip'}
                    aria-pressed={scope === value}
                    onClick={() => setScope(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <TermCloud data={cloud} limit={60} />
              <ChartLegend items={[{ color: 'var(--official)', label: 'El tamaño de la palabra es cuántas veces se repite' }]} />
            </Panel>
          </div>

          <Panel
            id="ventas-en-vivo-cobertura"
            title="Mensajes sin clasificar en cada noche de captura (% de los mensajes)"
            lede="Cuánto se vio y cuánto quedó fuera: lives con muro, sin venta o de otro país, y mensajes sin ninguna señal."
            source={SOURCE}
          >
            <ViewToggle
              chart={
                <>
                  <ShareBars
                    data={coverage.map((night) => ({
                      name: night.run,
                      value: night.messages ? 100 - (share(night.messagesWithSignal, night.messages) ?? 0) : 0,
                      parts: [
                        { name: 'Mensajes', value: night.messages },
                        { name: 'Lives abiertos', value: night.roomsOpened },
                        { name: 'Con muro', value: night.roomsBlocked },
                      ],
                    }))}
                    unit="%"
                    height={Math.max(160, coverage.length * 30)}
                  />
                  {barsKey('Mensajes de la noche sin ninguna señal de compra, pregunta o reclamo, en %')}
                </>
              }
              table={
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Noche</th>
                  <th>Lives abiertos</th>
                  <th>Con muro</th>
                  <th>Con venta</th>
                  <th>Sin rubro</th>
                  <th>Horas</th>
                  <th>Mensajes</th>
                  <th>Sin señal (%)</th>
                  <th>Voz (segmentos)</th>
                  <th>Pantalla (lecturas)</th>
                  <th>Precios</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((night) => (
                  <tr key={night.run}>
                    <td>{night.run}</td>
                    <td>{count(night.roomsOpened)}</td>
                    <td>{count(night.roomsBlocked)}</td>
                    <td>{count(night.roomsCommerce)}</td>
                    <td>{count(night.roomsUnidentified)}</td>
                    <td>{decimal(night.minutes / 60)}</td>
                    <td>{count(night.messages)}</td>
                    <td>{decimal(night.messages ? 100 - (share(night.messagesWithSignal, night.messages) ?? 0) : null)}</td>
                    <td>{count(night.speechSegments)}</td>
                    <td>{count(night.screenReads)}</td>
                    <td>{count(night.prices)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
              }
            />
          </Panel>
        </div>
      </div>
    </>
  );
}

/** La página de ventas en vivo, pedida al abrirse: no viaja con el resto de «Empresas». */
export function LiveCommerceSection() {
  const { payload, failed } = useOnOpen<{ board: LiveCommerceBoard }>('/api/ventas-en-vivo');
  if (!payload) return <OnOpenNotice what="las ventas en vivo" failed={failed} />;
  return <LiveCommerceExplorer board={payload.board} />;
}
