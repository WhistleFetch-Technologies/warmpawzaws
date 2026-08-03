'use client';

/**
 * /dashboard – Redirect to home so vendors always get the full UI (VendorDashboard from VendorLandingPage).
 * The simplified "Welcome back!" dashboard (VendorDashboardScreen) is not used; full UI has all options,
 * appointment models, navigation, and capabilities.
 */
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isTokenExpired, clearVendorSession, restoreVendorSessionIfRefreshable } from '@/lib/session-utils';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const storedPhone = localStorage.getItem('vendorPhone');
      let storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');

      if (!storedToken || !storedPhone) {
        clearVendorSession();
        window.location.replace('/auth');
        return;
      }

      const sessionRestored = await restoreVendorSessionIfRefreshable();
      storedToken =
        localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken') || storedToken;

      if (!sessionRestored || isTokenExpired(storedToken)) {
        clearVendorSession();
        window.location.replace('/auth');
        return;
      }

      router.replace('/');
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
