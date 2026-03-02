import { Bone, Building2, Coffee, Dog, FlaskConical, GraduationCapIcon, Heart, HomeIcon, MapPin, PackageIcon, Palmtree, Phone, Pill, Scissors, Shield, ShoppingBag, Sparkles, Stethoscope, Users, Wheat } from "lucide-react";

export const serviceScreenMap: Record<string, string[]> = {
    'vet': ['vet'],
    'veterinary': ['vet'],
    'grooming': ['grooming'],
    'training': ['training'],
    'walker': ['walker'],
    'walking': ['walker'],
    'boarding': ['boarding'],
    'adoption': ['adoption'],
    'mating': ['mating-dating-hub'],
    'cafes': ['cafes'],
    'photography': ['photography'],
    'insurance': ['insurance'],
    'breeder': ['breeder'],
    'ambulance': ['ambulance'],
    'emergency': ['ambulance'],
    'nutritionist': ['nutritionist'],
    'wellness': ['nutritionist'],
    'relocation': ['relocation'],
    'resort': ['resort'],
    'holiday': ['holiday'],
    'sunset': ['sunset'],
    'shop': ['shop'],
    'pharmacy': ['shop'],
    'diagnostic': ['vet'],
    'diagnostics': ['vet'],
};


export const defaultBanners = [
    {
        id: 'default-1',
        title: "Get 50% OFF",
        subtitle: "First Grooming Session",
        gradientFrom: "#FF8C42",
        gradientTo: "#FF6B35",
        Icon: Scissors,
        ctaText: "Claim Now",
        ctaLink: "grooming"
    },
    {
        id: 'default-2',
        title: "Free Health Checkup",
        subtitle: "Book Vet Appointment Today",
        gradientFrom: "#4CAF50",
        gradientTo: "#2E7D32",
        Icon: Stethoscope,
        ctaText: "Book Now",
        ctaLink: "vet"
    },
    {
        id: 'default-3',
        title: "Premium Pet Food",
        subtitle: "20% OFF on First Order",
        gradientFrom: "#FF6B9D",
        gradientTo: "#C44569",
        Icon: Bone,
        ctaText: "Shop Now",
        ctaLink: "shop"
    }
];


export const quickServices = [
    // PRIMARY SERVICES
    { icon: Stethoscope, label: 'Vet Care', color: 'bg-blue-100 text-blue-600', screen: 'vet', categoryId: 'vet' },
    { icon: Scissors, label: 'Grooming', color: 'bg-orange-100 text-orange-600', screen: 'grooming', categoryId: 'grooming' },
    { icon: ShoppingBag, label: 'Pet Shop', color: 'bg-pink-100 text-pink-600', screen: 'shop', categoryId: 'shop' },
    { icon: GraduationCapIcon, label: 'Trainer', color: 'bg-purple-100 text-purple-600', screen: 'training', categoryId: 'training' },

    // HEALTHCARE SERVICES
    { icon: Pill, label: 'Pharmacy', color: 'bg-red-100 text-red-600', screen: 'pharmacy', categoryId: 'pharmacy' },
    { icon: FlaskConical, label: 'Lab Test', color: 'bg-teal-100 text-teal-600', screen: 'lab-diagnostics', categoryId: 'lab-diagnostics' },

    // CARE SERVICES
    { icon: Dog, label: 'Dog Walker', color: 'bg-green-100 text-green-600', screen: 'walker', categoryId: 'walker' },
    { icon: HomeIcon, label: 'Boarding', color: 'bg-indigo-100 text-indigo-600', screen: 'boarding', categoryId: 'boarding' },
    { icon: Heart, label: 'Adoption', color: 'bg-red-100 text-red-600', screen: 'adoption', categoryId: 'adoption' },
    { icon: Heart, label: 'Mating & Dating', color: 'bg-pink-100 text-pink-600', screen: 'mating-dating-hub', categoryId: 'mating-dating-hub' },
    { icon: Coffee, label: 'Pet Cafes', color: 'bg-amber-100 text-amber-600', screen: 'cafes', categoryId: 'cafes' },

    // SPECIALIZED SERVICES - NEW
    { icon: Users, label: 'Photography', color: 'bg-purple-100 text-purple-600', screen: 'photography', categoryId: 'photography' },
    { icon: Shield, label: 'Insurance', color: 'bg-cyan-100 text-cyan-600', screen: 'insurance', categoryId: 'insurance' },
    { icon: Users, label: 'Breeder', color: 'bg-amber-100 text-amber-600', screen: 'breeder', categoryId: 'breeder' },
    { icon: Phone, label: 'Ambulance', color: 'bg-red-100 text-red-600', screen: 'ambulance', categoryId: 'ambulance' },

    // WELLNESS & BEHAVIORAL
    { icon: Wheat, label: 'Nutritionist', color: 'bg-green-100 text-green-600', screen: 'nutritionist', categoryId: 'nutritionist' },
    { icon: Heart, label: 'Behaviorist', color: 'bg-indigo-100 text-indigo-600', screen: 'behaviorist', categoryId: 'behaviorist' },
    { icon: MapPin, label: 'Relocation', color: 'bg-blue-100 text-blue-600', screen: 'relocation', categoryId: 'relocation' },
    { icon: Sparkles, label: 'Pet Resort', color: 'bg-teal-100 text-teal-600', screen: 'resort', categoryId: 'resort' },
    { icon: Palmtree, label: 'Pet Holiday', color: 'bg-cyan-100 text-cyan-600', screen: 'holiday', categoryId: 'holiday' },
    { icon: Heart, label: 'Sunset Care', color: 'bg-purple-100 text-purple-600', screen: 'sunset', categoryId: 'sunset' },
];


