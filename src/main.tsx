import './utils/initPptxViewer';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// --- TEMPORARY PRODUCTION DIAGNOSTIC ---
console.log('[DIAGNOSTIC] Initial Mount Data:', {
  innerWidth: window.innerWidth,
  innerHeight: window.innerHeight,
  readyState: document.readyState,
  userAgent: navigator.userAgent,
  isElectron: !!(window as any).electronAPI
});

// Optional: Force a visual log on screen if the DOM fails to render React
if (process.env.NODE_ENV !== 'development') {
  setTimeout(() => {
    if (!document.querySelector('#root > *')) {
      const diag = document.createElement('div');
      diag.style.position = 'fixed';
      diag.style.top = '10px';
      diag.style.left = '10px';
      diag.style.zIndex = '999999';
      diag.style.background = 'red';
      diag.style.color = 'white';
      diag.style.padding = '10px';
      diag.style.fontFamily = 'monospace';
      diag.style.whiteSpace = 'pre-wrap';
      diag.innerText = `[FATAL] React failed to mount.\nReadyState: ${document.readyState}\nSize: ${window.innerWidth}x${window.innerHeight}\nLocation: ${window.location.href}`;
      document.body.appendChild(diag);
    }
  }, 3000);
}
// ---------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
