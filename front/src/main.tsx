// Patch window.fetch property descriptor before polyfills execute
if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
  try {
    let currentFetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get: () => currentFetch,
      set: (v: typeof window.fetch) => { currentFetch = v; },
      configurable: true,
      enumerable: true,
    });
  } catch {
    // Ignore descriptor errors
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
