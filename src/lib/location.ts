import type { LatLng } from '@/types';

const WATCH_RETRY_MS = 5000;

export type LocationErrorKind = 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'insecure';

export class LocationError extends Error {
  constructor(public kind: LocationErrorKind) {
    super(LOCATION_MESSAGES[kind]);
  }
}

export const LOCATION_MESSAGES: Record<LocationErrorKind, string> = {
  denied: 'Location access is turned off for SafeRoute. You can type an address instead, or allow location in your browser settings.',
  unavailable: 'Your device could not determine your location right now. Try again, or type an address.',
  timeout: 'Finding your location took too long. Try again, or type an address.',
  unsupported: 'This browser does not support location. You can type an address instead.',
  insecure: 'Location only works on a secure (https) connection.',
};

function mapError(err: GeolocationPositionError): LocationError {
  if (err.code === err.PERMISSION_DENIED) return new LocationError('denied');
  if (err.code === err.TIMEOUT) return new LocationError('timeout');
  return new LocationError('unavailable');
}

export function getCurrentPosition(): Promise<LatLng & { accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new LocationError('insecure'));
    if (!('geolocation' in navigator)) return reject(new LocationError('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(mapError(err)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  });
}

/** Follows the device's position. Some phones stop a watch after an error or while the app is in the background, so it restarts after either. */
export function watchPosition(
  onPosition: (p: LatLng & { accuracy: number }) => void,
  onError: (e: LocationError) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onError(new LocationError('unsupported'));
    return () => {};
  }
  let id: number | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(retry);
    if (id !== undefined) navigator.geolocation.clearWatch(id);
  };
  const start = () => {
    stop();
    id = navigator.geolocation.watchPosition(
      (pos) => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const e = mapError(err);
        onError(e);
        if (e.kind !== 'denied') retry = setTimeout(start, WATCH_RETRY_MS);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 },
    );
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') start();
  };
  start();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    stop();
  };
}

export async function locationPermissionState(): Promise<PermissionState | 'unsupported'> {
  try {
    if (!navigator.permissions) return 'unsupported';
    const s = await navigator.permissions.query({ name: 'geolocation' });
    return s.state;
  } catch {
    return 'unsupported';
  }
}
