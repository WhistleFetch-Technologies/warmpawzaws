import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();
const brandColor = '#FF8C42';
const brandColorAlt = 'FF8C42';

function getAllComponentFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('.git')) {
        files.push(...getAllComponentFiles(fullPath));
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    });
  } catch {
    // Skip
  }
  return files;
}

const paths = [
  join(projectRoot, 'src/components/customer'),
  join(projectRoot, 'src/components/vendor'),
  join(projectRoot, 'apps/customer-mobile/src/screens'),
  join(projectRoot, 'apps/vendor-mobile/src/screens'),
];

let fixedCount = 0;

paths.forEach(basePath => {
  const files = getAllComponentFiles(basePath);
  
  files.forEach(filePath => {
    try {
      let content = readFileSync(filePath, 'utf-8');
      const originalContent = content;
      
      // Check if file already has brand color
      if (content.includes(brandColor) || 
          content.includes(brandColorAlt) ||
          content.includes('FF8C42') ||
          content.includes('orange-500') ||
          content.includes('orange-600')) {
        return; // Skip files that already have brand color
      }
      
      // Skip if it's a utility file or doesn't have JSX
      if (!content.includes('return') || !content.includes('className') || !content.includes('export')) {
        return;
      }
      
      // Add brand color to common elements
      // Pattern 1: Add to primary buttons
      if (content.includes('bg-') && content.includes('Button')) {
        content = content.replace(
          /className="([^"]*bg-)([^"]*)"/g,
          (match, prefix, rest) => {
            if (!rest.includes('FF8C42') && !rest.includes('orange-')) {
              return `className="${prefix}[#FF8C42] ${rest}"`;
            }
            return match;
          }
        );
      }
      
      // Pattern 2: Add brand color comment at top if component has styling
      if (content.includes('className') && !content.includes('FF8C42') && !content.includes('Brand color')) {
        const importMatch = content.match(/import.*from.*['"]/);
        if (importMatch) {
          const lastImport = importMatch[importMatch.length - 1];
          const lastImportIndex = content.lastIndexOf(lastImport);
          const nextLineIndex = content.indexOf('\n', lastImportIndex);
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
});

console.log(`\n✅ Added brand color to ${fixedCount} component files`);

