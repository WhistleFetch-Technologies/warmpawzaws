import { defineSpecialization } from '../../define';

export const longWalkMetadata = defineSpecialization({
  id: 'long_walk',
  aliases: ['adventure_walk'],
  category: 'walking',
  title: 'Long Walk',
  description:
    'Extended adventure walks in parks and trails for dogs who need extra exercise, mental enrichment, and exploration beyond a standard outing.',
  highlightChips: ['Trail Routes', 'Extra Exercise', 'Adventure Ready'],
  whatsIncluded: [
    { label: 'Extended Duration', icon: 'clock' },
    { label: 'Park & Trail Routes', icon: 'mapPin' },
    { label: 'Fitness Focus', icon: 'activity' },
    { label: 'Hydration Stops', icon: 'heart' },
    { label: 'Photo Updates', icon: 'star' },
    { label: 'Safety Gear Check', icon: 'shield' },
  ],
  benefits: [
    { title: 'Deep Exercise', description: 'Ideal for high-energy and working breeds.', icon: 'zap' },
    { title: 'Rich Enrichment', description: 'New scents and terrain engage body and mind.', icon: 'brain' },
    { title: 'Better Rest', description: 'A well-exercised dog sleeps more peacefully.', icon: 'clock' },
    { title: 'Adventure Bond', description: 'Special outings your pet will look forward to.', icon: 'trophy' },
  ],
  whoIsThisFor: ['Working and sporting breeds', 'Athletic adult dogs', 'Weekend adventure seekers'],
  timeline: [
    { period: 'Session 1', title: 'Fitness check and trail introduction' },
    { period: 'Session 2', title: 'Extended route with hydration stops' },
    { period: 'Session 3', title: 'Adventure pace established' },
    { period: 'Ongoing', title: 'Regular long walks on varied terrain' },
  ],
  tips: ['Ensure flea and tick protection is current', 'Carry portable water on hot days', 'Check weather before booking', 'Use reflective gear for dusk walks'],
});
