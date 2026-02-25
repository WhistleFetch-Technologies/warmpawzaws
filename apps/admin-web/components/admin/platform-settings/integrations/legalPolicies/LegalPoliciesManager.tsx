'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Save, Loader2, AlertCircle, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PolicyContent {
  id: string;
  policyType: string;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

// Default content for policies
const DEFAULT_VENDOR_ONBOARDING_AGREEMENT = `VENDOR ONBOARDING AGREEMENT

This Vendor Onboarding Agreement ("Agreement") is entered into between Warmpawz Platform ("Platform") and the Vendor ("You" or "Vendor").

1. SERVICE STANDARDS
   - The vendor agrees to provide services as per the platform standards and guidelines.
   - All services must meet the quality benchmarks set by the platform.
   - Vendors must maintain professional conduct at all times during service delivery.

2. INFORMATION ACCURACY
   - All information provided during onboarding must be accurate, complete, and verifiable.
   - Any misrepresentation may result in immediate termination of the vendor account.
   - Vendors must update their information promptly if any changes occur.

3. DOCUMENTATION REQUIREMENTS
   - The vendor must complete all required documents and certifications as mandated by applicable laws.
   - Professional licenses and certifications must be kept current and valid.
   - KYC documents must be authentic and belong to the vendor or authorized representative.

4. SERVICE ACTIVATION
   - Services will be activated only after successful verification and admin approval.
   - The platform reserves the right to conduct periodic reviews of vendor credentials.
   - Activation timeline may vary based on verification requirements.

5. COMPLIANCE
   - Vendors must comply with all applicable local, state, and national laws and regulations.
   - Any violation of laws during service delivery will result in immediate suspension.
   - Vendors are responsible for obtaining necessary permits and licenses for their operations.

6. PRICING AND PAYMENTS
   - Vendors agree to the platform's pricing guidelines and commission structure.
   - All payments will be processed through the platform's payment system.
   - Vendors must maintain accurate banking information for settlements.

7. CUSTOMER SERVICE
   - Vendors must respond to customer queries and complaints within the stipulated timeframe.
   - Professional and courteous communication is mandatory.
   - Resolution of disputes must follow the platform's dispute resolution guidelines.

8. CONFIDENTIALITY
   - Vendors must maintain confidentiality of customer information and platform data.
   - Customer data must not be used for purposes other than service delivery.
   - Any breach of confidentiality will result in legal action.

9. TERMINATION
   - Either party may terminate this agreement with 30 days written notice.
   - The platform reserves the right to immediate termination for policy violations.
   - Outstanding payments will be settled within 15 business days of termination.

10. AMENDMENTS
    - The platform reserves the right to amend these terms with prior notice to vendors.
    - Continued use of the platform after amendments constitutes acceptance.

By proceeding with onboarding, you acknowledge that you have read, understood, and agree to be bound by all terms and conditions stated in this Agreement.`;

const DEFAULT_VENDOR_TERMS_OF_SERVICE = `VENDOR TERMS OF SERVICE

These Terms of Service ("Terms") govern your use of the Warmpawz Platform as a service provider.

1. PLATFORM RIGHTS
   - The platform reserves the right to approve or reject vendor applications at its sole discretion.
   - Approval decisions are final and may not be appealed.
   - The platform may request additional documentation at any time.

2. BOOKING VERIFICATION
   - All bookings are subject to customer OTP verification before service commencement.
   - Services must not begin until proper verification is completed.
   - Any service delivered without verification may not be eligible for payment.

3. SERVICE REPORTING
   - Vendors must provide detailed service reports after each booking completion.
   - Reports must include service details, duration, and any observations.
   - Failure to submit reports may delay payment processing.

4. PAYMENT SETTLEMENTS
   - Payment settlements are processed as per the platform's payment policy.
   - Standard settlement cycle is 7 business days from service completion.
   - Disputed payments will be held until resolution.

5. CANCELLATION POLICY
   - Vendors must adhere to the platform's cancellation policy.
   - Repeated cancellations may result in penalties or account suspension.
   - Emergency cancellations must be communicated at least 2 hours before scheduled service.

6. QUALITY STANDARDS
   - Vendors must maintain minimum rating standards as defined by the platform.
   - Consistent low ratings may result in reduced visibility or suspension.
   - Quality audits may be conducted periodically.

7. PLATFORM FEES
   - The platform charges a service fee on all bookings as per the fee structure.
   - Fee structure is subject to change with prior notice.
   - Taxes and other statutory charges are additional.

8. INSURANCE AND LIABILITY
   - Vendors are responsible for maintaining appropriate insurance coverage.
   - The platform is not liable for incidents occurring during service delivery.
   - Vendors must report any incidents immediately.

9. INTELLECTUAL PROPERTY
   - The platform's branding, logos, and content are proprietary.
   - Vendors may not use platform assets without written permission.
   - Content created during service delivery may be used by the platform for promotional purposes.

10. DISPUTE RESOLUTION
    - All disputes must be raised through the platform's grievance system.
    - The platform's decision on disputes will be final and binding.
    - Escalation to legal proceedings requires prior written notice.

11. DATA PROTECTION
    - Vendors must comply with applicable data protection laws.
    - Customer data must be handled securely and deleted after service completion.
    - Data breaches must be reported immediately.

12. ACCOUNT SECURITY
    - Vendors are responsible for maintaining account security.
    - Sharing login credentials is prohibited.
    - Suspicious activities must be reported immediately.

These Terms may be updated from time to time. Continued use of the platform constitutes acceptance of updated Terms.`;

const DEFAULT_CUSTOMER_TERMS_OF_SERVICE = `CUSTOMER TERMS OF SERVICE

These Terms of Service ("Terms") govern your use of the Warmpawz Platform as a customer.

1. PLATFORM USE
   - You must be at least 18 years old to use this platform.
   - You are responsible for maintaining the confidentiality of your account credentials.
   - You agree to provide accurate and complete information when creating an account.

2. BOOKING AND PAYMENTS
   - All bookings are subject to availability and vendor confirmation.
   - Payment must be made through the platform's secure payment gateway.
   - Refunds are processed according to the platform's refund policy.

3. SERVICE DELIVERY
   - Services will be provided by verified vendors on the platform.
   - You must be present or available at the scheduled service time.
   - OTP verification may be required before service commencement.

4. CANCELLATION AND REFUNDS
   - Cancellations must be made according to the platform's cancellation policy.
   - Refund eligibility depends on the timing of cancellation and service type.
   - Platform fees may be non-refundable.

5. RATINGS AND REVIEWS
   - You may rate and review services after completion.
   - Reviews must be honest and based on actual experience.
   - False or malicious reviews may result in account suspension.

6. DISPUTE RESOLUTION
   - Disputes should be raised through the platform's support system.
   - The platform will mediate disputes between customers and vendors.
   - Platform decisions are final and binding.

7. LIABILITY
   - The platform acts as an intermediary between customers and vendors.
   - The platform is not liable for services provided by vendors.
   - Vendors are responsible for their own insurance and liability coverage.

8. INTELLECTUAL PROPERTY
   - All platform content, logos, and branding are proprietary.
   - You may not copy, modify, or distribute platform content without permission.

9. DATA PROTECTION
   - Your personal data is protected according to our Privacy Policy.
   - You have the right to access, modify, or delete your personal data.
   - Data is used only for platform operations and service delivery.

10. ACCOUNT TERMINATION
    - The platform reserves the right to suspend or terminate accounts for violations.
    - You may close your account at any time through account settings.
    - Outstanding obligations must be fulfilled before account closure.

These Terms may be updated from time to time. Continued use of the platform constitutes acceptance of updated Terms.`;

const DEFAULT_PRIVACY_POLICY = `PRIVACY POLICY

This Privacy Policy describes how Warmpawz Platform ("we", "our", or "Platform") collects, uses, and protects your personal information.

1. INFORMATION WE COLLECT
   - Personal information: name, email, phone number, address
   - Payment information: payment methods, billing details (processed securely)
   - Service information: booking history, preferences, pet information
   - Device information: IP address, device type, browser information
   - Location data: for service delivery and matching with nearby vendors

2. HOW WE USE YOUR INFORMATION
   - To provide and improve our services
   - To process bookings and payments
   - To communicate with you about services and updates
   - To match you with appropriate service providers
   - To comply with legal obligations
   - To prevent fraud and ensure platform security

3. INFORMATION SHARING
   - We share necessary information with vendors to complete bookings
   - We may share data with payment processors for transaction processing
   - We do not sell your personal information to third parties
   - We may share data if required by law or to protect platform rights

4. DATA SECURITY
   - We use industry-standard security measures to protect your data
   - Payment information is encrypted and processed securely
   - Access to personal data is restricted to authorized personnel only
   - Regular security audits and updates are performed

5. DATA RETENTION
   - We retain your data as long as your account is active
   - Transaction data is retained as required by law
   - You may request deletion of your data at any time
   - Some data may be retained for legal or business purposes

6. YOUR RIGHTS
   - Right to access your personal data
   - Right to correct inaccurate data
   - Right to delete your data (subject to legal requirements)
   - Right to object to data processing
   - Right to data portability

7. COOKIES AND TRACKING
   - We use cookies to improve user experience
   - Cookies help remember your preferences and login status
   - You can control cookie settings through your browser
   - Some features may not work if cookies are disabled

8. THIRD-PARTY SERVICES
   - We may use third-party services for analytics and payment processing
   - These services have their own privacy policies
   - We are not responsible for third-party privacy practices

9. CHILDREN'S PRIVACY
   - Our platform is not intended for users under 18 years of age
   - We do not knowingly collect data from children
   - If we discover data from children, we will delete it immediately

10. CHANGES TO THIS POLICY
    - We may update this Privacy Policy from time to time
    - Changes will be notified through the platform or email
    - Continued use after changes constitutes acceptance

11. CONTACT US
    - For privacy concerns, contact us through the platform support system
    - We will respond to privacy requests within 30 days

By using our platform, you acknowledge that you have read and understood this Privacy Policy.`;

export function LegalPoliciesManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyContent[]>([]);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [activePolicy, setActivePolicy] = useState<string>('vendor_terms_of_service');
  const [previewMode, setPreviewMode] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/platform-policies');
      
      // ✅ FIX: API returns { policies: [...] } without a 'success' field
      const policiesData = response.policies || response;
      if (policiesData && Array.isArray(policiesData) && policiesData.length > 0) {
        setPolicies(policiesData);
        // Initialize edited content with current values from API
        const contentMap: Record<string, string> = {};
        policiesData.forEach((p: PolicyContent) => {
          contentMap[p.policyType] = p.content;
        });
        setEditedContent(contentMap);
      } else {
        // Initialize with default policies if none exist
        initializeDefaultPolicies();
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      // Initialize with defaults on error
      initializeDefaultPolicies();
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultPolicies = () => {
    const defaultPolicies: PolicyContent[] = [
      {
        id: 'default_vendor_agreement',
        policyType: 'vendor_onboarding_agreement',
        title: 'Vendor Onboarding Agreement',
        content: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
        version: 1,
        isActive: true,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'System',
      },
      {
        id: 'default_vendor_terms',
        policyType: 'vendor_terms_of_service',
        title: 'Vendor Terms of Service',
        content: DEFAULT_VENDOR_TERMS_OF_SERVICE,
        version: 1,
        isActive: true,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'System',
      },
      {
        id: 'default_customer_terms',
        policyType: 'customer_terms_of_service',
        title: 'Customer Terms of Service',
        content: DEFAULT_CUSTOMER_TERMS_OF_SERVICE,
        version: 1,
        isActive: true,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'System',
      },
      {
        id: 'default_privacy',
        policyType: 'privacy_policy',
        title: 'Privacy Policy',
        content: DEFAULT_PRIVACY_POLICY,
        version: 1,
        isActive: true,
        lastUpdatedAt: new Date().toISOString(),
        lastUpdatedBy: 'System',
      },
    ];
    
    setPolicies(defaultPolicies);
    setEditedContent({
      vendor_onboarding_agreement: DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
      vendor_terms_of_service: DEFAULT_VENDOR_TERMS_OF_SERVICE,
      customer_terms_of_service: DEFAULT_CUSTOMER_TERMS_OF_SERVICE,
      privacy_policy: DEFAULT_PRIVACY_POLICY,
    });
  };

  const handleSavePolicy = async (policyType: string) => {
    const content = editedContent[policyType];
    if (!content || content.trim() === '') {
      alert('Policy content cannot be empty');
      return;
    }

    try {
      setSaving(policyType);
      setSaveSuccess(null);
      
      // Map policy types to titles
      const policyTitles: Record<string, string> = {
        'vendor_onboarding_agreement': 'Vendor Onboarding Agreement',
        'vendor_terms_of_service': 'Vendor Terms of Service',
        'customer_terms_of_service': 'Customer Terms of Service',
        'privacy_policy': 'Privacy Policy',
      };

      const response = await apiClient.post<any>('/admin/platform-policies', {
        policyType,
        content: content.trim(),
        title: policyTitles[policyType] || policyType.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      });

      // Check for success indicators: message with "success" or presence of policyId
      if (response.message && (response.message.toLowerCase().includes('success') || response.policyId)) {
        setSaveSuccess(policyType);
        // Refresh policies
        await loadPolicies();
        setTimeout(() => setSaveSuccess(null), 3000);
      } else if (response.success) {
        // Also support success field if present
        setSaveSuccess(policyType);
        await loadPolicies();
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        alert('Failed to save policy: ' + (response.error || response.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error saving policy:', error);
      alert('Failed to save policy: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(null);
    }
  };

  const handleResetToDefault = (policyType: string) => {
    if (!confirm('Are you sure you want to reset to default content? Your custom content will be lost.')) {
      return;
    }

    const defaultContents: Record<string, string> = {
      'vendor_onboarding_agreement': DEFAULT_VENDOR_ONBOARDING_AGREEMENT,
      'vendor_terms_of_service': DEFAULT_VENDOR_TERMS_OF_SERVICE,
      'customer_terms_of_service': DEFAULT_CUSTOMER_TERMS_OF_SERVICE,
      'privacy_policy': DEFAULT_PRIVACY_POLICY,
    };

    const defaultContent = defaultContents[policyType] || '';

    setEditedContent(prev => ({
      ...prev,
      [policyType]: defaultContent,
    }));
  };

  const getCurrentPolicy = () => {
    return policies.find(p => p.policyType === activePolicy);
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const getCharCount = (text: string) => {
    return text.length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="ml-3 text-gray-600">Loading policies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Legal Policies & Agreements</h2>
            <p className="text-sm text-gray-500">
              Manage vendor onboarding agreement and terms of service content. Changes sync automatically with vendor onboarding forms.
            </p>
          </div>
        </div>

        {/* Policy Tabs */}
        <div className="flex gap-2 mt-6 flex-wrap">
          <button
            onClick={() => setActivePolicy('vendor_terms_of_service')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activePolicy === 'vendor_terms_of_service'
                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            Vendor Terms of Service
          </button>
          <button
            onClick={() => setActivePolicy('customer_terms_of_service')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activePolicy === 'customer_terms_of_service'
                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            Customer Terms of Service
          </button>
          <button
            onClick={() => setActivePolicy('privacy_policy')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activePolicy === 'privacy_policy'
                ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-2 border-transparent'
            }`}
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* Policy Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {activePolicy === 'vendor_onboarding_agreement' 
                ? 'Vendor Onboarding Agreement'
                : activePolicy === 'vendor_terms_of_service'
                ? 'Vendor Terms of Service'
                : activePolicy === 'customer_terms_of_service'
                ? 'Customer Terms of Service'
                : activePolicy === 'privacy_policy'
                ? 'Privacy Policy'
                : 'Policy'}
            </h3>
            {getCurrentPolicy() && (
              <p className="text-xs text-gray-500 mt-1">
                Version {getCurrentPolicy()?.version || 1} • Last updated: {
                  getCurrentPolicy()?.lastUpdatedAt 
                    ? new Date(getCurrentPolicy()!.lastUpdatedAt).toLocaleString() 
                    : 'Never'
                }
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                previewMode 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4" />
              {previewMode ? 'Edit' : 'Preview'}
            </button>
            <button
              onClick={() => handleResetToDefault(activePolicy)}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset to Default
            </button>
          </div>
        </div>

        {/* Content Editor / Preview */}
        {previewMode ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 max-h-[600px] overflow-y-auto">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
              {editedContent[activePolicy] || ''}
            </div>
          </div>
        ) : (
          <textarea
            value={editedContent[activePolicy] || ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedContent(prev => ({
              ...prev,
              [activePolicy]: e.target.value,
            }))}
            className="w-full h-[500px] p-4 border border-gray-300 rounded-xl text-sm font-mono text-gray-800 resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="Enter policy content here..."
          />
        )}

        {/* Stats & Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>
              <strong>{getWordCount(editedContent[activePolicy] || '')}</strong> words
            </span>
            <span>
              <strong>{getCharCount(editedContent[activePolicy] || '')}</strong> characters
            </span>
            <span className="text-green-600 text-xs">
              ✓ No word limit
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {saveSuccess === activePolicy && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                Saved successfully!
              </div>
            )}
            <button
              onClick={() => handleSavePolicy(activePolicy)}
              disabled={saving === activePolicy}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 transition-all"
            >
              {saving === activePolicy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save & Publish
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900">How it works</h4>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Changes made here will automatically sync with the vendor onboarding forms.</li>
              <li>• Vendors will see the updated content when they click on "Terms and Conditions" or "Vendor Agreement".</li>
              <li>• There is no word limit - you can add as much content as needed.</li>
              <li>• Use plain text formatting. Content is displayed with preserved line breaks.</li>
              <li>• Each save creates a new version for audit purposes.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
