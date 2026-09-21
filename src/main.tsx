import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

try {
  document.documentElement.dataset.theme =
    localStorage.getItem('bar-theme') === 'dark' ? 'dark' : 'light';
} catch {
  document.documentElement.dataset.theme = 'light';
}

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento raíz de la aplicación.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
