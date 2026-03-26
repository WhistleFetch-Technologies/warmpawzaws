import { Bone, Cat, Heart, HomeIcon, Star } from "lucide-react";

/**
 * Extract city and state from customer profile data
 * Tries multiple sources: profile fields, address fields, and pincode inference
 * 
 * @param profile - Customer profile object (may have .profile or .success wrapper)
 * @param pincode - Optional pincode string for inference fallback
 * @returns Object with city and state strings
 */
export const serviceBaseOnpincode = (
  profile: any,
  pincode: string = ''
): { city: string; state: string } => {
  let customerCity = '';
  let customerState = '';

  if (!profile) {
    return { city: customerCity, state: customerState };
  }

  const profileData = profile.profile || profile;

  // Try multiple sources for city
  customerCity =
    profileData.city ||
    profileData.address?.city ||
    profileData.addresses?.[0]?.city ||
    profileData.default_address?.city ||
    '';

  // Try multiple sources for state
  customerState =
    profileData.state ||
    profileData.address?.state ||
    profileData.addresses?.[0]?.state ||
    profileData.default_address?.state ||
    '';

  // Get pincode for fallback inference
  const profilePincode =
    profileData.pincode ||
    profileData.address?.pincode ||
    profileData.addresses?.[0]?.pincode ||
    pincode ||
    '';

  // Infer city/state from Indian pincodes if not available
  if ((!customerCity || !customerState) && profilePincode) {
    const pincodePrefix = profilePincode.toString().substring(0, 3);
    
    // Bangalore pincodes: 560xxx
    if (pincodePrefix === '560') {
      if (!customerCity) customerCity = 'Bangalore';
      if (!customerState) customerState = 'Karnataka';
    }
    // Mumbai pincodes: 400xxx
    else if (pincodePrefix === '400') {
      if (!customerCity) customerCity = 'Mumbai';
      if (!customerState) customerState = 'Maharashtra';
    }
    // Delhi pincodes: 110xxx
    else if (pincodePrefix === '110') {
      if (!customerCity) customerCity = 'New Delhi';
      if (!customerState) customerState = 'Delhi';
    }
    // Chennai pincodes: 600xxx
    else if (pincodePrefix === '600') {
      if (!customerCity) customerCity = 'Chennai';
      if (!customerState) customerState = 'Tamil Nadu';
    }
    // Hyderabad pincodes: 500xxx
    else if (pincodePrefix === '500') {
      if (!customerCity) customerCity = 'Hyderabad';
      if (!customerState) customerState = 'Telangana';
    }
    // Pune pincodes: 411xxx
    else if (pincodePrefix === '411') {
      if (!customerCity) customerCity = 'Pune';
      if (!customerState) customerState = 'Maharashtra';
    }
  }

  // Log for debugging
  console.log('[ServiceLaunchConfig] Customer location from profile:', {
    city: customerCity,
    state: customerState,
    pincode: profilePincode,
    profileKeys: Object.keys(profileData),
  });

  return { city: customerCity, state: customerState };
};


/** Vendor-shaped metadata for `resolveFeaturedVendorDestination` (cta_link, service_category, etc.). */
export type AdoptionHomeNavMeta = Record<string, unknown>;

export const adoptionOptions = (adoptionStats: {
  adoptablePets: string | number;
  certifiedBreeders: string | number;
  rehomingListings: string | number;
}) => {
  return [
    {
      title: 'Adopt from NGOs',
      description: 'Give a home to rescued pets',
      Icon: Heart,
      count: `${adoptionStats.adoptablePets}+ pets`,
      navMeta: { cta_link: '/adoption' } satisfies AdoptionHomeNavMeta,
    },
    {
      title: 'Certified Breeders',
      description: 'Ethical & verified breeders',
      Icon: Star,
      count: `${adoptionStats.certifiedBreeders}+ breeders`,
      navMeta: { cta_link: '/breeder' } satisfies AdoptionHomeNavMeta,
    },
    {
      title: 'Pet Rehoming',
      description: 'Find loving owners',
      Icon: HomeIcon,
      count: `${adoptionStats.rehomingListings}+ listings`,
      navMeta: { cta_link: '/rehoming' } satisfies AdoptionHomeNavMeta,
    },
  ];
};

/** Premium Pet Food row — same nav resolution as featured spotlight; opens shop with Food category. */
const PET_FOOD_SHOP_NAV_META = { service_category: 'food' } satisfies AdoptionHomeNavMeta;

export const petFoodSpotlightBrands = () => [
  { name: 'Royal Canin', discount: '25% OFF', Icon: Star, navMeta: PET_FOOD_SHOP_NAV_META },
  { name: 'Pedigree', discount: '30% OFF', Icon: Bone, navMeta: PET_FOOD_SHOP_NAV_META },
  { name: 'Drools', discount: '20% OFF', Icon: Bone, navMeta: PET_FOOD_SHOP_NAV_META },
  { name: 'Whiskas', discount: '15% OFF', Icon: Cat, navMeta: PET_FOOD_SHOP_NAV_META },
];