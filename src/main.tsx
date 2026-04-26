import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './routes';
import { initGameIfNeeded } from './db/initGame';
import './index.css';

if (import.meta.env.DEV) {
  import('./lib/devTools').then(({ dev }) => {
    (window as any).dev = dev;
    console.log('%c[Boxing Manager] dev tools loaded — try dev.boxer(1), dev.simCalc(71, 1), dev.allBoxers()', 'color: #4CAF50');
  });
}

const router = createBrowserRouter(routes);

initGameIfNeeded().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
