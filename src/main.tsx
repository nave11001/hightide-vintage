import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {initPostHog} from './posthog';
import {dismissSplash} from './splash';
import {initLocale} from './i18n';
import './index.css';
import './vintage.css';

// A deadline on the splash in index.html, armed before anything that could
// throw. Everything that normally takes the splash down runs inside the app, so
// a failure to mount would otherwise leave a white screen with no way past it.
// Long enough that it never fires on a real load.
window.setTimeout(dismissSplash, 8000);

initPostHog();

// The language is settled before the first render — Hebrew, or English with
// dollar prices for a visitor from abroad. See i18n.ts. It never throws, and
// gives up on the country after a moment, so this waits at most that long.
initLocale().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
