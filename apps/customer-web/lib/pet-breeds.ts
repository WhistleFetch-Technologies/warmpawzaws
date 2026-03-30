/** Common breeds for customer add-pet flows (Dog / Cat only on platform). */

export const DOG_BREEDS: string[] = [
  'Mixed / Other',
  'Golden Retriever',
  'Labrador Retriever',
  'German Shepherd',
  'Indian Pariah (Indie)',
  'Beagle',
  'Pug',
  'Shih Tzu',
  'Pomeranian',
  'Siberian Husky',
  'Rottweiler',
  'Doberman',
  'Boxer',
  'Dachshund',
  'Cocker Spaniel',
  'French Bulldog',
  'Great Dane',
  'Saint Bernard',
  'Chihuahua',
  'Maltese',
  'Yorkshire Terrier',
  'Border Collie',
  'Golden Doodle',
  'Labradoodle',
];

export const CAT_BREEDS: string[] = [
  'Mixed / Other',
  'Indian Domestic Shorthair',
  'Persian',
  'Siamese',
  'Maine Coon',
  'British Shorthair',
  'Ragdoll',
  'Bengal',
  'Himalayan',
  'American Shorthair',
  'Scottish Fold',
  'Sphynx',
  'Russian Blue',
  'Abyssinian',
  'Birman',
  'Oriental Shorthair',
];

export function breedsForSpecies(species: string): string[] {
  const s = (species || 'dog').toLowerCase();
  if (s === 'cat') return CAT_BREEDS;
  return DOG_BREEDS;
}
