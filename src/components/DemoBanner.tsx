import { useState } from 'react';
import { config, exitDemo } from '@/lib/config';
import { IconBeaker, IconX } from './icons';

export function DemoBanner() {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('sr-demo-banner') === 'hidden');
  if (!config.isDemo) return null;
  // The demo area always shows its banner so there's a way back to the real app.
  if (!config.isSampleDemo && hidden) return null;
  return (
    <div className="relative z-40 bg-navy text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-[13px]">
        <IconBeaker size={16} className="shrink-0 text-teal-200" />
        {config.isSampleDemo ? (
          <>
            <p className="min-w-0 flex-1">
              <strong className="font-semibold">You're in the demo.</strong> Contacts, journeys and reports marked "Sample" are fictional, and no messages are sent. Routes, crime, lighting and news data are real.
            </p>
            <button
              type="button"
              onClick={exitDemo}
              className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 font-semibold hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
            >
              Exit demo
            </button>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1">
              <strong className="font-semibold">Not connected to a server.</strong> Your data is stored only in this browser and no messages are sent.
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('sr-demo-banner', 'hidden');
                setHidden(true);
              }}
              className="rounded-md p-1.5 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-200"
              aria-label="Hide notice"
            >
              <IconX size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
