'use client';

import { Button } from '@warmpawz/ui';
import { Trash2, Upload, Download } from 'lucide-react';

export interface BulkToolbarProps {
  readonly selectedCount: number;
  readonly disabled?: boolean;
  readonly onPublish: () => void;
  readonly onUnpublish: () => void;
  readonly onDelete: () => void;
  readonly onClear: () => void;
}

export function BulkToolbar({
  selectedCount,
  disabled = false,
  onPublish,
  onUnpublish,
  onDelete,
  onClear,
}: BulkToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
      <span className="text-sm font-medium text-gray-800">
        {selectedCount} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={onPublish}>
          <Upload className="mr-1 h-4 w-4" />
          Bulk Publish
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onUnpublish}>
          <Download className="mr-1 h-4 w-4" />
          Bulk Unpublish
        </Button>
        <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={onDelete}>
          <Trash2 className="mr-1 h-4 w-4" />
          Bulk Delete
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
