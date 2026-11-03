import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconCheckCircle, IconInfo, IconMail, IconPhone, IconSend, IconUsers } from '@/components/icons';
import { Button, Card, Checkbox, Notice, Skeleton, TextArea, Toggle } from '@/components/ui';
import { useProfile } from '@/context/AuthContext';
import { useJourney } from '@/context/JourneyContext';
import { useAsync } from '@/hooks/useAsync';
import { config } from '@/lib/config';
import { getCurrentPosition } from '@/lib/location';
import { PageContainer } from '@/layouts/AppLayout';
import { backend, errorMessage } from '@/services';
import type { LatLng, SendResult } from '@/types';

type Phase = 'compose' | 'countdown' | 'sending' | 'done';
const COUNTDOWN = 5;

export default function Sos() {
  const profile = useProfile();
  const { journey } = useJourney();
  const contacts = useAsync(() => backend.listContacts(), []);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('compose');
  const [count, setCount] = useState(COUNTDOWN);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locNote, setLocNote] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const eligible = (contacts.data ?? []).filter((c) => c.inviteStatus === 'accepted' && c.canReceiveSos);
  const withPhone = (contacts.data ?? []).filter((c) => c.phone);
  const number = profile.emergencyNumber;

  // Preselect everyone eligible once contacts load.
  useEffect(() => {
    if (contacts.data) setSelected(eligible.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.data]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const send = async () => {
    setPhase('sending');
    setError(null);
    let location: LatLng | null = null;
    if (includeLocation) {
      try {
        const p = await getCurrentPosition();
        location = { lat: p.lat, lng: p.lng };
      } catch (e) {
        setLocNote(`Your location could not be included: ${(e as Error).message}`);
      }
    }
    try {
      const r = await backend.sendSos({ contactIds: selected, location, note: note.trim(), journeyId: journey?.shareEnabled ? journey.id : undefined });
      setResult(r);
      setPhase('done');
    } catch (e) {
      setError(errorMessage(e));
      setPhase('compose');
    }
  };

  const beginCountdown = () => {
    if (selected.length === 0) return setError('Choose at least one contact to alert.');
    setError(null);
    setLocNote(null);
    setCount(COUNTDOWN);
    setPhase('countdown');
    let n = COUNTDOWN;
    timer.current = setInterval(() => {
      n -= 1;
      setCount(n);
      if (n <= 0) {
        clearInterval(timer.current!);
        timer.current = null;
        send();
      }
    }, 1000);
  };

  const cancelCountdown = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setPhase('compose');
  };

  return (
    <PageContainer>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-[28px]">SafeSOS</h1>
      <p className="mt-1 text-[15px] text-slate-600">Get help quickly. Nothing happens until you tap a button.</p>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Call emergency services */}
        <Card className="border-coral-100 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-navy">Call emergency services</h2>
          <a
            href={`tel:${number}`}
            className="mt-4 flex min-h-[72px] items-center justify-center gap-3 rounded-2xl bg-coral-600 px-6 text-2xl font-extrabold text-white shadow-lift transition hover:bg-coral-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral-500/40 active:scale-[0.99]"
            aria-describedby="call-explain"
          >
            <IconPhone size={28} /> Call {number}
          </a>
          <p id="call-explain" className="mt-3 text-sm leading-relaxed text-slate-600">
            Tapping this opens your phone's calling screen with {number} ready to dial. Your phone places the call, not SafeRoute. On a computer or tablet without calling, this may not work, so use a phone if you can.
          </p>
          <Link to="/settings#privacy" className="mt-2 inline-block text-[13px] font-semibold text-teal-700 hover:underline">Not in a {number} region? Change your emergency number</Link>

          {withPhone.length > 0 && (
            <div className="mt-6 border-t border-mist pt-4">
              <h3 className="text-sm font-bold text-navy">Call someone you trust</h3>
              <ul className="mt-2 space-y-2">
                {withPhone.map((c) => (
                  <li key={c.id}>
                    <a href={`tel:${c.phone!.replace(/[^\d+]/g, '')}`} className="flex min-h-[52px] items-center gap-3 rounded-xl border border-navy-100 px-4 font-semibold text-navy transition hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
                      <IconPhone size={18} className="text-teal-700" />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-sm font-normal text-slate-500">{c.phone}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Alert contacts */}
        <Card className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy"><IconUsers size={20} /> Alert emergency contacts</h2>
          <p className="mt-1 text-sm text-slate-600">Sends an email to the people you choose, asking them to check on you.</p>

          {phase === 'done' && result ? (
            <div className="mt-5 animate-fade-up">
              <div className="flex items-start gap-3 rounded-xl bg-teal-50 p-4">
                <IconCheckCircle size={22} className="mt-0.5 shrink-0 text-teal-700" />
                <div className="text-sm text-teal-800">
                  {result.simulated ? (
                    <p className="font-semibold">{result.message}</p>
                  ) : (
                    <>
                      <p className="font-semibold">Alert handed to our email provider for {result.sent} contact{result.sent === 1 ? '' : 's'}.</p>
                      {result.failed > 0 && <p className="mt-1">{result.failed} could not be sent (no email address, permission off, or invitation not accepted).</p>}
                      <p className="mt-1">Email delivery can be delayed and isn't guaranteed. If you can, also call or text someone directly.</p>
                    </>
                  )}
                </div>
              </div>
              {locNote && <Notice tone="info" className="mt-3">{locNote}</Notice>}
              <Button variant="secondary" className="mt-4" onClick={() => { setPhase('compose'); setResult(null); }}>Done</Button>
            </div>
          ) : contacts.loading ? (
            <Skeleton className="mt-5 h-32" />
          ) : eligible.length === 0 ? (
            <Notice tone="info" className="mt-5" title="No contacts can receive alerts yet" action={<Link to="/circle" className="font-semibold text-teal-700 underline">Go to SafeCircle</Link>}>
              Contacts must accept your SafeCircle invitation and have SafeSOS alerts allowed.
            </Notice>
          ) : (
            <div className="mt-4 space-y-4">
              {error && <Notice tone="warning">{error}</Notice>}
              <fieldset disabled={phase !== 'compose'}>
                <legend className="mb-1 text-sm font-semibold text-navy">Who should be alerted?</legend>
                {eligible.map((c) => (
                  <Checkbox key={c.id} checked={selected.includes(c.id)} onChange={(v) => setSelected((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))} label={c.name} description={c.email ?? undefined} />
                ))}
              </fieldset>
              <Toggle checked={includeLocation} onChange={setIncludeLocation} disabled={phase !== 'compose'} label="Include my current location" description="Your location is read once, when the alert is sent, and included as a map link. It is not tracked afterwards." />
              <TextArea label="Message" optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} disabled={phase !== 'compose'} placeholder="For example: I feel unsafe, please call me." />

              {phase === 'countdown' ? (
                <div className="rounded-2xl border border-coral-100 bg-coral-50 p-4 text-center animate-scale-in" role="alert" aria-live="assertive">
                  <p className="text-sm font-semibold text-coral-700">Sending alert in</p>
                  <p className="text-4xl font-extrabold text-coral-700" aria-atomic="true">{count}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button variant="secondary" size="lg" onClick={cancelCountdown}>Cancel</Button>
                    <Button variant="danger" size="lg" icon={<IconSend size={18} />} onClick={() => { if (timer.current) clearInterval(timer.current); timer.current = null; send(); }}>Send now</Button>
                  </div>
                </div>
              ) : (
                <Button variant="danger" size="lg" block icon={<IconSend size={20} />} loading={phase === 'sending'} onClick={beginCountdown}>
                  {phase === 'sending' ? 'Sending alert...' : `Alert ${selected.length} contact${selected.length === 1 ? '' : 's'}`}
                </Button>
              )}
              {config.isDemo && <p className="text-[13px] font-medium text-slate-600">Demo Mode: no alert will actually be sent.</p>}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 font-bold text-navy"><IconInfo size={18} /> What SafeSOS does and doesn't do</h2>
        <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <li className="flex gap-2"><IconCheckCircle size={18} className="mt-0.5 shrink-0 text-teal-600" /> Opens your phone's dialer for {number} when you tap Call.</li>
          <li className="flex gap-2"><IconMail size={18} className="mt-0.5 shrink-0 text-teal-600" /> Emails the contacts you choose, only after you confirm.</li>
          <li className="flex gap-2"><IconInfo size={18} className="mt-0.5 shrink-0 text-slate-400" /> Does not contact police, ambulance or any emergency service for you.</li>
          <li className="flex gap-2"><IconInfo size={18} className="mt-0.5 shrink-0 text-slate-400" /> Cannot guarantee that alerts are delivered or read in time.</li>
        </ul>
        {journey?.shareEnabled && <p className="mt-3 text-sm text-slate-600">Your active journey is shared, so alerts include a link to it.</p>}
      </Card>
    </PageContainer>
  );
}
