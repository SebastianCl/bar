import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AppRole } from '../lib/database.types';
import { useAuth } from './auth-context';
import { FullPageState } from '../components/States';

export function AuthGuard() {
  const { session, profile, isLoading, error, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageState kind="loading" title="Validando tu sesión" />;

  if (error) {
    return (
      <FullPageState
        kind="error"
        title="No pudimos validar el acceso"
        description={error.message}
        actionLabel="Cerrar sesión"
        onAction={() => void signOut()}
      />
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!profile) {
    return (
      <FullPageState
        kind="error"
        title="Usuario sin perfil operativo"
        description="Pide al administrador que habilite tu usuario para este bar."
        actionLabel="Cerrar sesión"
        onAction={() => void signOut()}
      />
    );
  }

  if (!profile.is_active) {
    return (
      <FullPageState
        kind="error"
        title="Usuario desactivado"
        description="Tu acceso está suspendido. Comunícate con el administrador."
        actionLabel="Cerrar sesión"
        onAction={() => void signOut()}
      />
    );
  }

  return <Outlet />;
}

export function PublicOnlyGuard({ children }: { children: ReactNode }) {
  const { session, profile, isLoading } = useAuth();
  if (isLoading)
    return <FullPageState kind="loading" title="Preparando la aplicación" />;
  if (session && profile?.is_active) return <Navigate to="/cuentas" replace />;
  return children;
}

export function RoleGuard({ roles }: { roles: AppRole[] }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) {
    return (
      <FullPageState
        kind="error"
        title="Acceso restringido"
        description="Tu rol no permite administrar esta sección."
        actionLabel="Volver a cuentas"
        actionHref="/cuentas"
      />
    );
  }
  return <Outlet />;
}
