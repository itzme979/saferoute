import { useAsync } from '@/hooks/useAsync';
import { arrivedMessage, lateMessage, smsHref } from '@/lib/sms';
import { backend } from '@/services';
import type { Checkin, Journey } from '@/types';
import { IconCheckCircle, IconPhone } from './icons';

/** Opens the messaging app with a number and message ready. The person still taps Send. */
export function TextButton({ phone, name, body, block }: { phone: string; name: string; body?: string; block?: boolean }) {
  return (
    <a
      href={smsHref(phone, body)}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-sky-100 px-4 text-sm font-semibold text-navy transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${block ? 'w-full' : ''}`}
    >
      <IconPhone size={16} />Text {name}
    </a>
  );
}

/** One tap to tell a contact you made it. Like any text, it opens the messaging app ready to send. */
export function ImThereButton({ phone, name, destination }: { phone: string; name: string; destination?: string }) {
  return (
    <a
      href={smsHref(phone, arrivedMessage(destination))}
      aria-label={`Tell ${name} I'm there`}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
    >
      <IconCheckCircle size={16} />I'm there
    </a>
  );
}

/** Text buttons for someone running late: the contacts chosen for this journey, or anyone allowed. */
export function LateTextButtons({ journey, checkin }: { journey: Journey; checkin: Checkin }) {
  const contacts = useAsync(() => backend.listContacts(), []);
  const all = (contacts.data ?? []).filter((c) => c.phone);
  const chosen = all.filter((c) => checkin.contactIds.includes(c.id));
  const list = chosen.length ? chosen : all.filter((c) => c.canReceiveCheckinAlerts);
  if (!list.length) return null;
  const body = lateMessage(journey.destination.label.split(',')[0]);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-navy">Let someone know</p>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => <TextButton key={c.id} phone={c.phone!} name={c.name} body={body} />)}
      </div>
    </div>
  );
}
