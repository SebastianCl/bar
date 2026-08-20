import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FullPageState } from '../components/States';
import { normalizeError } from '../lib/errors';
import { getSupabase } from '../lib/supabase';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const exchange = async () => {
      try {
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } =
            await getSupabase().auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
        const next = params.get('next');
        navigate(next?.startsWith('/') ? next : '/cuentas', { replace: true });
      } catch (caught) {
        setError(normalizeError(caught, 'El enlace no es válido o ya venció.').message);
      }
    };
    void exchange();
  }, [navigate, params]);

  if (error)
    return (
      <FullPageState
        kind="error"
        title="No pudimos abrir el enlace"
        description={error}
      />
    );
  return (
    <FullPageState
      kind="loading"
      title="Validando el enlace"
      description="Esto solo tomará un momento."
    />
  );
}
