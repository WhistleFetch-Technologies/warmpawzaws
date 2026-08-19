/**
 * Signup modal layout — compact popup proportions; WARMPAWZ orange from CustomerAuthFlow.
 * UI-only tokens; modal variant only.
 */

import type { CSSProperties } from 'react';

/** Existing brand orange palette (do not change hues). */
export const WARMPAWZ_ORANGE = {
  primary: '#FF8C42',
  gradientFrom: '#FF9A56',
  gradientVia: '#FF8C42',
  gradientTo: '#E86820',
  buttonFrom: '#FF9A4A',
  buttonTo: '#FF7A2E',
  hover: '#E86820',
  surface: '#FFFBF7',
  shadow: 'rgba(200, 90, 16, 0.28)',
} as const;

const PAW_PATTERN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="#ffffff" fill-opacity="0.07"><ellipse cx="28" cy="34" rx="8" ry="7"/><circle cx="17" cy="20" r="4"/><circle cx="39" cy="20" r="4"/><circle cx="22" cy="12" r="3"/><circle cx="34" cy="12" r="3"/></g></svg>`
);

export const AUTH_MODAL_PAW_BG = `url("data:image/svg+xml,${PAW_PATTERN_SVG}")`;

export type AuthModalUiClasses = {
  field: string;
  fieldInGroup: string;
  inputGroup: string;
  otpInner: string;
  primaryButton: string;
  textLink: string;
  signupPillLink: string;
  termsLink: string;
  referralTrigger: string;
  referralPanel: string;
  referralInput: string;
  referralApply: string;
  phoneLabel: string;
  description: string;
  sectionTitle: string;
  loginSwitch: string;
  loginLink: string;
  legalParagraph: string;
  footerBlock: string;
  footerHelp: string;
  footerVersion: string;
  guestBrowseWrap: string;
  guestBrowseButton: string;
  guestBrowseHint: string;
};

export const AUTH_MODAL_FORM: AuthModalUiClasses = {
  field:
    'w-full h-10 px-2.5 text-[13px] border border-gray-200 rounded-[9px] outline-none bg-white transition-colors duration-150 focus:border-[#FF8C42] focus:ring-1 focus:ring-[#FF8C42]/25',
  fieldInGroup:
    'w-full h-10 pl-2.5 pr-10 text-[13px] border border-gray-200 rounded-[9px] outline-none bg-white transition-colors duration-150 focus:border-[#FF8C42] focus:ring-1 focus:ring-[#FF8C42]/25',
  inputGroup:
    'flex items-stretch h-10 border border-gray-200 rounded-[9px] overflow-hidden transition-colors duration-150 focus-within:border-[#FF8C42] focus-within:ring-1 focus-within:ring-[#FF8C42]/25 bg-white',
  otpInner:
    'min-w-0 flex-1 h-10 px-2.5 text-sm text-center tracking-[0.16em] outline-none bg-transparent',
  primaryButton:
    'w-full h-10 text-white text-[13px] font-semibold rounded-full border border-white/25 bg-gradient-to-b from-[#FF9A4A] to-[#FF7A2E] shadow-[0_5px_14px_rgba(200,90,16,0.26)] transition-all duration-150 hover:shadow-[0_7px_16px_rgba(200,90,16,0.32)] hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/35 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
  textLink:
    'text-[#FF8C42] font-semibold no-underline transition-colors hover:text-[#E86820] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/30 rounded-sm',
  signupPillLink:
    'text-[#FF8C42] text-[11px] font-medium inline-flex justify-center rounded-full px-2.5 py-1 bg-[#FF8C42]/10 hover:bg-[#FF8C42]/15 transition-colors',
  termsLink:
    'text-[#FF8C42] font-semibold no-underline transition-colors hover:text-[#E86820] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/30 rounded-sm',
  referralTrigger:
    'w-full h-9 border border-dashed border-gray-300 rounded-[9px] text-gray-500 hover:border-[#FF8C42]/60 hover:text-[#FF8C42] transition-colors flex items-center justify-center gap-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/20',
  referralPanel: 'overflow-hidden p-2.5 border border-[#FF8C42]/25 rounded-[9px] bg-[#FF8C42]/5',
  referralInput:
    'min-w-0 flex-1 w-full h-8 px-2 border border-gray-200 rounded-[7px] text-[11px] uppercase bg-white transition-colors focus:border-[#FF8C42] focus:outline-none focus:ring-1 focus:ring-[#FF8C42]/20',
  referralApply:
    'shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-[7px] text-white bg-gradient-to-b from-[#FF9A4A] to-[#FF7A2E] shadow-sm transition-colors hover:brightness-105 active:scale-[0.98]',
  phoneLabel: 'block text-gray-900 font-semibold mb-0.5 text-[11px]',
  description: 'text-center text-[11px] leading-snug text-gray-500 mb-1.5 px-0.5',
  sectionTitle: 'text-base leading-tight font-bold text-gray-900 text-center mb-2.5 tracking-tight',
  loginSwitch: 'w-full text-center text-[11px] text-gray-600 pt-1.5',
  loginLink:
    'text-[#FF8C42] font-semibold hover:text-[#E86820] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/30 rounded-sm',
  legalParagraph: 'text-center text-[10px] text-gray-500 mt-2 px-0.5 leading-snug',
  footerBlock: 'mt-2 text-center space-y-1.5',
  footerHelp: 'text-[11px] font-semibold',
  footerVersion: 'text-[9px] text-gray-400 leading-snug',
  guestBrowseWrap: 'mb-2 text-center',
  guestBrowseButton:
    'w-full rounded-[9px] border border-[#FF8C42]/45 bg-[#FFFBF7] px-2.5 py-2 text-[11px] font-semibold text-[#FF8C42] transition-colors hover:bg-[#FF8C42]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/30',
  guestBrowseHint: 'mt-1 text-[9px] leading-snug text-gray-500',
};

export function getAuthModalLayoutClasses() {
  return {
    shell: 'flex flex-col w-full overflow-hidden rounded-[20px] bg-white',
    column: 'w-full flex flex-col',
    header:
      'relative z-0 isolate flex min-h-[168px] flex-col items-center justify-start overflow-visible bg-gradient-to-b from-[#FF9A56] via-[#FF8C42] to-[#E86820] px-4 pb-10 pt-2.5',
    headerPattern:
      'pointer-events-none absolute inset-0 [background-image:var(--auth-paw-pattern)] [background-size:56px_56px]',
    cardWrap: 'relative z-10 -mt-10',
    card:
      'bg-white rounded-t-[20px] px-4 pt-4 pb-3 shadow-[0_-6px_24px_rgba(0,0,0,0.08),0_12px_28px_rgba(0,0,0,0.05)]',
    logoRing:
      'relative z-20 mb-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white p-0.5 shadow-[0_3px_12px_rgba(0,0,0,0.12)] ring-1 ring-white/60',
    headerStyle: {
      ['--auth-paw-pattern' as string]: AUTH_MODAL_PAW_BG,
    } as CSSProperties,
    heroH1:
      'text-[11px] font-medium text-black italic text-center relative z-20 leading-none',
    heroH2:
      'text-[11px] font-medium text-black italic text-center relative z-20 leading-none',
    heroTitle:
      'mt-0.5 text-xl leading-none font-extrabold text-black tracking-wide text-center relative z-20',
    heroTagline:
      'mt-0.5 pb-0.5 text-center text-[11px] font-bold text-black tracking-wide relative z-20 leading-snug',
  };
}
