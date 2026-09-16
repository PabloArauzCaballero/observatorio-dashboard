import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * The guard, applied on the server before any private markup exists.
 *
 * A client-side check would send the page and then hide it, which is a screen
 * an attacker reads in the network tab. Here the decision is taken before a
 * byte of it is rendered, and an anonymous visitor receives a redirect and
 * nothing else — no counts, no source names, no environment.
 *
 * It is not the only check and it is not the important one: every figure below
 * comes from the core, which applies its own roles to the token minted for this
 * session. Removing this layout would cost a redirect, not a permission.
 */
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session) redirect('/admin/login');
  return (
    <AdminShell
      environmentId={process.env.ADMIN_ENVIRONMENT_LABEL ?? 'por confirmar'}
      operator={session.name}
    >
      {children}
    </AdminShell>
  );
}
