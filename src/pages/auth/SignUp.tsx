import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Checkbox, Notice, TextField } from '@/components/ui';
import { validateEmail, validateName, validatePassword } from '@/lib/validation';
import { backend, errorMessage } from '@/services';
import { AuthShell, PasswordField } from './AuthShell';

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const next = {
      fullName: validateName(form.fullName),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      agree: agree ? null : 'Please accept the Terms of Service and Privacy Policy to continue.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    setFormError(null);
    try {
      const { needsVerification } = await backend.signUp(form);
      if (needsVerification) navigate(`/verify-email?email=${encodeURIComponent(form.email)}`, { replace: true });
      // Otherwise the session is active and PublicOnly redirects to onboarding.
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes less than a minute. You'll choose your preferences next."
      footer={<>Already have an account? <Link to="/signin" className="font-semibold text-teal-700 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        {formError && <Notice tone="warning">{formError}</Notice>}
        <TextField label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} required />
        <TextField label="Email address" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} error={errors.email} required />
        <PasswordField label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters, with a letter and a number." required />
        <div>
          <Checkbox
            checked={agree}
            onChange={setAgree}
            label={<>I agree to the <Link to="/terms" target="_blank" className="font-semibold text-teal-700 underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-teal-700 underline">Privacy Policy</Link></>}
            description="SafeRoute is a planning and sharing tool, not an emergency service."
          />
          {errors.agree && <p className="mt-1 text-[13px] font-medium text-coral-700" role="alert">{errors.agree}</p>}
        </div>
        <Button type="submit" block size="lg" variant="teal" loading={busy}>Create account</Button>
      </form>
    </AuthShell>
  );
}
