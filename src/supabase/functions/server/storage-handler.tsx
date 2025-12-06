import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Storage Handler for File Uploads
 * Manages document uploads to Supabase Storage
 */
export function storageEndpoints(app: Hono) {
  const BUCKET_NAME = 'make-3dd53475-vendor-docs';

  // Initialize storage bucket
  const initializeBucket = async () => {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
      
      if (!bucketExists) {
        console.log(`📦 Creating storage bucket: ${BUCKET_NAME}`);
        const { data, error } = await supabase.storage.createBucket(BUCKET_NAME, {
          public: false, // Private bucket
          fileSizeLimit: 10485760 // 10MB limit
        });
        
        if (error) {
          // Ignore "already exists" error (409)
          if (error.statusCode === '409' || error.message?.includes('already exists')) {
            console.log('✅ Storage bucket already exists (409 ignored)');
          } else {
            console.error('❌ Error creating bucket:', error);
          }
        } else {
          console.log('✅ Storage bucket created successfully');
        }
      } else {
        console.log('✅ Storage bucket already exists');
      }
    } catch (error) {
      console.error('❌ Error initializing bucket:', error);
    }
  };

  // Initialize on startup
  initializeBucket();

  // Upload document endpoint
  app.post("/make-server-3dd53475/storage/upload", async (c) => {
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
  app.post("/make-server-3dd53475/storage/upload-multiple", async (c) => {
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
  app.get("/make-server-3dd53475/storage/document/:vendorId/:fileName", async (c) => {
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
  app.post("/make-server-3dd53475/storage/upload-facility-photos", async (c) => {
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
}