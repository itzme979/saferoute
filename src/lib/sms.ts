import { config } from '@/lib/config';
import type { LatLng, TrustedContact } from '@/types';

/**
 * Opens the phone's messaging app. "?&body=" is the form both iOS and Android
 * accept. A web page can't send a text itself: the person always taps Send.
 */
export function smsHref(phone: string, body?: string): string {
  const to = phone.replace(/[^\d+]/g, '');
  return body ? `sms:${to}?&body=${encodeURIComponent(body)}` : `sms:${to}`;
}

/** Can SafeRoute put this person on a list? Texts need only a number; emails need a consent step first. */
export const reachable = (c: Pick<TrustedContact, 'phone' | 'inviteStatus'>): boolean =>
  !!c.phone || (config.emailInvites && c.inviteStatus === 'accepted');

const mapLink = (p: LatLng) => `https://maps.google.com/?q=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export function sosMessage({ note, location, shareUrl }: { note?: string; location?: LatLng | null; shareUrl?: string | null }): string {
  return [
    'I need help. Please call or text me as soon as you can.',
    note?.trim(),
    location && `My approximate location: ${mapLink(location)}`,
    shareUrl && `My journey: ${shareUrl}`,
  ].filter(Boolean).join('\n\n');
}

export function journeyMessage({ destination, arrival, shareUrl }: { destination: string; arrival: string; shareUrl: string }): string {
  return `I'm on my way to ${destination} and expect to arrive around ${arrival}. You can follow my journey here until it ends: ${shareUrl}`;
}

export const arrivedMessage = (destination?: string): string =>
  destination ? `I'm there! I made it to ${destination}.` : "I'm there!";

export const lateMessage = (destination: string): string =>
  `Just letting you know I haven't reached ${destination} yet and I'm running behind.`;
