#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Systematic KV to SQL Migration Script
 * 
 * Migrates remaining files from KV store to SQL repositories
 */

interface MigrationTask {
  file: string;
  kvOperations: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  repository?: string;
  notes?: string;
}

const MIGRATION_PATTERNS = {
  // Customer operations
  'customer:': { repo: 'CustomersRepository', method: 'findById' },
  'customer:phone:': { repo: 'CustomersRepository', method: 'findByPhone' },
  
  // Vendor operations
  'vendor:': { repo: 'VendorsRepository', method: 'findById' },
  'vendor:bookings': { repo: 'BookingsRepository', method: 'findByVendor' },
  'vendor:services': { repo: 'ServicesRepository', method: 'findByVendor' },
  
  // Booking operations
  'booking:': { repo: 'BookingsRepository', method: 'findById' },
  'booking:otp': { repo: 'OtpRepository', method: 'create' },
  
  // Staff operations
  'staff:': { repo: 'StaffRepository', method: 'findById' },
  'doctor:': { repo: 'StaffRepository', method: 'findById' },
  
  // Pet operations
  'pet:': { repo: 'PetsRepository', method: 'findById' },
  
  // Service operations
  'service:': { repo: 'ServicesRepository', method: 'findById' },
  
  // Payment operations
  'payment:': { repo: 'PaymentsRepository', method: 'findById' },
  
  // Delivery operations
  'delivery:': { repo: 'DeliveriesRepository', method: 'findById' },
  
  // Promotion operations
  'marketing:promotions': { repo: 'PromotionsRepository', method: 'findAll' },
  
  // UI Config operations
  'config:ui:': { repo: 'UIConfigRepository', method: 'get' },
  
  // Role operations
  'role:config:': { repo: 'RolesRepository', method: 'getConfig' },
  
  // Notification operations
  'notification:': { repo: 'NotificationsRepository', method: 'findByRecipient' },
};

async function analyzeFile(filePath: string): Promise<MigrationTask | null> {
  try {
    const content = await Deno.readTextFile(filePath);
    
    const kvMatches = [
      ...content.matchAll(/kv\.get\s*\(/g),
      ...content.matchAll(/kv\.set\s*\(/g),
      ...content.matchAll(/kv\.del\s*\(/g),
      ...content.matchAll(/kv\.getByPrefix\s*\(/g),
    ];
    
    if (kvMatches.length === 0) {
      return null; // File already migrated
    }
    
    // Determine priority based on file name and usage
    let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    if (filePath.includes('booking') || filePath.includes('payment') || filePath.includes('payout')) {
      priority = 'critical';
    } else if (filePath.includes('vendor') || filePath.includes('customer') || filePath.includes('staff')) {
      priority = 'high';
    }
    
    // Identify which repository is needed
    let repository: string | undefined;
    for (const [pattern, info] of Object.entries(MIGRATION_PATTERNS)) {
      if (content.includes(pattern)) {
        repository = info.repo;
        break;
      }
    }
    
    return {
      file: filePath,
      kvOperations: kvMatches.length,
      priority,
      repository,
      notes: `Found ${kvMatches.length} KV operations`,
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
    return null;
  }
}

async function generateMigrationReport(): Promise<void> {
  console.log('🔍 Analyzing remaining KV usage...\n');
  
  const tasks: MigrationTask[] = [];
  const criticalDir = 'supabase/functions/make-server-3dd53475';
  
  for await (const entry of Deno.readDir(criticalDir)) {
    if (entry.isFile && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const filePath = `${criticalDir}/${entry.name}`;
      const task = await analyzeFile(filePath);
      if (task) {
        tasks.push(task);
      }
    }
  }
  
  // Sort by priority and operations count
  tasks.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.kvOperations - a.kvOperations;
  });
  
  // Generate report
  console.log(`📊 Migration Report:\n`);
  console.log(`Total files to migrate: ${tasks.length}\n`);
  
  const byPriority = {
    critical: tasks.filter(t => t.priority === 'critical'),
    high: tasks.filter(t => t.priority === 'high'),
    medium: tasks.filter(t => t.priority === 'medium'),
    low: tasks.filter(t => t.priority === 'low'),
  };
  
  console.log(`Critical: ${byPriority.critical.length} files`);
  console.log(`High: ${byPriority.high.length} files`);
  console.log(`Medium: ${byPriority.medium.length} files`);
  console.log(`Low: ${byPriority.low.length} files\n`);
  
  console.log('Top 20 Critical Files:\n');
  byPriority.critical.slice(0, 20).forEach((task, i) => {
    console.log(`${i + 1}. ${task.file.split('/').pop()}`);
    console.log(`   Operations: ${task.kvOperations}, Repository: ${task.repository || 'TBD'}\n`);
  });
  
  // Save to file
  const report = {
    generated: new Date().toISOString(),
    totalFiles: tasks.length,
    byPriority,
    allTasks: tasks,
  };
  
  await Deno.writeTextFile(
    'KV_MIGRATION_REPORT.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('✅ Report saved to KV_MIGRATION_REPORT.json');
}

if (import.meta.main) {
  await generateMigrationReport();
}

