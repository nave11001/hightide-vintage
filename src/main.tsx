import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {initPostHog} from './posthog';
import {dismissSplash} from './splash';
import './index.css';

// A deadline on the splash in index.html, armed before anything that could
// throw. Everything that normally takes the splash down runs inside the app, so
// a failure to mount would otherwise leave a white screen with no way past it.
// Long enough that it never fires on a real load.
window.setTimeout(dismissSplash, 8000);

initPostHog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