export const defaultGroomingServices = [
    { title: 'At Home Grooming', price: '₹999', rating: 4.8, Icon: HomeIcon, description: 'Professional grooming at your doorstep' },
    { title: 'Salon Appointment', price: '₹799', rating: 4.9, Icon: Scissors, description: 'Premium salon experience' },
    { title: 'Spa Package', price: '₹1499', rating: 5.0, Icon: Sparkles, description: 'Complete spa & wellness' },
];

export const defaultVetServices = [
    { title: 'Vet at Home', price: '₹599', Icon: HomeIcon, description: 'Doctor visits you', type: 'visit' },
    { title: 'Tele Consulting', price: '₹299', Icon: Phone, description: 'Video consultation', type: 'video' },
    { title: 'Clinic Appointment', price: '₹399', Icon: Building2, description: 'Visit nearby clinic', type: 'clinic' },
];

export const defaultHotDeals = [
    { title: 'Royal Canin Dog Food', price: '₹2,499', originalPrice: '₹3,499', discount: '30% OFF', Icon: Bone, rating: 4.7 },
    { title: 'Pet Carrier Bag', price: '₹1,299', originalPrice: '₹2,199', discount: '40% OFF', Icon: PackageIcon, rating: 4.5 },
    { title: 'GPS Collar Tracker', price: '₹3,999', originalPrice: '₹5,999', discount: '35% OFF', Icon: MapPin, rating: 4.9 },
];

export const serviceNavigationMap: Record<string, string> = {
    'veterinary': 'vet',
    'vet': 'vet',
    'grooming': 'grooming',
    'boarding': 'boarding',
    'training': 'training',
    'walking': 'walker',
    'walker': 'walker',
    'nutrition': 'nutritionist',
    'nutritionist': 'nutritionist',
    'behavioral': 'behaviorist',
    'behaviorist': 'behaviorist',
    'cafe': 'cafes',
    'cafes': 'cafes',
    'adoption': 'adoption',
    'breeder': 'breeder',
    'ambulance': 'ambulance',
    'insurance': 'insurance',
    'pharmacy': 'pharmacy',
    'diagnostics': 'lab-diagnostics',
    'lab-diagnostics': 'lab-diagnostics',
    'lab': 'lab-diagnostics',
    'photography': 'photography',
    'relocation': 'relocation',
    'resort': 'resort',
    'holiday': 'holiday',
    'sunset': 'sunset',
    'mating': 'mating-dating-hub'
};