import React from 'react';
import { BusReport } from '../types/bus';
import { formatTimeAgo } from '../services/etaService';
import { Camera, Clock, MapPin, ShieldCheck, Users, ArrowRight, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';

interface RecentReportsFeedProps {
  reports: BusReport[];
  onSelectPhotoPreview: (photoUrl: string, stopName: string, time: string, report?: BusReport) => void;
}

export function RecentReportsFeed({
  reports,
  onSelectPhotoPreview,
}: RecentReportsFeedProps) {
  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center border border-slate-200">
        <p className="text-xs font-semibold text-slate-700">No recent passenger sightings</p>
        <p className="text-[11px] text-slate-500 mt-1">
          Be the first passenger travelling on this route to report the bus location.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Passenger Sighting History</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified with direct camera capture, AI bus check, and GPS timestamp
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
          {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
        </span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
        {reports.map((report) => {
          const timeAgo = formatTimeAgo(report.capturedAt);
          const clockTime = new Date(report.capturedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={report.id}
              className="p-3.5 sm:px-4 flex items-start justify-between gap-3 hover:bg-slate-50/60 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                {/* Photo Thumbnail */}
                <div
                  onClick={() =>
                    onSelectPhotoPreview(report.photoUrl, report.stopName, clockTime, report)
                  }
                  className="relative w-14 h-14 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200 cursor-pointer group mt-0.5"
                >
                  <img
                    src={report.photoUrl}
                    alt={report.stopName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      Spotted near {report.stopName}
                    </span>
                  </div>

                  {/* Passenger Boarding & Destination */}
                  {(report.onboardingStopName || report.destinationStopName) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 mt-1 font-medium truncate">
                      <span className="text-slate-500">Boarded at:</span>
                      <span className="text-emerald-800 font-semibold">{report.onboardingStopName || report.stopName}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="text-slate-800 font-semibold">{report.destinationStopName || 'Tumakuru'}</span>
                    </div>
                  )}

                  {/* Rush & Perspective Badges */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 border-slate-200 text-slate-800">
                      {report.occupancyStatus === 'seats_available' && '🟢 Seats Available'}
                      {report.occupancyStatus === 'standing_only' && '🟡 Standing Only'}
                      {report.occupancyStatus === 'full_rush' && '🔴 Full Rush'}
                      {!report.occupancyStatus && '🟢 Seats Available'}
                    </span>

                    {report.photoAngle && report.photoAngle !== 'general' && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {report.photoAngle === 'front' && '📷 Front View'}
                        {report.photoAngle === 'side' && '📷 Side View'}
                        {report.photoAngle === 'rear' && '📷 Rear / Back'}
                        {report.photoAngle === 'interior_standing' && '👥 Inside / Standing'}
                        {report.photoAngle === 'window_view' && '🪟 Window View'}
                      </span>
                    )}
                  </div>

                  {/* Metadata and AI verification note */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {timeAgo.text} ({clockTime})
                    </span>
                    <span aria-hidden="true">·</span>
                    {report.verification_status === 'valid' ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Verified Bus
                      </span>
                    ) : report.verification_status === 'review' ? (
                      <span className="text-blue-700 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-600" /> In Review
                      </span>
                    ) : report.verification_status === 'invalid' ? (
                      <span className="text-red-600 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" /> Flagged
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-500" /> Verifying in background
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onSelectPhotoPreview(report.photoUrl, report.stopName, clockTime, report)
                }
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 active:scale-95 transition-all shrink-0 mt-0.5"
              >
                View Photo
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
