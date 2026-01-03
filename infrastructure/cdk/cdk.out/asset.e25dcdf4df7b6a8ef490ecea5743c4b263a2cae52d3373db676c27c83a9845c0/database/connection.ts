import { Pool, PoolConfig } from 'pg';

/**
 * Database connection pool
 * Singleton pattern for connection management
 */
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool | null = null;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Initialize database connection pool
   */
  public initialize(config?: PoolConfig): void {
    if (this.pool) {
      console.warn('Database pool already initialized');
      return;
    }

    const poolConfig: PoolConfig = config || {
      host: process.env.AURORA_HOST || 'localhost',
      port: parseInt(process.env.AURORA_PORT || '5432', 10),
      database: process.env.AURORA_DATABASE || 'warmpawz',
      user: process.env.AURORA_USER || 'warmpawz',
      password: process.env.AURORA_PASSWORD || 'warmpawz',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  /**
   * Get database connection pool
   */
  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.pool;
  }

  /**
   * Close database connection pool
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Health check - test database connection
   */
  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const db = DatabaseConnection.getInstance();

