import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/States';
import { normalizeError } from '../lib/errors';
import { recoverySchema } from '../lib/schemas';
import { getSupabase } from '../lib/supabase';

export function RecoveryPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const parsed = recoverySchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Escribe un correo válido.');
      return;
    }
    setPending(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/restablecer')}`;
      const { error: authError } = await getSupabase().auth.resetPasswordForEmail(
        parsed.data.email,
        { redirectTo },
      );
      if (authError) throw authError;
      setSent(true);
    } catch (caught) {
      setError(normalizeError(caught, 'No fue posible enviar el enlace.').message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="simple-auth-page">
      <section className="auth-card auth-card--standalone">
        <div className="auth-brand">
          <span>61</span>
          <strong>Charcuteria La 61</strong>
        </div>
        <div>
          <p className="eyebrow">Recuperar acceso</p>
          <h1>Restablece tu contraseña</h1>
          <p className="muted">
            Te enviaremos un enlace si el correo pertenece a un usuario habilitado.
          </p>
        </div>
        {sent ? (
          <div className="success-panel" role="status">
            <strong>Revisa tu correo</strong>
            <p>
              El enlace puede tardar unos minutos. También revisa la carpeta de spam.
            </p>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit} noValidate>
            {error ? (
              <div className="alert alert--error" role="alert">
                {error}
              </div>
            ) : null}
            <label className="field">
              <span>Correo</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
                required
              />
            </label>
            <button
              className="button button--primary button--large button--full"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Spinner />
                  Enviando…
                </>
              ) : (
                'Enviar enlace'
              )}
            </button>
          </form>
        )}
        <Link className="auth-link" to="/login">
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  );
}
