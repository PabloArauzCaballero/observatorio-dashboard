import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/admin/login-form';
import { currentSession } from '@/lib/admin/session';

export const dynamic = 'force-dynamic';

/**
 * Asking for a password from somebody who already has a session is a dead end,
 * so an operator who lands here with one is sent where they were going.
 */
export default async function AdminLoginPage() {
  if (await currentSession()) redirect('/admin');
  return (
    <Suspense fallback={<p className="admin-note">Cargando…</p>}>
      <LoginForm />
    </Suspense>
  );
}
