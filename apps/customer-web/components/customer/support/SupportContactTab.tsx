"use client";

import { Bot, Mail, MessageCircle, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPPORT_EMAIL = "support@warmpawz.com";

interface SupportContactTabProps {
  onStartChat: () => void;
  onGoToTickets: () => void;
  onCreateTicket: () => void;
}

export function SupportContactTab({
  onStartChat,
  onGoToTickets,
  onCreateTicket,
}: SupportContactTabProps) {
  const handleSendEmail = () => {
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Warmpawz%20Support%20Request`;
  };

  return (
    <div className="space-y-4">
      {/* Section 1 — AI Assistant */}
      <div className="rounded-2xl border border-[#FF8C42]/20 bg-[#FFF8F3] p-3 shadow-[0_2px_12px_rgba(255,140,66,0.08)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/90 border border-[#FF8C42]/10 flex items-center justify-center shrink-0 shadow-sm">
            <Bot className="w-7 h-7 text-[#FF8C42]" strokeWidth={1.75} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">
              Chat with our AI Assistant
            </h3>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Get instant answers to most of your questions anytime, 24/7.
            </p>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 sm:min-w-[132px]">
            <Button
              type="button"
              onClick={onStartChat}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white text-sm font-medium gap-2 shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Start Chat
            </Button>
            <div className="flex items-center justify-center sm:justify-end gap-1.5 text-[11px] text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
              Available 24/7
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 — Email */}
      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-3 px-0.5">
          Other ways to reach us
        </h3>
        <div className="rounded-2xl border border-[#F1F5F9] bg-white p-3 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-blue-600" strokeWidth={1.75} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Email Support</p>
              <p className="text-sm text-gray-700 mt-0.5">{SUPPORT_EMAIL}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                We typically respond within 24 hours.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleSendEmail}
              className="shrink-0 h-9 px-4 rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-medium"
            >
              Send Email
            </Button>
          </div>
        </div>
      </div>

      {/* Section 3 — Ticket support */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5 text-blue-600" strokeWidth={1.75} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug">
              General or account help?
            </p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Create a ticket for general questions or account issues. For booking or order refunds,
              use Help on that booking or order.
            </p>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 sm:min-w-[148px]">
            <Button
              type="button"
              onClick={onGoToTickets}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-sm"
            >
              Go to My Tickets
            </Button>
            <button
              type="button"
              onClick={onCreateTicket}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 text-center sm:text-right transition-colors"
            >
              Create New Ticket →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
