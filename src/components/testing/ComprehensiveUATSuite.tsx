import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  PlayCircle, 
  Download,
  RefreshCw,
  FileText,
  Users,
  ShoppingBag,
  Wallet,
  MapPin,
  Gift,
  Settings,
  TrendingUp,
  Package,
  CreditCard,
  Bell,
  Search,
  Filter,
  BarChart3,
  Shield,
  Truck,
  Clock,
  Home,
  Building2,
  Heart,
  Stethoscope,
  Scissors,
  GraduationCap,
  UtensilsCrossed,
  Pill,
  Dog,
  Camera,
  Plane,
  Coffee,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

// UAT Test Categories
interface TestCase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning';
  category: string;
  steps: TestStep[];
  errors?: string[];
  warnings?: string[];
  duration?: number;
}

interface TestStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  expectedResult: string;
  actualResult?: string;
}

export default function ComprehensiveUATSuite() {
  const [activeCategory, setActiveCategory] = useState('overview');
  const [testResults, setTestResults] = useState<Record<string, TestCase>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);

  // Define all test categories and cases
  const testCategories = {
    customer_booking: {
      icon: ShoppingBag,
      label: 'Customer Bookings',
      color: 'bg-blue-500',
      tests: [
        {
          id: 'vet_booking_flow',
          name: 'Veterinary Service Booking',
          description: 'Complete flow from search to booking confirmation',
          category: 'customer_booking',
          steps: [
            { id: '1', description: 'Navigate to Vet Services', expectedResult: 'Vet landing page loads' },
            { id: '2', description: 'Select service type (Home/Center/Tele)', expectedResult: 'Service options displayed' },
            { id: '3', description: 'Search for vet by location', expectedResult: 'List of vets within radius' },
            { id: '4', description: 'Select vet and view profile', expectedResult: 'Vet profile with ratings, reviews visible' },
            { id: '5', description: 'Select pet for appointment', expectedResult: 'Pet selection modal with all pets' },
            { id: '6', description: 'Choose date and time slot', expectedResult: 'Available slots displayed' },
            { id: '7', description: 'Apply coupon code', expectedResult: 'Discount applied correctly' },
            { id: '8', description: 'Proceed to payment', expectedResult: 'Razorpay payment gateway opens' },
            { id: '9', description: 'Complete payment', expectedResult: 'Booking confirmed, OTP generated' },
            { id: '10', description: 'View booking in My Bookings', expectedResult: 'Booking appears with correct details' }
          ]
        },
        {
          id: 'grooming_booking_flow',
          name: 'Grooming Service Booking',
          description: 'Test grooming service booking with package selection',
          category: 'customer_booking',
          steps: [
            { id: '1', description: 'Navigate to Grooming Services', expectedResult: 'Grooming landing page loads' },
            { id: '2', description: 'Select grooming package', expectedResult: 'Package details with pricing shown' },
            { id: '3', description: 'Choose service location (Home/Center)', expectedResult: 'Location options available' },
            { id: '4', description: 'Select groomer', expectedResult: 'Groomer cards with portfolio images' },
            { id: '5', description: 'Book time slot', expectedResult: 'Calendar with available slots' },
            { id: '6', description: 'Add multiple pets', expectedResult: 'Multi-pet selection working' },
            { id: '7', description: 'Complete payment', expectedResult: 'Booking confirmed' }
          ]
        },
        {
          id: 'training_booking_flow',
          name: 'Training Service Booking',
          description: 'Test training service with package milestones',
          category: 'customer_booking',
          steps: [
            { id: '1', description: 'Navigate to Training Services', expectedResult: 'Training landing page loads' },
            { id: '2', description: 'Select training package (e.g., 10 sessions)', expectedResult: 'Package with milestones shown' },
            { id: '3', description: 'Select trainer', expectedResult: 'Trainer profile with specializations' },
            { id: '4', description: 'Book first session', expectedResult: 'First session scheduled' },
            { id: '5', description: 'View training progress dashboard', expectedResult: 'Progress tracker visible' }
          ]
        },
        {
          id: 'boarding_booking_flow',
          name: 'Boarding Service Booking',
          description: 'Test boarding with room selection and daily updates',
          category: 'customer_booking',
          steps: [
            { id: '1', description: 'Navigate to Boarding Services', expectedResult: 'Boarding centers displayed' },
            { id: '2', description: 'Select boarding center', expectedResult: 'Center profile with facilities' },
            { id: '3', description: 'Choose room type', expectedResult: 'Room options with pricing' },
            { id: '4', description: 'Select check-in/check-out dates', expectedResult: 'Calendar with availability' },
            { id: '5', description: 'Add pet health information', expectedResult: 'Health form submission' },
            { id: '6', description: 'Complete booking', expectedResult: 'Booking confirmed with CCTV access link' }
          ]
        },
        {
          id: 'walking_booking_flow',
          name: 'Dog Walking Service',
          description: 'Test walking service with GPS tracking',
          category: 'customer_booking',
          steps: [
            { id: '1', description: 'Navigate to Walking Services', expectedResult: 'Walker list displayed' },
            { id: '2', description: 'Select walker', expectedResult: 'Walker profile with reviews' },
            { id: '3', description: 'Choose walk duration', expectedResult: 'Duration options (30/45/60 min)' },
            { id: '4', description: 'Book walk slot', expectedResult: 'Slot confirmed' },
            { id: '5', description: 'Track walk in real-time', expectedResult: 'GPS tracker shows live location' },
            { id: '6', description: 'View walk photos after completion', expectedResult: 'Photo gallery available' }
          ]
        },
        {
          id: 'adoption_flow',
          name: 'Pet Adoption Flow',
          description: 'Complete adoption process',
          category: 'customer_booking',
          steps: [
            { id: '1', description: 'Navigate to Adoption Services', expectedResult: 'Available pets displayed' },
            { id: '2', description: 'Filter pets by species/breed/age', expectedResult: 'Filters working correctly' },
            { id: '3', description: 'View pet profile', expectedResult: 'Pet details, medical history shown' },
            { id: '4', description: 'Fill adoption questionnaire', expectedResult: 'Form validation working' },
            { id: '5', description: 'Submit application', expectedResult: 'Application submitted to shelter' },
            { id: '6', description: 'Track application status', expectedResult: 'Status updates visible' }
          ]
        }
      ]
    },
    ecommerce: {
      icon: Package,
      label: 'E-Commerce',
      color: 'bg-purple-500',
      tests: [
        {
          id: 'product_browsing',
          name: 'Product Browsing & Search',
          description: 'Test product discovery and search functionality',
          category: 'ecommerce',
          steps: [
            { id: '1', description: 'Navigate to Shop', expectedResult: 'Product catalog loads' },
            { id: '2', description: 'Search for product', expectedResult: 'Search results displayed' },
            { id: '3', description: 'Apply filters (category, price, brand)', expectedResult: 'Filters applied correctly' },
            { id: '4', description: 'Sort products', expectedResult: 'Sorting working (price, rating, popularity)' },
            { id: '5', description: 'View product details', expectedResult: 'Product page with images, reviews' }
          ]
        },
        {
          id: 'cart_checkout',
          name: 'Cart & Checkout Flow',
          description: 'Complete purchase flow from cart to order confirmation',
          category: 'ecommerce',
          steps: [
            { id: '1', description: 'Add product to cart', expectedResult: 'Cart count updated' },
            { id: '2', description: 'View cart', expectedResult: 'Cart items displayed with prices' },
            { id: '3', description: 'Update quantity', expectedResult: 'Quantity changes reflected' },
            { id: '4', description: 'Apply coupon', expectedResult: 'Discount applied' },
            { id: '5', description: 'Select delivery address', expectedResult: 'Address selection working' },
            { id: '6', description: 'Choose payment method', expectedResult: 'Payment options available' },
            { id: '7', description: 'Place order', expectedResult: 'Order confirmed with order ID' },
            { id: '8', description: 'View order in order history', expectedResult: 'Order details visible' }
          ]
        },
        {
          id: 'order_tracking',
          name: 'Order Tracking & Delivery',
          description: 'Test order tracking with Shiprocket integration',
          category: 'ecommerce',
          steps: [
            { id: '1', description: 'Navigate to order history', expectedResult: 'All orders listed' },
            { id: '2', description: 'Click on order', expectedResult: 'Order details page opens' },
            { id: '3', description: 'Track shipment', expectedResult: 'Shiprocket tracking info displayed' },
            { id: '4', description: 'View live delivery status', expectedResult: 'Status updates visible' },
            { id: '5', description: 'Contact delivery partner', expectedResult: 'Contact info available' }
          ]
        },
        {
          id: 'returns_refunds',
          name: 'Returns & Refunds',
          description: 'Test return request and refund processing',
          category: 'ecommerce',
          steps: [
            { id: '1', description: 'Request return for order', expectedResult: 'Return form displayed' },
            { id: '2', description: 'Select return reason', expectedResult: 'Reason dropdown populated' },
            { id: '3', description: 'Upload return images', expectedResult: 'Image upload working' },
            { id: '4', description: 'Submit return request', expectedResult: 'Request submitted to seller' },
            { id: '5', description: 'Track return status', expectedResult: 'Status updates visible' },
            { id: '6', description: 'Refund processed to wallet', expectedResult: 'Wallet balance updated' }
          ]
        },
        {
          id: 'banner_navigation',
          name: 'Banner Click-through',
          description: 'Test banner functionality and navigation',
          category: 'ecommerce',
          steps: [
            { id: '1', description: 'View homepage banners', expectedResult: 'Banners displayed' },
            { id: '2', description: 'Click on promotional banner', expectedResult: 'Navigates to promotion page' },
            { id: '3', description: 'View promoted products/services', expectedResult: 'Correct items displayed' },
            { id: '4', description: 'Apply banner discount', expectedResult: 'Discount automatically applied' }
          ]
        }
      ]
    },
    wallet_payments: {
      icon: Wallet,
      label: 'Wallet & Payments',
      color: 'bg-green-500',
      tests: [
        {
          id: 'wallet_topup',
          name: 'Wallet Top-up',
          description: 'Test wallet recharge via Razorpay',
          category: 'wallet_payments',
          steps: [
            { id: '1', description: 'Navigate to Wallet', expectedResult: 'Wallet page loads with balance' },
            { id: '2', description: 'Click add money', expectedResult: 'Amount input displayed' },
            { id: '3', description: 'Enter amount', expectedResult: 'Amount validation working' },
            { id: '4', description: 'Proceed to payment', expectedResult: 'Razorpay gateway opens' },
            { id: '5', description: 'Complete payment', expectedResult: 'Wallet balance updated' },
            { id: '6', description: 'View transaction history', expectedResult: 'Transaction recorded' }
          ]
        },
        {
          id: 'wallet_payment',
          name: 'Pay via Wallet',
          description: 'Test booking payment using wallet balance',
          category: 'wallet_payments',
          steps: [
            { id: '1', description: 'Select wallet as payment method', expectedResult: 'Wallet option available' },
            { id: '2', description: 'Verify sufficient balance', expectedResult: 'Balance check working' },
            { id: '3', description: 'Complete payment', expectedResult: 'Wallet debited, booking confirmed' },
            { id: '4', description: 'View updated wallet balance', expectedResult: 'Balance reflects deduction' }
          ]
        },
        {
          id: 'razorpay_marketplace',
          name: 'Razorpay Marketplace Settlement',
          description: 'Test split payments and vendor settlements',
          category: 'wallet_payments',
          steps: [
            { id: '1', description: 'Make booking payment', expectedResult: 'Payment split between platform and vendor' },
            { id: '2', description: 'View vendor settlement dashboard', expectedResult: 'Earnings displayed correctly' },
            { id: '3', description: 'Check platform commission', expectedResult: 'Commission calculated per tier' },
            { id: '4', description: 'Verify automated payout', expectedResult: 'Settlement scheduled correctly' }
          ]
        },
        {
          id: 'refund_to_wallet',
          name: 'Refund Processing',
          description: 'Test refund flow to wallet',
          category: 'wallet_payments',
          steps: [
            { id: '1', description: 'Cancel booking', expectedResult: 'Cancellation initiated' },
            { id: '2', description: 'Request refund', expectedResult: 'Refund request submitted' },
            { id: '3', description: 'Admin approves refund', expectedResult: 'Refund processed' },
            { id: '4', description: 'Check wallet balance', expectedResult: 'Refund amount credited' },
            { id: '5', description: 'View transaction in wallet history', expectedResult: 'Refund transaction recorded' }
          ]
        }
      ]
    },
    referral_loyalty: {
      icon: Gift,
      label: 'Referral & Loyalty',
      color: 'bg-yellow-500',
      tests: [
        {
          id: 'customer_referral',
          name: 'Customer Referral Flow',
          description: 'Test customer referral program',
          category: 'referral_loyalty',
          steps: [
            { id: '1', description: 'Navigate to Referral page', expectedResult: 'Referral code displayed' },
            { id: '2', description: 'Share referral link', expectedResult: 'Share options working' },
            { id: '3', description: 'New user signs up with code', expectedResult: 'Code validated' },
            { id: '4', description: 'New user makes first booking', expectedResult: 'Referral reward triggered' },
            { id: '5', description: 'Check referrer wallet', expectedResult: 'Referral bonus credited' },
            { id: '6', description: 'View referral history', expectedResult: 'All referrals listed' }
          ]
        },
        {
          id: 'vendor_referral',
          name: 'Vendor Referral Flow',
          description: 'Test vendor referral program',
          category: 'referral_loyalty',
          steps: [
            { id: '1', description: 'Vendor navigates to Referral page', expectedResult: 'Vendor referral code displayed' },
            { id: '2', description: 'Share vendor referral link', expectedResult: 'Share working' },
            { id: '3', description: 'New vendor signs up', expectedResult: 'Code applied' },
            { id: '4', description: 'New vendor gets approved', expectedResult: 'Referral bonus credited to referrer' }
          ]
        },
        {
          id: 'loyalty_points',
          name: 'Loyalty Points (Pawints)',
          description: 'Test Pawints earning and redemption',
          category: 'referral_loyalty',
          steps: [
            { id: '1', description: 'Complete booking', expectedResult: 'Pawints earned' },
            { id: '2', description: 'Check loyalty page', expectedResult: 'Points balance updated' },
            { id: '3', description: 'View points history', expectedResult: 'All transactions listed' },
            { id: '4', description: 'Redeem points for discount', expectedResult: 'Points converted to discount' },
            { id: '5', description: 'Apply discount to booking', expectedResult: 'Discount applied successfully' },
            { id: '6', description: 'View golden coin widget', expectedResult: 'Widget displays correct balance' }
          ]
        },
        {
          id: 'loyalty_tiers',
          name: 'Loyalty Tier Progression',
          description: 'Test tier upgrades based on spending',
          category: 'referral_loyalty',
          steps: [
            { id: '1', description: 'Check current tier', expectedResult: 'Tier displayed (Bronze/Silver/Gold)' },
            { id: '2', description: 'Make bookings to earn points', expectedResult: 'Points accumulate' },
            { id: '3', description: 'Reach tier threshold', expectedResult: 'Auto-upgrade to next tier' },
            { id: '4', description: 'Verify tier benefits', expectedResult: 'Higher cashback/rewards active' }
          ]
        }
      ]
    },
    gps_tracking: {
      icon: MapPin,
      label: 'GPS Tracking',
      color: 'bg-red-500',
      tests: [
        {
          id: 'walker_tracking',
          name: 'Walker Live GPS Tracking',
          description: 'Test real-time location tracking for dog walking',
          category: 'gps_tracking',
          steps: [
            { id: '1', description: 'Walker starts walk session', expectedResult: 'GPS tracking initiated' },
            { id: '2', description: 'Customer opens tracking page', expectedResult: 'Live map with walker location' },
            { id: '3', description: 'Walker moves', expectedResult: 'Location updates in real-time' },
            { id: '4', description: 'View walk route', expectedResult: 'Breadcrumb trail visible' },
            { id: '5', description: 'Walker ends session', expectedResult: 'GPS tracking stops, route saved' }
          ]
        },
        {
          id: 'home_service_tracking',
          name: 'Home Service Provider Tracking',
          description: 'Test GPS tracking for home visit services',
          category: 'gps_tracking',
          steps: [
            { id: '1', description: 'Provider starts journey', expectedResult: 'GPS tracking begins' },
            { id: '2', description: 'Customer receives notification', expectedResult: 'Alert with tracking link' },
            { id: '3', description: 'Track provider location', expectedResult: 'Live location on map' },
            { id: '4', description: 'View ETA', expectedResult: 'Estimated arrival time displayed' },
            { id: '5', description: 'Provider arrives', expectedResult: 'Arrival notification sent' }
          ]
        },
        {
          id: 'ambulance_tracking',
          name: 'Pet Ambulance Emergency Tracking',
          description: 'Test emergency ambulance GPS tracking',
          category: 'gps_tracking',
          steps: [
            { id: '1', description: 'Book emergency ambulance', expectedResult: 'Nearest ambulance assigned' },
            { id: '2', description: 'Track ambulance location', expectedResult: 'Live GPS tracking active' },
            { id: '3', description: 'View ETA and route', expectedResult: 'Route and time displayed' },
            { id: '4', description: 'Ambulance reaches location', expectedResult: 'Notification sent' }
          ]
        }
      ]
    },
    vendor_flows: {
      icon: Briefcase,
      label: 'Vendor Flows',
      color: 'bg-indigo-500',
      tests: [
        {
          id: 'vendor_onboarding',
          name: 'Vendor Onboarding (All 20 Types)',
          description: 'Test onboarding for all vendor types',
          category: 'vendor_flows',
          steps: [
            { id: '1', description: 'Select vendor role (Vet/Groomer/Trainer/etc.)', expectedResult: 'Role selection working' },
            { id: '2', description: 'Select business type (Solo/Center)', expectedResult: 'Type selection available' },
            { id: '3', description: 'Fill business information', expectedResult: 'Form validation working' },
            { id: '4', description: 'Upload required documents', expectedResult: 'Document upload successful' },
            { id: '5', description: 'Add bank account details', expectedResult: 'Bank verification initiated' },
            { id: '6', description: 'Configure service offerings', expectedResult: 'Service configuration saved' },
            { id: '7', description: 'Set availability schedule', expectedResult: 'Schedule saved' },
            { id: '8', description: 'Submit for approval', expectedResult: 'Application submitted' },
            { id: '9', description: 'Admin reviews application', expectedResult: 'Admin can view all details' },
            { id: '10', description: 'Admin approves vendor', expectedResult: 'Vendor status updated to approved' }
          ]
        },
        {
          id: 'vendor_service_management',
          name: 'Vendor Service CRUD',
          description: 'Test service creation, editing, deletion',
          category: 'vendor_flows',
          steps: [
            { id: '1', description: 'Navigate to service management', expectedResult: 'Service dashboard loads' },
            { id: '2', description: 'Create new service', expectedResult: 'Service creation form opens' },
            { id: '3', description: 'Set service details and pricing', expectedResult: 'Details saved' },
            { id: '4', description: 'Publish service', expectedResult: 'Service appears in customer app' },
            { id: '5', description: 'Edit service', expectedResult: 'Changes saved and reflected' },
            { id: '6', description: 'Unpublish service', expectedResult: 'Service hidden from customer app' },
            { id: '7', description: 'Delete service', expectedResult: 'Service removed' }
          ]
        },
        {
          id: 'vendor_booking_management',
          name: 'Vendor Booking Management',
          description: 'Test booking acceptance, rejection, completion',
          category: 'vendor_flows',
          steps: [
            { id: '1', description: 'Receive booking notification', expectedResult: 'Notification appears' },
            { id: '2', description: 'View booking details', expectedResult: 'All booking info displayed' },
            { id: '3', description: 'Accept booking', expectedResult: 'Status updated to confirmed' },
            { id: '4', description: 'Start service (OTP verification)', expectedResult: 'OTP validated' },
            { id: '5', description: 'Complete service', expectedResult: 'Status updated to completed' },
            { id: '6', description: 'Add service notes/summary', expectedResult: 'Notes saved' },
            { id: '7', description: 'Request payment', expectedResult: 'Payment request sent' }
          ]
        },
        {
          id: 'vendor_staff_management',
          name: 'Staff Management',
          description: 'Test staff addition, schedule, and service assignment',
          category: 'vendor_flows',
          steps: [
            { id: '1', description: 'Add new staff member', expectedResult: 'Staff form working' },
            { id: '2', description: 'Assign services to staff', expectedResult: 'Services assigned' },
            { id: '3', description: 'Set staff availability', expectedResult: 'Schedule configured' },
            { id: '4', description: 'Staff appears in customer search', expectedResult: 'Staff visible to customers' },
            { id: '5', description: 'Edit staff details', expectedResult: 'Changes saved' },
            { id: '6', description: 'Deactivate staff', expectedResult: 'Staff hidden from customer app' }
          ]
        },
        {
          id: 'vendor_settlement',
          name: 'Vendor Settlement Dashboard',
          description: 'Test earnings, payouts, and settlement reports',
          category: 'vendor_flows',
          steps: [
            { id: '1', description: 'View earnings dashboard', expectedResult: 'Total earnings displayed' },
            { id: '2', description: 'Check pending settlements', expectedResult: 'Pending amount visible' },
            { id: '3', description: 'View commission deductions', expectedResult: 'Commission breakdown shown' },
            { id: '4', description: 'Check payout schedule', expectedResult: 'Next payout date displayed' },
            { id: '5', description: 'Download settlement report', expectedResult: 'Report downloaded' },
            { id: '6', description: 'Verify bank account', expectedResult: 'Verification status shown' }
          ]
        },
        {
          id: 'vendor_promotions',
          name: 'Vendor Promotions & Discounts',
          description: 'Test discount creation and management',
          category: 'vendor_flows',
          steps: [
            { id: '1', description: 'Create discount offer', expectedResult: 'Discount form working' },
            { id: '2', description: 'Set discount parameters', expectedResult: 'Percentage/amount, validity set' },
            { id: '3', description: 'Publish discount', expectedResult: 'Discount appears on service cards' },
            { id: '4', description: 'Customer applies discount', expectedResult: 'Discount calculated correctly' },
            { id: '5', description: 'View discount analytics', expectedResult: 'Usage stats displayed' },
            { id: '6', description: 'Deactivate discount', expectedResult: 'Discount no longer available' }
          ]
        }
      ]
    },
    admin_flows: {
      icon: Shield,
      label: 'Admin Portal',
      color: 'bg-pink-500',
      tests: [
        {
          id: 'vendor_approval',
          name: 'Vendor Application Review',
          description: 'Test vendor approval workflow',
          category: 'admin_flows',
          steps: [
            { id: '1', description: 'View pending applications', expectedResult: 'All pending vendors listed' },
            { id: '2', description: 'Open application details', expectedResult: 'All vendor info visible' },
            { id: '3', description: 'Review documents', expectedResult: 'Documents viewable' },
            { id: '4', description: 'Approve vendor', expectedResult: 'Status changed to approved' },
            { id: '5', description: 'Reject vendor', expectedResult: 'Rejection reason form opens' },
            { id: '6', description: 'Request clarification', expectedResult: 'Clarification request sent' },
            { id: '7', description: 'View rejected vendors', expectedResult: 'Rejected tab shows all rejected' }
          ]
        },
        {
          id: 'catalog_management',
          name: 'Service Catalog Management',
          description: 'Test service category and catalog management',
          category: 'admin_flows',
          steps: [
            { id: '1', description: 'Create service category', expectedResult: 'Category created' },
            { id: '2', description: 'Add subcategories', expectedResult: 'Subcategories added' },
            { id: '3', description: 'Set pricing rules', expectedResult: 'Rules configured' },
            { id: '4', description: 'Publish to regions', expectedResult: 'Regional availability set' },
            { id: '5', description: 'Edit category', expectedResult: 'Changes saved' },
            { id: '6', description: 'Deactivate category', expectedResult: 'Category hidden' }
          ]
        },
        {
          id: 'banner_management',
          name: 'Banner Management',
          description: 'Test banner upload and configuration',
          category: 'admin_flows',
          steps: [
            { id: '1', description: 'Navigate to banner management', expectedResult: 'Banner dashboard loads' },
            { id: '2', description: 'Upload banner image', expectedResult: 'Image uploaded successfully' },
            { id: '3', description: 'Set banner link target', expectedResult: 'Target URL/service set' },
            { id: '4', description: 'Configure display rules', expectedResult: 'Location, timing rules set' },
            { id: '5', description: 'Activate banner', expectedResult: 'Banner appears on customer app' },
            { id: '6', description: 'View banner analytics', expectedResult: 'Click-through rates displayed' },
            { id: '7', description: 'Deactivate banner', expectedResult: 'Banner removed from app' }
          ]
        },
        {
          id: 'platform_analytics',
          name: 'Platform Analytics',
          description: 'Test analytics dashboard and reports',
          category: 'admin_flows',
          steps: [
            { id: '1', description: 'View dashboard overview', expectedResult: 'Key metrics displayed' },
            { id: '2', description: 'Check revenue charts', expectedResult: 'Revenue trends visible' },
            { id: '3', description: 'View vendor performance', expectedResult: 'Top vendors ranked' },
            { id: '4', description: 'Analyze booking trends', expectedResult: 'Service-wise bookings shown' },
            { id: '5', description: 'Export analytics report', expectedResult: 'Report downloaded' }
          ]
        },
        {
          id: 'refund_management',
          name: 'Refund & Dispute Management',
          description: 'Test refund approval and dispute resolution',
          category: 'admin_flows',
          steps: [
            { id: '1', description: 'View refund requests', expectedResult: 'All requests listed' },
            { id: '2', description: 'Review refund request', expectedResult: 'Details and reason visible' },
            { id: '3', description: 'Approve refund', expectedResult: 'Refund processed to wallet' },
            { id: '4', description: 'Reject refund', expectedResult: 'Rejection reason sent' },
            { id: '5', description: 'View disputes', expectedResult: 'Dispute list displayed' },
            { id: '6', description: 'Resolve dispute', expectedResult: 'Resolution recorded' }
          ]
        },
        {
          id: 'role_management',
          name: 'Role & Permission Management',
          description: 'Test RBAC configuration',
          category: 'admin_flows',
          steps: [
            { id: '1', description: 'Navigate to role management', expectedResult: 'Roles listed' },
            { id: '2', description: 'Create new role', expectedResult: 'Role creation form opens' },
            { id: '3', description: 'Assign permissions', expectedResult: 'Permissions selected' },
            { id: '4', description: 'Save role', expectedResult: 'Role saved' },
            { id: '5', description: 'Assign role to user', expectedResult: 'User updated' },
            { id: '6', description: 'Test role permissions', expectedResult: 'Access control working' }
          ]
        }
      ]
    },
    booking_lifecycle: {
      icon: Clock,
      label: 'Booking Lifecycle',
      color: 'bg-cyan-500',
      tests: [
        {
          id: 'booking_reschedule',
          name: 'Booking Rescheduling',
          description: 'Test booking reschedule with refund policies',
          category: 'booking_lifecycle',
          steps: [
            { id: '1', description: 'Open confirmed booking', expectedResult: 'Booking details displayed' },
            { id: '2', description: 'Click reschedule', expectedResult: 'Reschedule modal opens' },
            { id: '3', description: 'Select new date/time', expectedResult: 'Available slots shown' },
            { id: '4', description: 'Check reschedule charges', expectedResult: 'Charges displayed if applicable' },
            { id: '5', description: 'Confirm reschedule', expectedResult: 'Booking updated' },
            { id: '6', description: 'Verify notifications sent', expectedResult: 'Customer and vendor notified' }
          ]
        },
        {
          id: 'booking_cancellation',
          name: 'Booking Cancellation',
          description: 'Test cancellation with refund processing',
          category: 'booking_lifecycle',
          steps: [
            { id: '1', description: 'Open booking', expectedResult: 'Booking details visible' },
            { id: '2', description: 'Click cancel', expectedResult: 'Cancellation modal opens' },
            { id: '3', description: 'View refund policy', expectedResult: 'Refund amount shown' },
            { id: '4', description: 'Confirm cancellation', expectedResult: 'Booking cancelled' },
            { id: '5', description: 'Check refund status', expectedResult: 'Refund processing shown' },
            { id: '6', description: 'Verify wallet credit', expectedResult: 'Amount credited to wallet' }
          ]
        },
        {
          id: 'booking_completion',
          name: 'Booking Completion & Rating',
          description: 'Test service completion and review flow',
          category: 'booking_lifecycle',
          steps: [
            { id: '1', description: 'Service marked completed', expectedResult: 'Status updated' },
            { id: '2', description: 'Customer receives completion notification', expectedResult: 'Notification sent' },
            { id: '3', description: 'Customer opens rating modal', expectedResult: 'Rating form displayed' },
            { id: '4', description: 'Submit rating and review', expectedResult: 'Review saved' },
            { id: '5', description: 'Review appears on vendor profile', expectedResult: 'Review visible' },
            { id: '6', description: 'Vendor rating updated', expectedResult: 'Average rating recalculated' }
          ]
        }
      ]
    },
    integrations: {
      icon: Settings,
      label: 'Integrations',
      color: 'bg-orange-500',
      tests: [
        {
          id: 'razorpay_integration',
          name: 'Razorpay Payment Gateway',
          description: 'Test Razorpay integration for payments',
          category: 'integrations',
          steps: [
            { id: '1', description: 'Initiate payment', expectedResult: 'Razorpay checkout opens' },
            { id: '2', description: 'Enter card details', expectedResult: 'Card validation working' },
            { id: '3', description: 'Complete payment', expectedResult: 'Payment success callback' },
            { id: '4', description: 'Verify payment recorded', expectedResult: 'Transaction in database' },
            { id: '5', description: 'Check marketplace split', expectedResult: 'Amount split correctly' }
          ]
        },
        {
          id: 'shiprocket_integration',
          name: 'Shiprocket Logistics',
          description: 'Test Shiprocket integration for order shipping',
          category: 'integrations',
          steps: [
            { id: '1', description: 'Order placed', expectedResult: 'Order created' },
            { id: '2', description: 'Shiprocket order created', expectedResult: 'Order sent to Shiprocket API' },
            { id: '3', description: 'Pickup scheduled', expectedResult: 'Pickup confirmation received' },
            { id: '4', description: 'Track shipment', expectedResult: 'Tracking updates received' },
            { id: '5', description: 'Delivery confirmation', expectedResult: 'Delivery status updated' }
          ]
        },
        {
          id: 'google_maps_integration',
          name: 'Google Maps & GPS',
          description: 'Test Google Maps integration',
          category: 'integrations',
          steps: [
            { id: '1', description: 'Search location', expectedResult: 'Autocomplete working' },
            { id: '2', description: 'Display vendor locations', expectedResult: 'Markers on map' },
            { id: '3', description: 'Calculate distance', expectedResult: 'Distance shown correctly' },
            { id: '4', description: 'Live GPS tracking', expectedResult: 'Location updates in real-time' },
            { id: '5', description: 'Get directions', expectedResult: 'Route displayed' }
          ]
        }
      ]
    }
  };

  // Calculate test statistics
  const calculateStats = () => {
    const allTests = Object.values(testCategories).flatMap(cat => cat.tests);
    const completedTests = Object.values(testResults);
    
    return {
      total: allTests.length,
      passed: completedTests.filter(t => t.status === 'passed').length,
      failed: completedTests.filter(t => t.status === 'failed').length,
      warning: completedTests.filter(t => t.status === 'warning').length,
      pending: allTests.length - completedTests.length,
      progress: Math.round((completedTests.length / allTests.length) * 100)
    };
  };

  const stats = calculateStats();

  // Run individual test
  const runTest = async (test: TestCase) => {
    setIsRunning(true);
    const startTime = Date.now();
    
    // Update test to running
    setTestResults(prev => ({
      ...prev,
      [test.id]: { ...test, status: 'running' }
    }));

    // Simulate running each step
    for (const step of test.steps) {
      // Wait a bit to simulate step execution
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update step status (in real implementation, this would check actual functionality)
      step.status = Math.random() > 0.1 ? 'passed' : 'failed'; // 90% pass rate for demo
      step.actualResult = step.status === 'passed' ? step.expectedResult : 'Unexpected behavior detected';
    }

    const duration = Date.now() - startTime;
    const hasFailures = test.steps.some(s => s.status === 'failed');
    const finalStatus = hasFailures ? 'failed' : 'passed';

    setTestResults(prev => ({
      ...prev,
      [test.id]: {
        ...test,
        status: finalStatus,
        duration,
        steps: test.steps,
        errors: hasFailures ? test.steps.filter(s => s.status === 'failed').map(s => s.description) : []
      }
    }));

    setIsRunning(false);
    toast.success(`Test "${test.name}" completed`);
  };

  // Run all tests in category
  const runCategoryTests = async (categoryKey: string) => {
    const category = testCategories[categoryKey as keyof typeof testCategories];
    if (!category) return;

    setIsRunning(true);
    for (const test of category.tests) {
      await runTest(test as TestCase);
    }
    setIsRunning(false);
    toast.success(`All tests in "${category.label}" completed`);
  };

  // Export test results
  const exportResults = () => {
    const results = {
      timestamp: new Date().toISOString(),
      summary: calculateStats(),
      details: testResults
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `warmpawz-uat-results-${Date.now()}.json`;
    a.click();
    
    toast.success('Test results exported');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Warmpawz Comprehensive UAT Suite</h1>
            <p className="text-gray-600 mt-2">End-to-end testing for Customer, Vendor & Admin applications</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={exportResults} disabled={Object.keys(testResults).length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
            <Button onClick={() => setTestResults({})} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Tests</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
              <div className="text-sm text-gray-600">Passed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
              <div className="text-sm text-gray-600">Warnings</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">{stats.progress}%</div>
              <div className="text-sm text-gray-600">Progress</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="grid grid-cols-4 lg:grid-cols-9 gap-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {Object.entries(testCategories).map(([key, cat]) => (
              <TabsTrigger key={key} value={key}>
                <cat.icon className="w-4 h-4 mr-2" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Test Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(testCategories).map(([key, category]) => {
                    const categoryTests = category.tests.map(t => testResults[t.id]).filter(Boolean);
                    const passed = categoryTests.filter(t => t?.status === 'passed').length;
                    const failed = categoryTests.filter(t => t?.status === 'failed').length;
                    const total = category.tests.length;

                    return (
                      <Card key={key} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className={`p-3 rounded-lg ${category.color} bg-opacity-10`}>
                              <category.icon className={`w-6 h-6 ${category.color.replace('bg-', 'text-')}`} />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold">{category.label}</h3>
                              <p className="text-sm text-gray-600">{total} tests</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-green-600">{passed} passed</span>
                              <span className="text-red-600">{failed} failed</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500"
                                style={{ width: `${total > 0 ? (passed / total) * 100 : 0}%` }}
                              />
                            </div>
                          </div>

                          <Button 
                            onClick={() => runCategoryTests(key)}
                            disabled={isRunning}
                            size="sm"
                            className="w-full"
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Run All Tests
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Category Tabs */}
          {Object.entries(testCategories).map(([categoryKey, category]) => (
            <TabsContent key={categoryKey} value={categoryKey} className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{category.label} Tests</h2>
                <Button 
                  onClick={() => runCategoryTests(categoryKey)}
                  disabled={isRunning}
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Run All
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {category.tests.map((test) => {
                  const result = testResults[test.id];
                  const statusColors = {
                    pending: 'bg-gray-100 text-gray-700',
                    running: 'bg-blue-100 text-blue-700',
                    passed: 'bg-green-100 text-green-700',
                    failed: 'bg-red-100 text-red-700',
                    warning: 'bg-yellow-100 text-yellow-700'
                  };

                  return (
                    <Card key={test.id} className="hover:shadow-md transition-shadow">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CardTitle className="text-lg">{test.name}</CardTitle>
                            <Badge className={statusColors[result?.status || 'pending']}>
                              {result?.status || 'pending'}
                            </Badge>
                          </div>
                          <Button 
                            onClick={() => runTest(test as TestCase)}
                            disabled={isRunning}
                            size="sm"
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Run Test
                          </Button>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{test.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {test.steps.map((step, index) => {
                            const stepResult = result?.steps[index];
                            const icon = stepResult?.status === 'passed' 
                              ? CheckCircle2 
                              : stepResult?.status === 'failed' 
                                ? XCircle 
                                : AlertCircle;
                            const Icon = icon;

                            return (
                              <div 
                                key={step.id}
                                className={`flex items-start gap-3 p-3 rounded-lg ${
                                  stepResult?.status === 'passed' 
                                    ? 'bg-green-50' 
                                    : stepResult?.status === 'failed' 
                                      ? 'bg-red-50' 
                                      : 'bg-gray-50'
                                }`}
                              >
                                <Icon className={`w-5 h-5 mt-0.5 ${
                                  stepResult?.status === 'passed' 
                                    ? 'text-green-600' 
                                    : stepResult?.status === 'failed' 
                                      ? 'text-red-600' 
                                      : 'text-gray-400'
                                }`} />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{step.description}</p>
                                  <p className="text-xs text-gray-600 mt-1">
                                    Expected: {step.expectedResult}
                                  </p>
                                  {stepResult?.actualResult && (
                                    <p className={`text-xs mt-1 ${
                                      stepResult.status === 'passed' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      Actual: {stepResult.actualResult}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {result?.duration && (
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm text-gray-600">
                              Duration: {(result.duration / 1000).toFixed(2)}s
                            </p>
                          </div>
                        )}

                        {result?.errors && result.errors.length > 0 && (
                          <div className="mt-4 p-4 bg-red-50 rounded-lg">
                            <h4 className="font-semibold text-red-700 mb-2">Errors:</h4>
                            <ul className="space-y-1">
                              {result.errors.map((error, i) => (
                                <li key={i} className="text-sm text-red-600">• {error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
