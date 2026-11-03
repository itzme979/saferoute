import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IconBeaker, IconBell, IconCamera, IconChevronRight, IconCrosshair, IconLayers, IconLock, IconLogout, IconMoon, IconRoute, IconShield, IconTrash, IconUser, IconUsers,
} from '@/components/icons';
import { config, exitDemo } from '@/lib/config';
import { cx } from '@/lib/format';
import { setThemePreference, useThemePreference, type ThemePreference } from '@/lib/theme';
import { IosInstallHelp } from '@/components/InstallPrompt';
import { PreferenceChips } from '@/components/PreferenceChips';
import { useInstall } from '@/lib/pwa';
import { Avatar, Badge, Button, Card, Modal, Notice, Select, TextField, Toggle } from '@/components/ui';
import { useAuth, useProfile } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { browserNotificationPermission, requestBrowserNotifications, showBrowserNotification } from '@/lib/browserNotifications';
import { getCurrentPosition, locationPermissionState } from '@/lib/location';
import { sanitizeImage, validateImage } from '@/lib/image';
import { validateName, validatePassword, validatePhone } from '@/lib/validation';
import { PageContainer } from '@/layouts/AppLayout';
import { backend, errorMessage } from '@/services';
import { PasswordField } from './auth/AuthShell';

