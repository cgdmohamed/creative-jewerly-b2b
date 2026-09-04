import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

const splash = document.getElementById('splash');
if (splash) {
  requestAnimationFrame(() => {
    splash.style.opacity = '0';
    window.setTimeout(() => splash.remove(), 320);
  });
}
