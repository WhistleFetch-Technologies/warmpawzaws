import { Hono } from "npm:hono";

/**
 * GOOGLE PLACES API SERVICE
 * 
 * Features:
 * - Address autocomplete
 * - Place details
 * - Geocoding
 * - Reverse geocoding
 */

export function registerGooglePlacesService(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * GET /places/autocomplete
   * Get address suggestions based on input
   */
  app.get(`${BASE}/places/autocomplete`, async (c) => {
    try {
      const input = c.req.query('input');
      const location = c.req.query('location'); // lat,lng for proximity bias
      const radius = c.req.query('radius') || '50000'; // 50km default
      const types = c.req.query('types') || 'address'; // Default to address, can be (cities)|(regions) for area search

      if (!input || input.length < 3) {
        return c.json({ 
          predictions: [],
          message: 'Input too short'
        });
      }

      const apiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
      if (!apiKey) {
        return c.json({ error: 'Google Maps API key not configured' }, 500);
      }

      // Build URL
      const params = new URLSearchParams({
        input,
        key: apiKey,
        components: 'country:in', // Restrict to India
        types: types // Support different types: address, (cities), (regions), etc.
      });

      if (location) {
        params.append('location', location);
        params.append('radius', radius);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('Google Places API error');
      }

      const data = await response.json();

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('[PLACES] API error:', data.status, data.error_message);
        return c.json({ 
          error: data.error_message || 'Failed to fetch predictions',
          status: data.status
        }, 500);
      }

      // Transform predictions
      const predictions = (data.predictions || []).map((p: any) => ({
        place_id: p.place_id,
        placeId: p.place_id, // Support both formats
        description: p.description,
        mainText: p.structured_formatting?.main_text,
        secondaryText: p.structured_formatting?.secondary_text,
        structured_formatting: p.structured_formatting, // Include full structured formatting
        types: p.types
      }));

      return c.json({
        success: true,
        predictions,
        count: predictions.length
      });

    } catch (error) {
      console.error('[PLACES] Autocomplete error:', error);
      return c.json({ error: 'Failed to fetch predictions' }, 500);
    }
  });

  /**
   * GET /places/details
   * Get detailed information about a place
   */
  app.get(`${BASE}/places/details`, async (c) => {
    try {
      const placeId = c.req.query('placeId');

      if (!placeId) {
        return c.json({ error: 'placeId required' }, 400);
      }

      const apiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
      if (!apiKey) {
        return c.json({ error: 'Google Maps API key not configured' }, 500);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}&key=${apiKey}&fields=address_components,formatted_address,geometry,name`
      );

      if (!response.ok) {
        throw new Error('Google Places API error');
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        return c.json({ 
          error: data.error_message || 'Place not found',
          status: data.status
        }, 500);
      }

      const place = data.result;
      
      // Extract address components
      const addressComponents: any = {};
      (place.address_components || []).forEach((comp: any) => {
        if (comp.types.includes('street_number')) addressComponents.streetNumber = comp.long_name;
        if (comp.types.includes('route')) addressComponents.route = comp.long_name;
        if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
          addressComponents.sublocality = comp.long_name;
          if (!addressComponents.area) addressComponents.area = comp.long_name;
        }
        if (comp.types.includes('neighborhood')) {
          addressComponents.neighborhood = comp.long_name;
          if (!addressComponents.area) addressComponents.area = comp.long_name;
        }
        if (comp.types.includes('locality')) {
          addressComponents.locality = comp.long_name;
          addressComponents.city = comp.long_name;
        }
        if (comp.types.includes('administrative_area_level_1')) addressComponents.state = comp.long_name;
        if (comp.types.includes('country')) addressComponents.country = comp.long_name;
        if (comp.types.includes('postal_code')) addressComponents.pincode = comp.long_name;
      });

      return c.json({
        success: true,
        place: {
          placeId,
          name: place.name,
          formattedAddress: place.formatted_address,
          addressComponents,
          location: {
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng
          }
        }
      });

    } catch (error) {
      console.error('[PLACES] Details error:', error);
      return c.json({ error: 'Failed to fetch place details' }, 500);
    }
  });

  /**
   * GET /places/geocode
   * Convert address to coordinates
   */
  app.get(`${BASE}/places/geocode`, async (c) => {
    try {
      const address = c.req.query('address');

      if (!address) {
        return c.json({ error: 'address required' }, 400);
      }

      const apiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
      if (!apiKey) {
        return c.json({ error: 'Google Maps API key not configured' }, 500);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        `address=${encodeURIComponent(address)}&key=${apiKey}&components=country:IN`
      );

      if (!response.ok) {
        throw new Error('Geocoding API error');
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        return c.json({ 
          error: 'Address not found',
          status: data.status
        }, 404);
      }

      const result = data.results[0];

      return c.json({
        success: true,
        location: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        formattedAddress: result.formatted_address,
        placeId: result.place_id
      });

    } catch (error) {
      console.error('[PLACES] Geocode error:', error);
      return c.json({ error: 'Failed to geocode address' }, 500);
    }
  });

  /**
   * GET /places/reverse-geocode
   * Convert coordinates to address
   */
  app.get(`${BASE}/places/reverse-geocode`, async (c) => {
    try {
      const lat = c.req.query('lat');
      const lng = c.req.query('lng');

      if (!lat || !lng) {
        return c.json({ error: 'lat and lng required' }, 400);
      }

      const apiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
      if (!apiKey) {
        return c.json({ error: 'Google Maps API key not configured' }, 500);
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?` +
        `latlng=${lat},${lng}&key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error('Reverse geocoding API error');
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        return c.json({ 
          error: 'Location not found',
          status: data.status
        }, 404);
      }

      const result = data.results[0];

      // Extract components
      const addressComponents: any = {};
      (result.address_components || []).forEach((comp: any) => {
        if (comp.types.includes('sublocality_level_1')) addressComponents.area = comp.long_name;
        if (comp.types.includes('locality')) addressComponents.city = comp.long_name;
        if (comp.types.includes('administrative_area_level_1')) addressComponents.state = comp.long_name;
        if (comp.types.includes('postal_code')) addressComponents.pincode = comp.long_name;
      });

      return c.json({
        success: true,
        address: {
          formatted: result.formatted_address,
          components: addressComponents,
          placeId: result.place_id
        }
      });

    } catch (error) {
      console.error('[PLACES] Reverse geocode error:', error);
      return c.json({ error: 'Failed to reverse geocode' }, 500);
    }
  });
}
