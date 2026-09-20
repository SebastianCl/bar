import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { getBarSettings } from '../lib/api';
import { roleLabel } from '../lib/format';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const navigation = [
  { to: '/cuentas', label: 'Cuentas', icon: '▤' },
  { to: '/inventario', label: 'Inventario', icon: '▣' },
  { to: '/ventas', label: 'Ventas', icon: '↗' },
];

const themeStorageKey = 'bar-theme';

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const isOnline = useOnlineStatus();
  const [barName, setBarName] = useState('Bar');
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem(themeStorageKey) === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try {
      localStorage.setItem(themeStorageKey, darkMode ? 'dark' : 'light');
    } catch {
      // Theme still works for this session when storage is unavailable.
    }
  }, [darkMode]);

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
          <button
            type="button"
            className="button button--ghost button--full theme-toggle"
            aria-pressed={darkMode}
            onClick={() => setDarkMode((current) => !current)}
          >
            <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
            {darkMode ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <div className="user-summary">
            <span className="user-summary__avatar" aria-hidden="true">
              {profile?.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{profile?.display_name}</strong>
              <small>{roleLabel(profile?.role ?? '')}</small>
            </span>
          </div>
          <button
            type="button"
            className="button button--ghost button--full"
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
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
          <div className="mobile-header__actions">
            <button
              type="button"
              className="icon-button theme-toggle-icon"
              aria-label={darkMode ? 'Activar modo claro' : 'Activar modo oscuro'}
              aria-pressed={darkMode}
              onClick={() => setDarkMode((current) => !current)}
            >
              <span aria-hidden="true">{darkMode ? '☀' : '☾'}</span>
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => void signOut()}
            >
              Salir
            </button>
          </div>
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
