/**
 * ========================================
 * GOOGLE MAP VENDOR VIEW
 * ========================================
 * 
 * Interactive Google Maps view showing vendors:
 * - Custom vendor markers
 * - Info windows on click
 * - User location marker
 * - Auto-fit bounds to show all vendors
 * - Click marker to see vendor details
 * 
 * Usage:
 * <GoogleMapVendorView 
 *   vendors={vendors}
 *   userLocation={userLocation}
 *   onVendorClick={(id) => navigate(`/vendor/${id}`)}
 * />
 */

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Star, Navigation } from 'lucide-react';

interface VendorLocation {
  id: string;
  businessName: string;
  location: { lat: number; lng: number };
  rating?: number;
  totalReviews?: number;
  services?: string[];
  priceRange?: string;
  photos?: string[];
  distance?: number;
}

interface GoogleMapVendorViewProps {
  vendors: VendorLocation[];
  userLocation?: { lat: number; lng: number };
  onVendorClick?: (vendorId: string) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  className?: string;
}

// Load Google Maps Script
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    // Load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
    document.head.appendChild(script);
  });
};

export function GoogleMapVendorView({
  vendors,
  userLocation,
  onVendorClick,
  center,
  zoom = 12,
  height = '600px',
  className = ''
}: GoogleMapVendorViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Initialize map
  useEffect(() => {
    if (!apiKey) {
      setError('Google Maps API key not configured');
      setLoading(false);
      return;
    }

    if (!mapRef.current) return;

    const initMap = async () => {
      try {
        await loadGoogleMapsScript(apiKey);

        const mapCenter = center || userLocation || { lat: 28.6139, lng: 77.2090 }; // Default to Delhi

        const mapInstance = new google.maps.Map(mapRef.current!, {
          center: mapCenter,
          zoom: zoom,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        setMap(mapInstance);
        setLoading(false);

        // Create info window
        infoWindowRef.current = new google.maps.InfoWindow();

      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load Google Maps');
        setLoading(false);
      }
    };

    initMap();

    return () => {
      // Cleanup markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };
  }, [apiKey]);

  // Add user location marker
  useEffect(() => {
    if (!map || !userLocation) return;

    const userMarker = new google.maps.Marker({
      position: userLocation,
      map: map,
      title: 'Your Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3
      },
      zIndex: 1000
    });

    return () => {
      userMarker.setMap(null);
    };
  }, [map, userLocation]);

  // Add vendor markers
  useEffect(() => {
    if (!map || vendors.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    // Add user location to bounds
    if (userLocation) {
      bounds.extend(userLocation);
    }

    // Create markers for each vendor
    vendors.forEach((vendor, index) => {
      if (!vendor.location || !vendor.location.lat || !vendor.location.lng) {
        return;
      }

      const position = {
        lat: vendor.location.lat,
        lng: vendor.location.lng
      };

      // Custom marker with vendor number
      const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: vendor.businessName,
        label: {
          text: `${index + 1}`,
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: '#FF8C42',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        },
        animation: google.maps.Animation.DROP
      });

      // Info window content
      const infoContent = `
        <div style="padding: 12px; max-width: 280px;">
          ${vendor.photos && vendor.photos[0] ? `
            <img 
              src="${vendor.photos[0]}" 
              alt="${vendor.businessName}"
              style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;"
            />
          ` : ''}
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #111827;">
            ${vendor.businessName}
          </h3>
          ${vendor.rating ? `
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
              <span style="color: #F59E0B;">⭐</span>
              <span style="font-weight: 600;">${vendor.rating.toFixed(1)}</span>
              ${vendor.totalReviews ? `
                <span style="color: #6B7280; font-size: 14px;">(${vendor.totalReviews} reviews)</span>
              ` : ''}
            </div>
          ` : ''}
          ${vendor.distance !== undefined ? `
            <div style="display: flex; align-items: center; gap: 4px; color: #6B7280; font-size: 14px; margin-bottom: 8px;">
              <span>📍</span>
              <span>${vendor.distance.toFixed(1)} km away</span>
            </div>
          ` : ''}
          ${vendor.services && vendor.services.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
              ${vendor.services.slice(0, 3).map(service => `
                <span style="
                  padding: 4px 8px; 
                  background: #F3F4F6; 
                  color: #374151; 
                  font-size: 12px; 
                  border-radius: 4px;
                ">
                  ${service}
                </span>
              `).join('')}
              ${vendor.services.length > 3 ? `
                <span style="
                  padding: 4px 8px; 
                  background: #F3F4F6; 
                  color: #6B7280; 
                  font-size: 12px; 
                  border-radius: 4px;
                ">
                  +${vendor.services.length - 3}
                </span>
              ` : ''}
            </div>
          ` : ''}
          ${vendor.priceRange ? `
            <div style="color: #6B7280; font-size: 14px; margin-bottom: 12px; text-transform: capitalize;">
              Price: ${vendor.priceRange}
            </div>
          ` : ''}
          <button 
            onclick="window.handleVendorClick && window.handleVendorClick('${vendor.id}')"
            style="
              width: 100%; 
              padding: 8px 16px; 
              background: #FF8C42; 
              color: white; 
              border: none; 
              border-radius: 8px; 
              font-weight: 600; 
              cursor: pointer;
              font-size: 14px;
            "
            onmouseover="this.style.background='#FF7029'"
            onmouseout="this.style.background='#FF8C42'"
          >
            View Details
          </button>
        </div>
      `;

      // Add click listener
      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(infoContent);
          infoWindowRef.current.open(map, marker);
        }
      });

      markersRef.current.push(marker);
      bounds.extend(position);
    });

    // Fit map to show all markers
    if (vendors.length > 0) {
      map.fitBounds(bounds);
      
      // Prevent over-zooming when there's only one vendor
      const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const currentZoom = map.getZoom();
        if (currentZoom && currentZoom > 15) {
          map.setZoom(15);
        }
      });
    }

  }, [map, vendors]);

  // Expose vendor click handler to window for info window buttons
  useEffect(() => {
    (window as any).handleVendorClick = (vendorId: string) => {
      if (onVendorClick) {
        onVendorClick(vendorId);
      }
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
    };

    return () => {
      delete (window as any).handleVendorClick;
    };
  }, [onVendorClick]);

  // Loading state
  if (loading) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#FF8C42] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 rounded-xl ${className}`}
        style={{ height }}
      >
        <div className="text-center max-w-md px-4">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Unavailable</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please check your Google Maps API configuration
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Map Container */}
      <div 
        ref={mapRef} 
        style={{ height }}
        className="rounded-xl overflow-hidden shadow-lg"
      />

      {/* Map Controls Overlay */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-full bg-[#FF8C42]" />
          <span className="font-medium text-gray-700">Vendors ({vendors.length})</span>
        </div>
        {userLocation && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full bg-[#4285F4]" />
            <span className="font-medium text-gray-700">Your Location</span>
          </div>
        )}
      </div>

      {/* Vendor Count Badge */}
      {vendors.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No vendors to display on map</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
          </div>
        </div>
      )}
    </div>
  );
}
