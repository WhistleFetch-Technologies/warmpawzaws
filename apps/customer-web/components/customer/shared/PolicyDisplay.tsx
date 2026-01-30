'use client';

/**
 * ============================================================================
 * POLICY DISPLAY COMPONENT
 * ============================================================================
 * 
 * Displays configurable policies for:
 * - Cancellation Policy
 * - Refund Policy
 * - Delivery Policy
 * - Tax Information
 * 
 * Policies are fetched from the admin-configured settings or use defaults.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { 
  Info, ChevronDown, ChevronUp, AlertCircle, 
  FileText, CreditCard, Truck, RotateCcw, Clock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { apiClient } from '@/lib/api-client';

export type PolicyType = 'cancellation' | 'refund' | 'delivery' | 'tax' | 'rescheduling' | 'payment';

interface PolicySection {
  type: PolicyType;
  title: string;
  icon: React.ElementType;
  content: string;
  details?: string[];
  expandable?: boolean;
}

interface PolicyDisplayProps {
  serviceType: 'pharmacy' | 'nutrition' | 'booking' | 'ecommerce';
  showPolicies?: PolicyType[];
  compact?: boolean;
  className?: string;
  showTermsCheckbox?: boolean;
  termsAccepted?: boolean;
  onTermsChange?: (accepted: boolean) => void;
}

// Default policies - these can be overridden by admin configuration
const DEFAULT_POLICIES: Record<PolicyType, PolicySection> = {
  cancellation: {
    type: 'cancellation',
    title: 'Cancellation Policy',
    icon: RotateCcw,
    content: 'Free cancellation up to 2 hours before scheduled time.',
    details: [
      'Full refund if cancelled 2+ hours before appointment',
      '50% refund if cancelled 1-2 hours before',
      'No refund if cancelled less than 1 hour before',
      'For home delivery: Free cancellation before order is dispatched'
    ],
    expandable: true
  },
  refund: {
    type: 'refund',
    title: 'Refund Policy',
    icon: CreditCard,
    content: 'Refunds are processed within 5-7 business days.',
    details: [
      'Refunds are credited to the original payment method',
      'Wallet credits are refunded instantly',
      'Bank transfers may take 5-7 business days',
      'For damaged/wrong items: Full refund + replacement'
    ],
    expandable: true
  },
  delivery: {
    type: 'delivery',
    title: 'Delivery Policy',
    icon: Truck,
    content: 'Free delivery on orders above ₹499.',
    details: [
      'Standard delivery: 2-4 hours for local orders',
      'Express delivery available at additional cost',
      'Delivery charges: ₹40 for orders under ₹499',
      'Contactless delivery available on request'
    ],
    expandable: true
  },
  tax: {
    type: 'tax',
    title: 'Tax Information',
    icon: FileText,
    content: 'All prices include applicable GST.',
    details: [
      'GST is calculated as per government regulations',
      'CGST + SGST for intra-state orders',
      'IGST for inter-state orders',
      'Tax invoice available after order confirmation'
    ],
    expandable: false
  },
  rescheduling: {
    type: 'rescheduling',
    title: 'Rescheduling Policy',
    icon: Clock,
    content: 'Free rescheduling up to 4 hours before the appointment.',
    details: [
      'First rescheduling is always free',
      'Subsequent rescheduling may incur a ₹50 fee',
      'Rescheduling is subject to provider availability',
      'Maximum 2 reschedules per booking allowed'
    ],
    expandable: true
  },
  payment: {
    type: 'payment',
    title: 'Payment Information',
    icon: CreditCard,
    content: 'Secure payments via UPI, Cards, Net Banking & Wallet.',
    details: [
      'All major credit/debit cards accepted',
      'UPI payments via GPay, PhonePe, Paytm',
      'Cash on Delivery available for select services',
      'Warmpawz Wallet for faster checkout'
    ],
    expandable: false
  }
};

// Service-specific policy mappings
const SERVICE_POLICY_DEFAULTS: Record<string, PolicyType[]> = {
  pharmacy: ['delivery', 'cancellation', 'refund', 'tax'],
  nutrition: ['delivery', 'cancellation', 'refund', 'tax'],
  booking: ['cancellation', 'rescheduling', 'refund', 'payment'],
  ecommerce: ['delivery', 'cancellation', 'refund', 'tax']
};

export function PolicyDisplay({ 
  serviceType, 
  showPolicies,
  compact = false,
  className = '',
  showTermsCheckbox = false,
  termsAccepted = false,
  onTermsChange
}: PolicyDisplayProps) {
  const [policies, setPolicies] = useState<PolicySection[]>([]);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<PolicyType>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPolicies();
  }, [serviceType, showPolicies]);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      
      // Determine which policies to show
      const policyTypes = showPolicies || SERVICE_POLICY_DEFAULTS[serviceType] || ['cancellation', 'refund'];
      
      // Try to fetch configured policies from backend
      let configuredPolicies: Record<string, any> = {};
      try {
        const response = await apiClient.get<any>(`/config/policies?service_type=${serviceType}`);
        if (response?.policies) {
          configuredPolicies = response.policies;
        }
      } catch (error) {
        // Use defaults if API fails
        console.log('[PolicyDisplay] Using default policies');
      }

      // Build policy sections
      const policySections: PolicySection[] = policyTypes.map(type => {
        const defaultPolicy = DEFAULT_POLICIES[type];
        const configuredPolicy = configuredPolicies[type];
        
        return {
          ...defaultPolicy,
          // Override with configured values if available
          content: configuredPolicy?.content || defaultPolicy.content,
          details: configuredPolicy?.details || defaultPolicy.details,
        };
      });

      setPolicies(policySections);
    } catch (error) {
      console.error('Error loading policies:', error);
      // Fallback to defaults
      const policyTypes = showPolicies || SERVICE_POLICY_DEFAULTS[serviceType] || ['cancellation', 'refund'];
      setPolicies(policyTypes.map(type => DEFAULT_POLICIES[type]));
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (type: PolicyType) => {
    setExpandedPolicies(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-20 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
        <Info className="w-3.5 h-3.5" />
        <span>
          {policies.map(p => p.content.split('.')[0]).join(' • ')}
        </span>
      </div>
    );
  }

  return (
    <Card className={`p-4 bg-gray-50 border-gray-200 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-800">Important Policies</h3>
      </div>
      
      <div className="space-y-3">
        {policies.map((policy) => {
          const Icon = policy.icon;
          const isExpanded = expandedPolicies.has(policy.type);
          
          return (
            <div key={policy.type} className="border-b border-gray-200 last:border-b-0 pb-3 last:pb-0">
              <div 
                className={`flex items-start gap-3 ${policy.expandable ? 'cursor-pointer' : ''}`}
                onClick={() => policy.expandable && toggleExpand(policy.type)}
              >
                <Icon className="w-4 h-4 text-[#FF8C42] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-800">{policy.title}</h4>
                    {policy.expandable && (
                      isExpanded ? 
                        <ChevronUp className="w-4 h-4 text-gray-400" /> :
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">{policy.content}</p>
                  
                  {/* Expanded details */}
                  {isExpanded && policy.details && (
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      {policy.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-[#FF8C42] mt-0.5">•</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {showTermsCheckbox ? (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <label 
            htmlFor="terms-checkbox"
            className="flex items-start gap-2 cursor-pointer group"
            onClick={(e) => {
              // Prevent label click from toggling twice
              e.stopPropagation();
            }}
          >
            <Checkbox
              checked={termsAccepted}
              onCheckedChange={(checked) => {
                // Handle boolean or "indeterminate" value from Radix UI
                // Radix UI returns true | false | "indeterminate"
                const isChecked = checked === true;
                if (onTermsChange) {
                  onTermsChange(isChecked);
                }
              }}
              className="mt-0.5 flex-shrink-0"
              id="terms-checkbox"
              aria-label="Accept Terms of Service and Privacy Policy"
              aria-checked={termsAccepted}
            />
            <span className="text-xs text-gray-600 group-hover:text-gray-800 flex-1">
              By proceeding, you agree to our{' '}
              <a href="/terms" target="_blank" className="text-[#FF8C42] hover:underline" onClick={(e) => e.stopPropagation()}>
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" className="text-[#FF8C42] hover:underline" onClick={(e) => e.stopPropagation()}>
                Privacy Policy
              </a>
            </span>
          </label>
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 mt-3 text-center">
          By proceeding, you agree to our Terms of Service and Privacy Policy
        </p>
      )}
    </Card>
  );
}

export default PolicyDisplay;
