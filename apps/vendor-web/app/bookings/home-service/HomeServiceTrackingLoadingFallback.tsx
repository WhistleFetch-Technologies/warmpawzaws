/** Shared loading UI for home-service tracking (Suspense fallback). */
export function HomeServiceTrackingLoadingFallback() {
  return (
    <div className="vendor-app-column flex min-h-screen flex-col items-center justify-center bg-[#FFF5F1]">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
      <p className="mt-4 text-sm font-medium text-gray-600">Loading…</p>
    </div>
  );
}
