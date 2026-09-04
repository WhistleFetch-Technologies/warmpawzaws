// Type declarations for Google Maps API
// Google Maps is loaded dynamically via script tag, so we need to declare the types

declare global {
  namespace google {
    namespace maps {
      class Map {
        constructor(mapDiv: HTMLElement | null, opts?: MapOptions);
        setCenter(latlng: LatLng | LatLngLiteral): void;
        setZoom(zoom: number): void;
        fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
        addListener(eventName: string, handler: Function): MapsEventListener;
      }

      class Marker {
        constructor(opts?: MarkerOptions);
        setPosition(latlng: LatLng | LatLngLiteral | null): void;
        getPosition(): LatLng | null;
        setMap(map: Map | null): void;
        addListener(eventName: string, handler: Function): MapsEventListener;
      }

      class Size {
        constructor(width: number, height: number, widthUnit?: string, heightUnit?: string);
      }

      class Point {
        constructor(x: number, y: number);
      }

      class LatLngBounds {
        constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
        extend(point: LatLng | LatLngLiteral): LatLngBounds;
        getCenter(): LatLng;
      }

      class Polyline {
        constructor(opts?: PolylineOptions);
        setMap(map: Map | null): void;
      }

      class LatLng {
        constructor(lat: number, lng: number, noWrap?: boolean);
        lat(): number;
        lng(): number;
      }

      class Geocoder {
        geocode(request: GeocoderRequest, callback: (results: GeocoderResult[], status: GeocoderStatus) => void): void;
      }

      interface Padding {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      }

      interface MapOptions {
        center?: LatLng | LatLngLiteral;
        zoom?: number;
        disableDefaultUI?: boolean;
        zoomControl?: boolean;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
        mapId?: string;
      }

      interface MarkerOptions {
        position?: LatLng | LatLngLiteral;
        map?: Map | null;
        title?: string;
        draggable?: boolean;
        icon?: string | Icon | Symbol;
      }

      interface Icon {
        url?: string;
        scaledSize?: Size;
        size?: Size;
        anchor?: Point;
        origin?: Point;
      }

      interface Symbol {
        path?: string | number;
        scale?: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeWeight?: number;
      }

      interface PolylineOptions {
        path?: Array<LatLng | LatLngLiteral>;
        geodesic?: boolean;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
        map?: Map | null;
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

      namespace places {
        class AutocompleteService {
          getPlacePredictions(
            request: AutocompletionRequest,
            callback: (results: AutocompletePrediction[] | null, status: PlacesServiceStatus) => void,
          ): void;
        }

        class PlacesService {
          constructor(attrContainer: HTMLDivElement | Map);
          getDetails(
            request: PlaceDetailsRequest,
            callback: (result: PlaceResult | null, status: PlacesServiceStatus) => void,
          ): void;
          textSearch(
            request: TextSearchRequest,
            callback: (results: PlaceResult[] | null, status: PlacesServiceStatus) => void,
          ): void;
        }

        interface AutocompletionRequest {
          input: string;
          componentRestrictions?: { country?: string | string[] };
          types?: string[];
        }

        interface AutocompletePrediction {
          description: string;
          place_id: string;
          structured_formatting?: {
            main_text: string;
            secondary_text: string;
          };
        }

        interface PlaceDetailsRequest {
          placeId: string;
          fields?: string[];
        }

        interface TextSearchRequest {
          query: string;
          location?: LatLng | LatLngLiteral;
          radius?: number;
        }

        interface PlaceResult {
          place_id?: string;
          name?: string;
          formatted_address?: string;
          geometry?: { location?: LatLng };
        }

        enum PlacesServiceStatus {
          OK = 'OK',
          ZERO_RESULTS = 'ZERO_RESULTS',
          OVER_QUERY_LIMIT = 'OVER_QUERY_LIMIT',
          REQUEST_DENIED = 'REQUEST_DENIED',
          INVALID_REQUEST = 'INVALID_REQUEST',
          UNKNOWN_ERROR = 'UNKNOWN_ERROR',
        }
      }
    }
  }

  interface Window {
    google?: {
      maps?: typeof google.maps;
    };
    initGoogleMaps?: () => void;
  }
}

export {};
