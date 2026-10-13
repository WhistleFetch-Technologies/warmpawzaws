export type InsuranceSlugGroup = 'customer' | 'address' | 'pet';

export interface InsuranceSlugSource {
  readonly table: string;
  readonly column: string;
  readonly jsonPath?: string;
}

export interface InsuranceSlugDefinition {
  readonly slug: string;
  readonly label: string;
  readonly group: InsuranceSlugGroup;
  readonly source: InsuranceSlugSource;
  readonly type: 'text' | 'date' | 'number' | 'boolean';
}

export const INSURANCE_SLUGS: readonly InsuranceSlugDefinition[] = [
  { slug: 'customer.full_name', label: 'Customer full name', group: 'customer', source: { table: 'customers', column: 'full_name' }, type: 'text' },
  { slug: 'customer.phone', label: 'Customer phone', group: 'customer', source: { table: 'customers', column: 'phone' }, type: 'text' },
  { slug: 'customer.email', label: 'Customer email', group: 'customer', source: { table: 'customers', column: 'email' }, type: 'text' },
  { slug: 'customer.date_of_birth', label: 'Customer date of birth', group: 'customer', source: { table: 'customers', column: 'date_of_birth' }, type: 'date' },
  { slug: 'address.line1', label: 'Address line', group: 'address', source: { table: 'customer_addresses', column: 'address_line1' }, type: 'text' },
  { slug: 'address.city', label: 'City', group: 'address', source: { table: 'customer_addresses', column: 'city' }, type: 'text' },
  { slug: 'address.pincode', label: 'Pincode', group: 'address', source: { table: 'customer_addresses', column: 'pincode' }, type: 'text' },
  { slug: 'pet.name', label: 'Pet name', group: 'pet', source: { table: 'pets', column: 'name' }, type: 'text' },
  { slug: 'pet.species', label: 'Species', group: 'pet', source: { table: 'pets', column: 'species' }, type: 'text' },
  { slug: 'pet.breed', label: 'Breed', group: 'pet', source: { table: 'pets', column: 'breed' }, type: 'text' },
  { slug: 'pet.gender', label: 'Gender', group: 'pet', source: { table: 'pets', column: 'gender' }, type: 'text' },
  { slug: 'pet.date_of_birth', label: 'Pet date of birth', group: 'pet', source: { table: 'pets', column: 'date_of_birth' }, type: 'date' },
  { slug: 'pet.age', label: 'Age', group: 'pet', source: { table: 'pets', column: 'age' }, type: 'number' },
  { slug: 'pet.weight_kg', label: 'Weight (kg)', group: 'pet', source: { table: 'pets', column: 'weight_kg', jsonPath: 'medical_history.weight_kg' }, type: 'number' },
  { slug: 'pet.microchip_id', label: 'Microchip id', group: 'pet', source: { table: 'pets', column: 'microchip_id', jsonPath: 'medical_history.microchip_id' }, type: 'text' },
  { slug: 'pet.is_spayed_neutered', label: 'Spayed or neutered', group: 'pet', source: { table: 'pets', column: 'is_spayed_neutered', jsonPath: 'medical_history.is_spayed_neutered' }, type: 'boolean' },
  { slug: 'pet.color', label: 'Color', group: 'pet', source: { table: 'pets', column: 'color', jsonPath: 'medical_history.color' }, type: 'text' },
];

export function insuranceSlugByKey(slug: string): InsuranceSlugDefinition | undefined {
  return INSURANCE_SLUGS.find((row) => row.slug === slug);
}
