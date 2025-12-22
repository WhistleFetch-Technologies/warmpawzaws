/**
 * Direct TypeScript script to populate problem grid mappings
 * Can be run with: deno run --allow-net --allow-env --allow-read scripts/populate-mappings-direct.ts
 */

import { populateProblemGridMappings } from "../supabase/lib/services/problem-grid-migration.ts";

console.log("🔄 Starting problem grid mappings population...");
console.log("");

try {
  const result = await populateProblemGridMappings();
  
  console.log("");
  console.log("✅ Success!");
  console.log(`   Inserted: ${result.inserted} mappings`);
  console.log(`   Errors: ${result.errors}`);
  
  if (result.errors > 0) {
    console.log("");
    console.log("⚠️  Some errors occurred. Check logs above.");
    Deno.exit(1);
  } else {
    console.log("");
    console.log("✅ All mappings populated successfully!");
    Deno.exit(0);
  }
} catch (error) {
  console.error("");
  console.error("❌ Error:", error);
  Deno.exit(1);
}

