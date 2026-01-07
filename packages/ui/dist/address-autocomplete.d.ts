/**
 * Google Maps Address Autocomplete Component
 * Reusable component for address search with autocomplete
 */
declare global {
    interface Window {
        google: any;
        initGoogleMaps: () => void;
    }
}
export interface AddressComponents {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    landmark?: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
    formattedAddress?: string;
}
interface AddressAutocompleteProps {
    value: string;
    onChange: (address: string, components?: AddressComponents) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
    apiKey?: string;
    types?: string[];
    componentRestrictions?: {
        country?: string | string[];
    };
}
export declare function AddressAutocomplete({ value, onChange, placeholder, className, required, disabled, apiKey, types, componentRestrictions, }: AddressAutocompleteProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=address-autocomplete.d.ts.map