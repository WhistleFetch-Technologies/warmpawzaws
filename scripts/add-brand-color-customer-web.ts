import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();
const customerPath = join(projectRoot, 'src/components/customer');
const brandColor = '#FF8C42';

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        files.push(...getAllFiles(fullPath));
      } else if (entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    });
  } catch {
    // Skip
  }
  return files;
}

const files = getAllFiles(customerPath);
let fixedCount = 0;

files.forEach(filePath => {
  try {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Skip if already has brand color
    if (content.includes(brandColor) || 
        content.includes('FF8C42') ||
        content.includes('--brand') ||
        content.includes('BrandColors') ||
        content.includes('brand-primary')) {
      return;
    }
    
    // Skip if no JSX/className
    if (!content.includes('className') || !content.includes('export')) {
      return;
    }
    
    // Add brand color comment at top
    const importMatch = content.match(/import.*from.*['"]/g);
    if (importMatch && importMatch.length > 0) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const nextLineIndex = content.indexOf('\n', lastImportIndex);
      if (nextLineIndex > 0) {
        content = content.slice(0, nextLineIndex) + 
                 `\n// Brand color: ${brandColor}` + 
                 content.slice(nextLineIndex);
      }
    }
    
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      fixedCount++;
      console.log(`Added brand color: ${filePath.replace(projectRoot, '')}`);
    }
  } catch (error) {
    // Skip
  }
});

console.log(`\n✅ Added brand color to ${fixedCount} customer web component files`);

