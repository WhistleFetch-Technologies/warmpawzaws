'use client';

import type { ReactNode } from 'react';
import {
  Bone,
  Cookie,
  Dog,
  Grid3X3,
  HeartPulse,
  MoreHorizontal,
  Scissors,
  Shirt,
  ToyBrick,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getShopCategoryStaticImageUrl } from '@/lib/shop-category-static-images';
import type { ShopCategory } from './shop-types';

const FALLBACK_CATEGORIES: { id: string; name: string; Icon: LucideIcon; bg: string; color: string }[] = [
  { id: 'food', name: 'Food', Icon: Bone, bg: 'bg-orange-50', color: 'text-orange-500' },
  { id: 'treats', name: 'Treats', Icon: Cookie, bg: 'bg-amber-50', color: 'text-amber-600' },
  { id: 'toys', name: 'Toys', Icon: ToyBrick, bg: 'bg-blue-50', color: 'text-blue-500' },
  { id: 'accessories', name: 'Accessories', Icon: Shirt, bg: 'bg-pink-50', color: 'text-pink-500' },
  { id: 'healthcare', name: 'Healthcare', Icon: HeartPulse, bg: 'bg-red-50', color: 'text-red-500' },
  { id: 'grooming', name: 'Grooming', Icon: Scissors, bg: 'bg-purple-50', color: 'text-purple-500' },
  { id: 'more', name: 'More', Icon: MoreHorizontal, bg: 'bg-slate-50', color: 'text-slate-500' },
];

const CATEGORY_ICON_MAP: Record<string, { Icon: LucideIcon; bg: string; color: string }> = {
  food: { Icon: Bone, bg: 'bg-orange-50', color: 'text-orange-500' },
  treats: { Icon: Cookie, bg: 'bg-amber-50', color: 'text-amber-600' },
  toys: { Icon: ToyBrick, bg: 'bg-blue-50', color: 'text-blue-500' },
  accessories: { Icon: Shirt, bg: 'bg-pink-50', color: 'text-pink-500' },
  healthcare: { Icon: HeartPulse, bg: 'bg-red-50', color: 'text-red-500' },
  grooming: { Icon: Scissors, bg: 'bg-purple-50', color: 'text-purple-500' },
};

function resolveCategoryVisual(name: string, icon?: string) {
  const key = name.toLowerCase().replace(/\s+/g, '');
  const mapped = CATEGORY_ICON_MAP[key];
  if (mapped) return mapped;
  if (icon && !icon.startsWith('http')) {
    return { emoji: icon, bg: 'bg-slate-50', color: 'text-slate-600' };
  }
  return { Icon: Dog, bg: 'bg-slate-50', color: 'text-slate-600' };
}

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
  const useApiCategories = categories.length > 0;

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

        {useApiCategories
          ? categories.map((cat) => {
              const visual = resolveCategoryVisual(cat.name, cat.icon);
              const imageUrl =
                cat.image_url || getShopCategoryStaticImageUrl(cat.name);
              return (
                <CategoryChip
                  key={cat.id}
                  label={cat.name}
                  active={selectedCategory === cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  bg={visual.bg}
                  color={visual.color}
                  imageUrl={imageUrl}
                  icon={
                    'emoji' in visual ? (
                      <span className="text-lg leading-none">{visual.emoji}</span>
                    ) : (
                      <visual.Icon className={`w-5 h-5 ${visual.color}`} />
                    )
                  }
                />
              );
            })
          : FALLBACK_CATEGORIES.map((cat) => {
              const imageUrl = getShopCategoryStaticImageUrl(cat.name);
              return (
                <CategoryChip
                  key={cat.id}
                  label={cat.name}
                  active={selectedCategory === cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  bg={cat.bg}
                  color={cat.color}
                  imageUrl={imageUrl}
                  icon={<cat.Icon className={`w-5 h-5 ${cat.color}`} />}
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
