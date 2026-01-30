/**
 * ============================================================================
 * PET HEALTH KNOWLEDGE BASE - AI-DRIVEN SEARCH LIBRARY
 * ============================================================================
 * 
 * Comprehensive knowledge base mapping symptoms to problems, specializations,
 * and service flows. Powers intelligent search that understands pet health
 * context and routes users to correct services.
 * 
 * Features:
 * - Symptom-to-problem mapping
 * - Problem-to-specialization mapping
 * - Service flow routing
 * - Semantic search understanding
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

export interface Symptom {
  id: string;
  keywords: string[]; // All variations and synonyms
  primaryProblem: string;
  relatedProblems: string[];
  specialization: string; // vet, urologist, dermatologist, etc.
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  serviceFlow: string; // Which booking flow to use
  category: string; // general_health, urinary, digestive, etc.
}

export interface ProblemMapping {
  problemId: string;
  problemName: string;
  symptoms: string[];
  specializations: string[];
  serviceFlows: string[];
  category: string;
}

// Comprehensive symptom-to-problem knowledge base
export const SYMPTOM_KNOWLEDGE_BASE: Symptom[] = [
  // Urinary Issues
  {
    id: 'urinary_frequency',
    keywords: ['urinating', 'urination', 'peeing', 'pee', 'urine', 'frequent urination', 'urinating more', 'can\'t urinate', 'difficulty urinating', 'straining to urinate', 'blood in urine', 'urine problem'],
    primaryProblem: 'urinary_infection',
    relatedProblems: ['urinary_tract_infection', 'bladder_infection', 'kidney_problem', 'urinary_stones'],
    specialization: 'urologist',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'urinary'
  },
  {
    id: 'urinary_blood',
    keywords: ['blood in urine', 'bloody urine', 'red urine', 'urine with blood', 'hematuria'],
    primaryProblem: 'urinary_infection',
    relatedProblems: ['urinary_tract_infection', 'bladder_infection', 'kidney_problem', 'urinary_stones'],
    specialization: 'urologist',
    urgency: 'high',
    serviceFlow: 'vet_consultation',
    category: 'urinary'
  },
  
  // Digestive Issues
  {
    id: 'vomiting',
    keywords: ['vomiting', 'vomit', 'throwing up', 'puking', 'nausea', 'upset stomach', 'sick', 'feeling sick'],
    primaryProblem: 'digestive_issue',
    relatedProblems: ['gastroenteritis', 'food_allergy', 'indigestion', 'stomach_problem'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'digestive'
  },
  {
    id: 'diarrhea',
    keywords: ['diarrhea', 'diarrhoea', 'loose stool', 'runny stool', 'watery stool', 'stomach upset'],
    primaryProblem: 'digestive_issue',
    relatedProblems: ['gastroenteritis', 'food_allergy', 'parasites', 'stomach_problem'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'digestive'
  },
  {
    id: 'constipation',
    keywords: ['constipation', 'can\'t poop', 'not pooping', 'hard stool', 'straining to poop'],
    primaryProblem: 'digestive_issue',
    relatedProblems: ['digestive_problem', 'dehydration', 'diet_issue'],
    specialization: 'general_vet',
    urgency: 'low',
    serviceFlow: 'vet_consultation',
    category: 'digestive'
  },
  
  // Skin Issues
  {
    id: 'itching',
    keywords: ['itching', 'itchy', 'scratching', 'scratch', 'skin irritation', 'itchy skin', 'constant scratching'],
    primaryProblem: 'skin_condition',
    relatedProblems: ['allergy', 'dermatitis', 'skin_infection', 'parasites', 'flea_allergy'],
    specialization: 'dermatologist',
    urgency: 'low',
    serviceFlow: 'vet_consultation',
    category: 'dermatology'
  },
  {
    id: 'hair_loss',
    keywords: ['hair loss', 'bald spots', 'losing hair', 'fur loss', 'patchy hair', 'alopecia'],
    primaryProblem: 'skin_condition',
    relatedProblems: ['allergy', 'dermatitis', 'parasites', 'hormonal_issue'],
    specialization: 'dermatologist',
    urgency: 'low',
    serviceFlow: 'vet_consultation',
    category: 'dermatology'
  },
  {
    id: 'rash',
    keywords: ['rash', 'red skin', 'skin rash', 'irritated skin', 'red patches', 'skin bumps'],
    primaryProblem: 'skin_condition',
    relatedProblems: ['allergy', 'dermatitis', 'skin_infection', 'contact_dermatitis'],
    specialization: 'dermatologist',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'dermatology'
  },
  
  // Respiratory Issues
  {
    id: 'coughing',
    keywords: ['coughing', 'cough', 'hacking', 'coughing up', 'persistent cough'],
    primaryProblem: 'respiratory_issue',
    relatedProblems: ['kennel_cough', 'respiratory_infection', 'allergy', 'heart_problem'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'respiratory'
  },
  {
    id: 'sneezing',
    keywords: ['sneezing', 'sneeze', 'runny nose', 'nasal discharge', 'nose running'],
    primaryProblem: 'respiratory_issue',
    relatedProblems: ['allergy', 'respiratory_infection', 'cold', 'sinus_issue'],
    specialization: 'general_vet',
    urgency: 'low',
    serviceFlow: 'vet_consultation',
    category: 'respiratory'
  },
  {
    id: 'breathing_difficulty',
    keywords: ['breathing difficulty', 'trouble breathing', 'labored breathing', 'panting excessively', 'shortness of breath', 'difficulty breathing'],
    primaryProblem: 'respiratory_issue',
    relatedProblems: ['respiratory_infection', 'heart_problem', 'allergy', 'asthma'],
    specialization: 'general_vet',
    urgency: 'emergency',
    serviceFlow: 'emergency_consultation',
    category: 'respiratory'
  },
  
  // Eye Issues
  {
    id: 'eye_discharge',
    keywords: ['eye discharge', 'watery eyes', 'teary eyes', 'eye gunk', 'eye crust', 'discharge from eyes'],
    primaryProblem: 'eye_infection',
    relatedProblems: ['conjunctivitis', 'eye_infection', 'allergy', 'eye_injury'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'ophthalmology'
  },
  {
    id: 'red_eyes',
    keywords: ['red eyes', 'bloodshot eyes', 'pink eyes', 'irritated eyes'],
    primaryProblem: 'eye_infection',
    relatedProblems: ['conjunctivitis', 'eye_infection', 'allergy', 'eye_injury'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'ophthalmology'
  },
  
  // Behavioral Issues
  {
    id: 'aggression',
    keywords: ['aggression', 'aggressive', 'biting', 'growling', 'snapping', 'aggressive behavior'],
    primaryProblem: 'behavioral_issue',
    relatedProblems: ['anxiety', 'fear', 'territorial_behavior', 'pain_related_aggression'],
    specialization: 'behaviorist',
    urgency: 'medium',
    serviceFlow: 'training_consultation',
    category: 'behavior'
  },
  {
    id: 'anxiety',
    keywords: ['anxiety', 'anxious', 'nervous', 'stressed', 'fearful', 'separation anxiety'],
    primaryProblem: 'behavioral_issue',
    relatedProblems: ['stress', 'fear', 'separation_anxiety', 'phobia'],
    specialization: 'behaviorist',
    urgency: 'low',
    serviceFlow: 'training_consultation',
    category: 'behavior'
  },
  
  // General Health
  {
    id: 'lethargy',
    keywords: ['lethargic', 'tired', 'sleepy', 'low energy', 'not active', 'weak', 'exhausted'],
    primaryProblem: 'general_health_issue',
    relatedProblems: ['illness', 'infection', 'pain', 'fever', 'dehydration'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'general_health'
  },
  {
    id: 'fever',
    keywords: ['fever', 'hot', 'warm', 'elevated temperature', 'running a fever'],
    primaryProblem: 'general_health_issue',
    relatedProblems: ['infection', 'illness', 'inflammation'],
    specialization: 'general_vet',
    urgency: 'high',
    serviceFlow: 'vet_consultation',
    category: 'general_health'
  },
  {
    id: 'loss_of_appetite',
    keywords: ['not eating', 'loss of appetite', 'won\'t eat', 'refusing food', 'not hungry', 'decreased appetite'],
    primaryProblem: 'general_health_issue',
    relatedProblems: ['illness', 'dental_problem', 'digestive_issue', 'pain'],
    specialization: 'general_vet',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'general_health'
  },
  
  // Dental Issues
  {
    id: 'dental_pain',
    keywords: ['dental pain', 'tooth pain', 'mouth pain', 'difficulty eating', 'drooling', 'bad breath', 'toothache'],
    primaryProblem: 'dental_issue',
    relatedProblems: ['tooth_decay', 'gum_disease', 'dental_infection', 'broken_tooth'],
    specialization: 'dentist',
    urgency: 'medium',
    serviceFlow: 'vet_consultation',
    category: 'dental'
  },
  
  // Emergency Symptoms
  {
    id: 'seizure',
    keywords: ['seizure', 'convulsion', 'fitting', 'unconscious', 'collapsed', 'passed out'],
    primaryProblem: 'neurological_issue',
    relatedProblems: ['epilepsy', 'neurological_disorder', 'poisoning', 'brain_injury'],
    specialization: 'neurologist',
    urgency: 'emergency',
    serviceFlow: 'emergency_consultation',
    category: 'neurological'
  },
  {
    id: 'poisoning',
    keywords: ['poisoned', 'ate poison', 'toxic', 'ingested poison', 'chemical exposure'],
    primaryProblem: 'poisoning',
    relatedProblems: ['toxicity', 'poison_ingestion'],
    specialization: 'emergency_vet',
    urgency: 'emergency',
    serviceFlow: 'emergency_consultation',
    category: 'emergency'
  }
];

// Problem to service flow mapping
export const PROBLEM_TO_FLOW_MAP: Record<string, string> = {
  'urinary_infection': '/booking/tele?problem=urinary',
  'urinary_tract_infection': '/booking/tele?problem=urinary',
  'digestive_issue': '/booking/tele?problem=digestive',
  'skin_condition': '/booking/tele?problem=skin',
  'respiratory_issue': '/booking/tele?problem=respiratory',
  'eye_infection': '/booking/tele?problem=eye',
  'behavioral_issue': '/booking/training?problem=behavior',
  'general_health_issue': '/booking/tele?problem=general',
  'dental_issue': '/booking/tele?problem=dental',
  'neurological_issue': '/emergency',
  'poisoning': '/emergency',
};

// Specialization to vendor role mapping
export const SPECIALIZATION_TO_ROLE: Record<string, string[]> = {
  'urologist': ['vet', 'specialist'],
  'general_vet': ['vet'],
  'dermatologist': ['vet', 'specialist'],
  'behaviorist': ['trainer'],
  'dentist': ['vet', 'specialist'],
  'neurologist': ['vet', 'specialist'],
  'emergency_vet': ['vet', 'emergency'],
};

/**
 * Analyze search query and extract symptoms/problems
 */
