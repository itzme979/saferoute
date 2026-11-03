import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonLink, Notice, TextField } from '@/components/ui';
import { IconMail } from '@/components/icons';
import { validateEmail } from '@/lib/validation';
import { backend, errorMessage } from '@/services';
import { AuthShell } from './AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const err = validateEmail(email);
    setError(err);
    if (err) return;
    setBusy(true);
    setFormError(null);
    try {
      const r = await backend.requestPasswordReset(email);
      setDemoLink(r.demoResetLink ?? null);
      setSent(true);
    } catch (e2) {
      setFormError(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" footer={<Link to="/signin" className="font-semibold text-teal-700 hover:underline">Back to sign in</Link>}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><IconMail size={26} /></div>
        <p className="mt-5 text-[15px] leading-relaxed text-slate-700">
          If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. The link expires after a short time. Check your spam folder if you don't see it.
        </p>
        {backend.mode === 'demo' && (
          <Notice tone="info" className="mt-5" title="Demo Mode">
            Emails can't be sent in Demo Mode. {demoLink ? 'Use this one-time link to continue:' : 'No demo account uses this email.'}
            {demoLink && <div className="mt-3"><ButtonLink to={demoLink} size="sm">Open reset link</ButtonLink></div>}
          </Notice>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter the email you signed up with and we'll send you a reset link." footer={<Link to="/signin" className="font-semibold text-teal-700 hover:underline">Back to sign in</Link>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {formError && <Notice tone="warning">{formError}</Notice>}
        <TextField label="Email address" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
        <Button type="submit" block size="lg" loading={busy}>Send reset link</Button>
      </form>
    </AuthShell>
  );
}
