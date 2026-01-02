/**
 * PROBLEM GRID VENDOR GUIDE
 * Helper endpoint that shows vendors which subcategory names to use
 * when creating custom services to ensure they appear in problem grid searches
 */

import { Hono } from "hono";

export function problemGridVendorGuideEndpoints(app: Hono) {
  
  /**
   * GET /vendor/guide/subcategories/:roleId
   * Shows vendors which subcategory names they should use for their custom services
   */
  app.get("/make-server-3dd53475/vendor/guide/subcategories/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const { getSubcategoriesForVendorType } = await import('./problem-subcategory-mapping.tsx');
      const { subcategoryIdToNames } = await import('./problem-subcategory-mapping.tsx');
      const { getProblemGridByRole } = await import('./problem-grid-catalog.tsx');
      
      // Get subcategories for this role
      const subcategoryIds = getSubcategoriesForVendorType(roleId);
      
      if (subcategoryIds.length === 0) {
        return c.json({
          success: false,
          error: `No subcategories found for roleId: ${roleId}`,
          supportedRoles: ['veterinarian', 'groomer', 'pet_trainer', 'pet_walker', 'behaviourist', 'pet_boarder']
        }, 400);
      }
      
      // Get problem grid for context
      const problemGrid = getProblemGridByRole(roleId);
      
      // Build guide
      const guide: any = {
        roleId,
        roleName: getRoleName(roleId),
        totalSubcategories: subcategoryIds.length,
        totalProblems: problemGrid.length,
        subcategories: [] as any[],
        problemContext: [] as any[]
      };
      
      // Add subcategory details
      subcategoryIds.forEach(subCatId => {
        const names = subcategoryIdToNames[subCatId] || [];
        if (names.length > 0) {
          guide.subcategories.push({
            id: subCatId,
            primaryName: names[0],
            alternativeNames: names.slice(1),
            useThisExactly: names[0], // ⭐ Most important field
            exampleUsage: `When creating a service, set: subCategoryName: "${names[0]}"`
          });
        }
      });
      
      // Add problem context
      problemGrid.forEach((problem: any) => {
        guide.problemContext.push({
          problemId: problem.id,
          customerSees: problem.displayName,
          icon: problem.icon,
          mapsToSubcategories: problem.mappedSubCategories,
          explanation: `Services with these subcategories will appear when customers search for "${problem.displayName}"`
        });
      });
      
      return c.json({
        success: true,
        guide,
        instructions: {
          step1: 'When creating a custom service, you MUST set a subCategoryName',
          step2: 'Use EXACTLY one of the "primaryName" values from the subcategories list above',
          step3: 'This ensures your service appears in customer problem-based searches',
          step4: 'Example: { serviceName: "My Service", subCategoryName: "Basic Grooming Services", ... }',
          important: 'Spelling and capitalization must match exactly!'
        }
      });
      
    } catch (error) {
      console.error('❌ Error generating vendor guide:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /vendor/guide/problems/:roleId
   * Shows vendors what problems customers can search for, and how to make services appear
   */
  app.get("/make-server-3dd53475/vendor/guide/problems/:roleId", async (c) => {
    try {
      const { roleId } = c.req.param();
      
      const { getProblemGridByRole } = await import('./problem-grid-catalog.tsx');
      const { subcategoryIdToNames } = await import('./problem-subcategory-mapping.tsx');
      
      const problemGrid = getProblemGridByRole(roleId);
      
      if (problemGrid.length === 0) {
        return c.json({
          success: false,
          error: `No problems found for roleId: ${roleId}`,
          supportedRoles: ['veterinarian', 'groomer', 'pet_trainer', 'pet_walker', 'behaviourist', 'pet_boarder']
        }, 400);
      }
      
      const guide: any = {
        roleId,
        roleName: getRoleName(roleId),
        totalProblems: problemGrid.length,
        problems: [] as any[]
      };
      
      problemGrid.forEach((problem: any) => {
        const subcategoryNames = problem.mappedSubCategories.map((subCatId: string) => {
          const names = subcategoryIdToNames[subCatId] || [];
          return names[0]; // Primary name
        }).filter(Boolean);
        
        guide.problems.push({
          id: problem.id,
          customerSees: problem.displayName,
          icon: problem.icon,
          description: problem.description,
          toAppearInThisSearch: {
            createServicesWithSubcategories: subcategoryNames,
            example: subcategoryNames.length > 0 
              ? `Set subCategoryName: "${subcategoryNames[0]}"`
              : 'No subcategories mapped'
          },
          customerBehavior: `When customer clicks "${problem.displayName}", they see vendors with services in: ${subcategoryNames.join(', ')}`
        });
      });
      
      return c.json({
        success: true,
        guide
      });
      
    } catch (error) {
      console.error('❌ Error generating problem guide:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

function getRoleName(roleId: string): string {
  const roleNames: Record<string, string> = {
    'veterinarian': 'Veterinarian',
    'vet_clinic': 'Vet Clinic',
    'pet_clinic': 'Pet Clinic',
    'groomer': 'Pet Groomer',
    'pet_groomer': 'Pet Groomer',
    'grooming_center': 'Grooming Center',
    'trainer': 'Pet Trainer',
    'pet_trainer': 'Pet Trainer',
    'training_center': 'Training Center',
    'dog_walker': 'Dog Walker',
    'pet_walker': 'Pet Walker',
    'behaviourist': 'Pet Behaviorist',
    'behaviorist': 'Pet Behaviorist',
    'pet_behaviorist': 'Pet Behaviorist',
    'boarding': 'Pet Boarding',
    'pet_boarding': 'Pet Boarding',
    'boarding_center': 'Boarding Center',
  };
  
  return roleNames[roleId] || roleId;
}
