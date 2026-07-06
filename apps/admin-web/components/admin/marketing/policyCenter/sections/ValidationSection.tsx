'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@warmpawz/ui';
import { ShieldCheck } from 'lucide-react';
import { validatePolicy } from '@/lib/discount-policy/discount-policy-api';
import type { DiscountPolicyBundle, ValidationResult } from '@/lib/discount-policy/types';

function FindingList({
  title,
  items,
  variant,
}: {
  title: string;
  items: ValidationResult['findings'];
  variant: 'error' | 'warning' | 'suggestion';
}) {
  if (!items.length) return null;
  const colors =
    variant === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : variant === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <div className={`rounded-lg border p-4 ${colors}`}>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm">
        {items.map((f, i) => (
          <li key={`${f.ruleId}-${i}`}>
            {f.message}
            {f.suggestion ? <p className="mt-0.5 text-xs opacity-80">Suggestion: {f.suggestion}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ValidationSection({ draft }: { draft: DiscountPolicyBundle }) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [usedLocal, setUsedLocal] = useState(false);

  const runValidate = async () => {
    setLoading(true);
    try {
      const res = await validatePolicy(draft);
      setResult(res);
      setUsedLocal(res?.validatedFingerprint?.startsWith('local-') ?? false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Policy validation</CardTitle>
          <CardDescription>
            Verifies business rules consistency: winning strategy, custom priority order, and offer
            combination matrix. Uses backend Policy Validation Engine when available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" onClick={() => void runValidate()} disabled={loading}>
            <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden />
            {loading ? 'Validating…' : 'Validate draft'}
          </Button>

          {usedLocal ? (
            <p className="text-xs text-slate-500">
              Validated locally — backend API will add engine-level checks when Phase 8 endpoints ship.
            </p>
          ) : null}

          {result ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={result.isPublishable ? 'default' : 'destructive'}>
                  {result.isPublishable ? 'Publishable' : 'Blocking issues'}
                </Badge>
                {result.validatedFingerprint ? (
                  <code className="text-xs text-slate-600">fp: {result.validatedFingerprint}</code>
                ) : null}
              </div>
              <FindingList title="Errors" items={result.errors} variant="error" />
              <FindingList title="Warnings" items={result.warnings} variant="warning" />
              <FindingList title="Suggestions" items={result.suggestions} variant="suggestion" />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
