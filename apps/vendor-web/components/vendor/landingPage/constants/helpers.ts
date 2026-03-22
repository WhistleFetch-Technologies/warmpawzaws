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

/**
 * Normalize role/config details from a vendor object into a consistent shape.
 */
export function getNormalizedRoleInfo(vendor: any) {
    const role = vendor?.role || {};
    const roleName: string = (role?.name || vendor?.role_name || vendor?.roleName || '').toString().toLowerCase();
    const roleId: string | undefined = role?.id || vendor?.role_id || vendor?.roleId;
    const config: any = role?.config || {};

    const customerService: string | undefined =
        (config?.customer_service || vendor?.customer_service || '').toString().toLowerCase() || undefined;

    const vendorConfiguration: string | undefined =
        (config?.vendorConfiguration || vendor?.vendorConfiguration || vendor?.vendor_configuration || '').toString().toLowerCase() || undefined;

    const vendorTypes: string[] = Array.isArray(config?.vendorTypes)
        ? (config.vendorTypes as any[]).map(s => String(s).toLowerCase())
        : [];

    const serviceStyles = config?.serviceStyles || {};
    const selectedServiceStyles: string[] = Array.isArray(serviceStyles?.selected)
        ? (serviceStyles.selected as any[]).map(s => String(s).toLowerCase())
        : [];
    const businessServiceStyles: string[] = Array.isArray(serviceStyles?.business)
        ? (serviceStyles.business as any[]).map(s => String(s).toLowerCase())
        : [];
    const soloServiceStyles: string[] = Array.isArray(serviceStyles?.solo)
        ? (serviceStyles.solo as any[]).map(s => String(s).toLowerCase())
        : [];

    const capabilities: string[] = Array.isArray(vendor?.capabilities)
        ? (vendor.capabilities as any[]).map(s => String(s).toLowerCase())
        : [];

    return {
        roleName,
        roleId,
        customerService,
        vendorConfiguration,
        vendorTypes,
        serviceStyles: {
            selected: selectedServiceStyles,
            business: businessServiceStyles,
            solo: soloServiceStyles
        },
        capabilities
    };
}

/** Generic capability check helper. */
export function hasAnyCapability(vendor: any, caps: string[]): boolean {
    const { capabilities } = getNormalizedRoleInfo(vendor);
    if (!caps?.length) return false;
    const set = new Set(capabilities);
    return caps.some(c => set.has(c.toLowerCase()));
}

/** Generic role-name check helper. */
export function isRoleName(vendor: any, ...names: string[]): boolean {
    const { roleName } = getNormalizedRoleInfo(vendor);
    const wanted = names.map(n => n.toLowerCase());
    return !!roleName && wanted.includes(roleName);
}

/** Determine if vendor is a marketplace/e-commerce seller. */
export function isSeller(vendor: any): boolean {
    const info = getNormalizedRoleInfo(vendor);
    const byRole = info.roleName === 'seller' || info.roleName === 'marketplace_seller' || info.roleName === 'store_seller';
    const byService = info.customerService === 'shop';
    const byType = info.vendorTypes.includes('seller');
    const byCaps = ['seller_hub', 'catalog', 'product_catalog', 'orders', 'delivery', 'order_dispatch', 'order_broadcast']
        .some(c => info.capabilities.includes(c));
    const byStyles = ['delivery', 'pickup']
        .some(s => info.serviceStyles.selected.includes(s) || info.serviceStyles.business.includes(s) || info.serviceStyles.solo.includes(s));
    return byRole || byService || byType || byCaps || byStyles;
}

/** Determine if vendor is a service provider (e.g., grooming/vet center/solo). */
export function isServiceProvider(vendor: any): boolean {
    const info = getNormalizedRoleInfo(vendor);
    const byService = info.customerService && info.customerService !== 'shop';
    const byType = info.vendorTypes.some(t => ['service provider', 'service_provider', 'healthcare provider', 'healthcare_provider'].includes(t));
    return !isSeller(vendor) && (byService || byType);
}

/**
 * Strict seller check: only route to seller hub when clearly a seller.
 * Avoids accidental redirects for non-ecommerce roles (e.g., vet_clinic).
 */
export function isSellerStrict(vendor: any): boolean {
    const info = getNormalizedRoleInfo(vendor);

    // Role or explicit customer_service of 'shop' are strong signals
    const byRole = info.roleName === 'seller' || info.roleName === 'marketplace_seller' || info.roleName === 'product_seller' || info.roleName === 'store_seller';
    const byService = info.customerService === 'shop';

    // Strict: do NOT route by capabilities or styles to avoid false positives
    return byRole || byService;
}

/** Preferred UI route for a vendor based on role/config. */
export function determineVendorUIRoute(vendor: any): '/seller' | '/dashboard' {
    return isSellerStrict(vendor) ? '/seller' : '/dashboard';
}

