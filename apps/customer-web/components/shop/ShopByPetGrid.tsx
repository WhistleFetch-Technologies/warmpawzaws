'use client';

import { Bird, Cat, Dog, Rabbit } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ShopCategory, ShopProduct } from './shop-types';

const PET_TILES: {
  id: string;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  bg: string;
  iconColor: string;
  keywords: string[];
}[] = [
  {
    id: 'dog',
    label: 'For Dogs',
    subtitle: 'Browse products',
    Icon: Dog,
    bg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    keywords: ['dog', 'canine', 'puppy'],
  },
  {
    id: 'cat',
    label: 'For Cats',
    subtitle: 'Browse products',
    Icon: Cat,
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    keywords: ['cat', 'feline', 'kitten'],
  },
  {
    id: 'bird',
    label: 'For Birds',
    subtitle: 'Browse products',
    Icon: Bird,
    bg: 'bg-yellow-50',
    iconColor: 'text-amber-600',
    keywords: ['bird', 'avian'],
  },
  {
    id: 'rabbit',
    label: 'For Rabbits',
    subtitle: 'Browse products',
    Icon: Rabbit,
    bg: 'bg-pink-50',
    iconColor: 'text-pink-500',
    keywords: ['rabbit', 'bunny', 'small pet'],
  },
];

function countProductsForPet(products: ShopProduct[], keywords: string[]): number {
  if (!products.length) return 0;
  return products.filter((p) => {
    const hay = `${p.name} ${p.description}`.toLowerCase();
    return keywords.some((k) => hay.includes(k));
  }).length;
}

function findMatchingCategoryId(categories: ShopCategory[], keywords: string[]): string | null {
  const match = categories.find((c) => {
    const name = c.name.toLowerCase();
    return keywords.some((k) => name.includes(k));
  });
  return match?.id ?? null;
}

interface ShopByPetGridProps {
  products: ShopProduct[];
  categories: ShopCategory[];
  onSelectCategory: (id: string) => void;
  onScrollToCatalog: () => void;
}

export function ShopByPetGrid({
  products,
  categories,
  onSelectCategory,
  onScrollToCatalog,
}: ShopByPetGridProps) {
  return (
    <div className="px-4 mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-900">Shop by Pet</h2>
        <button
          type="button"
          onClick={onScrollToCatalog}
          className="text-xs font-semibold text-[#FF8C42]"
        >
          View all
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PET_TILES.map((pet) => {
          const count = countProductsForPet(products, pet.keywords);
          const categoryId = findMatchingCategoryId(categories, pet.keywords);
          const subtitle =
            count > 0 ? `${count}+ Products` : pet.subtitle;

          return (
            <button
              key={pet.id}
              type="button"
              onClick={() => {
                if (categoryId) onSelectCategory(categoryId);
                else onScrollToCatalog();
              }}
              className={`${pet.bg} rounded-2xl p-4 text-left active:scale-[0.98] transition-transform border border-white shadow-sm min-h-[7.5rem] flex flex-col justify-between`}
            >
              <pet.Icon className={`w-10 h-10 ${pet.iconColor} opacity-90`} />
              <div>
                <p className="text-sm font-bold text-slate-900">{pet.label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
