import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Notice, TextField } from '@/components/ui';
import { validateEmail } from '@/lib/validation';
import { backend, BackendError, errorMessage } from '@/services';
import { AuthShell, PasswordField } from './AuthShell';

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next = { email: validateEmail(email), password: password ? null : 'Enter your password.' };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    setFormError(null);
    setUnverified(false);
    try {
      await backend.signIn(email, password);
      // PublicOnly redirects once auth state updates.
    } catch (err) {
      if (err instanceof BackendError && err.code === 'unverified') setUnverified(true);
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to plan journeys and manage your SafeCircle."
      footer={<>New to SafeRoute? <Link to="/signup" className="font-semibold text-teal-700 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {formError && (
          <Notice tone="warning" action={unverified ? <button type="button" className="font-semibold underline" onClick={() => navigate(`/verify-email?email=${encodeURIComponent(email)}`)}>Resend verification email</button> : undefined}>
            {formError}
          </Notice>
        )}
        <TextField label="Email address" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-teal-700 hover:underline">Forgot your password?</Link>
        </div>
        <Button type="submit" block size="lg" loading={busy}>Sign In</Button>
      </form>
    </AuthShell>
  );
}
