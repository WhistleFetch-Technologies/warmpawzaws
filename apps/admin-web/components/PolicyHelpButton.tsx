'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
} from '@warmpawz/ui';
import {
  getPolicyDoc,
  type PolicyDocKey,
} from '@/lib/policy-docs-content';

export interface PolicyHelpButtonProps {
  /** Doc key from policy-docs-content (e.g. finance-payment-policies) */
  docKey: PolicyDocKey;
  /** Optional label; default "Help" */
  label?: string;
  /** Optional class for the trigger button */
  className?: string;
  /** Optional variant: 'icon' (default) or 'link' */
  variant?: 'icon' | 'link';
}

/**
 * Renders a Help button that opens a dialog with the policy documentation
 * for the given docKey. Used in Finance and Logistics policy UIs.
 */
export function PolicyHelpButton({
  docKey,
  label = 'Help',
  className = '',
  variant = 'icon',
}: PolicyHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const doc = getPolicyDoc(docKey);

  if (!doc) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={`text-gray-500 hover:text-[#FF8C42] ${className}`}
        aria-label={`Open documentation: ${doc.title}`}
      >
        {variant === 'icon' ? (
          <HelpCircle className="w-5 h-5" />
        ) : (
          <>
            <HelpCircle className="w-4 h-4 mr-1.5" />
            {label}
          </>
        )}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-gray-200 shrink-0">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              {doc.title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="prose prose-sm max-w-none">
              <PolicyDocMarkdown content={doc.markdown} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Renders markdown-like content as simple HTML-like structure:
 * # and ## as headings, --- as hr, tables as pre, lists and paragraphs.
 * Keeps dependencies zero; for full markdown consider adding react-markdown.
 */
function PolicyDocMarkdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1 key={key++} className="text-xl font-bold text-gray-900 mt-6 mb-2 first:mt-0">
          {trimmed.slice(2)}
        </h1>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={key++} className="text-lg font-semibold text-gray-800 mt-4 mb-2">
          {trimmed.slice(3)}
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed === '---') {
      blocks.push(<hr key={key++} className="my-4 border-gray-200" />);
      i++;
      continue;
    }
    if (trimmed.startsWith('| ') && trimmed.endsWith(' |')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <pre className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap font-sans">
            {tableLines.join('\n')}
          </pre>
        </div>
      );
      continue;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc list-inside my-2 space-y-1 text-gray-700 text-sm">
          {listItems.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (trimmed.startsWith('   - ') || trimmed.match(/^\d+\./)) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().match(/^\d+\./) || (lines[i].trim() === '' && listItems.length > 0 && i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')))) {
        if (lines[i].trim()) listItems.push(lines[i].trim().replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc list-inside my-2 space-y-1 text-gray-700 text-sm ml-2">
          {listItems.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
      continue;
    }
    if (trimmed === '') {
      i++;
      continue;
    }
    // Paragraph: collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (t === '' || t.startsWith('#') || t === '---' || t.startsWith('| ') || t.startsWith('- ') || t.startsWith('* ')) break;
      paraLines.push(t);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={key++} className="my-2 text-gray-700 text-sm leading-relaxed">
          {paraLines.join(' ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1')}
        </p>
      );
    }
  }

  return <div className="space-y-0">{blocks}</div>;
}
