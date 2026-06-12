import type { LucideIcon } from 'lucide-react';
import { Calendar, ShoppingBag, User, Settings } from 'lucide-react';

export type SupportFaqArticle = {
  id: string;
  question: string;
  answer: string;
};

export type SupportFaqCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  articles: SupportFaqArticle[];
};

export const SUPPORT_FAQ_CATEGORIES: SupportFaqCategory[] = [
  {
    id: 'booking',
    title: 'Booking & Services',
    icon: Calendar,
    articles: [
      {
        id: 'booking-1',
        question: 'How do I book a service?',
        answer:
          'Navigate to the service you need, select a vendor, choose a date and time, and complete the booking. You can track your booking in the My Bookings section.',
      },
      {
        id: 'booking-2',
        question: 'Can I cancel or reschedule a booking?',
        answer:
          'Yes. Open My Bookings, select the appointment, and choose Cancel or Reschedule. Policies may vary by service type and how close you are to the scheduled time.',
      },
      {
        id: 'booking-3',
        question: 'What payment methods are accepted?',
        answer:
          'We accept credit and debit cards, UPI, net banking, and WarmPawz wallet balance through Razorpay.',
      },
      {
        id: 'booking-4',
        question: 'How do I track my booking status?',
        answer:
          'Go to My Bookings to see upcoming, in-progress, and completed appointments with live status updates.',
      },
      {
        id: 'booking-5',
        question: 'Can I book for multiple pets?',
        answer:
          'Yes. During booking you can select the pet profile for each appointment. Some services allow adding multiple pets in one request.',
      },
      {
        id: 'booking-6',
        question: 'What is the cancellation policy?',
        answer:
          'Cancellation windows depend on the vendor and service type. Check the booking summary before confirming. Late cancellations may incur a fee.',
      },
      {
        id: 'booking-7',
        question: 'How do I choose a service provider?',
        answer:
          'Browse by service category, compare ratings, distance, and available slots, then pick the provider that fits your needs.',
      },
      {
        id: 'booking-8',
        question: 'Can I book home visit services?',
        answer:
          'Yes. Filter for at-home or home-visit services when browsing vets, grooming, training, and other categories.',
      },
      {
        id: 'booking-9',
        question: 'What if the vendor does not show up?',
        answer:
          'Contact support from the booking detail screen. We will help reschedule or review a refund based on the situation.',
      },
      {
        id: 'booking-10',
        question: 'How do I add special instructions?',
        answer:
          'Use the notes or instructions field during checkout to share access details, pet behaviour, or medical context.',
      },
      {
        id: 'booking-11',
        question: 'Can I book recurring services?',
        answer:
          'Some vendors offer packages or repeat bookings. Look for package options on the provider profile or in My Packages.',
      },
      {
        id: 'booking-12',
        question: 'How do I view my booking history?',
        answer:
          'Open My Bookings and switch to the completed tab to see past appointments, receipts, and service notes.',
      },
    ],
  },
  {
    id: 'orders',
    title: 'Orders & Products',
    icon: ShoppingBag,
    articles: [
      {
        id: 'orders-1',
        question: 'How do I track my order?',
        answer:
          'Go to My Orders and open your order to see tracking, delivery status, and estimated arrival time.',
      },
      {
        id: 'orders-2',
        question: 'What is the return policy?',
        answer:
          'Most products can be returned within 7 days if unopened. Pharmacy and perishable items may have different policies.',
      },
      {
        id: 'orders-3',
        question: 'How is GST calculated?',
        answer:
          'GST is calculated at 18% on the order subtotal where applicable, in compliance with Indian tax regulations.',
      },
      {
        id: 'orders-4',
        question: 'Can I modify an order after placing it?',
        answer:
          'If the order has not shipped, contact support quickly from the order detail page. Changes may not be possible once dispatched.',
      },
      {
        id: 'orders-5',
        question: 'How do delivery fees work?',
        answer:
          'Delivery fees depend on your location, order value, and seller. The final fee is shown at checkout before payment.',
      },
      {
        id: 'orders-6',
        question: 'What if my order arrives damaged?',
        answer:
          'Take photos and report the issue from My Orders within 48 hours. Our team will arrange a replacement or refund.',
      },
      {
        id: 'orders-7',
        question: 'Can I cancel a product order?',
        answer:
          'You can cancel before the seller ships the item. After dispatch, you may need to request a return instead.',
      },
      {
        id: 'orders-8',
        question: 'How do pharmacy orders work?',
        answer:
          'Upload or select a prescription when required. A licensed partner verifies it before dispatch. Track status in My Orders.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & Payments',
    icon: User,
    articles: [
      {
        id: 'account-1',
        question: 'How do I update my profile?',
        answer:
          'Open your profile from the account menu to edit your name, contact details, addresses, and saved payment methods.',
      },
      {
        id: 'account-2',
        question: 'How do I add a pet?',
        answer:
          'Go to Pet Profile and tap Add Pet to register your pet’s details, photos, and medical records.',
      },
      {
        id: 'account-3',
        question: 'What are loyalty points?',
        answer:
          'Earn points on eligible bookings and purchases. Redeem them for discounts on future services and shop orders.',
      },
      {
        id: 'account-4',
        question: 'How do I use my WarmPawz wallet?',
        answer:
          'Wallet balance can be applied at checkout for bookings and orders. View balance and history in the Wallet section.',
      },
      {
        id: 'account-5',
        question: 'How do I change my phone number?',
        answer:
          'Update your registered mobile in profile settings. You may need OTP verification on the new number.',
      },
      {
        id: 'account-6',
        question: 'Where can I see my payment history?',
        answer:
          'Check Wallet for top-ups and My Bookings or My Orders for receipts linked to each transaction.',
      },
      {
        id: 'account-7',
        question: 'How do refunds reach my account?',
        answer:
          'Refunds go back to the original payment method or wallet, depending on how you paid. Processing usually takes 5–7 business days.',
      },
      {
        id: 'account-8',
        question: 'Can I save multiple addresses?',
        answer:
          'Yes. Manage home, work, and other delivery addresses from your profile or during checkout.',
      },
      {
        id: 'account-9',
        question: 'How do I manage notification preferences?',
        answer:
          'Open Notifications in your account settings to control booking reminders, offers, and order updates.',
      },
      {
        id: 'account-10',
        question: 'Is my payment information secure?',
        answer:
          'Payments are processed by Razorpay. WarmPawz does not store full card numbers on our servers.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical Support',
    icon: Settings,
    articles: [
      {
        id: 'technical-1',
        question: 'The app is not loading properly',
        answer:
          'Try clearing your browser cache, checking your internet connection, or updating to the latest version of the app.',
      },
      {
        id: 'technical-2',
        question: 'I forgot my password',
        answer:
          'Use Forgot Password on the login screen. You will receive an OTP to reset access to your account.',
      },
      {
        id: 'technical-3',
        question: 'Payment failed but money was deducted',
        answer:
          'Contact support with your payment reference. In most cases the amount is automatically refunded within 5–7 business days.',
      },
      {
        id: 'technical-4',
        question: 'I am not receiving OTP messages',
        answer:
          'Ensure your number is correct, disable DND temporarily, and wait a minute before requesting a new OTP.',
      },
      {
        id: 'technical-5',
        question: 'Location or maps are not working',
        answer:
          'Enable location permissions for WarmPawz in your device settings and refresh the page or restart the app.',
      },
      {
        id: 'technical-6',
        question: 'Images or uploads fail',
        answer:
          'Use JPEG, PNG, or PDF under 10 MB. Check your connection and try again from a stable network.',
      },
      {
        id: 'technical-7',
        question: 'How do I report a bug?',
        answer:
          'Create a support ticket under Contact with steps to reproduce the issue and screenshots if possible.',
      },
    ],
  },
];

export function getTotalFaqArticleCount(): number {
  return SUPPORT_FAQ_CATEGORIES.reduce((sum, c) => sum + c.articles.length, 0);
}

export function filterFaqCategories(query: string): SupportFaqCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return SUPPORT_FAQ_CATEGORIES;

  return SUPPORT_FAQ_CATEGORIES.map((category) => ({
    ...category,
    articles: category.articles.filter(
      (a) =>
        a.question.toLowerCase().includes(q) || a.answer.toLowerCase().includes(q)
    ),
  })).filter((c) => c.articles.length > 0);
}
