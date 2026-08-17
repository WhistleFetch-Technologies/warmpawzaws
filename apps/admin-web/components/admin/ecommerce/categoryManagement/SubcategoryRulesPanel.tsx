'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Eye, Save } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

type RulesState = {
  include_keywords: string[];
  exclude_keywords: string[];
  brand_includes: string[];
  is_active: boolean;
};

function listToText(arr: string[]): string {
  return (arr || []).join('\n');
}

function textToList(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SubcategoryRulesPanel({
  subcategoryId,
  subcategoryName,
}: {
  subcategoryId: string;
  subcategoryName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [includeText, setIncludeText] = useState('');
  const [excludeText, setExcludeText] = useState('');
  const [brandText, setBrandText] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSamples, setPreviewSamples] = useState<{ id: string; name: string }[]>([]);

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{
        rules?: RulesState | null;
        message?: string;
      }>(`/admin/ecommerce/categories/${subcategoryId}/rules`);
      const rules = res?.rules;
      if (!rules) {
        setIncludeText('');
        setExcludeText('');
        setBrandText('');
        return;
      }
      setIncludeText(listToText(rules.include_keywords || []));
      setExcludeText(listToText(rules.exclude_keywords || []));
      setBrandText(listToText(rules.brand_includes || []));
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to load mapping rules');
    } finally {
      setLoading(false);
    }
  }, [subcategoryId]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const payload = () => ({
    include_keywords: textToList(includeText),
    exclude_keywords: textToList(excludeText),
    brand_includes: textToList(brandText),
    is_active: true,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiClient.put(`/admin/ecommerce/categories/${subcategoryId}/rules`, payload());
      toast.success('Rules saved — use Rebuild mappings to update existing products');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      const res = await apiClient.post<{
        count?: number;
        samples?: { id: string; name: string }[];
      }>(`/admin/ecommerce/categories/${subcategoryId}/rules/preview`, payload());
      setPreviewCount(res?.count ?? 0);
      setPreviewSamples(Array.isArray(res?.samples) ? res.samples : []);
      toast.success(`Preview: ${res?.count ?? 0} matching products`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      const res = await apiClient.post<{
        processed?: number;
        linked?: number;
        message?: string;
      }>(`/admin/ecommerce/categories/${subcategoryId}/rules/rebuild`, {});
      toast.success(
        res?.message ||
          `Rebuilt ${res?.processed ?? 0} products (${res?.linked ?? 0} links)`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-orange-100 bg-orange-50/40 p-4 text-sm text-gray-600">
        Loading mapping rules…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50/30 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Subcategory mapping rules</h4>
        <p className="text-xs text-gray-600 mt-1">
          Keywords for <span className="font-medium">{subcategoryName}</span>. Products under the
          parent category are auto-tagged on create/update. Saving rules does not reclassify
          existing products until you click Rebuild mappings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Include keywords</label>
          <textarea
            value={includeText}
            onChange={(e) => setIncludeText(e.target.value)}
            rows={6}
            placeholder={'urinary\nrenal\nkibble'}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Exclude keywords</label>
          <textarea
            value={excludeText}
            onChange={(e) => setExcludeText(e.target.value)}
            rows={6}
            placeholder={'cat litter\ntoy'}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Brand includes</label>
          <textarea
            value={brandText}
            onChange={(e) => setBrandText(e.target.value)}
            rows={6}
            placeholder={"Hill's"}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handlePreview()}
          disabled={previewing}
          className="gap-1"
        >
          <Eye className="w-4 h-4" />
          {previewing ? 'Previewing…' : 'Preview matches'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          className="gap-1 bg-[#FF8C42] hover:bg-[#e67a35] text-white"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save rules'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleRebuild()}
          disabled={rebuilding}
          className="gap-1"
        >
          <RefreshCw className={`w-4 h-4 ${rebuilding ? 'animate-spin' : ''}`} />
          {rebuilding ? 'Rebuilding…' : 'Rebuild mappings'}
        </Button>
      </div>

      {previewCount != null && (
        <div className="text-xs text-gray-700 bg-white/80 rounded-lg border border-gray-200 p-3">
          <p className="font-medium">{previewCount} products would match</p>
          {previewSamples.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {previewSamples.map((s) => (
                <li key={s.id} className="truncate">
                  {s.name || s.id}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
