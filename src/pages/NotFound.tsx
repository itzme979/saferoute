import { IconMap } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-warm px-4 text-center">
      <Logo />
      <span className="mt-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-navy"><IconMap size={26} /></span>
      <h1 className="mt-5 text-2xl font-extrabold text-navy">This page took a wrong turn</h1>
      <p className="mt-2 max-w-sm text-slate-600">The page you're looking for doesn't exist or has moved.</p>
      <ButtonLink to="/" className="mt-6">Back to home</ButtonLink>
    </div>
  );
}
