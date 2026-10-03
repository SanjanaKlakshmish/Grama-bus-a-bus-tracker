import {
  BusReport,
  BusJourney,
  Direction,
  LiveStatusSummary,
  ReportConfidence,
  RouteStop,
  ImageVerificationResult,
  ActiveBus,
  StopETA,
  BusOccupancyStatus,
  PhotoAngle,
} from '../types/bus';
import { getStopById, getStopsForDirection, SIRA_TUMAKURU_STOPS } from './routeService';
import { formatTimeAgo, calculateJourneyProgression, calculateRouteETAs } from './etaService';
import { uploadBusPhoto } from './storageService';
import {
  syncBusReportToSupabase,
  purgeOldSupabaseReports,
  triggerBackgroundEdgeFunctionValidation,
} from './supabaseClient';

const STORAGE_KEY_REPORTS = 'sira_tumakuru_bus_reports_v4';

// Maximum allowed age for bus sightings: 4 hours (240 minutes)
export const MAX_REPORT_AGE_HOURS = 4;
export const MAX_REPORT_AGE_MS = MAX_REPORT_AGE_HOURS * 60 * 60 * 1000;

/**
 * Loads authentic passenger reports from storage.
 * Automatically erases any late reports older than 4 hours.
 */
export function getStoredReports(): BusReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = Date.now();
        const cutoffTime = now - MAX_REPORT_AGE_MS;

        // Erase any mock reports and strictly filter out reports older than 4 hours
        const activeOnly = parsed.filter((r: BusReport) => {
          if (!r || !r.capturedAt) return false;
          const capturedTime = new Date(r.capturedAt).getTime();
          const isNotMock =
            !r.id.startsWith('rep_init') &&
            !r.id.startsWith('rep_kallambella') &&
            !r.id.startsWith('rep_sira') &&
            !r.id.startsWith('rep_bellavi') &&
            !r.id.startsWith('rep_tumakuru');

          // Keep only reports within the last 4 hours
          const isWithin4Hours = capturedTime >= cutoffTime;
          return isNotMock && isWithin4Hours;
        });

        // If stale/late reports were pruned, persist the cleaned list immediately
        if (activeOnly.length !== parsed.length) {
          saveReports(activeOnly);
        }

        return activeOnly;
      }
    }
  } catch (e) {
    console.error('Error reading reports from localStorage:', e);
  }

  return [];
}

export function saveReports(reports: BusReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports));
  } catch (e) {
    console.error('Error writing reports to localStorage:', e);
  }
}

/**
 * Explicitly erases all late reports older than the given hours (default 4 hours).
 * Returns the number of late reports erased.
 */
export function eraseLateReports(hours: number = MAX_REPORT_AGE_HOURS): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPORTS);
    let erasedCount = 0;

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
        const freshReports = parsed.filter((r: BusReport) => {
          const t = new Date(r.capturedAt).getTime();
          return t >= cutoffTime;
        });

        erasedCount = parsed.length - freshReports.length;
        saveReports(freshReports);
      }
    }

    // Also clear old localStorage keys from earlier revisions
    localStorage.removeItem('sira_tumakuru_bus_reports_v3');
    localStorage.removeItem('sira_tumakuru_bus_reports_v2');
    localStorage.removeItem('sira_tumakuru_bus_reports_v1');

    // Trigger Supabase cloud purge in background
    purgeOldSupabaseReports(hours).catch((err) => {
      console.warn('Supabase cloud purge error:', err);
    });

    return erasedCount;
  } catch (e) {
    console.error('Error erasing late reports:', e);
    return 0;
  }
}

export function getReportsForDirection(direction: Direction): BusReport[] {
  const reports = getStoredReports();
  return reports
    .filter((r) => r.direction === direction)
    .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
}

/**
 * Resolves whether a sighting belongs to an existing bus journey or starts a new separate bus.
 * Multiple buses (e.g. one in Sira, one in Kallambella) are tracked concurrently!
 */
export function resolveJourneyId(
  direction: Direction,
  newStop: RouteStop,
  timestamp: Date,
  existingReports: BusReport[],
  forceNewBus: boolean = false
): string {
  if (forceNewBus) {
    return `journey_bus_${Date.now()}`;
  }

  const dirReports = existingReports.filter((r) => r.direction === direction);
  if (dirReports.length === 0) {
    return `journey_bus_${Date.now()}`;
  }

  const orderedStops = getStopsForDirection(direction);
  const newIndex = orderedStops.findIndex((s) => s.id === newStop.id);

  // Group by existing journey IDs
  const journeyMap = new Map<string, BusReport[]>();
  for (const r of dirReports) {
    const list = journeyMap.get(r.journeyId) || [];
    list.push(r);
    journeyMap.set(r.journeyId, list);
  }

  for (const [journeyId, jReports] of journeyMap.entries()) {
    const latest = jReports[0];
    const prevIndex = orderedStops.findIndex((s) => s.id === latest.stopId);
    const diffMinutes = (timestamp.getTime() - new Date(latest.capturedAt).getTime()) / (1000 * 60);

    // If reported downstream on same journey within realistic travel window
    if (diffMinutes < 45 && newIndex >= prevIndex && newIndex - prevIndex <= 3) {
      return journeyId;
    }
  }

  return `journey_bus_${Date.now()}`;
}

