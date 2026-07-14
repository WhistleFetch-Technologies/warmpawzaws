'use client';

import { useMemo } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@warmpawz/ui';
import { Copy, Eye, Plus } from 'lucide-react';
import type { CampaignTemplateDefinition } from '@/lib/commercial-campaign/types';

export function CampaignTemplateGrid({
  templates,
  onPreview,
  onDuplicate,
  onCreateFrom,
}: {
  templates: CampaignTemplateDefinition[];
  onPreview: (t: CampaignTemplateDefinition) => void;
  onDuplicate: (t: CampaignTemplateDefinition) => void;
  onCreateFrom: (t: CampaignTemplateDefinition) => void;
}) {
  const sorted = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  );

  if (!sorted.length) {
    return (
      <p className="text-sm text-slate-500">No templates returned from registry.</p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((t) => (
        <Card key={t.id} className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.name}</CardTitle>
            <CardDescription className="font-mono text-xs">{t.id}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto flex flex-wrap gap-2 pt-0">
            <Button type="button" size="sm" variant="outline" onClick={() => onPreview(t)}>
              <Eye className="mr-1 h-3.5 w-3.5" aria-hidden />
              Preview
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(t)}>
              <Copy className="mr-1 h-3.5 w-3.5" aria-hidden />
              Duplicate
            </Button>
            <Button type="button" size="sm" onClick={() => onCreateFrom(t)}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
              Create
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
