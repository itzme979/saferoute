import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DemoBanner } from '@/components/DemoBanner';
import { IconArrowRight, IconChevronLeft } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { PreferenceChips } from '@/components/PreferenceChips';
import { Button, Card, Notice, Select, Toggle } from '@/components/ui';
import { useProfile, useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { browserNotificationPermission, requestBrowserNotifications } from '@/lib/browserNotifications';
import { firstName, cx } from '@/lib/format';
import { errorMessage } from '@/services';

const STEPS = ['Route priorities', 'Arrival check-ins', 'Privacy'];

export default function Onboarding() {
  const profile = useProfile();
  const { updateProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [walking, setWalking] = useState(profile.walkingPreferences);
  const [notif, setNotif] = useState(profile.notificationPreferences);
  const [privacy, setPrivacy] = useState(profile.privacy);
  const [emergencyNumber, setEmergencyNumber] = useState(profile.emergencyNumber);
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState(browserNotificationPermission());

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await updateProfile({ walkingPreferences: walking, notificationPreferences: notif, privacy, emergencyNumber, onboarded: true });
      toast.success('You are all set', 'You can change these choices any time in Settings.');
      navigate('/dashboard', { replace: true });
    } catch (e) {
      toast.error('Could not save your preferences', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const enableBrowser = async (on: boolean) => {
    if (!on) return setNotif((n) => ({ ...n, browser: false }));
    const p = await requestBrowserNotifications();
    setPerm(p);
    setNotif((n) => ({ ...n, browser: p === 'granted' }));
  };

  return (
    <div className="min-h-screen bg-warm">
      <DemoBanner />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Logo to="/onboarding" />
        <div className="mt-8">
          <p className="text-sm font-semibold text-teal-700">Step {step + 1} of {STEPS.length}</p>
          <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-navy">
            {step === 0 && `Welcome, ${firstName(profile.fullName)}. What matters to you on a walk?`}
            {step === 1 && 'How should arrival check-ins work?'}
            {step === 2 && 'Your privacy, your choice'}
          </h1>
          <div className="mt-4 flex gap-2" aria-hidden="true">
            {STEPS.map((s, i) => <span key={s} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-teal-500' : 'bg-navy-100')} />)}
          </div>
        </div>

        <Card className="mt-8 p-5 sm:p-7" key={step}>
          <div className="animate-fade-up">
            {step === 0 && (
              <>
                <p className="mb-5 text-[15px] text-slate-600">We'll compare routes using these priorities. Pick as many as you like. You can also adjust them for each journey.</p>
                <PreferenceChips value={walking} onChange={setWalking} layout="grid" showHints />
                <Notice tone="neutral" className="mt-5">Route information comes from OpenStreetMap and community reports. Some areas have little mapped data, and SafeRoute will tell you when that's the case.</Notice>
              </>
            )}
            {step === 1 && (
              <div className="divide-y divide-mist">
                <p className="pb-4 text-[15px] text-slate-600">SafeArrival is optional for each journey. These are your defaults.</p>
                <div className="grid gap-4 py-4 sm:grid-cols-2">
                  <Select label="Remind me before arrival" value={notif.checkinReminderMinutes} onChange={(e) => setNotif({ ...notif, checkinReminderMinutes: +e.target.value })}>
                    {[2, 5, 10].map((m) => <option key={m} value={m}>{m} minutes before</option>)}
                  </Select>
                  <Select label="Grace period after arrival time" value={notif.missedCheckinGraceMinutes} onChange={(e) => setNotif({ ...notif, missedCheckinGraceMinutes: +e.target.value })}>
                    {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                  </Select>
                </div>
                <Toggle
                  checked={notif.notifyContactsOnMissedCheckin}
                  onChange={(v) => setNotif({ ...notif, notifyContactsOnMissedCheckin: v })}
                  label="Offer to notify my contacts if I miss a check-in"
                  description="You'll still choose which contacts, for each journey. They receive a calm message saying you haven't confirmed arrival yet. SafeRoute never contacts emergency services."
                />
                <Toggle
                  checked={notif.browser && perm === 'granted'}
                  onChange={enableBrowser}
                  disabled={perm === 'unsupported' || perm === 'denied'}
                  label="Browser notifications"
                  description={perm === 'denied' ? 'Notifications are blocked for this site. You can allow them in your browser settings.' : perm === 'unsupported' ? 'This browser does not support notifications.' : 'Get reminders even when SafeRoute is in another tab. Your browser will ask for permission.'}
                />
                <Notice tone="neutral" className="mt-4">Notifications depend on your device, browser and network, and may be delayed or not delivered.</Notice>
              </div>
            )}
            {step === 2 && (
              <div className="divide-y divide-mist">
                <Toggle checked={privacy.saveJourneyHistory} onChange={(v) => setPrivacy({ ...privacy, saveJourneyHistory: v })} label="Save my journey history" description="When off, journeys are deleted as soon as they end." />
                <Toggle checked={privacy.defaultShareLiveLocation} onChange={(v) => setPrivacy({ ...privacy, defaultShareLiveLocation: v })} label="Suggest live location when sharing a journey" description="Off by default. Even when on, you confirm sharing for every journey." />
                <div className="pt-4">
                  <Select label="Emergency number" value={emergencyNumber} onChange={(e) => setEmergencyNumber(e.target.value)} hint="Used by the Call button in SafeSOS.">
                    <option value="911">911 (Canada, United States)</option>
                    <option value="112">112 (European Union and many countries)</option>
                    <option value="999">999 (United Kingdom)</option>
                    <option value="000">000 (Australia)</option>
                    <option value="111">111 (New Zealand)</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} icon={<IconChevronLeft size={18} />}>Back</Button>
          ) : (
            <Button variant="ghost" onClick={finish} disabled={busy}>Skip for now</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="flex-row-reverse" icon={<IconArrowRight size={18} />}>Continue</Button>
          ) : (
            <Button variant="teal" onClick={finish} loading={busy}>Finish setup</Button>
          )}
        </div>
      </div>
    </div>
  );
}
