/**
 * ============================================================================
 * UI CONFIG REPOSITORY
 * ============================================================================
 * 
 * Repository for UI configuration data access.
 * Replaces: config:ui:dashboard KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, upsertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface UIConfig {
  id: string;
  role_id: string;
  config_key: string; // 'dashboard', 'landing', etc.
  config_value: any; // JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUIConfigInput {
  role_id: string;
  config_key: string;
  config_value: any;
  is_active?: boolean;
}

export class UIConfigRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findByRole(roleId: string, configKey: string = 'dashboard'): Promise<UIConfig | null> {
    const results = await selectQuery<UIConfig>(
      "ui_configs",
      { role_id: roleId, config_key: configKey, is_active: true },
      { limit: 1 }
    );
    return results[0] || null;
  }

  async findAllByRole(roleId: string): Promise<UIConfig[]> {
    return selectQuery<UIConfig>(
      "ui_configs",
      { role_id: roleId, is_active: true },
      { orderBy: "config_key" }
    );
  }

  async findAll(): Promise<UIConfig[]> {
    return selectQuery<UIConfig>(
      "ui_configs",
      { is_active: true },
      { orderBy: "role_id" }
    );
  }

  async upsert(input: CreateUIConfigInput): Promise<UIConfig> {
    // Check if exists
    const existing = await this.findByRole(input.role_id, input.config_key);
    
    if (existing) {
      // Update
      const results = await updateQuery<UIConfig>(
        "ui_configs",
        { id: existing.id },
        {
          config_value: input.config_value,
          is_active: input.is_active !== false,
          updated_at: new Date().toISOString(),
        }
      );
      
      if (!results[0]) {
        throw new Error("Failed to update UI config");
      }
      
      return results[0];
    } else {
      // Create
      const results = await insertQuery<UIConfig>("ui_configs", {
        role_id: input.role_id,
        config_key: input.config_key,
        config_value: input.config_value,
        is_active: input.is_active !== false,
      });
      
      if (!results[0]) {
        throw new Error("Failed to create UI config");
      }
      
      return results[0];
    }
  }

  async delete(roleId: string, configKey: string): Promise<void> {
    await updateQuery<UIConfig>(
      "ui_configs",
      { role_id: roleId, config_key: configKey },
      { is_active: false }
    );
  }
}

let repositoryInstance: UIConfigRepository | null = null;

export function getUIConfigRepository(): UIConfigRepository {
  if (!repositoryInstance) {
    repositoryInstance = new UIConfigRepository();
  }
  return repositoryInstance;
}

