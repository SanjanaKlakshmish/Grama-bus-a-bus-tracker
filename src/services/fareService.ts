import { getStopById, calculateDistanceMeters, SIRA_TUMAKURU_STOPS } from './routeService';

export interface FareEstimateResult {
  approximateFare: number;
  distanceKm: number;
  fareFormatted: string;
  onboardingName: string;
  destinationName: string;
  notes: string;
}

/**
 * Calculates Karnataka rural stage bus fare along the NH 48 Sira–Tumakuru corridor.
 * Benchmarked strictly according to user-specified fares:
 * - From Sira to Tumakuru: approximately ₹60
 * - From Kallambella to Tumakuru: approximately ₹46
 */
export function calculateCorridorFare(
  onboardingStopId: string,
  destinationStopId: string
): FareEstimateResult {
  const stop1 = getStopById(onboardingStopId) || SIRA_TUMAKURU_STOPS[0];
  const stop2 = getStopById(destinationStopId) || SIRA_TUMAKURU_STOPS[SIRA_TUMAKURU_STOPS.length - 1];

  const dist1 = stop1.distanceFromSiraKm;
  const dist2 = stop2.distanceFromSiraKm;
  const distanceKm = Math.round(Math.abs(dist2 - dist1) * 10) / 10;

  // Strict benchmark points:
  // Sira (0km mark) to Tumakuru (51.5km mark) => 51.5 km => ₹60
  // Kallambella (14.2km mark) to Tumakuru (51.5km mark) => 37.3 km => ₹46
  let fare: number;

  if (distanceKm <= 1.0) {
    fare = 0;
  } else if (
    (stop1.id === 'sira_bus_stand' && stop2.id === 'tumakuru_bus_stand') ||
    (stop1.id === 'tumakuru_bus_stand' && stop2.id === 'sira_bus_stand')
  ) {
    fare = 60;
  } else if (
    (stop1.id === 'kallambella' && stop2.id === 'tumakuru_bus_stand') ||
    (stop1.id === 'tumakuru_bus_stand' && stop2.id === 'kallambella')
  ) {
    fare = 46;
  } else {
    // Linear regression formula fitted exactly to (51.5, 60) and (37.3, 46)
    // Slope = 14 / 14.2 = 0.9859; Base = 9.23
    const calculated = 9.23 + distanceKm * 0.9859;
    // Karnataka stage fares are rounded to nearest whole rupee or ₹5 stage
    fare = Math.max(10, Math.round(calculated));
  }

  return {
    approximateFare: fare,
    distanceKm,
    fareFormatted: `approx. ₹${fare}`,
    onboardingName: stop1.name,
    destinationName: stop2.name,
    notes: `Approx. ₹${fare} (KSRTC rural stage fare: approx. ₹60 from Sira, approx. ₹46 from Kallambella)`,
  };
}
