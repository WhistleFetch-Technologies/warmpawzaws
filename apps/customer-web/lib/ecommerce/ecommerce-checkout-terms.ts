export type EcommerceCheckoutTermsSection = {
  title: string;
  intro?: string;
  bullets?: string[];
  footer?: string;
};

export const ECOMMERCE_CHECKOUT_TERMS_TITLE = 'Warmpawz – Terms & Conditions';

export const ECOMMERCE_CHECKOUT_TERMS_INTRO =
  'By placing an order on Warmpawz, you agree to the following terms:';

export const ECOMMERCE_CHECKOUT_TERMS_SECTIONS: EcommerceCheckoutTermsSection[] = [
  {
    title: 'Orders',
    bullets: [
      'All orders are subject to availability and confirmation.',
      'Warmpawz reserves the right to cancel or refuse any order due to stock issues, pricing errors, or suspected fraudulent activity.',
    ],
  },
  {
    title: 'Shipping',
    bullets: [
      'Delivery timelines are estimates and may vary depending on your location and courier service.',
      'Once your order is delivered, the responsibility for the product passes to you.',
    ],
  },
  {
    title: 'Open Box Delivery',
    bullets: [
      'Where available, please inspect your order before accepting delivery.',
      'Any damaged, missing, defective, or incorrect item must be reported during Open Box Delivery or within 24 hours of delivery with photos or videos.',
    ],
  },
  {
    title: 'Returns & Exchanges',
    bullets: [
      'Only pet clothing is eligible for exchange within 7 days of delivery, provided it is unused, unwashed, and has all original tags and packaging.',
      'Exchanges are subject to stock availability.',
    ],
  },
  {
    title: 'Non-Returnable Items',
    intro: 'For hygiene and safety reasons, we do not accept returns or exchanges for:',
    bullets: [
      'Pet food & meals',
      'Treats & supplements',
      'Toys',
      'Harnesses, collars & leashes',
      'Bowls & feeding accessories',
      'Grooming products',
      'Personalized products',
    ],
  },
  {
    title: 'Refunds',
    intro: 'Refunds are provided only if:',
    bullets: [
      'A damaged or incorrect product cannot be replaced.',
      'Your order is cancelled before dispatch.',
      'Your order cannot be fulfilled due to stock unavailability.',
    ],
  },
  {
    title: 'Product Information',
    bullets: [
      'We strive to display accurate product images and descriptions. Minor variations in colour or appearance may occur.',
    ],
  },
  {
    title: 'Updates',
    bullets: [
      'Warmpawz may update these Terms & Conditions at any time without prior notice.',
    ],
  },
];

export const ECOMMERCE_CHECKOUT_TERMS_FOOTER =
  'For any questions, please contact the Warmpawz Customer Support Team.';
