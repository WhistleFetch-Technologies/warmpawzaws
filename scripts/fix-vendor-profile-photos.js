/**
 * Script to retroactively fix vendor profile photos from onboarding applications
 * Extracts profilePhoto from uploaded_documents and updates vendors.profile_photo_url
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/warmpawz',
});

async function fixVendorProfilePhotos() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding vendors with null profile_photo_url...');
    
    // Find vendors without profile photos that have applications
    const vendorsQuery = `
      SELECT 
        v.id as vendor_id,
        v.phone,
        v.profile_photo_url,
        voa.id as application_id,
        voa.uploaded_documents,
        voa.application_payload
      FROM vendors v
      LEFT JOIN vendor_identity vi ON vi.vendor_id = v.id OR vi.phone = v.phone
      LEFT JOIN vendor_onboarding_applications voa ON voa.vendor_identity_id = vi.id
      WHERE v.profile_photo_url IS NULL
        AND voa.id IS NOT NULL
        AND voa.uploaded_documents IS NOT NULL
      ORDER BY v.created_at DESC
    `;
    
    const result = await client.query(vendorsQuery);
    console.log(`📊 Found ${result.rows.length} vendors to check`);
    
    let fixed = 0;
    let notFound = 0;
    
    for (const row of result.rows) {
      const vendorId = row.vendor_id;
      const uploadedDocuments = typeof row.uploaded_documents === 'string' 
        ? JSON.parse(row.uploaded_documents) 
        : row.uploaded_documents;
      
      console.log(`\n🔍 Checking vendor ${vendorId} (phone: ${row.phone})...`);
      
      if (!Array.isArray(uploadedDocuments) || uploadedDocuments.length === 0) {
        console.log(`  ⚠️  No uploaded documents found`);
        notFound++;
        continue;
      }
      
      console.log(`  📄 Documents found: ${uploadedDocuments.length}`);
      console.log(`  📄 Document types: ${uploadedDocuments.map(d => d.type || d.name || 'unknown').join(', ')}`);
      
      // Look for profile photo
      const profilePhotoDoc = uploadedDocuments.find((doc) => 
        doc.type === 'profilePhoto' || 
        doc.type === 'profile_photo' || 
        doc.name === 'profilePhoto' ||
        (doc.name && doc.name.toLowerCase().includes('profile') && doc.name.toLowerCase().includes('photo'))
      );
      
      if (profilePhotoDoc && profilePhotoDoc.url) {
        let profilePhotoUrl = profilePhotoDoc.url;
        
        // Extract S3 key from full URL
        if (profilePhotoUrl.includes('amazonaws.com')) {
          try {
            const urlObj = new URL(profilePhotoUrl);
            profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
          } catch (e) {
            const match = profilePhotoUrl.match(/vendors\/[^?]+/);
            profilePhotoUrl = match ? match[0] : profilePhotoUrl;
          }
        }
        
        console.log(`  ✅ Found profile photo: ${profilePhotoUrl}`);
        
        // Update vendor
        await client.query(
          `UPDATE vendors SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2`,
          [profilePhotoUrl, vendorId]
        );
        
        console.log(`  ✅ Updated vendor ${vendorId} with profile photo`);
        fixed++;
      } else {
        // Check application_payload
        const payload = typeof row.application_payload === 'string'
          ? JSON.parse(row.application_payload)
          : row.application_payload;
        
        if (payload && payload.profilePhoto) {
          let profilePhotoUrl = payload.profilePhoto;
          
          if (profilePhotoUrl.includes('amazonaws.com')) {
            try {
              const urlObj = new URL(profilePhotoUrl);
              profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
            } catch (e) {
              const match = profilePhotoUrl.match(/vendors\/[^?]+/);
              profilePhotoUrl = match ? match[0] : profilePhotoUrl;
            }
          }
          
          console.log(`  ✅ Found profile photo in payload: ${profilePhotoUrl}`);
          
          await client.query(
            `UPDATE vendors SET profile_photo_url = $1, updated_at = NOW() WHERE id = $2`,
            [profilePhotoUrl, vendorId]
          );
          
          console.log(`  ✅ Updated vendor ${vendorId} with profile photo from payload`);
          fixed++;
        } else {
          console.log(`  ❌ No profile photo found in documents or payload`);
          notFound++;
        }
      }
    }
    
    console.log(`\n✅ Summary:`);
    console.log(`  Fixed: ${fixed}`);
    console.log(`  Not found: ${notFound}`);
    console.log(`  Total checked: ${result.rows.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  fixVendorProfilePhotos()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixVendorProfilePhotos };
