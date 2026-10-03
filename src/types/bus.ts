export type Direction = 'sira_to_tumakuru' | 'tumakuru_to_sira';

export interface RouteStop {
  id: string;
  order: number;
  name: string;
  kannadaName: string;
  latitude: number;
  longitude: number;
  distanceFromSiraKm: number;
}

export type ReportConfidence = 'fresh' | 'multiple_confirmed' | 'stale' | 'none';

export type BusOccupancyStatus = 'seats_available' | 'standing_only' | 'full_rush';

export type PhotoAngle =
  | 'front'
  | 'side'
  | 'rear'
  | 'interior_standing'
  | 'window_view'
  | 'general';

export interface ImageVerificationResult {
  isBus: boolean;
  is_valid_bus_sighting?: boolean;
  confidence: number;
  reason?: string;
  detectedSubject: string;
  detectedAngle?: string;
  estimatedOccupancy?: string;
  rejectionReason?: string | null;
}

export interface BusReport {
  id: string;
  direction: Direction;
  stopId: string;
  stopName: string;
  latitude: number;
  longitude: number;
  distanceToStopMeters: number;
  capturedAt: string; // ISO String
  photoUrl: string; // blob or supabase URL
  journeyId: string;
  busIdentifier?: string; // e.g. "Bus #1", "Sira Express", etc.
  source: 'live_camera';
  passengerConfidence: ReportConfidence;
  createdAt: string;

  // Real-time crowding and perspective
  occupancyStatus: BusOccupancyStatus;
  photoAngle?: PhotoAngle;

  // Passenger Journey Segment (Onboarding & Destination)
  onboardingStopId: string;
  onboardingStopName: string;
  destinationStopId: string;
  destinationStopName: string;

  // Background Edge Function Verification status
  verification_status: 'pending' | 'valid' | 'invalid' | 'review';
  verification_reason?: string;

  // AI Image Verification result (optional legacy / detailed)
  imageVerification?: ImageVerificationResult;
}

export interface BusJourney {
  id: string;
  direction: Direction;
  startedAt: string;
  completedAt?: string;
  latestReportId: string;
  latestStopId: string;
  latestReportTime: string;
  status: 'active' | 'completed';
  reports: BusReport[];
}

export interface StopETA {
  stop: RouteStop;
  status: 'passed' | 'current' | 'approaching';
  estimatedArrivalMinutes: number | null;
  estimatedArrivalTimeString: string | null;
  passedAtTimeString?: string | null;
  distanceFromCurrentKm: number;
  isDestination?: boolean;
}

export interface ActiveBus {
  journeyId: string;
  busNumber: number;
  busLabel: string;
  direction: Direction;
  latestReport: BusReport;
  reportedStop: RouteStop;
  destinationStop: RouteStop;
  currentCalculatedStop: RouteStop;
  nextStop: RouteStop | null;
  calculatedPosition: { latitude: number; longitude: number };
  minutesSinceReport: number;
  isJourneyEnded: boolean;
  destinationReached: boolean;
  completedAtTimeString: string | null;
  occupancyStatus: BusOccupancyStatus;
  etas: StopETA[];
  etaToOnboardingStopMinutes: number | null;
  confidence: ReportConfidence;
  confidenceLabel: string;
}

export interface LiveStatusSummary {
  hasReport: boolean;
  activeBuses: ActiveBus[];
  primaryBus: ActiveBus | null;
  latestReport: BusReport | null;
  latestStop: RouteStop | null;
  currentCalculatedStop: RouteStop | null;
  calculatedPosition: { latitude: number; longitude: number } | null;
  confidence: ReportConfidence;
  confidenceLabel: string;
  timeAgoText: string;
  minutesAgo: number;
  activeReportsCount: number;
  nextStop: RouteStop | null;
  estimatedNextArrivalMinutes: number | null;
  journeyProgressPercent: number;

  // Real-time time progression & completion status
  isJourneyEnded: boolean;
  destinationReached: boolean;
  destinationStop: RouteStop | null;
  completedAtTimeString: string | null;
  minutesRemainingToDestination: number;
}