function Section({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card as="section" id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-navy">{icon}</span>
        <div>
          <h2 id={`${id}-h`} className="text-lg font-bold text-navy">{title}</h2>
          {description && <p className="text-sm text-slate-600">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

const NAV = [
  ['profile', 'Profile'], ['password', 'Password'], ['walking', 'Walking'], ['notifications', 'Notifications'],
  ['location', 'Location'], ['privacy', 'Privacy'], ['appearance', 'Appearance'], ['account', 'Account'],
] as const;

const THEME_OPTIONS: [ThemePreference, string][] = [['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']];

export default function Settings() {
  const profile = useProfile();
  const { updateProfile, refreshProfile, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const theme = useThemePreference();

  // Profile
  const [name, setName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [profileErr, setProfileErr] = useState<Record<string, string | null>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Password
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState<Record<string, string | null>>({});
  const [savingPw, setSavingPw] = useState(false);

  // Permissions
  const [notifPerm, setNotifPerm] = useState(browserNotificationPermission());
  const [locPerm, setLocPerm] = useState<PermissionState | 'unsupported'>('prompt');

  const install = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

  // Danger zone
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    locationPermissionState().then(setLocPerm);
  }, []);

  const save = async (patch: Parameters<typeof updateProfile>[0], msg = 'Settings saved') => {
    try {
      await updateProfile(patch);
      toast.success(msg);
    } catch (e) {
      toast.error('Could not save', errorMessage(e));
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (savingProfile) return;
    const errs = { name: validateName(name), phone: validatePhone(phone) };
    setProfileErr(errs);
    if (errs.name || errs.phone) return;
    setSavingProfile(true);
    await save({ fullName: name, phone: phone || null }, 'Profile updated');
    setSavingProfile(false);
  };

  const uploadAvatar = async (f?: File) => {
    if (!f) return;
    const err = validateImage(f, 8);
    if (err) return toast.error('Photo not accepted', err);
    setUploading(true);
    try {
      const img = await sanitizeImage(f, 400, 0.85);
      await backend.uploadAvatar(img);
      await refreshProfile();
      toast.success('Profile photo updated');
    } catch (e) {
      toast.error('Could not upload photo', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (savingPw) return;
    const errs = {
      current: pw.current ? null : 'Enter your current password.',
      next: validatePassword(pw.next),
      confirm: pw.next === pw.confirm ? null : 'Passwords do not match.',
    };
    setPwErr(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSavingPw(true);
    try {
      await backend.updatePassword(pw.next, pw.current);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      setPwErr({ current: errorMessage(err) });
    } finally {
      setSavingPw(false);
    }
  };

  const toggleBrowser = async (on: boolean) => {
    if (on) {
      const p = await requestBrowserNotifications();
      setNotifPerm(p);
      if (p !== 'granted') return toast.info('Browser notifications not enabled', p === 'denied' ? 'Notifications are blocked for this site in your browser settings.' : 'Permission was not granted.');
      await save({ notificationPreferences: { ...profile.notificationPreferences, browser: true } }, 'Browser notifications on');
      showBrowserNotification('SafeRoute notifications are on', 'You will see reminders here when SafeRoute is in the background.');
    } else {
      await save({ notificationPreferences: { ...profile.notificationPreferences, browser: false } }, 'Browser notifications off');
    }
  };

  const deleteAccount = async () => {
    if (deleteText !== 'DELETE' || deleting) return;
    setDeleting(true);
    try {
      await backend.deleteAccount();
      toast.success('Your account has been deleted');
      navigate('/', { replace: true });
    } catch (e) {
      toast.error('Could not delete account', errorMessage(e));
      setDeleting(false);
    }
  };

  const np = profile.notificationPreferences;

  return (
    <PageContainer>
      <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-[28px]">Profile and Settings</h1>
      <p className="mt-1 text-[15px] text-slate-600">Control your information, preferences and what you share.</p>

      <nav aria-label="Settings sections" className="sticky top-16 z-10 -mx-4 mt-4 overflow-x-auto bg-warm/95 px-4 py-2 backdrop-blur sm:mx-0 sm:px-0">
        <ul className="flex gap-1.5">
          {NAV.map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="block whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-600 ring-1 ring-navy/[0.06] hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">{label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 space-y-5">
        <Section id="profile" icon={<IconUser size={20} />} title="Profile">
          <div className="mb-5 flex items-center gap-4">
            <Avatar name={profile.fullName} url={profile.avatarUrl} size={72} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" icon={<IconCamera size={16} />} loading={uploading} onClick={() => fileRef.current?.click()}>{profile.avatarUrl ? 'Change photo' : 'Add photo'}</Button>
              {profile.avatarUrl && <Button size="sm" variant="ghost" onClick={() => save({ avatarUrl: null }, 'Photo removed')}>Remove</Button>}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { uploadAvatar(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>
          <form onSubmit={saveProfile} noValidate className="grid gap-4 sm:grid-cols-2">
            <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={profileErr.name} autoComplete="name" />
            <TextField label="Email address" value={profile.email} disabled hint="Contact support to change your email." />
            <TextField label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={profileErr.phone} optional autoComplete="tel" />
            <div className="flex items-end sm:col-span-2"><Button type="submit" loading={savingProfile}>Save profile</Button></div>
          </form>
        </Section>

        <Section id="password" icon={<IconLock size={20} />} title="Password">
          <form onSubmit={changePassword} noValidate className="grid gap-4 sm:max-w-md">
            <PasswordField label="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} error={pwErr.current} />
            <PasswordField label="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} error={pwErr.next} hint="At least 8 characters, with a letter and a number." />
            <PasswordField label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} error={pwErr.confirm} />
            <div><Button type="submit" loading={savingPw}>Change password</Button></div>
          </form>
        </Section>

        <Section id="walking" icon={<IconRoute size={20} />} title="Walking preferences" description="Default priorities used to compare routes. You can adjust them for each journey.">
          <PreferenceChips value={profile.walkingPreferences} onChange={(v) => save({ walkingPreferences: v }, 'Walking preferences saved')} layout="grid" showHints />
        </Section>

        <Section id="notifications" icon={<IconBell size={20} />} title="Notifications">
          <div className="divide-y divide-mist">
            <Toggle checked={np.browser && notifPerm === 'granted'} onChange={toggleBrowser} disabled={notifPerm === 'unsupported'}
              label="Browser notifications"
              description={notifPerm === 'denied' ? 'Blocked in your browser. Allow notifications for this site in your browser settings, then turn this on.' : notifPerm === 'unsupported' ? 'Not supported in this browser. In-app notifications still work.' : 'Reminders and updates appear even when SafeRoute is in another tab.'} />
            <Toggle checked={np.hazardUpdates} onChange={(v) => save({ notificationPreferences: { ...np, hazardUpdates: v } })} label="Updates on my hazard reports" description="When others mark your reports as resolved or outdated." />
            <Toggle checked={np.notifyContactsOnMissedCheckin} onChange={(v) => save({ notificationPreferences: { ...np, notifyContactsOnMissedCheckin: v } })} label="Offer to notify contacts on missed check-ins" description="Sets the default for new journeys. You still choose contacts each time." />
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              <Select label="Check-in reminder" value={np.checkinReminderMinutes} onChange={(e) => save({ notificationPreferences: { ...np, checkinReminderMinutes: +e.target.value } })}>
                {[2, 5, 10].map((m) => <option key={m} value={m}>{m} minutes before arrival</option>)}
              </Select>
              <Select label="Default grace period" value={np.missedCheckinGraceMinutes} onChange={(e) => save({ notificationPreferences: { ...np, missedCheckinGraceMinutes: +e.target.value } })}>
                {[5, 10, 15, 30].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </Select>
            </div>
          </div>
          <Notice tone="neutral" className="mt-4">In-app notifications are always on. Browser and email notifications depend on your device, browser and network and are not guaranteed.</Notice>
        </Section>

        <Section id="location" icon={<IconCrosshair size={20} />} title="Location permission" description="SafeRoute asks for location only when you use a feature that needs it.">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-700">Browser permission:</span>
            <Badge tone={locPerm === 'granted' ? 'teal' : locPerm === 'denied' ? 'coral' : 'grey'}>
              {locPerm === 'granted' ? 'Allowed' : locPerm === 'denied' ? 'Blocked' : locPerm === 'unsupported' ? 'Unknown' : 'Not yet asked'}
            </Badge>
            {locPerm !== 'granted' && locPerm !== 'denied' && (
              <Button size="sm" variant="secondary" onClick={async () => {
                try {
                  await getCurrentPosition();
                  toast.success('Location allowed');
                } catch (e) {
                  toast.info('Location not allowed', (e as Error).message);
                }
                setLocPerm(await locationPermissionState());
              }}>Test location access</Button>
            )}
          </div>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>Used to set your starting point, show progress on an active journey, and pin hazard reports.</li>
            <li>Live location is only sent while a journey is active <em>and</em> you turned on live sharing, and only while SafeRoute is open.</li>
            <li>Location accuracy depends on your device and may be off by tens of metres, especially indoors.</li>
            <li>To revoke access, open your browser's site settings for this website and set Location to Block.</li>
          </ul>
        </Section>

        <Card className="p-5 sm:p-6">
          <Link to="/circle" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-navy"><IconUsers size={20} /></span>
            <span className="flex-1"><span className="block text-lg font-bold text-navy">Trusted contacts</span><span className="text-sm text-slate-600">Manage your SafeCircle and what each person can receive.</span></span>
            <IconChevronRight className="text-slate-400" />
          </Link>
        </Card>

        <Section id="privacy" icon={<IconShield size={20} />} title="Privacy">
          <div className="divide-y divide-mist">
            <Toggle checked={profile.privacy.saveJourneyHistory} onChange={(v) => save({ privacy: { ...profile.privacy, saveJourneyHistory: v } }, v ? 'Journey history on' : 'Journey history off. Future journeys are deleted when they end.')} label="Save journey history" description="When off, each journey is deleted as soon as it ends. Existing history is kept until you clear it." />
            <Toggle checked={profile.privacy.defaultShareLiveLocation} onChange={(v) => save({ privacy: { ...profile.privacy, defaultShareLiveLocation: v } })} label="Suggest live location when sharing" description="Pre-selects live location in the sharing options. You still confirm for every journey." />
            <div className="py-4">
              <Select label="Emergency number" value={profile.emergencyNumber} onChange={(e) => save({ emergencyNumber: e.target.value }, 'Emergency number updated')} hint="Used by the Call button in SafeSOS.">
                <option value="911">911 (Canada, United States)</option>
                <option value="112">112 (European Union and many countries)</option>
                <option value="999">999 (United Kingdom)</option>
                <option value="000">000 (Australia)</option>
                <option value="111">111 (New Zealand)</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div><p className="font-semibold text-navy">Journey history</p><p className="text-sm text-slate-600">Delete all past journeys and check-ins.</p></div>
              <div className="flex gap-2">
                <Link to="/history" className="inline-flex min-h-[38px] items-center rounded-xl px-3 text-sm font-semibold text-navy hover:bg-mist">View</Link>
                <Button size="sm" variant="secondary" onClick={() => setClearOpen(true)}>Clear history</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section id="appearance" icon={<IconMoon size={20} />} title="Appearance">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={theme === value}
                onClick={() => setThemePreference(value)}
                className={cx(
                  'min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                  theme === value ? 'border-teal-500 bg-teal-50 text-navy' : 'border-mist text-slate-600 hover:bg-mist',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        {config.isSampleDemo && backend.clearSampleData && (
          <Section id="demo" icon={<IconBeaker size={20} />} title="Demo data" description="Sample contacts, journeys and community reports are labelled 'Sample' and are fictional.">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={async () => { await backend.clearSampleData!(); toast.success('Sample data removed'); }}>Remove all sample data</Button>
              <Button variant="ghost" onClick={exitDemo}>Exit demo</Button>
            </div>
          </Section>
        )}

        <Section id="app" icon={<IconLayers size={20} />} title="SafeRoute app" description="Install SafeRoute to open it from your home screen or desktop, like any other app.">
          {install.state === 'installed' ? (
            <p className="text-sm text-teal-700">SafeRoute is installed on this device.</p>
          ) : install.state === 'available' ? (
            <Button variant="teal" onClick={install.install}>Install SafeRoute</Button>
          ) : install.state === 'ios' ? (
            <Button variant="teal" onClick={() => setIosHelp(true)}>How to add to Home Screen</Button>
          ) : (
            <p className="text-sm text-slate-600">Use your browser's menu and choose “Install app” or “Add to Home screen”. Chrome, Edge, Samsung Internet and Safari support this.</p>
          )}
          <IosInstallHelp open={iosHelp} onClose={() => setIosHelp(false)} />
        </Section>

        <Section id="account" icon={<IconLogout size={20} />} title="Account">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-semibold text-navy">Sign out</p><p className="text-sm text-slate-600">Sign out of SafeRoute on this device.</p></div>
            <Button variant="secondary" icon={<IconLogout size={18} />} onClick={async () => { await signOut(); navigate('/', { replace: true }); }}>Sign out</Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coral-100 bg-coral-50/60 p-4">
            <div><p className="font-semibold text-coral-700">Delete account</p><p className="text-sm text-slate-600">Permanently delete your account and personal data.</p></div>
            <Button variant="danger" icon={<IconTrash size={18} />} onClick={() => { setDeleteText(''); setDeleteOpen(true); }}>Delete account</Button>
          </div>
        </Section>
      </div>

      <Modal open={clearOpen} onClose={() => setClearOpen(false)} title="Clear journey history?" description="All past journeys and their check-ins will be permanently deleted. An active journey is not affected."
        footer={<><Button variant="secondary" onClick={() => setClearOpen(false)}>Cancel</Button><Button variant="danger" loading={clearing} onClick={async () => {
          setClearing(true);
          try {
            await backend.clearJourneyHistory();
            toast.success('Journey history cleared');
            setClearOpen(false);
          } catch (e) {
            toast.error('Could not clear history', errorMessage(e));
          } finally {
            setClearing(false);
          }
        }}>Clear history</Button></>}
      />

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="Delete your account?"
        footer={<><Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button><Button variant="danger" disabled={deleteText !== 'DELETE'} loading={deleting} onClick={deleteAccount}>Delete permanently</Button></>}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>This permanently deletes your profile, trusted contacts, journeys, check-ins and notifications. Any shared journey links stop working. This cannot be undone.</p>
          <p>Hazard reports you submitted stay on the Community Map to help others, but are no longer linked to you.</p>
          <TextField label='Type "DELETE" to confirm' value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" />
        </div>
      </Modal>
    </PageContainer>
  );
}
