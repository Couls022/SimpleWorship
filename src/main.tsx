import './utils/initPptxViewer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.onerror = function (message, source, lineno, colno, error) {
  console.error('[Fatal Application Error]', { message, source, lineno, colno, error });
};

window.addEventListener('unhandledrejection', function (event) {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
