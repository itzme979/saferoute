import { describe, expect, it } from 'vitest';
import { arrivedMessage, journeyMessage, lateMessage, reachable, smsHref, sosMessage } from './sms';

describe('smsHref', () => {
  it('cleans the number and omits an empty body', () => {
    expect(smsHref('+1 (416) 555-0142')).toBe('sms:+14165550142');
  });

  it('encodes the message so links and line breaks survive', () => {
    const href = smsHref('4165550142', 'Help & call\n\nhttps://a.example/?q=1,2');
    expect(href.startsWith('sms:4165550142?&body=')).toBe(true);
    expect(decodeURIComponent(href.split('body=')[1])).toBe('Help & call\n\nhttps://a.example/?q=1,2');
    expect(href).not.toContain('\n');
    expect(href.split('body=')[1]).not.toContain('&');
  });
});

describe('messages', () => {
  it('builds an SOS text from only what is available', () => {
    expect(sosMessage({})).toBe('I need help. Please call or text me as soon as you can.');
    const full = sosMessage({ note: ' Near the station ', location: { lat: 43.65321, lng: -79.38321 }, shareUrl: 'https://x.example/s/1' });
    expect(full).toContain('Near the station');
    expect(full).toContain('https://maps.google.com/?q=43.65321,-79.38321');
    expect(full).toContain('https://x.example/s/1');
  });

  it('describes a journey and a late arrival calmly', () => {
    expect(journeyMessage({ destination: 'Home', arrival: '6:30 PM', shareUrl: 'https://x.example/s/1' })).toContain('around 6:30 PM');
    expect(lateMessage('Home')).toContain("haven't reached Home");
  });

  it("says I'm there with or without a destination", () => {
    expect(arrivedMessage()).toBe("I'm there!");
    expect(arrivedMessage('Home')).toBe("I'm there! I made it to Home.");
  });
});

describe('reachable', () => {
  it('needs no invitation when there is a phone number', () => {
    expect(reachable({ phone: '4165550142', inviteStatus: 'not_invited' })).toBe(true);
  });

  it('skips contacts with no number while email is off', () => {
    expect(reachable({ phone: null, inviteStatus: 'accepted' })).toBe(false);
  });
});
