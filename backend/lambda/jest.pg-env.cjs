/** Satisfy rds-connection.ts top-level env check when running Jest (no real DB connection). */
if (!process.env.DB_HOST) process.env.DB_HOST = '127.0.0.1';
if (!process.env.DB_NAME) process.env.DB_NAME = 'jest_placeholder';
