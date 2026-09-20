import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { consumeAuthNotice } from '../auth/auth-context';
import { normalizeError } from '../lib/errors';
import { loginSchema } from '../lib/schemas';
import { getSupabase } from '../lib/supabase';
import { Spinner } from '../components/States';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice] = useState<string | null>(() => consumeAuthNotice());
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    const parsed = loginSchema.safeParse({ username, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos.');
      return;
    }
    setPending(true);
    try {
      const supabase = getSupabase();
      const { data, error: loginError } = await supabase.functions.invoke(
        'username-login',
        {
          body: {
            username: parsed.data.username,
            password: parsed.data.password,
          },
        },
      );
      if (loginError || !data?.session) {
        throw new Error('Usuario o contraseña incorrectos.');
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) throw sessionError;
      const requested = (location.state as { from?: string } | null)?.from;
      navigate(requested?.startsWith('/') ? requested : '/cuentas', { replace: true });
    } catch (caught) {
      setError(normalizeError(caught, 'No fue posible iniciar sesión.').message);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="Sistema de operación del bar">
        <div className="auth-hero__content">
          <span className="auth-hero__badge">Operación diaria</span>
          <h1>
            Todo el bar,
            <br />
            en una sola cuenta.
          </h1>
          <p>
            Inventario, consumos y comprobantes claros para que el equipo se concentre
            en atender.
          </p>
          <div className="auth-hero__metrics">
            <span>
              <strong>1</strong> flujo simple
            </span>
            <span>
              <strong>100%</strong> historial
            </span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-brand">
            <span>B</span>
            <strong>Bar · Operación</strong>
          </div>
          <div>
            <p className="eyebrow">Acceso del equipo</p>
            <h2>Inicia sesión</h2>
            <p className="muted">Usa el usuario asignado por el administrador.</p>
          </div>
          {notice ? (
            <div className="alert alert--info" role="status">
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          ) : null}
          <form className="form-stack" onSubmit={submit} noValidate>
            <label className="field">
              <span>Usuario</span>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button
              className="button button--primary button--large button--full"
              type="submit"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Spinner label="Ingresando" />
                  Ingresando…
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
          <Link className="auth-link" to="/recuperar">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </section>
    </main>
  );
}
