import { Direction, BusReport, StopETA, RouteStop } from '../types/bus';
import { getStopsForDirection, calculateDistanceMeters } from './routeService';

// Average highway bus travel speed on NH48 in km/h
const AVERAGE_BUS_SPEED_KMH = 45;
// Average dwell time per intermediate passenger stop in minutes
const DWELL_TIME_PER_STOP_MINUTES = 1.5;

export interface JourneyProgressionState {
  isJourneyEnded: boolean;
  destinationReached: boolean;
  destinationStop: RouteStop;
  currentCalculatedStop: RouteStop;
  nextStop: RouteStop | null;
  calculatedPosition: { latitude: number; longitude: number };
  minutesSinceReport: number;
  totalJourneyMinutes: number;
  minutesRemainingToDestination: number;
  completedAtTimeString: string | null;
}

/**
 * Calculates real-time stop arrival estimates, detecting which stops the bus
 * has reached as time elapses, and ending the journey once it reaches the destination.
 */
export function calculateRouteETAs(
  direction: Direction,
  latestReport: BusReport | null,
  now: Date = new Date()
): StopETA[] {
  const orderedStops = getStopsForDirection(direction);

  if (!latestReport) {
    return orderedStops.map((stop, idx) => ({
      stop,
      status: 'approaching',
      estimatedArrivalMinutes: null,
      estimatedArrivalTimeString: null,
      distanceFromCurrentKm: 0,
      isDestination: idx === orderedStops.length - 1,
    }));
  }

  const reportedIndex = orderedStops.findIndex((s) => s.id === latestReport.stopId);
  const reportTime = new Date(latestReport.capturedAt);
  // Time elapsed in fractional minutes since the passenger submitted the report
  const minutesSinceReport = Math.max(0, (now.getTime() - reportTime.getTime()) / (1000 * 60));

  if (reportedIndex === -1) {
    return orderedStops.map((stop, idx) => ({
      stop,
      status: 'approaching',
      estimatedArrivalMinutes: null,
      estimatedArrivalTimeString: null,
      distanceFromCurrentKm: 0,
      isDestination: idx === orderedStops.length - 1,
    }));
  }

  // Pre-calculate cumulative arrival times from reported stop to each downstream stop
  const travelSchedule: {
    stopIndex: number;
    cumulativeKm: number;
    travelMinutes: number;
    projectedDate: Date;
  }[] = [];

  let cumMeters = 0;
  travelSchedule.push({
    stopIndex: reportedIndex,
    cumulativeKm: 0,
    travelMinutes: 0,
    projectedDate: new Date(reportTime),
  });

  for (let i = reportedIndex + 1; i < orderedStops.length; i++) {
    cumMeters += calculateDistanceMeters(
      orderedStops[i - 1].latitude,
      orderedStops[i - 1].longitude,
      orderedStops[i].latitude,
      orderedStops[i].longitude
    );
    const distanceKm = cumMeters / 1000;
    const drivingMinutes = (distanceKm / AVERAGE_BUS_SPEED_KMH) * 60;
    const dwellMinutes = (i - reportedIndex) * DWELL_TIME_PER_STOP_MINUTES;
    const totalTravelMinutes = Math.round(drivingMinutes + dwellMinutes);
    const projectedDate = new Date(reportTime.getTime() + totalTravelMinutes * 60 * 1000);

    travelSchedule.push({
      stopIndex: i,
      cumulativeKm: Math.round(distanceKm * 10) / 10,
      travelMinutes: totalTravelMinutes,
      projectedDate,
    });
  }

  const destinationSchedule = travelSchedule[travelSchedule.length - 1];
  const isDestinationReached = minutesSinceReport >= destinationSchedule.travelMinutes;

  return orderedStops.map((stop, index) => {
    const isDestination = index === orderedStops.length - 1;

    // 1. Stops prior to the reported stop are always passed
    if (index < reportedIndex) {
      return {
        stop,
        status: 'passed',
        estimatedArrivalMinutes: null,
        estimatedArrivalTimeString: null,
        passedAtTimeString: 'Earlier stop',
        distanceFromCurrentKm: 0,
        isDestination: false,
      };
    }

    // 2. Reported stop itself
    if (index === reportedIndex) {
      if (minutesSinceReport > 2) {
        // Bus has moved past the reported stop as time passed
        return {
          stop,
          status: 'passed',
          estimatedArrivalMinutes: null,
          estimatedArrivalTimeString: null,
          passedAtTimeString: formatClockTime(reportTime),
          distanceFromCurrentKm: 0,
          isDestination: false,
        };
      }
      return {
        stop,
        status: 'current',
        estimatedArrivalMinutes: 0,
        estimatedArrivalTimeString: 'At stop now',
        distanceFromCurrentKm: 0,
        isDestination: false,
      };
    }

    // 3. Downstream stops: check if bus has reached it as time elapsed
    const scheduleItem = travelSchedule.find((s) => s.stopIndex === index);
    if (!scheduleItem) {
      return {
        stop,
        status: 'approaching',
        estimatedArrivalMinutes: null,
        estimatedArrivalTimeString: null,
        distanceFromCurrentKm: 0,
        isDestination,
      };
    }

    const projectedTimeString = formatClockTime(scheduleItem.projectedDate);

    // If elapsed time has exceeded this stop's travel window:
    if (minutesSinceReport >= scheduleItem.travelMinutes + 1.5) {
      // If this is the final destination and time has passed, mark as reached
      if (isDestination) {
        return {
          stop,
          status: 'current',
          estimatedArrivalMinutes: 0,
          estimatedArrivalTimeString: 'Destination Reached',
          passedAtTimeString: projectedTimeString,
          distanceFromCurrentKm: 0,
          isDestination: true,
        };
      }
      // Reached and passed
      return {
        stop,
        status: 'passed',
        estimatedArrivalMinutes: null,
        estimatedArrivalTimeString: null,
        passedAtTimeString: projectedTimeString,
        distanceFromCurrentKm: 0,
        isDestination,
      };
    }

    // Currently at or pulling into this stop
    if (Math.abs(minutesSinceReport - scheduleItem.travelMinutes) <= 1.5) {
      return {
        stop,
        status: 'current',
        estimatedArrivalMinutes: 0,
        estimatedArrivalTimeString: isDestination ? 'Arriving at Destination' : 'At stop now',
        distanceFromCurrentKm: 0,
        isDestination,
      };
    }

    // Approaching future stop
    const remainingMinutes = Math.max(1, Math.round(scheduleItem.travelMinutes - minutesSinceReport));
    return {
      stop,
      status: 'approaching',
      estimatedArrivalMinutes: remainingMinutes,
      estimatedArrivalTimeString: projectedTimeString,
      distanceFromCurrentKm: scheduleItem.cumulativeKm,
      isDestination,
    };
  });
}

