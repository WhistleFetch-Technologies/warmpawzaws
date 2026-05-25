import { Apple, Calendar, Heart, UtensilsCrossed, type LucideIcon } from "lucide-react";

export type NutritionServiceTypeCard = {
    icon: LucideIcon;
    label: string;
    color: string;
    desc: string;
    comingSoon?: boolean;
};

export const serviceTypes: NutritionServiceTypeCard[] = [
    { icon: UtensilsCrossed, label: 'Diet Consultation', color: 'bg-green-100 text-green-600', desc: 'Personalized meal plans' },
    { icon: Calendar, label: 'Meal Plans', color: 'bg-yellow-100 text-yellow-600', desc: 'Monthly subscriptions', comingSoon: true },
    // { icon: Heart, label: 'Weight Management', color: 'bg-pink-100 text-pink-600', desc: 'Healthy weight goals' },
    // { icon: Apple, label: 'Allergy Management', color: 'bg-orange-100 text-orange-600', desc: 'Specialized diets' }
];


export const defaultServiceTypeOptions = [
    { id: 'diet_consultation', name: 'Diet Consultation', icon: UtensilsCrossed, price: 999, duration: 45, desc: 'Personalized meal plans', color: 'green' },
    { id: 'meal_plans', name: 'Meal Plans', icon: Calendar, price: 1999, duration: 60, desc: 'Monthly subscriptions', color: 'yellow' },
    { id: 'weight_management', name: 'Weight Management', icon: Heart, price: 1499, duration: 50, desc: 'Healthy weight goals', color: 'pink' },
    { id: 'allergy_management', name: 'Allergy Management', icon: Apple, price: 1299, duration: 40, desc: 'Specialized diets', color: 'orange' },
];