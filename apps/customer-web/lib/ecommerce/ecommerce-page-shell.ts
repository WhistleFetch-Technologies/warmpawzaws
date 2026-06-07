/** Shared outer shell for cart, checkout, and order success (mobile column + wide desktop). */
export const ECOMMERCE_PAGE_SHELL =
  'min-h-screen bg-[#F2F4F7] w-full mx-auto max-w-customer lg:max-w-ecommerce';

/** Sticky mobile footer aligned with the phone column; hidden on desktop checkout layouts. */
export const ECOMMERCE_MOBILE_FOOTER_SHELL =
  'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-4 lg:hidden max-w-customer mx-auto cw-footer-safe-b';
