/**
 * Audio Alert Utility
 * Uses Web Audio API to generate notification sounds
 */

let audioContext: AudioContext | null = null;

/**
 * Initialize AudioContext (must be called after user interaction)
 */
export function initAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a beep sound
 * @param frequency - Frequency in Hz (default 880 = A5)
 * @param duration - Duration in seconds (default 0.3)
 * @param volume - Volume from 0 to 1 (default 0.5)
 */
export function playBeep(frequency: number = 880, duration: number = 0.3, volume: number = 0.5): void {
  try {
    const ctx = initAudioContext();
    
    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (error) {
    console.warn('Failed to play beep:', error);
  }
}

/**
 * Play a success sound (two ascending beeps)
 */
export function playSuccessSound(): void {
  playBeep(523.25, 0.15, 0.4); // C5
  setTimeout(() => playBeep(659.25, 0.15, 0.4), 150); // E5
  setTimeout(() => playBeep(783.99, 0.2, 0.4), 300); // G5
}

/**
 * Play an error sound (descending beeps)
 */
export function playErrorSound(): void {
  playBeep(392, 0.15, 0.4); // G4
  setTimeout(() => playBeep(349.23, 0.2, 0.4), 150); // F4
}

/**
 * Play order alert sound (attention-grabbing notification)
 * Multiple beeps to ensure it's noticed
 */
export function playOrderAlertSound(): void {
  const playSequence = () => {
    // First beep sequence
    playBeep(880, 0.2, 0.6); // A5
    setTimeout(() => playBeep(1046.5, 0.2, 0.6), 200); // C6
    setTimeout(() => playBeep(880, 0.2, 0.6), 400); // A5
    setTimeout(() => playBeep(1046.5, 0.2, 0.6), 600); // C6
  };

  // Play sequence twice with pause
  playSequence();
  setTimeout(playSequence, 1200);
}

/**
 * Play continuous alert (for urgent notifications)
 * Returns a stop function
 */
export function playUrgentAlert(): () => void {
  let intervalId: NodeJS.Timeout | null = null;
  let count = 0;
  const maxBeeps = 10;

  const beep = () => {
    if (count >= maxBeeps) {
      if (intervalId) clearInterval(intervalId);
      return;
    }
    playBeep(1174.66, 0.1, 0.7); // D6
    count++;
  };

  beep();
  intervalId = setInterval(beep, 300);

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}

/**
 * Request notification permission and show browser notification
 */
export async function showBrowserNotification(
  title: string,
  options?: NotificationOptions
): Promise<Notification | null> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return null;
  }

  try {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if (Notification.permission === 'granted') {
      // Note: vibrate is part of the Web Notifications API but not in TypeScript types
      const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
        icon: '/icons/warmpawz-icon.png',
        badge: '/icons/warmpawz-badge.png',
        ...options,
      };
      
      const notification = new Notification(title, notificationOptions as NotificationOptions);

      // Auto-close after 10 seconds
      setTimeout(() => notification.close(), 10000);

      return notification;
    }
  } catch (error) {
    console.warn('Failed to show notification:', error);
  }

  return null;
}

/**
 * Combined alert: Sound + Browser Notification
 */
export async function alertNewOrder(orderNumber: string, orderType: string): Promise<void> {
  // Play sound
  playOrderAlertSound();

  // Show browser notification
  await showBrowserNotification(
    `🔔 New ${orderType} Order!`,
    {
      body: `Order #${orderNumber} received. Tap to view.`,
      tag: `order-${orderNumber}`,
      requireInteraction: true,
    }
  );
}

/**
 * Vibrate device (mobile only)
 */
export function vibrateDevice(pattern: number | number[] = 200): boolean {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      return false;
    }
  }
  return false;
}
