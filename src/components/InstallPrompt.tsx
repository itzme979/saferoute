import { useState } from 'react';
import { useInstall } from '@/lib/pwa';
import { LogoMark } from './Logo';
import { IconPlus, IconShare, IconX } from './icons';
import { Button, Modal } from './ui';

const DISMISS_KEY = 'sr-install-dismissed';

function dismissedRecently(): boolean {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - t < 14 * 86400000;
  } catch {
    return false;
  }
}

/** Gentle, dismissible card offering to install SafeRoute as an app. */
export function InstallCard() {
  const { state, install } = useInstall();
  const [hidden, setHidden] = useState(dismissedRecently);
  const [iosHelp, setIosHelp] = useState(false);

  if (hidden || state === 'installed' || state === 'unsupported') return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-navy/[0.06] bg-white p-4 shadow-soft animate-fade-up">
      <LogoMark size={40} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-navy">Install SafeRoute</p>
        <p className="text-[13px] text-slate-600">Open it from your home screen, full-screen, like any other app.</p>
      </div>
      <Button size="sm" variant="teal" onClick={() => (state === 'ios' ? setIosHelp(true) : install())}>Install</Button>
      <button type="button" onClick={dismiss} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-mist hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label="Not now">
        <IconX size={16} />
      </button>
      <IosInstallHelp open={iosHelp} onClose={() => setIosHelp(false)} />
    </div>
  );
}

export function IosInstallHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Add SafeRoute to your Home Screen" footer={<Button onClick={onClose}>Got it</Button>}>
      <ol className="space-y-4 text-[15px] text-slate-700">
        <li className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-navy"><IconShare size={18} /></span><span>In Safari, tap the <strong>Share</strong> button at the bottom (or top) of the screen.</span></li>
        <li className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-navy"><IconPlus size={18} /></span><span>Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</span></li>
      </ol>
      <p className="mt-4 text-[13px] text-slate-500">On iPhone, browser notifications only work once SafeRoute is added to your Home Screen.</p>
    </Modal>
  );
}
