export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

export function validateEmail(v: string): string | null {
  if (!v.trim()) return 'Enter your email address.';
  if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address, like name@example.com.';
  return null;
}

export function validatePassword(v: string): string | null {
  if (v.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'Include at least one letter and one number.';
  return null;
}

export function validateName(v: string): string | null {
  if (!v.trim()) return 'Enter your name.';
  if (v.trim().length > 100) return 'Keep your name under 100 characters.';
  return null;
}

export function validatePhone(v: string): string | null {
  if (!v.trim()) return null;
  if (!PHONE_RE.test(v.trim())) return 'Enter a valid phone number.';
  return null;
}

export function validateContact(input: { name: string; email: string; phone: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = 'Enter a name.';
  else if (input.name.trim().length > 80) errors.name = 'Keep the name under 80 characters.';
  if (!input.email.trim() && !input.phone.trim()) errors.email = 'Add a phone number or email address.';
  if (input.email.trim() && !EMAIL_RE.test(input.email.trim())) errors.email = 'Enter a valid email address.';
  const phoneErr = validatePhone(input.phone);
  if (phoneErr) errors.phone = phoneErr;
  return errors;
}

/** Public reports must not contain personal contact details. */
export function containsPersonalInfo(text: string): boolean {
  return /[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(text) || /(\+?\d[\s().-]?){9,}/.test(text);
}

const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot', 'retard', 'whore', 'slut'];

export function containsBlockedLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED.some((w) => new RegExp(`\\b${w}`, 'i').test(lower));
}

export function validateHazardDescription(v: string): string | null {
  const t = v.trim();
  if (t.length < 5) return 'Add a short description (at least 5 characters).';
  if (t.length > 500) return 'Keep the description under 500 characters.';
  if (containsPersonalInfo(t)) return 'Please remove email addresses or phone numbers. Reports are public.';
  if (containsBlockedLanguage(t)) return 'Please keep descriptions respectful and factual.';
  return null;
}
