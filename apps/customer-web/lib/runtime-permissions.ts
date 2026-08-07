export type RuntimePermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export function isLikelyAndroidWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isWvToken = /\bwv\b/i.test(ua) || /; wv\)/i.test(ua);
  const hasReactNativeBridge = !!(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
  return isAndroid && (isWvToken || hasReactNativeBridge);
}

export function requiresUserGestureForMediaPrompt(): boolean {
  return isLikelyAndroidWebView();
}

export async function requestCameraMicrophonePermission(): Promise<RuntimePermissionState> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

export async function requestLocationPermission(): Promise<RuntimePermissionState> {
  const { resolveCurrentGeolocationCoords, GeolocationAddressError } = await import(
    '@/lib/address-from-geolocation'
  );

  try {
    await resolveCurrentGeolocationCoords();
    return 'granted';
  } catch (error) {
    if (
      error instanceof GeolocationAddressError &&
      (error.code === 'permission_denied' || error.code === 'plugin_unavailable')
    ) {
      return 'denied';
    }
    if (
      error instanceof GeolocationAddressError &&
      error.code === 'unsupported'
    ) {
      return 'unsupported';
    }
    return 'prompt';
  }
}
