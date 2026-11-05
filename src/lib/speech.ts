export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Gap after cancelling. Chrome and Safari can silently drop a line spoken straight after a cancel. */
const AFTER_CANCEL_MS = 80;
let pending: ReturnType<typeof setTimeout> | undefined;

/** Phones may have no Canadian voice, and asking for a missing one can mean silence, so use the closest English voice installed. */
function englishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const lang = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  return voices.find((v) => lang(v) === 'en-ca') ?? voices.find((v) => lang(v).startsWith('en')) ?? null;
}

function say(text: string) {
  try {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const voice = englishVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang.replace('_', '-') ?? 'en-CA';
    synth.resume();
    synth.speak(u);
  } catch {
    /* the on-screen directions still work without a voice */
  }
}

/**
 * Reads a direction aloud, replacing anything still being read so the newest
 * one is never late. The first call must come from a tap: iPhones stay silent
 * until then, which is why it speaks straight away when nothing is playing.
 */
export function speak(text: string): void {
  if (!canSpeak()) return;
  clearTimeout(pending);
  try {
    const synth = window.speechSynthesis;
    if (!synth.speaking && !synth.pending) {
      say(text);
      return;
    }
    synth.cancel();
    pending = setTimeout(() => say(text), AFTER_CANCEL_MS);
  } catch {
    /* the on-screen directions still work without a voice */
  }
}

export function stopSpeaking(): void {
  if (!canSpeak()) return;
  clearTimeout(pending);
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing to stop */
  }
}
