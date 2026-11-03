import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IconMail } from '@/components/icons';
import { Button, Notice } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { backend, errorMessage } from '@/services';
import { AuthShell } from './AuthShell';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const resend = async () => {
    if (!email || busy || cooldown) return;
    setBusy(true);
    try {
      await backend.resendVerification(email);
      toast.success('Verification email sent', 'It may take a few minutes to arrive.');
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch (e) {
      toast.error('Could not resend', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Verify your email" footer={<Link to="/signin" className="font-semibold text-teal-700 hover:underline">Go to sign in</Link>}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><IconMail size={26} /></div>
      <p className="mt-5 text-[15px] leading-relaxed text-slate-700">
        We sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}. Open it on this device to finish setting up your account. Then you'll choose your walking preferences.
      </p>
      <Notice tone="neutral" className="mt-5">Can't find it? Check your spam or promotions folder. Links expire after 24 hours.</Notice>
      {email && (
        <Button variant="secondary" className="mt-5" onClick={resend} loading={busy} disabled={cooldown}>
          {cooldown ? 'Email sent. You can resend in a minute.' : 'Resend verification email'}
        </Button>
      )}
    </AuthShell>
  );
}
