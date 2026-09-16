'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * The only form in the portal that takes a password.
 *
 * Two behaviours worth naming. The fields keep what was typed when the request
 * is refused, because clearing a form on error makes a mistyped character cost
 * the whole entry. And the return path is validated before it is used: a
 * `?next=` that points anywhere but this site is ignored, so the login screen
 * cannot be turned into a redirector to somebody else's page.
 */
function safeReturnPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/admin') || raw.startsWith('//')) return '/admin';
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const parameters = useSearchParams();
  const [subject, setSubject] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setProblem(body.error?.message ?? 'No fue posible iniciar sesión');
        setBusy(false);
        return;
      }
      router.replace(safeReturnPath(parameters.get('next')));
      router.refresh();
    } catch {
      setProblem('No fue posible contactar al servidor');
      setBusy(false);
    }
  };

  return (
    <form className="admin-login" onSubmit={(event) => void submit(event)}>
      <h1>Portal administrativo</h1>
      <p>Solo para personas autorizadas del Observatorio.</p>
      {problem ? (
        <p className="admin-error" role="alert">
          {problem}
        </p>
      ) : null}
      <label htmlFor="admin-subject">
        Identificador
        <input
          id="admin-subject"
          name="subject"
          autoComplete="username"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>
      <label htmlFor="admin-password">
        Contraseña
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button className="admin-button admin-button-strong" type="submit" disabled={busy}>
        {busy ? 'Verificando…' : 'Entrar'}
      </button>
    </form>
  );
}
