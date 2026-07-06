'use client';

import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Badge, Button } from '@warmpawz/ui';
import type { OfferTypeDefinition } from '@/lib/discount-policy/business-rules-types';

export function CustomPriorityOrder({
  order,
  offerTypes,
  onChange,
}: {
  order: string[];
  offerTypes: OfferTypeDefinition[];
  onChange: (next: string[]) => void;
}) {
  const label = (key: string) => offerTypes.find((o) => o.key === key)?.label ?? key;

  const move = (index: number, direction: -1 | 1) => {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(from) || from === dropIndex) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(dropIndex, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        Drag or use arrows to set offer type priority. Higher items win when Custom Priority is
        selected.
      </p>
      <ul className="space-y-2">
        {order.map((key, index) => (
          <li
            key={key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, index)}
            className="flex items-center gap-2 rounded-lg border bg-white p-3 shadow-sm"
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" aria-hidden />
            <Badge variant="outline" className="shrink-0 font-mono">
              {index + 1}
            </Badge>
            <span className="flex-1 text-sm font-medium text-slate-800">{label(key)}</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move ${label(key)} up`}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${label(key)} down`}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
