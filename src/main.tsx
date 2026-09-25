import './utils/initPptxViewer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.onerror = function (message, source, lineno, colno, error) {
  console.error('[Fatal Application Error]', { message, source, lineno, colno, error });
  const rootEl = document.getElementById('root');
  if (rootEl && (!rootEl.children.length || rootEl.innerHTML === '')) {
    rootEl.innerHTML = `
      <div style="background:#0c0d10;color:#f87171;padding:32px;font-family:system-ui,sans-serif;height:100vh;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;">
        <h2 style="color:#ffffff;margin-bottom:8px;font-size:20px;">SimpleWorship Startup Notice</h2>
        <p style="color:#94a3b8;max-width:500px;font-size:14px;margin-bottom:20px;">${typeof message === 'string' ? message : 'An error occurred during startup.'}</p>
        <button onclick="window.location.reload()" style="background:#2563eb;color:#ffffff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-weight:600;">Reload App</button>
      </div>
    `;
  }
};

window.addEventListener('unhandledrejection', function (event) {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
