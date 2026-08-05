import { defineSpecialization } from '../../define';

export const excessiveBarkingMetadata = defineSpecialization({
  id: 'excessive_barking',
  aliases: ['barking'],
  category: 'behavior',
  title: 'Excessive Barking',
  description:
    'Identify why your dog barks and apply targeted training to reduce nuisance barking while keeping alert behaviour when it truly matters.',
  highlightChips: ['Root Cause Focus', 'Quiet Alternatives', 'Neighbour Friendly'],
  whatsIncluded: [
    { label: 'Bark Trigger Analysis', icon: 'brain' },
    { label: 'Quiet Command Training', icon: 'target' },
    { label: 'Enrichment Planning', icon: 'dog' },
    { label: 'Environmental Changes', icon: 'home' },
    { label: 'Desensitization Drills', icon: 'check' },
    { label: 'Owner Response Coaching', icon: 'graduation' },
  ],
  benefits: [
    { title: 'Quieter Home', description: 'Fewer bursts of barking throughout the day.', icon: 'heart' },
    { title: 'Better Neighbour Relations', description: 'Less noise stress in apartments and communities.', icon: 'users' },
    { title: 'Clear Communication', description: 'Your dog learns when barking is appropriate.', icon: 'brain' },
    { title: 'Less Frustration', description: 'Structured steps replace guesswork.', icon: 'check' },
  ],
  whoIsThisFor: ['Apartment dogs barking at sounds', 'Territorial barkers at windows', 'Excitement barkers at the door'],
  timeline: [
    { period: 'Week 1', title: 'Bark diary and trigger identification' },
    { period: 'Week 2', title: 'Quiet cue and reward timing' },
    { period: 'Week 3', title: 'Desensitization to common triggers' },
    { period: 'Week 4', title: 'Maintenance in real-life scenarios' },
  ],
  tips: ['Never yell over barking—it often makes it worse', 'Reward silence, not just stopping', 'Block visual triggers if needed', 'Ensure adequate exercise and mental stimulation'],
});
