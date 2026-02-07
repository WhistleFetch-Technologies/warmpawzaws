/**
 * ============================================================================
 * ENVIRONMENT VARIABLE VALIDATION
 * ============================================================================
 * 
 * Validates all required environment variables at startup
 * Fails fast if critical variables are missing
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

interface EnvVarConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
}

// ============================================================================
// ENVIRONMENT VARIABLE DEFINITIONS
// ============================================================================

const ENV_VARS: EnvVarConfig[] = [
  // Database (Critical)
  {
    name: 'DB_HOST',
    required: true,
    description: 'RDS PostgreSQL hostname',
  },
  {
    name: 'DB_NAME',
    required: true,
    description: 'RDS PostgreSQL database name',
  },
  {
    name: 'DB_SECRET_ARN',
    required: false,
    description: 'AWS Secrets Manager ARN for database credentials (required if DB_USER/DB_PASSWORD not set)',
  },
  {
    name: 'DB_USER',
    required: false,
    description: 'Database username (required if DB_SECRET_ARN not set)',
  },
  {
    name: 'DB_PASSWORD',
    required: false,
    description: 'Database password (required if DB_SECRET_ARN not set)',
  },
  {
    name: 'DB_PORT',
    required: false,
    defaultValue: '5432',
    description: 'Database port',
  },
  {
    name: 'DB_SSL',
    required: false,
    defaultValue: 'false',
    description: 'Enable SSL for database connection',
  },
  
  // AWS Configuration
  {
    name: 'AWS_REGION',
    required: false,
    defaultValue: 'ap-south-1',
    description: 'AWS region',
  },
  
  // Cognito (Optional - may use UAT mode)
  {
    name: 'COGNITO_CUSTOMER_POOL_ID',
    required: false,
    description: 'Cognito customer user pool ID',
  },
  {
    name: 'COGNITO_VENDOR_POOL_ID',
    required: false,
    description: 'Cognito vendor user pool ID',
  },
  {
    name: 'COGNITO_ADMIN_POOL_ID',
    required: false,
    description: 'Cognito admin user pool ID',
  },
  
  // SNS Topics (Optional - features may be disabled)
  {
    name: 'SNS_VENDOR_NOTIFICATIONS_ARN',
    required: false,
    description: 'SNS topic ARN for vendor notifications',
  },
  {
    name: 'SNS_CUSTOMER_NOTIFICATIONS_ARN',
    required: false,
    description: 'SNS topic ARN for customer notifications',
  },
  {
    name: 'SNS_PLATFORM_NOTIFICATIONS_ARN',
    required: false,
    description: 'SNS topic ARN for platform notifications',
  },
  {
    name: 'SNS_BOOKING_EVENTS_ARN',
    required: false,
    description: 'SNS topic ARN for booking events',
  },
  {
    name: 'SNS_PAYMENT_EVENTS_ARN',
    required: false,
    description: 'SNS topic ARN for payment events',
  },
  
  // SQS Queues (Optional - features may be disabled)
  {
    name: 'SQS_NOTIFICATION_QUEUE_URL',
    required: false,
    description: 'SQS queue URL for notifications',
  },
  {
    name: 'SQS_BOOKING_QUEUE_URL',
    required: false,
    description: 'SQS queue URL for bookings',
  },
  {
    name: 'SQS_PAYMENT_QUEUE_URL',
    required: false,
    description: 'SQS queue URL for payments',
  },
  {
    name: 'SQS_SETTLEMENT_QUEUE_URL',
    required: false,
    description: 'SQS queue URL for settlements',
  },
  {
    name: 'SQS_SEARCH_INDEX_QUEUE_URL',
    required: false,
    description: 'SQS queue URL for search indexing',
  },
  
  // S3 Buckets (Optional - defaults provided)
  {
    name: 'S3_DOCUMENTS_BUCKET',
    required: false,
    defaultValue: 'warmpawz-documents',
    description: 'S3 bucket for documents',
  },
  {
    name: 'S3_UPLOADS_BUCKET',
    required: false,
    defaultValue: 'warmpawz-uploads',
    description: 'S3 bucket for uploads',
  },
  {
    name: 'S3_MEDIA_BUCKET',
    required: false,
    defaultValue: 'warmpawz-media',
    description: 'S3 bucket for media',
  },
  
  // Application Configuration
  {
    name: 'NODE_ENV',
    required: false,
    defaultValue: 'development',
    description: 'Node environment (development, staging, production)',
  },
  {
    name: 'ENVIRONMENT',
    required: false,
    description: 'Deployment environment',
  },
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate database credentials configuration
 * Either DB_SECRET_ARN or (DB_USER + DB_PASSWORD) must be provided
 */
