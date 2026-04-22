"use client";

import { LucideIcon } from "lucide-react";
import { createElement, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ServiceDashboardHeader, StatCard, StepInfo } from "../shared/ServiceDashboardHeader";

export type PrePaymentLead = {
  icon: LucideIcon;
  /** Tailwind for the rounded icon box (e.g. bg-blue-100 text-blue-600) */
  iconContainerClassName: string;
  title: string;
  subtitle?: string;
  /** Often the price, right-aligned */
  trailing?: ReactNode;
};

export type PrePaymentLineRow = {
  id?: string;
  icon: LucideIcon;
  label: string;
  primary: string;
  secondary?: string;
};

export type PrePaymentNotes = {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  /** If false, the notes field is not rendered. Default true when notes is passed. */
  showNotes?: boolean;
  label?: string;
  rows?: number;
};

export type PrePaymentTotal = {
  label: string;
  /** Pre-formatted amount, e.g. "₹499" or "₹1,200" from caller */
  amountFormatted: string;
};

export type PrePaymentPrimaryButton = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Merged with default w-full; default orange CTA in existing booking flows */
  className?: string;
};

export type PrePaymentBookingReviewProps = {
  /** Header: mirrors ServiceDashboardHeader */
  title: string;
  subtitle?: string;
  headerIcon: LucideIcon;
  /** Three chips by default; pass StatCard[] from the flow */
  stats: StatCard[];
  headerColor?: string;
  headerSteps?: StepInfo[];
  onBack: () => void;
  showBackButton?: boolean;

  /**
   * When set, replaces the default first summary card (lead + rows + notes).
   * Use for multi-service or other unique layouts; keep copy out of the shell.
   */
  summaryBody?: ReactNode;

  /** Service / featured row, then list rows (ignored if summaryBody is set) */
  lead?: PrePaymentLead;
  rows?: PrePaymentLineRow[];

  /** Optional; omit for flows with no note field (ignored if summaryBody is set) */
  notes?: PrePaymentNotes;
  total: PrePaymentTotal;
  /** Total amount color; default matches existing review screens */
  totalTextClassName?: string;
  primaryButton: PrePaymentPrimaryButton;

  /** Extra sections (e.g. boarding range) between summary card and total */
  children?: ReactNode;
  /** After total, before CTA */
  footer?: ReactNode;

  /** If false, main column does not use overflow-y-auto */
  scrollable?: boolean;
  contentClassName?: string;
};

const DEFAULT_CTA = "w-full text-white bg-[#FF8C42] hover:bg-[#FF7A35]";

export function PrePaymentBookingReview({
  title,
  subtitle,
  headerIcon: HeaderIcon,
  stats,
  headerColor = "bg-[#FF8C42]",
  headerSteps,
  onBack,
  showBackButton = true,
  summaryBody,
  lead,
  rows = [],
  notes,
  total,
  totalTextClassName = "text-[#FF8C42]",
  primaryButton,
  children,
  footer,
  scrollable = true,
  contentClassName = "",
}: PrePaymentBookingReviewProps) {
  const showNotesBlock = !summaryBody && notes && (notes.showNotes !== false);
  const notesLabel = notes?.label ?? "Additional Notes (Optional)";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ServiceDashboardHeader
        serviceName={title}
        serviceSubtitle={subtitle}
        serviceIcon={HeaderIcon}
        iconColor="text-white"
        stats={stats}
        steps={headerSteps}
        onBack={onBack}
        showBackButton={showBackButton}
        headerColor={headerColor}
      />
      <div
        className={[
          "max-w-md mx-auto px-4 py-6 w-full min-h-0 flex-1",
          scrollable ? "overflow-y-auto" : "",
          contentClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="space-y-4 -mx-4 cw-header-safe-x cw-header-safe-top sm:-mx-6">
          <div className="bg-white rounded-xl p-4 space-y-0">
            {summaryBody ? (
              <div className="space-y-0">{summaryBody}</div>
            ) : lead ? (
              <>
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${lead.iconContainerClassName}`}
                  >
                    {createElement(lead.icon, { className: "w-6 h-6" })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{lead.title}</h3>
                    {lead.subtitle ? <p className="text-sm text-gray-500">{lead.subtitle}</p> : null}
                  </div>
                  {lead.trailing != null ? (
                    <div className="shrink-0 text-right font-bold text-gray-900">{lead.trailing}</div>
                  ) : null}
                </div>

                {rows.map((row, i) => {
                  const RowIcon = row.icon;
                  const k = row.id ?? `${row.label}-${i}`;
                  return (
                    <div key={k} className="flex items-center gap-3 py-4 border-b">
                      <RowIcon className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-500">{row.label}</p>
                        <p className="font-medium text-gray-900">{row.primary}</p>
                        {row.secondary ? <p className="text-sm text-gray-500">{row.secondary}</p> : null}
                      </div>
                    </div>
                  );
                })}

                {showNotesBlock && notes && (
                  <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{notesLabel}</label>
                    <textarea
                      value={notes.value}
                      onChange={(e) => notes.onChange(e.target.value)}
                      placeholder={notes.placeholder}
                      className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      rows={notes.rows ?? 3}
                    />
                  </div>
                )}
              </>
            ) : null}
          </div>

          {children}

          <div className="bg-white rounded-xl p-4">
            <div className="flex justify-between items-center text-lg">
              <span className="font-bold text-gray-900">{total.label}</span>
              <span className={`font-bold ${totalTextClassName}`}>{total.amountFormatted}</span>
            </div>
          </div>
          {footer}
          <Button
            onClick={primaryButton.onClick}
            className={[DEFAULT_CTA, primaryButton.className].filter(Boolean).join(" ")}
            disabled={primaryButton.disabled}
          >
            {primaryButton.loading ? "Processing..." : primaryButton.label}
          </Button>
        </div>
      </div>
    </div>
  );
}
