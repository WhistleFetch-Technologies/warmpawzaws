'use client';

/** Matches AddPetModal / CustomerPetProfile health shape */
export type PetHealthRecordsForm = {
  lastCheckup?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
};

export type PetVaccinationsForm = {
  rabies?: string;
  distemper?: string;
  parvovirus?: string;
  other?: string;
};

const defaultHealth: PetHealthRecordsForm = {
  lastCheckup: '',
  allergies: '',
  medications: '',
  conditions: '',
};

const defaultVaccinations: PetVaccinationsForm = {
  rabies: '',
  distemper: '',
  parvovirus: '',
  other: '',
};

export const emptyPetHealthRecords = (): PetHealthRecordsForm => ({ ...defaultHealth });
export const emptyPetVaccinations = (): PetVaccinationsForm => ({ ...defaultVaccinations });

type PetHealthVaccinationFormBodyProps = {
  petName?: string;
  healthRecords: PetHealthRecordsForm;
  vaccinations: PetVaccinationsForm;
  onHealthRecordsChange: (next: PetHealthRecordsForm) => void;
  onVaccinationsChange: (next: PetVaccinationsForm) => void;
  /** Subtitle under page header, e.g. pet name */
  showIntro?: boolean;
  className?: string;
};

const fieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-[#FF8C42] sm:text-sm';

/**
 * Shared health + vaccination fields (from AddPetModal). Use inside scroll areas;
 * parent supplies navigation/footer.
 */
export function PetHealthVaccinationFormBody({
  petName,
  healthRecords,
  vaccinations,
  onHealthRecordsChange,
  onVaccinationsChange,
  showIntro = false,
  className = '',
}: PetHealthVaccinationFormBodyProps) {
  const hr = { ...defaultHealth, ...healthRecords };
  const vac = { ...defaultVaccinations, ...vaccinations };

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {showIntro && petName ? (
        <p className="text-center text-sm text-gray-600">
          Keep track of {petName}&apos;s health (You can skip and add later)
        </p>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Last Checkup Date</label>
        <input
          type="date"
          value={hr.lastCheckup || ''}
          onChange={(e) => onHealthRecordsChange({ ...hr, lastCheckup: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Known Allergies</label>
        <textarea
          value={hr.allergies || ''}
          onChange={(e) => onHealthRecordsChange({ ...hr, allergies: e.target.value })}
          placeholder="e.g., Chicken, Pollen"
          rows={2}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Current Medications</label>
        <textarea
          value={hr.medications || ''}
          onChange={(e) => onHealthRecordsChange({ ...hr, medications: e.target.value })}
          placeholder="e.g., Antibiotics, Supplements"
          rows={2}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Medical Conditions</label>
        <textarea
          value={hr.conditions || ''}
          onChange={(e) => onHealthRecordsChange({ ...hr, conditions: e.target.value })}
          placeholder="e.g., Diabetes, Hip Dysplasia"
          rows={2}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Rabies Vaccine Date</label>
        <input
          type="date"
          value={vac.rabies || ''}
          onChange={(e) => onVaccinationsChange({ ...vac, rabies: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Distemper Vaccine Date</label>
        <input
          type="date"
          value={vac.distemper || ''}
          onChange={(e) => onVaccinationsChange({ ...vac, distemper: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Parvovirus Vaccine Date</label>
        <input
          type="date"
          value={vac.parvovirus || ''}
          onChange={(e) => onVaccinationsChange({ ...vac, parvovirus: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Other Vaccinations</label>
        <textarea
          value={vac.other || ''}
          onChange={(e) => onVaccinationsChange({ ...vac, other: e.target.value })}
          placeholder="e.g., Bordetella - Jan 2024"
          rows={2}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
        <p className="text-center text-xs text-blue-900">
          💡 Keeping vaccination records updated helps veterinarians provide better care!
        </p>
      </div>
    </div>
  );
}
