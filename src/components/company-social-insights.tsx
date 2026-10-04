import type { CommentSentiment } from '@/lib/company-social-board';

const pct = (value: number): string => `${value.toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
const count = (value: number): string => value.toLocaleString('es-BO');

/** El modelo resume comentarios visibles; la cantidad de la muestra siempre acompaña el porcentaje. */
export function CommentSentimentSummary({ sentiment }: { sentiment: CommentSentiment }) {
  return (
    <div className="social-comment-summary" aria-label={`Sentimiento de ${count(sentiment.analyzed)} comentarios leídos`}>
      <strong>{count(sentiment.analyzed)} comentarios leídos</strong>
      <span>Positivos {pct(sentiment.positivePct)}</span>
      <span>Neutros {pct(sentiment.neutralPct)}</span>
      <span>Negativos {pct(sentiment.negativePct)}</span>
      {sentiment.ironyPct !== null ? <span>Ironía {pct(sentiment.ironyPct)}</span> : null}
    </div>
  );
}

export function AudienceWordCloud({
  terms,
}: {
  terms: readonly { term: string; count: number; companies: number }[];
}) {
  const peak = Math.max(...terms.map((row) => row.count), 1);
  return (
    <ul className="social-word-cloud" aria-label="Nube de palabras de los comentarios leídos">
      {terms.map((row) => (
        <li key={row.term}>
          <span
            style={{ fontSize: `${(0.9 + 1.15 * Math.sqrt(row.count / peak)).toFixed(2)}rem` }}
            title={`${count(row.count)} menciones en ${count(row.companies)} empresas`}
            aria-label={`${row.term}: ${count(row.count)} menciones en ${count(row.companies)} empresas`}
          >
            {row.term}
          </span>
        </li>
      ))}
    </ul>
  );
}
