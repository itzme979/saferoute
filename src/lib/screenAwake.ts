import { KEEP_AWAKE_MP4, KEEP_AWAKE_WEBM } from '@/lib/keepAwakeMedia';

/** iPhones and iPads, including iPads that report themselves as Macs. */
const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Playing a silent clip keeps a screen on where wake lock is missing or broken. */
function playClip(): { stop: () => void; resume: () => void } {
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.loop = true;
  for (const [type, src] of [['video/webm', KEEP_AWAKE_WEBM], ['video/mp4', KEEP_AWAKE_MP4]]) {
    const source = document.createElement('source');
    source.type = type;
    source.src = src;
    video.appendChild(source);
  }
  const resume = () => void video.play().catch(() => {});
  resume();
  return {
    resume,
    stop: () => {
      video.pause();
      video.removeAttribute('src');
      video.replaceChildren();
      video.load();
    },
  };
}

/**
 * Keeps the screen on until the returned function is called. Must be called
 * from a tap, because phones only start the clip from one. Older iPhones can
 * report wake lock and then refuse it in the installed app, and by then the tap
 * is over, so on iOS the clip starts first and stops if the wake lock works.
 * `onChange` is told whether the device confirmed the screen will stay on.
 */
export function holdScreenAwake(onChange: (held: boolean) => void): () => void {
  const supported = 'wakeLock' in navigator;
  let lock: WakeLockSentinel | null = null;
  let done = false;
  let clip = !supported || isIos() ? playClip() : null;

  const ask = async () => {
    if (document.visibilityState !== 'visible' || done) return;
    clip?.resume();
    if (!supported) {
      onChange(false);
      return;
    }
    try {
      const l = await navigator.wakeLock.request('screen');
      if (done) {
        l.release().catch(() => {});
        return;
      }
      lock = l;
      // Phones also let go on their own, for example on low battery.
      l.addEventListener('release', () => {
        if (!done && document.visibilityState === 'visible') onChange(false);
      });
      clip?.stop();
      clip = null;
      onChange(true);
    } catch {
      onChange(false);
    }
  };

  ask();
  document.addEventListener('visibilitychange', ask);
  return () => {
    done = true;
    document.removeEventListener('visibilitychange', ask);
    lock?.release().catch(() => {});
    clip?.stop();
  };
}
