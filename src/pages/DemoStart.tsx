import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FullPageLoader } from '@/layouts/guards';
import { config, DEMO_SESSION_KEY } from '@/lib/config';
import { backend, errorMessage } from '@/services';

/** /demo: opens the demo area, signed into a ready-made account with fictional sample data. */
export default function DemoStart() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    // The backend is chosen when the app loads, so arriving here from inside the real app needs a fresh load.
    if (!config.isSampleDemo) {
      try {
        localStorage.setItem(DEMO_SESSION_KEY, '1');
      } catch {
        /* config falls back to the /demo path */
      }
      window.location.reload();
      return;
    }
    backend.enterDemo!()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch((e) => setError(errorMessage(e, 'The demo could not be started.')));
  }, [navigate]);

  if (error) return <p className="p-8 text-center text-coral-700">{error}</p>;
  return <FullPageLoader />;
}
