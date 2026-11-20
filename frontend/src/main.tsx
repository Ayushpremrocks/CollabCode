import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import './collab/monacoSetup';
import App from './App';
import { onSlowRequest, warmUpBackend } from './services/api';
import { toast } from './components/ui/CollabToast';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in frontend/.env — get it from Clerk Dashboard → API Keys');
}

// The Render free-tier backend sleeps when idle and takes 1–2 minutes to boot.
// Start waking it now so it is ready by the time the user has signed in.
warmUpBackend();

let lastSlowNotice = 0;
onSlowRequest(() => {
  const now = Date.now();
  if (now - lastSlowNotice < 60_000) return;
  lastSlowNotice = now;
  toast.info('The server is waking up — this can take up to a minute on the first request.', 'Please wait', 8000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>,
);
