import { describe, expect, it } from 'vitest';
import { containsPersonalInfo, validateContact, validateEmail, validateHazardDescription, validatePassword } from './validation';

describe('validation', () => {
  it('validates email', () => {
    expect(validateEmail('')).toBeTruthy();
    expect(validateEmail('nope')).toBeTruthy();
    expect(validateEmail('a@b.co')).toBeNull();
  });

  it('requires a reasonable password', () => {
    expect(validatePassword('short1')).toBeTruthy();
    expect(validatePassword('longenough')).toBeTruthy();
    expect(validatePassword('longenough1')).toBeNull();
  });

  it('requires a contact channel', () => {
    expect(validateContact({ name: 'A', email: '', phone: '' }).email).toBeTruthy();
    expect(validateContact({ name: 'A', email: '', phone: '+1 416 555 0100' })).toEqual({});
  });

  it('blocks personal details in public reports', () => {
    expect(containsPersonalInfo('call me at 416-555-0100')).toBe(true);
    expect(containsPersonalInfo('email jane@example.com')).toBe(true);
    expect(containsPersonalInfo('Light out near 123 King St')).toBe(false);
    expect(validateHazardDescription('Streetlight out by the bus stop')).toBeNull();
    expect(validateHazardDescription('abc')).toBeTruthy();
  });
});
