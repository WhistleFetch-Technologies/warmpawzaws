import type { VetVisualVariant } from '@/lib/specialization-detail';

export function vetVariantClasses(variant: VetVisualVariant = 'default') {
  switch (variant) {
    case 'palliative':
      return {
        pageBg: 'bg-gradient-to-b from-slate-50 to-stone-50/80',
        heroBorder: 'border-stone-200/80',
        heroShadow: 'shadow-[0_8px_32px_rgba(120,113,108,0.08)]',
        chip: 'border-stone-200 bg-stone-50 text-stone-700',
        accent: 'text-stone-700',
        card: 'border-stone-100 bg-white',
      };
    case 'emergency':
      return {
        pageBg: 'bg-gradient-to-b from-red-50/40 to-orange-50/30',
        heroBorder: 'border-red-200/80',
        heroShadow: 'shadow-[0_8px_32px_rgba(220,38,38,0.12)]',
        chip: 'border-red-200 bg-red-50 text-red-700',
        accent: 'text-red-700',
        card: 'border-red-100/80 bg-white',
      };
    default:
      return {
        pageBg: 'bg-gradient-to-b from-orange-50/30 to-white',
        heroBorder: 'border-orange-100/80',
        heroShadow: 'shadow-[0_8px_32px_rgba(255,140,66,0.08)]',
        chip: 'border-orange-100 bg-orange-50 text-[#E8742A]',
        accent: 'text-[#E8742A]',
        card: 'border-orange-100/60 bg-white',
      };
  }
}
