/**
 * DATABASE CLIENT MODULE
 * 
 * Real PostgreSQL database connection for E2E testing
 * Provides actual database queries and validation
 */

import { Pool, QueryResult } from 'pg';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  connectionString: process.env.DB_CONNECTION_STRING || '',
  maxConnections: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// ============================================================================
// DATABASE CLIENT
// ============================================================================

export class DatabaseClient {
  private pool: Pool | null = null;

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.pool) return;

    if (!config.connectionString) {
      console.warn('⚠️  DB_CONNECTION_STRING not set, database validation will be skipped');
      return;
    }

    try {
      console.log('🗄️  Initializing database connection...');
      this.pool = new Pool({
        connectionString: config.connectionString,
        max: config.maxConnections,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
      });

      // Test connection
      await this.pool.query('SELECT 1');
      console.log('✅ Database connected');
    } catch (error: any) {
      console.error('❌ Database connection failed:', error.message);
      this.pool = null;
    }
  }

  /**
   * Execute query
   */
  async query(query: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      await this.initialize();
    }

    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      // Replace template variables like {{variableName}}
      const processedQuery = this.processTemplate(query);
      
      console.log(`     [DB] Executing query: ${processedQuery.substring(0, 100)}...`);
      const result = await this.pool.query(processedQuery, params);
      return result;
    } catch (error: any) {
      console.error(`     [DB] Query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process template variables in query
   */
  private processTemplate(query: string): string {
    // Replace {{variableName}} with actual values from environment or context
    // For now, just return as-is - can be enhanced with variable substitution
    return query;
  }

  /**
   * Select query
   */
  async select(query: string, params?: any[]): Promise<any[]> {
    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Count query
   */
  async count(query: string, params?: any[]): Promise<number> {
    const result = await this.query(query, params);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Check if record exists
   */
  async exists(query: string, params?: any[]): Promise<boolean> {
    const result = await this.query(query, params);
    return result.rows.length > 0;
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('🔒 Database connection closed');
    }
  }
}

// Singleton instance
export const databaseClient = new DatabaseClient();
