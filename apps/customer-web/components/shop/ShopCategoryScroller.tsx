'use client';

import type { ReactNode } from 'react';
import {
  Grid3X3,
} from 'lucide-react';
import { getShopCategoryStaticImageUrl } from '@/lib/shop-category-static-images';
import type { ShopCategory } from './shop-types';

interface ShopCategoryScrollerProps {
  categories: ShopCategory[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
}

export function ShopCategoryScroller({
  categories,
  selectedCategory,
  onSelectCategory,
}: ShopCategoryScrollerProps) {
  return (
    <div className="mt-3 w-full min-w-0 overflow-x-auto overflow-y-visible py-px [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-4 w-max pr-4">
        <CategoryChip
          label="All"
          active={!selectedCategory}
          onClick={() => onSelectCategory('')}
          bg="bg-orange-50"
          color="text-[#FF8C42]"
          icon={<Grid3X3 className="w-5 h-5 text-[#FF8C42]" />}
        />

        {categories.map((cat) => {
          const imageUrl = cat.image_url || getShopCategoryStaticImageUrl(cat.name);
          return (
            <CategoryChip
              key={cat.id}
              label={cat.name}
              active={selectedCategory === cat.id}
              onClick={() => onSelectCategory(cat.id)}
              bg="bg-slate-50"
              color="text-slate-600"
              imageUrl={imageUrl}
              icon={
                <span className="text-lg leading-none" aria-hidden>
                  🐾
                </span>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
  bg,
  icon,
  imageUrl,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  bg: string;
  color: string;
  icon: ReactNode;
  imageUrl?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex flex-col items-center gap-1.5 w-[4.25rem]"
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden box-border border-2 ${
          imageUrl ? 'bg-white' : bg
        } ${active ? 'border-[#FF8C42]' : 'border-transparent'}`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          icon
        )}
      </div>
      <span
        className={`text-[10px] font-semibold text-center leading-none ${
          active ? 'text-[#FF8C42]' : 'text-slate-600'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
