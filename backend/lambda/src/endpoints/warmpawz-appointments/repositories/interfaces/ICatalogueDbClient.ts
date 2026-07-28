import type { QueryResult } from 'pg';

export interface ICatalogueDbClient {
  query(text: string, params?: unknown[]): Promise<QueryResult>;
}
