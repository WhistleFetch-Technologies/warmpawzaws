/**
 * Script to find all KV store usage in codebase
 * Helps identify what needs to be migrated to SQL
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

interface KvUsage {
  file: string;
  line: number;
  code: string;
  operation: 'get' | 'set' | 'delete' | 'getByPrefix' | 'list';
}

async function findKvUsage(dir: string): Promise<KvUsage[]> {
  const usages: KvUsage[] = [];
  
  async function scanDirectory(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and dist
        if (!entry.name.includes('node_modules') && !entry.name.includes('dist')) {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        try {
          const content = await readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            // Look for KV operations
            if (line.includes('kv.get(') || line.includes('kv.set(') || 
                line.includes('kv.delete(') || line.includes('kv.getByPrefix(') ||
                line.includes('kv.list(')) {
              
              let operation: KvUsage['operation'] = 'get';
              if (line.includes('kv.set(')) operation = 'set';
              else if (line.includes('kv.delete(')) operation = 'delete';
              else if (line.includes('kv.getByPrefix(')) operation = 'getByPrefix';
              else if (line.includes('kv.list(')) operation = 'getByPrefix';
              
              usages.push({
                file: fullPath,
                line: index + 1,
                code: line.trim(),
                operation,
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  }
  
  await scanDirectory(dir);
  return usages;
}

// Run if executed directly
if (require.main === module) {
  findKvUsage(process.cwd())
    .then(usages => {
      console.log(`Found ${usages.length} KV usages:\n`);
      usages.forEach(usage => {
        console.log(`${usage.file}:${usage.line}`);
        console.log(`  ${usage.operation}: ${usage.code}`);
        console.log();
      });
    })
    .catch(console.error);
}

export { findKvUsage };

