import { defineSpecialization } from '../../define';

export const orthopedicsMetadata = defineSpecialization({
  id: 'orthopedics',
  category: 'vet',
  title: 'Bone & Joint Care',
  description:
    'Diagnosis and treatment for limping, fractures, hip dysplasia, cruciate injuries, and arthritis—with imaging, surgery, and rehabilitation plans.',
  highlightChips: ['Joint Expertise', 'Mobility Focus', 'Surgical Options'],
  whatsIncluded: [
    { label: 'Orthopaedic Exam', icon: 'stethoscope' },
    { label: 'X-rays & Imaging', icon: 'check' },
    { label: 'Pain Management', icon: 'heart' },
    { label: 'Surgical Repair', icon: 'shield' },
    { label: 'Rehab Guidance', icon: 'activity' },
    { label: 'Mobility Aids Advice', icon: 'home' },
  ],
  benefits: [
    { title: 'Pain Relief', description: 'Targeted treatment reduces limping and stiffness.', icon: 'heart' },
    { title: 'Restored Mobility', description: 'Surgery and rehab help pets move comfortably again.', icon: 'activity' },
    { title: 'Accurate Diagnosis', description: 'Imaging reveals fractures and joint disease clearly.', icon: 'brain' },
    { title: 'Long-term Management', description: 'Arthritis plans for ongoing comfort.', icon: 'calendar' },
  ],
  whoIsThisFor: ['Sudden limping or non-weight-bearing', 'Hip dysplasia and cruciate tears', 'Senior pets with arthritis'],
  timeline: [
    { period: 'Exam', title: 'Gait assessment and palpation' },
    { period: 'Image', title: 'X-rays or advanced imaging' },
    { period: 'Treat', title: 'Surgery, splint, or medical management' },
    { period: 'Rehab', title: 'Physiotherapy and follow-up' },
  ],
  tips: ['Restrict jumping and stairs during recovery', 'Use ramps for cars and furniture if advised', 'Maintain healthy weight to reduce joint load', 'Report any worsening lameness immediately'],
});
