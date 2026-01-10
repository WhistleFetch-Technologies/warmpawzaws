/**
 * Supabase Client for Vendor Web
 * AWS Serverless compatible - uses environment variables
 */

import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

