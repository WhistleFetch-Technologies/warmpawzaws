import { VendorSession, VendorStatus } from "./interface";

/** Compute initial state from session + localStorage so existing vendors never flash "choose role" or loading. */
export function getInitialVendorState(session: VendorSession): { status: VendorStatus; vendorData: any; isLoading: boolean } {
    if (typeof window === 'undefined') return { status: 'new', vendorData: null, isLoading: true };
    const sv = session?.vendor;
    const sessionActive = sv && (
        sv.onboarding_status === 'ACTIVATED' || sv.onboarding_status === 'APPROVED' ||
        sv.onboardingStatus === 'ACTIVATED' || sv.onboardingStatus === 'APPROVED' ||
        sv.isActive === true
    );

    // ✅ FIX: Check if vendor data has complete profile fields (roleId, capabilities, etc.)
    const isVendorDataComplete = (v: any): boolean => {
        if (!v) return false;
        // For active vendors, we need complete profile data
        const isActive = v?.isActive === true || v?.onboarding_status === 'ACTIVATED' || v?.onboarding_status === 'APPROVED' ||
            v?.onboardingStatus === 'ACTIVATED' || v?.onboardingStatus === 'APPROVED';
        if (isActive) {
            // Active vendors must have roleId and capabilities to be considered complete
            const hasRoleId = !!(v.roleId || v.role_id);
            const hasCapabilities = !!(v.capabilities && Array.isArray(v.capabilities) && v.capabilities.length > 0);
            return hasRoleId && hasCapabilities;
        }
        return true; // Non-active vendors don't need complete data
    };

    if (sessionActive && sv) {
        // ✅ FIX: Only use session vendor if it has complete data, otherwise wait for profile fetch
        if (isVendorDataComplete(sv)) {
            return { status: 'active', vendorData: { ...sv, isActive: true, status: 'active' }, isLoading: false };
        } else {
            // Session vendor is incomplete - set loading so profile fetch happens
            return { status: 'active', vendorData: null, isLoading: true };
        }
    }
    const storedStatus = localStorage.getItem('vendorApplicationStatus');
    const storedVendorRaw = localStorage.getItem('vendorData');
    if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
        try {
            const v = storedVendorRaw ? JSON.parse(storedVendorRaw) : sv;
            if (v) {
                // ✅ FIX: Only use stored vendor if it has complete data, otherwise wait for profile fetch
                if (isVendorDataComplete(v)) {
                    return { status: 'active', vendorData: { ...v, isActive: true, status: 'active' }, isLoading: false };
                } else {
                    // Stored vendor is incomplete - set loading so profile fetch happens
                    return { status: 'active', vendorData: null, isLoading: true };
                }
            }
        } catch (_) { }
    }
    if (storedVendorRaw) {
        try {
            const v = JSON.parse(storedVendorRaw);
            const active = v?.isActive === true || v?.onboarding_status === 'ACTIVATED' || v?.onboarding_status === 'APPROVED' || v?.onboardingStatus === 'ACTIVATED' || v?.onboardingStatus === 'APPROVED';
            if (active) {
                // ✅ FIX: Only use stored vendor if it has complete data, otherwise wait for profile fetch
                if (isVendorDataComplete(v)) {
                    return { status: 'active', vendorData: { ...v, isActive: true, status: 'active' }, isLoading: false };
                } else {
                    // Stored vendor is incomplete - set loading so profile fetch happens
                    return { status: 'active', vendorData: null, isLoading: true };
                }
            }
        } catch (_) { }
    }
    return { status: 'new', vendorData: null, isLoading: true };
}


