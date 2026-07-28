'use client';

import { Button } from '@warmpawz/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationResponse } from '@/lib/warmpawz-appointments-catalogue-admin';

export interface PaginationProps {
  readonly pagination: PaginationResponse;
  readonly onPageChange: (page: number) => void;
  readonly disabled?: boolean;
}

export function Pagination({ pagination, onPageChange, disabled = false }: PaginationProps) {
  const { page, totalPages, total, pageSize } = pagination;
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-gray-600">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-gray-600">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
