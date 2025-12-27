/**
 * Storage Handler - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: Removed KV import (unused)
 * 
 * Handles file uploads to Supabase Storage
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (0 KV ops removed - import was unused)
 * Endpoints: 4
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { ensureBucket } from "./bucket-manager.tsx";

export function registerStorageEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
  const BUCKET_NAME = 'make-3dd53475-general-storage';

  // Initialize storage bucket (non-blocking, fire-and-forget)
  ensureBucket(BUCKET_NAME, {
    public: false,
    fileSizeLimit: 10485760 // 10MB
  }).catch(err => console.warn('⚠️ Storage bucket init warning:', err));

  // Upload document endpoint
  app.post(`${BASE_PATH}/storage/upload`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const vendorId = formData.get('vendorId') as string;
      const documentType = formData.get('documentType') as string;
      
      if (!file || !vendorId || !documentType) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      console.log(`📤 Uploading file: ${file.name} for vendor: ${vendorId}`);
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Generate unique filename
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}/${documentType}_${timestamp}.${fileExt}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, uint8Array, {
          contentType: file.type,
          upsert: true
        });

      if (error) {
        console.error('❌ Upload error:', error);
        return c.json({ error: error.message }, 500);
      }

      console.log('✅ File uploaded successfully:', fileName);

      // Generate signed URL (valid for 1 year)
      const { data: signedUrlData } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(fileName, 31536000); // 1 year in seconds

      if (!signedUrlData) {
        return c.json({ error: 'Failed to generate signed URL' }, 500);
      }

      return c.json({
        success: true,
        fileName: fileName,
        url: signedUrlData.signedUrl,
        publicUrl: signedUrlData.signedUrl
      });

    } catch (error) {
      console.error('❌ Error uploading file:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Upload multiple documents endpoint
  app.post(`${BASE_PATH}/storage/upload-multiple`, async (c) => {
    try {
      const formData = await c.req.formData();
      const vendorId = formData.get('vendorId') as string;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const uploadResults = [];
      const entries = Array.from(formData.entries());

      for (const [key, value] of entries) {
        if (value instanceof File && key !== 'vendorId') {
          const file = value;
          const documentType = key; // The field name is the document type
          
          console.log(`📤 Uploading: ${documentType} - ${file.name}`);
          
          // Generate unique filename
          const timestamp = Date.now();
          const random = Math.random().toString(36).substr(2, 9);
          const fileExt = file.name.split('.').pop();
          const fileName = `${vendorId}/${documentType}_${timestamp}_${random}.${fileExt}`;

          // Convert File to ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, uint8Array, {
              contentType: file.type,
              upsert: true
            });

          if (error) {
            console.error(`❌ Upload error for ${documentType}:`, error);
            uploadResults.push({
              documentType,
              success: false,
              error: error.message
            });
            continue;
          }

          // Generate signed URL (valid for 1 year)
          const { data: signedUrlData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 31536000);

          if (signedUrlData) {
            uploadResults.push({
              documentType,
              success: true,
              fileName: fileName,
              originalName: file.name,
              url: signedUrlData.signedUrl,
              type: file.type.startsWith('image/') ? 'image' : 'document'
            });
            console.log(`✅ Uploaded: ${documentType}`);
          }
        }
      }

      return c.json({
        success: true,
        uploads: uploadResults,
        totalUploaded: uploadResults.filter(r => r.success).length,
        totalFailed: uploadResults.filter(r => !r.success).length
      });

    } catch (error) {
      console.error('❌ Error in multiple upload:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Get document URL (refresh signed URL)
  app.get(`${BASE_PATH}/storage/document/:vendorId/:fileName`, async (c) => {
    try {
      const { vendorId, fileName } = c.req.param();
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const filePath = `${vendorId}/${fileName}`;
      
      // Generate new signed URL
      const { data: signedUrlData, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 31536000);

      if (error || !signedUrlData) {
        return c.json({ error: 'File not found' }, 404);
      }

      return c.json({
        success: true,
        url: signedUrlData.signedUrl
      });

    } catch (error) {
      console.error('❌ Error getting document URL:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // Upload facility photos endpoint
  app.post(`${BASE_PATH}/storage/upload-facility-photos`, async (c) => {
    try {
      const formData = await c.req.formData();
      const vendorId = formData.get('vendorId') as string;
      
      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const uploadResults = [];
      const entries = Array.from(formData.entries());
      let photoCount = 0;

      for (const [key, value] of entries) {
        if (value instanceof File && key === 'photos') {
          photoCount++;
          const file = value;
          
          console.log(`📸 Uploading facility photo ${photoCount}: ${file.name}`);
          
          // Generate unique filename for facility photos
          const timestamp = Date.now();
          const random = Math.random().toString(36).substr(2, 9);
          const fileExt = file.name.split('.').pop();
          const fileName = `${vendorId}/facility_photos/photo_${timestamp}_${random}.${fileExt}`;

          // Convert File to ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Upload to Supabase Storage
          const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, uint8Array, {
              contentType: file.type,
              upsert: true
            });

          if (error) {
            console.error(`❌ Upload error for photo ${photoCount}:`, error);
            uploadResults.push({
              success: false,
              error: error.message
            });
            continue;
          }

          // Generate signed URL (valid for 1 year)
          const { data: signedUrlData } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(fileName, 31536000);

          if (signedUrlData) {
            uploadResults.push({
              success: true,
              fileName: fileName,
              originalName: file.name,
              url: signedUrlData.signedUrl
            });
            console.log(`✅ Uploaded facility photo ${photoCount}`);
          }
        }
      }

      if (uploadResults.length === 0) {
        return c.json({ error: 'No photos were uploaded' }, 400);
      }

      return c.json({
        success: true,
        uploads: uploadResults,
        totalUploaded: uploadResults.filter(r => r.success).length,
        totalFailed: uploadResults.filter(r => !r.success).length
      });

    } catch (error) {
      console.error('❌ Error uploading facility photos:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Storage endpoints registered (SQL-only)');
}

