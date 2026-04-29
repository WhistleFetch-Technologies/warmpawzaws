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
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return 'unsupported';
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve('denied');
          return;
        }
        resolve('prompt');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
