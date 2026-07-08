'use client';

import { Info } from 'lucide-react';
import {
  getBloodTypeDescription,
  getBloodTypeLabel,
  getBloodTypeOptions,
  type BloodTypeOption,
} from '@/lib/pet-blood-types';

interface BloodTypeSelectorProps {
  species: 'Dog' | 'Cat';
  value?: string;
  onChange: (key: string) => void;
  name?: string;
}

function groupOptions(options: BloodTypeOption[]): { name: string; items: BloodTypeOption[] }[] {
  const groupOrder: string[] = [];
  const byGroup = new Map<string, BloodTypeOption[]>();

  for (const option of options) {
    if (option.group === 'Unknown') continue;
    if (!byGroup.has(option.group)) {
      byGroup.set(option.group, []);
      groupOrder.push(option.group);
    }
    byGroup.get(option.group)!.push(option);
  }

  return groupOrder.map((name) => ({ name, items: byGroup.get(name)! }));
}

function BloodTypeRadioCard({
  option,
  checked,
  inputName,
  onSelect,
}: {
  option: BloodTypeOption;
  checked: boolean;
  inputName: string;
  onSelect: (key: string) => void;
}) {
  const inputId = `${inputName}-${option.key}`;

  return (
    <div className={option.fullWidth ? 'col-span-2' : undefined}>
      <input
        type="radio"
        id={inputId}
        name={inputName}
        value={option.key}
        checked={checked}
        onChange={() => onSelect(option.key)}
        className="sr-only peer"
      />
      <label
        htmlFor={inputId}
        className={`flex min-h-[48px] items-center justify-center py-3 px-4 rounded-xl border-2 font-medium transition cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-orange-400 peer-focus-visible:ring-offset-2 ${
          checked
            ? 'border-orange-500 bg-orange-50 text-orange-700'
            : 'border-gray-200 text-gray-700 hover:border-orange-300'
        }`}
      >
        {option.label}
      </label>
    </div>
  );
}

export function BloodTypeSelector({
  species,
  value = '',
  onChange,
  name = 'bloodType',
}: BloodTypeSelectorProps) {
  const options = getBloodTypeOptions(species);
  const unknownOption = options.find((option) => option.key.endsWith(':unknown'));
  const grouped = groupOptions(options);
  const selectedDescription = value ? getBloodTypeDescription(value) : '';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50/60 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden />
        <p className="text-sm text-orange-800 leading-relaxed">
          Blood type is usually confirmed by your veterinarian through a blood test. Only select a
          type if your veterinarian has confirmed it.
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">Blood type options for {species}</legend>
        <div className="space-y-4">
          {grouped.map((group) => (
            <div key={group.name}>
              <p className="mb-2 text-sm font-medium text-gray-700">{group.name}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.items.map((option) => (
                  <BloodTypeRadioCard
                    key={option.key}
                    option={option}
                    checked={value === option.key}
                    inputName={name}
                    onSelect={onChange}
                  />
                ))}
              </div>
            </div>
          ))}

          {unknownOption && (
            <div className="border-t border-gray-200 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <BloodTypeRadioCard
                  option={unknownOption}
                  checked={value === unknownOption.key}
                  inputName={name}
                  onSelect={onChange}
                />
              </div>
            </div>
          )}
        </div>
      </fieldset>

      {selectedDescription && (
        <div aria-live="polite" className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {getBloodTypeLabel(value)}
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">{selectedDescription}</p>
        </div>
      )}
    </div>
  );
}
