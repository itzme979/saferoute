import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { config } from '@/lib/config';
import { formatDuration, formatTime } from '@/lib/format';
import { reachable } from '@/lib/sms';
import type { Profile, TrustedContact, WalkingRoute } from '@/types';
import { IconPlay } from '../icons';
import { Button, Checkbox, Modal, Notice, Select, Toggle } from '../ui';

export interface StartOptions {
  expectedArrival: string;
  share: { enabled: boolean; liveLocation: boolean; contactIds: string[] };
  checkin: { enabled: boolean; notifyContacts: boolean; contactIds: string[]; graceMinutes: number };
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() < Date.now() - 60000) d.setDate(d.getDate() + 1); // next day if time has passed
  return d;
}

export function StartJourneyDialog({ open, onClose, route, destinationLabel, contacts, contactsLoading, profile, onConfirm, busy }: {
  open: boolean;
  onClose: () => void;
  route: WalkingRoute;
  destinationLabel: string;
  contacts: TrustedContact[];
  contactsLoading: boolean;
  profile: Profile;
  onConfirm: (o: StartOptions) => void;
  busy: boolean;
}) {
  const shareable = useMemo(() => contacts.filter((c) => reachable(c) && c.canReceiveJourneys), [contacts]);
  const alertable = useMemo(() => contacts.filter((c) => reachable(c) && c.canReceiveCheckinAlerts), [contacts]);
  const suggestedEta = useMemo(() => new Date((route.arrivesAt ? Date.parse(route.arrivesAt) : Date.now() + route.durationS * 1000) + 5 * 60000), [route.arrivesAt, route.durationS]);

  const [shareOn, setShareOn] = useState(false);
  const [live, setLive] = useState(profile.privacy.defaultShareLiveLocation);
  const [shareIds, setShareIds] = useState<string[]>([]);
  const [checkinOn, setCheckinOn] = useState(true);
  const [eta, setEta] = useState(toLocalInput(suggestedEta));
  const [notifyOn, setNotifyOn] = useState(profile.notificationPreferences.notifyContactsOnMissedCheckin);
  const [alertIds, setAlertIds] = useState<string[]>([]);
  const [grace, setGrace] = useState(profile.notificationPreferences.missedCheckinGraceMinutes);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEta(toLocalInput(suggestedEta));
      setError(null);
    }
  }, [open, suggestedEta]);

  // Texts only go out if the person taps Send, so starting with everyone offered is safe.
  useEffect(() => {
    if (!config.emailInvites) setAlertIds(alertable.map((c) => c.id));
  }, [alertable]);

  const toggle = (list: string[], id: string, set: (v: string[]) => void) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = () => {
    const etaDate = fromLocalInput(eta);
    const mins = (etaDate.getTime() - Date.now()) / 60000;
    if (mins < 2) return setError('Choose an arrival time at least a few minutes from now.');
    if (mins > 12 * 60) return setError('Arrival time must be within the next 12 hours.');
    if (shareOn && shareIds.length === 0) return setError('Choose at least one contact to share this journey with, or turn sharing off.');
    if (checkinOn && notifyOn && alertable.length > 0 && alertIds.length === 0) return setError('Choose who to notify if you miss your check-in, or turn that option off.');
    setError(null);
    onConfirm({
      expectedArrival: etaDate.toISOString(),
      share: { enabled: shareOn, liveLocation: shareOn && live, contactIds: shareOn ? shareIds : [] },
      checkin: { enabled: checkinOn, notifyContacts: checkinOn && notifyOn, contactIds: checkinOn && notifyOn ? alertIds : [], graceMinutes: grace },
    });
  };

  const noContacts = !contactsLoading && shareable.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Start your journey"
      description={<>{route.name} to {destinationLabel} · about {formatDuration(route.durationS)}</>}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Back to routes</Button>
          <Button variant="teal" onClick={submit} loading={busy} icon={<IconPlay size={18} />}>Start journey</Button>
        </>
      }
    >
      <div className="space-y-6">
        {error && <Notice tone="warning">{error}</Notice>}

        <section aria-labelledby="share-h">
          <h3 id="share-h" className="text-[15px] font-bold text-navy">SafeCircle sharing</h3>
          <Toggle checked={shareOn} onChange={setShareOn} disabled={noContacts} label="Share this journey" description={config.emailInvites ? 'Selected contacts get a private link showing your route and expected arrival. It stops working when the journey ends.' : 'Creates a private link showing your route and expected arrival. You can text it to the people you choose from the journey screen.'} />
          {noContacts && (
            <p className="-mt-1 text-[13px] text-slate-500">
              No contacts can receive journeys yet. <Link to="/circle" className="font-semibold text-teal-700 hover:underline">Add someone's phone number to your SafeCircle</Link>.
            </p>
          )}
          {shareOn && (
            <div className="mt-1 space-y-1 rounded-xl bg-mist/60 p-3 animate-fade-in">
              {shareable.map((c) => (
                <Checkbox key={c.id} checked={shareIds.includes(c.id)} onChange={() => toggle(shareIds, c.id, setShareIds)} label={c.name} description={c.relationship ?? undefined} />
              ))}
              <div className="border-t border-white pt-2">
                <Toggle checked={live} onChange={setLive} label="Include my live location" description="Your approximate position is updated about every 30 seconds while SafeRoute is open. Turn it off any time. Location is only sent while this page is open in your browser." />
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="checkin-h" className="border-t border-mist pt-5">
          <h3 id="checkin-h" className="text-[15px] font-bold text-navy">SafeArrival check-in</h3>
          <Toggle checked={checkinOn} onChange={setCheckinOn} label="Remind me to confirm I've arrived" description={`You'll get a reminder ${profile.notificationPreferences.checkinReminderMinutes} minutes before your expected arrival.`} />
          {checkinOn && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="eta" className="block text-sm font-semibold text-navy">Expected arrival</label>
                  <input id="eta" type="time" value={eta} onChange={(e) => setEta(e.target.value)} className="min-h-[46px] w-full rounded-xl border border-navy-100 bg-white px-3.5 text-[15px] focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/60" />
                  <p className="text-[13px] text-slate-500">Suggested: {formatTime(suggestedEta)} ({route.arrivesAt ? 'scheduled arrival' : 'travel time'} plus 5 minutes)</p>
                </div>
                <Select label="Grace period" value={grace} onChange={(e) => setGrace(+e.target.value)} hint="Extra time before a check-in counts as missed.">
                  {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </Select>
              </div>
              <Toggle
                checked={notifyOn}
                onChange={setNotifyOn}
                disabled={alertable.length === 0}
                label={config.emailInvites ? 'If I miss my check-in, notify contacts' : 'If I miss my check-in, offer to text contacts'}
                description={alertable.length === 0 ? 'No contacts with a phone number have check-in alerts turned on.' : config.emailInvites ? 'They get a calm message saying you haven’t confirmed arrival yet. It does not say you are in danger.' : 'SafeRoute shows Text buttons for these people. Nothing goes out unless you tap Send, so this can’t alert anyone if you can’t respond.'}
              />
              {notifyOn && alertable.length > 0 && (
                <div className="space-y-1 rounded-xl bg-mist/60 p-3">
                  {alertable.map((c) => (
                    <Checkbox key={c.id} checked={alertIds.includes(c.id)} onChange={() => toggle(alertIds, c.id, setAlertIds)} label={c.name} description={c.relationship ?? undefined} />
                  ))}
                </div>
              )}
              <Notice tone="neutral" title="What happens if you miss a check-in">
                At your expected arrival time, SafeRoute asks whether you've arrived. You can confirm, or extend the time. If you don't respond within the grace period{notifyOn && alertIds.length ? (config.emailInvites ? ', SafeRoute will try to email the contacts you selected' : ', you can text the contacts you selected. SafeRoute does not message them for you') : ', nothing else happens. No one is contacted'}. SafeRoute never contacts emergency services, and notifications may be delayed or not delivered.
                {config.isDemo && <span className="mt-1 block font-medium">Demo Mode: no messages are sent.</span>}
              </Notice>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
