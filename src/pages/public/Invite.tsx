import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { IconCheckCircle, IconUsers } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { Button, Card, EmptyState, Notice, Skeleton } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { backend, errorMessage } from '@/services';

/** Invitation landing page for a trusted contact. No account required. */
export default function Invite() {
  const { token = '' } = useParams();
  const invite = useAsync(() => backend.getInvite(token), [token]);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? 'accept' : 'decline');
    setError(null);
    try {
      const ok = await backend.respondToInvite(token, accept);
      if (!ok) setError('This invitation is no longer valid.');
      else setAnswer(accept);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const v = invite.data;
  return (
    <div className="min-h-screen bg-warm">
      <header className="border-b border-navy/[0.06] bg-white"><div className="mx-auto flex h-16 max-w-3xl items-center px-4"><Logo /></div></header>
      <main id="main" className="mx-auto max-w-xl px-4 py-10">
        {invite.loading ? (
          <Skeleton className="h-72 rounded-2xl" />
        ) : invite.error ? (
          <Notice tone="warning">{invite.error}</Notice>
        ) : !v || v.status === 'not_invited' ? (
          <Card className="p-2"><EmptyState icon={<IconUsers />} title="Invitation not found" description="This link may have expired or been replaced. Ask the person who invited you to send a new one." /></Card>
        ) : answer !== null ? (
          <Card className="p-8 text-center">
            <span className="mx-auto flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-teal-50 text-teal-600"><IconCheckCircle size={30} /></span>
            <h1 className="mt-4 text-xl font-bold text-navy">{answer ? `You're in ${v.inviterFirstName}'s SafeCircle` : 'Invitation declined'}</h1>
            <p className="mt-2 text-[15px] text-slate-600">{answer ? `${v.inviterFirstName} can now choose to share journeys with you, using a private link.` : `We've let ${v.inviterFirstName} know. You won't receive messages from SafeRoute on their behalf.`}</p>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-navy"><IconUsers size={24} /></span>
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-navy">{v.inviterFirstName} invited you to their SafeCircle</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
              Hi {v.contactName}. SafeRoute helps people share journeys with people they trust. If you accept:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-slate-700">
              <li>You may get a private link when {v.inviterFirstName} chooses to share a specific journey.</li>
              <li>You may get a message if they don't confirm arrival at a planned time, but only if they chose that for that journey.</li>
              <li>You will never receive their location automatically.</li>
            </ul>
            {v.status === 'accepted' && <Notice tone="success" className="mt-4">You already accepted this invitation.</Notice>}
            {v.status === 'declined' && <Notice tone="neutral" className="mt-4">You declined this invitation earlier. You can still accept it.</Notice>}
            {error && <Notice tone="warning" className="mt-4">{error}</Notice>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {v.status !== 'declined' && <Button variant="secondary" loading={busy === 'decline'} onClick={() => respond(false)}>Decline</Button>}
              {v.status !== 'accepted' && <Button variant="teal" loading={busy === 'accept'} onClick={() => respond(true)}>Accept invitation</Button>}
            </div>
            <p className="mt-6 text-[12px] text-slate-500">SafeRoute is not an emergency service. Joining someone's SafeCircle does not make you responsible for their safety.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
