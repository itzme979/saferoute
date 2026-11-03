import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Notice } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { validatePassword } from '@/lib/validation';
import { backend, errorMessage } from '@/services';
import { DemoBackend } from '@/services/demoBackend';
import { AuthShell, PasswordField } from './AuthShell';

export default function ResetPassword() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoChecked, setDemoChecked] = useState(backend.mode !== 'demo');

  // Demo Mode: exchange the one-time token for a recovery session.
  useEffect(() => {
    const token = params.get('demo_token');
    if (backend instanceof DemoBackend && token) {
      backend.beginDemoRecovery(token).finally(() => setDemoChecked(true));
    } else {
      setDemoChecked(true);
    }
  }, [params]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next = { password: validatePassword(password), confirm: password === confirm ? null : 'Passwords do not match.' };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    setFormError(null);
    try {
      await backend.updatePassword(password);
      toast.success('Password updated', 'You are now signed in with your new password.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !demoChecked) return <AuthShell title="Reset your password"><p className="text-slate-600">Checking your reset link...</p></AuthShell>;

  if (!user) {
    return (
      <AuthShell title="This link has expired" footer={<Link to="/signin" className="font-semibold text-teal-700 hover:underline">Back to sign in</Link>}>
        <p className="text-[15px] text-slate-700">Password reset links can only be used once and expire after a short time. Please request a new one.</p>
        <div className="mt-6"><Button onClick={() => navigate('/forgot-password')}>Request a new link</Button></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle={<>For <strong>{user.email}</strong></>}>
      <form onSubmit={submit} noValidate className="space-y-5">
        {formError && <Notice tone="warning">{formError}</Notice>}
        <PasswordField label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="At least 8 characters, with a letter and a number." />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <Button type="submit" block size="lg" loading={busy}>Update password</Button>
      </form>
    </AuthShell>
  );
}
