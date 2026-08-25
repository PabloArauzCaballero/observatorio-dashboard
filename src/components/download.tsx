'use client';

/**
 * The same two buttons everywhere.
 *
 * An analyst shown a chart will want the numbers behind it, and the alternative
 * to offering them is being asked for them. Every section offers its own data
 * in both formats, from the same control in the same place, so the offer never
 * has to be looked for.
 */
export function Download({ dataset, label }: { dataset: string; label: string }) {
  return (
    <div className="download">
      <span className="download-label">{label}</span>
      <a className="download-btn" href={`/api/export?dataset=${dataset}&format=csv`}>
        CSV
      </a>
      <a className="download-btn" href={`/api/export?dataset=${dataset}&format=json`}>
        JSON
      </a>
    </div>
  );
}