export interface CreateReportInput {
  direction: Direction;
  stopId: string;
  latitude: number;
  longitude: number;
  distanceToStopMeters: number;
  photoBlob: Blob;
  capturedAt: string;
  onboardingStopId: string;
  onboardingStopName: string;
  destinationStopId: string;
  destinationStopName: string;
  busIdentifier?: string;
  isNewBusInstance?: boolean;
  occupancyStatus?: BusOccupancyStatus;
  photoAngle?: PhotoAngle;
  imageVerification?: ImageVerificationResult;
}

export async function submitPassengerReport(input: CreateReportInput): Promise<BusReport> {
  const reports = getStoredReports();
  const stop = getStopById(input.stopId);
  if (!stop) {
    throw new Error('Invalid stop identifier');
  }

  const captureDate = new Date(input.capturedAt || Date.now());

  // Reject late reports older than 4 hours
  if (Date.now() - captureDate.getTime() > MAX_REPORT_AGE_MS) {
    throw new Error('Late reporting rejected: Sightings older than 4 hours cannot be submitted.');
  }

  const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Upload/store photo
  const photoUrl = await uploadBusPhoto(input.photoBlob, reportId);

  // Determine whether this updates an active bus or registers a new bus along the corridor
  const journeyId = resolveJourneyId(
    input.direction,
    stop,
    captureDate,
    reports,
    input.isNewBusInstance ?? false
  );

  // Check confidence
  const journeyReports = reports.filter((r) => r.journeyId === journeyId);
  const confidence: ReportConfidence = journeyReports.length > 0 ? 'multiple_confirmed' : 'fresh';

  const newReport: BusReport = {
    id: reportId,
    direction: input.direction,
    stopId: stop.id,
    stopName: stop.name,
    latitude: input.latitude,
    longitude: input.longitude,
    distanceToStopMeters: input.distanceToStopMeters,
    capturedAt: captureDate.toISOString(),
    photoUrl,
    journeyId,
    busIdentifier: input.busIdentifier || `Bus near ${stop.name}`,
    source: 'live_camera',
    passengerConfidence: confidence,
    occupancyStatus: input.occupancyStatus || 'seats_available',
    photoAngle: input.photoAngle || 'general',
    createdAt: new Date().toISOString(),
    onboardingStopId: input.onboardingStopId,
    onboardingStopName: input.onboardingStopName,
    destinationStopId: input.destinationStopId,
    destinationStopName: input.destinationStopName,
    verification_status: 'pending',
    imageVerification: input.imageVerification,
  };

  const updatedReports = [newReport, ...reports];
  saveReports(updatedReports);

  // Sync to Supabase cloud database immediately
  syncBusReportToSupabase(newReport).catch((err) => {
    console.warn('Background Supabase report sync error:', err);
  });

  // Trigger Supabase Edge Function in the background (never awaits, never blocks)
  triggerBackgroundEdgeFunctionValidation(newReport);

  return newReport;
}

/**
 * Returns comprehensive live status summary including ALL active buses running
 * simultaneously in the chosen direction within the 4-hour window.
 */
