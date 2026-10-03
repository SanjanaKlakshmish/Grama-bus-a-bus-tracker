import { createClient } from '@supabase/supabase-js';
import { BusReport, Direction } from '../types/bus';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mxhrsikshpvvfhjtpwsn.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_lr2dtsxDFfnlJLd1O2A19w_VhBDApMY';

// Initialize Supabase Client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Saves photo and GPS coordinates immediately to Supabase `bus_reports` table
 * with verification_status = "pending".
 */
export async function syncBusReportToSupabase(report: BusReport): Promise<boolean> {
  try {
    const { error } = await supabase.from('bus_reports').insert([
      {
        id: report.id,
        direction: report.direction,
        stop_id: report.stopId,
        stop_name: report.stopName,
        latitude: report.latitude,
        longitude: report.longitude,
        distance_to_stop_meters: report.distanceToStopMeters,
        captured_at: report.capturedAt,
        photo_url: report.photoUrl,
        journey_id: report.journeyId,
        passenger_confidence: report.passengerConfidence,
        onboarding_stop_id: report.onboardingStopId,
        onboarding_stop_name: report.onboardingStopName,
        destination_stop_id: report.destinationStopId,
        destination_stop_name: report.destinationStopName,
        verification_status: 'pending',
        is_bus_verified: true,
        detected_subject: report.imageVerification?.detectedSubject ?? 'Passenger live sighting',
        created_at: report.createdAt,
      },
    ]);

    if (error) {
      console.warn('Supabase sync for bus_report warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to sync bus report to Supabase:', err);
    return false;
  }
}

/**
 * Triggers the Supabase Edge Function "validate-bus-sighting" in the background.
 * The frontend NEVER awaits this function and never waits for Gemini.
 */
export function triggerBackgroundEdgeFunctionValidation(report: BusReport): void {
  // Fire and forget in background
  (async () => {
    try {
      // 1. Invoke Supabase Edge Function "validate-bus-sighting"
      const { data, error } = await supabase.functions.invoke('validate-bus-sighting', {
        body: {
          report_id: report.id,
          photo_url: report.photoUrl,
          captured_at: report.capturedAt,
          stop_name: report.stopName,
        },
      });

      if (!error && data) {
        console.log('Edge Function validation response:', data);
        return;
      }
    } catch (e) {
      console.warn('Supabase edge function invoke warning:', e);
    }

    // 2. Fallback to server background route
    try {
      await fetch('/api/validate-bus-sighting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: report.id,
          photo_url: report.photoUrl,
        }),
      });
    } catch (err) {
      console.warn('Background server validation trigger warning:', err);
    }
  })();
}

/**
 * Erases / purges reports older than 4 hours from Supabase table.
 */
export async function purgeOldSupabaseReports(hours: number = 4): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from('bus_reports').delete().lt('captured_at', cutoff);
    if (error) {
      console.warn('Supabase purge error:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Supabase purge error:', e);
    return false;
  }
}
