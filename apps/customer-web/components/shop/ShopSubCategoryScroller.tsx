'use client';

import type { ReactNode } from 'react';
import { Baby, Cookie, Dog, Droplet, Grid3X3, Stethoscope, Wheat } from 'lucide-react';
import type { ShopCategory } from './shop-types';

interface ShopSubCategoryScrollerProps {
  /** Subcategories of the currently selected top-level category (e.g. Dry/Wet/Puppy/Adult/Treats under Pet Food). */
  subCategories: ShopCategory[];
  selectedSubCategory: string;
  onSelectSubCategory: (id: string) => void;
}

/** Small illustrative icon per subcategory name — no custom art exists for these yet. */
function iconForSubCategory(name: string): ReactNode {
  const n = name.trim().toLowerCase();
  if (n.includes('dry')) return <Wheat className="w-4 h-4" />;
  if (n.includes('wet')) return <Droplet className="w-4 h-4" />;
  if (n.includes('puppy')) return <Baby className="w-4 h-4" />;
  if (n.includes('adult') || n.includes('senior')) return <Dog className="w-4 h-4" />;
  if (n.includes('treat')) return <Cookie className="w-4 h-4" />;
  if (n.includes('therapeutic') || n.includes('prescription')) return <Stethoscope className="w-4 h-4" />;
  return <Dog className="w-4 h-4" />;
}

/**
 * Second-level tab row shown under the main category scroller once a top-level
 * category with subcategories (e.g. Pet Food -> Dry/Wet/Puppy/Adult/Treats) is selected.
 */
export function ShopSubCategoryScroller({
  subCategories,
  selectedSubCategory,
  onSelectSubCategory,
}: ShopSubCategoryScrollerProps) {
  if (subCategories.length === 0) return null;

  return (
    <div className="mt-2 w-full min-w-0 overflow-x-auto overflow-y-visible py-px [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-2 w-max pr-4">
        <SubCategoryChip
          label="All"
          active={!selectedSubCategory}
          onClick={() => onSelectSubCategory('')}
          icon={<Grid3X3 className="w-4 h-4" />}
        />
        {subCategories.map((sub) => (
          <SubCategoryChip
            key={sub.id}
            label={sub.name}
            active={selectedSubCategory === sub.id}
            onClick={() => onSelectSubCategory(sub.id)}
            icon={iconForSubCategory(sub.name)}
          />
        ))}
      </div>
    </div>
  );
}

function SubCategoryChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'border-[#FF8C42] bg-orange-50 text-[#FF8C42]'
          : 'border-slate-200 bg-white text-slate-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