function validateDatabaseCredentials(): { valid: boolean; error?: string } {
  const hasSecretArn = !!process.env.DB_SECRET_ARN;
  const hasUser = !!process.env.DB_USER;
  const hasPassword = !!process.env.DB_PASSWORD;
  
  if (hasSecretArn) {
    return { valid: true };
  }
  
  if (hasUser && hasPassword) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: 'Database credentials not configured. Provide either DB_SECRET_ARN or both DB_USER and DB_PASSWORD',
  };
}

/**
 * Validate all environment variables
 */
export function validateEnvironment(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check required variables
  for (const config of ENV_VARS) {
    const value = process.env[config.name];
    
    if (config.required && !value && !config.defaultValue) {
      missing.push(config.name);
    }
  }
  
  // Validate database credentials
  const dbCredsValidation = validateDatabaseCredentials();
  if (!dbCredsValidation.valid) {
    errors.push(dbCredsValidation.error!);
  }
  
  // Check for common misconfigurations
  if (process.env.NODE_ENV === 'production' && !process.env.DB_SECRET_ARN) {
    warnings.push('Production environment should use DB_SECRET_ARN instead of DB_USER/DB_PASSWORD');
  }
  
  if (process.env.NODE_ENV === 'production' && process.env.UAT_MODE === 'true') {
    warnings.push('UAT_MODE should not be enabled in production');
  }
  
  // Validate DB_PORT is a number if provided
  if (process.env.DB_PORT) {
    const port = parseInt(process.env.DB_PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`DB_PORT must be a valid port number (1-65535), got: ${process.env.DB_PORT}`);
    }
  }
  
  // Validate AWS_REGION format
  if (process.env.AWS_REGION && !/^[a-z0-9-]+$/.test(process.env.AWS_REGION)) {
    warnings.push(`AWS_REGION format may be invalid: ${process.env.AWS_REGION}`);
  }
  
  const valid = missing.length === 0 && errors.length === 0;
  
  return {
    valid,
    missing,
    warnings,
    errors,
  };
}

/**
 * Get environment variable with validation
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  
  if (!value && defaultValue) {
    return defaultValue;
  }
  
  if (!value) {
    throw new Error(`Environment variable ${name} is not set and no default value provided`);
  }
  
  return value;
}

/**
 * Validate and throw if environment is invalid
 * Call this at application startup
 */
export function validateEnvironmentOrThrow(): void {
  const result = validateEnvironment();
  
  if (!result.valid) {
    const errorMessages: string[] = [];
    
    if (result.missing.length > 0) {
      errorMessages.push(`Missing required environment variables: ${result.missing.join(', ')}`);
    }
    
    if (result.errors.length > 0) {
      errorMessages.push(`Configuration errors: ${result.errors.join('; ')}`);
    }
    
    throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
  }
  
  // Log warnings but don't fail
  if (result.warnings.length > 0) {
    console.warn('[ENV] Environment validation warnings:');
    result.warnings.forEach(warning => console.warn(`[ENV] ⚠️  ${warning}`));
  }
  
  console.log('[ENV] ✅ Environment validation passed');
}

/**
 * Get validation report as formatted string
 */
export function getValidationReport(): string {
  const result = validateEnvironment();
  const lines: string[] = [];
  
  lines.push('=== Environment Variable Validation Report ===\n');
  
  if (result.valid) {
    lines.push('✅ All required environment variables are set\n');
  } else {
    lines.push('❌ Environment validation failed\n');
  }
  
  if (result.missing.length > 0) {
    lines.push('Missing Required Variables:');
    result.missing.forEach(name => {
      const config = ENV_VARS.find(v => v.name === name);
      lines.push(`  - ${name}${config?.description ? ` (${config.description})` : ''}`);
    });
    lines.push('');
  }
  
  if (result.errors.length > 0) {
    lines.push('Configuration Errors:');
    result.errors.forEach(error => lines.push(`  - ${error}`));
    lines.push('');
  }
  
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    result.warnings.forEach(warning => lines.push(`  - ${warning}`));
    lines.push('');
  }
  
  // Show all configured variables (without sensitive values)
  lines.push('Configured Variables:');
  ENV_VARS.forEach(config => {
    const value = process.env[config.name];
    if (value) {
      // Mask sensitive values
      const displayValue = config.name.includes('PASSWORD') || config.name.includes('SECRET')
        ? '***'
        : value;
      lines.push(`  ✅ ${config.name} = ${displayValue}`);
    } else if (config.defaultValue) {
      lines.push(`  ⚪ ${config.name} = ${config.defaultValue} (default)`);
    } else if (!config.required) {
      lines.push(`  ⚪ ${config.name} = (not set, optional)`);
    }
  });
  
  return lines.join('\n');
}
