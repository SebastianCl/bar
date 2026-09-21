import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Spinner } from '../components/States';
import { normalizeError } from '../lib/errors';
import { resetPasswordSchema } from '../lib/schemas';
import { getSupabase } from '../lib/supabase';

export function ResetPasswordPage() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!isLoading && !session) return <Navigate to="/recuperar" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const parsed = resetPasswordSchema.safeParse({ password, confirmation });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa las contraseñas.');
      return;
    }
    setPending(true);
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({
        password: parsed.data.password,
      });
      if (updateError) throw updateError;
      navigate('/cuentas', { replace: true });
    } catch (caught) {
      setError(normalizeError(caught, 'No fue posible cambiar la contraseña.').message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="simple-auth-page">
      <section className="auth-card auth-card--standalone">
        <div className="auth-brand">
          <span>B</span>
          <strong>Charcuteria La 61</strong>
        </div>
        <div>
          <p className="eyebrow">Nueva contraseña</p>
          <h1>Protege tu acceso</h1>
          <p className="muted">
            Usa al menos 8 caracteres y no compartas la contraseña.
          </p>
        </div>
        {error ? (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        ) : null}
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <button
            className="button button--primary button--large button--full"
            disabled={pending}
          >
            {pending ? (
              <>
                <Spinner />
                Guardando…
              </>
            ) : (
              'Guardar contraseña'
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
