/**
 * PROBLEM GRID MIGRATION SERVICE
 * Populates problem_grid_mappings table from catalog
 */

import { getDbClient } from "../db.ts";
import {
  vetHealthProblems,
  groomingNeeds,
  trainingGoals,
  walkingNeeds,
  behavioralIssues,
  boardingNeeds,
  nutritionNeeds
} from "../../functions/server/problem-grid-catalog.tsx";

const ROLE_MAPPINGS: Record<string, { problems: any[]; roleId: string }[]> = {
  'veterinarian': [{ problems: vetHealthProblems, roleId: 'veterinarian' }],
  'vet_clinic': [{ problems: vetHealthProblems, roleId: 'veterinarian' }],
  'pet_clinic': [{ problems: vetHealthProblems, roleId: 'veterinarian' }],
  'groomer': [{ problems: groomingNeeds, roleId: 'groomer' }],
  'pet_groomer': [{ problems: groomingNeeds, roleId: 'groomer' }],
  'grooming_center': [{ problems: groomingNeeds, roleId: 'groomer' }],
  'trainer': [{ problems: trainingGoals, roleId: 'trainer' }],
  'pet_trainer': [{ problems: trainingGoals, roleId: 'trainer' }],
  'training_center': [{ problems: trainingGoals, roleId: 'trainer' }],
  'walker': [{ problems: walkingNeeds, roleId: 'walker' }],
  'dog_walker': [{ problems: walkingNeeds, roleId: 'walker' }],
  'pet_walker': [{ problems: walkingNeeds, roleId: 'walker' }],
  'behaviourist': [{ problems: behavioralIssues, roleId: 'behaviourist' }],
  'behaviorist': [{ problems: behavioralIssues, roleId: 'behaviourist' }],
  'pet_behaviorist': [{ problems: behavioralIssues, roleId: 'behaviourist' }],
  'boarding': [{ problems: boardingNeeds, roleId: 'boarding' }],
  'pet_boarding': [{ problems: boardingNeeds, roleId: 'boarding' }],
  'boarding_center': [{ problems: boardingNeeds, roleId: 'boarding' }],
  'nutritionist': [{ problems: nutritionNeeds, roleId: 'nutritionist' }],
};

export async function populateProblemGridMappings(): Promise<{ inserted: number; errors: number }> {
  const client = getDbClient();
  let inserted = 0;
  let errors = 0;

  try {
    // Process each role
    for (const [roleKey, roleData] of Object.entries(ROLE_MAPPINGS)) {
      for (const { problems, roleId } of roleData) {
        for (const problem of problems) {
          if (!problem.mappedSubCategories || problem.mappedSubCategories.length === 0) {
            console.warn(`⚠️ Problem ${problem.id} has no mapped subcategories`);
            continue;
          }

          // Insert each subcategory mapping
          for (let i = 0; i < problem.mappedSubCategories.length; i++) {
            const subCategoryId = problem.mappedSubCategories[i];
            
            try {
              const { error } = await client.rpc('populate_problem_grid_mapping', {
                p_problem_id: problem.id,
                p_problem_name: problem.name,
                p_problem_display_name: problem.displayName || problem.name,
                p_role_id: roleId,
                p_sub_category_id: subCategoryId,
                p_sub_category_name: subCategoryId.replace('sub_', '').replace(/_/g, ' '),
                p_order_index: i
              });

              if (error) {
                console.error(`❌ Error inserting mapping for ${problem.id} → ${subCategoryId}:`, error);
                errors++;
              } else {
                inserted++;
              }
            } catch (err) {
              console.error(`❌ Exception inserting mapping for ${problem.id} → ${subCategoryId}:`, err);
              errors++;
            }
          }
        }
      }
    }

    console.log(`✅ Problem grid mappings populated: ${inserted} inserted, ${errors} errors`);
    return { inserted, errors };
  } catch (error) {
    console.error('❌ Error populating problem grid mappings:', error);
    throw error;
  }
}

