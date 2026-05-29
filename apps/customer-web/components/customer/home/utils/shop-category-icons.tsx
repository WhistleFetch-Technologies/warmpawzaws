import {
  Bone,
  Bed,
  Dog,
  Pill,
  Scissors,
  Shirt,
  ShoppingBag,
  UtensilsCrossed,
  Watch,
} from 'lucide-react';

/** Icon for ecommerce shop category chips — matches CustomerHomeComplete. */
export function customerHomeIconForShopCategory(name: string) {
  const n = name.toLowerCase();
  if (n.includes('food')) return <Bone className="w-5 h-5 text-orange-500" />;
  if (n.includes('toy')) return <Dog className="w-5 h-5 text-blue-500" />;
  if (n.includes('cloth')) return <Shirt className="w-5 h-5 text-teal-500" />;
  if (n.includes('accessor')) return <Watch className="w-5 h-5 text-pink-500" />;
  if (n.includes('medic')) return <Pill className="w-5 h-5 text-red-500" />;
  if (n.includes('groom')) return <Scissors className="w-5 h-5 text-purple-500" />;
  if (n.includes('bed')) return <Bed className="w-5 h-5 text-indigo-500" />;
  if (n.includes('bowl')) return <UtensilsCrossed className="w-5 h-5 text-green-500" />;
  return <ShoppingBag className="w-5 h-5 text-[#FF8C42]" />;
}

export const FALLBACK_SHOP_CATEGORIES = [
  { id: 'food', label: 'Food', icon: <Bone className="w-5 h-5 text-orange-500" /> },
  { id: 'toys', label: 'Toys', icon: <Dog className="w-5 h-5 text-blue-500" /> },
  { id: 'clothes', label: 'Clothes', icon: <Shirt className="w-5 h-5 text-teal-500" /> },
  { id: 'accessories', label: 'Accessories', icon: <Watch className="w-5 h-5 text-pink-500" /> },
  { id: 'medicine', label: 'Medicine', icon: <Pill className="w-5 h-5 text-red-500" /> },
  { id: 'grooming', label: 'Grooming', icon: <Scissors className="w-5 h-5 text-purple-500" /> },
  { id: 'beds', label: 'Beds', icon: <Bed className="w-5 h-5 text-indigo-500" /> },
  { id: 'bowls', label: 'Bowls', icon: <UtensilsCrossed className="w-5 h-5 text-green-500" /> },
] as const;
