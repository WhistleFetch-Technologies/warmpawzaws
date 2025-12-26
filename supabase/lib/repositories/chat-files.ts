/**
 * ============================================================================
 * CHAT FILES REPOSITORY
 * ============================================================================
 * 
 * Repository for chat file attachments.
 * Replaces: chat:file:{fileId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ChatFile {
  id: string;
  file_id: string;
  booking_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_category: 'image' | 'video' | 'pdf' | 'file';
  file_url?: string | null;
  base64_data?: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  uploaded_at: string;
  created_at: string;
}

export interface CreateChatFileInput {
  file_id: string;
  booking_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_category: 'image' | 'video' | 'pdf' | 'file';
  file_url?: string;
  base64_data?: string;
  uploaded_by: string;
  uploaded_by_name: string;
}

export class ChatFilesRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Create a new chat file
   */
  async create(input: CreateChatFileInput): Promise<ChatFile> {
    const results = await insertQuery<ChatFile>("chat_files", {
      file_id: input.file_id,
      booking_id: input.booking_id,
      file_name: input.file_name,
      file_type: input.file_type,
      file_size: input.file_size,
      file_category: input.file_category,
      file_url: input.file_url || null,
      base64_data: input.base64_data || null,
      uploaded_by: input.uploaded_by,
      uploaded_by_name: input.uploaded_by_name,
    });

    if (!results[0]) {
      throw new Error("Failed to create chat file");
    }

    return results[0];
  }

  /**
   * Get file by file_id
   */
  async findByFileId(fileId: string): Promise<ChatFile | null> {
    const results = await selectQuery<ChatFile>("chat_files", 
      { file_id: fileId },
      { limit: 1 }
    );

    return results[0] || null;
  }

  /**
   * Get files for a booking
   */
  async findByBooking(bookingId: string): Promise<ChatFile[]> {
    return selectQuery<ChatFile>("chat_files", 
      { booking_id: bookingId },
      {
        orderBy: "created_at",
        orderDirection: "desc",
      }
    );
  }
}

let repositoryInstance: ChatFilesRepository | null = null;

export function getChatFilesRepository(): ChatFilesRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ChatFilesRepository();
  }
  return repositoryInstance;
}

