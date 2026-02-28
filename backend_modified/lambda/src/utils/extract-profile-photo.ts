/**
 * Utility function to extract profile photo URL from application data
 * Used when auto-creating vendor records from applications
 */

/**
 * Utility function to extract pincode from application payload
 * Checks multiple field names and filters placeholder values
 */
export function extractPincodeFromPayload(payload: any = {}): string {
  const pincodeFields = ['pin', 'pincode', 'pinCode', 'postalCode', 'postal_code', 'zip', 'zipCode'];
  const placeholderValues = ['000000', '0000000', '00000000', '123456', '000000', '', '0000000', '00000000'];
  
  for (const field of pincodeFields) {
    if (payload[field] && typeof payload[field] === 'string') {
      const trimmed = payload[field].trim();
      // Skip placeholder values and validate it's a 6-digit number
      if (trimmed && !placeholderValues.includes(trimmed) && /^\d{6}$/.test(trimmed)) {
        console.log(`📍 [ExtractPincode] ✅ Found valid pincode in field '${field}': '${trimmed}'`);
        return trimmed;
      } else if (trimmed) {
        console.log(`📍 [ExtractPincode] ⚠️ Found pincode in field '${field}' but it's a placeholder: '${trimmed}'`);
      }
    }
  }
  
  // If still no valid pincode, try to extract from address (AGGRESSIVE)
  if (payload.address && typeof payload.address === 'string') {
    console.log(`📍 [ExtractPincode] Checking address for pincode: '${payload.address.substring(0, 100)}...'`);
    // Try multiple patterns: 6-digit standalone, 6-digit with spaces, etc.
    const patterns = [
      /\b(\d{6})\b/,           // Standalone 6-digit number
      /[,\s](\d{6})[,\s]/,     // 6-digit with commas/spaces
      /-(\d{6})-/,             // 6-digit with dashes
      /\((\d{6})\)/,           // 6-digit in parentheses
    ];
    
    for (const pattern of patterns) {
      const match = payload.address.match(pattern);
      if (match && match[1] && !placeholderValues.includes(match[1])) {
        console.log(`📍 [ExtractPincode] ✅ Extracted pincode from address using pattern: '${match[1]}'`);
        return match[1];
      }
    }
  }
  
  // Also check city field (sometimes pincode is in city)
  if (payload.city && typeof payload.city === 'string') {
    const cityMatch = payload.city.match(/\b(\d{6})\b/);
    if (cityMatch && cityMatch[1] && !placeholderValues.includes(cityMatch[1])) {
      console.log(`📍 [ExtractPincode] ✅ Extracted pincode from city: '${cityMatch[1]}'`);
      return cityMatch[1];
    }
  }
  
  console.log(`📍 [ExtractPincode] ⚠️ No valid pincode found in payload, address, or city`);
  return '';
}

export function extractProfilePhotoFromApplication(application: any, payload: any = {}): string | null {
  let profilePhotoUrl: string | null = null;
  
  // First, check uploaded_documents array
  const uploadedDocuments = application?.uploaded_documents || [];
  
  // Handle case where uploaded_documents might be a JSON string
  let parsedDocuments = uploadedDocuments;
  if (typeof uploadedDocuments === 'string') {
    try {
      parsedDocuments = JSON.parse(uploadedDocuments);
    } catch (e) {
      console.warn('[ExtractProfilePhoto] Failed to parse uploaded_documents JSON:', e);
      parsedDocuments = [];
    }
  }
  
  if (Array.isArray(parsedDocuments) && parsedDocuments.length > 0) {
    // Look for profile photo in uploaded documents
    const profilePhotoDoc = parsedDocuments.find((doc: any) => {
      const typeMatch = doc.type === 'profilePhoto' || doc.type === 'profile_photo';
      const nameMatch = doc.name === 'profilePhoto' || doc.name === 'profile_photo';
      const fuzzyMatch = doc.name && doc.name.toLowerCase().includes('profile') && doc.name.toLowerCase().includes('photo');
      return typeMatch || nameMatch || fuzzyMatch;
    });
    
    if (profilePhotoDoc && profilePhotoDoc.url) {
      const photoUrl = profilePhotoDoc.url;
      if (photoUrl.includes('amazonaws.com')) {
        try {
          const urlObj = new URL(photoUrl);
          profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
        } catch (e) {
          // Try regex match for S3 path (handles both vendors/... and identityId/... patterns)
          const match = photoUrl.match(/([a-f0-9-]+\/[^?]+)/) || photoUrl.match(/vendors\/[^?]+/);
          profilePhotoUrl = match ? (match[1] || match[0]) : photoUrl;
        }
      } else {
        profilePhotoUrl = photoUrl;
      }
      console.log(`📸 [ExtractProfilePhoto] ✅ Extracted from uploaded_documents: ${profilePhotoUrl}`);
      return profilePhotoUrl;
    }
  }
  
  // Fallback: Check application_payload for profilePhoto field
  if (!profilePhotoUrl && payload?.profilePhoto) {
    const photoUrl = payload.profilePhoto;
    if (photoUrl.includes('amazonaws.com')) {
      try {
        const urlObj = new URL(photoUrl);
        profilePhotoUrl = urlObj.pathname.substring(1).split('?')[0];
      } catch (e) {
        const match = photoUrl.match(/([a-f0-9-]+\/[^?]+)/) || photoUrl.match(/vendors\/[^?]+/);
        profilePhotoUrl = match ? (match[1] || match[0]) : photoUrl;
      }
    } else {
      profilePhotoUrl = photoUrl;
    }
    console.log(`📸 [ExtractProfilePhoto] ✅ Extracted from application_payload: ${profilePhotoUrl}`);
    return profilePhotoUrl;
  }
  
  return null;
}
