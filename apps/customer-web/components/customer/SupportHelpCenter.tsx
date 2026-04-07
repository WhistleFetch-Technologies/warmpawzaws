"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, HelpCircle, MessageCircle, Phone, Mail, FileText, ChevronRight, Send, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileAccountScreenHeader } from '@/components/customer/shared/ProfileAccountScreenHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { getSupportPhoneLabel, getSupportTelHref, SUPPORT_INITIAL_TAB_KEY } from '@/lib/support-contact';

/** Min ~44px top when env(safe-area-inset-top) is 0 (many Android WebViews); same pattern as AddressBookPage. */
const SUPPORT_HELP_HEADER_BAR =
  'bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] text-white isolate pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(2.75rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-4 rounded-b-2xl shadow-md';

interface Ticket {
  id: string;
  ticket_number?: string;
  subject: string;
  message?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: string;
  category?: string;
  created_at: string;
}

interface SupportHelpCenterProps {
  phone?: string;
  onBack: () => void;
  onCloseToHome?: () => void;
  initialTab?: 'faq' | 'contact' | 'tickets';
}

export function SupportHelpCenter({ phone, onBack, onCloseToHome, initialTab }: SupportHelpCenterProps) {
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'tickets'>('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: '',
    category: 'general'
  });
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Deep-link from home "Live chat" (sessionStorage or prop)
  useEffect(() => {
    if (initialTab === 'faq' || initialTab === 'contact' || initialTab === 'tickets') {
      setActiveTab(initialTab);
      try {
        sessionStorage.removeItem(SUPPORT_INITIAL_TAB_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(SUPPORT_INITIAL_TAB_KEY);
      if (stored === 'contact' || stored === 'tickets' || stored === 'faq') {
        setActiveTab(stored);
      }
      sessionStorage.removeItem(SUPPORT_INITIAL_TAB_KEY);
    } catch {
      /* ignore */
    }
  }, [initialTab]);

  // Load tickets when tab is active with auto-refresh
  useEffect(() => {
    if (activeTab === 'tickets' && phone) {
      loadTickets();
      
      // Auto-refresh tickets every 15 seconds to see agent replies
      const refreshInterval = setInterval(() => {
        loadTickets();
      }, 15000);
      
      return () => clearInterval(refreshInterval);
    }
  }, [activeTab, phone]);

  const loadTickets = async () => {
    if (!phone) return;
    setLoadingTickets(true);
    try {
      const response = await apiClient.get<any>(`/support/tickets?customerPhone=${encodeURIComponent(phone)}`);
      if (response.success) {
        setTickets(response.tickets || []);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-100 text-yellow-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'resolved': return 'bg-green-100 text-green-700';
      case 'closed': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const faqCategories = [
    {
      id: 'booking',
      title: 'Booking & Services',
      icon: FileText,
      questions: [
        { q: 'How do I book a service?', a: 'Navigate to the service you need, select a vendor, choose a date and time, and complete the booking. You can track your booking in the "My Bookings" section.' },
        { q: 'Can I cancel or reschedule a booking?', a: 'Yes, you can cancel or reschedule bookings from the "My Bookings" section. Cancellation policies may vary by service type.' },
        { q: 'What payment methods are accepted?', a: 'We accept credit/debit cards, UPI, net banking, and wallet payments through Razorpay.' }
      ]
    },
    {
      id: 'orders',
      title: 'Orders & Products',
      icon: FileText,
      questions: [
        { q: 'How do I track my order?', a: 'Go to "My Orders" and click on your order to see real-time tracking information and delivery status.' },
        { q: 'What is the return policy?', a: 'Most products can be returned within 7 days of delivery if unopened. Pharmacy items may have different policies.' },
        { q: 'How is GST calculated?', a: 'GST is calculated at 18% on the subtotal of your order, in compliance with Indian tax regulations.' }
      ]
    },
    {
      id: 'account',
      title: 'Account & Payments',
      icon: FileText,
      questions: [
        { q: 'How do I update my profile?', a: 'Go to your profile section and edit your personal information, addresses, and payment methods.' },
        { q: 'How do I add a pet?', a: 'Navigate to "Pet Profile" and click "Add Pet" to register your pet\'s information and medical records.' },
        { q: 'What are loyalty points?', a: 'Loyalty points are earned on bookings and purchases. You can redeem them for discounts on future services.' }
      ]
    },
    {
      id: 'technical',
      title: 'Technical Support',
      icon: FileText,
      questions: [
        { q: 'The app is not loading properly', a: 'Try clearing your browser cache, checking your internet connection, or updating to the latest version of the app.' },
        { q: 'I forgot my password', a: 'Use the "Forgot Password" option on the login screen. You will receive an OTP to reset your password.' },
        { q: 'Payment failed but money was deducted', a: 'Contact support immediately. In most cases, the money is automatically refunded within 5-7 business days.' }
      ]
    }
  ];

  const filteredFAQs = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  const handleSubmitContact = async () => {
    if (!contactForm.subject.trim() || !contactForm.message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      const response = await apiClient.post<any>('/support/tickets', {
        subject: contactForm.subject,
        message: contactForm.message,
        category: contactForm.category,
        customerPhone: phone,
        source: 'customer',
        priority: 'medium',
      });

      if (response.success || response.ticketId) {
        toast.success('Support ticket created successfully! We will get back to you soon.');
        setContactForm({ subject: '', message: '', category: 'general' });
        setShowContactForm(false);
        setActiveTab('tickets');
      }
    } catch (error: any) {
      console.error('Error creating support ticket:', error);
      toast.error(error.message || 'Failed to create support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Single sticky chrome: header + tabs share one stack so tab offset never uses a magic pixel height. */}
      <div className="sticky top-0 z-50 isolate">
        {onCloseToHome ? (
          <ProfileAccountScreenHeader
            onCloseToHome={onCloseToHome}
            onBack={onBack}
            title="Help & Support"
            subtitle="We're here to help"
          />
        ) : (
          <div className={SUPPORT_HELP_HEADER_BAR}>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="touch-manipulation rounded-full text-white hover:bg-white/20"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold">Help & Support</h1>
                <p className="text-white/90 text-sm">We're here to help</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab('faq')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'faq'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contact'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tickets')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tickets'
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              My Tickets
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {activeTab === 'faq' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* FAQ Categories */}
            {filteredFAQs.length === 0 ? (
              <Card className="p-8 text-center">
                <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No FAQs found</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredFAQs.map((category) => (
                  <Card key={category.id} className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-[#FF8C42]/10 rounded-lg flex items-center justify-center">
                        <category.icon className="w-5 h-5 text-[#FF8C42]" />
                      </div>
                      <h3 className="font-semibold text-gray-900">{category.title}</h3>
                    </div>
                    <div className="space-y-4">
                      {category.questions.map((faq, idx) => (
                        <div key={idx} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                          <h4 className="font-medium text-gray-900 mb-2">{faq.q}</h4>
                          <p className="text-sm text-gray-600">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'contact' && (
          <>
            {!showContactForm ? (
              <>
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Contact Us</h3>
                  <div className="space-y-3">
                    <a
                      href={getSupportTelHref()}
                      className="flex items-center gap-3 rounded-lg p-1 -m-1 hover:bg-blue-100/60 transition-colors"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Phone className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Phone</p>
                        <p className="text-sm text-blue-700 font-medium">{getSupportPhoneLabel()}</p>
                      </div>
                    </a>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <p className="text-sm text-gray-600">support@warmpawz.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Live Chat</p>
                        <p className="text-sm text-gray-600">Available 24/7</p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Button
                  onClick={() => setShowContactForm(true)}
                  className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
                >
                  Create Support Ticket
                </Button>
              </>
            ) : (
              <Card className="p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Create Support Ticket</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={contactForm.category}
                      onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42]"
                    >
                      <option value="general">General Inquiry</option>
                      <option value="booking">Booking Issue</option>
                      <option value="order">Order Issue</option>
                      <option value="payment">Payment Issue</option>
                      <option value="technical">Technical Support</option>
                      <option value="refund">Refund Request</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                    <Input
                      type="text"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                      placeholder="Brief description of your issue"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                    <Textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      rows={6}
                      placeholder="Please provide detailed information about your issue..."
                      className="resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowContactForm(false);
                        setContactForm({ subject: '', message: '', category: 'general' });
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitContact}
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
                    >
                      {submitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* Refresh and Create buttons */}
            <div className="flex gap-2">
              <Button
                onClick={loadTickets}
                variant="outline"
                size="sm"
                disabled={loadingTickets}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loadingTickets ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => {
                  setActiveTab('contact');
                  setShowContactForm(true);
                }}
                size="sm"
                className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
              >
                Create New Ticket
              </Button>
            </div>

            {/* Loading state */}
            {loadingTickets && (
              <Card className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-gray-500">Loading your tickets...</p>
              </Card>
            )}

            {/* Empty state */}
            {!loadingTickets && tickets.length === 0 && (
              <Card className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">No support tickets yet</p>
                <p className="text-sm text-gray-400">Create a ticket if you need help</p>
              </Card>
            )}

            {/* Tickets list */}
            {!loadingTickets && tickets.length > 0 && (
              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {getStatusIcon(ticket.status)}
                            {ticket.status.replace('_', ' ')}
                          </span>
                          {ticket.ticket_number && (
                            <span className="text-xs text-gray-400">{ticket.ticket_number}</span>
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 truncate">{ticket.subject}</h4>
                        {ticket.message && (
                          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{ticket.message}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                          {ticket.category && (
                            <span className="capitalize">{ticket.category}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

