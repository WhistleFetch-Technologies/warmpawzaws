#!/usr/bin/env node

/**
 * Enhanced Design Analyzer - Extracts detailed component placement, styling, and structure
 */

const fs = require('fs');
const path = require('path');

function extractDetailedStructure(content) {
  const structure = {
    containers: [],
    buttons: [],
    inputs: [],
    cards: [],
    headers: [],
    navigation: [],
    spacing: {},
  };
  
  // Extract container patterns
  const containerPatterns = [
    /className=["']([^"']*(?:container|wrapper|section|main|content)[^"']*)["']/g,
    /className=["']([^"']*(?:flex|grid)[^"']*)["']/g,
  ];
  
  containerPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const classes = match[1].split(' ');
      structure.containers.push({
        classes,
        hasFlex: classes.some(c => c.includes('flex')),
        hasGrid: classes.some(c => c.includes('grid')),
        spacing: classes.filter(c => c.match(/[mp][xy]?-\d+|gap-\d+/)),
      });
    }
  });
  
  // Extract button patterns
  const buttonPatterns = [
    /<button[^>]*className=["']([^"']*)["']/g,
    /<Button[^>]*className=["']([^"']*)["']/g,
  ];
  
  buttonPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const classes = match[1].split(' ');
      structure.buttons.push({
        classes,
        colors: classes.filter(c => c.match(/bg-|text-|border-/)),
        size: classes.filter(c => c.match(/px-\d+|py-\d+|p-\d+|text-\w+/)),
        shape: classes.filter(c => c.match(/rounded-/)),
      });
    }
  });
  
  // Extract input patterns
  const inputPatterns = [
    /<input[^>]*className=["']([^"']*)["']/g,
    /<Input[^>]*className=["']([^"']*)["']/g,
  ];
  
  inputPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const classes = match[1].split(' ');
      structure.inputs.push({
        classes,
        colors: classes.filter(c => c.match(/bg-|text-|border-/)),
        size: classes.filter(c => c.match(/px-\d+|py-\d+|p-\d+/)),
        shape: classes.filter(c => c.match(/rounded-/)),
      });
    }
  });
  
  // Extract card patterns
  const cardPatterns = [
    /className=["']([^"']*(?:card|Card)[^"']*)["']/g,
  ];
  
  cardPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const classes = match[1].split(' ');
      structure.cards.push({
        classes,
        colors: classes.filter(c => c.match(/bg-|text-/)),
        shadows: classes.filter(c => c.match(/shadow-/)),
        spacing: classes.filter(c => c.match(/p-\d+|px-\d+|py-\d+/)),
      });
    }
  });
  
  // Extract header patterns
  const headerPatterns = [
    /<header[^>]*className=["']([^"']*)["']/g,
    /<Header[^>]*className=["']([^"']*)["']/g,
  ];
  
  headerPatterns.forEach(pattern => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const classes = match[1].split(' ');
      structure.headers.push({
        classes,
        colors: classes.filter(c => c.match(/bg-|text-/)),
        position: classes.filter(c => c.match(/sticky|fixed|absolute/)),
      });
    }
  });
  
  return structure;
}

function extractColorUsage(content) {
  const colorUsage = {
    primary: [],
    secondary: [],
    semantic: [],
    hardcoded: [],
  };
  
  // Extract all color classes
  const colorClasses = content.matchAll(/(?:bg|text|border)-(?:primary|orange|pink|blue|green|purple|teal|gray|red|yellow|green)-\d+/g);
  for (const match of colorClasses) {
    const color = match[0];
    if (color.includes('primary') || color.includes('orange')) {
      colorUsage.primary.push(color);
    } else if (color.includes('pink') || color.includes('purple')) {
      colorUsage.secondary.push(color);
    } else if (color.includes('success') || color.includes('error') || color.includes('warning')) {
      colorUsage.semantic.push(color);
    }
  }
  
  // Extract hardcoded hex colors
  const hexColors = content.matchAll(/#[0-9A-Fa-f]{6}/g);
  for (const match of hexColors) {
    colorUsage.hardcoded.push(match[0]);
  }
  
  return colorUsage;
}

function extractLayoutStructure(content) {
  const layout = {
    maxWidth: [],
    padding: [],
    margin: [],
    gaps: [],
    flexDirection: [],
    alignItems: [],
    justifyContent: [],
    gridColumns: [],
  };
  
  // Extract max-width constraints
  const maxWidthMatches = content.matchAll(/max-w-\[?(\d+px|\w+)\]?/g);
  for (const match of maxWidthMatches) {
    layout.maxWidth.push(match[0]);
  }
  
  // Extract padding
  const paddingMatches = content.matchAll(/p[xylrtb]?-\d+/g);
  for (const match of paddingMatches) {
    layout.padding.push(match[0]);
  }
  
  // Extract margin
  const marginMatches = content.matchAll(/m[xylrtb]?-\d+/g);
  for (const match of marginMatches) {
    layout.margin.push(match[0]);
  }
  
  // Extract gaps
  const gapMatches = content.matchAll(/gap-\d+|space-[xy]-\d+/g);
  for (const match of gapMatches) {
    layout.gaps.push(match[0]);
  }
  
  // Extract flex direction
  const flexDirMatches = content.matchAll(/flex-(col|row)/g);
  for (const match of flexDirMatches) {
    layout.flexDirection.push(match[0]);
  }
  
  // Extract alignment
  const alignMatches = content.matchAll(/(items|justify)-(center|start|end|between|around)/g);
  for (const match of alignMatches) {
    if (match[1] === 'items') {
      layout.alignItems.push(match[0]);
    } else {
      layout.justifyContent.push(match[0]);
    }
  }
  
  // Extract grid columns
  const gridMatches = content.matchAll(/grid-cols-\d+|grid-cols-\[.*?\]/g);
  for (const match of gridMatches) {
    layout.gridColumns.push(match[0]);
  }
  
  return layout;
}

function analyzeFileEnhanced(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const structure = extractDetailedStructure(content);
    const colorUsage = extractColorUsage(content);
    const layout = extractLayoutStructure(content);
    
    return {
      structure,
      colorUsage,
      layout,
    };
  } catch (error) {
    return null;
  }
}

// Main execution
const analysisPath = path.join(process.cwd(), 'DESIGN_AUDIT_ANALYSIS.json');
const data = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

console.log('🔍 Enhancing analysis with detailed structure information...');

const enhancedData = {
  ...data,
  screens: data.screens.map(screen => {
    const filePath = path.join(process.cwd(), screen.filePath);
    if (fs.existsSync(filePath)) {
      const enhanced = analyzeFileEnhanced(filePath);
      if (enhanced) {
        return {
          ...screen,
          detailedStructure: enhanced.structure,
          colorUsage: enhanced.colorUsage,
          layoutStructure: enhanced.layout,
        };
      }
    }
    return screen;
  }),
};

const enhancedPath = path.join(process.cwd(), 'DESIGN_AUDIT_ANALYSIS_ENHANCED.json');
fs.writeFileSync(enhancedPath, JSON.stringify(enhancedData, null, 2));

console.log(`✅ Enhanced analysis saved to: ${enhancedPath}`);