/**
 * Calculates current interpolated position and journey completion status
 * as real-time minutes elapse since passenger report.
 */
export function calculateJourneyProgression(
  direction: Direction,
  latestReport: BusReport | null,
  now: Date = new Date()
): JourneyProgressionState | null {
  const orderedStops = getStopsForDirection(direction);
  if (!latestReport) return null;

  const reportedIndex = orderedStops.findIndex((s) => s.id === latestReport.stopId);
  if (reportedIndex === -1) return null;

  const reportTime = new Date(latestReport.capturedAt);
  const minutesSinceReport = Math.max(0, (now.getTime() - reportTime.getTime()) / (1000 * 60));
  const destinationStop = orderedStops[orderedStops.length - 1];

  // Build timetable
  const stopsTimetable: {
    stop: RouteStop;
    travelMinutes: number;
    projectedDate: Date;
  }[] = [];

  let cumMeters = 0;
  stopsTimetable.push({
    stop: orderedStops[reportedIndex],
    travelMinutes: 0,
    projectedDate: new Date(reportTime),
  });

  for (let i = reportedIndex + 1; i < orderedStops.length; i++) {
    cumMeters += calculateDistanceMeters(
      orderedStops[i - 1].latitude,
      orderedStops[i - 1].longitude,
      orderedStops[i].latitude,
      orderedStops[i].longitude
    );
    const distanceKm = cumMeters / 1000;
    const drivingMinutes = (distanceKm / AVERAGE_BUS_SPEED_KMH) * 60;
    const dwellMinutes = (i - reportedIndex) * DWELL_TIME_PER_STOP_MINUTES;
    const totalMinutes = Math.round(drivingMinutes + dwellMinutes);
    const projectedDate = new Date(reportTime.getTime() + totalMinutes * 60 * 1000);

    stopsTimetable.push({
      stop: orderedStops[i],
      travelMinutes: totalMinutes,
      projectedDate,
    });
  }

  const finalSchedule = stopsTimetable[stopsTimetable.length - 1];
  const totalJourneyMinutes = finalSchedule.travelMinutes;
  const isDestinationReached = minutesSinceReport >= totalJourneyMinutes;

  if (isDestinationReached) {
    return {
      isJourneyEnded: true,
      destinationReached: true,
      destinationStop,
      currentCalculatedStop: destinationStop,
      nextStop: null,
      calculatedPosition: {
        latitude: destinationStop.latitude,
        longitude: destinationStop.longitude,
      },
      minutesSinceReport: Math.round(minutesSinceReport),
      totalJourneyMinutes,
      minutesRemainingToDestination: 0,
      completedAtTimeString: formatClockTime(finalSchedule.projectedDate),
    };
  }

  // Find intermediate stop currently reached as time elapses
  let currentStop = stopsTimetable[0].stop;
  let nextStop: RouteStop | null = stopsTimetable[1]?.stop || null;
  let fromStop = stopsTimetable[0];
  let toStop = stopsTimetable[1] || stopsTimetable[0];

  for (let i = 0; i < stopsTimetable.length - 1; i++) {
    const s1 = stopsTimetable[i];
    const s2 = stopsTimetable[i + 1];

    if (minutesSinceReport >= s1.travelMinutes && minutesSinceReport < s2.travelMinutes) {
      currentStop = s1.stop;
      nextStop = s2.stop;
      fromStop = s1;
      toStop = s2;
      break;
    }
  }

  // Interpolate GPS coordinates along highway between fromStop and toStop
  const segmentSpan = Math.max(1, toStop.travelMinutes - fromStop.travelMinutes);
  const segmentProgress = Math.min(1, Math.max(0, (minutesSinceReport - fromStop.travelMinutes) / segmentSpan));

  const lat = fromStop.stop.latitude + (toStop.stop.latitude - fromStop.stop.latitude) * segmentProgress;
  const lng = fromStop.stop.longitude + (toStop.stop.longitude - fromStop.stop.longitude) * segmentProgress;

  const minutesRemaining = Math.max(1, Math.round(totalJourneyMinutes - minutesSinceReport));

  return {
    isJourneyEnded: false,
    destinationReached: false,
    destinationStop,
    currentCalculatedStop: currentStop,
    nextStop,
    calculatedPosition: { latitude: lat, longitude: lng },
    minutesSinceReport: Math.round(minutesSinceReport),
    totalJourneyMinutes,
    minutesRemainingToDestination: minutesRemaining,
    completedAtTimeString: null,
  };
}

export function formatClockTime(date: Date): string {
  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "4 minutes ago", "just now")
 */
export function formatTimeAgo(isoString: string, now: Date = new Date()): { text: string; minutes: number } {
  const reportedDate = new Date(isoString);
  const diffMs = now.getTime() - reportedDate.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes === 0) {
    return { text: 'Just now', minutes: 0 };
  }
  if (minutes === 1) {
    return { text: '1 minute ago', minutes: 1 };
  }
  if (minutes < 60) {
    return { text: `${minutes} minutes ago`, minutes };
  }
  const hours = Math.floor(minutes / 60);
  if (hours === 1) {
    return { text: '1 hour ago', minutes };
  }
  return { text: `${hours} hours ago`, minutes };
}
