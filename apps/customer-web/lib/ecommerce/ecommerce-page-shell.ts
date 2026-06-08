/** Inner content area inside EcommerceTabbedShell (tab bar padding handled by shell). */
export const ECOMMERCE_PAGE_SHELL = 'min-h-0 w-full flex-1 flex flex-col';

/** Sticky checkout CTA on cart (mobile, no tab bar). */
export const ECOMMERCE_MOBILE_FOOTER_SHELL =
  'fixed left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 lg:hidden mx-auto w-full max-w-customer cw-footer-safe-b bottom-0';

/** Floating “View cart” pill on shop — centered above tab bar. Use class literal in components (Tailwind scans app/components only). */
export const SHOP_FLOATING_CART_BOTTOM = 'bottom-[var(--customer-floater-bottom)]';
