export type BloodTypeOption = {
  key: string;
  label: string;
  group: string;
  description: string;
  species: 'Dog' | 'Cat';
  fullWidth?: boolean;
};

const BLOOD_TYPE_OPTIONS: BloodTypeOption[] = [
  {
    key: 'dog:dea1_positive',
    label: 'DEA 1 Positive',
    group: 'DEA System',
    description:
      'Most critical canine blood type. Important for transfusion compatibility — mismatches can cause serious reactions.',
    species: 'Dog',
  },
  {
    key: 'dog:dea1_negative',
    label: 'DEA 1 Negative',
    group: 'DEA System',
    description:
      'Most critical canine blood type. DEA 1-negative dogs are universal donors for red blood cell transfusions.',
    species: 'Dog',
  },
  {
    key: 'dog:dea3',
    label: 'DEA 3',
    group: 'DEA System',
    description:
      'Less common DEA type. Can cause delayed red blood cell breakdown if mismatched during transfusion.',
    species: 'Dog',
  },
  {
    key: 'dog:dea4',
    label: 'DEA 4',
    group: 'DEA System',
    description: 'Present in most dogs. Dogs with only DEA 4 are excellent universal donors.',
    species: 'Dog',
  },
  {
    key: 'dog:dea5',
    label: 'DEA 5',
    group: 'DEA System',
    description:
      'Less common DEA type. Can cause delayed red blood cell breakdown if mismatched during transfusion.',
    species: 'Dog',
  },
  {
    key: 'dog:dea6',
    label: 'DEA 6',
    group: 'DEA System',
    description: 'Standard recognized DEA group. Rarely tested in routine veterinary practice.',
    species: 'Dog',
  },
  {
    key: 'dog:dea7',
    label: 'DEA 7',
    group: 'DEA System',
    description:
      'Less common DEA type. Can cause delayed red blood cell breakdown if mismatched during transfusion.',
    species: 'Dog',
  },
  {
    key: 'dog:dea8',
    label: 'DEA 8',
    group: 'DEA System',
    description: 'Standard recognized DEA group. Rarely tested in routine veterinary practice.',
    species: 'Dog',
  },
  {
    key: 'dog:dal',
    label: 'Dal',
    group: 'Other Antigens',
    description: 'Newer independent antigen. Dal-negative is common in Dalmatians.',
    species: 'Dog',
  },
  {
    key: 'dog:kai1',
    label: 'Kai 1',
    group: 'Other Antigens',
    description: 'Newer independent antigen. May be relevant for specialized transfusion matching.',
    species: 'Dog',
  },
  {
    key: 'dog:kai2',
    label: 'Kai 2',
    group: 'Other Antigens',
    description: 'Newer independent antigen. May be relevant for specialized transfusion matching.',
    species: 'Dog',
  },
  {
    key: 'dog:unknown',
    label: 'Unknown / Not tested',
    group: 'Unknown',
    description:
      'Blood type has not been tested or is not known. Your vet can confirm through a blood typing test.',
    species: 'Dog',
    fullWidth: true,
  },
  {
    key: 'cat:type_a',
    label: 'Type A',
    group: 'AB System',
    description: 'Most common type globally (over 75–99% of domestic cats).',
    species: 'Cat',
  },
  {
    key: 'cat:type_b',
    label: 'Type B',
    group: 'AB System',
    description:
      'Common in certain pedigree breeds (e.g., British Shorthair, Devon Rex). Type B cats should not receive Type A blood.',
    species: 'Cat',
  },
  {
    key: 'cat:type_ab',
    label: 'Type AB',
    group: 'AB System',
    description: 'Exceptionally rare. True universal recipient for red blood cells among cats.',
    species: 'Cat',
    fullWidth: true,
  },
  {
    key: 'cat:mik_positive',
    label: 'Mik Positive',
    group: 'Other Antigens',
    description: 'Discovered in 2007. Can cause transfusion issues even when AB blood types match.',
    species: 'Cat',
  },
  {
    key: 'cat:mik_negative',
    label: 'Mik Negative',
    group: 'Other Antigens',
    description: 'Discovered in 2007. Can cause transfusion issues even when AB blood types match.',
    species: 'Cat',
  },
  {
    key: 'cat:fea_other',
    label: 'FEA (Other)',
    group: 'Other Antigens',
    description:
      'Feline Erythrocyte Antigens (FEA 1–5) — newly identified variants. Your vet can advise if testing is needed.',
    species: 'Cat',
    fullWidth: true,
  },
  {
    key: 'cat:unknown',
    label: 'Unknown / Not tested',
    group: 'Unknown',
    description:
      'Blood type has not been tested or is not known. Your vet can confirm through a blood typing test.',
    species: 'Cat',
    fullWidth: true,
  },
];

const BY_KEY = new Map(BLOOD_TYPE_OPTIONS.map((option) => [option.key, option]));

export function getBloodTypeOptions(species: 'Dog' | 'Cat'): BloodTypeOption[] {
  return BLOOD_TYPE_OPTIONS.filter((option) => option.species === species);
}

export function getBloodTypeLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

export function getBloodTypeDescription(key: string): string {
  return BY_KEY.get(key)?.description ?? '';
}

export function isBloodTypeKeyForSpecies(key: string, species: 'Dog' | 'Cat'): boolean {
  const prefix = species === 'Dog' ? 'dog:' : 'cat:';
  return key.startsWith(prefix);
}

export function normalizeBloodTypeKey(key: unknown, species?: 'Dog' | 'Cat'): string | undefined {
  if (key == null || key === '') return undefined;
  const normalized = String(key).trim();
  if (!BY_KEY.has(normalized)) return undefined;
  if (species && !isBloodTypeKeyForSpecies(normalized, species)) return undefined;
  return normalized;
}

export function getAllValidBloodTypeKeys(): string[] {
  return BLOOD_TYPE_OPTIONS.map((option) => option.key);
}