export function analyzeSearchQuery(query: string): {
  detectedSymptoms: Symptom[];
  primaryProblem: string | null;
  suggestedSpecialization: string | null;
  suggestedFlow: string | null;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  category: string | null;
} {
  const lowerQuery = query.toLowerCase().trim();
  const detectedSymptoms: Symptom[] = [];
  
  // Check each symptom in knowledge base
  for (const symptom of SYMPTOM_KNOWLEDGE_BASE) {
    for (const keyword of symptom.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        // Avoid duplicates
        if (!detectedSymptoms.find(s => s.id === symptom.id)) {
          detectedSymptoms.push(symptom);
        }
        break;
      }
    }
  }
  
  // Determine primary problem (highest urgency or first match)
  const primarySymptom = detectedSymptoms.sort((a, b) => {
    const urgencyOrder = { emergency: 4, high: 3, medium: 2, low: 1 };
    return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
  })[0];
  
  const primaryProblem = primarySymptom?.primaryProblem || null;
  const suggestedSpecialization = primarySymptom?.specialization || null;
  const suggestedFlow = primarySymptom ? PROBLEM_TO_FLOW_MAP[primarySymptom.primaryProblem] : null;
  const urgency = primarySymptom?.urgency || 'low';
  const category = primarySymptom?.category || null;
  
  return {
    detectedSymptoms,
    primaryProblem,
    suggestedSpecialization,
    suggestedFlow,
    urgency,
    category
  };
}

