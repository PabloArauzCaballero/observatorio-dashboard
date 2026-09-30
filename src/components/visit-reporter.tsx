'use client';

import { useEffect } from 'react';
import { describeVisit, report } from '@/lib/analytics';

/**
 * Reports one page view per visit to this page, once.
 *
 * Mounted in the public layout rather than in each section, so a reader who
 * opens «Prensa» and then «Ciudades» is one visit to the report and not three.
 * The effect guards against React running it twice in development, because a
 * counter that doubles under Strict Mode is a counter nobody can reconcile with
 * the server log.
 *
 * It renders nothing and it never blocks. If the receiver is down, the visit is
 * not recorded and the page is exactly as it was.
 */
export function VisitReporter(): null {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const marker = '__observatorioVisitReported';
    const flags = window as unknown as Record<string, unknown>;
    if (flags[marker] === window.location.pathname) return;
    flags[marker] = window.location.pathname;
    report(describeVisit('PAGE_VIEW'));
  }, []);
  return null;
}
