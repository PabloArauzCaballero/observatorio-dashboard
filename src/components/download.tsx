'use client';

import { describeVisit, report } from '@/lib/analytics';

/**
 * The same two buttons everywhere.
 *
 * An analyst shown a chart will want the numbers behind it, and the alternative
 * to offering them is being asked for them. Every section offers its own data
 * in both formats, from the same control in the same place, so the offer never
 * has to be looked for.
 *
 * The click reports an **intention**, and that is all it is. The file itself is
 * recorded by the server that builds it, so the two never have to be reconciled
 * from opposite ends: a click that never became a file is visible as an
 * intention with no generation, which is exactly the case worth seeing. The
 * link keeps working whether or not the report is sent.
 */
export function Download({ dataset, label }: { dataset: string; label: string }) {
  const announce = (): void => {
    const visit = describeVisit('DOWNLOAD_INTENT');
    if (visit) report({ ...visit, route: `/descarga/${dataset}` });
  };

  return (
    <div className="download">
      <span className="download-label">{label}</span>
      <a
        className="download-btn"
        href={`/api/export?dataset=${dataset}&format=csv`}
        onClick={announce}
      >
        CSV
      </a>
      <a
        className="download-btn"
        href={`/api/export?dataset=${dataset}&format=json`}
        onClick={announce}
      >
        JSON
      </a>
    </div>
  );
}