/**
 * Get related problems for a given problem
 */
export function getRelatedProblems(problemId: string): string[] {
  const symptom = SYMPTOM_KNOWLEDGE_BASE.find(s => s.primaryProblem === problemId);
  return symptom?.relatedProblems || [];
}

/**
 * Get service flow for a problem
 */
export function getServiceFlowForProblem(problemId: string): string | null {
  return PROBLEM_TO_FLOW_MAP[problemId] || null;
}

/**
 * Get vendor roles for a specialization
 */
export function getVendorRolesForSpecialization(specialization: string): string[] {
  return SPECIALIZATION_TO_ROLE[specialization] || ['vet'];
}

/**
 * Enhance search query with semantic understanding
 */
export function enhanceSearchQuery(query: string): {
  originalQuery: string;
  enhancedQuery: string;
  detectedProblems: string[];
  suggestedFlows: string[];
  semanticKeywords: string[];
} {
  const analysis = analyzeSearchQuery(query);
  const semanticKeywords: string[] = [];
  
  // Add symptom keywords
  analysis.detectedSymptoms.forEach(symptom => {
    semanticKeywords.push(...symptom.keywords.slice(0, 3));
  });
  
  // Add related problems
  if (analysis.primaryProblem) {
    const related = getRelatedProblems(analysis.primaryProblem);
    semanticKeywords.push(...related);
  }
  
  // Build enhanced query
  const enhancedQuery = [
    query,
    ...semanticKeywords
  ].join(' ');
  
  const detectedProblems = analysis.detectedSymptoms.map(s => s.primaryProblem);
  const suggestedFlows = analysis.detectedSymptoms
    .map(s => getServiceFlowForProblem(s.primaryProblem))
    .filter((f): f is string => f !== null);
  
  return {
    originalQuery: query,
    enhancedQuery,
    detectedProblems,
    suggestedFlows,
    semanticKeywords
  };
}
