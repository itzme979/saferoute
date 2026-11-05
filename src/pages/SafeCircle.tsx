import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IconCopy, IconEdit, IconLink, IconLock, IconMail, IconPhone, IconPlus, IconSend, IconShare, IconTrash, IconUsers } from '@/components/icons';
import { ImThereButton, TextButton } from '@/components/TextButton';
import { Avatar, Badge, Button, Card, EmptyState, Modal, Notice, SampleBadge, SectionHeader, Skeleton, TextField, Toggle } from '@/components/ui';
import { useToast } from '@/context/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { config } from '@/lib/config';
import { timeAgo } from '@/lib/format';
import { validateContact } from '@/lib/validation';
import { PageContainer } from '@/layouts/AppLayout';
import { backend, errorMessage } from '@/services';
import type { InviteStatus, TrustedContact } from '@/types';

const STATUS: Record<InviteStatus, { label: string; tone: 'teal' | 'amber' | 'grey' | 'coral' }> = {
  not_invited: { label: 'Not invited', tone: 'grey' },
  pending: { label: 'Invitation pending', tone: 'amber' },
  accepted: { label: 'Accepted', tone: 'teal' },
  declined: { label: 'Declined', tone: 'coral' },
};

type FormState = { name: string; email: string; phone: string; relationship: string };
const EMPTY: FormState = { name: '', email: '', phone: '', relationship: '' };

