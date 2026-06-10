/** Registered by CustomerHomeWrapper so footer / deep links can open in-app meal tracking. */
type OpenMealTrack = (orderId: string, backScreen?: string) => void;

let openMealTrackHandler: OpenMealTrack | null = null;

export function registerMealShellTrack(handler: OpenMealTrack): void {
  openMealTrackHandler = handler;
}

export function unregisterMealShellTrack(): void {
  openMealTrackHandler = null;
}

/** Returns true when the home shell handled navigation. */
export function invokeMealShellTrack(orderId: string, backScreen?: string): boolean {
  const id = orderId.trim();
  if (!id || !openMealTrackHandler) return false;
  openMealTrackHandler(id, backScreen);
  return true;
}
