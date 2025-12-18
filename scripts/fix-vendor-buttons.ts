import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();
const vendorPath = join(projectRoot, 'src/components/vendor');

function getAllVendorFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    entries.forEach(entry => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        files.push(...getAllVendorFiles(fullPath));
      } else if (entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    });
  } catch {
    // Skip
  }
  return files;
}

const vendorFiles = getAllVendorFiles(vendorPath);
let fixedCount = 0;

vendorFiles.forEach(filePath => {
  try {
    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // Check if file has raw buttons
    if (!content.includes('<button')) {
      return; // Skip files without raw buttons
    }
    
    // Check if Button is already imported
    const hasButtonImport = content.includes("from '../ui/button'") ||
                           content.includes("from './ui/button'") ||
                           content.includes("from '../../ui/button'") ||
                           content.includes("from '../../../ui/button'") ||
                           content.includes("from '../../../../ui/button'");
    
    // Add Button import if not present
    if (!hasButtonImport && content.includes('import')) {
      // Find the last import statement
      const importMatch = content.match(/import.*from.*['"]/g);
      if (importMatch) {
        const lastImport = importMatch[importMatch.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        const nextLineIndex = content.indexOf('\n', lastImportIndex);
        
        // Determine relative path to ui/button
        const depth = filePath.split('/').length - vendorPath.split('/').length;
        const relativePath = '../'.repeat(depth) + 'ui/button';
        
        content = content.slice(0, nextLineIndex) + 
                 `\nimport { Button } from '${relativePath}';` + 
                 content.slice(nextLineIndex);
      }
    }
    
    // Replace common button patterns
    // Pattern 1: <button onClick={...} className={...}>
    content = content.replace(
      /<button\s+onClick=\{([^}]+)\}\s+className=\{([^}]+)\}([^>]*)>/g,
      '<Button onClick={$1} className={$2}$3>'
    );
    
    // Pattern 2: <button onClick={...}>
    content = content.replace(
      /<button\s+onClick=\{([^}]+)\}([^>]*)>/g,
      '<Button onClick={$1}$2>'
    );
    
    // Pattern 3: <button className={...}>
    content = content.replace(
      /<button\s+className=\{([^}]+)\}([^>]*)>/g,
      '<Button className={$1}$2>'
    );
    
    // Pattern 4: <button disabled={...}>
    content = content.replace(
      /<button\s+disabled=\{([^}]+)\}([^>]*)>/g,
      '<Button disabled={$1}$2>'
    );
    
    // Pattern 5: Generic <button>
    content = content.replace(
      /<button([^>]*)>/g,
      '<Button$1>'
    );
    
    // Replace </button> with </Button>
    content = content.replace(/<\/button>/g, '</Button>');
    
    // Add variant="outline" to buttons that have border classes
    content = content.replace(
      /<Button\s+([^>]*className=\{.*border[^}]*\}[^>]*)>/g,
      '<Button variant="outline" $1>'
    );
    
    // Add variant="ghost" to icon buttons
    content = content.replace(
      /<Button\s+([^>]*className=\{.*w-\d+.*h-\d+[^}]*\}[^>]*)>/g,
      '<Button variant="ghost" size="icon" $1>'
    );
    
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      fixedCount++;
      console.log(`Fixed: ${filePath.replace(projectRoot, '')}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
});

console.log(`\n✅ Fixed ${fixedCount} vendor component files`);

