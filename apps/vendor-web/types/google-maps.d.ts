// Type declarations for Google Maps API
// Google Maps is loaded dynamically via script tag, so we need to declare the types

declare namespace google {
  namespace maps {
    class Map {
      constructor(mapDiv: HTMLElement | null, opts?: MapOptions);
      setCenter(latlng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
      addListener(eventName: string, handler: Function): MapsEventListener;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setPosition(latlng: LatLng | LatLngLiteral | null): void;
      getPosition(): LatLng | null;
      setMap(map: Map | null): void;
      addListener(eventName: string, handler: Function): MapsEventListener;
    }

    class LatLng {
      constructor(lat: number, lng: number, noWrap?: boolean);
      lat(): number;
      lng(): number;
    }

    class Geocoder {
      geocode(request: GeocoderRequest, callback: (results: GeocoderResult[], status: GeocoderStatus) => void): void;
    }

    interface MapOptions {
      center?: LatLng | LatLngLiteral;
      zoom?: number;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map | null;
      title?: string;
      draggable?: boolean;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface MapMouseEvent {
      latLng: LatLng | null;
    }

    interface MapsEventListener {
      remove(): void;
    }

    interface GeocoderRequest {
      address?: string;
      location?: LatLng | LatLngLiteral;
    }

    interface GeocoderResult {
      formatted_address: string;
      geometry: {
        location: LatLng;
      };
    }

    enum GeocoderStatus {
      OK = 'OK',
      ERROR = 'ERROR',
    }
  }
}

declare global {
  interface Window {
    google?: {
      maps?: {
        Map: typeof google.maps.Map;
        Marker: typeof google.maps.Marker;
        LatLng: typeof google.maps.LatLng;
        Geocoder: typeof google.maps.Geocoder;
        GeocoderStatus: typeof google.maps.GeocoderStatus;
      };
    };
    initGoogleMaps?: () => void;
  }
}

export {};

