import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { getBarSettings } from '../lib/api';
import { roleLabel } from '../lib/format';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { isDummyMode } from '../lib/env';
import { resetDummyData } from '../lib/dummy-store';

const navigation = [
  { to: '/cuentas', label: 'Cuentas', icon: '▤' },
  { to: '/inventario', label: 'Inventario', icon: '□' },
  { to: '/ventas', label: 'Ventas', icon: '↗' },
];

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const [barName, setBarName] = useState('Bar');
  const demoMode = isDummyMode();

  const resetDemo = () => {
    resetDummyData();
    window.location.assign('/cuentas');
  };

  useEffect(() => {
    void getBarSettings()
      .then((settings) => {
        if (settings?.bar_name) setBarName(settings.bar_name);
      })
      .catch(() => undefined);
  }, []);

  const visibleNavigation = navigation;

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <span className="brand__mark">B</span>
          <span>
            <strong>{barName}</strong>
            <small>Operación</small>
          </span>
        </div>
        <nav className="sidebar__nav" aria-label="Navegación principal">
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item--active' : ''}`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          {demoMode ? (
            <div className="alert alert--info" role="status">
              Modo demo: los cambios se guardan solo en este navegador.
            </div>
          ) : null}
          <div className="user-summary">
            <span className="user-summary__avatar" aria-hidden="true">
              {profile?.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{profile?.display_name}</strong>
              <small>{roleLabel(profile?.role ?? '')}</small>
            </span>
          </div>
          {demoMode ? (
            <button
              type="button"
              className="button button--ghost button--full"
              onClick={resetDemo}
            >
              Reiniciar datos demo
            </button>
          ) : (
            <button
              type="button"
              className="button button--ghost button--full"
              onClick={() => void signOut()}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </aside>

      <div className="app-shell__content">
        {!isOnline ? (
          <div className="offline-banner no-print" role="alert">
            <span />
            Sin conexión. Puedes consultar esta pantalla, pero no guardar cambios.
          </div>
        ) : null}
        <header className="mobile-header no-print">
          <div className="brand">
            <span className="brand__mark">B</span>
            <strong>{barName}</strong>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={demoMode ? resetDemo : () => void signOut()}
          >
            {demoMode ? 'Reiniciar' : 'Salir'}
          </button>
        </header>
        <main className="app-main">
          <Outlet />
        </main>
        <nav className="bottom-nav no-print" aria-label="Navegación móvil">
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`
              }
            >
              <span aria-hidden="true">{item.icon}</span>
              <small>{item.label}</small>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