export function getLiveStatusSummary(
  direction: Direction,
  onboardingStopId?: string,
  now: Date = new Date()
): LiveStatusSummary {
  const reports = getReportsForDirection(direction);
  const orderedStops = getStopsForDirection(direction);
  const destinationStop = orderedStops[orderedStops.length - 1];

  if (reports.length === 0) {
    return {
      hasReport: false,
      activeBuses: [],
      primaryBus: null,
      latestReport: null,
      latestStop: null,
      currentCalculatedStop: null,
      calculatedPosition: null,
      confidence: 'none',
      confidenceLabel: 'No active bus spotted yet',
      timeAgoText: 'No live reports in last 4 hours',
      minutesAgo: 999,
      activeReportsCount: 0,
      nextStop: orderedStops[1] || null,
      estimatedNextArrivalMinutes: null,
      journeyProgressPercent: 0,
      isJourneyEnded: false,
      destinationReached: false,
      destinationStop,
      completedAtTimeString: null,
      minutesRemainingToDestination: 0,
    };
  }

  // Group reports by journeyId to extract each real active bus
  const journeyMap = new Map<string, BusReport[]>();
  for (const r of reports) {
    const list = journeyMap.get(r.journeyId) || [];
    list.push(r);
    journeyMap.set(r.journeyId, list);
  }

  const activeBuses: ActiveBus[] = [];
  let busCounter = 1;

  for (const [journeyId, jReports] of journeyMap.entries()) {
    const latestRep = jReports[0];
    const reportedStop = getStopById(latestRep.stopId) || orderedStops[0];
    const progression = calculateJourneyProgression(direction, latestRep, now);
    const busEtas = calculateRouteETAs(direction, latestRep, now);

    // Calculate ETA to the passenger's selected boarding stop
    let etaToOnboarding: number | null = null;
    if (onboardingStopId) {
      const match = busEtas.find((e) => e.stop.id === onboardingStopId);
      if (match && match.status === 'approaching') {
        etaToOnboarding = match.estimatedArrivalMinutes;
      } else if (match && match.status === 'current') {
        etaToOnboarding = 0;
      }
    }

    const currentCalcStop = progression ? progression.currentCalculatedStop : reportedStop;
    const calcPos = progression
      ? progression.calculatedPosition
      : { latitude: reportedStop.latitude, longitude: reportedStop.longitude };

    const timeAgo = formatTimeAgo(latestRep.capturedAt, now);
    const confidenceLabel = progression?.isJourneyEnded
      ? `🏁 Reached ${destinationStop.name} at ${progression.completedAtTimeString}`
      : `${latestRep.busIdentifier || `Bus #${busCounter}`} spotted near ${reportedStop.name} (${timeAgo.text})`;

    activeBuses.push({
      journeyId,
      busNumber: busCounter,
      busLabel: latestRep.busIdentifier || `Bus #${busCounter} (Near ${currentCalcStop.name})`,
      direction,
      latestReport: latestRep,
      reportedStop,
      destinationStop,
      currentCalculatedStop: currentCalcStop,
      nextStop: progression ? progression.nextStop : null,
      calculatedPosition: calcPos,
      minutesSinceReport: progression ? progression.minutesSinceReport : timeAgo.minutes,
      isJourneyEnded: progression ? progression.isJourneyEnded : false,
      destinationReached: progression ? progression.destinationReached : false,
      completedAtTimeString: progression ? progression.completedAtTimeString : null,
      occupancyStatus: latestRep.occupancyStatus || 'seats_available',
      etas: busEtas,
      etaToOnboardingStopMinutes: etaToOnboarding,
      confidence: latestRep.passengerConfidence,
      confidenceLabel,
    });

    busCounter++;
  }

  // Sort active buses: running buses first, nearest to destination/onboarding
  activeBuses.sort((a, b) => {
    if (a.isJourneyEnded && !b.isJourneyEnded) return 1;
    if (!a.isJourneyEnded && b.isJourneyEnded) return -1;
    return (a.etaToOnboardingStopMinutes ?? 999) - (b.etaToOnboardingStopMinutes ?? 999);
  });

  const primaryBus = activeBuses[0] || null;
  const latestReport = primaryBus ? primaryBus.latestReport : reports[0];
  const latestStop = primaryBus ? primaryBus.reportedStop : (getStopById(latestReport.stopId) || null);
  const timeAgo = formatTimeAgo(latestReport.capturedAt, now);

  const currentCalcIndex = primaryBus?.currentCalculatedStop
    ? orderedStops.findIndex((s) => s.id === primaryBus.currentCalculatedStop.id)
    : 0;
  const journeyProgressPercent = primaryBus?.isJourneyEnded
    ? 100
    : Math.round(((currentCalcIndex + 1) / orderedStops.length) * 100);

  return {
    hasReport: true,
    activeBuses,
    primaryBus,
    latestReport,
    latestStop,
    currentCalculatedStop: primaryBus ? primaryBus.currentCalculatedStop : latestStop,
    calculatedPosition: primaryBus ? primaryBus.calculatedPosition : null,
    confidence: primaryBus ? primaryBus.confidence : 'fresh',
    confidenceLabel: primaryBus ? primaryBus.confidenceLabel : 'Fresh passenger report',
    timeAgoText: timeAgo.text,
    minutesAgo: primaryBus ? primaryBus.minutesSinceReport : timeAgo.minutes,
    activeReportsCount: reports.length,
    nextStop: primaryBus ? primaryBus.nextStop : null,
    estimatedNextArrivalMinutes: primaryBus?.etas.find((e) => e.isDestination)?.estimatedArrivalMinutes ?? null,
    journeyProgressPercent,
    isJourneyEnded: primaryBus ? primaryBus.isJourneyEnded : false,
    destinationReached: primaryBus ? primaryBus.destinationReached : false,
    destinationStop,
    completedAtTimeString: primaryBus ? primaryBus.completedAtTimeString : null,
    minutesRemainingToDestination: primaryBus?.etas.find((e) => e.isDestination)?.estimatedArrivalMinutes ?? 0,
  };
}

/**
 * Clears all stored reports completely.
 */
export function clearAllReports(): void {
  localStorage.removeItem(STORAGE_KEY_REPORTS);
  localStorage.removeItem('sira_tumakuru_bus_reports_v3');
  localStorage.removeItem('sira_tumakuru_bus_reports_v2');
  localStorage.removeItem('sira_tumakuru_bus_reports_v1');
}
