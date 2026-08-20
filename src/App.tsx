import { Suspense, lazy } from 'react';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AuthGuard, PublicOnlyGuard } from './auth/guards';
import { FullPageState } from './components/States';
import { ToastProvider } from './components/ToastProvider';
import { AppLayout } from './layout/AppLayout';
import { getEnvironmentIssues } from './lib/env';

const AccountDetailPage = lazy(() =>
  import('./pages/AccountDetailPage').then((module) => ({
    default: module.AccountDetailPage,
  })),
);
const AccountsPage = lazy(() =>
  import('./pages/AccountsPage').then((module) => ({ default: module.AccountsPage })),
);
const AuthCallbackPage = lazy(() =>
  import('./pages/AuthCallbackPage').then((module) => ({
    default: module.AuthCallbackPage,
  })),
);
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((module) => ({ default: module.InventoryPage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const ReceiptPage = lazy(() =>
  import('./pages/ReceiptPage').then((module) => ({ default: module.ReceiptPage })),
);
const RecoveryPage = lazy(() =>
  import('./pages/RecoveryPage').then((module) => ({ default: module.RecoveryPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const SalesPage = lazy(() =>
  import('./pages/SalesPage').then((module) => ({ default: module.SalesPage })),
);

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyGuard>
        <LoginPage />
      </PublicOnlyGuard>
    ),
  },
  {
    path: '/recuperar',
    element: (
      <PublicOnlyGuard>
        <RecoveryPage />
      </PublicOnlyGuard>
    ),
  },
  { path: '/auth/callback', element: <AuthCallbackPage /> },
  { path: '/restablecer', element: <ResetPasswordPage /> },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/cuentas" replace /> },
          { path: '/cuentas', element: <AccountsPage /> },
          { path: '/cuentas/:id', element: <AccountDetailPage /> },
          { path: '/inventario', element: <InventoryPage /> },
          { path: '/ventas', element: <SalesPage /> },
          { path: '/comprobantes/:id', element: <ReceiptPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export function App() {
  const issues = getEnvironmentIssues();
  if (issues.length > 0)
    return (
      <FullPageState
        kind="error"
        title="Falta configurar la aplicación"
        description={issues.join(' ')}
      />
    );
  return (
    <AuthProvider>
      <ToastProvider>
        <Suspense fallback={<FullPageState kind="loading" title="Cargando pantalla" />}>
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
    </AuthProvider>
  );
}
