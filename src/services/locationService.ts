import { findNearestStop, NearestStopResult } from './routeService';

export interface LocationReportResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  nearestStopResult: NearestStopResult;
}

export type LocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'OUT_OF_CORRIDOR';

export interface LocationServiceError {
  code: LocationErrorCode;
  userMessage: string;
}

/**
 * Retrieves the device's current GPS location and finds the nearest Sira-Tumakuru route stop.
 */
export async function getCurrentRouteLocation(): Promise<LocationReportResult> {
  if (!navigator.geolocation) {
    const error: LocationServiceError = {
      code: 'NOT_SUPPORTED',
      userMessage: 'Geolocation is not supported by your browser.',
    };
    throw error;
  }

  return new Promise<LocationReportResult>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const nearestStopResult = findNearestStop(latitude, longitude);

        resolve({
          latitude,
          longitude,
          accuracy: Math.round(accuracy),
          timestamp: new Date().toISOString(),
          nearestStopResult,
        });
      },
      (error) => {
        let code: LocationErrorCode = 'POSITION_UNAVAILABLE';
        let userMessage = 'Unable to determine your GPS location. Please ensure location services are turned on.';

        if (error.code === error.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          userMessage = 'We need your location to report the bus. Please enable location permission in your browser and try again.';
        } else if (error.code === error.TIMEOUT) {
          code = 'TIMEOUT';
          userMessage = 'GPS location request timed out. Please try again or step into an open area with better GPS reception.';
        }

        const err: LocationServiceError = { code, userMessage };
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      }
    );
  });
}
