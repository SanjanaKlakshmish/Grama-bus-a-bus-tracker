import { Direction, RouteStop } from '../types/bus';

// Exactly 15 stops along NH 48 corridor connecting Sira and Tumakuru in Karnataka
export const SIRA_TUMAKURU_STOPS: RouteStop[] = [
  {
    id: 'sira_bus_stand',
    order: 1,
    name: 'Sira Bus Stand',
    kannadaName: 'ಶಿರಾ ಬಸ್ ನಿಲ್ದಾಣ',
    latitude: 13.7428,
    longitude: 76.9038,
    distanceFromSiraKm: 0,
  },
  {
    id: 'chikkanahalli',
    order: 2,
    name: 'Chikkanahalli',
    kannadaName: 'ಚಿಕ್ಕನಹಳ್ಳಿ',
    latitude: 13.6845,
    longitude: 76.9380,
    distanceFromSiraKm: 7.5,
  },
  {
    id: 'kallambella',
    order: 3,
    name: 'Kallambella',
    kannadaName: 'ಕಲ್ಲಂಬೆಳ್ಳ',
    latitude: 13.6335,
    longitude: 76.9745,
    distanceFromSiraKm: 14.2,
  },
  {
    id: 'toll',
    order: 4,
    name: 'Toll',
    kannadaName: 'ಟೋಲ್ ಪ್ಲಾಜಾ',
    latitude: 13.6050,
    longitude: 76.9930,
    distanceFromSiraKm: 17.8,
  },
  {
    id: 'doddaladamara',
    order: 5,
    name: 'Doddaladamara',
    kannadaName: 'ದೊಡ್ಡಆಲದಮರ',
    latitude: 13.5670,
    longitude: 77.0180,
    distanceFromSiraKm: 22.4,
  },
  {
    id: 'seebi',
    order: 6,
    name: 'Seebi',
    kannadaName: 'ಸೀಬಿ',
    latitude: 13.5285,
    longitude: 77.0392,
    distanceFromSiraKm: 27.1,
  },
  {
    id: 'somasagara_gate',
    order: 7,
    name: 'Somasagara Gate',
    kannadaName: 'ಸೋಮಸಾಗರ ಗೇಟ್',
    latitude: 13.4880,
    longitude: 77.0620,
    distanceFromSiraKm: 31.8,
  },
  {
    id: 'nelahal',
    order: 8,
    name: 'Nelahal',
    kannadaName: 'ನೆಲಹಾಲ್',
    latitude: 13.4540,
    longitude: 77.0790,
    distanceFromSiraKm: 35.7,
  },
  {
    id: 'sorekunte_gate',
    order: 9,
    name: 'Sorekunte Gate',
    kannadaName: 'ಸೋರೆಕುಂಟೆ ಗೇಟ್',
    latitude: 13.4260,
    longitude: 77.0910,
    distanceFromSiraKm: 39.0,
  },
  {
    id: 'bellavi_cross',
    order: 10,
    name: 'Bellavi Cross',
    kannadaName: 'ಬೆಳ್ಳಾವಿ ಕ್ರಾಸ್',
    latitude: 13.3980,
    longitude: 77.0980,
    distanceFromSiraKm: 42.2,
  },
  {
    id: 'kora',
    order: 11,
    name: 'Kora',
    kannadaName: 'ಕೋರ',
    latitude: 13.3820,
    longitude: 77.1005,
    distanceFromSiraKm: 44.1,
  },
  {
    id: 'shridevi_college',
    order: 12,
    name: 'Shridevi College',
    kannadaName: 'ಶ್ರೀದೇವಿ ಕಾಲೇಜು',
    latitude: 13.3645,
    longitude: 77.1030,
    distanceFromSiraKm: 46.2,
  },
  {
    id: 'siragate',
    order: 13,
    name: 'Siragate',
    kannadaName: 'ಶಿರಾ ಗೇಟ್',
    latitude: 13.3485,
    longitude: 77.1060,
    distanceFromSiraKm: 48.3,
  },
  {
    id: 'anjaneya_statue',
    order: 14,
    name: 'Anjaneya Statue',
    kannadaName: 'ಆಂಜನೇಯ ಸ್ವಾಮಿ ಪ್ರತಿಮೆ',
    latitude: 13.3420,
    longitude: 77.1040,
    distanceFromSiraKm: 49.5,
  },
  {
    id: 'tumakuru_bus_stand',
    order: 15,
    name: 'Tumakuru Bus Stand',
    kannadaName: 'ತುಮಕೂರು ಬಸ್ ನಿಲ್ದಾಣ',
    latitude: 13.3360,
    longitude: 77.1025,
    distanceFromSiraKm: 51.5,
  },
];

/**
 * Returns stops ordered according to travel direction.
 * Sira -> Tumakuru: 1 to 15
 * Tumakuru -> Sira: 15 to 1
 */
export function getStopsForDirection(direction: Direction): RouteStop[] {
  if (direction === 'sira_to_tumakuru') {
    return [...SIRA_TUMAKURU_STOPS];
  }
  return [...SIRA_TUMAKURU_STOPS].reverse();
}

export function getStopById(stopId: string): RouteStop | undefined {
  return SIRA_TUMAKURU_STOPS.find((s) => s.id === stopId);
}

/**
 * Haversine formula to compute great-circle distance between two coordinates in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export interface NearestStopResult {
  stop: RouteStop;
  distanceMeters: number;
  isWithinCorridor: boolean;
}

// Distance threshold for recognizing a passenger is along the Sira-Tumakuru corridor
const MAXIMUM_ROUTE_DISTANCE_METERS = 25000; // 25 km radius

export function findNearestStop(latitude: number, longitude: number): NearestStopResult {
  let nearestStop = SIRA_TUMAKURU_STOPS[0];
  let minDistance = Infinity;

  for (const stop of SIRA_TUMAKURU_STOPS) {
    const dist = calculateDistanceMeters(latitude, longitude, stop.latitude, stop.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestStop = stop;
    }
  }

  return {
    stop: nearestStop,
    distanceMeters: Math.round(minDistance),
    isWithinCorridor: minDistance <= MAXIMUM_ROUTE_DISTANCE_METERS,
  };
}

/**
 * Route polyline coordinates for map rendering.
 */
export function getRoutePathCoordinates(): { lat: number; lng: number }[] {
  return SIRA_TUMAKURU_STOPS.map((s) => ({
    lat: s.latitude,
    lng: s.longitude,
  }));
}