export default function SafeCircle() {
  const toast = useToast();
  const contacts = useAsync(() => backend.listContacts(), []);
  const [editing, setEditing] = useState<TrustedContact | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<TrustedContact | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [demoLink, setDemoLink] = useState<{ name: string; link: string } | null>(null);
  const [shareLink, setShareLink] = useState<{ contact: TrustedContact; link: string } | null>(null);

  const openNew = () => {
    setForm(EMPTY);
    setErrors({});
    setEditing('new');
  };
  const openEdit = (c: TrustedContact) => {
    setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', relationship: c.relationship ?? '' });
    setErrors({});
    setEditing(c);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs = validateContact(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      if (editing === 'new') {
        const c = await backend.addContact(form);
        contacts.setData((list) => [...(list ?? []), c]);
        toast.success(`${c.name} added`, c.phone ? 'You can text them from here any time.' : 'Add a phone number to text them.');
      } else if (editing) {
        const c = await backend.updateContact(editing.id, form);
        contacts.setData((list) => list?.map((x) => (x.id === c.id ? c : x)));
        toast.success('Contact updated', config.emailInvites && c.inviteStatus === 'not_invited' && editing.inviteStatus !== 'not_invited' ? 'Their contact details changed, so they need a new invitation.' : undefined);
      }
      setEditing(null);
    } catch (err) {
      toast.error('Could not save contact', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const invite = async (c: TrustedContact) => {
    if (busyId) return;
    setBusyId(c.id);
    try {
      const r = await backend.sendInvite(c.id);
      await contacts.reload();
      if (r.demoInviteLink) setDemoLink({ name: c.name, link: r.demoInviteLink });
      else if (r.simulated) toast.info('Invitation not sent', r.message);
      else if (r.sent) toast.success('Invitation sent', `We emailed ${c.name}. Delivery can take a few minutes.`);
      else toast.error('Invitation could not be delivered', 'Check the email address and try again.');
    } catch (e) {
      toast.error('Could not send invitation', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openShareLink = async (c: TrustedContact) => {
    if (busyId) return;
    setBusyId(c.id);
    try {
      const link = await backend.createInviteLink(c.id);
      await contacts.reload();
      setShareLink({ contact: c, link });
    } catch (e) {
      toast.error('Could not create invitation link', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const inviteMessage = `I'd like to add you to my SafeCircle on SafeRoute, so I can share journeys with you. You don't need an account: ${shareLink?.link ?? ''}`;

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink.link);
      toast.success('Link copied', `Paste it into a message to ${shareLink.contact.name}.`);
    } catch {
      toast.info('Could not copy automatically', 'Select the link and copy it yourself.');
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'Join my SafeCircle', text: inviteMessage });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast.info('Could not open sharing', 'Use Copy link instead.');
    }
  };

  const setPermission = async (c: TrustedContact, key: 'canReceiveJourneys' | 'canReceiveCheckinAlerts' | 'canReceiveSos', v: boolean) => {
    contacts.setData((list) => list?.map((x) => (x.id === c.id ? { ...x, [key]: v } : x)));
    try {
      await backend.updateContact(c.id, { [key]: v });
    } catch (e) {
      contacts.setData((list) => list?.map((x) => (x.id === c.id ? { ...x, [key]: !v } : x)));
      toast.error('Could not update permission', errorMessage(e));
    }
  };

  const remove = async () => {
    if (!removing || busyId) return;
    setBusyId(removing.id);
    try {
      await backend.removeContact(removing.id);
      contacts.setData((list) => list?.filter((x) => x.id !== removing.id));
      toast.success(`${removing.name} removed from your SafeCircle`);
      setRemoving(null);
    } catch (e) {
      toast.error('Could not remove contact', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const list = contacts.data ?? [];

  return (
    <PageContainer>
      <SectionHeader
        as="h1"
        title="SafeCircle"
        description="The people you trust. They only see a journey when you choose to share it."
        action={<Button variant="teal" icon={<IconPlus size={18} />} onClick={openNew} disabled={list.length >= 20}>Add Contact</Button>}
      />

      <Notice tone="info" className="mb-5" title="Your location is never shared automatically">
        Adding someone does not give them access to anything. Text buttons open your own messaging app, and nothing goes out until you tap Send. You can change who appears for journeys, check-ins and SafeSOS below.
      </Notice>

      {contacts.loading ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : contacts.error ? (
        <Notice tone="warning" action={<Button size="sm" variant="secondary" onClick={contacts.reload}>Try again</Button>}>{contacts.error}</Notice>
      ) : list.length === 0 ? (
        <Card className="p-2">
          <EmptyState icon={<IconUsers />} title="Your SafeCircle is empty" description="Add a family member, friend or roommate you would like to keep updated on your journeys." action={<Button variant="teal" icon={<IconPlus size={18} />} onClick={openNew}>Add your first contact</Button>} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {list.map((c) => (
            <Card as="li" key={c.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <Avatar name={c.name} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h2 className="truncate font-bold text-navy">{c.name}</h2>
                    {c.isSample && <SampleBadge />}
                  </div>
                  {c.relationship && <p className="text-sm text-slate-500">{c.relationship}</p>}
                  <div className="mt-1.5 space-y-0.5 text-[13px] text-slate-600">
                    {c.email && <p className="flex items-center gap-1.5 truncate"><IconMail size={14} className="shrink-0 text-slate-400" />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-1.5"><IconPhone size={14} className="shrink-0 text-slate-400" />{c.phone}</p>}
                  </div>
                </div>
                {config.emailInvites && <Badge tone={STATUS[c.inviteStatus].tone}>{STATUS[c.inviteStatus].label}</Badge>}
              </div>

              <div className="mt-4 divide-y divide-mist border-t border-mist">
                <Toggle checked={c.canReceiveJourneys} onChange={(v) => setPermission(c, 'canReceiveJourneys', v)} label="Shared journeys" description="Can be selected when you share a journey." />
                <Toggle checked={c.canReceiveCheckinAlerts} onChange={(v) => setPermission(c, 'canReceiveCheckinAlerts', v)} label="Missed check-in messages" description="Can be told if you don't confirm arrival." />
                <Toggle checked={c.canReceiveSos} onChange={(v) => setPermission(c, 'canReceiveSos', v)} label="SafeSOS alerts" description="Can receive an alert you send from SafeSOS." />
              </div>

              {config.emailInvites && c.inviteStatus !== 'accepted' && (
                <p className="mt-2 text-[12px] text-slate-500">
                  {c.inviteStatus === 'pending' && c.invitedAt ? `Invited ${timeAgo(c.invitedAt)}. ` : ''}
                  Contacts receive messages only after accepting.
                </p>
              )}

              {!c.phone && <p className="mt-2 text-[12px] text-slate-500">Add a phone number to text {c.name}.</p>}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                {c.phone && <ImThereButton phone={c.phone} name={c.name} />}
                {c.phone && <TextButton phone={c.phone} name={c.name} />}
                {config.emailInvites && c.inviteStatus !== 'accepted' && (
                  <Button size="sm" variant="subtle" icon={<IconLink size={16} />} loading={busyId === c.id} onClick={() => openShareLink(c)}>
                    {c.inviteStatus === 'not_invited' ? 'Share invitation' : 'Share invitation again'}
                  </Button>
                )}
                {config.emailInvites && c.inviteStatus !== 'accepted' && c.email && (
                  <Button size="sm" variant="ghost" icon={<IconSend size={16} />} disabled={!!busyId} onClick={() => invite(c)}>Email invitation</Button>
                )}
                <Button size="sm" variant="ghost" icon={<IconEdit size={16} />} onClick={() => openEdit(c)}>Edit</Button>
                <Button size="sm" variant="ghost" icon={<IconTrash size={16} />} onClick={() => setRemoving(c)} className="text-coral-700 hover:bg-coral-50">Remove</Button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <p className="mt-6 flex items-center gap-2 text-[13px] text-slate-500"><IconLock size={14} /> Contact details are private to you and are never shown to other SafeRoute users. <Link to="/privacy" className="font-semibold text-teal-700 hover:underline">Privacy Policy</Link></p>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add a trusted contact' : 'Edit contact'}
        description="Only add people you know and who would expect to hear from you."
      >
        <form id="contact-form" onSubmit={save} noValidate className="space-y-4">
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} autoComplete="off" required />
          <TextField label="Phone number" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} hint="Used for the Text and Call buttons." />
          <TextField label="Email address" type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} optional />
          <TextField label="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} optional placeholder="For example: Parent, Roommate, Friend" maxLength={40} />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="teal" loading={saving}>{editing === 'new' ? 'Add contact' : 'Save changes'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? ''}?`} description="They will no longer be able to receive journeys, check-in messages or alerts from you. Any links already sent stop working when the journey ends."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Keep contact</Button>
            <Button variant="danger" loading={!!busyId} onClick={remove}>Remove</Button>
          </>
        }
      />

      <Modal open={!!shareLink} onClose={() => setShareLink(null)} title={`Invite ${shareLink?.contact.name ?? ''}`} description="Send this private link in a text, WhatsApp or any other app. They can respond without an account."
        footer={<Button onClick={() => setShareLink(null)}>Done</Button>}
      >
        <input readOnly aria-label="Invitation link" value={shareLink?.link ?? ''} onFocus={(e) => e.target.select()} className="w-full rounded-xl border border-navy-100 bg-mist/70 px-3 py-2.5 text-sm text-slate-700" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="teal" icon={<IconCopy size={16} />} onClick={copyLink}>Copy link</Button>
          {typeof navigator.share === 'function' && <Button variant="secondary" icon={<IconShare size={16} />} onClick={nativeShare}>Share</Button>}
          {shareLink?.contact.phone && (
            <a href={`sms:${shareLink.contact.phone}?&body=${encodeURIComponent(inviteMessage)}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-100 px-4 font-semibold text-navy hover:bg-sky-200"><IconPhone size={16} />Text {shareLink.contact.name}</a>
          )}
        </div>
        <p className="mt-3 text-[13px] text-slate-500">Anyone with this link can respond as {shareLink?.contact.name ?? 'your contact'}, so only send it to them.</p>
      </Modal>

      <Modal open={!!demoLink} onClose={() => setDemoLink(null)} title="Demo Mode: invitation not emailed" description={`In a live setup, ${demoLink?.name ?? 'your contact'} would get an email with this link.`}
        footer={<Button onClick={() => setDemoLink(null)}>Done</Button>}
      >
        <p className="text-sm text-slate-600">To try the contact's side, open the invitation page and accept or decline it. Their status here will update.</p>
        {demoLink && <a href={demoLink.link} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-sky-100 px-4 font-semibold text-navy hover:bg-sky-200">Open invitation page</a>}
      </Modal>
    </PageContainer>
  );
}
